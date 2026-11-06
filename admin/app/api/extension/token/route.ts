import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Simple JWT signing without an extra dependency.
// Uses NEXTAUTH_SECRET to sign a 15-minute extension token.
async function signExtensionToken(payload: object): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not set");

  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const body = btoa(JSON.stringify(payload))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  return `${header}.${body}.${sigB64}`;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 15; // 15 min
  const payload = {
    sub: (session.user as any).id,
    email: session.user.email,
    name: session.user.name,
    role: (session.user as any).role,
    exp: expiresAt,
    iss: "ledgerly-ext",
  };

  const token = await signExtensionToken(payload);
  return NextResponse.json({ token, expiresAt, user: { name: session.user.name, email: session.user.email, role: (session.user as any).role } });
}
