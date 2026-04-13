import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-black text-zinc-50">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-12 px-4 py-10 sm:px-8 sm:py-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-700">
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
              className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:border-zinc-500 hover:bg-zinc-900/60"
            >
              Host dashboard
            </Link>
          </div>
        </header>

        <section className="grid gap-10 md:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)] md:items-center">
          <div className="space-y-6">
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              A digital disposable camera for every event.
            </h1>
            <p className="max-w-xl text-balance text-base text-zinc-300 sm:text-lg">
              Create a private event in minutes, share a single QR code, and
              let guests capture the night. No app. No logins. Just photos,
              streaming into your live gallery.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-zinc-50 px-6 py-2.5 text-sm font-medium text-black shadow-sm transition hover:bg-zinc-200"
              >
                Open host dashboard
              </Link>
              <div className="flex items-center gap-2 text-xs text-zinc-400 sm:text-sm">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[10px] font-semibold">
                  3
                </span>
                <span>steps from QR code to live event gallery.</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-xs text-zinc-400 sm:text-sm">
              <div>
                <p className="font-medium text-zinc-200">For hosts</p>
                <p>Create events, share QR codes, manage galleries.</p>
              </div>
              <div>
                <p className="font-medium text-zinc-200">For guests</p>
                <p>Scan, shoot, done.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-0 -translate-y-6 rounded-3xl bg-gradient-to-b from-emerald-500/10 via-fuchsia-500/5 to-transparent blur-3xl" />
            <div className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-400">
                    Live event camera
                  </p>
                  <p className="mt-1 text-sm text-zinc-200">
                    Scan the QR at the entrance. Capture the night together.
                  </p>
                </div>
                <div className="flex flex-col items-end text-xs text-zinc-400">
                  <span>Guest limit</span>
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-100">
                    10 photos / guest
                  </span>
                </div>
              </div>

              <div className="mt-5 rounded-2xl bg-zinc-900/90 p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-zinc-400">
                  <span>Camera preview</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live
                  </span>
                </div>
                <div className="aspect-[3/4] rounded-2xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
                  <div className="flex h-full flex-col justify-between p-3">
                    <div className="flex items-center justify-between text-[11px] text-zinc-300">
                      <span>Wedding • Tonight</span>
                      <span>3 photos left</span>
                    </div>
                    <div className="flex flex-col items-center gap-3 pb-1">
                      <div className="flex gap-2 text-[11px] text-zinc-400">
                        <span>Tap to capture</span>
                        <span>•</span>
                        <span>No preview for guests</span>
                      </div>
                      <div className="h-12 w-12 rounded-full border border-zinc-200 bg-zinc-50" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-zinc-400">
                <p>Designed for iOS Safari, Android Chrome, and desktop browsers.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
