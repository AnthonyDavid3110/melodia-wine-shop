/**
 * Campaign readiness classification (Phase 5 Gate 1/2A, approved in
 * principle). Pure function over already-gathered facts — computed on
 * demand, never persisted, never a database/business invariant. Only
 * `anotherActiveCampaignExists` is ever BLOCKING; everything else is a
 * WARNING or purely INFORMATIONAL, so this never silently prevents a
 * legitimate activation over incomplete-but-valid content (Phase 4
 * already renders a graceful public state for an empty/partial
 * catalog).
 */
export type ReadinessSeverity = "blocking" | "warning" | "informational";

export interface ReadinessFinding {
  severity: ReadinessSeverity;
  message: string;
}

export interface CampaignReadinessFacts {
  anotherActiveCampaignExists: boolean;
  publicTitle: string | null;
  visibleProductCount: number;
  zeroPricedVisibleProductCount: number;
  brokenActiveBundleCount: number;
  activeSellerCount: number;
  hasAnyDate: boolean;
}

export function checkCampaignReadiness(facts: CampaignReadinessFacts): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];

  if (facts.anotherActiveCampaignExists) {
    findings.push({
      severity: "blocking",
      message: "Une autre campagne est déjà active. Clôturez-la avant d'activer celle-ci.",
    });
  }

  if (facts.visibleProductCount === 0) {
    findings.push({
      severity: "warning",
      message: "Aucun vin visible n'est configuré pour cette campagne.",
    });
  }

  if (facts.zeroPricedVisibleProductCount > 0) {
    findings.push({
      severity: "warning",
      message: `${facts.zeroPricedVisibleProductCount} vin(s) visible(s) ont un prix de CHF 0.–.`,
    });
  }

  if (facts.brokenActiveBundleCount > 0) {
    findings.push({
      severity: "warning",
      message: `${facts.brokenActiveBundleCount} carton(s) contiennent un composant invalide et n'apparaîtront pas publiquement.`,
    });
  }

  if (!facts.publicTitle) {
    findings.push({
      severity: "warning",
      message: "Aucun titre public défini — le nom de la campagne sera affiché à la place.",
    });
  }

  if (facts.activeSellerCount === 0) {
    findings.push({
      severity: "informational",
      message: "Aucun vendeur n'est configuré pour cette campagne.",
    });
  }

  if (!facts.hasAnyDate) {
    findings.push({
      severity: "informational",
      message: "Aucune date n'est définie (à titre indicatif uniquement).",
    });
  }

  return findings;
}

export function hasBlockingFindings(findings: readonly ReadinessFinding[]): boolean {
  return findings.some((finding) => finding.severity === "blocking");
}
