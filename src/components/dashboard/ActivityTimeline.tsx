const timeline = [
  { time: "09:15", text: "تم إنشاء طلب تقييم جديد VAL-2026-0042", type: "create" },
  { time: "10:30", text: "تم رفع صك الملكية للملف VAL-2026-0041", type: "upload" },
  { time: "11:00", text: "اكتمال المعاينة الميدانية - VAL-2026-0040", type: "inspect" },
  { time: "13:45", text: "تم اعتماد التقرير النهائي VAL-2026-0038", type: "approve" },
  { time: "14:20", text: "ملاحظات المراجع على VAL-2026-0041", type: "review" },
];

const typeColors: Record<string, string> = {
  create: "bg-primary",
  upload: "bg-accent",
  inspect: "bg-warning",
  approve: "bg-success",
  review: "bg-destructive",
};

export default function ActivityTimeline() {
  return (
    <div className="bg-card rounded-lg border border-border shadow-card animate-fade-in">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-foreground">النشاط الأخير</h3>
      </div>
      <div className="p-5 space-y-4">
        {timeline.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full ${typeColors[item.type]}`} />
              {i < timeline.length - 1 && <div className="w-px h-8 bg-border mt-1" />}
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">{item.text}</p>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
