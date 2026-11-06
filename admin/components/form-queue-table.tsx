"use client";
import * as React from "react";
import Link from "next/link";
import { Search, X, Filter, SlidersHorizontal, Rocket, Download } from "lucide-react";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/status-badge";
import { CompactProgress } from "@/components/workflow-stepper";
import type { ClientRequest, WorkflowStage } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/types";
import type { FormDescriptor } from "@/lib/forms";
import { timeAgo } from "@/lib/utils";
import { loadIntoExtension } from "@/lib/extension-bridge";

/**
 * Request table scoped to one form workflow. Compared to RequestTable this
 * table surfaces form-specific columns (CIN, financial year) and a direct
 * "Load in Extension" action per row.
 */
export function FormQueueTable({
  form,
  requests,
  admins,
}: {
  form: FormDescriptor;
  requests: ClientRequest[];
  admins: string[];
}) {
  const [q, setQ] = React.useState("");
  const [stage, setStage] = React.useState<string>("");
  const [admin, setAdmin] = React.useState<string>("");
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 10;

  const debouncedQ = useDebounce(q, 200);

  const stageOptions = React.useMemo(() => {
    const stages = new Set<WorkflowStage>();
    requests.forEach(r => stages.add(r.currentStage));
    return Array.from(stages);
  }, [requests]);

  const filtered = React.useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    return requests.filter(r => {
      if (stage && r.currentStage !== stage) return false;
      if (admin && r.assignedAdmin !== admin) return false;
      if (!term) return true;
      return (
        r.id.toLowerCase().includes(term) ||
        r.clientName.toLowerCase().includes(term) ||
        (r.cin ?? "").toLowerCase().includes(term)
      );
    });
  }, [requests, debouncedQ, stage, admin]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function clearFilters() {
    setQ(""); setStage(""); setAdmin(""); setPage(1);
  }
  const hasFilters = !!(q || stage || admin);

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex flex-col gap-2 border-b border-border p-3 md:flex-row md:items-center">
        <div className="relative md:w-80">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            placeholder="Search company, CIN or request ID"
            className="h-9 pl-8"
          />
        </div>
        <div className="flex items-center gap-2 md:ml-auto">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          <Select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }} className="h-9 w-44">
            <option value="">All stages</option>
            {stageOptions.map(s => (
              <option key={s} value={s}>{STAGE_LABEL[s]}</option>
            ))}
          </Select>
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
          <div className="text-sm font-medium">No {form.shortLabel} requests match.</div>
          <div className="text-xs text-muted-foreground">Try broadening the search or clearing filters.</div>
          {hasFilters && <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>Clear filters</Button>}
        </div>
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Request</TH>
                <TH>Client / Company</TH>
                <TH>CIN</TH>
                <TH>FY</TH>
                <TH>Stage</TH>
                <TH>Assigned</TH>
                <TH>Last activity</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map(r => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs">{r.id}</TD>
                  <TD>
                    <div className="text-sm font-medium">{r.clientName}</div>
                    <div className="text-xs text-muted-foreground">{r.clientPhone}</div>
                  </TD>
                  <TD className="text-xs font-mono">{r.cin || <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="text-xs">{r.financialYear || <span className="text-muted-foreground">—</span>}</TD>
                  <TD>
                    <div className="flex flex-col gap-1">
                      <StageBadge stage={r.currentStage} />
                      <CompactProgress stage={r.currentStage} order={form.stageOrder} />
                    </div>
                  </TD>
                  <TD className="text-sm">
                    {r.assignedAdmin ?? <span className="text-xs text-muted-foreground">Unassigned</span>}
                  </TD>
                  <TD className="text-xs text-muted-foreground">{timeAgo(r.lastActivityAt)}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        title="Load this request into the browser extension and prefill the form"
                        onClick={() => loadIntoExtension(form, r)}
                      >
                        <Rocket className="h-3.5 w-3.5" /> Load &amp; Fill
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/forms/${form.slug}/${r.id}`}>View</Link>
                      </Button>
                    </div>
                  </TD>
                </TR>
              ))}
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
