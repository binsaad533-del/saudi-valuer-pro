import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CurrencyDisplay } from "@/components/ui/saudi-riyal";
import { Loader2, Save, Pencil, DollarSign, Building2, Cog, Layers, Zap, RotateCcw, Copy } from "lucide-react";
import { toast } from "sonner";

interface PricingRule {
  id: string;
  service_type: string;
  subcategory: string | null;
  label_ar: string;
  label_en: string | null;
  tier_label_ar: string | null;
  base_fee: number;
  inspection_fee: number;
  income_analysis_fee: number;
  per_unit_fee: number;
  complexity_multiplier: number;
  surcharge_percentage: number;
  auto_discount_percentage: number;
  is_active: boolean;
  tier_min_units: number;
  tier_max_units: number | null;
  sort_order: number;
}

const SERVICE_ICONS: Record<string, any> = {
  real_estate: Building2,
  machinery: Cog,
  mixed: Layers,
  revaluation: RotateCcw,
  report_copy: Copy,
  urgent: Zap,
};

const SERVICE_LABELS: Record<string, string> = {
  real_estate: "تقييم عقاري",
  machinery: "آلات ومعدات",
  mixed: "تقييم مختلط",
  revaluation: "إعادة تقييم",
  report_copy: "نسخة تقرير",
  urgent: "خدمة عاجلة",
};

export default function PricingMatrixManager() {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editRule, setEditRule] = useState<PricingRule | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const { data } = await supabase
      .from("pricing_rules" as any)
      .select("*")
      .order("sort_order");
    setRules((data as unknown as PricingRule[]) || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editRule) return;
    setSaving(true);
    const { error } = await supabase
      .from("pricing_rules" as any)
      .update({
        base_fee: editRule.base_fee,
        inspection_fee: editRule.inspection_fee,
        income_analysis_fee: editRule.income_analysis_fee,
        per_unit_fee: editRule.per_unit_fee,
        surcharge_percentage: editRule.surcharge_percentage,
        auto_discount_percentage: editRule.auto_discount_percentage,
        is_active: editRule.is_active,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", editRule.id);

    setSaving(false);
    if (error) {
      toast.error("فشل في حفظ التعديلات");
    } else {
      toast.success("تم تحديث قاعدة التسعير");
      setEditRule(null);
      loadRules();
    }
  };

  // Group rules by service_type
  const grouped = rules.reduce<Record<string, PricingRule[]>>((acc, r) => {
    (acc[r.service_type] = acc[r.service_type] || []).push(r);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">مصفوفة التسعير</h2>
          <p className="text-sm text-muted-foreground">إدارة قواعد التسعير لجميع الخدمات</p>
        </div>
      </div>

      {Object.entries(grouped).map(([type, typeRules]) => {
        const Icon = SERVICE_ICONS[type] || DollarSign;
        return (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Icon className="w-4 h-4 text-primary" />
                {SERVICE_LABELS[type] || type}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الخدمة</TableHead>
                    <TableHead className="text-right">الرسوم الأساسية</TableHead>
                    <TableHead className="text-right">المعاينة</TableHead>
                    <TableHead className="text-right">تحليل الدخل</TableHead>
                    <TableHead className="text-right">رسم لكل وحدة</TableHead>
                    <TableHead className="text-right">رسوم إضافية %</TableHead>
                    <TableHead className="text-right">خصم تلقائي %</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeRules.map((rule) => (
                    <TableRow key={rule.id} className={!rule.is_active ? "opacity-50" : ""}>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">{rule.label_ar}</span>
                          {rule.tier_label_ar && (
                            <Badge variant="outline" className="mr-2 text-[10px]">
                              {rule.tier_label_ar}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell><CurrencyDisplay amount={rule.base_fee} /></TableCell>
                      <TableCell><CurrencyDisplay amount={rule.inspection_fee} /></TableCell>
                      <TableCell><CurrencyDisplay amount={rule.income_analysis_fee} /></TableCell>
                      <TableCell>
                        {rule.per_unit_fee > 0 ? <CurrencyDisplay amount={rule.per_unit_fee} /> : "—"}
                      </TableCell>
                      <TableCell>
                        {rule.surcharge_percentage > 0 ? (
                          <Badge className="bg-amber-500/10 text-amber-600 border-0 text-[10px]">
                            +{rule.surcharge_percentage}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {rule.auto_discount_percentage > 0 ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px]">
                            -{rule.auto_discount_percentage}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={rule.is_active 
                          ? "bg-emerald-500/10 text-emerald-600 border-0 text-[10px]" 
                          : "bg-muted text-muted-foreground border-0 text-[10px]"}>
                          {rule.is_active ? "نشط" : "معطل"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setEditRule({ ...rule })}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Edit Dialog */}
      <Dialog open={!!editRule} onOpenChange={() => setEditRule(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              تعديل قاعدة التسعير
            </DialogTitle>
          </DialogHeader>
          {editRule && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-foreground">{editRule.label_ar}</p>
              <Separator />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">الرسوم الأساسية</Label>
                  <Input
                    type="number"
                    value={editRule.base_fee}
                    onChange={(e) => setEditRule({ ...editRule, base_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">رسوم المعاينة</Label>
                  <Input
                    type="number"
                    value={editRule.inspection_fee}
                    onChange={(e) => setEditRule({ ...editRule, inspection_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">تحليل الدخل</Label>
                  <Input
                    type="number"
                    value={editRule.income_analysis_fee}
                    onChange={(e) => setEditRule({ ...editRule, income_analysis_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">رسم لكل وحدة إضافية</Label>
                  <Input
                    type="number"
                    value={editRule.per_unit_fee}
                    onChange={(e) => setEditRule({ ...editRule, per_unit_fee: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">رسوم إضافية (%)</Label>
                  <Input
                    type="number"
                    value={editRule.surcharge_percentage}
                    onChange={(e) => setEditRule({ ...editRule, surcharge_percentage: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">خصم تلقائي (%)</Label>
                  <Input
                    type="number"
                    value={editRule.auto_discount_percentage}
                    onChange={(e) => setEditRule({ ...editRule, auto_discount_percentage: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <Label className="text-sm">تفعيل القاعدة</Label>
                <Switch
                  checked={editRule.is_active}
                  onCheckedChange={(v) => setEditRule({ ...editRule, is_active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRule(null)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
