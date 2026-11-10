import type { Metadata } from "next";
import { Questionnaire } from "./questionnaire";

export const metadata: Metadata = { title: "Find your advisor · Flat Fee Network" };

export default function MatchPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Find a flat-fee advisor who fits you</h1>
      <p className="mt-2 opacity-80">About 3 minutes. You&apos;ll see 3 matched advisors and why each one fits.</p>
      <div className="mt-8">
        <Questionnaire />
      </div>
    </main>
  );
}
