import type { AdvisorCandidate, Constraints } from "./types";

/**
 * Turn a "not for me" reason into new constraints for the next set of 3.
 * The passed-on advisor is always excluded from later rounds.
 */
export function applyPassReason(c: Constraints, reason: string, advisor: AdvisorCandidate): Constraints {
  const next: Constraints = { ...c, excludedProfileIds: [...new Set([...c.excludedProfileIds, advisor.profileId])] };
  const fee = advisor.facts.annual_fee_range;
  switch (reason) {
    case "fee_too_high":
      if (fee) next.feeCeiling = Math.min(c.feeCeiling ?? Infinity, fee.min - 1);
      break;
    case "fee_too_low":
      if (fee) next.feeFloor = Math.max(c.feeFloor ?? 0, fee.max);
      break;
    case "want_in_person":
      next.inPersonRequired = true;
      next.virtualRequired = false;
      break;
    case "want_virtual":
      next.virtualRequired = true;
      next.inPersonRequired = false;
      break;
    case "firm_too_small":
      if (advisor.clientCount !== undefined) next.preferFirmSize = { direction: "larger", than: advisor.clientCount };
      break;
    case "firm_too_large":
      if (advisor.clientCount !== undefined) next.preferFirmSize = { direction: "smaller", than: advisor.clientCount };
      break;
    // wrong_specialty, not_my_style, other: exclusion only.
  }
  return next;
}

/** "Show me 3 more": exclude everyone already shown, change nothing else. */
export function showMore(c: Constraints, shownProfileIds: string[]): Constraints {
  return { ...c, excludedProfileIds: [...new Set([...c.excludedProfileIds, ...shownProfileIds])] };
}

export const emptyConstraints = (): Constraints => ({ excludedProfileIds: [] });
