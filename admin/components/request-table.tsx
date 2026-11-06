"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Filter, SlidersHorizontal } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StageBadge, VerdictBadge } from "@/components/status-badge";
import { CompactProgress } from "@/components/workflow-stepper";
import { timeAgo } from "@/lib/utils";
import { STAGE_LABEL, type ClientRequest, type WorkflowStage } from "@/lib/types";

export function RequestTable({
  requests, admins, initialStage,
}: {
  requests: ClientRequest[];
  admins: string[];
  initialStage?: WorkflowStage;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [stage, setStage] = React.useState<string>(initialStage ?? params.get("stage") ?? "");
  const [admin, setAdmin] = React.useState<string>(params.get("admin") ?? "");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 10;

  const debouncedQ = useDebounce(q, 200);

  const filtered = React.useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    return requests.filter(r => {
      if (stage && r.currentStage !== stage) return false;
      if (admin && r.assignedAdmin !== admin) return false;
      if (!term) return true;
      return (
        r.id.toLowerCase().includes(term) ||
        r.clientName.toLowerCase().includes(term) ||
        r.proposedNames.some(n => n.name.toLowerCase().includes(term))
      );
    });
  }, [requests, debouncedQ, stage, admin]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function clearFilters() { setQ(""); setStage(initialStage ?? ""); setAdmin(""); setPage(1); router.replace(window.location.pathname); }
  const hasFilters = !!(q || (stage && stage !== initialStage) || admin);

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex flex-col gap-2 border-b border-border p-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="Search ID, client or proposed name"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex items-center gap-2 md:ml-auto">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {!initialStage && (
            <Select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }} className="h-9 w-44">
              <option value="">All stages</option>
              {(Object.keys(STAGE_LABEL) as WorkflowStage[]).map(s => (
                <option key={s} value={s}>{STAGE_LABEL[s]}</option>
              ))}
            </Select>
          )}
          <Select value={admin} onChange={e => { setAdmin(e.target.value); setPage(1); }} className="h-9 w-44">
            <option value="">All admins</option>
            {admins.map(a => <option key={a} value={a}>{a}</option>)}
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <div className="text-sm font-medium">No requests match these filters.</div>
          <div className="text-xs text-muted-foreground">Try broadening the search or clearing filters.</div>
          {hasFilters && <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>Clear filters</Button>}
        </div>
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Request ID</TH>
                <TH>Client / Company</TH>
                <TH>Proposed name</TH>
                <TH>Stage</TH>
                <TH>Screening</TH>
                <TH>Assigned</TH>
                <TH>Last activity</TH>
                <TH>Next action</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map(r => {
                const primary = r.proposedNames[0];
                return (
                  <TR key={r.id} className="cursor-pointer" onClick={() => router.push(`/spice/${r.id}`)}>
                    <TD className="font-mono text-xs">
                      <Link href={`/spice/${r.id}`} className="hover:underline">{r.id}</Link>
                    </TD>
                    <TD>
                      <div className="text-sm font-medium">{r.clientName}</div>
                      <div className="text-xs text-muted-foreground">{r.clientPhone}</div>
                    </TD>
                    <TD>
                      <div className="text-sm">{primary?.name ?? "—"}</div>
                      <CompactProgress stage={r.currentStage} />
                    </TD>
                    <TD><StageBadge stage={r.currentStage} /></TD>
                    <TD>{primary ? <VerdictBadge v={primary.verdict} /> : <span className="text-xs text-muted-foreground">—</span>}</TD>
                    <TD className="text-sm">{r.assignedAdmin ?? <span className="text-xs text-muted-foreground">Unassigned</span>}</TD>
                    <TD className="text-xs text-muted-foreground">{timeAgo(r.lastActivityAt)}</TD>
                    <TD className="text-xs">{r.nextAction}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <div className="text-xs text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="px-2 text-xs tabular-nums">{safePage} / {pageCount}</span>
              <Button variant="outline" size="sm" disabled={safePage >= pageCount} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function useDebounce<T>(value: T, delay: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const h = setTimeout(() => setV(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return v;
}
