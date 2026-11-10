"use client";

import { useActionState } from "react";
import type { Option } from "@/taxonomy/vocab";
import { saveProfile, type ProfileFormState } from "../actions";

export type ProfileFormValues = {
  feeMin?: number;
  feeMax?: number;
  feeCovers?: string;
  offeringModels: string[];
  meetingFormats: string[];
  topServices: string[];
  assetMinimum?: number;
  intro?: string;
  bookingUrl?: string;
};

const input = "rounded-md border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20";

function Section({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 border-t border-black/10 pt-5 dark:border-white/15">
      <legend className="font-medium">{title}</legend>
      {hint && <p className="text-sm opacity-70">{hint}</p>}
      {children}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </fieldset>
  );
}

function Checks({ name, options, selected }: { name: string; options: readonly Option[]; selected: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.key} className="cursor-pointer rounded-full border border-black/15 px-3 py-1.5 text-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-600 has-[:checked]:text-white dark:border-white/20">
          <input type="checkbox" name={name} value={o.key} defaultChecked={selected.includes(o.key)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function ProfileForm({ profileId, values, vocab }: { profileId: string; values: ProfileFormValues; vocab: { offering: readonly Option[]; meeting: readonly Option[]; services: readonly Option[] } }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="profileId" value={profileId} />
      <Section title="Annual fee range" hint="What a typical client pays per year. Shown on your match card." error={e.feeMin ?? e.feeMax}>
        <div className="flex items-center gap-2">
          <input name="feeMin" inputMode="numeric" defaultValue={values.feeMin} placeholder="$ lowest" required className={`${input} w-32`} />
          <span>to</span>
          <input name="feeMax" inputMode="numeric" defaultValue={values.feeMax} placeholder="$ highest" required className={`${input} w-32`} />
        </div>
      </Section>
      <Section title="What the fee covers (optional)" error={e.feeCovers}>
        <textarea name="feeCovers" rows={2} maxLength={500} defaultValue={values.feeCovers} className={input} />
      </Section>
      <Section title="What you offer" hint="Pick both if you do both. Firms that do both are matched with prospects wanting either." error={e.offeringModels}>
        <Checks name="offeringModels" options={vocab.offering} selected={values.offeringModels} />
      </Section>
      <Section title="How you meet clients" error={e.meetingFormats}>
        <Checks name="meetingFormats" options={vocab.meeting} selected={values.meetingFormats} />
      </Section>
      <Section title="Your top services" hint="Pick up to 3." error={e.topServices}>
        <Checks name="topServices" options={vocab.services} selected={values.topServices} />
      </Section>
      <Section title="Asset minimum (optional)" hint="Leave blank if you have none." error={e.assetMinimum}>
        <input name="assetMinimum" inputMode="numeric" defaultValue={values.assetMinimum} placeholder="$" className={`${input} w-40`} />
      </Section>
      <Section title="Short intro (optional)" error={e.intro}>
        <textarea name="intro" rows={4} maxLength={1500} defaultValue={values.intro} className={input} />
      </Section>
      <Section title="Booking link (optional)" hint="A scheduling page such as Calendly." error={e.bookingUrl}>
        <input name="bookingUrl" type="url" defaultValue={values.bookingUrl} placeholder="https://" className={input} />
      </Section>
      {e.form && <p className="text-red-600 dark:text-red-400">{e.form}</p>}
      {state.saved && <p className="text-green-700 dark:text-green-400">Saved. Your profile and matches now use these answers.</p>}
      <button type="submit" disabled={pending} className="self-start rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
