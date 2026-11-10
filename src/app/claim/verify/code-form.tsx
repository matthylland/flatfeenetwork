"use client";

import { useActionState } from "react";
import { submitClaimCode, type VerifyState } from "../actions";

export function CodeForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<VerifyState, FormData>(submitClaimCode, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <label className="flex flex-col gap-1 text-sm">
        6-digit code
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className="w-40 rounded-md border border-black/15 bg-transparent px-3 py-2 text-lg tracking-widest dark:border-white/20" />
      </label>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending} className="self-start rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">
        {pending ? "Checking…" : "Confirm"}
      </button>
    </form>
  );
}
