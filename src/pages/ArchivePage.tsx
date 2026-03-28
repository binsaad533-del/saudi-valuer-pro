import TopBar from "@/components/layout/TopBar";
import { Search, Calendar, FileText, Building2, MapPin, Download, Eye, QrCode } from "lucide-react";

const archived = [
  { ref: "VAL-2026-0038", type: "عقار مدر للدخل", city: "مكة المكرمة", client: "وزارة المالية", value: "22,000,000", issueDate: "2026-03-16", status: "صادر" },
  { ref: "VAL-2026-0035", type: "أرض خام", city: "الرياض", client: "أمانة الرياض", value: "45,000,000", issueDate: "2026-03-08", status: "صادر" },
  { ref: "VAL-2026-0030", type: "فيلا سكنية", city: "جدة", client: "بنك الراجحي", value: "3,200,000", issueDate: "2026-02-25", status: "صادر" },
  { ref: "VAL-2026-0025", type: "مبنى تجاري", city: "الدمام", client: "شركة أرامكو", value: "18,500,000", issueDate: "2026-02-15", status: "صادر" },
];

export default function ArchivePage() {
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
              placeholder="بحث بالرقم المرجعي أو العميل..."
              className="w-full pr-10 pl-4 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {archived.map((r) => (
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
                <button className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="عرض">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="تحميل PDF">
                  <Download className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors" title="رمز التحقق">
                  <QrCode className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
