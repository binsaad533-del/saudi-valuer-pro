import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, FolderOpen, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ClientArchivedReports({ userId }: { userId: string }) {
  const [archives, setArchives] = useState<any[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data: clientRecord } = await supabase
        .from("clients")
        .select("id")
        .eq("portal_user_id", userId)
        .maybeSingle();

      let query = supabase
        .from("archived_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (clientRecord) {
        query = query.eq("client_id", clientRecord.id);
      } else {
        query = query.eq("uploaded_by", userId);
      }

      const { data } = await query;
      setArchives(data || []);
      setLoadingArchives(false);
    };
    load();
  }, [userId]);

  const handleDownload = async (report: any) => {
    const { data } = await supabase.storage
      .from("archived-reports")
      .createSignedUrl(report.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast.error("فشل التحميل");
  };

  if (loadingArchives) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (archives.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-primary" />
          تقارير سابقة مؤرشفة
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {archives.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground truncate">{r.report_title_ar || r.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.report_number ? `${r.report_number} · ` : ""}{r.property_city_ar || ""} {r.report_date ? `· ${r.report_date}` : ""}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(r)}>
                <Download className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
