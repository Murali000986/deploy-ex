import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requestsForUser, createSpiceRequest, type CreateSpiceRequestInput } from "@/lib/mock-data";

const VALID_COMPANY_TYPES = new Set(["PRIVATE_LIMITED", "OPC", "LLP", "PUBLIC_LIMITED"]);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as any).role as "ADMIN" | "SUPERADMIN";
  const name = session.user?.name ?? "";
  return NextResponse.json({ requests: requestsForUser(role, name) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<CreateSpiceRequestInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.clientName?.trim()) return NextResponse.json({ error: "clientName is required" }, { status: 400 });
  if (!body.clientPhone?.trim()) return NextResponse.json({ error: "clientPhone is required" }, { status: 400 });
  if (!body.companyType || !VALID_COMPANY_TYPES.has(body.companyType)) {
    return NextResponse.json({ error: "companyType must be one of PRIVATE_LIMITED, OPC, LLP, PUBLIC_LIMITED" }, { status: 400 });
  }
  const proposedNames = (body.proposedNames ?? []).filter(n => n?.trim());
  if (proposedNames.length === 0) {
    return NextResponse.json({ error: "At least one proposed name is required" }, { status: 400 });
  }

  const record = createSpiceRequest({
    clientName: body.clientName.trim(),
    clientPhone: body.clientPhone.trim(),
    clientEmail: body.clientEmail?.trim() || undefined,
    companyType: body.companyType,
    proposedNames,
    nicCode: body.nicCode?.trim(),
    businessActivity: body.businessActivity?.trim(),
    trademarkNumber: body.trademarkNumber?.trim(),
    llpin: body.llpin?.trim(),
    cin: body.cin?.trim(),
    language: body.language?.trim(),
    requestType: body.requestType?.trim(),
    comments: body.comments?.trim(),
    assignedAdmin: session.user?.name ?? undefined,
  });

  return NextResponse.json({ request: record }, { status: 201 });
}
