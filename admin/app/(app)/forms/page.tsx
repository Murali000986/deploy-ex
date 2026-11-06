import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/status-badge";
import { FormCard } from "@/components/form-card";
import { FormIcon } from "@/components/form-icon";
import { FORMS } from "@/lib/forms";
import { formRequestsForUser } from "@/lib/mock-data";
import { Activity, LayoutGrid } from "lucide-react";
import { timeAgo } from "@/lib/utils";

export default async function FormsHubPage() {
  const session = await getServerSession(authOptions);
  const role = (session!.user as any).role as "ADMIN" | "SUPERADMIN";
  const name = session!.user?.name ?? "";

  const perForm = FORMS.map(form => {
    const requests = formRequestsForUser(role, name, form.value);
    const active = requests.filter(r =>
      !["REJECTED", "CANCELLED", "FORM_FILED"].includes(r.currentStage)
    ).length;
    return { form, total: requests.length, active, requests };
  });

  const allRecent = perForm
    .flatMap(({ form, requests }) => requests.map(r => ({ r, form })))
    .sort((a, b) => +new Date(b.r.lastActivityAt) - +new Date(a.r.lastActivityAt))
    .slice(0, 10);

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted">
              <LayoutGrid className="h-4 w-4" />
            </span>
            <span>Forms</span>
          </span>
        }
        description="Choose a form to view requests, prefill client data and launch the extension to file."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {perForm.map(({ form, active, total }) => (
          <FormCard
            key={form.value}
            form={form}
            icon={<FormIcon form={form} className="h-5 w-5" />}
            activeCount={active}
            totalCount={total}
          />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            Recent form activity
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">Last {allRecent.length} updates</span>
        </CardHeader>
        <CardContent className="p-0">
          {allRecent.length === 0 ? (
            <div className="px-6 py-10 text-center text-xs text-muted-foreground">
              No activity yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {allRecent.map(({ r, form }) => (
                <li key={r.id}>
                  <Link
                    href={`/forms/${form.slug}/${r.id}`}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-subtle"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${form.tint}`}>
                      <FormIcon form={form} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.clientName}</span>
                        <span className="text-xs text-muted-foreground">· {r.id}</span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          · {form.shortLabel}
                        </span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        Next: {r.nextAction}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StageBadge stage={r.currentStage} />
                      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
                        {timeAgo(r.lastActivityAt)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
