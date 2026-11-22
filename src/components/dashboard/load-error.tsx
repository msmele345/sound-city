import { Button } from "./button";

export function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry(): void;
}) {
  return (
    <div className="border-b border-rule py-5">
      <p role="alert" className="text-body text-ink-dim">
        {message}
      </p>
      <div className="mt-4">
        <Button onClick={onRetry}>Retry</Button>
      </div>
    </div>
  );
}
