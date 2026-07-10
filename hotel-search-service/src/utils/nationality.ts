import { NationalityModel } from "../models/Nationality.model";

/** Fallback map, used when the Nationality collection is empty or unreachable. */
const ISO_TO_TJ_COUNTRY_ID: Record<string, string> = {
  IN: "106",
  US: "232",
  GB: "235",
  AE: "231",
  SG: "200",
  MY: "131",
  AU: "14",
  CA: "40",
  DE: "83",
  FR: "76",
  JP: "112",
  CN: "45",
  NZ: "157",
  ZA: "204",
};

/**
 * The country list is a fixed reference table that changes at most when
 * TripJack revises their API, so a process-lifetime cache is safe and removes a
 * Mongo round-trip from the critical path of every search and every hotel-detail
 * request.
 */
const resolved = new Map<string, string>();

/** Maps an ISO 3166-1 alpha-2 code to TripJack's internal country id. */
export async function toTjNationality(isoCode: string): Promise<string> {
  const code = (isoCode || "IN").toUpperCase();

  const cached = resolved.get(code);
  if (cached) return cached;

  try {
    const found = await NationalityModel.findOne({ code })
      .select("countryId")
      .lean();
    const countryId = found?.countryId ?? ISO_TO_TJ_COUNTRY_ID[code] ?? "106";
    resolved.set(code, countryId);
    return countryId;
  } catch (err) {
    // A transient DB failure must not be memoised, or one blip pins this code to
    // its fallback for the life of the process.
    console.warn("[Nationality] DB lookup failed, using fallback.");
    return ISO_TO_TJ_COUNTRY_ID[code] ?? "106";
  }
}
