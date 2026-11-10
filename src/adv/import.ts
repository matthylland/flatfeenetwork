import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { createGunzip } from "node:zlib";
import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { advImportRuns, firms, profiles } from "@/db/schema";
import { parseAdvFeed, type AdvFirm } from "./parse";

const BATCH_SIZE = 500;

export function slugFor(firm: Pick<AdvFirm, "name" | "crd">): string {
  const base = firm.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "firm"}-${firm.crd}`;
}

/** Open a feed from a local path or URL, gunzipping when it ends in .gz. */
export async function openFeed(source: string): Promise<Readable> {
  let stream: Readable;
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source, { headers: { "User-Agent": "FlatFeeNetwork data import" } });
    if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
    stream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
  } else {
    stream = createReadStream(source);
  }
  return source.endsWith(".gz") ? stream.pipe(createGunzip()) : stream;
}

/**
 * Upsert every firm in a feed, and create an unclaimed listing for each
 * flat-fee candidate that doesn't have one yet. Existing listings (and
 * anything an advisor has claimed or edited) are never overwritten here.
 */
export async function importAdvFeed(db: Db, source: string) {
  const [run] = await db.insert(advImportRuns).values({ source }).returning();
  const errors: string[] = [];
  let upserted = 0;
  let listingsCreated = 0;
  let batch: AdvFirm[] = [];

  const flush = async () => {
    if (!batch.length) return;
    // A CRD can't be upserted twice in one statement; keep the last occurrence.
    const rows = [...new Map(batch.map((f) => [f.crd, f])).values()];
    batch = [];
    const saved = await db
      .insert(firms)
      .values(rows.map((f) => ({ ...f, lastImportRunId: run.id })))
      .onConflictDoUpdate({
        target: firms.crd,
        set: {
          secNumber: sql`excluded.sec_number`,
          name: sql`excluded.name`,
          legalName: sql`excluded.legal_name`,
          website: sql`excluded.website`,
          phone: sql`excluded.phone`,
          street1: sql`excluded.street1`,
          street2: sql`excluded.street2`,
          city: sql`excluded.city`,
          state: sql`excluded.state`,
          postalCode: sql`excluded.postal_code`,
          country: sql`excluded.country`,
          registrationType: sql`excluded.registration_type`,
          registeredStates: sql`excluded.registered_states`,
          noticeFiledStates: sql`excluded.notice_filed_states`,
          feeFlags: sql`excluded.fee_flags`,
          flatFeeCandidate: sql`excluded.flat_fee_candidate`,
          assetsUnderManagement: sql`excluded.assets_under_management`,
          clientCount: sql`excluded.client_count`,
          employeeCount: sql`excluded.employee_count`,
          hasDisclosures: sql`excluded.has_disclosures`,
          advFilingDate: sql`excluded.adv_filing_date`,
          lastImportRunId: sql`excluded.last_import_run_id`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: firms.id, crd: firms.crd, name: firms.name, flatFeeCandidate: firms.flatFeeCandidate });
    upserted += saved.length;

    const candidates = saved.filter((f) => f.flatFeeCandidate);
    const existing = candidates.length
      ? await db.select({ firmId: profiles.firmId }).from(profiles).where(inArray(profiles.firmId, candidates.map((f) => f.id)))
      : [];
    const hasListing = new Set(existing.map((r) => r.firmId));
    const listings = candidates
      .filter((f) => !hasListing.has(f.id))
      .map((f) => ({ firmId: f.id, displayName: f.name, slug: slugFor(f), tier: "unclaimed" as const }));
    if (listings.length) {
      const created = await db.insert(profiles).values(listings).onConflictDoNothing({ target: profiles.slug }).returning({ id: profiles.id });
      listingsCreated += created.length;
    }
  };

  const input = await openFeed(source);
  const { seen } = await parseAdvFeed(
    input,
    async (firm) => {
      batch.push(firm);
      if (batch.length >= BATCH_SIZE) await flush();
    },
    (msg) => errors.push(msg),
  );
  await flush();

  await db
    .update(advImportRuns)
    .set({ finishedAt: new Date(), firmsSeen: seen, firmsUpserted: upserted, listingsCreated, errors: errors.slice(0, 200) })
    .where(eq(advImportRuns.id, run.id));

  return { runId: run.id, seen, upserted, listingsCreated, errors };
}
