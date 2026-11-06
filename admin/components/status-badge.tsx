import { Badge } from "@/components/ui/badge";
import { STAGE_LABEL, SCREENING_LABEL, type WorkflowStage, type ScreeningVerdict } from "@/lib/types";
import { cn } from "@/lib/utils";

const STAGE_STYLE: Record<WorkflowStage, string> = {
  DRAFT: "bg-muted text-foreground border-border",
  AWAITING_CLIENT: "bg-background text-foreground border-border",
  COLLECTING_DETAILS: "bg-background text-foreground border-border",
  AI_VALIDATION: "bg-background text-foreground border-border",
  NEEDS_CORRECTION: "bg-background text-foreground border-foreground/40 ring-1 ring-foreground/10",
  NAME_SCREENING: "bg-background text-foreground border-border",
  NAME_CONFLICT: "bg-background text-foreground border-foreground/40",
  AWAITING_ALTERNATIVE_NAME: "bg-background text-foreground border-border",
  ADMIN_REVIEW: "bg-background text-foreground border-foreground/40",
  READY_FOR_PART_A: "bg-foreground text-background border-foreground",
  HUMAN_HANDOFF: "bg-background text-foreground border-destructive/50",
  FAILED_RETRY: "bg-background text-destructive border-destructive/50",
  REJECTED: "bg-background text-destructive border-destructive/50",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  FORM_DRAFT: "bg-muted text-foreground border-border",
  FORM_PREFILL: "bg-background text-foreground border-border",
  FORM_VALIDATION: "bg-background text-foreground border-foreground/40",
  FORM_READY_TO_FILE: "bg-foreground text-background border-foreground",
  FORM_FILED: "bg-background text-foreground border-foreground/40 ring-1 ring-foreground/10",
  FORM_CORRECTION: "bg-background text-destructive border-destructive/50",
};

export function StageBadge({ stage }: { stage: WorkflowStage }) {
  return <Badge className={cn("rounded-sm", STAGE_STYLE[stage])}>{STAGE_LABEL[stage]}</Badge>;
}

const VERDICT_STYLE: Record<ScreeningVerdict, string> = {
  EXACT_MATCH: "border-destructive/50 text-destructive",
  SIMILAR_FOUND: "border-foreground/40",
  TRADEMARK_CONCERN: "border-destructive/40 text-destructive",
  NO_MATCH: "border-border",
  SEARCH_INCOMPLETE: "border-border text-muted-foreground",
  HUMAN_REVIEW_REQUIRED: "border-foreground/50",
};

export function VerdictBadge({ v }: { v: ScreeningVerdict }) {
  return <Badge className={cn("rounded-sm", VERDICT_STYLE[v])}>{SCREENING_LABEL[v]}</Badge>;
}
