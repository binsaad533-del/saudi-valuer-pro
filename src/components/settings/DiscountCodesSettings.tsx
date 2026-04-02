import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Ticket, Plus, Trash2, Loader2, Copy, Percent, Calendar, Hash,
} from "lucide-react";

interface DiscountCode {
  id: string;
  code: string;
  discount_percentage: number;
  description: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function DiscountCodesSettings() {
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New code form
  const [newCode, setNewCode] = useState("");
  const [percentage, setPercentage] = useState("");
  const [description, setDescription] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const fetchCodes = async () => {
    const { data, error } = await supabase
      .from("discount_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("خطأ في تحميل أكواد الخصم");
    } else {
      setCodes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "JS-";
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setNewCode(code);
  };

  const handleCreate = async () => {
    if (!newCode.trim() || !percentage) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("discount_codes").insert({
      code: newCode.toUpperCase().trim(),
      discount_percentage: Number(percentage),
      description: description.trim() || null,
      max_uses: maxUses ? Number(maxUses) : null,
      expires_at: expiresAt || null,
      created_by: user?.id,
    });
    if (error) {
      if (error.code === "23505") toast.error("هذا الكود مستخدم بالفعل");
      else toast.error("خطأ في إنشاء الكود");
    } else {
      toast.success(`تم إنشاء كود الخصم: ${newCode}`);
      setDialogOpen(false);
      resetForm();
      fetchCodes();
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("discount_codes")
      .update({ is_active: !isActive, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      toast.success(isActive ? "تم تعطيل الكود" : "تم تفعيل الكود");
      fetchCodes();
    }
  };

  const deleteCode = async (id: string) => {
    const { error } = await supabase.from("discount_codes").delete().eq("id", id);
    if (!error) {
      toast.success("تم حذف الكود");
      fetchCodes();
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("تم نسخ الكود");
  };

  const resetForm = () => {
    setNewCode("");
    setPercentage("");
    setDescription("");
    setMaxUses("");
    setExpiresAt("");
  };

  const isExpired = (date: string | null) => {
    if (!date) return false;
    return new Date(date) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Ticket className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">أكواد الخصم</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">إنشاء وإدارة أكواد الخصم للعملاء</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" />
                كود جديد
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-right">إنشاء كود خصم جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">الكود</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      placeholder="مثال: JS-WELCOME"
                      className="text-sm font-mono tracking-wider"
                      dir="ltr"
                    />
                    <Button variant="outline" size="sm" onClick={generateCode} className="shrink-0 text-xs">
                      توليد
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">نسبة الخصم (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={percentage}
                      onChange={(e) => setPercentage(e.target.value)}
                      placeholder="10"
                      className="text-sm pr-8"
                      dir="ltr"
                    />
                    <Percent className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">الوصف (اختياري)</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="مثال: خصم ترحيبي للعملاء الجدد"
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">الحد الأقصى للاستخدام</Label>
                    <Input
                      type="number"
                      min="1"
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder="غير محدود"
                      className="text-sm"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">تاريخ الانتهاء</Label>
                    <Input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="text-sm"
                      dir="ltr"
                    />
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  disabled={!newCode.trim() || !percentage || saving}
                  onClick={handleCreate}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
                  إنشاء الكود
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {codes.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Ticket className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">لا توجد أكواد خصم حالياً</p>
            <p className="text-xs mt-1">أنشئ كود خصم جديد لمشاركته مع العملاء</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right text-xs">الكود</TableHead>
                  <TableHead className="text-right text-xs">الخصم</TableHead>
                  <TableHead className="text-right text-xs hidden sm:table-cell">الاستخدام</TableHead>
                  <TableHead className="text-right text-xs hidden md:table-cell">الانتهاء</TableHead>
                  <TableHead className="text-right text-xs">الحالة</TableHead>
                  <TableHead className="text-right text-xs w-20">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold tracking-wider">{c.code}</span>
                        <button onClick={() => copyCode(c.code)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      {c.description && <p className="text-[10px] text-muted-foreground mt-0.5">{c.description}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Percent className="w-2.5 h-2.5" />
                        {c.discount_percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {c.current_uses}{c.max_uses ? ` / ${c.max_uses}` : " / ∞"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {c.expires_at ? (
                        <span className={`text-xs ${isExpired(c.expires_at) ? "text-destructive" : "text-muted-foreground"}`}>
                          {new Date(c.expires_at).toLocaleDateString("ar-SA")}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={c.is_active && !isExpired(c.expires_at)}
                        disabled={isExpired(c.expires_at)}
                        onCheckedChange={() => toggleActive(c.id, c.is_active)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteCode(c.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
