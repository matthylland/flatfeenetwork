"use client";

import { useActionState } from "react";
import { submitClaim, type ClaimFormState } from "./actions";

const input = "rounded-md border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      {children}
      {error && <span className="text-red-600 dark:text-red-400">{error}</span>}
    </label>
  );
}

export function ClaimForm({ crd }: { crd?: string }) {
  const [state, action, pending] = useActionState<ClaimFormState, FormData>(submitClaim, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your firm's CRD number" error={e.crd}>
        <input name="crd" inputMode="numeric" defaultValue={crd} required className={`${input} w-40`} />
      </Field>
      <Field label="Your name" error={e.name}>
        <input name="name" required autoComplete="name" className={input} />
      </Field>
      <Field label="Your role at the firm" error={e.role}>
        <input name="role" required placeholder="e.g. Founder, Financial planner" className={input} />
      </Field>
      <Field label="Your work email" error={e.email}>
        <input name="email" type="email" required autoComplete="email" className={input} />
      </Field>
      <p className="-mt-2 text-sm opacity-70">Use an address at your firm&apos;s website domain and we can approve you right away. Otherwise we review it by hand, usually within a business day.</p>
      <Field label="Anything we should know? (optional)" error={e.note}>
        <textarea name="note" rows={3} maxLength={1000} className={input} />
      </Field>
      <button type="submit" disabled={pending} className="self-start rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">
        {pending ? "Sending code…" : "Email me a code"}
      </button>
    </form>
  );
}
