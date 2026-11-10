/**
 * The claimed (free) tier's short form. Advisors type these values
 * themselves, so each one is saved as a confirmed fact from `advisor_form`.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { extractedFacts, firms, profiles } from "@/db/schema";
import { validateFactValue } from "@/taxonomy/fields";
import { TAXONOMY_VERSION, vocabKeys } from "@/taxonomy/vocab";

const dollars = (label: string) =>
  z.preprocess((v) => (typeof v === "string" ? v.replace(/[$,\s]/g, "") : v), z.coerce.number({ message: `Please enter ${label}.` }).int(`Please enter ${label} in whole dollars.`).min(0).max(10_000_000));
const optionalDollars = (label: string) => z.preprocess((v) => (v === "" || v === null ? undefined : v), dollars(label).optional());
const pick = (vocab: Parameters<typeof vocabKeys>[0], min: number, max: number, message: string) =>
  z.array(z.enum(vocabKeys(vocab) as [string, ...string[]])).min(min, message).max(max, `Pick up to ${max}.`);

export const coreFormSchema = z
  .object({
    feeMin: dollars("your lowest annual fee"),
    feeMax: dollars("your highest annual fee"),
    feeCovers: z.string().trim().max(500).optional(),
    offeringModels: pick("offering_models", 1, 2, "Pick at least one."),
    meetingFormats: pick("meeting_formats", 1, 2, "Pick at least one."),
    topServices: pick("services", 1, 3, "Pick at least one."),
    assetMinimum: optionalDollars("an asset minimum"),
    intro: z.string().trim().max(1500).optional(),
    bookingUrl: z
      .string()
      .trim()
      .max(500)
      .optional()
      .refine((u) => !u || /^https:\/\/[^\s]+$/i.test(u), "Please enter a link starting with https://"),
  })
  .refine((v) => v.feeMax >= v.feeMin, { message: "The highest fee can't be below the lowest.", path: ["feeMax"] });
export type CoreForm = z.infer<typeof coreFormSchema>;

/** The form's fields mapped to registry facts. */
const FORM_FACTS = ["annual_fee_range", "fee_covers", "offering_models", "meeting_formats", "top_services", "asset_minimum"] as const;

export async function ownedProfiles(db: Db, userId: string) {
  return db
    .select({ profile: profiles, firm: firms })
    .from(profiles)
    .innerJoin(firms, eq(firms.id, profiles.firmId))
    .where(eq(profiles.ownerUserId, userId))
    .orderBy(profiles.displayName);
}

export async function profileFacts(db: Db, profileId: string) {
  const rows = await db
    .select({ fieldKey: extractedFacts.fieldKey, value: extractedFacts.value })
    .from(extractedFacts)
    .where(and(eq(extractedFacts.profileId, profileId), eq(extractedFacts.status, "confirmed")));
  return Object.fromEntries(rows.map((r) => [r.fieldKey, r.value])) as Record<string, unknown>;
}

/** Replace the advisor's answers to the short form. Only the profile's owner can save. */
export async function saveCoreForm(db: Db, userId: string, profileId: string, form: CoreForm) {
  const values: Record<(typeof FORM_FACTS)[number], unknown> = {
    annual_fee_range: { min: form.feeMin, max: form.feeMax },
    fee_covers: form.feeCovers || undefined,
    offering_models: form.offeringModels,
    meeting_formats: form.meetingFormats,
    top_services: form.topServices,
    asset_minimum: form.assetMinimum,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const check = validateFactValue(key, value);
    if (!check.success) throw new Error(`${key}: ${check.error}`);
  }

  await db.transaction(async (tx) => {
    const [owned] = await tx.select({ id: profiles.id }).from(profiles).where(and(eq(profiles.id, profileId), eq(profiles.ownerUserId, userId)));
    if (!owned) throw new Error("Not your profile");
    await tx.update(profiles).set({ intro: form.intro || null, bookingUrl: form.bookingUrl || null, updatedAt: new Date() }).where(eq(profiles.id, profileId));
    await tx.delete(extractedFacts).where(and(eq(extractedFacts.profileId, profileId), inArray(extractedFacts.fieldKey, [...FORM_FACTS])));
    const now = new Date();
    const rows = Object.entries(values)
      .filter(([, v]) => v !== undefined)
      .map(([fieldKey, value]) => ({
        profileId,
        fieldKey,
        value,
        taxonomyVersion: TAXONOMY_VERSION,
        source: "advisor_form" as const,
        status: "confirmed" as const,
        confirmedByUserId: userId,
        confirmedAt: now,
      }));
    if (rows.length) await tx.insert(extractedFacts).values(rows);
  });
}
