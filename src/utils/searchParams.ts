type NormalizeSelectionOptions = {
  lowercase?: boolean;
};

export function normalizeSelection(
  values: string[],
  options: NormalizeSelectionOptions = {}
): string[] {
  const { lowercase = true } = options;
  return [...new Set(
    values
      .map(value => value.trim())
      .filter(Boolean)
      .map(value => (lowercase ? value.toLowerCase() : value))
  )].sort((a, b) => a.localeCompare(b));
}

export function parseCsvParam(
  raw: string | null,
  options: NormalizeSelectionOptions = {}
): string[] {
  if (!raw) return [];
  return normalizeSelection(raw.split(`,`), options);
}

export function parsePositiveIntParam(
  raw: string | null,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return fallback;
  if (parsed < min || parsed > max) return fallback;
  return parsed;
}

export function parseNullableNonNegativeIntParam(raw: string | null): number | null {
  if (!raw?.trim()) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return null;
  return parsed;
}
