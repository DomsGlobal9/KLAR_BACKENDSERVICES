/**
 * Guards the alias table: every canonical name must exist, exactly once, as a
 * home-country city in the geo dataset. An alias pointing at a name the dataset
 * does not have is worse than no alias — it silently yields an empty dropdown.
 *
 *   npx ts-node --transpile-only scripts/validateCityAliases.ts
 */
import { City, State } from "country-state-city";
import { CITY_ALIASES, STATE_ALIASES } from "../src/data/cityAliases";
import { HOME_COUNTRY, normalize } from "../src/services/suggestionIndex";

const cities = City.getAllCities();
const states = State.getAllStates();
let failures = 0;
let checked = 0;

/** `locate` returns the dataset rows a canonical name resolves to, if any. */
function check(
  alias: string,
  canonical: string,
  locate: (canonical: string) => string[],
): void {
  checked++;
  const where = locate(canonical);

  if (where.length === 0) {
    console.error(`✗ ${alias.padEnd(14)} → "${canonical}" NOT FOUND in ${HOME_COUNTRY}`);
    failures++;
  } else if (normalize(alias) !== alias) {
    console.error(`✗ ${alias.padEnd(14)} key is not normalized`);
    failures++;
  } else {
    console.log(`✓ ${alias.padEnd(14)} → ${canonical} (${where.join(", ")})`);
  }
}

for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
  check(alias, canonical, (name) => [
    ...new Set(
      cities
        .filter((c) => c.countryCode === HOME_COUNTRY && normalize(c.name) === normalize(name))
        .map((c) => c.stateCode),
    ),
  ]);
}

for (const [alias, canonical] of Object.entries(STATE_ALIASES)) {
  check(alias, canonical, (name) =>
    states
      .filter((s) => s.countryCode === HOME_COUNTRY && normalize(s.name) === normalize(name))
      .map((s) => s.isoCode),
  );
}

// An alias listed as both a city and a state resolves ambiguously — whichever
// table `resolveCityAlias` reads first silently wins.
for (const alias of Object.keys(STATE_ALIASES)) {
  if (alias in CITY_ALIASES) {
    console.error(`✗ ${alias.padEnd(14)} appears in both CITY_ALIASES and STATE_ALIASES`);
    failures++;
  }
}

console.log(`\n${checked - failures}/${checked} aliases valid.`);
process.exit(failures === 0 ? 0 : 1);
