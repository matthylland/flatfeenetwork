import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { isNotFirmWebsite } from "@/adv/web";
import { displayFacts, money } from "@/directory/format";
import { advFeeTypes, canReceiveMessages, getProfile, recordProfileView } from "@/directory/profiles";
import { ContactForm } from "./contact-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ m?: string; s?: string }> };

const UUID = /^[0-9a-f-]{36}$/i;
const SLUG = /^[a-z0-9-]{1,120}$/;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return {};
  const found = await getProfile(getDb(), slug);
  return found ? { title: `${found.profile.displayName} · Flat Fee Network` } : {};
}

const safeUrl = (u: string | null) => {
  if (!u || isNotFirmWebsite(u)) return null;
  const withScheme = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

export default async function AdvisorProfile({ params, searchParams }: Params) {
  const { slug } = await params;
  const { m, s } = await searchParams;
  if (!SLUG.test(slug)) notFound();
  const db = getDb();
  const found = await getProfile(db, slug);
  if (!found) notFound();
  const { profile, firm, facts } = found;
  const from = m && s && UUID.test(m) && UUID.test(s) ? { matchId: m, sessionId: s } : undefined;
  await recordProfileView(db, profile.id, from);

  const unclaimed = profile.tier === "unclaimed";
  const website = safeUrl(firm.website);
  const shownFacts = displayFacts(facts);
  const feeTypes = advFeeTypes(firm.feeFlags);
  const states = [...new Set([...firm.registeredStates, ...firm.noticeFiledStates])].sort();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm">
        <Link href="/advisors" className="opacity-70 hover:underline">
          ← All advisors
        </Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold">{profile.displayName}</h1>
      <p className="mt-1 opacity-70">{[firm.city, firm.state].filter(Boolean).join(", ")}</p>

      {unclaimed && (
        <div className="mt-4 rounded-md bg-amber-100 p-4 text-sm text-amber-900">
          <p>
            <strong>Unverified.</strong> Built from this firm&apos;s public SEC filings. The advisor hasn&apos;t confirmed it yet.
          </p>
          <p className="mt-2">
            Is this your firm?{" "}
            <Link href={`/claim?crd=${firm.crd}`} className="font-medium underline">
              Claim this profile for free
            </Link>
            .
          </p>
        </div>
      )}

      {profile.intro && <p className="mt-6 whitespace-pre-line">{profile.intro}</p>}

      {shownFacts.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium">About their practice</h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
            {shownFacts.map((f) => (
              <div key={f.label} className="contents">
                <dt className="text-sm opacity-70">{f.label}</dt>
                <dd>{f.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium">From the firm&apos;s Form ADV</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[12rem_1fr]">
          {feeTypes.length > 0 && (
            <>
              <dt className="text-sm opacity-70">Fee types filed</dt>
              <dd>{feeTypes.join(", ")}</dd>
            </>
          )}
          {firm.assetsUnderManagement !== null && firm.assetsUnderManagement > 0 && (
            <>
              <dt className="text-sm opacity-70">Assets under management</dt>
              <dd>{money(firm.assetsUnderManagement)}</dd>
            </>
          )}
          {firm.employeeCount !== null && (
            <>
              <dt className="text-sm opacity-70">Employees</dt>
              <dd>{firm.employeeCount.toLocaleString("en-US")}</dd>
            </>
          )}
          <dt className="text-sm opacity-70">Registration</dt>
          <dd>
            {firm.registrationType === "sec" ? "SEC-registered" : firm.registrationType === "state" ? "State-registered" : "Unknown"}
            {states.length > 0 && <span className="opacity-70"> · {states.join(", ")}</span>}
          </dd>
          {firm.hasDisclosures !== null && (
            <>
              <dt className="text-sm opacity-70">Disclosures</dt>
              <dd>{firm.hasDisclosures ? "Yes, see the SEC record" : "None reported"}</dd>
            </>
          )}
          <dt className="text-sm opacity-70">CRD number</dt>
          <dd>
            <a href={`https://adviserinfo.sec.gov/firm/summary/${firm.crd}`} target="_blank" rel="noopener noreferrer" className="underline">
              {firm.crd}
            </a>
          </dd>
        </dl>
        {states.length > 0 && (
          <p className="mt-3 text-sm opacity-70">Advisors can work with clients in any state, so these states don&apos;t limit who they serve.</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Get in touch</h2>
        <div className="mt-3">
          {canReceiveMessages(profile.tier) ? (
            <ContactForm slug={profile.slug} name={profile.displayName} matchId={from?.matchId} sessionId={from?.sessionId} />
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-sm opacity-70">This advisor can&apos;t receive messages here until they claim their profile.</p>
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer nofollow" className="underline">
                  Visit their website
                </a>
              )}
              {firm.phone && <p>Phone: {firm.phone}</p>}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
