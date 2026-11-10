import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { currentMatches } from "@/prospect/session";
import { PASS_REASONS } from "@/taxonomy/vocab";
import { reactToMatch, showNextMatches } from "../actions";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export default async function MatchResults({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();
  const result = await currentMatches(getDb(), sessionId);
  if (!result) notFound();

  const reactionFor = (matchId: string) => result.feedback.find((f) => f.matchId === matchId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">{result.round === 1 ? "Your 3 matches" : "Your next matches"}</h1>
      <p className="mt-2 opacity-80">Tell us what you think of each one. Your reactions shape the next set and are never shown publicly.</p>

      {result.cards.length === 0 && <p className="mt-8">No advisors fit every answer yet. Try widening your budget or meeting preference.</p>}

      <ol className="mt-8 flex flex-col gap-6">
        {result.cards.map(({ match, profile, firm, fee }) => {
          const reaction = reactionFor(match.id);
          const reasons = (match.explanation as { reasons?: string[] } | null)?.reasons ?? [];
          return (
            <li key={match.id} className="rounded-lg border border-black/10 p-5 dark:border-white/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-medium">
                    <Link href={`/advisors/${profile.slug}?m=${match.id}&s=${sessionId}`} className="hover:underline">
                      {profile.displayName}
                    </Link>
                  </h2>
                  <p className="text-sm opacity-70">{[firm.city, firm.state].filter(Boolean).join(", ")}</p>
                </div>
                <p className="text-right font-medium">
                  {fee ? `${money(fee.min)}–${money(fee.max)}/yr` : <span className="text-sm opacity-70">Fee not yet verified</span>}
                </p>
              </div>
              {match.isUnclaimedFallback && (
                <p className="mt-3 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                  Unverified: built from public SEC filings, not yet confirmed by the advisor
                </p>
              )}
              {reasons.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-sm">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
              <div className="mt-4">
                {reaction ? (
                  <p className="text-sm opacity-70">
                    {reaction.kind === "interested" ? "Saved to your shortlist." : "Got it. We'll adjust your next matches."}
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <form action={reactToMatch}>
                      <input type="hidden" name="sessionId" value={sessionId} />
                      <input type="hidden" name="matchId" value={match.id} />
                      <input type="hidden" name="kind" value="interested" />
                      <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">Interested</button>
                    </form>
                    <form action={reactToMatch} className="flex items-center gap-2">
                      <input type="hidden" name="sessionId" value={sessionId} />
                      <input type="hidden" name="matchId" value={match.id} />
                      <input type="hidden" name="kind" value="not_for_me" />
                      <select name="reason" defaultValue="" required className="rounded-md border border-black/15 bg-transparent px-2 py-2 text-sm dark:border-white/20">
                        <option value="" disabled>
                          Not for me because…
                        </option>
                        {PASS_REASONS.map((r) => (
                          <option key={r.key} value={r.key}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20">Pass</button>
                    </form>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <form action={showNextMatches} className="mt-8">
        <input type="hidden" name="sessionId" value={sessionId} />
        <button className="rounded-md border border-black/15 px-4 py-2 dark:border-white/20">Show me 3 more</button>
      </form>
    </main>
  );
}
