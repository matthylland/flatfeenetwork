import type { Metadata } from "next";
import { ClaimForm } from "./claim-form";

export const metadata: Metadata = { title: "Claim or add your profile · Flat Fee Network" };

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ crd?: string }> }) {
  const { crd } = await searchParams;
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Claim or add your free profile</h1>
      <p className="mt-2 opacity-80">
        For flat-fee advisory firms registered with the SEC or a state. If your firm already has a listing, this claims it. If it doesn&apos;t, this asks us to add it. Free profiles are matched with prospects exactly the same way as every other profile.
      </p>
      <p className="mt-2 text-sm opacity-70">
        Your CRD number is on your Form ADV and at{" "}
        <a href="https://adviserinfo.sec.gov" target="_blank" rel="noopener noreferrer" className="underline">
          adviserinfo.sec.gov
        </a>
        .
      </p>
      <div className="mt-8">
        <ClaimForm crd={crd && /^\d{1,9}$/.test(crd) ? crd : undefined} />
      </div>
    </main>
  );
}
