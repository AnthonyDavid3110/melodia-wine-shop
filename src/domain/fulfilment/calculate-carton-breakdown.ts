export interface CartonBreakdown {
  cartons: number;
  looseBottles: number;
}

/**
 * Informational-only logistical helper (BR-REQ-001, docs/03 §35,
 * docs/06 §30) — the exact bottle count from `calculateWineRequirements`
 * remains the authoritative requirement everywhere; this only reshapes
 * it for display (e.g. "137 bouteilles = 22 cartons + 5 bouteilles").
 * Never rounds, never used to derive or replace a requirement quantity.
 */
export function calculateCartonBreakdown(bottles: number, bottlesPerCarton = 6): CartonBreakdown {
  if (!Number.isInteger(bottles) || bottles < 0) {
    throw new Error(`bottles must be a non-negative integer, received ${bottles}`);
  }
  if (!Number.isInteger(bottlesPerCarton) || bottlesPerCarton <= 0) {
    throw new Error(`bottlesPerCarton must be a positive integer, received ${bottlesPerCarton}`);
  }

  return {
    cartons: Math.floor(bottles / bottlesPerCarton),
    looseBottles: bottles % bottlesPerCarton,
  };
}
