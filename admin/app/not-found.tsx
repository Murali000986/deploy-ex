import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background text-center">
      <div className="text-4xl font-semibold tracking-tight">404</div>
      <div className="text-sm text-muted-foreground">We couldn't find that page.</div>
      <Link href="/overview" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">Back to overview</Link>
    </div>
  );
}
