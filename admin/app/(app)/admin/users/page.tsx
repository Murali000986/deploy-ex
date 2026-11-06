import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { USERS } from "@/lib/mock-data";
import { timeAgo } from "@/lib/utils";
import { Plus } from "lucide-react";

export default async function Page() {
  const session = await getServerSession(authOptions);
  if ((session!.user as any).role !== "SUPERADMIN") redirect("/overview");

  return (
    <>
      <PageHeader
        title="Admin Users"
        description="Manage who can access the Ledgerly workspace and what they can do."
        actions={<Button><Plus className="h-3.5 w-3.5" /> Invite admin</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR><TH>Name</TH><TH>Email</TH><TH>Role</TH><TH>Status</TH><TH>Last login</TH><TH className="text-right">Actions</TH></TR>
            </THead>
            <TBody>
              {USERS.map(u => (
                <TR key={u.id}>
                  <TD className="text-sm font-medium">{u.name}</TD>
                  <TD className="text-sm">{u.email}</TD>
                  <TD><Badge variant={u.role === "SUPERADMIN" ? "solid" : "outline"}>{u.role === "SUPERADMIN" ? "Superadmin" : "Admin"}</Badge></TD>
                  <TD>
                    {u.active
                      ? <Badge variant="outline">Active</Badge>
                      : <Badge variant="danger">Disabled</Badge>}
                  </TD>
                  <TD className="text-xs text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "Never"}</TD>
                  <TD className="text-right">
                    <Button variant="ghost" size="sm">{u.active ? "Deactivate" : "Reactivate"}</Button>
                    <Button variant="ghost" size="sm">Reassign requests</Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
