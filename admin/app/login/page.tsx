"use client";
import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState<{ email?: boolean; password?: boolean }>({});

  const emailError = touched.email && !email.trim() ? "Email is required." : "";
  const passwordError = touched.password && !password ? "Password is required." : "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      if (res.error.includes("ACCOUNT_DISABLED")) setError("Your account is disabled. Contact your Superadmin.");
      else if (res.error === "CredentialsSignin") setError("Incorrect email or password.");
      else setError("Could not sign in. Try again or check your network.");
      return;
    }
    router.replace(params.get("callbackUrl") || "/overview");
    router.refresh();
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-foreground px-10 py-10">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-white text-sidebar text-sm font-bold">L</div>
          <span className="text-sm font-semibold tracking-tight">Ledgerly</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-semibold leading-tight text-white">Operate SPICe+ Part A at scale.</h2>
          <p className="mt-3 text-sm text-sidebar-foreground/70">
            A quiet, focused workspace for Ledgerly admins to triage client requests, run name screening, and move cases toward MCA incorporation.
          </p>
          <ul className="mt-6 space-y-1.5 text-sm text-sidebar-foreground/70">
            <li>— Unified request queue with workflow progress</li>
            <li>— AI validation with human-in-the-loop review</li>
            <li>— WhatsApp conversation and audit trail</li>
          </ul>
        </div>
        <div className="text-[11px] text-sidebar-foreground/50">© Ledgerly. Internal operations tool.</div>
      </aside>

      <main className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-foreground text-background text-sm font-bold">L</div>
            <span className="text-sm font-semibold tracking-tight">Ledgerly</span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your Ledgerly admin account.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@ledgerly.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "email-error" : undefined}
              />
              {emailError && <p id="email-error" className="text-xs text-destructive">{emailError}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setError("Password reset is coordinated by your Superadmin. Reach out to them to reset access.")}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, password: true }))}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "password-error" : undefined}
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordError && <p id="password-error" className="text-xs text-destructive">{passwordError}</p>}
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-border accent-foreground"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
              />
              <span className="text-muted-foreground">Keep me signed in on this device</span>
            </label>

            {error && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign in"}
            </Button>

            <p className="pt-2 text-center text-[11px] text-muted-foreground">
              Trouble signing in? Contact <span className="font-medium text-foreground">ops@ledgerly.in</span>.
            </p>
          </form>

          <details className="mt-6 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Demo credentials</summary>
            <div className="mt-2 space-y-1 font-mono">
              <div>superadmin@ledgerly.in / super123</div>
              <div>priya@ledgerly.in / admin123</div>
              <div>rohan@ledgerly.in / admin123</div>
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}
