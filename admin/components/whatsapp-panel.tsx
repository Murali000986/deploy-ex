"use client";
import * as React from "react";
import { Send, UserCog, Bot, CheckCheck, Check, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import type { WhatsAppMessage } from "@/lib/types";

function Receipt({ s }: { s?: WhatsAppMessage["deliveryState"] }) {
  if (!s) return null;
  const map: Record<NonNullable<WhatsAppMessage["deliveryState"]>, { icon: React.ReactNode; label: string }> = {
    PENDING: { icon: <Clock className="h-3 w-3" />, label: "Pending" },
    SENT: { icon: <Check className="h-3 w-3" />, label: "Sent" },
    DELIVERED: { icon: <CheckCheck className="h-3 w-3" />, label: "Delivered" },
    READ: { icon: <CheckCheck className="h-3 w-3" />, label: "Read" },
    FAILED: { icon: <AlertCircle className="h-3 w-3" />, label: "Failed" },
  };
  const { icon, label } = map[s];
  return <span className="inline-flex items-center gap-0.5" aria-label={`Delivery: ${label}`}>{icon}<span className="sr-only">{label}</span></span>;
}

export function WhatsAppPanel({
  messages, handledBy, clientName, requestId,
}: { messages: WhatsAppMessage[]; handledBy: "AI" | "HUMAN"; clientName: string; requestId: string }) {
  const [reply, setReply] = React.useState("");
  const [mode, setMode] = React.useState<"AI" | "HUMAN">(handledBy);
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages.length]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    // In a real integration this would call the backend. Here we just clear.
    setReply("");
  }

  return (
    <div className="flex h-[640px] flex-col rounded-md border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-sm font-semibold">{clientName}</div>
          <div className="text-xs text-muted-foreground">WhatsApp conversation · {requestId}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{messages.length} messages</Badge>
          <div className="inline-flex rounded-sm border border-border p-0.5 text-xs">
            <button
              onClick={() => setMode("AI")}
              className={cn("flex items-center gap-1 rounded-sm px-2 py-1", mode === "AI" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              <Bot className="h-3 w-3" /> AI
            </button>
            <button
              onClick={() => setMode("HUMAN")}
              className={cn("flex items-center gap-1 rounded-sm px-2 py-1", mode === "HUMAN" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
            >
              <UserCog className="h-3 w-3" /> Human
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin bg-subtle px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <div className="text-sm font-medium">No conversation yet</div>
            <div className="text-xs text-muted-foreground">Messages will appear here once the client replies.</div>
          </div>
        ) : (
          <ul className="space-y-2">
            {messages.map(m => (
              <li key={m.id} className={cn("flex", m.direction === "OUT" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[78%] rounded-md px-3 py-2 text-sm",
                  m.direction === "OUT" ? "bg-foreground text-background" : "border border-border bg-background"
                )}>
                  <div className={cn("mb-1 flex items-center gap-1.5 text-[10px]", m.direction === "OUT" ? "text-background/70" : "text-muted-foreground")}>
                    <span className="font-medium">{m.author}</span>
                    {m.by === "AI" && <span className="inline-flex items-center gap-0.5"><Bot className="h-2.5 w-2.5" /> AI</span>}
                    <span>· {formatDateTime(m.at)}</span>
                  </div>
                  <div className="whitespace-pre-wrap">{m.text}</div>
                  {m.direction === "OUT" && (
                    <div className={cn("mt-1 flex items-center justify-end gap-1 text-[10px]", m.deliveryState === "FAILED" ? "text-destructive" : "text-background/70")}>
                      <Receipt s={m.deliveryState} />
                      <span>{m.deliveryState?.toLowerCase()}</span>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Input
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder={mode === "AI" ? "AI is handling this conversation" : "Type a reply to the client…"}
            disabled={mode === "AI"}
          />
          <Button type="submit" disabled={mode === "AI" || !reply.trim()}>
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
        </div>
        <div className="mt-1.5 text-[11px] text-muted-foreground">
          {mode === "AI"
            ? "Switch to Human to take over the conversation. Resume AI handling once resolved."
            : "Human handoff is active. Messages will be sent from your admin identity."}
        </div>
      </form>
    </div>
  );
}
