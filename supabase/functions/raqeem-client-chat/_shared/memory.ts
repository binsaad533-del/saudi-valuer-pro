import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ClientMemory {
  preferred_property_types: string[];
  preferred_cities: string[];
  communication_style: string;
  total_requests: number;
  completed_requests: number;
  topics_of_interest: string[];
  last_interaction_summary: string | null;
  ai_notes: string | null;
  frequent_questions: string[];
}

export async function loadClientMemory(db: SupabaseClient, userId: string): Promise<ClientMemory | null> {
  const { data } = await db
    .from("raqeem_client_memory")
    .select("*")
    .eq("client_user_id", userId)
    .maybeSingle();
  return data;
}

export async function updateClientMemory(
  db: SupabaseClient,
  userId: string,
  message: string,
  requestContext: Record<string, any>
) {
  const existing = await loadClientMemory(db, userId);

  // Extract patterns from message and context
  const newCity = requestContext?.property_city || null;
  const newType = requestContext?.property_type || null;
  const question = message.length > 10 ? message.substring(0, 100) : null;

  if (!existing) {
    // Create new memory
    await db.from("raqeem_client_memory").insert({
      client_user_id: userId,
      preferred_property_types: newType ? [newType] : [],
      preferred_cities: newCity ? [newCity] : [],
      total_requests: 1,
      topics_of_interest: [],
      frequent_questions: question ? [question] : [],
      last_interaction_summary: `آخر سؤال: ${message.substring(0, 150)}`,
    });
    return;
  }

  // Update existing memory
  const updates: Record<string, any> = {
    last_interaction_summary: `آخر سؤال: ${message.substring(0, 150)}`,
  };

  if (newCity && !existing.preferred_cities.includes(newCity)) {
    updates.preferred_cities = [...existing.preferred_cities, newCity].slice(-5);
  }
  if (newType && !existing.preferred_property_types.includes(newType)) {
    updates.preferred_property_types = [...existing.preferred_property_types, newType].slice(-5);
  }
  if (question && !existing.frequent_questions.includes(question)) {
    updates.frequent_questions = [...existing.frequent_questions, question].slice(-10);
  }

  await db
    .from("raqeem_client_memory")
    .update(updates)
    .eq("client_user_id", userId);
}

export function buildMemorySection(memory: ClientMemory | null): string {
  if (!memory) return "";

  let section = "\n\n## ذاكرة العميل (سرية — استخدمها لتخصيص الردود)\n";
  if (memory.preferred_cities.length > 0) {
    section += `- المدن المفضلة: ${memory.preferred_cities.join("، ")}\n`;
  }
  if (memory.preferred_property_types.length > 0) {
    section += `- أنواع الأصول المعتادة: ${memory.preferred_property_types.join("، ")}\n`;
  }
  if (memory.total_requests > 1) {
    section += `- عدد الطلبات السابقة: ${memory.total_requests} (مكتملة: ${memory.completed_requests})\n`;
  }
  if (memory.communication_style !== "balanced") {
    section += `- أسلوب التواصل المفضل: ${memory.communication_style}\n`;
  }
  if (memory.last_interaction_summary) {
    section += `- آخر تفاعل: ${memory.last_interaction_summary}\n`;
  }
  if (memory.ai_notes) {
    section += `- ملاحظات ذكية: ${memory.ai_notes}\n`;
  }
  section += "\nاستخدم هذه المعلومات لتخصيص ردودك وتوقع احتياجات العميل. لا تذكرها صراحة.\n";
  return section;
}
