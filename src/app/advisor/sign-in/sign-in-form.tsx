"use client";

import { useActionState } from "react";
import { signInStep, type SignInState } from "../actions";

const input = "rounded-md border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInStep, { step: "email" });
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.step === "email" ? (
        <label className="flex flex-col gap-1 text-sm">
          Your email
          <input name="email" type="email" required autoComplete="email" className={input} />
        </label>
      ) : (
        <>
          <p className="text-sm opacity-80">If {state.email} has an advisor account, we just emailed it a 6-digit code.</p>
          <label className="flex flex-col gap-1 text-sm">
            Code
            <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required className={`${input} w-40 tracking-widest`} />
          </label>
        </>
      )}
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button type="submit" disabled={pending} className="self-start rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">
        {state.step === "email" ? "Email me a code" : "Sign in"}
      </button>
    </form>
  );
}
