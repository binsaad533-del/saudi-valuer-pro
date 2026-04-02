import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Search, CheckCircle2, XCircle, Shield, FileText, Clock, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { mockReports } from "@/data/mockReports";
import { getStatusLabel, getStatusColor } from "@/utils/reportWorkflow";
import type { Report, ReportStatus } from "@/types/report";
import { formatDate, formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";


type VerifyStatus = "valid" | "superseded" | "cancelled" | "not_found";

interface VerifyResult {
  status: VerifyStatus;
  report: Report | null;
}

const STATUS_CONFIG: Record<VerifyStatus, { color: string; icon: React.ReactNode; label: string }> = {
  valid: {
    color: "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400",
    icon: <CheckCircle2 className="w-7 h-7" />,
    label: "تقرير صالح ✓",
  },
  superseded: {
    color: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-400",
    icon: <AlertTriangle className="w-7 h-7" />,
    label: "تم استبدال هذا التقرير بإصدار أحدث",
  },
  cancelled: {
    color: "bg-destructive/10 border-destructive/20 text-destructive",
    icon: <XCircle className="w-7 h-7" />,
    label: "تقرير ملغي",
  },
  not_found: {
    color: "bg-destructive/10 border-destructive/20 text-destructive",
    icon: <XCircle className="w-7 h-7" />,
    label: "لم يتم العثور على التقرير",
  },
};

function lookupReport(query: string): VerifyResult {
  const report = mockReports.find(
    (r) =>
      r.verificationToken === query ||
      r.reportNumber === query ||
      r.reportNumber.toLowerCase() === query.toLowerCase()
  );

  if (!report) return { status: "not_found", report: null };

  if (report.status === "cancelled") return { status: "cancelled", report };

  const validStatuses: ReportStatus[] = ["issued", "delivered"];
  if (validStatuses.includes(report.status)) return { status: "valid", report };

  return { status: "superseded", report };
}

export default function VerifyReport() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);

  useEffect(() => {
    const t = token || searchParams.get("ref") || "";
    if (t) {
      setQuery(t);
      setResult(lookupReport(t));
    }
  }, [token, searchParams]);

  const handleVerify = () => {
    if (!query.trim()) return;
    setResult(lookupReport(query.trim()));
  };

  const cfg = result ? STATUS_CONFIG[result.status] : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">التحقق من تقرير التقييم</h1>
          <p className="text-sm text-muted-foreground mt-1">أدخل رقم التقرير أو رمز التحقق</p>
        </div>

        {/* Search */}
        <div className="bg-card rounded-lg border shadow-sm p-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setResult(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="RPT-2026-00004 أو رمز التحقق"
                className="w-full pr-10 pl-4 py-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                dir="ltr"
              />
            </div>
            <button
              onClick={handleVerify}
              disabled={!query.trim()}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50"
            >
              تحقق
            </button>
          </div>

          {/* Result */}
          {result && cfg && (
            <div className={`mt-5 p-5 rounded-lg border-2 ${cfg.color}`}>
              <div className="flex items-center gap-3 mb-4">
                {cfg.icon}
                <h3 className="font-bold text-lg">{cfg.label}</h3>
              </div>

              {result.report && (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow icon={<FileText className="w-4 h-4" />} label="رقم التقرير" value={result.report.reportNumber} />
                    <InfoRow icon={<Clock className="w-4 h-4" />} label="تاريخ الإصدار" value={result.report.issuedAt ? formatDate(result.report.issuedAt) : "لم يُصدر بعد"} />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">الحالة:</span>
                    <Badge className={getStatusColor(result.report.status)}>{getStatusLabel(result.report.status)}</Badge>
                  </div>

                  <div>
                    <span className="text-muted-foreground">العميل: </span>
                    <span className="font-medium">{result.report.clientName}</span>
                  </div>

                  {result.status === "valid" && (
                    <>
                      <div className="p-3 rounded-lg bg-background/60 border text-center">
                        <p className="text-xs text-muted-foreground mb-1">القيمة التقديرية</p>
                        <p className="text-xl font-bold">{formatNumber(result.report.estimatedValue)} <SAR /></p>
                      </div>

                      <div className="p-3 rounded-lg bg-background/60 border">
                        <p className="font-semibold mb-1">المقيّم المعتمد</p>
                        <p>{result.report.evaluatorName}</p>
                        <p className="text-xs text-muted-foreground">{result.report.evaluatorCredentials.saudiAuthority}</p>
                        <p className="text-xs text-muted-foreground">{result.report.evaluatorCredentials.rics} · {result.report.evaluatorCredentials.asa}</p>
                      </div>

                      <div className="flex justify-center pt-2">
                        <QRCodeSVG value={`${window.location.origin}/verify/${result.report.verificationToken}`} size={100} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
