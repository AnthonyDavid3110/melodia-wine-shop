/**
 * Phase 12 Gate 12C — ECM's real, validated organisation identity for
 * customer-facing commercial documents (order confirmation / receipt).
 * Public information, provided directly by ECM — never a secret, never
 * an environment variable (CLAUDE.md §30/§57 placeholder policy does
 * not apply here: this is final, confirmed content, not a placeholder).
 */
export const ORGANISATION_IDENTITY = {
  name: "Ensemble de Cuivres Mélodia",
  addressLines: ["c/o Amanda Maurer, présidente", "Route de Lavigny 3", "1163 Etoy", "Suisse"],
} as const;
