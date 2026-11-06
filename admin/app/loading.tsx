export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-3 w-3 animate-pulse rounded-full bg-foreground" />
        Loading…
      </div>
    </div>
  );
}
