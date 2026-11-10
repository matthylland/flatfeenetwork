import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Advisor sign in · Flat Fee Network" };

export default function SignIn() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Advisor sign in</h1>
      <p className="mt-2 opacity-80">
        No password: we email you a code. New here? <Link href="/claim" className="underline">Claim or add your profile</Link>.
      </p>
      <div className="mt-8">
        <SignInForm />
      </div>
    </main>
  );
}
