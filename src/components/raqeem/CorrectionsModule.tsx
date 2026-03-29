import { useState, useEffect } from "react";
import {
  AlertTriangle, Plus, Trash2, MessageSquare, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Correction {
  id: string;
  original_question: string;
  original_answer: string;
  corrected_answer: string;
  correction_reason: string | null;
  correction_type: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

const CORRECTION_TYPES: Record<string, string> = {
  wrong_method: "منهجية خاطئة",
  wrong_calculation: "حساب خاطئ",
  poor_reasoning: "استنتاج ضعيف",
  missing_info: "معلومات ناقصة",
  wrong_standard: "معيار خاطئ",
  reasoning: "تحسين عام",
};

export default function CorrectionsModule() {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    original_question: "",
    original_answer: "",
    corrected_answer: "",
    correction_reason: "",
    correction_type: "reasoning",
  });

  const fetchData = async () => {
    let query = supabase
      .from("raqeem_corrections")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") {
      query = query.eq("correction_type", filter);
    }
    const { data } = await query;
    setCorrections((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filter]);

  const addCorrection = async () => {
    if (!form.original_question || !form.corrected_answer) {
      toast.error("السؤال والتصحيح مطلوبان");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("raqeem_corrections").insert({
      ...form,
      corrected_by: user.id,
    } as any);
    if (error) { toast.error("حدث خطأ"); return; }
    toast.success("تم حفظ التصحيح");
    setDialogOpen(false);
    setForm({ original_question: "", original_answer: "", corrected_answer: "", correction_reason: "", correction_type: "reasoning" });
    fetchData();
  };

  const deleteCorrection = async (id: string) => {
    await supabase.from("raqeem_corrections").delete().eq("id", id);
    fetchData();
    toast.success("تم الحذف");
  };

  const toggleActive = async (c: Correction) => {
    await supabase.from("raqeem_corrections").update({ is_active: !c.is_active } as any).eq("id", c.id);
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">التصحيحات</h3>
          <p className="text-xs text-muted-foreground">تصحيحات المدير تُطبّق تلقائياً في الحالات المشابهة</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 ml-1" /> إضافة تصحيح</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>إضافة تصحيح يدوي</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Select value={form.correction_type} onValueChange={(v) => setForm({ ...form, correction_type: v })}>
                <SelectTrigger><SelectValue placeholder="نوع التصحيح" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CORRECTION_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="السؤال أو السياق الأصلي *"
                value={form.original_question}
                onChange={(e) => setForm({ ...form, original_question: e.target.value })}
                rows={2}
              />
              <Textarea
                placeholder="الإجابة الخاطئة (اختياري)"
                value={form.original_answer}
                onChange={(e) => setForm({ ...form, original_answer: e.target.value })}
                rows={3}
              />
              <Textarea
                placeholder="الإجابة الصحيحة *"
                value={form.corrected_answer}
                onChange={(e) => setForm({ ...form, corrected_answer: e.target.value })}
                rows={3}
              />
              <Input
                placeholder="سبب التصحيح (اختياري)"
                value={form.correction_reason}
                onChange={(e) => setForm({ ...form, correction_reason: e.target.value })}
              />
            </div>
            <DialogFooter><Button onClick={addCorrection}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats + Filter */}
      <div className="flex items-center gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1">
          {[
            { label: "إجمالي", value: corrections.length, color: "text-primary" },
            { label: "فعّالة", value: corrections.filter((c) => c.is_active).length, color: "text-green-600" },
            { label: "أنواع", value: new Set(corrections.map((c) => c.correction_type)).size, color: "text-amber-600" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="w-3.5 h-3.5 ml-1" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            {Object.entries(CORRECTION_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">جاري التحميل...</p>
      ) : corrections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لم يتم تسجيل أي تصحيحات بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {corrections.map((c) => (
            <Card key={c.id} className="border-border">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={c.is_active ? "default" : "secondary"} className="text-[10px]">
                      {c.is_active ? "فعّال" : "معطّل"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {CORRECTION_TYPES[c.correction_type || "reasoning"] || c.correction_type}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(c)}>
                      {c.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteCorrection(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">السؤال:</div>
                <p className="text-sm text-foreground bg-muted/30 rounded-lg p-2">{c.original_question}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="text-[10px] text-destructive font-medium mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> الإجابة الخاطئة
                    </div>
                    <p className="text-xs line-clamp-4">{c.original_answer || "—"}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/20">
                    <div className="text-[10px] text-green-600 font-medium mb-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> التصحيح
                    </div>
                    <p className="text-xs line-clamp-4">{c.corrected_answer}</p>
                  </div>
                </div>
                {c.correction_reason && (
                  <p className="text-xs text-muted-foreground">السبب: {c.correction_reason}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// Need this for the toggle button import
import { CheckCircle, XCircle } from "lucide-react";
