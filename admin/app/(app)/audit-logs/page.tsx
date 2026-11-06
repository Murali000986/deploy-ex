import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { REQUESTS } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/utils";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if ((session!.user as any).role !== "SUPERADMIN") redirect("/overview");

  const events = REQUESTS.flatMap(r => r.audit.map(a => ({ ...a, requestId: r.id })))
    .sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <>
      <PageHeader title="Audit Logs" description="Immutable record of workflow actions across all requests." />
      <Card>
        <CardHeader><CardTitle>Recent events ({events.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>When</TH><TH>Request</TH><TH>Actor</TH><TH>Action</TH><TH>Detail</TH></TR>
            </THead>
            <TBody>
              {events.map(e => (
                <TR key={e.requestId + e.id}>
                  <TD className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(e.at)}</TD>
                  <TD className="font-mono text-xs">{e.requestId}</TD>
                  <TD className="text-sm">{e.actor}</TD>
                  <TD className="text-sm">{e.action}</TD>
                  <TD className="text-xs text-muted-foreground">{e.detail ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
