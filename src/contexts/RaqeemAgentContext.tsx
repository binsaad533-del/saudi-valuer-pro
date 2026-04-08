/**
 * RaqeemAgentContext — Provides Raqeem's autonomous intelligence across all pages.
 * Maintains persistent context per assignment via raqeem_agent_context table,
 * streams chat, and delivers proactive insights.
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RaqeemInsight {
  summary: string;
  observations: string[];
  next_action: string;
  risk_flags: string[];
  confidence: number;
}

interface RaqeemMessage {
  role: "user" | "assistant";
  content: string;
}

interface RaqeemAgentState {
  assignmentId: string | null;
  stage: string | null;
  insight: RaqeemInsight | null;
  isAnalyzing: boolean;
  messages: RaqeemMessage[];
  isChatting: boolean;
  isExpanded: boolean;
  memoryLoaded: boolean;
}

interface RaqeemAgentContextType extends RaqeemAgentState {
  setAssignment: (assignmentId: string, stage?: string) => void;
  analyze: (pageContext?: string) => Promise<void>;
  chat: (message: string, pageContext?: string) => Promise<void>;
  clearContext: () => void;
  toggleExpanded: () => void;
}

const RaqeemAgentContext = createContext<RaqeemAgentContextType | null>(null);

const AGENT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/raqeem-agent`;

export function RaqeemAgentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RaqeemAgentState>({
    assignmentId: null,
    stage: null,
    insight: null,
    isAnalyzing: false,
    messages: [],
    isChatting: false,
    isExpanded: false,
    memoryLoaded: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  // ── Load persistent memory when assignment changes ──
  useEffect(() => {
    if (!state.assignmentId || state.memoryLoaded) return;

    const loadMemory = async () => {
      try {
        const { data } = await supabase
          .from("raqeem_agent_context" as any)
          .select("*")
          .eq("assignment_id", state.assignmentId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const ctx = data as any;
          const restoredInsight: RaqeemInsight | null = ctx.observations ? {
            summary: ctx.summary || "",
            observations: Array.isArray(ctx.observations) ? ctx.observations : [],
            next_action: ctx.next_action || "",
            risk_flags: Array.isArray(ctx.risk_flags) ? ctx.risk_flags : [],
            confidence: ctx.confidence_score || 0,
          } : null;

          const restoredMessages: RaqeemMessage[] = [];
          if (ctx.chat_history && Array.isArray(ctx.chat_history)) {
            for (const msg of ctx.chat_history) {
              if (msg.role && msg.content) {
                restoredMessages.push({ role: msg.role, content: msg.content });
              }
            }
          }

          setState(prev => ({
            ...prev,
            stage: ctx.stage || prev.stage,
            insight: restoredInsight || prev.insight,
            messages: restoredMessages.length > 0 ? restoredMessages : prev.messages,
            memoryLoaded: true,
          }));
        } else {
          setState(prev => ({ ...prev, memoryLoaded: true }));
        }
      } catch (e) {
        console.error("Raqeem memory load error:", e);
        setState(prev => ({ ...prev, memoryLoaded: true }));
      }
    };

    loadMemory();
  }, [state.assignmentId, state.memoryLoaded]);

  // ── Persist memory after insight or messages change ──
  const persistMemory = useCallback(async (
    assignmentId: string,
    stage: string | null,
    insight: RaqeemInsight | null,
    messages: RaqeemMessage[]
  ) => {
    try {
      await supabase.from("raqeem_agent_context" as any).upsert({
        assignment_id: assignmentId,
        stage: stage || "intake",
        summary: insight?.summary || null,
        observations: insight?.observations || [],
        next_action: insight?.next_action || null,
        risk_flags: insight?.risk_flags || [],
        confidence_score: insight?.confidence || null,
        chat_history: messages.slice(-50).map(m => ({ role: m.role, content: m.content })),
        updated_at: new Date().toISOString(),
      } as any, { onConflict: "assignment_id" as any });
    } catch (e) {
      console.error("Raqeem memory persist error:", e);
    }
  }, []);

  const setAssignment = useCallback((assignmentId: string, stage?: string) => {
    setState(prev => ({
      ...prev,
      assignmentId,
      stage: stage || null,
      insight: null,
      messages: [],
      memoryLoaded: false, // triggers reload from DB
    }));
  }, []);

  const analyze = useCallback(async (pageContext?: string) => {
    if (!state.assignmentId) return;
    setState(prev => ({ ...prev, isAnalyzing: true }));

    try {
      const resp = await fetch(AGENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          mode: "analyze",
          assignment_id: state.assignmentId,
          stage: state.stage,
          page_context: pageContext,
        }),
      });

      if (!resp.ok) {
        console.error("Raqeem analyze error:", resp.status);
        return;
      }

      const insight = await resp.json();
      setState(prev => ({ ...prev, insight, isAnalyzing: false }));

      // Persist to DB
      await persistMemory(state.assignmentId!, state.stage, insight, state.messages);
    } catch (e) {
      console.error("Raqeem analyze error:", e);
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [state.assignmentId, state.stage, state.messages, persistMemory]);

  const chat = useCallback(async (message: string, pageContext?: string) => {
    if (!state.assignmentId) return;

    const userMsg: RaqeemMessage = { role: "user", content: message };
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      isChatting: true,
    }));

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    let assistantContent = "";

    try {
      const resp = await fetch(AGENT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          mode: "chat",
          assignment_id: state.assignmentId,
          stage: state.stage,
          message,
          page_context: pageContext,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setState(prev => {
                const msgs = [...prev.messages];
                const last = msgs[msgs.length - 1];
                if (last?.role === "assistant") {
                  msgs[msgs.length - 1] = { ...last, content: assistantContent };
                } else {
                  msgs.push({ role: "assistant", content: assistantContent });
                }
                return { ...prev, messages: msgs };
              });
            }
          } catch { /* partial JSON */ }
        }
      }
    } catch (e) {
      if ((e as any)?.name !== "AbortError") {
        console.error("Raqeem chat error:", e);
      }
    } finally {
      setState(prev => {
        const finalMessages = prev.messages;
        // Persist conversation to DB
        persistMemory(state.assignmentId!, state.stage, prev.insight, finalMessages);
        return { ...prev, isChatting: false };
      });
    }
  }, [state.assignmentId, state.stage, persistMemory]);

  const clearContext = useCallback(() => {
    abortRef.current?.abort();
    setState({
      assignmentId: null, stage: null, insight: null,
      isAnalyzing: false, messages: [], isChatting: false, isExpanded: false, memoryLoaded: false,
    });
  }, []);

  const toggleExpanded = useCallback(() => {
    setState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
  }, []);

  return (
    <RaqeemAgentContext.Provider value={{ ...state, setAssignment, analyze, chat, clearContext, toggleExpanded }}>
      {children}
    </RaqeemAgentContext.Provider>
  );
}

export function useRaqeemAgent() {
  const ctx = useContext(RaqeemAgentContext);
  if (!ctx) throw new Error("useRaqeemAgent must be used within RaqeemAgentProvider");
  return ctx;
}
