import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function Page() {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role as "ADMIN" | "SUPERADMIN";

  return (
    <>
      <PageHeader title="Settings" description="Account preferences and workspace configuration." />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Name" value={session?.user?.name ?? "—"} />
            <Row label="Email" value={session?.user?.email ?? "—"} />
            <Row label="Role" value={role === "SUPERADMIN" ? "Superadmin" : "Admin"} />
          </CardContent>
        </Card>

        {role === "SUPERADMIN" ? (
          <Card>
            <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <IntegrationRow name="MCA Master Data" status="green" lastSync="2 min ago" />
              <IntegrationRow name="WhatsApp Business API" status="green" lastSync="live" />
              <IntegrationRow name="IP India Trademark Search" status="yellow" lastSync="12 min ago" />
              <IntegrationRow name="OCR / KYC vendor" status="green" lastSync="just now" />
              <Button variant="outline" size="sm">Manage credentials</Button>
              <p className="text-xs text-muted-foreground">Credentials are stored server-side. They are never returned to the browser.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle>Workspace</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              Integration and user management are available to Superadmins only.
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function IntegrationRow({ name, status, lastSync }: { name: string; status: "green" | "yellow" | "red"; lastSync: string }) {
  const dot = status === "green" ? "bg-foreground" : status === "yellow" ? "bg-foreground/40" : "bg-destructive";
  return (
    <div className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span>{name}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{lastSync}</span>
        <Badge variant="outline">{status === "green" ? "Healthy" : status === "yellow" ? "Degraded" : "Down"}</Badge>
      </div>
    </div>
  );
}
