import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, endSession, SESSION_COOKIE, userForSession } from "@/auth";
import { getDb } from "@/db";

export async function currentUser() {
  return userForSession(getDb(), (await cookies()).get(SESSION_COOKIE)?.value);
}

export async function signIn(userId: string) {
  const { token, expiresAt } = await createSession(getDb(), userId);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

export async function signOut() {
  const jar = await cookies();
  await endSession(getDb(), jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
}

/** The signed-in advisor, or a redirect to sign in. */
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/advisor/sign-in");
  return user;
}
