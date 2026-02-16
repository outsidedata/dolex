import { normalizeGeoName } from './normalize.js';

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

export interface FuzzySuggestion {
  value: string;
  suggestion: string;
  distance: number;
}

export function suggestMatch(
  input: string,
  candidates: string[],
  maxDistance: number = 3,
): FuzzySuggestion | undefined {
  const normalized = normalizeGeoName(input);
  if (!normalized) return undefined;

  let bestMatch: string | undefined;
  let bestDistance = maxDistance + 1;

  for (const candidate of candidates) {
    const normCandidate = normalizeGeoName(candidate);
    const dist = levenshtein(normalized, normCandidate);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = candidate;
    }
  }

  if (bestMatch && bestDistance <= maxDistance) {
    return { value: input, suggestion: bestMatch, distance: bestDistance };
  }
  return undefined;
}
