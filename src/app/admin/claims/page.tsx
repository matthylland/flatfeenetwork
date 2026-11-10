import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { isAdmin } from "@/auth";
import { pendingClaims } from "@/claims";
import { requireUser } from "@/web/session";
import { Decide } from "./decide";

export const metadata: Metadata = { title: "Review claims · Flat Fee Network" };
export const dynamic = "force-dynamic";

export default async function ReviewClaims() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  const claims = await pendingClaims(getDb());

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Claims to review</h1>
      {claims.length === 0 && <p className="mt-6 opacity-70">Nothing waiting.</p>}
      <ul className="mt-6 flex flex-col gap-4">
        {claims.map(({ request, firmName, firmWebsite, listed, ownerEmail }) => (
          <li key={request.id} className="rounded-lg border border-black/10 p-5 dark:border-white/15">
            <p className="font-medium">
              {request.name}, {request.role}
            </p>
            <p className="text-sm">{request.email}</p>
            <p className="mt-2 text-sm">
              CRD{" "}
              <a href={`https://adviserinfo.sec.gov/firm/summary/${request.crd}`} target="_blank" rel="noopener noreferrer" className="underline">
                {request.crd}
              </a>
              {firmName ? ` · ${firmName}` : " · not in our SEC data yet"}
              {firmWebsite && ` · ${firmWebsite}`}
            </p>
            <p className="text-sm opacity-70">
              {!firmName ? "Can be approved after the next import." : listed ? (ownerEmail ? `Listing already managed by ${ownerEmail}.` : "Has an unclaimed listing.") : "No listing yet; approving creates one."}
              {" "}Email domain {request.domainMatch ? "matches" : "doesn't match"} the firm&apos;s website.
            </p>
            {request.note && <p className="mt-2 text-sm italic">&ldquo;{request.note}&rdquo;</p>}
            <Decide requestId={request.id} />
          </li>
        ))}
      </ul>
    </main>
  );
}
