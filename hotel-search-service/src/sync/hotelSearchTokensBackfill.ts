import { HotelModel, buildSearchTokens } from "../models/Hotel.model";
import { isMongoReady } from "../utils/mongoReady";

/**
 * Keeps Hotel.searchTokens complete without human intervention.
 *
 * Three things have to stay true for hotel-name autocomplete to work:
 *
 *   1. The `searchTokens_1` index exists. `mongoose.set("autoIndex", false)` in
 *      config/db.ts means schema-declared indexes are never built, so a fresh
 *      environment would silently fall back to scanning 1.5M documents.
 *   2. Newly synced hotels carry tokens. tjHotelSync writes them explicitly —
 *      `bulkWrite` bypasses Mongoose middleware, so a schema hook would not run.
 *   3. Hotels that predate the field get tokens eventually. That is this job.
 *
 * The maintenance pass is incremental, resumable and idempotent: it walks
 * `_id` order in small batches, so it always makes forward progress, can be
 * interrupted at any point, and costs one indexed lookup when there is nothing
 * left to do.
 */

/** Rows still missing tokens. A missing field and an empty array both index as null. */
const PENDING = { searchTokens: null };

/** Force the multikey index: it seeks straight to the pending rows. */
const HINT = { searchTokens: 1 };

/** Hotels whose name or city carries a character outside plain ASCII. */
const NON_ASCII = { $regex: "[^\\x00-\\x7F]" };

/**
 * Tokenize in Node, through buildSearchTokens(), rather than in an aggregation
 * pipeline.
 *
 * The pipeline used to re-implement the split as `$regexFindAll: "[a-z0-9]+"`.
 * That is not what buildSearchTokens does — it strips diacritics first — and
 * aggregation cannot do Unicode normalisation at all, so the two could never be
 * made to agree. One tokenizer, called from both places, is the only way this
 * stays true.
 *
 * A hotel with neither a name nor a city would get an empty array, which indexes
 * as null and leaves the row in the pending set forever. Falling back to its id
 * guarantees every repaired row leaves that set, so the loop terminates.
 */
function tokensFor(doc: { name?: string; cityName?: string; tjHotelId?: string }): string[] {
  const tokens = buildSearchTokens(doc.name ?? "", doc.cityName ?? "");
  return tokens.length ? tokens : [(doc.tjHotelId ?? "unknown").toLowerCase()];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Idempotent. Cheap when the index already exists. Never mutates documents. */
export async function ensureAutocompleteIndex(): Promise<void> {
  const startedAt = Date.now();
  await HotelModel.collection.createIndex({ searchTokens: 1 }, { name: "searchTokens_1" });
  console.log(`[Tokens] searchTokens index ready (${Date.now() - startedAt}ms).`);
}

export interface MaintenanceOptions {
  /** Documents rewritten per batch. */
  batchSize?: number;
  /** Idle time between batches, to keep write load off the cluster. */
  pauseMs?: number;
}

/**
 * Fills in any hotel that lacks tokens, then returns. Does nothing — at the cost
 * of a single indexed lookup — when the collection is already complete.
 */
export async function runSearchTokenMaintenance(
  options: MaintenanceOptions = {},
): Promise<number> {
  const batchSize = options.batchSize ?? Number(process.env.SEARCH_TOKEN_BATCH_SIZE || 5000);
  const pauseMs = options.pauseMs ?? Number(process.env.SEARCH_TOKEN_PAUSE_MS || 1000);

  if (!isMongoReady()) {
    console.warn("⚠️  [Tokens] Skipped: MongoDB is not connected.");
    return 0;
  }

  await ensureAutocompleteIndex();

  // Costs one index seek (1 key, ~1ms) on a healthy collection, so a restart is
  // effectively free once every hotel has tokens.
  const anyPending = await HotelModel.findOne(PENDING).select("_id").hint(HINT).lean();
  if (!anyPending) {
    console.log("[Tokens] All hotels have searchTokens — nothing to do.");
    return 0;
  }

  console.log("[Tokens] Repairing hotels without searchTokens...");
  let repaired = 0;
  const startedAt = Date.now();

  for (;;) {
    // No sort. Sorting by _id makes MongoDB walk the _id index past every
    // already-tokenized hotel — measured at 47s per batch against 98ms here.
    // Each repaired row leaves the pending set, so successive batches advance.
    const batch = await HotelModel.find(PENDING)
      .select("_id name cityName tjHotelId")
      .hint(HINT)
      .limit(batchSize)
      .lean();
    if (!batch.length) break;

    const ops = batch.map((d: any) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { searchTokens: tokensFor(d) } } },
    }));
    const result = await HotelModel.collection.bulkWrite(ops, { ordered: false });
    repaired += result.modifiedCount;

    if (result.modifiedCount === 0) {
      console.warn(
        `[Tokens] ${batch.length} hotels could not be repaired — stopping to avoid a loop.`,
      );
      break;
    }

    console.log(`[Tokens] ${repaired} repaired so far...`);
    if (pauseMs > 0) await sleep(pauseMs);
  }

  console.log(
    `[Tokens] Repaired ${repaired} hotels in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`,
  );
  return repaired;
}

