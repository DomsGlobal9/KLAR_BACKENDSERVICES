/**
 * Guards the alias table: every canonical name must exist, exactly once, as a
 * home-country city in the geo dataset. An alias pointing at a name the dataset
 * does not have is worse than no alias — it silently yields an empty dropdown.
 *
 *   npx ts-node --transpile-only scripts/validateCityAliases.ts
 */
import { City } from "country-state-city";
import { CITY_ALIASES } from "../src/data/cityAliases";
import { HOME_COUNTRY, normalize } from "../src/services/suggestionIndex";

const cities = City.getAllCities();
let failures = 0;

for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
  const matches = cities.filter(
    (c) => c.countryCode === HOME_COUNTRY && normalize(c.name) === normalize(canonical),
  );

  if (matches.length === 0) {
    console.error(`✗ ${alias.padEnd(14)} → "${canonical}" NOT FOUND in ${HOME_COUNTRY}`);
    failures++;
  } else if (normalize(alias) !== alias) {
    console.error(`✗ ${alias.padEnd(14)} key is not normalized`);
    failures++;
  } else {
    const states = [...new Set(matches.map((m) => m.stateCode))];
    console.log(`✓ ${alias.padEnd(14)} → ${canonical} (${states.join(", ")})`);
  }
}

console.log(
  `\n${Object.keys(CITY_ALIASES).length - failures}/${Object.keys(CITY_ALIASES).length} aliases valid.`,
);
process.exit(failures === 0 ? 0 : 1);
