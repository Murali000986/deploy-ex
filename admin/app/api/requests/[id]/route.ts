import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { findRequest, requestsForUser, updateRequestFields } from "@/lib/mock-data";
import type { ClientRequest } from "@/lib/types";

// Fields a plain PATCH from the admin UI may touch — never id/audit/stageHistory directly.
const EDITABLE_FIELDS = [
  "clientName", "clientPhone", "clientEmail", "companyType",
  "proposedNames", "submittedFields", "currentStage", "nextAction", "assignedAdmin",
] as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role as "ADMIN" | "SUPERADMIN";
  const name = session.user?.name ?? "";

  const request = findRequest(params.id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!requestsForUser(role, name).find(r => r.id === params.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ request });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role as "ADMIN" | "SUPERADMIN";
  const name = session.user?.name ?? "";

  if (!requestsForUser(role, name).find(r => r.id === params.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<ClientRequest> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) (patch as any)[key] = body[key];
  }

  const updated = updateRequestFields(params.id, patch);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ request: updated });
}
