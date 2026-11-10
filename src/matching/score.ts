import { FEE_BUDGETS } from "@/taxonomy/vocab";
import { feeCeiling, milesBetween } from "./filters";
import type { AdvisorCandidate, Constraints, FacetScore, ProspectAnswers, ScoredCandidate } from "./types";

/**
 * Facet weights. Bump SCORER_VERSION whenever these or the facet logic
 * change; every stored match set records the version that produced it.
 */
export const SCORER_VERSION = "2026-11-10.1";

export const WEIGHTS = {
  semantic: 4,
  life_events: 3,
  services: 3,
  typical_assets: 2,
  involvement: 2,
  distance: 2,
  cadence: 1.5,
  tax_depth: 1.5,
  values: 1,
  budget_fit: 1,
  firm_size: 1,
} as const;

type Facet = keyof typeof WEIGHTS;

const overlap = (wanted: string[], have?: string[]) => {
  if (!have || !wanted.length) return null;
  return wanted.filter((w) => have.includes(w)).length / wanted.length;
};

/**
 * Each facet returns a value in [0, 1], or null when the advisor has no data
 * for it (no credit, never a penalty), or undefined when the facet doesn't
 * apply to this prospect at all.
 *
 * Note what is NOT an input: the advisor's tier. A paid and a free profile
 * with the same confirmed facts get the same score.
 */
function facetValue(facet: Facet, a: AdvisorCandidate, p: ProspectAnswers, c: Constraints): number | null | undefined {
  const f = a.facts;
  switch (facet) {
    case "semantic":
      return a.semanticSimilarity ?? null;
    case "life_events":
      return p.lifeEvents.length ? overlap(p.lifeEvents.filter((e) => e !== "other"), f.life_event_specialties) : undefined;
    case "services":
      return p.services.length ? overlap(p.services, f.top_services) : undefined;
    case "typical_assets":
      return p.assets ? (f.typical_asset_range ? Number(f.typical_asset_range.includes(p.assets)) : null) : undefined;
    case "involvement":
      return p.involvement ? (f.involvement_style ? Number(f.involvement_style.includes(p.involvement)) : null) : undefined;
    case "cadence":
      return p.cadence ? (f.meeting_cadence ? Number(f.meeting_cadence.includes(p.cadence)) : null) : undefined;
    case "values":
      return p.values.length ? overlap(p.values, f.values_signals) : undefined;
    case "tax_depth":
      return p.services.includes("tax_planning") ? (f.tax_depth !== undefined ? f.tax_depth / 4 : null) : undefined;
    case "distance": {
      if (p.meeting !== "in_person_preferred" && !c.inPersonRequired) return undefined;
      if (!p.location || !a.officeLocation) return null;
      if (f.meeting_formats && !f.meeting_formats.includes("in_person")) return 0;
      return Math.max(0, 1 - milesBetween(p.location, a.officeLocation) / 100);
    }
    case "budget_fit": {
      const ceiling = feeCeiling(p, c);
      if (ceiling === null) return undefined;
      if (!f.annual_fee_range) return null;
      const plain = c.feeCeiling ?? FEE_BUDGETS.find((b) => b.key === p.budget)?.max ?? ceiling;
      return f.annual_fee_range.min <= plain ? 1 : 0.5; // within budget vs within the stretch allowance
    }
    case "firm_size": {
      if (!c.preferFirmSize) return undefined;
      if (a.clientCount === undefined) return null;
      const { direction, than } = c.preferFirmSize;
      return direction === "larger" ? Number(a.clientCount > than) : Number(a.clientCount < than);
    }
  }
}

export function scoreCandidate(a: AdvisorCandidate, p: ProspectAnswers, c: Constraints): ScoredCandidate {
  const breakdown: FacetScore[] = [];
  for (const facet of Object.keys(WEIGHTS) as Facet[]) {
    const value = facetValue(facet, a, p, c);
    if (value === undefined) continue;
    const weight = WEIGHTS[facet];
    breakdown.push({ facet, weight, value, points: value === null ? 0 : weight * value });
  }
  const score = breakdown.reduce((s, b) => s + b.points, 0);
  return { candidate: a, score, breakdown };
}
