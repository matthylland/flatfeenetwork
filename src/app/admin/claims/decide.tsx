"use client";

import { useActionState } from "react";
import { decideClaim, type DecideState } from "./actions";

export function Decide({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<DecideState, FormData>(decideClaim, {});
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="requestId" value={requestId} />
      <button name="decision" value="approve" disabled={pending} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        Approve
      </button>
      <button name="decision" value="reject" disabled={pending} className="rounded-md border border-black/15 px-4 py-2 text-sm disabled:opacity-50 dark:border-white/20">
        Reject
      </button>
      {state.error && <span className="text-sm text-red-600 dark:text-red-400">{state.error}</span>}
    </form>
  );
}