/**
 * Re-tokenize hotels whose name or city contains an accented character.
 *
 * These rows already have `searchTokens`, so the pending-set pass above skips
 * them — but the tokens are wrong. The old tokenizer treated every accent as a
 * word separator, shredding "Hôtel Zürich" into h / tel / z / rich, which no
 * query could ever match. Only the fixed tokenizer can tell.
 *
 * This is a full-collection filter, not an index seek, so it is a deliberate
 * one-off run from `npm run backfill:tokens` rather than a boot hook. Idempotent:
 * a second run rewrites nothing, because bulkWrite skips identical documents.
 */
export async function repairUnicodeTokens(batchSize = 1000): Promise<number> {
  if (!isMongoReady()) {
    console.warn("⚠️  [Tokens] Unicode repair skipped: MongoDB is not connected.");
    return 0;
  }

  console.log("[Tokens] Scanning for hotels with accented names...");
  const startedAt = Date.now();

  const cursor = HotelModel.find({ $or: [{ name: NON_ASCII }, { cityName: NON_ASCII }] })
    .select("_id name cityName tjHotelId searchTokens")
    .lean()
    .cursor();

  let repaired = 0;
  let scanned = 0;
  let ops: any[] = [];

  const flush = async () => {
    if (!ops.length) return;
    const result = await HotelModel.collection.bulkWrite(ops, { ordered: false });
    repaired += result.modifiedCount;
    ops = [];
  };

  for await (const doc of cursor as any) {
    scanned++;
    const tokens = tokensFor(doc);
    const current: string[] = doc.searchTokens ?? [];
    const unchanged =
      current.length === tokens.length && tokens.every((t, i) => current[i] === t);
    if (unchanged) continue;

    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { searchTokens: tokens } } } });
    if (ops.length >= batchSize) await flush();
  }
  await flush();

  console.log(
    `[Tokens] Unicode repair: ${repaired} of ${scanned} accented hotels rewritten ` +
      `in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`,
  );
  return repaired;
}

/**
 * Boot hook. Runs in the background so it never delays `listen()`, and throttles
 * itself so a restart cannot hammer the cluster. Set DISABLE_TOKEN_MAINTENANCE=true
 * to turn it off entirely.
 */
export function startSearchTokenMaintenance(): void {
  if (process.env.DISABLE_TOKEN_MAINTENANCE === "true") {
    console.log("ℹ️  [Tokens] Maintenance disabled via DISABLE_TOKEN_MAINTENANCE.");
    return;
  }

  runSearchTokenMaintenance().catch((err) =>
    console.error("❌ [Tokens] Maintenance failed:", err.message),
  );
}
