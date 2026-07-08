export function getLevenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export interface CityCandidate {
  name: string;
  countryCode: string;
  stateCode: string;
  latitude: string;
  longitude: string;
}

export function fuzzyFindCities(query: string, allCities: CityCandidate[]): CityCandidate[] {
  if (!query || query.length < 2) return [];

  const qLower = query.toLowerCase().trim();
  const qFirst = qLower[0];
  const qLen = qLower.length;

  let maxDistance = 1;
  if (qLen < 4) {
    maxDistance = 0;
  } else if (qLen >= 7) {
    maxDistance = 2; // Allow up to 2 typos for medium-long queries
  }

  // Pre-filter candidate cities: must start with the same first letter and be within edit length tolerance
  const candidates = allCities.filter((c) => {
    const name = c.name.toLowerCase();
    return (
      name[0] === qFirst &&
      name.length >= qLen - maxDistance &&
      name.length <= qLen + maxDistance
    );
  });

  const results: Array<{ city: CityCandidate; dist: number }> = [];
  for (const c of candidates) {
    const dist = getLevenshteinDistance(qLower, c.name.toLowerCase());
    if (dist <= maxDistance) {
      results.push({ city: c, dist });
    }
  }

  return results.sort((a, b) => a.dist - b.dist).map((r) => r.city);
}
