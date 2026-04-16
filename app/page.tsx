import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-12 px-4 py-10 sm:px-8 sm:py-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800">
              <span className="text-xs font-semibold tracking-[0.18em]">
                DDC
              </span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
                Digital Disposable
              </p>
              <p className="text-sm font-medium text-zinc-100">
                Event Camera Platform
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900"
            >
              Host dashboard
            </Link>
          </div>
        </header>

        <section className="space-y-6">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            A digital disposable camera for every event.
          </h1>
          <p className="max-w-xl text-balance text-base text-zinc-400 sm:text-lg">
            Create a private event in minutes, share a single QR code, and
            let guests capture the night. No app. No logins. Just photos,
            streaming into your live gallery.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-zinc-50 px-6 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Open host dashboard
            </Link>
            <span className="text-sm text-zinc-500">
              3 steps from QR code to live gallery.
            </span>
          </div>
          <div className="flex gap-8 border-t border-zinc-800 pt-6 text-sm text-zinc-400">
            <div>
              <p className="font-medium text-zinc-200">For hosts</p>
              <p>Create events, share QR codes, manage galleries.</p>
            </div>
            <div>
              <p className="font-medium text-zinc-200">For guests</p>
              <p>Scan, shoot, done.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
