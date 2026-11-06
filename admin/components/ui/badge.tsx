import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-foreground",
        outline: "border-border bg-background text-foreground",
        solid: "border-foreground bg-foreground text-background",
        warn: "border-border bg-background text-foreground",
        danger: "border-destructive/40 bg-destructive/5 text-destructive",
        success: "border-border bg-background text-foreground",
        dot: "border-transparent bg-transparent text-foreground px-0",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...p }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
