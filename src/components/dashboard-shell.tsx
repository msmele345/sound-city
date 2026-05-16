const dashboardStats = [
  { label: "Verified events", value: "24" },
  { label: "Neighborhoods", value: "9" },
  { label: "Underground picks", value: "7" },
];

const recommendedEvents = [
  {
    title: "Basement Pressure",
    meta: "Fri 11:00 PM / West Loop",
    reason: "Small-room techno with a late start and high discovery score.",
  },
  {
    title: "South Side Deep Cuts",
    meta: "Sat 9:30 PM / Bridgeport",
    reason: "House lineup with unfamiliar artists and verified source links.",
  },
];

const latestEvents = [
  "Smartbar resident night / Wrigleyville",
  "Warehouse fundraiser / Pilsen",
  "After-hours selector series / Logan Square",
];

const venueSignals = [
  { label: "Sound", value: "Warm stacks" },
  { label: "Crowd", value: "Heads-down" },
  { label: "Room", value: "Compact" },
  { label: "Door", value: "Low-key" },
];

export function DashboardShell() {
  return (
    <div className="min-h-screen px-4 py-4 text-stone-50 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">
              Chicago house and techno
            </p>
            <h1 className="text-4xl font-black tracking-normal text-white sm:text-5xl">
              Sound City
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-stone-300">
              A working discovery dashboard for underground events, venue context,
              artist links, and locally tuned recommendations.
            </p>
          </div>
          <nav aria-label="Primary navigation" className="flex flex-wrap gap-2">
            {["Dashboard", "Events", "Artists", "Venues", "Admin"].map((item) => (
              <a
                className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-stone-100 transition hover:border-teal-300/60 hover:bg-teal-300/10 focus:outline-none focus:ring-2 focus:ring-teal-300"
                href={`#${item.toLowerCase()}`}
                key={item}
              >
                {item}
              </a>
            ))}
          </nav>
        </header>

        <main className="grid gap-4 lg:grid-cols-[1.35fr_0.8fr]">
          <section
            aria-labelledby="recommended-heading"
            className="rounded-lg border border-orange-300/20 bg-zinc-950/70 p-4 shadow-2xl shadow-black/30 sm:p-5"
          >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                  Discovery queue
                </p>
                <h2
                  className="mt-1 text-2xl font-black tracking-normal text-white"
                  id="recommended-heading"
                >
                  Recommended Tonight
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {dashboardStats.map((stat) => (
                  <div
                    className="min-w-0 rounded-md border border-white/10 bg-white/[0.04] px-2 py-2"
                    key={stat.label}
                  >
                    <p className="text-lg font-black text-white">{stat.value}</p>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-normal text-stone-400">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {recommendedEvents.map((event) => (
                <article
                  className="rounded-md border border-white/10 bg-stone-950/80 p-4"
                  key={event.title}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-300">
                    High match
                  </p>
                  <h3 className="mt-2 text-xl font-black tracking-normal text-white">
                    {event.title}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-teal-200">
                    {event.meta}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-stone-300">
                    {event.reason}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <aside
            aria-labelledby="showcase-heading"
            className="rounded-lg border border-teal-300/20 bg-slate-950/70 p-4 sm:p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
              Weekly feature
            </p>
            <h2
              className="mt-1 text-2xl font-black tracking-normal text-white"
              id="showcase-heading"
            >
              Artist Showcase
            </h2>
            <div className="mt-5 aspect-[4/3] rounded-md border border-white/10 bg-[linear-gradient(135deg,#f97316_0%,#facc15_38%,#14b8a6_39%,#0f172a_70%,#a21caf_100%)] p-4">
              <div className="flex h-full flex-col justify-end">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-950">
                  Listening links
                </p>
                <p className="mt-1 max-w-64 text-3xl font-black leading-none tracking-normal text-zinc-950">
                  DJ Heather archive week
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-stone-300">
              Placeholder showcase module for one highlighted Chicago-connected
              artist, curated listening links, and upcoming appearances.
            </p>
          </aside>

          <section
            aria-labelledby="latest-heading"
            className="rounded-lg border border-white/10 bg-zinc-950/70 p-4 sm:p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lime-300">
              Source verified
            </p>
            <h2
              className="mt-1 text-2xl font-black tracking-normal text-white"
              id="latest-heading"
            >
              Latest Events
            </h2>
            <ul className="mt-4 grid gap-2">
              {latestEvents.map((event) => (
                <li
                  className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-stone-200"
                  key={event}
                >
                  {event}
                </li>
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="venue-heading"
            className="rounded-lg border border-white/10 bg-zinc-950/70 p-4 sm:p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
              Room context
            </p>
            <h2
              className="mt-1 text-2xl font-black tracking-normal text-white"
              id="venue-heading"
            >
              Venue Signals
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-2">
              {venueSignals.map((signal) => (
                <div
                  className="rounded-md border border-white/10 bg-white/[0.04] p-3"
                  key={signal.label}
                >
                  <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                    {signal.label}
                  </dt>
                  <dd className="mt-1 text-sm font-black text-white">
                    {signal.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </main>
      </div>
    </div>
  );
}
