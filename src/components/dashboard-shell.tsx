const manifest = [
  { value: "24", label: "Verified" },
  { value: "09", label: "Neighborhoods" },
  { value: "07", label: "Underground" },
];

const recommendedEvents = [
  {
    title: "Basement Pressure",
    day: "FRI",
    time: "23:00",
    area: "West Loop",
    match: 0.91,
    reason: "Small-room techno, late start, high discovery score.",
  },
  {
    title: "South Side Deep Cuts",
    day: "SAT",
    time: "21:30",
    area: "Bridgeport",
    match: 0.78,
    reason: "House lineup, unfamiliar artists, verified source links.",
  },
];

const latestEvents = [
  { title: "Smartbar resident night", area: "Wrigleyville" },
  { title: "Warehouse fundraiser", area: "Pilsen" },
  { title: "After-hours selector series", area: "Logan Square" },
];

const venueSignals = [
  { label: "Sound", value: "Warm stacks" },
  { label: "Crowd", value: "Heads-down" },
  { label: "Room", value: "Compact" },
  { label: "Door", value: "Low-key" },
];

const nav = ["Dashboard", "Events", "Artists", "Venues", "Admin"];

function MatchMeter({ score }: { score: number }) {
  const filled = Math.round(score * 10);
  const pct = Math.round(score * 100);
  return (
    <span className="inline-flex items-center gap-2 font-mono text-sm">
      <span aria-hidden className="tracking-[0.05em]">
        <span className="text-signal">{"█".repeat(filled)}</span>
        <span className="text-rule-strong">{"░".repeat(10 - filled)}</span>
      </span>
      <span className="font-semibold text-signal tabular-nums">
        {score.toFixed(2)}
      </span>
      <span className="sr-only">Match {pct} percent</span>
    </span>
  );
}

// Spec-sheet section marker: heading + a mono index tag sharing one strong rule.
// The tag is metadata (queue / index), not a restatement of the heading.
function SectionMark({
  id,
  title,
  index,
}: {
  id: string;
  title: string;
  index: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-rule-strong pb-2">
      <h2
        id={id}
        className="font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink sm:text-3xl"
      >
        {title}
      </h2>
      <span className="shrink-0 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        {index}
      </span>
    </div>
  );
}

