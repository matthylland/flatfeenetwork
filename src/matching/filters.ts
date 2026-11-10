import { ASSET_RANGES, FEE_BUDGETS, FEE_STRETCH, INCOME_RANGES } from "@/taxonomy/vocab";
import type { AdvisorCandidate, Constraints, FilterResult, LatLng, ProspectAnswers } from "./types";

/** Maximum distance for an in-person-required match. */
export const IN_PERSON_MAX_MILES = 60;

export function milesBetween(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** The prospect's fee ceiling in dollars, or null when there is none. */
export function feeCeiling(p: ProspectAnswers, c: Constraints): number | null {
  if (c.feeCeiling !== undefined) return c.feeCeiling;
  const b = FEE_BUDGETS.find((x) => x.key === p.budget);
  if (!b || b.max === null) return null;
  return b.max * (1 + FEE_STRETCH);
}

const rangeMax = (list: readonly { key: string; max: number | null }[], key?: string) =>
  key ? (list.find((r) => r.key === key)?.max ?? null) : null;

/**
 * Hard filters. Missing advisor data never fails a filter, except a prospect's
 * "must have" value, which needs a confirmed yes. The advisor's state of
 * registration is never checked: advisors can serve any state under the
 * de minimis rule. Only an advisor's own "not taking clients in" list applies.
 */
export function passesFilters(a: AdvisorCandidate, p: ProspectAnswers, c: Constraints): FilterResult {
  const f = a.facts;
  if (c.excludedProfileIds.includes(a.profileId)) return { pass: false, reason: "excluded" };

  if (p.state && f.excluded_states?.includes(p.state)) return { pass: false, reason: "state_excluded" };

  const ceiling = feeCeiling(p, c);
  if (ceiling !== null && f.annual_fee_range && f.annual_fee_range.min > ceiling) return { pass: false, reason: "over_budget" };
  if (c.feeFloor !== undefined && f.annual_fee_range && f.annual_fee_range.max <= c.feeFloor) return { pass: false, reason: "under_fee_floor" };

  const assetsMax = rangeMax(ASSET_RANGES, p.assets);
  if (assetsMax !== null && f.asset_minimum !== undefined && f.asset_minimum > assetsMax) return { pass: false, reason: "asset_minimum" };
  const incomeMax = rangeMax(INCOME_RANGES, p.income);
  if (incomeMax !== null && f.income_minimum !== undefined && f.income_minimum > incomeMax) return { pass: false, reason: "income_minimum" };

  // An advisor offering both models passes either request; "not sure" passes everyone.
  if (p.offering && p.offering !== "not_sure" && f.offering_models && !f.offering_models.includes(p.offering)) {
    return { pass: false, reason: "offering_model" };
  }

  if (c.inPersonRequired) {
    if (f.meeting_formats && !f.meeting_formats.includes("in_person")) return { pass: false, reason: "no_in_person" };
    if (p.location && a.officeLocation && milesBetween(p.location, a.officeLocation) > IN_PERSON_MAX_MILES) return { pass: false, reason: "too_far" };
  }
  if ((c.virtualRequired || p.meeting === "virtual_only") && f.meeting_formats && !f.meeting_formats.includes("virtual")) {
    return { pass: false, reason: "no_virtual" };
  }

  for (const v of p.mustHaveValues) if (!f.values_signals?.includes(v)) return { pass: false, reason: "missing_must_have" };

  return { pass: true };
}
