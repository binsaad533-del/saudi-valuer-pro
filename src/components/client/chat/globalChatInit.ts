import { supabase } from "@/integrations/supabase/client";

export interface GlobalChatInitPayload {
  reply?: string;
  suggestedActions?: { label: string; message: string }[];
}

const initCache = new Map<string, GlobalChatInitPayload>();
const initPromises = new Map<string, Promise<GlobalChatInitPayload>>();

export async function getGlobalChatInit(userId: string): Promise<GlobalChatInitPayload> {
  if (!userId) return {};

  const cached = initCache.get(userId);
  if (cached) return cached;

  const inFlight = initPromises.get(userId);
  if (inFlight) return inFlight;

  const request = supabase.functions
    .invoke("raqeem-client-chat", {
      body: {
        message: "__init_global_chat__",
        is_global_chat: true,
        conversationHistory: [],
        requestContext: { client_user_id: userId },
      },
    })
    .then(({ data, error }) => {
      if (error) throw error;

      const payload: GlobalChatInitPayload = {
        reply: data?.reply,
        suggestedActions: data?.suggestedActions,
      };

      initCache.set(userId, payload);
      return payload;
    })
    .finally(() => {
      initPromises.delete(userId);
    });

  initPromises.set(userId, request);
  return request;
}