import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { searchProfiles } from "@/directory/profiles";

export const metadata: Metadata = { title: "Browse advisors · Flat Fee Network" };
export const dynamic = "force-dynamic";

export default async function BrowseAdvisors({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = "", page = "1" } = await searchParams;
  const result = await searchProfiles(getDb(), q, Number(page));
  const pageHref = (n: number) => `/advisors?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Browse flat-fee advisors</h1>
      <p className="mt-2 opacity-80">
        Search by firm name, city or CRD number. Or <Link href="/match" className="underline">answer a few questions</Link> to get 3 matched advisors.
      </p>

      <form className="mt-6 flex gap-2" action="/advisors">
        <input
          name="q"
          defaultValue={q}
          placeholder="Firm name, city or CRD"
          aria-label="Search advisors"
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
        <button className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white">Search</button>
      </form>

      <p className="mt-6 text-sm opacity-70">
        {result.total.toLocaleString("en-US")} {result.total === 1 ? "advisor" : "advisors"}
        {q && <> matching &ldquo;{q}&rdquo;</>}
      </p>

      <ul className="mt-3 divide-y divide-black/10 dark:divide-white/15">
        {result.rows.map((r) => (
          <li key={r.slug} className="py-3">
            <Link href={`/advisors/${r.slug}`} className="font-medium hover:underline">
              {r.displayName}
            </Link>
            <p className="text-sm opacity-70">
              {[[r.city, r.state].filter(Boolean).join(", "), r.tier === "unclaimed" ? "Not yet verified by the advisor" : "Verified by the advisor"]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </li>
        ))}
      </ul>

      {result.pages > 1 && (
        <nav className="mt-6 flex items-center gap-4 text-sm">
          {result.page > 1 && <Link href={pageHref(result.page - 1)}>← Previous</Link>}
          <span className="opacity-70">
            Page {result.page} of {result.pages.toLocaleString("en-US")}
          </span>
          {result.page < result.pages && <Link href={pageHref(result.page + 1)}>Next →</Link>}
        </nav>
      )}
    </main>
  );
}
