import { useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { Search, Calendar, FileText, Building2, MapPin, Download, Eye, QrCode, X } from "lucide-react";
import { toast } from "sonner";

const archived = [
  { ref: "VAL-2026-0038", type: "عقار مدر للدخل", city: "مكة المكرمة", client: "وزارة المالية", value: "22,000,000", issueDate: "2026-03-16", status: "صادر" },
  { ref: "VAL-2026-0035", type: "أرض خام", city: "الرياض", client: "أمانة الرياض", value: "45,000,000", issueDate: "2026-03-08", status: "صادر" },
  { ref: "VAL-2026-0030", type: "فيلا سكنية", city: "جدة", client: "بنك الراجحي", value: "3,200,000", issueDate: "2026-02-25", status: "صادر" },
  { ref: "VAL-2026-0025", type: "مبنى تجاري", city: "الدمام", client: "شركة أرامكو", value: "18,500,000", issueDate: "2026-02-15", status: "صادر" },
];

export default function ArchivePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewReport, setViewReport] = useState<typeof archived[0] | null>(null);
  const [showQr, setShowQr] = useState<typeof archived[0] | null>(null);

  const filtered = archived.filter(
    (r) =>
      r.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.client.includes(searchQuery) ||
      r.type.includes(searchQuery)
  );

  const handleDownload = (report: typeof archived[0]) => {
    toast.success(`جاري تحميل تقرير ${report.ref}...`);
    // In production this would call generate-report-pdf edge function
  };

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-foreground">الأرشيف</h2>
          <p className="text-sm text-muted-foreground">التقارير الصادرة والمؤرشفة - سجل دائم غير قابل للتعديل</p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالرقم المرجعي أو العميل..."
              className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            لا توجد نتائج مطابقة للبحث
          </div>
        )}

        <div className="grid gap-4">
          {filtered.map((r) => (
            <div key={r.ref} className="bg-card rounded-lg border border-border shadow-card p-5 flex items-center justify-between hover:shadow-elevated transition-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-success" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.ref}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">{r.status}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{r.type}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{r.city}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{r.issueDate}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{r.client} | القيمة: {r.value} ر.س</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewReport(r)}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                  title="عرض"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownload(r)}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                  title="تحميل PDF"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowQr(r)}
                  className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                  title="رمز التحقق"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View Report Modal */}
      {viewReport && (
        <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setViewReport(null)}>
          <div className="bg-card rounded-xl border border-border shadow-elevated max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">تفاصيل التقرير</h3>
              <button onClick={() => setViewReport(null)} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">الرقم المرجعي</span>
                <span className="font-medium text-foreground" dir="ltr">{viewReport.ref}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">نوع العقار</span>
                <span className="text-foreground">{viewReport.type}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">المدينة</span>
                <span className="text-foreground">{viewReport.city}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">العميل</span>
                <span className="text-foreground">{viewReport.client}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">القيمة</span>
                <span className="font-bold text-foreground">{viewReport.value} ر.س</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">تاريخ الإصدار</span>
                <span className="text-foreground">{viewReport.issueDate}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">الحالة</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">{viewReport.status}</span>
              </div>
            </div>
            <button
              onClick={() => { handleDownload(viewReport); setViewReport(null); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              تحميل التقرير PDF
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQr && (
        <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowQr(null)}>
          <div className="bg-card rounded-xl border border-border shadow-elevated max-w-sm w-full p-6 space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">رمز التحقق</h3>
              <button onClick={() => setShowQr(null)} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-6 flex flex-col items-center gap-3">
              <div className="w-40 h-40 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                <QrCode className="w-20 h-20 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">رمز QR للتحقق من صحة التقرير</p>
              <p className="text-xs font-mono text-foreground/70" dir="ltr">{showQr.ref}</p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://saudi-valuer-pro.lovable.app/verify/${showQr.ref}`);
                toast.success("تم نسخ رابط التحقق");
              }}
              className="w-full py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              نسخ رابط التحقق
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
