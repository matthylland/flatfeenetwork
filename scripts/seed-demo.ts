/**
 * Seed fictional claimed advisors so the questionnaire and results pages can be
 * tried before real advisors claim profiles. Local and preview databases only:
 *
 *   npm run seed:demo
 *
 * Every demo firm has a CRD of 900000+ and a slug starting "demo-". Running it
 * again replaces the demo data and touches nothing else.
 */
import { gte, inArray } from "drizzle-orm";
import { createDb } from "../src/db/client";
import { extractedFacts, firms, profiles } from "../src/db/schema";
import { TAXONOMY_VERSION } from "../src/taxonomy/vocab";
import { validateFactValue } from "../src/taxonomy/fields";

type Demo = { name: string; city: string; state: string; clients: number; facts: Record<string, unknown> };

const DEMOS: Demo[] = [
  {
    name: "Harbor Retirement Planning", city: "Austin", state: "TX", clients: 85,
    facts: { annual_fee_range: { min: 5000, max: 8000 }, offering_models: ["advice_only"], meeting_formats: ["virtual", "in_person"], top_services: ["retirement_income", "tax_planning"], life_event_specialties: ["retiring_soon"], typical_asset_range: ["1m_3m"], involvement_style: ["collaborate"], meeting_cadence: ["quarterly"], tax_depth: 3 },
  },
  {
    name: "Clearpath Financial", city: "Denver", state: "CO", clients: 140,
    facts: { annual_fee_range: { min: 7500, max: 12000 }, offering_models: ["advice_only", "investment_management"], meeting_formats: ["virtual"], top_services: ["investment_management", "retirement_income"], life_event_specialties: ["retiring_soon", "windfall_inheritance"], typical_asset_range: ["1m_3m", "3m_10m"], involvement_style: ["hand_off"], meeting_cadence: ["quarterly"], tax_depth: 2 },
  },
  {
    name: "Equity Path Advisors", city: "San Jose", state: "CA", clients: 60,
    facts: { annual_fee_range: { min: 6000, max: 9000 }, offering_models: ["advice_only"], meeting_formats: ["virtual"], top_services: ["equity_comp", "tax_planning"], life_event_specialties: ["new_job_equity"], typical_asset_range: ["250k_1m", "1m_3m"], involvement_style: ["learn_diy", "collaborate"], meeting_cadence: ["on_demand"], tax_depth: 4 },
  },
  {
    name: "Steady Ground Planning", city: "Columbus", state: "OH", clients: 45,
    facts: { annual_fee_range: { min: 2400, max: 4800 }, offering_models: ["advice_only"], meeting_formats: ["virtual"], top_services: ["cash_flow_budgeting", "college_planning"], life_event_specialties: ["want_a_plan", "marriage"], typical_asset_range: ["lt_250k", "250k_1m"], involvement_style: ["learn_diy"], meeting_cadence: ["annual_semiannual"], tax_depth: 2, values_signals: ["values_based_investing"] },
  },
  {
    name: "Second Chapter Wealth", city: "Atlanta", state: "GA", clients: 110,
    facts: { annual_fee_range: { min: 8000, max: 15000 }, offering_models: ["investment_management"], meeting_formats: ["virtual", "in_person"], top_services: ["estate_planning", "investment_management"], life_event_specialties: ["death_of_spouse", "divorce"], typical_asset_range: ["1m_3m", "3m_10m"], involvement_style: ["hand_off"], meeting_cadence: ["quarterly"], tax_depth: 2, values_signals: ["woman_advisor"] },
  },
  {
    name: "Main Street Owner Advisors", city: "Phoenix", state: "AZ", clients: 70,
    facts: { annual_fee_range: { min: 9000, max: 14000 }, offering_models: ["advice_only", "investment_management"], meeting_formats: ["virtual"], top_services: ["business_owner", "tax_planning"], life_event_specialties: ["business_sale"], typical_asset_range: ["3m_10m"], involvement_style: ["collaborate"], meeting_cadence: ["quarterly"], tax_depth: 4 },
  },
];

async function main() {
  const { db, pool } = createDb();
  try {
    const old = await db.select({ id: firms.id }).from(firms).where(gte(firms.crd, 900000));
    if (old.length) {
      const oldProfiles = await db.select({ id: profiles.id }).from(profiles).where(inArray(profiles.firmId, old.map((f) => f.id)));
      if (oldProfiles.length) await db.delete(extractedFacts).where(inArray(extractedFacts.profileId, oldProfiles.map((p) => p.id)));
      await db.delete(profiles).where(inArray(profiles.firmId, old.map((f) => f.id)));
      await db.delete(firms).where(inArray(firms.id, old.map((f) => f.id)));
    }

    for (const [i, d] of DEMOS.entries()) {
      const [firm] = await db
        .insert(firms)
        .values({
          crd: 900000 + i, name: d.name, city: d.city, state: d.state, registrationType: "state", clientCount: d.clients,
          feeFlags: { pctAum: false, hourly: false, subscription: false, fixed: true, commissions: false, performance: false, other: false },
          flatFeeCandidate: true,
        })
        .returning();
      const [profile] = await db
        .insert(profiles)
        .values({ firmId: firm.id, displayName: d.name, slug: `demo-${firm.crd}`, tier: "claimed", claimedAt: new Date() })
        .returning();
      await db.insert(extractedFacts).values(
        Object.entries(d.facts).map(([fieldKey, value]) => {
          const check = validateFactValue(fieldKey, value);
          if (!check.success) throw new Error(`${d.name} ${fieldKey}: ${check.error}`);
          return { profileId: profile.id, fieldKey, value, taxonomyVersion: TAXONOMY_VERSION, source: "advisor_form" as const, status: "confirmed" as const, confirmedAt: new Date() };
        }),
      );
    }
    console.log(`Seeded ${DEMOS.length} demo advisors.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
