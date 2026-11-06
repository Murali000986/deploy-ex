import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { MetricCard } from "@/components/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/status-badge";
import { requestsForUser, FORM_REQUESTS } from "@/lib/mock-data";
import { timeAgo } from "@/lib/utils";
import { ArrowRight, FileStack, AlertTriangle, UserCog, CheckCircle2, LayoutGrid } from "lucide-react";

export default async function OverviewPage() {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role as "ADMIN" | "SUPERADMIN";
  const name = session!.user?.name ?? "";
  const requests = requestsForUser(role, name);

  const total = requests.length;
  const needsCorrection = requests.filter(r => r.currentStage === "NEEDS_CORRECTION").length;
  const nameScreening = requests.filter(r => r.currentStage === "NAME_SCREENING").length;
  const adminReview = requests.filter(r => r.currentStage === "ADMIN_REVIEW").length;
  const readyPartA = requests.filter(r => r.currentStage === "READY_FOR_PART_A").length;
  const handoff = requests.filter(r => r.currentStage === "HUMAN_HANDOFF" || r.currentStage === "FAILED_RETRY").length;
  const formsInProgress = FORM_REQUESTS.filter(r =>
    !["FORM_FILED", "REJECTED", "CANCELLED"].includes(r.currentStage) &&
    (role === "SUPERADMIN" || r.assignedAdmin === name || !r.assignedAdmin)
  ).length;

  const recent = [...requests].sort((a, b) => +new Date(b.lastActivityAt) - +new Date(a.lastActivityAt)).slice(0, 6);

  return (
    <>
      <PageHeader
        title={role === "SUPERADMIN" ? "Operations overview" : `Welcome back, ${name.split(" ")[0] || "Admin"}`}
        description={role === "SUPERADMIN" ? "Live view of the SPICe+ pipeline, workload and system health." : "Your assigned requests and what needs your attention."}
        actions={<Button asChild><Link href="/spice">Open request queue <ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <MetricCard label={role === "SUPERADMIN" ? "Total requests" : "Your requests"} value={total} icon={<FileStack className="h-4 w-4" />} />
        <MetricCard label="Needs correction" value={needsCorrection} icon={<AlertTriangle className="h-4 w-4" />} />
        <MetricCard label="Name screening" value={nameScreening} />
        <MetricCard label="Admin review" value={adminReview} />
        <MetricCard label="Ready for Part A" value={readyPartA} icon={<CheckCircle2 className="h-4 w-4" />} />
        <Link href="/forms" className="block">
          <MetricCard
            label="Form filings in progress"
            value={formsInProgress}
            icon={<LayoutGrid className="h-4 w-4" />}
            hint="AOC-4, INC-32, DIR-3 KYC …"
            className="transition-colors hover:border-foreground/30"
          />
        </Link>
      </div>

      {role === "SUPERADMIN" && (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <MetricCard label="Human handoff / failed" value={handoff} icon={<UserCog className="h-4 w-4" />} hint="Needs manual intervention" />
          <MetricCard label="Active admins" value="2 / 3" hint="1 account disabled" />
          <MetricCard label="Integration health" value="Nominal" hint="MCA, WhatsApp, screening — all green" />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            <Link href="/spice" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <EmptyState title="No activity yet" />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map(r => (
                  <li key={r.id}>
                    <Link href={`/spice/${r.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-subtle">
                      <StageBadge stage={r.currentStage} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{r.proposedNames[0]?.name ?? r.clientName}</span>
                          <span className="text-xs text-muted-foreground">· {r.id}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.clientName} · Next: {r.nextAction}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(r.lastActivityAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Attention needed</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <QueueLink href="/needs-correction" label="Needs correction" count={needsCorrection} />
            <QueueLink href="/name-screening" label="Name screening" count={nameScreening} />
            <QueueLink href="/pending-review" label="Admin review" count={adminReview} />
            <QueueLink href="/human-handoff" label="Human handoff" count={handoff} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function QueueLink({ href, label, count }: { href: string; label: string; count: number }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-sm border border-border px-3 py-2 text-sm hover:bg-subtle">
      <span>{label}</span>
      <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums">{count}</span>
    </Link>
  );
}

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="text-xs text-muted-foreground">{description}</div>}
    </div>
  );
}
