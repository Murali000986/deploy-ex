import { NextRequest, NextResponse } from "next/server";
import { requestsForUser } from "@/lib/mock-data";

async function verifyExtToken(req: NextRequest): Promise<{ sub: string; name: string; email: string; role: "ADMIN" | "SUPERADMIN"; exp: number } | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload || payload.iss !== "ledgerly-ext") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Re-verify signature
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return null;

    return payload;
  } catch {
    return null;
  }
}

const VALID_FORM_TYPES = new Set(["spice_a", "inc32", "dir3", "aoc4", "aoc4_offline"]);

const STAGE_FOR_FORM: Record<string, string> = {
  spice_a: "READY_FOR_PART_A",
  inc32: "FORM_READY_INC32",
  dir3: "FORM_READY_DIR3",
  aoc4: "FORM_READY_AOC4",
  aoc4_offline: "FORM_READY_AOC4_OFFLINE",
};

// ClientRequest.formType is stored as the admin's own enum ("SPICE_PART_A", "AOC4", ...);
// the extension queries with its own lowercase form ids. Without this map every
// formType-tagged request would fail the comparison below and never be returned.
const QUERY_TO_STORED_FORM_TYPE: Record<string, string> = {
  spice_a: "SPICE_PART_A",
  inc32: "INC32",
  dir3: "DIR3_KYC",
  aoc4: "AOC4",
  aoc4_offline: "AOC4_OFFLINE",
};

export async function GET(req: NextRequest) {
  const payload = await verifyExtToken(req);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const formType = url.searchParams.get("formType") || "spice_a";
  if (!VALID_FORM_TYPES.has(formType)) {
    return NextResponse.json({ error: `Unknown formType: ${formType}` }, { status: 400 });
  }
  const targetStage = STAGE_FOR_FORM[formType];

  const all = requestsForUser(payload.role, payload.name);
  const wantedStoredFormType = QUERY_TO_STORED_FORM_TYPE[formType];
  const drafts = all
    .filter(r => {
      // Prefer explicit formType match, otherwise fall back to legacy stage match (SPICe+ Part A)
      const anyR = r as unknown as { formType?: string };
      if (anyR.formType) return anyR.formType === wantedStoredFormType;
      return r.currentStage === targetStage;
    })
    .map(r => ({
      id: r.id,
      clientName: r.clientName,
      companyType: r.companyType,
      currentStage: r.currentStage,
      formType: (r as unknown as { formType?: string }).formType ?? "spice_a",
      proposedNames: r.proposedNames,
      submittedFields: r.submittedFields,
      validation: r.validation,
      nextAction: r.nextAction,
    }));

  return NextResponse.json({ drafts, formType });
}
