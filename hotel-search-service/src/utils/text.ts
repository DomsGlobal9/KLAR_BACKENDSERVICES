/**
 * The single definition of "how a string becomes searchable words".
 *
 * Both sides of hotel autocomplete must agree on this. They did not: the query
 * was NFD-normalised (diacritics stripped) while Hotel.searchTokens was split on
 * a bare [a-z0-9]+ boundary, which treats an accent as a *separator*. So
 * "Hotel Zurich" spelled with its real diacritics indexed as h / tel / z / rich
 * and could not be found by typing its own name. Anything that tokenizes a hotel
 * name or a query must import from here.
 */

const DIACRITICS = /[̀-ͯ]/g;

/** Lowercase, strip diacritics ("Café" → "cafe"), trim. */
export function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(DIACRITICS, "").trim();
}

/** Normalize, then split on anything that is not a letter or a digit. */
export function tokenizeText(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Damerau-Levenshtein (optimal string alignment): a swap of adjacent letters is
 * one edit, not two. Typing "delih" for "Delhi" is one transposition; plain
 * Levenshtein scores it 2 and lets "Delph" win on distance.
 *
 * Bails out as soon as the best achievable score exceeds `max`, so a hopeless
 * candidate costs a couple of rows rather than a full matrix.
 */
export function boundedEditDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let twoAgo: number[] = [];
  let prev = Array.from({ length: a.length + 1 }, (_, i) => i);
  let curr = new Array<number>(a.length + 1);

  for (let i = 1; i <= b.length; i++) {
    curr[0] = i;
    let rowMin = curr[0];

    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      let best = Math.min(prev[j - 1] + cost, curr[j - 1] + 1, prev[j] + 1);

      if (i > 1 && j > 1 && b[i - 1] === a[j - 2] && b[i - 2] === a[j - 1]) {
        best = Math.min(best, twoAgo[j - 2] + 1); // adjacent transposition
      }

      curr[j] = best;
      if (best < rowMin) rowMin = best;
    }

    if (rowMin > max) return max + 1;
    twoAgo = prev;
    prev = curr;
    curr = new Array<number>(a.length + 1);
  }
  return prev[a.length];
}
