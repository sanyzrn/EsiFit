/**
 * Readiness factor JSON serializer — typed boundary between domain output
 * and the JSON string column in SQLite.
 */

export type ReadinessFactorRow = {
  type: string;
  label: string;
  normalizedScore: number;
  weight: number;
  source: string;
};

export function generateReadinessFactorsJson(factors: ReadinessFactorRow[]): string {
  return JSON.stringify(factors);
}

export function parseReadinessFactors(json: string): ReadinessFactorRow[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is ReadinessFactorRow =>
        typeof f?.type === "string" && typeof f?.label === "string" && typeof f?.normalizedScore === "number",
    );
  } catch {
    return [];
  }
}
