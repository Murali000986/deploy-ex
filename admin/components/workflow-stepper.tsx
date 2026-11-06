import { Check, Circle, AlertCircle } from "lucide-react";
import { STAGE_LABEL, STAGE_ORDER, type StageEvent, type WorkflowStage } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export function WorkflowStepper({
  current, history, blocking, order,
}: { current: WorkflowStage; history: StageEvent[]; blocking?: string[]; order?: WorkflowStage[] }) {
  const stages = order ?? STAGE_ORDER;
  const historyMap = new Map(history.map(h => [h.stage, h.enteredAt]));
  const currentIndex = stages.indexOf(current);
  const isDiverged = currentIndex === -1;

  return (
    <ol className="relative">
      {stages.map((stage, idx) => {
        const entered = historyMap.get(stage);
        const isDone = currentIndex > idx || (isDiverged && entered);
        const isActive = !isDiverged && idx === currentIndex;
        const isPending = !isDone && !isActive;

        return (
          <li key={stage} className="relative flex gap-3 pb-5 last:pb-0">
            {idx < stages.length - 1 && (
              <span className={cn("absolute left-[11px] top-6 h-full w-px", isDone ? "bg-foreground" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border",
                isDone && "bg-foreground border-foreground text-background",
                isActive && "border-foreground bg-background text-foreground",
                isPending && "border-border bg-background text-muted-foreground"
              )}
            >
              {isDone ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2 fill-current" />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className={cn("text-xs font-medium leading-tight", isPending && "text-muted-foreground")}>
                {STAGE_LABEL[stage]}
              </div>
              {entered && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTime(entered)}</div>
              )}
              {isActive && blocking && blocking.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {blocking.map((b, i) => (
                    <li key={i} className="flex items-start gap-1 text-[11px] text-destructive">
                      <AlertCircle className="mt-[1px] h-3 w-3 shrink-0" /><span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}

      {isDiverged && (
        <li className="relative flex gap-3">
          <span className="relative z-10 mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-destructive bg-background text-destructive">
            <AlertCircle className="h-3 w-3" />
          </span>
          <div>
            <div className="text-xs font-medium text-destructive">{STAGE_LABEL[current]}</div>
            {blocking?.map((b, i) => (
              <div key={i} className="mt-0.5 text-[11px] text-destructive">{b}</div>
            ))}
          </div>
        </li>
      )}
    </ol>
  );
}

export function CompactProgress({ stage, order }: { stage: WorkflowStage; order?: WorkflowStage[] }) {
  const stages = order ?? STAGE_ORDER;
  const idx = stages.indexOf(stage);
  const total = stages.length;
  const pct = idx >= 0 ? Math.round(((idx + 1) / total) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5" title={STAGE_LABEL[stage]}>
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-foreground" style={{ width: `${pct || 10}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground">{idx >= 0 ? `${idx + 1}/${total}` : "—"}</span>
    </div>
  );
}
