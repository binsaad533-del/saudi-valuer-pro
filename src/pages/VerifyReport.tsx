import TopBar from "@/components/layout/TopBar";
import { useState } from "react";
import { Search, CheckCircle2, XCircle, FileText, Shield, Clock, Building2, User, BadgeCheck, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface VerificationResult {
  verified: boolean;
  status: string;
  report_id?: string;
  reference_number?: string;
  issue_date?: string;
  report_version?: number;
  client_name_masked?: string;
  property_type?: string;
  valuation_amount?: number;
  currency?: string;
  signature?: {
    signer_name_ar: string;
    signer_name_en: string;
    signer_title_ar: string;
    signer_title_en: string;
    signed_at: string;
    hash_valid: boolean;
  };
  message_ar: string;
  message_en: string;
}

export default function VerifyReport() {
  const [refNumber, setRefNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    if (!refNumber.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("verify-report", {
        body: { reference_number: refNumber.trim() },
      });

      if (error) throw error;
      setResult(data);
    } catch {
      setResult({
        verified: false,
        status: "error",
        message_ar: "حدث خطأ أثناء التحقق",
        message_en: "An error occurred during verification",
      });
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { color: string; icon: React.ReactNode; label_ar: string }> = {
    valid: { color: "bg-success/10 border-success/20 text-success", icon: <CheckCircle2 className="w-6 h-6" />, label_ar: "تقرير صالح ✓" },
    superseded: { color: "bg-warning/10 border-warning/20 text-warning", icon: <AlertTriangle className="w-6 h-6" />, label_ar: "تم استبداله" },
    draft: { color: "bg-muted border-border text-muted-foreground", icon: <FileText className="w-6 h-6" />, label_ar: "مسودة" },
    not_found: { color: "bg-destructive/10 border-destructive/20 text-destructive", icon: <XCircle className="w-6 h-6" />, label_ar: "غير موجود" },
    error: { color: "bg-destructive/10 border-destructive/20 text-destructive", icon: <XCircle className="w-6 h-6" />, label_ar: "خطأ" },
  };

  const propertyTypeLabels: Record<string, string> = {
    residential_land: "أرض سكنية",
    commercial_land: "أرض تجارية",
    villa: "فيلا",
    apartment: "شقة",
    commercial_building: "مبنى تجاري",
    office: "مكتب",
    warehouse: "مستودع",
    farm: "مزرعة",
    industrial: "صناعي",
    mixed_use: "متعدد الاستخدامات",
    hotel: "فندق",
    raw_land: "أرض خام",
    other: "أخرى",
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">التحقق من تقرير التقييم</h2>
          <p className="text-sm text-muted-foreground mt-1">أدخل الرقم المرجعي للتقرير للتحقق من صحته</p>
        </div>

        <div className="bg-card rounded-lg border border-border shadow-card p-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={refNumber}
                onChange={(e) => { setRefNumber(e.target.value); setResult(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="أدخل الرقم المرجعي (مثال: VAL-2026-0038)"
                className="w-full pr-10 pl-4 py-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleVerify}
              disabled={loading || !refNumber.trim()}
              className="px-6 py-3 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "جارٍ التحقق..." : "تحقق"}
            </button>
          </div>

          {result && (
            <div className={`mt-5 p-5 rounded-lg border ${statusConfig[result.status]?.color || statusConfig.error.color}`}>
              {/* Status Header */}
              <div className="flex items-center gap-3 mb-4">
                {statusConfig[result.status]?.icon || statusConfig.error.icon}
                <div>
                  <h4 className="font-semibold text-base">
                    {statusConfig[result.status]?.label_ar || result.message_ar}
                  </h4>
                  <p className="text-sm opacity-80">{result.message_ar}</p>
                </div>
              </div>

              {/* Report Details */}
              {result.verified && (
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <DetailItem icon={<FileText className="w-4 h-4" />} label="الرقم المرجعي" value={result.reference_number || "—"} />
                    <DetailItem icon={<Clock className="w-4 h-4" />} label="تاريخ الإصدار" value={result.issue_date || "—"} />
                    <DetailItem icon={<Building2 className="w-4 h-4" />} label="نوع العقار" value={propertyTypeLabels[result.property_type || ""] || result.property_type || "—"} />
                    <DetailItem icon={<User className="w-4 h-4" />} label="العميل" value={result.client_name_masked || "—"} />
                  </div>

                  {result.valuation_amount && (
                    <div className="p-3 rounded-lg bg-background/50 border border-border text-center">
                      <p className="text-xs text-muted-foreground mb-1">القيمة النهائية</p>
                      <p className="text-lg font-bold text-foreground">
                        {new Intl.NumberFormat("ar-SA").format(result.valuation_amount)} {result.currency}
                      </p>
                    </div>
                  )}

                  {/* Signature Block */}
                  {result.signature && (
                    <div className="p-3 rounded-lg bg-background/50 border border-border">
                      <div className="flex items-center gap-2 mb-2">
                        <BadgeCheck className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">التوقيع الإلكتروني</span>
                        <Badge variant={result.signature.hash_valid ? "default" : "destructive"} className="text-xs mr-auto">
                          {result.signature.hash_valid ? "تم التحقق ✓" : "غير صالح"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">الموقّع: </span>
                          <span className="text-foreground">{result.signature.signer_name_ar}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">الصفة: </span>
                          <span className="text-foreground">{result.signature.signer_title_ar}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">تاريخ التوقيع: </span>
                          <span className="text-foreground">{new Date(result.signature.signed_at).toLocaleString("ar-SA")}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* QR Code */}
                  <div className="flex items-center justify-center p-4 bg-background rounded-lg border border-border">
                    <QRCodeSVG
                      value={`${window.location.origin}/verify?ref=${result.reference_number}`}
                      size={120}
                    />
                  </div>

                  <p className="text-[11px] text-center text-muted-foreground">
                    الإصدار {result.report_version} — تم إصداره وفقاً لمعايير التقييم الدولية IVS 2025 ومتطلبات الهيئة السعودية للمقيّمين المعتمدين (تقييم)
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 p-2 rounded bg-background/50">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
