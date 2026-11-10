"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { isAdmin } from "@/auth";
import { approveClaim, rejectClaim } from "@/claims";
import { currentUser } from "@/web/session";

export type DecideState = { error?: string };

export async function decideClaim(_prev: DecideState, form: FormData): Promise<DecideState> {
  if (!isAdmin(await currentUser())) return { error: "Only the site owner can review claims." };
  const id = String(form.get("requestId"));
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: "Bad request" };
  try {
    if (form.get("decision") === "approve") await approveClaim(getDb(), id);
    else await rejectClaim(getDb(), id);
  } catch (err) {
    return { error: (err as Error).message };
  }
  revalidatePath("/admin/claims");
  return {};
}
