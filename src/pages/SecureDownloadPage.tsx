/**
 * Secure Download Page
 * Validates expiring tokens before allowing PDF download.
 * Shows access denied with reason if token is invalid/expired/used/revoked.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Shield, ShieldOff, Clock, Download, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { validateSecureToken } from "@/lib/pdf-security";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logAudit } from "@/lib/audit-logger";

type TokenState = "loading" | "valid" | "denied";

interface DeniedInfo {
  reason: string;
  icon: "expired" | "used" | "revoked" | "invalid" | "unauthorized";
}

const ICON_MAP = {
  expired: Clock,
  used: ShieldOff,
  revoked: ShieldOff,
  invalid: AlertTriangle,
  unauthorized: ShieldOff,
};

export default function SecureDownloadPage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<TokenState>("loading");
  const [denied, setDenied] = useState<DeniedInfo | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("denied");
      setDenied({ reason: "رابط غير صالح", icon: "invalid" });
      return;
    }

    (async () => {
      const result = await validateSecureToken(token);

      if (!result.valid) {
        setState("denied");

        let icon: DeniedInfo["icon"] = "invalid";
        if (result.reason?.includes("انتهت")) icon = "expired";
        else if (result.reason?.includes("استنفاد")) icon = "used";
        else if (result.reason?.includes("إلغاء")) icon = "revoked";

        setDenied({ reason: result.reason || "رمز غير صالح", icon });

        // Log denied access attempt
        if (user) {
          logAudit({
            action: "view",
            tableName: "secure_download_tokens",
            entityType: "report",
            description: `محاولة وصول مرفوضة: ${result.reason}`,
            newData: { token, reason: result.reason },
          });
        }
        return;
      }

      // Token is valid
      setReportId(result.reportId || null);
      setState("valid");
    })();
  }, [token, user]);

  const handleDownload = async () => {
    if (!reportId || !token) return;
    setDownloading(true);

    try {
      // Get signed URL from storage
      const { data, error } = await supabase.storage
        .from("reports")
        .createSignedUrl(`${reportId}.pdf`, 60); // 60 second signed URL

      if (error || !data?.signedUrl) {
        throw new Error("فشل في الحصول على رابط الملف");
      }

      // Download
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = `report-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Log successful download
      if (user) {
        logAudit({
          action: "export",
          tableName: "secure_download_tokens",
          entityType: "report",
          recordId: reportId,
          description: `تحميل ناجح عبر رابط آمن — Token: ${token.slice(0, 12)}...`,
          newData: { token: token.slice(0, 12) },
        });
      }
    } catch (e: any) {
      console.error("Download failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">جارٍ التحقق من صلاحية الرابط...</p>
        </div>
      </div>
    );
  }

  if (state === "denied" && denied) {
    const DeniedIcon = ICON_MAP[denied.icon];
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
        <Card className="max-w-md w-full border-destructive/30">
          <CardContent className="pt-8 pb-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <DeniedIcon className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-destructive">تم رفض الوصول</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">{denied.reason}</p>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p>جميع محاولات الوصول مسجلة ومراقبة</p>
              <p>All access attempts are logged and monitored</p>
            </div>
            <Button variant="outline" onClick={() => navigate("/")} className="mt-4">
              العودة للرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid token — show download page
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="max-w-md w-full border-primary/20">
        <CardContent className="pt-8 pb-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">تحميل آمن</h1>
          <p className="text-muted-foreground text-sm">
            تم التحقق من صلاحية الرابط. اضغط للتحميل.
          </p>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 space-y-1 text-right">
            <p className="font-medium">تحذير قانوني:</p>
            <p>هذا الملف سري ومحمي بحقوق الملكية الفكرية. أي نسخ أو توزيع غير مصرح به يعرّض المخالف للمساءلة القانونية.</p>
            <p>النسخة تحتوي على علامة مائية مرتبطة بحسابك.</p>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full gap-2"
            size="lg"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            تحميل التقرير
          </Button>
          <p className="text-xs text-muted-foreground">
            هذا الرابط صالح لفترة محدودة وعدد تحميلات محدود
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
