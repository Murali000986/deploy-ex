import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findRequest } from "@/lib/mock-data";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageBadge, VerdictBadge } from "@/components/status-badge";
import { WorkflowStepper } from "@/components/workflow-stepper";
import { WhatsAppPanel } from "@/components/whatsapp-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { ArrowLeft, AlertCircle, Clock } from "lucide-react";
import { ConfirmActionButton } from "@/components/confirm-action";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const r = findRequest(params.id);
  if (!r) notFound();
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role as "ADMIN" | "SUPERADMIN";
  const primary = r.proposedNames[0];

  return (
    <>
      <Link href="/spice" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to requests
      </Link>

      <PageHeader
        title={primary?.name ?? r.clientName}
        description={
          <>
            <span className="font-mono text-xs">{r.id}</span> · {r.clientName} · {r.clientPhone}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <StageBadge stage={r.currentStage} />
            {r.handledBy === "AI" && <Badge variant="outline">AI handling</Badge>}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="company">Company Details</TabsTrigger>
              <TabsTrigger value="screening">Name Screening</TabsTrigger>
              <TabsTrigger value="conversation">WhatsApp</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Client</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <Field label="Name" value={r.clientName} />
                    <Field label="Phone" value={r.clientPhone} />
                    {r.clientEmail && <Field label="Email" value={r.clientEmail} />}
                    <Field label="Request opened" value={formatDateTime(r.createdAt)} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>Proposed names</CardTitle></CardHeader>
                  <CardContent className="divide-y divide-border p-0">
                    {r.proposedNames.map((n, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 p-3">
                        <div>
                          <div className="text-sm font-medium">{n.name}</div>
                          {n.notes && <div className="text-xs text-muted-foreground mt-0.5">{n.notes}</div>}
                          {n.source && <div className="text-[11px] text-muted-foreground mt-0.5">Source: {n.source}{n.checkedAt ? ` · ${timeAgo(n.checkedAt)}` : ""}</div>}
                        </div>
                        <VerdictBadge v={n.verdict} />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {r.blockingIssues.length > 0 && (
                  <Card className="md:col-span-2 border-destructive/40">
                    <CardHeader><CardTitle className="text-destructive">Blocking issues</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5">
                        {r.blockingIssues.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /><span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <Card className="md:col-span-2">
                  <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>Available actions</CardTitle>
                    <span className="text-xs text-muted-foreground">Next: {r.nextAction}</span>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button variant="outline">Review validation</Button>
                    <Button variant="outline">Request correction</Button>
                    <Button variant="outline">Review similar names</Button>
                    <Button variant="outline">Ask client to select a name</Button>
                    <Button variant="outline">Resolve manually</Button>
                    <Button disabled={r.blockingIssues.length > 0} title={r.blockingIssues.length > 0 ? "Resolve blocking issues first" : undefined}>
                      Mark ready for Part A
                    </Button>
                    <ConfirmActionButton
                      label="Reject request"
                      variant="destructive"
                      confirmTitle="Reject this request?"
                      confirmDescription="Rejecting will close the request. The client will be notified. This cannot be undone from the UI."
                      confirmLabel="Reject request"
                    />
                    <ConfirmActionButton
                      label="Cancel request"
                      variant="outline"
                      confirmTitle="Cancel this request?"
                      confirmDescription="Cancelling moves the request out of the active queue."
                      confirmLabel="Cancel request"
                    />
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="company">
              <Card>
                <CardHeader><CardTitle>Submitted company details</CardTitle></CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
                    {Object.entries(r.submittedFields).map(([k, v]) => (
                      <div key={k} className="flex flex-col">
                        <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</dt>
                        <dd className="font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="screening">
              <Card>
                <CardHeader><CardTitle>Name screening results</CardTitle></CardHeader>
                <CardContent className="divide-y divide-border p-0">
                  {r.proposedNames.map((n, i) => (
                    <div key={i} className="p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium">{n.name}</div>
                        <VerdictBadge v={n.verdict} />
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-3">
                        <div><span className="uppercase tracking-wide">Source</span><div className="text-foreground">{n.source ?? "—"}</div></div>
                        <div><span className="uppercase tracking-wide">Checked</span><div className="text-foreground">{n.checkedAt ? formatDateTime(n.checkedAt) : "Not yet checked"}</div></div>
                        <div><span className="uppercase tracking-wide">Notes</span><div className="text-foreground">{n.notes ?? "—"}</div></div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conversation">
              <WhatsAppPanel
                messages={r.conversation}
                handledBy={r.handledBy}
                clientName={r.clientName}
                requestId={r.id}
              />
            </TabsContent>

            <TabsContent value="validation">
              <Card>
                <CardHeader><CardTitle>AI validation report</CardTitle></CardHeader>
                <CardContent>
                  {r.validation.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No validation issues reported.</div>
                  ) : (
                    <ul className="space-y-2">
                      {r.validation.map((v, i) => (
                        <li key={i} className="flex items-start gap-2.5 rounded-sm border border-border p-3">
                          <Badge variant={v.severity === "ERROR" ? "danger" : "outline"}>{v.severity}</Badge>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{v.message}</div>
                            <div className="text-xs text-muted-foreground">Field: <code className="font-mono">{v.field}</code></div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit">
              <Card>
                <CardHeader><CardTitle>Activity timeline</CardTitle></CardHeader>
                <CardContent>
                  <ul className="relative space-y-4">
                    {r.audit.map(a => (
                      <li key={a.id} className="flex gap-3">
                        <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                        <div>
                          <div className="text-sm">{a.action}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(a.at)} · {a.actor}</div>
                          {a.detail && <div className="mt-1 text-xs text-muted-foreground">{a.detail}</div>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Workflow progress</CardTitle>
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {timeAgo(r.lastActivityAt)}</span>
            </CardHeader>
            <CardContent>
              <WorkflowStepper current={r.currentStage} history={r.stageHistory} blocking={r.blockingIssues} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Field label="Assigned admin" value={r.assignedAdmin ?? "Unassigned"} />
              <Field label="Next required action" value={r.nextAction} />
              <Field label="Current stage" value={<StageBadge stage={r.currentStage} />} />
              {role === "SUPERADMIN" && <Button variant="outline" className="mt-2 w-full">Reassign</Button>}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
