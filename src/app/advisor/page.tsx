import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { ownedProfiles } from "@/advisor";
import { isAdmin } from "@/auth";
import { requireUser } from "@/web/session";
import { signOutAction } from "./actions";

export const metadata: Metadata = { title: "Your profile · Flat Fee Network" };
export const dynamic = "force-dynamic";

export default async function AdvisorHome({ searchParams }: { searchParams: Promise<{ claimed?: string; pending?: string }> }) {
  const user = await requireUser();
  const { claimed, pending } = await searchParams;
  const owned = await ownedProfiles(getDb(), user.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Your profile</h1>
        <form action={signOutAction}>
          <button className="text-sm underline">Sign out</button>
        </form>
      </div>
      <p className="mt-1 text-sm opacity-70">Signed in as {user.email}</p>

      {claimed && <p className="mt-6 rounded-md bg-green-50 p-4 text-green-900">You&apos;re verified. Add your fees and services below so prospects can be matched with you.</p>}
      {pending && (
        <p className="mt-6 rounded-md bg-amber-100 p-4 text-amber-900">
          Thanks, your email is confirmed. We review requests like yours by hand, usually within a business day, and we&apos;ll email you when your profile is ready.
        </p>
      )}

      {owned.length === 0 ? (
        !pending && (
          <p className="mt-8">
            You don&apos;t manage a profile yet. <Link href="/claim" className="underline">Claim or add your firm</Link>.
          </p>
        )
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {owned.map(({ profile, firm }) => (
            <li key={profile.id} className="rounded-lg border border-black/10 p-5 dark:border-white/15">
              <h2 className="text-xl font-medium">{profile.displayName}</h2>
              <p className="text-sm opacity-70">CRD {firm.crd}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <Link href={`/advisor/${profile.id}`} className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white">
                  Edit profile
                </Link>
                <Link href={`/advisors/${profile.slug}`} className="py-2 underline">
                  View public page
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isAdmin(user) && (
        <p className="mt-8 text-sm">
          <Link href="/admin/claims" className="underline">Review claims</Link>
        </p>
      )}
    </main>
  );
}
