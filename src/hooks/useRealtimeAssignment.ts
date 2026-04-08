/**
 * useRealtimeAssignment
 * Subscribes to real-time status changes for a specific assignment.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RealtimePayload {
  new: { id: string; status: string; updated_at: string; [key: string]: unknown };
  old: { id: string; status: string; [key: string]: unknown };
}

export function useRealtimeAssignment(
  assignmentId: string | undefined,
  onStatusChange: (newStatus: string, oldStatus: string) => void
) {
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  useEffect(() => {
    if (!assignmentId) return;

    const channel = supabase
      .channel(`assignment-${assignmentId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "valuation_assignments",
          filter: `id=eq.${assignmentId}`,
        },
        (payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => {
          const p = payload as unknown as RealtimePayload;
          if (p.new.status !== p.old.status) {
            callbackRef.current(p.new.status, p.old.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [assignmentId]);
}
