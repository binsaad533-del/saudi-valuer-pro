import { useState, useEffect } from "react";
import {
  BookOpen, Plus, Trash2, Edit, CheckCircle, XCircle,
  FileText, Scale, MessageSquare, Shield, ChevronDown, ChevronUp,
  AlertTriangle, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Knowledge Documents ─────────────────────────────────────────

interface KnowledgeDoc {
  id: string;
  title_ar: string;
  category: string;
  content: string;
  source_type: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

function KnowledgeTab() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    title_ar: "",
    category: "standards",
    content: "",
    source_type: "document",
    priority: 5,
  });

  const fetchDocs = async () => {
    const { data } = await supabase
      .from("raqeem_knowledge")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    setDocs((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const addDoc = async () => {
    if (!form.title_ar || !form.content) {
      toast.error("العنوان والمحتوى مطلوبان");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("يجب تسجيل الدخول"); return; }

    const { error } = await supabase.from("raqeem_knowledge").insert({
      ...form,
      uploaded_by: user.id,
    } as any);
    if (error) { toast.error("حدث خطأ"); return; }
    toast.success("تم إضافة المعرفة");
    setDialogOpen(false);
    setForm({ title_ar: "", category: "standards", content: "", source_type: "document", priority: 5 });
    fetchDocs();
  };

  const toggleActive = async (doc: KnowledgeDoc) => {
    await supabase.from("raqeem_knowledge").update({ is_active: !doc.is_active } as any).eq("id", doc.id);
    fetchDocs();
  };

  const deleteDoc = async (id: string) => {
    await supabase.from("raqeem_knowledge").delete().eq("id", id);
    fetchDocs();
    toast.success("تم الحذف");
  };

  const categoryLabels: Record<string, string> = {
    standards: "معايير",
    policies: "سياسات",
    reports: "تقارير",
    regulations: "أنظمة",
    general: "عام",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">قاعدة المعرفة ({docs.length})</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 ml-1" /> إضافة معرفة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>إضافة معرفة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="العنوان بالعربية"
                value={form.title_ar}
                onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standards">معايير</SelectItem>
                    <SelectItem value="policies">سياسات</SelectItem>
                    <SelectItem value="reports">تقارير</SelectItem>
                    <SelectItem value="regulations">أنظمة</SelectItem>
                    <SelectItem value="general">عام</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(form.priority)} onValueChange={(v) => setForm({ ...form, priority: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">أولوية قصوى</SelectItem>
                    <SelectItem value="7">عالية</SelectItem>
                    <SelectItem value="5">متوسطة</SelectItem>
                    <SelectItem value="3">منخفضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="المحتوى — يمكنك لصق نص المعيار أو السياسة أو القرار هنا..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={8}
              />
            </div>
            <DialogFooter>
              <Button onClick={addDoc}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">جاري التحميل...</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لم يتم إضافة أي معرفة بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
              <FileText className="w-4 h-4 mt-1 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{doc.title_ar}</span>
                  <Badge variant={doc.is_active ? "default" : "secondary"} className="text-[10px]">
                    {doc.is_active ? "فعّال" : "معطّل"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {categoryLabels[doc.category] || doc.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(doc)}>
                  {doc.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDoc(doc.id)}>
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

// ── Corrections ──────────────────────────────────────────────────

interface Correction {
  id: string;
  original_question: string;
  original_answer: string;
  corrected_answer: string;
  correction_reason: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
}

function CorrectionsTab() {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase
      .from("raqeem_corrections")
      .select("*")
      .order("created_at", { ascending: false });
    setCorrections((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, []);

  const deleteCorrection = async (id: string) => {
    await supabase.from("raqeem_corrections").delete().eq("id", id);
    fetch();
    toast.success("تم الحذف");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">التصحيحات ({corrections.length})</h3>
      <p className="text-xs text-muted-foreground">
        عند تصحيح رد رقيم في المحادثة، يتم حفظه هنا ويُطبّق تلقائياً في الحالات المشابهة.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">جاري التحميل...</p>
      ) : corrections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لم يتم تسجيل أي تصحيحات بعد</p>
          <p className="text-xs mt-1">يمكنك تصحيح رقيم من المحادثة مباشرة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {corrections.map((c) => (
            <Card key={c.id} className="border-border">
              <CardContent className="p-3 space-y-2">
                <div className="text-xs text-muted-foreground">السؤال:</div>
                <p className="text-sm text-foreground">{c.original_question}</p>
                <div className="flex gap-2">
                  <div className="flex-1 p-2 rounded bg-destructive/10 border border-destructive/20">
                    <div className="text-[10px] text-destructive font-medium mb-1">الإجابة الخاطئة</div>
                    <p className="text-xs line-clamp-3">{c.original_answer}</p>
                  </div>
                  <div className="flex-1 p-2 rounded bg-green-500/10 border border-green-500/20">
                    <div className="text-[10px] text-green-600 font-medium mb-1">التصحيح</div>
                    <p className="text-xs line-clamp-3">{c.corrected_answer}</p>
                  </div>
                </div>
                {c.correction_reason && (
                  <p className="text-xs text-muted-foreground">السبب: {c.correction_reason}</p>
                )}
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="text-destructive text-xs h-7" onClick={() => deleteCorrection(c.id)}>
                    <Trash2 className="w-3 h-3 ml-1" /> حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Rules ────────────────────────────────────────────────────────

interface Rule {
  id: string;
  rule_title_ar: string;
  rule_content: string;
  category: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

function RulesTab() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    rule_title_ar: "",
    rule_content: "",
    category: "valuation",
    priority: 5,
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
      toast.error("العنوان والمحتوى مطلوبان");
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("يجب تسجيل الدخول"); return; }

    const { error } = await supabase.from("raqeem_rules").insert({
      ...form,
      created_by: user.id,
    } as any);
    if (error) { toast.error("حدث خطأ"); return; }
    toast.success("تم إضافة القاعدة");
    setDialogOpen(false);
    setForm({ rule_title_ar: "", rule_content: "", category: "valuation", priority: 5 });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">القواعد والتعليمات ({rules.length})</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 ml-1" /> إضافة قاعدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>إضافة قاعدة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="عنوان القاعدة"
                value={form.rule_title_ar}
                onChange={(e) => setForm({ ...form, rule_title_ar: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valuation">تقييم</SelectItem>
                    <SelectItem value="compliance">امتثال</SelectItem>
                    <SelectItem value="reporting">تقارير</SelectItem>
                    <SelectItem value="methodology">منهجية</SelectItem>
                    <SelectItem value="general">عام</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(form.priority)} onValueChange={(v) => setForm({ ...form, priority: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">إلزامية</SelectItem>
                    <SelectItem value="7">مهمة</SelectItem>
                    <SelectItem value="5">عادية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                placeholder="محتوى القاعدة أو التعليمات..."
                value={form.rule_content}
                onChange={(e) => setForm({ ...form, rule_content: e.target.value })}
                rows={6}
              />
            </div>
            <DialogFooter>
              <Button onClick={addRule}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
            <div key={rule.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
              <Shield className="w-4 h-4 mt-1 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{rule.rule_title_ar}</span>
                  <Badge variant={rule.is_active ? "default" : "secondary"} className="text-[10px]">
                    {rule.is_active ? "فعّالة" : "معطّلة"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {rule.priority >= 10 ? "إلزامية" : rule.priority >= 7 ? "مهمة" : "عادية"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rule.rule_content}</p>
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

// ── Main Panel ───────────────────────────────────────────────────

export default function RaqeemKnowledgePanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-4 pb-2 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">إدارة معرفة رقيم</h2>
        </div>
        <p className="text-[11px] text-muted-foreground">
          تحكم كامل بمعرفة رقيم — لا يتعلم ذاتياً بل من خلال ما تزوّده به فقط.
        </p>
      </div>

      <Tabs defaultValue="knowledge" className="flex-1 flex flex-col" dir="rtl">
        <TabsList className="mx-4 mt-3 grid grid-cols-3">
          <TabsTrigger value="knowledge" className="text-xs">المعرفة</TabsTrigger>
          <TabsTrigger value="corrections" className="text-xs">التصحيحات</TabsTrigger>
          <TabsTrigger value="rules" className="text-xs">القواعد</TabsTrigger>
        </TabsList>
        <ScrollArea className="flex-1 px-4 py-3">
          <TabsContent value="knowledge" className="mt-0">
            <KnowledgeTab />
          </TabsContent>
          <TabsContent value="corrections" className="mt-0">
            <CorrectionsTab />
          </TabsContent>
          <TabsContent value="rules" className="mt-0">
            <RulesTab />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
