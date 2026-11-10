import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db/client";
import { extractedFacts, firms, profiles } from "@/db/schema";
import type { AdvisorCandidate, AdvisorFacts } from "./types";

/** Facts the matcher reads. Only confirmed facts are loaded. */
const MATCH_FIELDS = [
  "annual_fee_range", "offering_models", "meeting_formats", "asset_minimum", "income_minimum", "excluded_states",
  "top_services", "top_niches", "life_event_specialties", "typical_asset_range", "involvement_style",
  "meeting_cadence", "values_signals", "tax_depth", "prepares_returns",
] as const;

/**
 * Load every live listing as a match candidate. Fine for launch volumes (tens
 * of thousands of rows); move the hard filters into SQL when it isn't.
 */
export async function loadCandidates(db: Db): Promise<AdvisorCandidate[]> {
  const rows = await db
    .select({ id: profiles.id, tier: profiles.tier, clientCount: firms.clientCount })
    .from(profiles)
    .innerJoin(firms, eq(firms.id, profiles.firmId))
    .where(and(eq(profiles.isLive, true), eq(firms.flatFeeCandidate, true)));

  const facts = await db
    .select({ profileId: extractedFacts.profileId, fieldKey: extractedFacts.fieldKey, value: extractedFacts.value })
    .from(extractedFacts)
    .where(and(eq(extractedFacts.status, "confirmed"), inArray(extractedFacts.fieldKey, [...MATCH_FIELDS])));

  const byProfile = new Map<string, AdvisorFacts>();
  for (const f of facts) {
    const entry = byProfile.get(f.profileId) ?? {};
    (entry as Record<string, unknown>)[f.fieldKey] = f.value;
    byProfile.set(f.profileId, entry);
  }

  return rows.map((r) => ({
    profileId: r.id,
    claimed: r.tier !== "unclaimed",
    facts: byProfile.get(r.id) ?? {},
    clientCount: r.clientCount ?? undefined,
  }));
}
