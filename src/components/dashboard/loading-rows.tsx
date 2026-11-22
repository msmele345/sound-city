import { useId } from "react";

type LoadingVariant =
  | "feed"
  | "recommendation"
  | "next"
  | "showcase"
  | "artist"
  | "venue"
  | "compact";

function Bar({ className }: { className: string }) {
  return <span className={`block bg-panel ${className}`} />;
}

function FeedSkeleton() {
  return (
    <>
      <Bar className="h-5 w-14" />
      <div className="min-w-0">
        <Bar className="h-7 w-3/5 max-w-sm" />
        <Bar className="mt-2 h-4 w-2/5 max-w-xs" />
        <Bar className="mt-2 h-4 w-1/3 max-w-[14rem]" />
        <Bar className="mt-4 h-4 w-36" />
      </div>
      <Bar className="h-4 w-24" />
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Bar className="h-9 w-16" />
        <Bar className="h-9 w-20" />
        <Bar className="h-9 w-24" />
      </div>
    </>
  );
}

function RecommendationSkeleton() {
  return (
    <>
      <Bar className="h-10 w-10" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Bar className="h-8 w-2/3 max-w-md" />
          <Bar className="h-4 w-28" />
        </div>
        <Bar className="mt-2 h-4 w-1/2 max-w-xs" />
        <Bar className="mt-3 h-4 w-full max-w-xl" />
        <Bar className="mt-2 h-4 w-4/5 max-w-lg" />
        <Bar className="mt-4 h-4 w-40" />
        <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Bar className="h-4 w-32" />
          <Bar className="h-9 w-16" />
          <Bar className="h-9 w-20" />
          <Bar className="h-9 w-28" />
        </div>
      </div>
    </>
  );
}

function NextSkeleton() {
  return (
    <>
      <Bar className="h-7 w-3/4 max-w-xs" />
      <Bar className="mt-2 h-4 w-full max-w-sm" />
    </>
  );
}

function ShowcaseSkeleton() {
  return (
    <div className="mt-5 w-full">
      <Bar className="h-1.5 w-full" />
      <div className="border-b border-rule py-5">
        <Bar className="h-3 w-28" />
        <Bar className="mt-3 h-12 w-2/3 max-w-sm" />
        <Bar className="mt-4 h-4 w-1/2 max-w-[12rem]" />
        <Bar className="mt-5 h-4 w-full" />
        <Bar className="mt-2 h-4 w-11/12" />
        <Bar className="mt-2 h-4 w-2/3" />
        <div className="mt-5 flex flex-wrap gap-2">
          <Bar className="h-9 w-24" />
          <Bar className="h-9 w-20" />
        </div>
      </div>
    </div>
  );
}

function ArtistSkeleton() {
  return (
    <>
      <Bar className="h-6 w-1/2 max-w-xs" />
      <Bar className="mt-2 h-4 w-1/3 max-w-[10rem]" />
      <Bar className="mt-3 h-9 w-28" />
    </>
  );
}

function VenueSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Bar className="h-8 w-1/2 max-w-xs" />
        <Bar className="h-4 w-8" />
      </div>
      <Bar className="mt-2 h-4 w-1/3 max-w-[12rem]" />
      <Bar className="mt-3 h-4 w-full" />
      <div className="mt-4">
        <div className="grid gap-2 border-t border-rule py-3 sm:grid-cols-[5rem_1fr]">
          <Bar className="h-4 w-12" />
          <Bar className="h-4 w-full" />
        </div>
        <div className="grid gap-2 border-t border-rule py-3 sm:grid-cols-[5rem_1fr]">
          <Bar className="h-4 w-12" />
          <Bar className="h-4 w-4/5" />
        </div>
      </div>
      <Bar className="mt-4 h-4 w-28" />
      <Bar className="mt-3 h-5 w-3/5 max-w-xs" />
    </>
  );
}

function CompactSkeleton() {
  return (
    <>
      <Bar className="h-6 w-2/3 max-w-xs" />
      <Bar className="mt-2 h-4 w-1/2 max-w-[14rem]" />
      <Bar className="mt-4 h-4 w-36" />
    </>
  );
}

const rowClass: Record<LoadingVariant, string> = {
  feed: "grid grid-cols-1 items-start gap-3 border-b border-rule py-5 sm:grid-cols-[5.5rem_minmax(0,1.5fr)_minmax(7rem,0.8fr)_auto] sm:items-center sm:gap-x-6",
  recommendation:
    "grid grid-cols-1 gap-y-3 border-b border-rule py-6 sm:grid-cols-[auto_1fr] sm:gap-x-8",
  next: "border-b border-rule py-4",
  showcase: "list-none",
  artist: "border-t border-rule py-3",
  venue: "border-b border-rule py-5 lg:border lg:p-5",
  compact: "border-t border-rule py-3",
};

const listClass: Record<LoadingVariant, string> = {
  feed: "",
  recommendation: "mt-1",
  next: "mt-1",
  showcase: "",
  artist: "mt-2",
  venue: "mt-4 grid grid-cols-1 lg:grid-cols-2 lg:gap-8",
  compact: "mt-2",
};

function Skeleton({ variant }: { variant: LoadingVariant }) {
  switch (variant) {
    case "feed":
      return <FeedSkeleton />;
    case "recommendation":
      return <RecommendationSkeleton />;
    case "next":
      return <NextSkeleton />;
    case "showcase":
      return <ShowcaseSkeleton />;
    case "artist":
      return <ArtistSkeleton />;
    case "venue":
      return <VenueSkeleton />;
    case "compact":
      return <CompactSkeleton />;
  }
}

export function LoadingRows({
  label,
  variant,
  count = 3,
}: {
  label: string;
  variant: LoadingVariant;
  count?: number;
}) {
  const labelId = useId();
  const rows = variant === "showcase" ? 1 : count;

  return (
    <div role="status" aria-busy="true" aria-labelledby={labelId}>
      <p id={labelId} className="sr-only">
        {label}
      </p>
      <ol aria-hidden="true" className={listClass[variant] || undefined}>
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className={rowClass[variant]}>
            <Skeleton variant={variant} />
          </li>
        ))}
      </ol>
    </div>
  );
}
