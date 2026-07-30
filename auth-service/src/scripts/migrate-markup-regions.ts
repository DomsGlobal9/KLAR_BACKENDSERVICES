/**
 * Migrates markup rules onto the region model.
 *
 * WHAT IT DOES
 * ------------
 *  1. Stamps every existing MarkupConfig row with region: "ALL".
 *  2. Stamps every agent Markup.services[] entry with region: "ALL".
 *  3. Drops the stale unique index { scope, serviceType } on markupconfigs.
 *
 * WHY STEP 3 MATTERS
 * ------------------
 * Mongo does not replace an index because a schema changed. While the old
 * { scope, serviceType } unique index survives, the FIRST region saved for a
 * service succeeds and the SECOND fails with E11000 — so a master could set a
 * DOMESTIC hotel markup and then be unable to set an INTERNATIONAL one, with a
 * duplicate-key error that names an index nobody expects to still exist.
 *
 * WHY "ALL" IS THE RIGHT TARGET
 * -----------------------------
 * ALL is the catch-all in the resolver (exact region first, then ALL), so a
 * migrated row prices exactly as it did before. Nobody's margin moves until a
 * master deliberately writes a region-specific rule.
 *
 * SAFE TO RE-RUN: every step is idempotent.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-markup-regions.ts --dry-run
 *   npx ts-node src/scripts/migrate-markup-regions.ts
 */

import mongoose from "mongoose";
import * as dotenv from "dotenv";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

/** The index this migration supersedes. */
const STALE_INDEX_KEY = { scope: 1, serviceType: 1 };

const sameKey = (a: Record<string, any>, b: Record<string, any>) => {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    return ak.length === bk.length && ak.every((k) => a[k] === b[k]);
};

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not set");

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
    const db = mongoose.connection.db;
    if (!db) throw new Error("no database handle after connect");



    // ── 1. MarkupConfig rows ────────────────────────────────────────────────
    const configs = db.collection("markupconfigs");
    const missingRegion = await configs.countDocuments({
        region: { $exists: false },
    });


    if (!DRY_RUN && missingRegion > 0) {
        const res = await configs.updateMany(
            { region: { $exists: false } },
            { $set: { region: "ALL" } }
        );

    }

    // ── 2. Agent markup services[] ──────────────────────────────────────────
    const markups = db.collection("markups");
    const agentsMissing = await markups.countDocuments({
        "services.region": { $exists: false },
        "services.0": { $exists: true },
    });


    if (!DRY_RUN && agentsMissing > 0) {
        // Positional-all update: every services[] element lacking a region.
        const res = await markups.updateMany(
            { "services.region": { $exists: false } },
            { $set: { "services.$[el].region": "ALL" } },
            { arrayFilters: [{ "el.region": { $exists: false } }] }
        );

    }

    // ── 3. Drop the superseded unique index ─────────────────────────────────
    const indexes = await configs.indexes();
    const stale = indexes.find(
        (ix: any) => ix.unique && sameKey(ix.key, STALE_INDEX_KEY)
    );

    if (!stale) {

    } else {

        if (!DRY_RUN) {
            await configs.dropIndex(stale.name as string);

        }
    }

    // Verify the replacement exists (Mongoose autoIndex normally creates it on
    // boot; say so plainly if it hasn't, rather than implying success).
    const after = await configs.indexes();
    const wanted = after.find((ix: any) =>
        sameKey(ix.key, { scope: 1, serviceType: 1, region: 1 })
    );
    console.log(
        wanted
            ? `replacement index present: ${wanted.name}`
            : "replacement { scope, serviceType, region } index NOT present yet — it is created when auth-service next boots with autoIndex on"
    );

    await mongoose.disconnect();

}

main().catch(async (err) => {

    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
