import { useNavigate } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { ClipboardCheck, FileText, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export default function ReviewPage() {
  const navigate = useNavigate();

  const reports = [
    { ref: "VAL-2026-0042", type: "فيلا سكنية", valuer: "محمد العتيبي", status: "pending", date: "2026-03-25" },
    { ref: "VAL-2026-0041", type: "مبنى تجاري", valuer: "خالد الشمري", status: "in_review", date: "2026-03-22" },
    { ref: "VAL-2026-0040", type: "أرض خام", valuer: "سعد القحطاني", status: "needs_revision", date: "2026-03-20" },
    { ref: "VAL-2026-0039", type: "مجمع سكني", valuer: "محمد العتيبي", status: "pending", date: "2026-03-18" },
    { ref: "VAL-2026-0037", type: "أرض تطويرية", valuer: "خالد الشمري", status: "pending", date: "2026-03-15" },
  ];

  const handleReview = (ref: string) => {
    navigate(`/reports/generate?ref=${encodeURIComponent(ref)}`);
  };

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-foreground">المراجعة والجودة</h2>
          <p className="text-sm text-muted-foreground">مراجعة التقارير وضبط الجودة قبل الإصدار</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: "بانتظار المراجعة", value: 5, icon: Clock, color: "text-warning", bg: "bg-warning/10" },
            { label: "قيد المراجعة", value: 2, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
            { label: "تحتاج تعديل", value: 1, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
            { label: "معتمدة", value: 12, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-lg border border-border p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Review Queue */}
        <div className="bg-card rounded-lg border border-border shadow-card">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">قائمة التقارير للمراجعة</h3>
          </div>
          <div className="divide-y divide-border">
            {reports.map((r) => (
              <div
                key={r.ref}
                className="px-5 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => handleReview(r.ref)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ClipboardCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">{r.ref}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        r.status === "pending" ? "bg-warning/10 text-warning" :
                        r.status === "in_review" ? "bg-primary/10 text-primary" :
                        "bg-destructive/10 text-destructive"
                      }`}>
                        {r.status === "pending" ? "بانتظار المراجعة" : r.status === "in_review" ? "قيد المراجعة" : "يحتاج تعديل"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.type} • المقيّم: {r.valuer} • {r.date}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReview(r.ref); }}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  مراجعة
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
