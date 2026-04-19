import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Message = { id: string; role: "user" | "assistant"; content: string };

type Props = {
  selectedTile?: string | null;
  tileStats?: { polygonCount: number; totalAreaHa: number } | null;
  complianceStatus?: string | null;
  riskLevel?: string | null;
  complianceReason?: string | null;
};

export const EmbeddedChat = ({ selectedTile, tileStats, complianceStatus, riskLevel, complianceReason }: Props) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "I'm your EUDR Compliance Analyst. Ask about flagged regions, at-risk commodities, or compliance status.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggested = selectedTile
    ? [`Is tile ${selectedTile} EUDR compliant?`, `What's the deforestation area in ${selectedTile}?`]
    : ["Which regions are flagged?", "Compliance status?"];

  useEffect(() => {
    // Defer to next frame so the new message is in the DOM before scrolling.
    const id = requestAnimationFrame(() => {
      // Scroll within the Radix ScrollArea viewport (not the page).
      const viewport = scrollRef.current?.closest(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement | null;
      if (viewport) {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      } else {
        bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [messages, loading]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;

    setMessages((p) => [...p, { id: crypto.randomUUID(), role: "user", content: t }]);
    setInput("");
    setLoading(true);

    // Inject currently-selected tile context so Cognee can answer specifically
    const contextualQuery = selectedTile
      ? `[Context: User is viewing tile ${selectedTile} which has ${tileStats?.polygonCount ?? "?"} deforestation detection(s) covering ${tileStats?.totalAreaHa?.toFixed(1) ?? "?"} ha. EUDR compliance status: ${complianceStatus ?? "UNKNOWN"}. Risk level: ${riskLevel ?? "UNKNOWN"}. ${complianceReason ?? ""}] Question: ${t}`
      : t;

    let reply = "";
    try {
      const { data, error } = await supabase.functions.invoke("cognee-ask", {
        body: { question: contextualQuery },
      });
      if (error) throw error;
      reply = data?.answer || "No answer found.";
      // If the edge function returned raw Cognee JSON, extract search_result
      try {
        const parsed = JSON.parse(reply);
        if (parsed?.search_result) {
          const sr = parsed.search_result;
          reply = Array.isArray(sr) ? sr.join("\n\n") : String(sr);
        }
      } catch {
        // reply is already a plain string
      }
    } catch (err) {
      console.error("Cognee error:", err);
      reply = "Unable to reach compliance analyst. Please try again.";
    } finally {
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: reply }]);
      setLoading(false);
    }
  };

  return (
    <Card className="flex h-[520px] flex-col overflow-hidden">
      <CardHeader className="border-b bg-primary py-3 text-primary-foreground">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/15">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          EUDR Compliance Analyst
          {selectedTile && (
            <span className="ml-auto rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] font-normal">
              {selectedTile}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-0">
        <ScrollArea className="min-h-0 flex-1 bg-secondary/30">
          <div ref={scrollRef} className="space-y-3 p-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] overflow-hidden whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-xs leading-relaxed [overflow-wrap:anywhere]",
                    m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-card text-card-foreground",
                  )}
                >
                  {m.content
                    .split("**")
                    .map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground">
                  Analysing…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
        <div className="border-t bg-card px-3 pt-2.5">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Suggested</p>
          <div className="flex flex-wrap gap-1.5">
            {suggested.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-primary/30 bg-secondary px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 border-t bg-card p-2.5"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about compliance..."
            className="h-9 flex-1 text-xs"
          />
          <Button type="submit" size="icon" className="h-9 w-9" aria-label="Send" disabled={loading}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