export function DashboardShell() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-[78rem] px-5 py-8 sm:px-8 lg:px-12">
      <header className="rise border-b-2 border-rule-strong pb-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.34em] text-signal">
              Chicago / House + Techno
            </p>
            <h1 className="mt-3 font-display text-[clamp(3.5rem,13vw,8.5rem)] uppercase leading-[0.82] tracking-[0.005em] text-ink">
              Sound City
            </h1>
          </div>
          <div className="shrink-0 lg:text-right">
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-ink-faint">
              CHI&middot;HT / VOL.01
            </p>
            <dl className="mt-3 flex gap-6 lg:justify-end">
              {manifest.map((item) => (
                <div key={item.label}>
                  <dd className="font-mono text-2xl font-semibold tabular-nums text-ink">
                    {item.value}
                  </dd>
                  <dt className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-faint">
                    {item.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
        {/* Hazard-tape mark — one deliberate brand stripe, not decoration. */}
        <div
          aria-hidden
          className="mt-6 h-2"
          style={{
            background:
              "repeating-linear-gradient(135deg, var(--color-signal) 0 14px, transparent 14px 28px)",
          }}
        />
      </header>

      <nav
        aria-label="Primary navigation"
        className="rise mt-6 flex flex-wrap items-stretch border-b border-rule font-mono text-xs uppercase tracking-[0.2em]"
        style={{ animationDelay: "70ms" }}
      >
        {nav.map((item, i) => (
          <a
            key={item}
            href={`#${item.toLowerCase()}`}
            aria-current={i === 0 ? "page" : undefined}
            className={`border-r border-rule px-4 py-3 transition-colors duration-150 hover:bg-panel hover:text-signal ${
              i === 0
                ? "bg-panel text-signal"
                : "text-ink-dim"
            }`}
          >
            <span className="text-ink-faint">{String(i + 1).padStart(2, "0")}</span>{" "}
            {item}
          </a>
        ))}
      </nav>

      <main className="mt-10 grid gap-x-12 gap-y-12 lg:grid-cols-[1.65fr_0.7fr]">
        <div className="flex flex-col gap-12">
          <section aria-labelledby="recommended-heading">
            <SectionMark
              id="recommended-heading"
              title="Recommended Tonight"
              index="Discovery queue / 02"
            />
            <ol className="mt-1">
              {recommendedEvents.map((event, i) => (
                <li
                  key={event.title}
                  className="rise group grid grid-cols-[auto_1fr] gap-x-5 border-b border-rule py-6 transition-colors duration-150 hover:bg-panel/60 sm:gap-x-8"
                  style={{ animationDelay: `${120 + i * 70}ms` }}
                >
                  <span className="font-display text-4xl leading-none text-ink-faint transition-colors duration-150 group-hover:text-signal sm:text-5xl">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="font-display text-2xl uppercase leading-none tracking-[0.01em] text-ink sm:text-3xl">
                        {event.title}
                      </h3>
                      <p className="font-mono text-sm uppercase tracking-[0.12em] text-ink-dim">
                        {event.day} {event.time}
                        <span className="text-ink-faint"> &middot; </span>
                        {event.area}
                      </p>
                    </div>
                    <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-ink-dim">
                      {event.reason}
                    </p>
                    <div className="mt-4">
                      <MatchMeter score={event.match} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="latest-heading">
            <SectionMark
              id="latest-heading"
              title="Latest Events"
              index="Source verified / 03"
            />
            <ul className="mt-1">
              {latestEvents.map((event, i) => (
                <li
                  key={event.title}
                  className="flex items-baseline gap-3 border-b border-rule py-4 font-mono text-sm"
                >
                  <span className="text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="uppercase tracking-[0.06em] text-ink">
                    {event.title}
                  </span>
                  <span
                    aria-hidden
                    className="mx-1 mb-1 flex-1 self-end border-b border-dotted border-rule-strong"
                  />
                  <span className="uppercase tracking-[0.1em] text-ink-dim">
                    {event.area}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-12 lg:border-l-2 lg:border-rule-strong lg:pl-12">
          <section aria-labelledby="showcase-heading">
            <SectionMark
              id="showcase-heading"
              title="Artist Showcase"
              index="Feature / 04"
            />
            <div className="mt-5 border border-rule-strong bg-panel">
              <div
                aria-hidden
                className="h-1.5"
                style={{
                  background:
                    "repeating-linear-gradient(135deg, var(--color-signal) 0 10px, transparent 10px 20px)",
                }}
              />
              <div className="p-5">
                <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-signal">
                  Archive week
                </p>
                <p className="mt-3 font-display text-5xl uppercase leading-[0.85] text-ink">
                  DJ
                  <br />
                  Heather
                </p>
                <p className="mt-5 text-sm leading-relaxed text-ink-dim">
                  Weekly deep-dive into one Chicago-rooted selector — archive
                  sets, where to listen, upcoming dates.
                </p>
                <p className="mt-5 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-signal">
                  Listening links
                  <span aria-hidden>&rarr;</span>
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="venue-heading">
            <SectionMark
              id="venue-heading"
              title="Venue Signals"
              index="Room context / 05"
            />
            <dl className="mt-1">
              {venueSignals.map((signal) => (
                <div
                  key={signal.label}
                  className="flex items-baseline gap-2 border-b border-rule py-3.5 font-mono text-sm"
                >
                  <dt className="uppercase tracking-[0.16em] text-ink-faint">
                    {signal.label}
                  </dt>
                  <span
                    aria-hidden
                    className="mb-1 flex-1 self-end border-b border-dotted border-rule-strong"
                  />
                  <dd className="uppercase tracking-[0.06em] text-ink">
                    {signal.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </main>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t-2 border-rule-strong pt-4 font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint">
        <span>Source-verified &middot; Chicago underground</span>
        <span>End of manifest</span>
      </footer>
    </div>
  );
}
