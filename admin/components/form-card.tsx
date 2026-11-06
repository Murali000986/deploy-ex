import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { FormDescriptor } from "@/lib/forms";
import { cn } from "@/lib/utils";

/**
 * Hub tile for a form workflow. Shown on /forms.
 * Pairs a tinted icon square with a title, description, and active count.
 */
export function FormCard({
  form,
  icon,
  activeCount,
  totalCount,
}: {
  form: FormDescriptor;
  icon: React.ReactNode;
  activeCount: number;
  totalCount: number;
}) {
  return (
    <Link href={form.listingHref} className="group block">
      <Card className="h-full p-4 transition-colors hover:border-foreground/30 hover:shadow-sm">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border",
              form.tint
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold">{form.label}</h3>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </div>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {form.description}
            </p>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
                <span className="font-medium text-foreground tabular-nums">
                  {activeCount}
                </span>
                <span>active</span>
              </span>
              <span className="h-3 w-px bg-border" />
              <span className="tabular-nums">
                {totalCount} total
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
