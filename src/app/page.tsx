import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">Flat Fee Network</h1>
      <p className="text-lg">
        Answer a few questions and meet three flat-fee financial advisors matched to your situation.
      </p>
      <Link href="/match" className="self-start rounded-md bg-blue-600 px-5 py-2.5 font-medium text-white">
        Find my advisor
      </Link>
    </main>
  );
}
