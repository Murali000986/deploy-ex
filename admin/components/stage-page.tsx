import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { RequestTable } from "@/components/request-table";
import { requestsForUser, USERS } from "@/lib/mock-data";
import type { WorkflowStage } from "@/lib/types";

export async function StagePage({
  title, description, stage, extra = [],
}: {
  title: string;
  description: string;
  stage: WorkflowStage;
  extra?: WorkflowStage[];
}) {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role as "ADMIN" | "SUPERADMIN";
  const name = session!.user?.name ?? "";
  const all = requestsForUser(role, name);
  const stages = new Set([stage, ...extra]);
  const filtered = all.filter(r => stages.has(r.currentStage));
  const admins = USERS.filter(u => u.role === "ADMIN" && u.active).map(u => u.name);

  return (
    <>
      <PageHeader title={title} description={description} />
      <RequestTable requests={filtered} admins={admins} initialStage={stage} />
    </>
  );
}
