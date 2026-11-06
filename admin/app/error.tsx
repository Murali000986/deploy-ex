"use client";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <div className="text-sm font-semibold">Something went wrong</div>
      <div className="max-w-md text-xs text-muted-foreground">{error.message || "An unexpected error occurred. Try again."}</div>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
