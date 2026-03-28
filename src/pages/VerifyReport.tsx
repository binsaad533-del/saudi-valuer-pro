import TopBar from "@/components/layout/TopBar";
import { useState } from "react";
import { Search, QrCode, CheckCircle2, XCircle, FileText } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function VerifyReport() {
  const [refNumber, setRefNumber] = useState("");
  const [verified, setVerified] = useState<null | boolean>(null);

  const handleVerify = () => {
    // Mock verification
    setVerified(refNumber.startsWith("VAL-"));
  };

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">التحقق من تقرير التقييم</h2>
          <p className="text-sm text-muted-foreground mt-1">أدخل الرقم المرجعي للتقرير أو امسح رمز QR للتحقق</p>
        </div>

        <div className="bg-card rounded-lg border border-border shadow-card p-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={refNumber}
                onChange={(e) => { setRefNumber(e.target.value); setVerified(null); }}
                placeholder="أدخل الرقم المرجعي (مثال: VAL-2026-0038)"
                className="w-full pr-10 pl-4 py-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleVerify}
              className="px-6 py-3 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
            >
              تحقق
            </button>
          </div>

          {verified !== null && (
            <div className={`mt-5 p-5 rounded-lg border ${verified ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
              <div className="flex items-center gap-3">
                {verified ? (
                  <CheckCircle2 className="w-8 h-8 text-success" />
                ) : (
                  <XCircle className="w-8 h-8 text-destructive" />
                )}
                <div>
                  <h4 className={`font-semibold ${verified ? "text-success" : "text-destructive"}`}>
                    {verified ? "تقرير موثق ✓" : "لم يتم العثور على التقرير"}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {verified
                      ? `الرقم المرجعي: ${refNumber} — صادر بتاريخ 2026-03-16 — المقيّم: أحمد المالكي`
                      : "الرقم المرجعي غير صالح أو غير موجود في النظام"}
                  </p>
                </div>
              </div>
              {verified && (
                <div className="mt-4 flex items-center justify-center p-4 bg-card rounded-lg border border-border">
                  <QRCodeSVG value={`https://bussma.sa/verify/${refNumber}`} size={120} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
