"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NewSpiceRequestPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    companyType: "PRIVATE_LIMITED",
    proposedName1: "",
    proposedName2: "",
    proposedName3: "",
    nicCode: "",
    businessActivity: "",
    trademarkNumber: "",
    llpin: "",
    cin: "",
    language: "",
    requestType: "",
    comments: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: form.clientName,
          clientPhone: form.clientPhone,
          clientEmail: form.clientEmail || undefined,
          companyType: form.companyType,
          proposedNames: [form.proposedName1, form.proposedName2, form.proposedName3],
          nicCode: form.nicCode,
          businessActivity: form.businessActivity,
          trademarkNumber: form.trademarkNumber,
          llpin: form.llpin,
          cin: form.cin,
          language: form.language,
          requestType: form.requestType,
          comments: form.comments,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Could not create request");
        setSubmitting(false);
        return;
      }
      router.push(`/spice/${data.request.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <>
      <Link href="/spice" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to requests
      </Link>
      <PageHeader
        title="New SPICe+ Part A request"
        description="Enter the client's details. This is created directly in Ready for Part A, so it's immediately pullable from the Chrome extension."
      />

      <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
        <Card>
          <CardHeader><CardTitle>Client</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Client name" required>
              <Input value={form.clientName} onChange={e => set("clientName", e.target.value)} required />
            </Field>
            <Field label="Client phone" required>
              <Input value={form.clientPhone} onChange={e => set("clientPhone", e.target.value)} placeholder="+91 ..." required />
            </Field>
            <Field label="Client email">
              <Input type="email" value={form.clientEmail} onChange={e => set("clientEmail", e.target.value)} />
            </Field>
            <Field label="Company type" required>
              <Select value={form.companyType} onChange={e => set("companyType", e.target.value)}>
                <option value="PRIVATE_LIMITED">Private Limited</option>
                <option value="OPC">One Person Company</option>
                <option value="LLP">LLP</option>
                <option value="PUBLIC_LIMITED">Public Limited</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Proposed names</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Name 1" required>
              <Input value={form.proposedName1} onChange={e => set("proposedName1", e.target.value)} required />
            </Field>
            <Field label="Name 2">
              <Input value={form.proposedName2} onChange={e => set("proposedName2", e.target.value)} />
            </Field>
            <Field label="Name 3">
              <Input value={form.proposedName3} onChange={e => set("proposedName3", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>SPICe+ Part A fields</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="NIC code">
              <Input value={form.nicCode} onChange={e => set("nicCode", e.target.value)} placeholder="e.g. 6201" />
            </Field>
            <Field label="Business activity">
              <Input value={form.businessActivity} onChange={e => set("businessActivity", e.target.value)} />
            </Field>
            <Field label="Trademark number">
              <Input value={form.trademarkNumber} onChange={e => set("trademarkNumber", e.target.value)} />
            </Field>
            <Field label="LLPIN (if converting an LLP)">
              <Input value={form.llpin} onChange={e => set("llpin", e.target.value)} />
            </Field>
            <Field label="CIN (if applicable)">
              <Input value={form.cin} onChange={e => set("cin", e.target.value)} />
            </Field>
            <Field label="Language">
              <Input value={form.language} onChange={e => set("language", e.target.value)} />
            </Field>
            <Field label="Request type">
              <Input value={form.requestType} onChange={e => set("requestType", e.target.value)} />
            </Field>
            <Field label="Comments">
              <Input value={form.comments} onChange={e => set("comments", e.target.value)} />
            </Field>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create request"}</Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/spice">Cancel</Link>
          </Button>
        </div>
      </form>
    </>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
