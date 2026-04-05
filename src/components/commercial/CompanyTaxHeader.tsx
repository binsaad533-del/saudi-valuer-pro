import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, FileText, Loader2 } from "lucide-react";

interface CompanyTaxInfo {
  name_ar: string;
  name_en: string | null;
  cr_number: string | null;
  vat_number: string | null;
  logo_url: string | null;
}

interface CompanyTaxHeaderProps {
  className?: string;
  showLogo?: boolean;
  compact?: boolean;
}

export default function CompanyTaxHeader({ className = "", showLogo = false, compact = false }: CompanyTaxHeaderProps) {
  const [info, setInfo] = useState<CompanyTaxInfo | null>(null);
  const [loading, setLoading] = useState(true);

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

      const { data: org } = await supabase
        .from("organizations")
        .select("name_ar, name_en, cr_number, vat_number, logo_url")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (org) setInfo(org as unknown as CompanyTaxInfo);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
  }

  if (!info) return null;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        <Building2 className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold text-foreground">{info.name_ar}</span>
        {info.vat_number && (
          <>
            <span className="text-border">|</span>
            <span>الرقم الضريبي: {info.vat_number}</span>
          </>
        )}
        {info.cr_number && (
          <>
            <span className="text-border">|</span>
            <span>سجل تجاري: {info.cr_number}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30 ${className}`}>
      {showLogo && info.logo_url && (
        <img src={info.logo_url} alt={info.name_ar} className="w-12 h-12 object-contain rounded" />
      )}
      <div className="space-y-0.5">
        <p className="text-sm font-bold text-foreground">{info.name_ar}</p>
        {info.name_en && <p className="text-xs text-muted-foreground">{info.name_en}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground mt-1">
          {info.vat_number && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              الرقم الضريبي: <span className="font-mono text-foreground">{info.vat_number}</span>
            </span>
          )}
          {info.cr_number && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3 h-3" />
              سجل تجاري: <span className="font-mono text-foreground">{info.cr_number}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Standalone hook to get company tax info for PDF/programmatic use */
export function useCompanyTaxInfo() {
  const [info, setInfo] = useState<CompanyTaxInfo | null>(null);
  const [loading, setLoading] = useState(true);

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

      const { data: org } = await supabase
        .from("organizations")
        .select("name_ar, name_en, cr_number, vat_number, logo_url")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (org) setInfo(org as unknown as CompanyTaxInfo);
      setLoading(false);
    };
    load();
  }, []);

  return { info, loading };
}
