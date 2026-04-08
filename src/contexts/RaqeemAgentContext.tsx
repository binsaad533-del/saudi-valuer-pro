/**
 * RaqeemAgentContext — Provides Raqeem's autonomous intelligence across all pages.
 * Maintains persistent context per assignment, streams chat, and delivers proactive insights.
 */
import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
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
  });

  const abortRef = useRef<AbortController | null>(null);

  const setAssignment = useCallback((assignmentId: string, stage?: string) => {
    setState(prev => ({
      ...prev,
      assignmentId,
      stage: stage || null,
      insight: null,
      messages: [],
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
    } catch (e) {
      console.error("Raqeem analyze error:", e);
      setState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [state.assignmentId, state.stage]);

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
      let assistantContent = "";

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
      setState(prev => ({ ...prev, isChatting: false }));
    }
  }, [state.assignmentId, state.stage]);

  const clearContext = useCallback(() => {
    abortRef.current?.abort();
    setState({
      assignmentId: null, stage: null, insight: null,
      isAnalyzing: false, messages: [], isChatting: false, isExpanded: false,
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
