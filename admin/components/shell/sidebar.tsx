"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard, FileText, Search, AlertTriangle, ClipboardCheck,
  CheckCircle2, UserCog, ScrollText, Settings, ChevronLeft, ChevronRight, LogOut, Users, FileStack,
  LayoutGrid, FileCheck2, HardDrive, Building2, UserCheck, FileSignature
} from "lucide-react";
import { cn, initials } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ElementType; superadminOnly?: boolean };

const NAV: { heading?: string; items: Item[] }[] = [
  { items: [{ href: "/overview", label: "Overview", icon: LayoutDashboard }] },
  {
    heading: "SPICe+",
    items: [
      { href: "/spice", label: "Client Requests", icon: FileStack },
      { href: "/name-screening", label: "Name Screening", icon: Search },
      { href: "/needs-correction", label: "Needs Correction", icon: AlertTriangle },
      { href: "/pending-review", label: "Pending Review", icon: ClipboardCheck },
      { href: "/ready-for-part-a", label: "Ready for Part A", icon: CheckCircle2 },
      { href: "/human-handoff", label: "Human Handoff", icon: UserCog },
    ],
  },
  {
    heading: "Forms",
    items: [
      { href: "/forms", label: "All forms", icon: LayoutGrid },
      { href: "/forms/aoc4", label: "AOC-4", icon: FileCheck2 },
      { href: "/forms/aoc4-offline", label: "AOC-4 Offline", icon: HardDrive },
      { href: "/forms/inc32", label: "INC-32", icon: Building2 },
      { href: "/forms/dir3-kyc", label: "DIR-3 KYC", icon: UserCheck },
      { href: "/forms/spice-part-a", label: "SPICe+ Part A", icon: FileSignature },
    ],
  },
  {
    heading: "Administration",
    items: [
      { href: "/admin/users", label: "Admin Users", icon: Users, superadminOnly: true },
      { href: "/audit-logs", label: "Audit Logs", icon: ScrollText, superadminOnly: true },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const [collapsed, setCollapsed] = React.useState(false);
  const role = (data?.user as any)?.role as "ADMIN" | "SUPERADMIN" | undefined;
  const name = data?.user?.name ?? "";

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col border-r border-sidebar/40 bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      <div className="flex h-14 items-center gap-2 px-3 border-b border-white/10">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-white text-sidebar text-xs font-bold">L</div>
        {!collapsed && <span className="text-sm font-semibold tracking-tight">Ledgerly</span>}
        <button
          aria-label="Toggle sidebar"
          className="ml-auto rounded-sm p-1 text-sidebar-foreground/60 hover:bg-sidebar-hover hover:text-white"
          onClick={() => setCollapsed(c => !c)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3">
        {NAV.map((group, gi) => {
          const items = group.items.filter(i => !i.superadminOnly || role === "SUPERADMIN");
          if (items.length === 0) return null;
          return (
            <div key={gi} className="mb-4">
              {!collapsed && group.heading && (
                <div className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
                  {group.heading}
                </div>
              )}
              <ul className="space-y-0.5">
                {items.map(item => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex h-8 items-center gap-2.5 rounded-sm px-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-hover hover:text-white",
                          active && "bg-sidebar-active text-white"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-2">
        <div className={cn("flex items-center gap-2 rounded-sm px-2 py-2", collapsed && "justify-center px-0")}>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
            {initials(name) || "L"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white">{name || "—"}</div>
              <div className="truncate text-[10px] text-sidebar-foreground/60">{role === "SUPERADMIN" ? "Superadmin" : "Admin"}</div>
            </div>
          )}
          <button
            aria-label="Sign out"
            className="rounded-sm p-1 text-sidebar-foreground/60 hover:bg-sidebar-hover hover:text-white"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
