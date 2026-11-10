"use client";

import { useActionState, useState } from "react";
import {
  ASSET_RANGES,
  CADENCE,
  FEE_BUDGETS,
  INCOME_RANGES,
  INVOLVEMENT,
  LIFE_EVENTS,
  PROSPECT_MEETING_WANTS,
  PROSPECT_OFFERING_WANTS,
  SERVICES,
  VALUES_PREFS,
} from "@/taxonomy/vocab";
import { submitQuestionnaire, type QuestionnaireState } from "./actions";

type Opt = { key: string; label: string };

function Question({ n, title, hint, error, children }: { n: string; title: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 border-t border-black/10 pt-6 dark:border-white/15">
      <legend className="text-lg font-medium">
        <span className="mr-2 opacity-50">{n}</span>
        {title}
      </legend>
      {hint && <p className="-mt-1 text-sm opacity-70">{hint}</p>}
      {children}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </fieldset>
  );
}

function Choices({ name, options, multi, onChange }: { name: string; options: readonly Opt[]; multi?: boolean; onChange?: (checked: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.key}
          className="cursor-pointer rounded-full border border-black/15 px-3 py-1.5 text-sm has-[:checked]:border-blue-600 has-[:checked]:bg-blue-600 has-[:checked]:text-white dark:border-white/20"
        >
          <input
            type={multi ? "checkbox" : "radio"}
            name={name}
            value={o.key}
            className="sr-only"
            onChange={(e) => {
              if (!onChange) return;
              const form = e.currentTarget.form!;
              onChange(new FormData(form).getAll(name).map(String));
            }}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function Questionnaire() {
  const [state, action, pending] = useActionState<QuestionnaireState, FormData>(submitQuestionnaire, {});
  const [services, setServices] = useState<string[]>([]);
  const [meeting, setMeeting] = useState<string>("");
  const e = state.errors ?? {};

  return (
    <form action={action} className="flex flex-col gap-8">
      <Question n="1" title="What's prompting you to look for an advisor now?" hint="Pick up to 2." error={e.p_life_event}>
        <Choices name="p_life_event" options={LIFE_EVENTS} multi />
      </Question>

      <Question n="2" title="Where do you live?" error={e.p_zip}>
        <input name="p_zip" inputMode="numeric" maxLength={5} placeholder="ZIP code" className="w-32 rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20" />
      </Question>

      <Question n="3" title="How do you want to meet?" error={e.p_meeting}>
        <Choices name="p_meeting" options={PROSPECT_MEETING_WANTS} onChange={(v) => setMeeting(v[0] ?? "")} />
        {meeting === "in_person_preferred" && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="p_meeting_required" /> In person is a must for me
          </label>
        )}
      </Question>

      <Question n="4" title="What do you want help with?" hint="Pick all that apply." error={e.p_services}>
        <Choices name="p_services" options={SERVICES} multi onChange={setServices} />
      </Question>

      {services.includes("investment_management") && (
        <Question n="4a" title="Do you want them to manage your accounts, or only advise?" error={e.p_offering}>
          <Choices name="p_offering" options={PROSPECT_OFFERING_WANTS} />
        </Question>
      )}

      <Question n="5" title="Roughly how much do you have invested?" error={e.p_assets}>
        <Choices name="p_assets" options={ASSET_RANGES} />
      </Question>

      <Question n="6" title="What's your household income?" hint="Optional." error={e.p_income}>
        <Choices name="p_income" options={INCOME_RANGES} />
      </Question>

      <Question n="7" title="What annual fee feels reasonable for the help you want?" error={e.p_budget}>
        <Choices name="p_budget" options={FEE_BUDGETS} />
      </Question>

      <Question n="8" title="How involved do you want to be?" error={e.p_involvement}>
        <Choices name="p_involvement" options={INVOLVEMENT} />
      </Question>

      <Question n="9" title="How often do you want to hear from them?" error={e.p_cadence}>
        <Choices name="p_cadence" options={CADENCE} />
      </Question>

      <Question n="10" title="Anything that matters to you in an advisor?" hint="Optional. Use the second row for anything that's a must-have.">
        <Choices name="p_values" options={VALUES_PREFS} multi />
        <p className="text-sm opacity-70">Must-haves</p>
        <Choices name="p_values_must" options={VALUES_PREFS} multi />
      </Question>

      <Question n="11" title="In your own words, what's your situation and what would a great advisor do for you?" hint="Optional, but it helps us match you well." error={e.p_own_words}>
        <textarea name="p_own_words" rows={4} maxLength={3000} className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20" />
      </Question>

      {Object.keys(e).length > 0 && <p className="text-red-600 dark:text-red-400">A few answers are missing. They&apos;re marked above.</p>}

      <button type="submit" disabled={pending} className="self-start rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">
        {pending ? "Finding your matches…" : "See my 3 matches"}
      </button>
      <p className="text-sm opacity-70">No email needed to see your matches.</p>
    </form>
  );
}
