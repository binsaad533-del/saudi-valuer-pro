import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Building2,
  Wrench,
  Package,
  RefreshCw,
  FileText,
  AlertTriangle,
  X,
  Copy,
} from "lucide-react";

export interface InventoryAsset {
  id: number;
  name: string;
  type: "real_estate" | "machinery_equipment";
  category: string;
  subcategory?: string;
  quantity: number;
  condition?: string;
  fields: { key: string; label: string; value: string; confidence: number }[];
  source?: string;
}

interface Props {
  discipline: string;
  inventory: InventoryAsset[];
  description: string;
  summary?: {
    total: number;
    by_type?: Record<string, number>;
    by_condition?: Record<string, number>;
  };
  onInventoryChange: (inventory: InventoryAsset[]) => void;
  onDescriptionChange: (desc: string) => void;
  onDisciplineChange: (d: string) => void;
  onReanalyze?: () => void;
}

const DISCIPLINE_OPTIONS = [
  { value: "real_estate", label: "🏠 تقييم عقاري", icon: Building2 },
  { value: "machinery_equipment", label: "⚙️ آلات ومعدات", icon: Wrench },
  { value: "mixed", label: "🏗️ مختلط", icon: Package },
];

const CONDITION_LABELS: Record<string, string> = {
  excellent: "ممتاز",
  good: "جيد",
  fair: "مقبول",
  poor: "ضعيف",
  scrap: "خردة",
  new: "جديد",
  operational: "يعمل",
  non_operational: "متوقف",
  needs_repair: "يحتاج صيانة",
  under_construction: "تحت الإنشاء",
  completed: "مكتمل",
};

const TYPE_LABELS: Record<string, string> = {
  real_estate: "عقار",
  machinery_equipment: "آلة / معدة",
};

type SortField = "id" | "name" | "type" | "condition" | "quantity";
type SortDir = "asc" | "desc";

