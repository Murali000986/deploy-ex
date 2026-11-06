import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { StageBadge } from "@/components/status-badge";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormIcon } from "@/components/form-icon";
import { LoadFillButton } from "@/components/load-fill-button";
import { findRequest } from "@/lib/mock-data";
import type { FormDescriptor } from "@/lib/forms";
import {
  ArrowLeft, Building2, UserCircle2, CalendarDays, FileText,
  CheckCircle2, AlertTriangle, Clock, FilePlus2, ShieldCheck
} from "lucide-react";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/**
 * Detail view for a single form request. Shows company data, submitted
 * fields grouped by category, workflow progress and a Load-and-Fill action
 * that bridges to the browser extension.
 */
export async function FormDetail({
  form,
  id,
}: {
  form: FormDescriptor;
  id: string;
}) {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role as "ADMIN" | "SUPERADMIN";

  const request = findRequest(id);
  if (!request) return notFound();

  // Group submitted fields into coarse buckets for display.
  const grouped = groupFields(form, request.submittedFields);

  const prefillPct = computePrefillPct(request.submittedFields);

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", form.tint)}>
              <FormIcon form={form} className="h-4 w-4" />
            </span>
            <span>{request.clientName}</span>
            <StageBadge stage={request.currentStage} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-3 text-xs">
            <span className="font-mono">{request.id}</span>
            {request.cin && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" /> {request.cin}
              </span>
            )}
            {request.financialYear && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> FY {request.financialYear}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <UserCircle2 className="h-3 w-3" />
              {request.assignedAdmin ?? "Unassigned"}
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={form.listingHref}><ArrowLeft className="h-3.5 w-3.5" /> Back</Link>
            </Button>
            <LoadFillButton form={form} request={request} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-5">
          {/* Prefill summary */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Prefill summary
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">
                {Object.keys(request.submittedFields).length} fields collected
              </span>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Completeness</span>
                <span className="font-medium tabular-nums">{prefillPct}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-foreground transition-all" style={{ width: `${prefillPct}%` }} />
              </div>
              {request.validation.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {request.validation.map((v, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <AlertTriangle
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          v.severity === "ERROR" ? "text-destructive" : "text-foreground/70"
                        )}
                      />
                      <span>
                        <span className="font-mono">{v.field}</span>
                        <span className="text-muted-foreground"> · {v.message}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Submitted fields, grouped */}
          {grouped.map(group => (
            <Card key={group.title}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <group.icon className="h-4 w-4 text-muted-foreground" />
                  {group.title}
                </CardTitle>
                <Badge className="rounded-sm text-[10px]">
                  {group.rows.length} fields
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {group.rows.length === 0 ? (
                  <div className="px-4 py-6 text-xs text-muted-foreground">
                    No data in this section yet.
                  </div>
                ) : (
                  <dl className="divide-y divide-border">
                    {group.rows.map(([k, v]) => (
                      <div key={k} className="grid grid-cols-[180px_1fr] gap-3 px-4 py-2.5">
                        <dt className="text-xs text-muted-foreground">{humanize(k)}</dt>
                        <dd className="break-words text-sm">{v || <span className="text-muted-foreground">—</span>}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Confirm actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
            <Button variant="outline">
              <AlertTriangle className="h-3.5 w-3.5" /> Request correction
            </Button>
            <Button>
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark ready to file
            </Button>
            {role === "SUPERADMIN" && (
              <Button variant="ghost">
                <FilePlus2 className="h-3.5 w-3.5" /> Mark filed
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar: workflow + assignment */}
        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Workflow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WorkflowStepper
                current={request.currentStage}
                history={request.stageHistory}
                blocking={request.blockingIssues}
                order={form.stageOrder}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle2 className="h-4 w-4 text-muted-foreground" />
                Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Row label="Assigned to" value={request.assignedAdmin ?? "Unassigned"} />
              <Row label="Handled by" value={request.handledBy === "AI" ? "AI copilot" : "Human admin"} />
              <Row label="Last activity" value={timeAgo(request.lastActivityAt)} />
              <Row label="Created" value={formatDateTime(request.createdAt)} />
              {request.clientEmail && <Row label="Email" value={request.clientEmail} />}
              <Row label="Phone" value={request.clientPhone} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Extension bridge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Push these fields into the Ledgerly browser extension to auto-fill the live MCA form.
              </p>
              <LoadFillButton form={form} request={request} size="sm" fullWidth />
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

// ----- helpers -----

function humanize(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function computePrefillPct(fields: Record<string, string>) {
  const entries = Object.values(fields);
  if (entries.length === 0) return 0;
  const filled = entries.filter(v => (v ?? "").trim().length > 0).length;
  return Math.round((filled / entries.length) * 100);
}

// Rough category hints for AOC-4 Offline (9 categories) and other forms.
const AOC4_OFFLINE_CATEGORIES: { title: string; icon: any; hints: RegExp[] }[] = [
  { title: "General Information", icon: Building2, hints: [/^cin/i, /^companyName/i, /^financialYear/i] },
  { title: "Signatory Details", icon: UserCircle2, hints: [/signatory/i, /^signatoryDIN/i, /^dsc/i] },
  { title: "AGM Details", icon: CalendarDays, hints: [/^agm/i, /boardMeeting/i] },
  { title: "Subsidiary", icon: Building2, hints: [/subsidiar/i, /holding/i] },
  { title: "Auditor Details", icon: ShieldCheck, hints: [/auditor/i, /^frn/i] },
  { title: "General & Other", icon: FileText, hints: [/^capital/i, /turnover/i, /pat/i] },
  { title: "Related Party", icon: UserCircle2, hints: [/relatedParty/i] },
  { title: "Auditor's Report", icon: FileText, hints: [/report/i] },
  { title: "CSR & Misc", icon: FileText, hints: [/csr/i, /misc/i] },
];

const AOC4_CATEGORIES: { title: string; icon: any; hints: RegExp[] }[] = [
  { title: "General", icon: Building2, hints: [/^cin/i, /^companyName/i, /^financialYear/i] },
  { title: "Signatories", icon: UserCircle2, hints: [/signatory/i, /^dsc/i, /^din/i] },
  { title: "AGM", icon: CalendarDays, hints: [/^agm/i, /boardMeeting/i] },
  { title: "Auditor", icon: ShieldCheck, hints: [/auditor/i, /^frn/i] },
  { title: "Industry", icon: FileText, hints: [/industry/i, /sector/i, /nic/i] },
];

function groupFields(form: FormDescriptor, fields: Record<string, string>) {
  const entries = Object.entries(fields);
  const categories =
    form.value === "AOC4_OFFLINE"
      ? AOC4_OFFLINE_CATEGORIES
      : form.value === "AOC4"
      ? AOC4_CATEGORIES
      : null;

  if (!categories) {
    return [{ title: "Submitted fields", icon: FileText as any, rows: entries }];
  }

  const used = new Set<string>();
  const out = categories.map(cat => {
    const rows = entries.filter(([k]) => {
      if (used.has(k)) return false;
      const hit = cat.hints.some(h => h.test(k));
      if (hit) used.add(k);
      return hit;
    });
    return { title: cat.title, icon: cat.icon, rows };
  });

  const other = entries.filter(([k]) => !used.has(k));
  if (other.length) out.push({ title: "Other", icon: FileText, rows: other });
  return out;
}
