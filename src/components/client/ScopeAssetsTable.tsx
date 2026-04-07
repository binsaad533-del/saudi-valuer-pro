import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle, AlertTriangle, XCircle, Pencil, Trash2, Plus, Save, X,
} from "lucide-react";

export interface ScopeAsset {
  id: string;
  asset_index: number;
  name: string;
  asset_type: string;
  category: string | null;
  subcategory: string | null;
  quantity: number;
  condition: string | null;
  confidence: number;
  review_status: string | null;
  source_evidence: string | null;
  asset_data: any;
}

interface Props {
  assets: ScopeAsset[];
  onAssetsChange: (assets: ScopeAsset[]) => void;
}

const CONDITION_LABELS: Record<string, string> = {
  excellent: "ممتاز",
  good: "جيد",
  fair: "مقبول",
  poor: "ضعيف",
  scrap: "خردة",
  unknown: "غير محدد",
};

const TYPE_LABELS: Record<string, string> = {
  real_estate: "عقار",
  machinery_equipment: "معدة / آلة",
  right_of_use: "حق استخدام / إيجار",
  vehicle: "مركبة",
  furniture: "أثاث ومفروشات",
  it_equipment: "أجهزة تقنية",
  intangible: "أصول غير ملموسة",
  leasehold_improvements: "تحسينات مستأجرة",
  medical_equipment: "أجهزة طبية",
};

function confidenceBadge(conf: number) {
  if (conf >= 80) return <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 border-emerald-200 text-[10px]"><CheckCircle className="w-3 h-3 ml-1" />عالية</Badge>;
  if (conf >= 50) return <Badge variant="secondary" className="bg-amber-500/10 text-amber-700 border-amber-200 text-[10px]"><AlertTriangle className="w-3 h-3 ml-1" />متوسطة</Badge>;
  return <Badge variant="destructive" className="bg-red-500/10 text-red-700 border-red-200 text-[10px]"><XCircle className="w-3 h-3 ml-1" />منخفضة</Badge>;
}

function getFieldValue(asset: ScopeAsset, key: string): string {
  const fields = asset.asset_data?.fields;
  if (!Array.isArray(fields)) return "";
  const f = fields.find((field: any) => field.key === key);
  return f?.value ?? "";
}

export default function ScopeAssetsTable({ assets, onAssetsChange }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("machinery_equipment");
  const [editQty, setEditQty] = useState(1);

  const startEdit = (a: ScopeAsset) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditType(a.asset_type);
    setEditQty(a.quantity);
  };

  const saveEdit = () => {
    if (!editingId) return;
    onAssetsChange(assets.map(a =>
      a.id === editingId ? { ...a, name: editName, asset_type: editType, quantity: editQty } : a
    ));
    setEditingId(null);
  };

  const removeAsset = (id: string) => {
    onAssetsChange(assets.filter(a => a.id !== id));
  };

  const addAsset = () => {
    const newAsset: ScopeAsset = {
      id: crypto.randomUUID(),
      asset_index: assets.length + 1,
      name: "أصل جديد",
      asset_type: "machinery_equipment",
      category: null,
      subcategory: null,
      quantity: 1,
      condition: "unknown",
      confidence: 0,
      review_status: "needs_review",
      source_evidence: "إضافة يدوية",
      asset_data: { fields: [] },
    };
    onAssetsChange([...assets, newAsset]);
    startEdit(newAsset);
  };

  const extracted = assets.filter(a => a.confidence > 0);
  const manual = assets.filter(a => a.confidence === 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">
          الأصول المستخرجة من الملف
          <span className="text-xs font-normal text-muted-foreground mr-2">
            ({extracted.length} مستخرج{manual.length > 0 ? ` + ${manual.length} يدوي` : ""})
          </span>
        </h3>
        <Button variant="outline" size="sm" onClick={addAsset} className="gap-1 text-xs h-7">
          <Plus className="w-3 h-3" />
          إضافة أصل
        </Button>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-right w-10 text-[11px]">#</TableHead>
                <TableHead className="text-right text-[11px]">اسم الأصل</TableHead>
                <TableHead className="text-right text-[11px]">التصنيف</TableHead>
                <TableHead className="text-right text-[11px] w-16">الكمية</TableHead>
                <TableHead className="text-right text-[11px]">الحالة</TableHead>
                <TableHead className="text-right text-[11px]">القيمة</TableHead>
                <TableHead className="text-right text-[11px]">الثقة</TableHead>
                <TableHead className="text-right text-[11px]">المصدر</TableHead>
                <TableHead className="text-right text-[11px] w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground text-sm">
                    لم يتم استخراج أصول — يرجى إضافتها يدويًا
                  </TableCell>
                </TableRow>
              )}
              {assets.map((asset, idx) => (
                <TableRow key={asset.id} className={editingId === asset.id ? "bg-primary/5" : ""}>
                  <TableCell className="text-[11px] text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    {editingId === asset.id ? (
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 text-xs" />
                    ) : (
                      <span className="text-xs font-medium">{asset.name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === asset.id ? (
                      <Select value={editType} onValueChange={setEditType}>
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="real_estate">عقار</SelectItem>
                          <SelectItem value="machinery_equipment">معدة / آلة</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        {TYPE_LABELS[asset.asset_type] || asset.asset_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === asset.id ? (
                      <Input type="number" min={1} value={editQty} onChange={e => setEditQty(Number(e.target.value) || 1)} className="h-7 text-xs w-16" />
                    ) : (
                      <span className="text-xs">{asset.quantity}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px]">{CONDITION_LABELS[asset.condition || "unknown"] || asset.condition}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-[11px]">
                      {getFieldValue(asset, "purchase_price") || getFieldValue(asset, "value") || getFieldValue(asset, "book_value") || "—"}
                    </span>
                  </TableCell>
                  <TableCell>{confidenceBadge(asset.confidence)}</TableCell>
                  <TableCell>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[100px] block">
                      {asset.source_evidence || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {editingId === asset.id ? (
                        <>
                          <button onClick={saveEdit} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Save className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(asset)} className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeAsset(asset.id)} className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Unrecognized rows warning */}
      {assets.some(a => a.confidence < 30) && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/10 dark:border-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-800 dark:text-amber-400">بعض الأصول تحتاج مراجعة</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-500">
              {assets.filter(a => a.confidence < 30).length} أصل بثقة منخفضة — يرجى مراجعة البيانات وتصحيحها
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
