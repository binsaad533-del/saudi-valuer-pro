import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useOrgSettings(category: string) {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile?.organization_id) { setLoading(false); return; }
      setOrgId(profile.organization_id);

      const { data } = await supabase
        .from("organization_settings")
        .select("settings")
        .eq("organization_id", profile.organization_id)
        .eq("category", category)
        .maybeSingle();

      if (data?.settings && typeof data.settings === 'object' && !Array.isArray(data.settings)) {
        setSettings(data.settings as Record<string, any>);
      }
      setLoading(false);
    };
    load();
  }, [category]);

  const save = useCallback(async (newSettings: Record<string, any>) => {
    if (!orgId) { toast.error("لم يتم تحديد المنظمة"); return false; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("organization_settings")
        .upsert({
          organization_id: orgId,
          category,
          settings: newSettings,
          updated_by: user?.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id,category" });

      if (error) throw error;
      setSettings(newSettings);
      return true;
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ في الحفظ");
      return false;
    } finally {
      setSaving(false);
    }
  }, [orgId, category]);

  return { settings, loading, saving, save, orgId };
}

export function useProfileSettings() {
  const [profile, setProfile] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) setProfile(data);
      setLoading(false);
    };
    load();
  }, []);

  const save = useCallback(async (updates: Record<string, any>) => {
    if (!userId) return false;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (error) throw error;
      setProfile(prev => ({ ...prev, ...updates }));
      return true;
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ في الحفظ");
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  return { profile, loading, saving, save, userId };
}

export async function uploadSettingsFile(
  file: File,
  folder: string,
  userId: string
): Promise<string | null> {
  const ext = file.name.split(".").pop();
  const path = `${folder}/${userId}_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("settings-uploads")
    .upload(path, file, { upsert: true });

  if (error) {
    toast.error("فشل في رفع الملف: " + error.message);
    return null;
  }

  const { data: { publicUrl } } = supabase.storage
    .from("settings-uploads")
    .getPublicUrl(path);

  return publicUrl;
}
