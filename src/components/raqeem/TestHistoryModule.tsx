import { useState, useEffect } from "react";
import {
  FlaskConical, Plus, Trash2, Eye, Clock,
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

interface TestSession {
  id: string;
  test_name: string;
  test_type: string;
  total_questions: number;
  correct_answers: number;
  accuracy_score: number;
  notes: string | null;
  questions: any[];
  results: any[];
  created_at: string;
}

const TEST_TYPES: Record<string, string> = {
  accuracy: "دقة الإجابات",
  methodology: "اختيار المنهجية",
  compliance: "الامتثال",
  calculation: "الحسابات",
};

export default function TestHistoryModule() {
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewSession, setViewSession] = useState<TestSession | null>(null);
  const [form, setForm] = useState({
    test_name: "",
    test_type: "accuracy",
    total_questions: 0,
    correct_answers: 0,
    notes: "",
    questions: "",
    results: "",
  });

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("raqeem_test_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    setSessions((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  const addSession = async () => {
    if (!form.test_name || form.total_questions <= 0) {
      toast.error("اسم الاختبار وعدد الأسئلة مطلوبان"); return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const accuracy = form.total_questions > 0
      ? Math.round((form.correct_answers / form.total_questions) * 10000) / 100
      : 0;

    let questionsJson: any[] = [];
    let resultsJson: any[] = [];
    try {
      if (form.questions.trim()) questionsJson = JSON.parse(form.questions);
      if (form.results.trim()) resultsJson = JSON.parse(form.results);
    } catch {
      // Keep empty arrays if parsing fails
    }

    const { error } = await supabase.from("raqeem_test_sessions").insert({
      test_name: form.test_name,
      test_type: form.test_type,
      total_questions: form.total_questions,
      correct_answers: form.correct_answers,
      accuracy_score: accuracy,
      notes: form.notes || null,
      questions: questionsJson,
      results: resultsJson,
      tested_by: user.id,
    } as any);
    if (error) { toast.error("حدث خطأ"); console.error(error); return; }
    toast.success("تم حفظ نتيجة الاختبار");
    setDialogOpen(false);
    setForm({ test_name: "", test_type: "accuracy", total_questions: 0, correct_answers: 0, notes: "", questions: "", results: "" });
    fetchSessions();
  };

  const deleteSession = async (id: string) => {
    await supabase.from("raqeem_test_sessions").delete().eq("id", id);
    fetchSessions();
    toast.success("تم الحذف");
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-amber-600";
    return "text-destructive";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">سجل الاختبارات</h3>
          <p className="text-xs text-muted-foreground">جميع جلسات اختبار رقيم ونتائجها</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 ml-1" /> تسجيل اختبار</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>تسجيل نتيجة اختبار</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="اسم الاختبار *"
                value={form.test_name}
                onChange={(e) => setForm({ ...form, test_name: e.target.value })}
              />
              <Select value={form.test_type} onValueChange={(v) => setForm({ ...form, test_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TEST_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">عدد الأسئلة</label>
                  <Input
                    type="number" min={0}
                    value={form.total_questions}
                    onChange={(e) => setForm({ ...form, total_questions: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">الإجابات الصحيحة</label>
                  <Input
                    type="number" min={0}
                    value={form.correct_answers}
                    onChange={(e) => setForm({ ...form, correct_answers: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <Textarea
                placeholder="ملاحظات (اختياري)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
            <DialogFooter><Button onClick={addSession}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Avg accuracy */}
      {sessions.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">متوسط الدقة الكلي</div>
          <div className={`text-4xl font-bold ${getScoreColor(
            sessions.reduce((s, t) => s + Number(t.accuracy_score), 0) / sessions.length
          )}`}>
            {(sessions.reduce((s, t) => s + Number(t.accuracy_score), 0) / sessions.length).toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {sessions.length} اختبار — {sessions.reduce((s, t) => s + t.total_questions, 0)} سؤال
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">جاري التحميل...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لم يتم إجراء أي اختبارات بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Card key={s.id} className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`text-2xl font-bold ${getScoreColor(Number(s.accuracy_score))}`}>
                      {Number(s.accuracy_score).toFixed(0)}%
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">{s.test_name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {TEST_TYPES[s.test_type] || s.test_type}
                        </Badge>
                        <span>{s.correct_answers}/{s.total_questions} صحيح</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(s.created_at).toLocaleDateString("ar-SA")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewSession(s)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteSession(s.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {s.notes && <p className="text-xs text-muted-foreground mt-2">{s.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View session detail */}
      <Dialog open={!!viewSession} onOpenChange={() => setViewSession(null)}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewSession?.test_name}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{TEST_TYPES[viewSession?.test_type || ""] || viewSession?.test_type}</Badge>
            <Badge variant="outline">{Number(viewSession?.accuracy_score).toFixed(1)}% دقة</Badge>
            <Badge variant="outline">{viewSession?.correct_answers}/{viewSession?.total_questions}</Badge>
          </div>
          {viewSession?.notes && (
            <p className="text-sm text-muted-foreground">{viewSession.notes}</p>
          )}
          <div className="text-xs text-muted-foreground">
            {new Date(viewSession?.created_at || "").toLocaleString("ar-SA")}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
