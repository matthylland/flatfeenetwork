import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { ownedProfiles, profileFacts } from "@/advisor";
import { MEETING_FORMATS, OFFERING_MODELS, SERVICES } from "@/taxonomy/vocab";
import { requireUser } from "@/web/session";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function EditProfile({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const user = await requireUser();
  const db = getDb();
  const owned = (await ownedProfiles(db, user.id)).find((o) => o.profile.id === profileId);
  if (!owned) notFound();
  const facts = await profileFacts(db, profileId);
  const fee = facts.annual_fee_range as { min: number; max: number } | undefined;
  const list = (k: string) => (Array.isArray(facts[k]) ? (facts[k] as string[]) : []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-sm">
        <Link href="/advisor" className="opacity-70 hover:underline">← Your profile</Link>
      </p>
      <h1 className="mt-4 text-3xl font-semibold">{owned.profile.displayName}</h1>
      <p className="mt-2 opacity-80">These answers are shown on your profile and used for matching. Everything else comes from your Form ADV.</p>
      <div className="mt-8">
        <ProfileForm
          profileId={profileId}
          vocab={{ offering: OFFERING_MODELS, meeting: MEETING_FORMATS, services: SERVICES }}
          values={{
            feeMin: fee?.min,
            feeMax: fee?.max,
            feeCovers: (facts.fee_covers as string) ?? undefined,
            offeringModels: list("offering_models"),
            meetingFormats: list("meeting_formats"),
            topServices: list("top_services"),
            assetMinimum: (facts.asset_minimum as number) ?? undefined,
            intro: owned.profile.intro ?? undefined,
            bookingUrl: owned.profile.bookingUrl ?? undefined,
          }}
        />
      </div>
    </main>
  );
}
