import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { MetricCard } from "@/components/metric-card";
import { RequestTable } from "@/components/request-table";
import { Button } from "@/components/ui/button";
import { requestsForUser, USERS } from "@/lib/mock-data";
import { Plus } from "lucide-react";

export default async function SpicePage() {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role as "ADMIN" | "SUPERADMIN";
  const name = session!.user?.name ?? "";
  const requests = requestsForUser(role, name);
  const admins = USERS.filter(u => u.role === "ADMIN" && u.active).map(u => u.name);

  return (
    <>
      <PageHeader
        title="SPICe+ Requests"
        description={role === "SUPERADMIN"
          ? "All incorporation requests across admins and workflow stages."
          : "Requests assigned to you plus any unassigned items you can pick up."}
        actions={<Button><Plus className="h-3.5 w-3.5" /> New request</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Total" value={requests.length} />
        <MetricCard label="Active" value={requests.filter(r => !["REJECTED", "CANCELLED"].includes(r.currentStage)).length} />
        <MetricCard label="Blocked" value={requests.filter(r => r.blockingIssues.length > 0).length} />
        <MetricCard label="Ready for Part A" value={requests.filter(r => r.currentStage === "READY_FOR_PART_A").length} />
      </div>

      <RequestTable requests={requests} admins={admins} />
    </>
  );
}
