"use client";

import { useActionState } from "react";
import { sendContact, type ContactState } from "../actions";

export function ContactForm({ slug, name, matchId, sessionId }: { slug: string; name: string; matchId?: string; sessionId?: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContact, {});
  const e = state.errors ?? {};

  if (state.sent) {
    return <p className="rounded-md bg-green-50 p-4 text-green-900">Message sent. {name} will reply to you by email.</p>;
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      {matchId && <input type="hidden" name="matchId" value={matchId} />}
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      <label className="flex flex-col gap-1 text-sm">
        Your email
        <input name="email" type="email" required autoComplete="email" className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20" />
        {e.email && <span className="text-red-600 dark:text-red-400">{e.email}</span>}
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Message
        <textarea
          name="message"
          rows={5}
          required
          maxLength={3000}
          placeholder="A little about your situation and what you're looking for."
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
        />
        {e.message && <span className="text-red-600 dark:text-red-400">{e.message}</span>}
      </label>
      {e.form && <p className="text-sm text-red-600 dark:text-red-400">{e.form}</p>}
      <button type="submit" disabled={pending} className="self-start rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white disabled:opacity-50">
        {pending ? "Sending…" : `Message ${name}`}
      </button>
      <p className="text-sm opacity-70">Your email goes only to this advisor.</p>
    </form>
  );
}
