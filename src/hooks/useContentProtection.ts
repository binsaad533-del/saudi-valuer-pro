/**
 * Content Protection Hook
 * Disables copy, cut, paste, right-click, print, text selection on sensitive pages.
 * Logs all attempts to audit_logs via Supabase.
 */
import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type ProtectionEvent = "copy" | "cut" | "paste" | "print" | "right_click" | "select" | "screenshot_attempt";

async function logProtectionEvent(eventType: ProtectionEvent, details?: Record<string, any>) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name_ar")
      .eq("user_id", user.id)
      .maybeSingle();

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "view" as any,
      table_name: "content_protection",
      entity_type: "setting",
      description: `محاولة ${eventType} مرفوضة`,
      new_data: {
        event_type: eventType,
        url: window.location.pathname,
        timestamp: new Date().toISOString(),
        user_agent: navigator.userAgent,
        ...details,
      },
      user_name: profile?.full_name_ar || user.email || "مستخدم",
      user_role: "unknown",
    } as any);
  } catch {
    // Silent fail - don't break UX for logging
  }
}

export function useContentProtection(enabled = true) {
  const handleCopy = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    e.preventDefault();
    logProtectionEvent("copy");
  }, [enabled]);

  const handleCut = useCallback((e: ClipboardEvent) => {
    if (!enabled) return;
    e.preventDefault();
    logProtectionEvent("cut");
  }, [enabled]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    // Allow paste in input/textarea elements
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
    if (!enabled) return;
    e.preventDefault();
    logProtectionEvent("paste");
  }, [enabled]);

  const handleContextMenu = useCallback((e: MouseEvent) => {
    if (!enabled) return;
    e.preventDefault();
    logProtectionEvent("right_click");
  }, [enabled]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    // Block Ctrl+P (print), Ctrl+S (save), Ctrl+Shift+I (devtools)
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      logProtectionEvent("print");
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
    }
    // Block PrintScreen
    if (e.key === "PrintScreen") {
      e.preventDefault();
      logProtectionEvent("screenshot_attempt");
    }
  }, [enabled]);

  const handleBeforePrint = useCallback(() => {
    if (!enabled) return;
    logProtectionEvent("print");
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("beforeprint", handleBeforePrint);

    // Add CSS to prevent selection on sensitive content
    const style = document.createElement("style");
    style.id = "content-protection-style";
    style.textContent = `
      .protected-content {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      .protected-content input,
      .protected-content textarea,
      .protected-content [contenteditable="true"] {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        user-select: text !important;
      }
      @media print {
        .protected-content {
          display: none !important;
        }
        body::after {
          content: "طباعة المحتوى المحمي غير مسموحة — Protected content cannot be printed";
          display: block;
          font-size: 24px;
          text-align: center;
          padding: 100px 20px;
          color: #c00;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("beforeprint", handleBeforePrint);
      const el = document.getElementById("content-protection-style");
      if (el) el.remove();
    };
  }, [enabled, handleCopy, handleCut, handlePaste, handleContextMenu, handleKeyDown, handleBeforePrint]);
}