export default function AssetInventoryTable({
  discipline,
  inventory,
  description,
  summary,
  onInventoryChange,
  onDescriptionChange,
  onDisciplineChange,
  onReanalyze,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCondition, setFilterCondition] = useState("all");
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [expandedAssetId, setExpandedAssetId] = useState<number | null>(null);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState<"real_estate" | "machinery_equipment">("real_estate");
  const [activeTab, setActiveTab] = useState("all");

  // Filter + sort
  const filteredAssets = useMemo(() => {
    let items = [...inventory];

    // Tab filter
    if (activeTab === "real_estate") items = items.filter(a => a.type === "real_estate");
    if (activeTab === "machinery") items = items.filter(a => a.type === "machinery_equipment");

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q) ||
        a.fields.some(f => f.value.toLowerCase().includes(q))
      );
    }

    // Condition filter
    if (filterCondition !== "all") {
      items = items.filter(a => a.condition === filterCondition);
    }

    // Sort
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "id": cmp = a.id - b.id; break;
        case "name": cmp = a.name.localeCompare(b.name, "ar"); break;
        case "type": cmp = a.type.localeCompare(b.type); break;
        case "condition": cmp = (a.condition || "").localeCompare(b.condition || ""); break;
        case "quantity": cmp = a.quantity - b.quantity; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [inventory, searchQuery, filterCondition, sortField, sortDir, activeTab]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const updateAssetField = (assetId: number, fieldKey: string, newValue: string) => {
    onInventoryChange(inventory.map(a =>
      a.id === assetId
        ? { ...a, fields: a.fields.map(f => f.key === fieldKey ? { ...f, value: newValue } : f) }
        : a
    ));
  };

  const updateAssetName = (assetId: number, name: string) => {
    onInventoryChange(inventory.map(a => a.id === assetId ? { ...a, name } : a));
  };

  const removeAsset = (assetId: number) => {
    onInventoryChange(inventory.filter(a => a.id !== assetId));
  };

  const duplicateAsset = (assetId: number) => {
    const asset = inventory.find(a => a.id === assetId);
    if (!asset) return;
    const maxId = Math.max(...inventory.map(a => a.id), 0);
    onInventoryChange([...inventory, { ...asset, id: maxId + 1, name: `${asset.name} (نسخة)` }]);
  };

  const addAsset = () => {
    if (!newAssetName.trim()) return;
    const maxId = Math.max(...inventory.map(a => a.id), 0);
    onInventoryChange([...inventory, {
      id: maxId + 1,
      name: newAssetName.trim(),
      type: newAssetType,
      category: newAssetType === "real_estate" ? "عقار" : "معدة",
      quantity: 1,
      condition: "good",
      fields: [],
      source: "إدخال يدوي",
    }]);
    setNewAssetName("");
    setShowAddAsset(false);
  };

  const addFieldToAsset = (assetId: number) => {
    onInventoryChange(inventory.map(a =>
      a.id === assetId
        ? { ...a, fields: [...a.fields, { key: `custom_${Date.now()}`, label: "حقل جديد", value: "", confidence: 100 }] }
        : a
    ));
  };

  const removeFieldFromAsset = (assetId: number, fieldKey: string) => {
    onInventoryChange(inventory.map(a =>
      a.id === assetId
        ? { ...a, fields: a.fields.filter(f => f.key !== fieldKey) }
        : a
    ));
  };

  const reCount = inventory.filter(a => a.type === "real_estate").length;
  const meCount = inventory.filter(a => a.type === "machinery_equipment").length;

  const conditionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    inventory.forEach(a => {
      const c = a.condition || "unknown";
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [inventory]);

  const getConfidenceColor = (c: number) => {
    if (c >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (c >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  return (
    <div className="space-y-4">
      {/* Discipline Badge */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {discipline === "real_estate" ? <Building2 className="w-5 h-5 text-primary" /> :
                 discipline === "machinery_equipment" ? <Wrench className="w-5 h-5 text-primary" /> :
                 <Package className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">نوع التقييم المكتشف</p>
                <Select value={discipline} onValueChange={onDisciplineChange}>
                  <SelectTrigger className="h-7 text-sm font-bold border-none shadow-none p-0 w-auto gap-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCIPLINE_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {onReanalyze && (
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={onReanalyze}>
                <RefreshCw className="w-3 h-3" />
                إعادة التحليل
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{inventory.length}</p>
            <p className="text-[11px] text-muted-foreground">إجمالي الأصول</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{reCount}</p>
            <p className="text-[11px] text-muted-foreground">عقارات</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{meCount}</p>
            <p className="text-[11px] text-muted-foreground">آلات ومعدات</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <div className="flex flex-wrap justify-center gap-1">
              {Object.entries(conditionCounts).slice(0, 3).map(([c, n]) => (
                <Badge key={c} variant="secondary" className="text-[9px]">
                  {CONDITION_LABELS[c] || c}: {n}
                </Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">توزيع الحالة</p>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              وصف الأصول الاحترافي
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setEditingDescription(!editingDescription)} className="text-xs gap-1">
              <Edit3 className="w-3 h-3" />
              {editingDescription ? "حفظ" : "تعديل"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {editingDescription ? (
            <Textarea value={description} onChange={e => onDescriptionChange(e.target.value)} rows={5} className="text-sm leading-relaxed" />
          ) : (
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {description || "لم يتم توليد وصف بعد"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              جدول جرد الأصول
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => setShowAddAsset(true)}>
                <Plus className="w-3 h-3" />
                إضافة أصل
              </Button>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث في الأصول..."
                className="pr-9 text-sm h-8"
              />
            </div>
            <Select value={filterCondition} onValueChange={setFilterCondition}>
              <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Tabs for mixed */}
          {discipline === "mixed" ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="px-4 pt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1 text-xs">الكل ({inventory.length})</TabsTrigger>
                  <TabsTrigger value="real_estate" className="flex-1 text-xs gap-1">
                    <Building2 className="w-3 h-3" /> عقارات ({reCount})
                  </TabsTrigger>
                  <TabsTrigger value="machinery" className="flex-1 text-xs gap-1">
                    <Wrench className="w-3 h-3" /> آلات ({meCount})
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value={activeTab} className="mt-0">
                {renderTable()}
              </TabsContent>
            </Tabs>
          ) : (
            renderTable()
          )}
        </CardContent>
      </Card>

      {/* Add Asset Dialog */}
      {showAddAsset && (
        <Card className="shadow-card border-dashed border-primary/40">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-bold text-foreground">إضافة أصل جديد</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={newAssetName}
                onChange={e => setNewAssetName(e.target.value)}
                placeholder="اسم / وصف الأصل"
                className="text-sm"
              />
              <Select value={newAssetType} onValueChange={v => setNewAssetType(v as any)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real_estate">🏠 عقار</SelectItem>
                  <SelectItem value="machinery_equipment">⚙️ آلة / معدة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowAddAsset(false)} className="text-xs">إلغاء</Button>
              <Button size="sm" onClick={addAsset} disabled={!newAssetName.trim()} className="text-xs">إضافة</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  function renderTable() {
    if (filteredAssets.length === 0) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">لا توجد أصول مطابقة</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center cursor-pointer" onClick={() => toggleSort("id")}>
                <span className="flex items-center justify-center gap-1"># <SortIcon field="id" /></span>
              </TableHead>
              <TableHead className="min-w-[180px] cursor-pointer" onClick={() => toggleSort("name")}>
                <span className="flex items-center gap-1">الأصل <SortIcon field="name" /></span>
              </TableHead>
              <TableHead className="w-24 cursor-pointer" onClick={() => toggleSort("type")}>
                <span className="flex items-center gap-1">النوع <SortIcon field="type" /></span>
              </TableHead>
              <TableHead className="w-16 cursor-pointer text-center" onClick={() => toggleSort("quantity")}>
                <span className="flex items-center justify-center gap-1">الكمية <SortIcon field="quantity" /></span>
              </TableHead>
              <TableHead className="w-24 cursor-pointer" onClick={() => toggleSort("condition")}>
                <span className="flex items-center gap-1">الحالة <SortIcon field="condition" /></span>
              </TableHead>
              <TableHead className="w-28">المصدر</TableHead>
              <TableHead className="w-20 text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAssets.map(asset => (
              <>
                <TableRow
                  key={asset.id}
                  className="cursor-pointer"
                  onClick={() => setExpandedAssetId(expandedAssetId === asset.id ? null : asset.id)}
                >
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">{asset.id}</TableCell>
                  <TableCell>
                    {editingAssetId === asset.id ? (
                      <Input
                        value={asset.name}
                        onChange={e => updateAssetName(asset.id, e.target.value)}
                        onBlur={() => setEditingAssetId(null)}
                        onKeyDown={e => e.key === "Enter" && setEditingAssetId(null)}
                        className="h-7 text-sm"
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">{asset.name}</span>
                        {asset.subcategory && (
                          <Badge variant="outline" className="text-[9px]">{asset.subcategory}</Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={asset.type === "real_estate" ? "default" : "secondary"} className="text-[10px]">
                      {TYPE_LABELS[asset.type] || asset.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center text-sm">{asset.quantity}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {CONDITION_LABELS[asset.condition || ""] || asset.condition || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                    {asset.source || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-0.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditingAssetId(asset.id)} className="p-1 hover:text-primary text-muted-foreground">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => duplicateAsset(asset.id)} className="p-1 hover:text-primary text-muted-foreground">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removeAsset(asset.id)} className="p-1 hover:text-destructive text-muted-foreground">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Expanded fields row */}
                {expandedAssetId === asset.id && (
                  <TableRow key={`${asset.id}-fields`}>
                    <TableCell colSpan={7} className="bg-muted/30 p-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-muted-foreground">
                            المواصفات المستخرجة ({asset.fields.length} حقل)
                          </p>
                          <Button size="sm" variant="ghost" className="text-[10px] h-6 gap-1" onClick={() => addFieldToAsset(asset.id)}>
                            <Plus className="w-3 h-3" /> إضافة حقل
                          </Button>
                        </div>
                        {asset.fields.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-3">لا توجد حقول مستخرجة</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {asset.fields.map(field => (
                              <div key={field.key} className="p-2 rounded-lg border bg-card flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-muted-foreground">{field.label}</span>
                                  <div className="flex items-center gap-1">
                                    <span className={`text-[9px] font-mono ${getConfidenceColor(field.confidence)}`}>
                                      {field.confidence}%
                                    </span>
                                    <button onClick={() => removeFieldFromAsset(asset.id, field.key)} className="text-muted-foreground/40 hover:text-destructive">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <Input
                                  value={field.value}
                                  onChange={e => updateAssetField(asset.id, field.key, e.target.value)}
                                  className="h-6 text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }
}
