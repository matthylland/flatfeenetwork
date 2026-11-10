import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeForm } from "./code-form";

export default async function VerifyClaim({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  if (!r || !/^[0-9a-f-]{36}$/i.test(r)) notFound();
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Check your email</h1>
      <p className="mt-2 opacity-80">We sent a 6-digit code to the address you gave. It expires in 15 minutes.</p>
      <div className="mt-8">
        <CodeForm requestId={r} />
      </div>
      <p className="mt-6 text-sm opacity-70">
        No email? Check spam, or <Link href="/claim" className="underline">start again</Link>.
      </p>
    </main>
  );
}
