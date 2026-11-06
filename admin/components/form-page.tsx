import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { FormIcon } from "@/components/form-icon";
import { formRequestsForUser, USERS } from "@/lib/mock-data";
import type { FormDescriptor } from "@/lib/forms";
import { FormQueueTable } from "@/components/form-queue-table";
import { Rocket, Database, CheckCircle2, AlertTriangle, Clock, ArrowUpRight } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";

/**
 * Shared layout for a form queue page (AOC-4, AOC-4 Offline, INC-32, …).
 *
 * Renders: header (icon + title + description + launch action), 4-up metric
 * cards tuned to form-filing workflow, and the request table scoped to this
 * form type.
 */
export async function FormPage({
  form,
  secondaryNote,
}: {
  form: FormDescriptor;
  secondaryNote?: string;
}) {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role as "ADMIN" | "SUPERADMIN";
  const name = session!.user?.name ?? "";
  const requests = formRequestsForUser(role, name, form.value);
  const admins = USERS.filter(u => u.role === "ADMIN" && u.active).map(u => u.name);

  // Form-filing centric metrics.
  const total = requests.length;
  const prefillPending = requests.filter(r =>
    ["FORM_DRAFT", "FORM_PREFILL", "DRAFT", "COLLECTING_DETAILS"].includes(r.currentStage)
  ).length;
  const validationIssues = requests.filter(r =>
    r.currentStage === "FORM_VALIDATION" ||
    r.currentStage === "FORM_CORRECTION" ||
    r.currentStage === "NEEDS_CORRECTION" ||
    r.blockingIssues.length > 0
  ).length;
  const readyToFile = requests.filter(r =>
    r.currentStage === "FORM_READY_TO_FILE" || r.currentStage === "READY_FOR_PART_A"
  ).length;
  const filed = requests.filter(r => r.currentStage === "FORM_FILED").length;

  const recent = [...requests]
    .sort((a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", form.tint)}>
              <FormIcon form={form} className="h-4 w-4" />
            </span>
            <span>{form.label}</span>
          </span>
        }
        description={
          <>
            {form.longDescription}
            {secondaryNote && (
              <span className="mt-1 block text-[11px] uppercase tracking-wide text-muted-foreground/80">
                {secondaryNote}
              </span>
            )}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/forms"><ArrowUpRight className="h-3.5 w-3.5" /> All forms</Link>
            </Button>
            <Button>
              <Rocket className="h-3.5 w-3.5" /> New {form.shortLabel} request
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Total requests"
          value={total}
          icon={<Database className="h-4 w-4" />}
        />
        <MetricCard
          label="Prefill pending"
          value={prefillPending}
          icon={<Clock className="h-4 w-4" />}
          hint="Awaiting data or draft"
        />
        <MetricCard
          label="Validation issues"
          value={validationIssues}
          icon={<AlertTriangle className="h-4 w-4" />}
          hint="Blocking or needs correction"
        />
        <MetricCard
          label={form.value === "AOC4_OFFLINE" || form.value === "AOC4" ? "Ready to file" : "Ready / Filed"}
          value={readyToFile + filed}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint={filed ? `${filed} filed` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FormQueueTable form={form} requests={requests} admins={admins} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No activity yet.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map(r => (
                  <li key={r.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.clientName}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.id} · {r.nextAction}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StageBadge stage={r.currentStage} />
                        <span className="text-[10px] text-muted-foreground">{timeAgo(r.lastActivityAt)}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
