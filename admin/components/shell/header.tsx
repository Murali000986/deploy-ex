"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Search, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn, initials } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { signOut } from "next-auth/react";

const LABELS: Record<string, string> = {
  overview: "Overview",
  spice: "SPICe+ Requests",
  "name-screening": "Name Screening",
  "needs-correction": "Needs Correction",
  "pending-review": "Pending Review",
  "ready-for-part-a": "Ready for Part A",
  "human-handoff": "Human Handoff",
  "audit-logs": "Audit Logs",
  settings: "Settings",
  admin: "Administration",
  users: "Admin Users",
};

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data } = useSession();
  const [q, setQ] = React.useState("");

  const crumbs = pathname.split("/").filter(Boolean).map((seg, i, arr) => {
    const href = "/" + arr.slice(0, i + 1).join("/");
    const label = LABELS[seg] ?? seg.replace(/-/g, " ");
    return { href, label };
  });

  const name = data?.user?.name ?? "";
  const role = (data?.user as any)?.role as string | undefined;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    router.push(`/spice?q=${encodeURIComponent(t)}`);
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-5">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center text-sm">
        <Link href="/overview" className="text-muted-foreground hover:text-foreground">Home</Link>
        {crumbs.map((c, i) => (
          <React.Fragment key={c.href}>
            <ChevronRight className="mx-1.5 h-3.5 w-3.5 text-muted-foreground/50" />
            <Link
              href={c.href}
              className={cn(
                "truncate",
                i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </Link>
          </React.Fragment>
        ))}
      </nav>

      <form onSubmit={onSubmit} className="ml-auto hidden md:block relative w-80">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search request, client, company…"
          className="h-9 pl-8"
        />
      </form>

      <button className="relative rounded-sm p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Notifications">
        <Bell className="h-4 w-4" />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-foreground" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1 hover:border-border hover:bg-accent">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">{initials(name) || "U"}</div>
            <div className="hidden text-left md:block">
              <div className="text-xs font-medium leading-tight">{name || "—"}</div>
              <div className="text-[10px] leading-tight text-muted-foreground">{role === "SUPERADMIN" ? "Superadmin" : "Admin"}</div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Signed in</DropdownMenuLabel>
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">{data?.user?.email}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/settings">Settings</Link></DropdownMenuItem>
          <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
