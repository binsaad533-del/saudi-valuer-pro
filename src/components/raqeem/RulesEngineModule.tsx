import { useState, useEffect } from "react";
import {
  Scale, Plus, Trash2, CheckCircle, XCircle, Shield, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Rule {
  id: string;
  rule_title_ar: string;
  rule_content: string;
  category: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

const RULE_CATEGORIES: Record<string, string> = {
  method_selection: "اختيار المنهجية",
  calculation: "قواعد الحساب",
  compliance: "امتثال",
  reporting: "تقارير",
  general: "عام",
};

const PRESET_RULES = [
  { title: "الأراضي → أسلوب المقارنة", content: "عند تقييم الأراضي السكنية أو التجارية الخالية، يجب استخدام أسلوب المقارنة بالمبيعات كمنهجية أساسية.", category: "method_selection" },
  { title: "عقارات الدخل → أسلوب الدخل", content: "عند تقييم العقارات الاستثمارية المدرّة للدخل (مراكز تجارية، أبراج مكتبية، شقق مفروشة)، يجب استخدام أسلوب رسملة الدخل كمنهجية أساسية.", category: "method_selection" },
  { title: "الآلات والمعدات → أسلوب التكلفة", content: "عند تقييم الآلات والمعدات، يجب استخدام أسلوب التكلفة (تكلفة الاستبدال الجديدة ناقص الاستهلاك) كمنهجية أساسية، مع دعمه بأسلوب المقارنة إن توفرت بيانات سوقية.", category: "method_selection" },
  { title: "الحد الأقصى لتعديل الموقع ±20%", content: "لا يجوز أن يتجاوز تعديل الموقع في أسلوب المقارنة نسبة ±20% من قيمة المقارن. أي تجاوز يستوجب تبريراً مكتوباً.", category: "calculation" },
  { title: "الحد الأدنى 3 مقارنات", content: "يجب استخدام 3 مقارنات كحد أدنى في أسلوب المقارنة بالمبيعات. المقارنات يجب أن تكون من نفس المدينة وخلال 12 شهراً.", category: "compliance" },
];

export default function RulesEngineModule() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    rule_title_ar: "",
    rule_content: "",
    category: "method_selection",
    priority: 10,
  });

  const fetchRules = async () => {
    const { data } = await supabase
      .from("raqeem_rules")
      .select("*")
      .order("priority", { ascending: false });
    setRules((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchRules(); }, []);

  const addRule = async () => {
    if (!form.rule_title_ar || !form.rule_content) {
      toast.error("العنوان والمحتوى مطلوبان"); return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("raqeem_rules").insert({
      ...form, created_by: user.id,
    } as any);
    if (error) { toast.error("حدث خطأ"); return; }
    toast.success("تم إضافة القاعدة");
    setDialogOpen(false);
    setForm({ rule_title_ar: "", rule_content: "", category: "method_selection", priority: 10 });
    fetchRules();
  };

  const addPresetRule = async (preset: typeof PRESET_RULES[0]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("raqeem_rules").insert({
      rule_title_ar: preset.title,
      rule_content: preset.content,
      category: preset.category,
      priority: 10,
      created_by: user.id,
    } as any);
    if (error) { toast.error("حدث خطأ"); return; }
    toast.success("تم إضافة القاعدة");
    fetchRules();
  };

  const toggleActive = async (rule: Rule) => {
    await supabase.from("raqeem_rules").update({ is_active: !rule.is_active } as any).eq("id", rule.id);
    fetchRules();
  };

  const deleteRule = async (id: string) => {
    await supabase.from("raqeem_rules").delete().eq("id", id);
    fetchRules();
    toast.success("تم الحذف");
  };

  const existingTitles = new Set(rules.map((r) => r.rule_title_ar));
  const availablePresets = PRESET_RULES.filter((p) => !existingTitles.has(p.title));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">محرك القواعد</h3>
          <p className="text-xs text-muted-foreground">القواعد تتجاوز سلوك الذكاء الاصطناعي عند التعارض</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 ml-1" /> قاعدة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>إضافة قاعدة جديدة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="عنوان القاعدة *"
                value={form.rule_title_ar}
                onChange={(e) => setForm({ ...form, rule_title_ar: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(RULE_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(form.priority)} onValueChange={(v) => setForm({ ...form, priority: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">إلزامية (تتجاوز AI)</SelectItem>
                    <SelectItem value="7">مهمة</SelectItem>
                    <SelectItem value="5">توجيهية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="محتوى القاعدة — كن محدداً قدر الإمكان..."
                value={form.rule_content}
                onChange={(e) => setForm({ ...form, rule_content: e.target.value })}
                rows={5}
              />
            </div>
            <DialogFooter><Button onClick={addRule}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Preset rules */}
      {availablePresets.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary mb-2">قواعد مقترحة — انقر لإضافتها:</p>
          <div className="flex flex-wrap gap-2">
            {availablePresets.map((p, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => addPresetRule(p)}
              >
                <Plus className="w-3 h-3" /> {p.title}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي القواعد", value: rules.length, color: "text-primary" },
          { label: "إلزامية", value: rules.filter((r) => r.priority >= 10).length, color: "text-destructive" },
          { label: "فعّالة", value: rules.filter((r) => r.is_active).length, color: "text-green-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">جاري التحميل...</p>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Scale className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لم يتم تعريف أي قواعد بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className={`flex items-start gap-3 p-3 rounded-lg border bg-card ${rule.priority >= 10 ? "border-primary/30" : "border-border"}`}>
              <Shield className={`w-4 h-4 mt-1 shrink-0 ${rule.priority >= 10 ? "text-destructive" : "text-primary"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{rule.rule_title_ar}</span>
                  <Badge variant={rule.is_active ? "default" : "secondary"} className="text-[10px]">
                    {rule.is_active ? "فعّالة" : "معطّلة"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {RULE_CATEGORIES[rule.category] || rule.category}
                  </Badge>
                  {rule.priority >= 10 && (
                    <Badge variant="destructive" className="text-[10px]">إلزامية</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{rule.rule_content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(rule)}>
                  {rule.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteRule(rule.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
