import * as React from "react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label, value, hint, icon, className,
}: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border border-border bg-background p-4", className)}>
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
