import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Search, Plus, Trash2, Edit3, ChevronDown, ChevronUp, BarChart3,
  Building2, Wrench, Package, FileText, AlertTriangle, X, Copy,
  ShieldCheck, Eye, CheckCircle, XCircle, RefreshCw, Filter, Layers,
} from "lucide-react";

interface ExtractedAsset {
  id: string;
  asset_index: number;
  name: string;
  asset_type: string;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  quantity: number;
  condition: string;
  confidence: number;
  asset_data: any;
  source_files: any;
  source_evidence: string | null;
  duplicate_group: string | null;
  duplicate_status: string;
  review_status: string;
  missing_fields: string[];
}

interface FileClassification {
  id: string;
  file_name: string;
  document_category: string;
  relevance: string;
  extracted_info: string | null;
  processing_status: string;
  confidence: number;
}

interface ReviewGate {
  totalAssets: number;
  approvedCount: number;
  needsReviewCount: number;
  pendingCount: number;
  rejectedCount: number;
  duplicatesUnresolved: number;
  missingCriticalFields: number;
  lowConfidenceItems: number;
  canProceed: boolean;
}

interface Props {
  jobId: string;
  onSubmit: (assets: ExtractedAsset[], discipline: string, description: string) => void;
  onBack: () => void;
}

const CONDITION_LABELS: Record<string, string> = {
  excellent: "ممتاز", good: "جيد", fair: "مقبول", poor: "ضعيف",
  scrap: "خردة", new: "جديد", unknown: "غير محدد",
};

const REVIEW_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "قيد المراجعة", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Eye },
  approved: { label: "معتمد", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle },
  needs_review: { label: "يحتاج مراجعة", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: AlertTriangle },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  deed: "صك ملكية", building_permit: "رخصة بناء", floor_plan: "مخطط",
  property_photo: "صورة عقار", machinery_photo: "صورة معدة", identity_doc: "وثيقة هوية",
  invoice: "فاتورة", contract: "عقد", technical_report: "تقرير فني",
  location_map: "خريطة", spreadsheet: "جدول بيانات", archive: "مضغوط", other: "أخرى",
};

type SortField = "asset_index" | "name" | "asset_type" | "confidence" | "review_status";

export default function AssetReviewWorkspace({ jobId, onSubmit, onBack }: Props) {
  const [assets, setAssets] = useState<ExtractedAsset[]>([]);
  const [files, setFiles] = useState<FileClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [discipline, setDiscipline] = useState("real_estate");
  const [description, setDescription] = useState("");
  const [activeView, setActiveView] = useState("table");
  const [activePanel, setActivePanel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("asset_index");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    setLoading(true);
    const [assetsRes, filesRes, jobRes] = await Promise.all([
      supabase.from("extracted_assets").select("*").eq("job_id", jobId).order("asset_index"),
      supabase.from("file_classifications").select("*").eq("job_id", jobId),
      supabase.from("processing_jobs").select("discipline, description").eq("id", jobId).single(),
    ]);

    if (assetsRes.data) setAssets(assetsRes.data as any[]);
    if (filesRes.data) setFiles(filesRes.data as any[]);
    if (jobRes.data) {
      setDiscipline((jobRes.data as any).discipline || "real_estate");
      setDescription((jobRes.data as any).description || "");
    }
    setLoading(false);
  };

  // Review gate calculation
  const reviewGate = useMemo<ReviewGate>(() => {
    const approvedCount = assets.filter(a => a.review_status === "approved").length;
    const needsReviewCount = assets.filter(a => a.review_status === "needs_review").length;
    const pendingCount = assets.filter(a => a.review_status === "pending").length;
    const rejectedCount = assets.filter(a => a.review_status === "rejected").length;
    const duplicatesUnresolved = assets.filter(a => a.duplicate_status === "potential_duplicate").length;
    const missingCriticalFields = assets.filter(a => (a.missing_fields?.length || 0) > 0).length;
    const lowConfidenceItems = assets.filter(a => a.confidence < 60).length;
    
    return {
      totalAssets: assets.length,
      approvedCount,
      needsReviewCount,
      pendingCount,
      rejectedCount,
      duplicatesUnresolved,
      missingCriticalFields,
      lowConfidenceItems,
      canProceed: assets.length > 0 && duplicatesUnresolved === 0 && needsReviewCount === 0 && pendingCount === 0,
    };
  }, [assets]);

  // Filter & sort
  const filteredAssets = useMemo(() => {
    let items = [...assets];

    if (activePanel === "needs_review") items = items.filter(a => a.review_status === "needs_review" || a.review_status === "pending");
    else if (activePanel === "duplicates") items = items.filter(a => a.duplicate_status === "potential_duplicate");
    else if (activePanel === "low_confidence") items = items.filter(a => a.confidence < 60);
    else if (activePanel === "missing") items = items.filter(a => (a.missing_fields?.length || 0) > 0);
    else if (activePanel === "real_estate") items = items.filter(a => a.asset_type === "real_estate");
    else if (activePanel === "machinery") items = items.filter(a => a.asset_type === "machinery_equipment");

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.description || "").toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "asset_index": cmp = a.asset_index - b.asset_index; break;
        case "name": cmp = a.name.localeCompare(b.name, "ar"); break;
        case "asset_type": cmp = a.asset_type.localeCompare(b.asset_type); break;
        case "confidence": cmp = a.confidence - b.confidence; break;
        case "review_status": cmp = a.review_status.localeCompare(b.review_status); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [assets, activePanel, searchQuery, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  // Asset CRUD operations
  const updateAsset = async (id: string, updates: Partial<ExtractedAsset>) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    await supabase.from("extracted_assets").update(updates as any).eq("id", id);
  };

  const updateAssetField = (id: string, fieldKey: string, newValue: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    const fields = (asset.asset_data?.fields || []).map((f: any) =>
      f.key === fieldKey ? { ...f, value: newValue } : f
    );
    updateAsset(id, { asset_data: { ...asset.asset_data, fields } } as any);
  };

  const approveAsset = (id: string) => updateAsset(id, { review_status: "approved" } as any);
  const rejectAsset = (id: string) => updateAsset(id, { review_status: "rejected" } as any);
  const markNeedsReview = (id: string) => updateAsset(id, { review_status: "needs_review" } as any);

  const approveAll = async () => {
    const ids = assets.filter(a => a.review_status !== "rejected").map(a => a.id);
    setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, review_status: "approved" } : a));
    await supabase.from("extracted_assets").update({ review_status: "approved" } as any).eq("job_id", jobId).neq("review_status", "rejected");
  };

  const deleteAsset = async (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
    await supabase.from("extracted_assets").delete().eq("id", id);
  };

  const addManualAsset = async () => {
    const maxIdx = Math.max(0, ...assets.map(a => a.asset_index));
    const newAsset = {
      job_id: jobId,
      asset_index: maxIdx + 1,
      name: "أصل جديد",
      asset_type: "real_estate",
      quantity: 1,
      condition: "unknown",
      confidence: 100,
      asset_data: { fields: [] },
      source_evidence: "إدخال يدوي",
      review_status: "approved",
      missing_fields: [],
    };
    const { data } = await supabase.from("extracted_assets").insert(newAsset).select().single();
    if (data) setAssets(prev => [...prev, data as any]);
  };

  const getConfidenceColor = (c: number) => {
    if (c >= 85) return "text-emerald-600 dark:text-emerald-400";
    if (c >= 70) return "text-amber-600 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  const getConfidenceBg = (c: number) => {
    if (c >= 85) return "bg-emerald-500";
    if (c >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-10 text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm text-muted-foreground">جارٍ تحميل سجل الأصول...</p>
        </CardContent>
      </Card>
    );
  }

  const reCount = assets.filter(a => a.asset_type === "real_estate").length;
  const meCount = assets.filter(a => a.asset_type === "machinery_equipment").length;

  return (
    <div className="space-y-4">
      {/* Review Gate */}
      <Card className={`shadow-card border-2 ${reviewGate.canProceed ? "border-success/30" : "border-amber-400/30"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reviewGate.canProceed ? "bg-success/10" : "bg-amber-100 dark:bg-amber-900/20"}`}>
              {reviewGate.canProceed
                ? <ShieldCheck className="w-5 h-5 text-success" />
                : <AlertTriangle className="w-5 h-5 text-amber-500" />
              }
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                {reviewGate.canProceed ? "سجل الأصول جاهز للإرسال" : "يلزم مراجعة السجل قبل الإرسال"}
              </p>
              <p className="text-xs text-muted-foreground">
                {reviewGate.totalAssets} أصل مكتشف • {reviewGate.approvedCount} معتمد
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-lg font-bold text-foreground">{reviewGate.totalAssets}</p>
              <p className="text-[10px] text-muted-foreground">إجمالي الأصول</p>
            </div>
            <button onClick={() => setActivePanel("duplicates")} className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <p className={`text-lg font-bold ${reviewGate.duplicatesUnresolved > 0 ? "text-amber-500" : "text-success"}`}>
                {reviewGate.duplicatesUnresolved}
              </p>
              <p className="text-[10px] text-muted-foreground">تكرارات محتملة</p>
            </button>
            <button onClick={() => setActivePanel("missing")} className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <p className={`text-lg font-bold ${reviewGate.missingCriticalFields > 0 ? "text-destructive" : "text-success"}`}>
                {reviewGate.missingCriticalFields}
              </p>
              <p className="text-[10px] text-muted-foreground">حقول ناقصة</p>
            </button>
            <button onClick={() => setActivePanel("low_confidence")} className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <p className={`text-lg font-bold ${reviewGate.lowConfidenceItems > 0 ? "text-orange-500" : "text-success"}`}>
                {reviewGate.lowConfidenceItems}
              </p>
              <p className="text-[10px] text-muted-foreground">ثقة منخفضة</p>
            </button>
          </div>

          {/* Approval progress */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>تقدم المراجعة</span>
              <span>{reviewGate.approvedCount} / {reviewGate.totalAssets}</span>
            </div>
            <Progress value={reviewGate.totalAssets > 0 ? (reviewGate.approvedCount / reviewGate.totalAssets) * 100 : 0} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      {/* Discipline + Description */}
      <Card className="shadow-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                {discipline === "real_estate" ? <Building2 className="w-4 h-4 text-primary" /> :
                 discipline === "machinery_equipment" ? <Wrench className="w-4 h-4 text-primary" /> :
                 <Package className="w-4 h-4 text-primary" />}
              </div>
              <Select value={discipline} onValueChange={setDiscipline}>
                <SelectTrigger className="h-8 border-none shadow-none p-0 w-auto text-sm font-bold gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="real_estate">🏠 تقييم عقاري</SelectItem>
                  <SelectItem value="machinery_equipment">⚙️ آلات ومعدات</SelectItem>
                  <SelectItem value="mixed">🏗️ مختلط</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1.5">
              <Badge variant="outline" className="text-[10px]">عقارات: {reCount}</Badge>
              <Badge variant="outline" className="text-[10px]">آلات: {meCount}</Badge>
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3" /> الوصف المهني
              </span>
              <Button variant="ghost" size="sm" onClick={() => setEditingDescription(!editingDescription)} className="text-[10px] h-6 gap-1">
                <Edit3 className="w-3 h-3" />
                {editingDescription ? "حفظ" : "تعديل"}
              </Button>
            </div>
            {editingDescription ? (
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="text-sm" />
            ) : (
              <div className="p-3 rounded-lg bg-muted/30 border border-border text-sm leading-relaxed whitespace-pre-line">
                {description || "لم يتم توليد وصف بعد"}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Toolbar */}
      <Card className="shadow-card">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="بحث في الأصول..." className="pr-9 text-sm h-8" />
            </div>
            <Select value={activePanel} onValueChange={setActivePanel}>
              <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
                <Filter className="w-3 h-3 ml-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل ({assets.length})</SelectItem>
                <SelectItem value="needs_review">يحتاج مراجعة ({reviewGate.needsReviewCount + reviewGate.pendingCount})</SelectItem>
                <SelectItem value="duplicates">تكرارات ({reviewGate.duplicatesUnresolved})</SelectItem>
                <SelectItem value="low_confidence">ثقة منخفضة ({reviewGate.lowConfidenceItems})</SelectItem>
                <SelectItem value="missing">حقول ناقصة ({reviewGate.missingCriticalFields})</SelectItem>
                <SelectItem value="real_estate">عقارات ({reCount})</SelectItem>
                <SelectItem value="machinery">آلات ({meCount})</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={addManualAsset}>
              <Plus className="w-3 h-3" /> إضافة أصل
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={approveAll}>
              <CheckCircle className="w-3 h-3" /> اعتماد الكل
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Asset Table */}
      <Card className="shadow-card">
        <CardContent className="p-0">
          {filteredAssets.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">لا توجد أصول مطابقة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center cursor-pointer" onClick={() => toggleSort("asset_index")}>#<SortIcon field="asset_index" /></TableHead>
                    <TableHead className="min-w-[200px] cursor-pointer" onClick={() => toggleSort("name")}>الأصل<SortIcon field="name" /></TableHead>
                    <TableHead className="w-20 cursor-pointer" onClick={() => toggleSort("asset_type")}>النوع<SortIcon field="asset_type" /></TableHead>
                    <TableHead className="w-14 text-center">الكمية</TableHead>
                    <TableHead className="w-20">الحالة</TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => toggleSort("confidence")}>الثقة<SortIcon field="confidence" /></TableHead>
                    <TableHead className="w-24">المصدر</TableHead>
                    <TableHead className="w-28 cursor-pointer" onClick={() => toggleSort("review_status")}>المراجعة<SortIcon field="review_status" /></TableHead>
                    <TableHead className="w-24 text-center">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map(asset => {
                    const reviewCfg = REVIEW_STATUS_CONFIG[asset.review_status] || REVIEW_STATUS_CONFIG.pending;
                    const ReviewIcon = reviewCfg.icon;
                    const fields = asset.asset_data?.fields || [];

                    return (
                      <>
                        <TableRow key={asset.id} className="cursor-pointer hover:bg-muted/30"
                          onClick={() => setExpandedId(expandedId === asset.id ? null : asset.id)}>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">{asset.asset_index}</TableCell>
                          <TableCell>
                            {editingId === asset.id ? (
                              <Input value={asset.name}
                                onChange={e => updateAsset(asset.id, { name: e.target.value } as any)}
                                onBlur={() => setEditingId(null)}
                                onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                                className="h-7 text-sm" autoFocus
                                onClick={e => e.stopPropagation()} />
                            ) : (
                              <div>
                                <span className="text-sm font-medium">{asset.name}</span>
                                {asset.duplicate_status === "potential_duplicate" && (
                                  <Badge variant="outline" className="text-[9px] mr-1 border-amber-300 text-amber-600">
                                    <Layers className="w-2.5 h-2.5 ml-0.5" /> محتمل التكرار
                                  </Badge>
                                )}
                                {(asset.missing_fields?.length || 0) > 0 && (
                                  <Badge variant="outline" className="text-[9px] mr-1 border-destructive/30 text-destructive">
                                    {asset.missing_fields.length} ناقص
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={asset.asset_type === "real_estate" ? "default" : "secondary"} className="text-[10px]">
                              {asset.asset_type === "real_estate" ? "عقار" : "آلة/معدة"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm">{asset.quantity}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {CONDITION_LABELS[asset.condition] || asset.condition}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <div className={`w-2 h-2 rounded-full ${getConfidenceBg(asset.confidence)}`} />
                              <span className={`text-xs font-mono ${getConfidenceColor(asset.confidence)}`}>
                                {asset.confidence}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                            {asset.source_evidence || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-[10px] gap-0.5 ${reviewCfg.color}`}>
                              <ReviewIcon className="w-3 h-3" /> {reviewCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-0.5" onClick={e => e.stopPropagation()}>
                              <button onClick={() => approveAsset(asset.id)} className="p-1 hover:text-success text-muted-foreground" title="اعتماد">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => setEditingId(asset.id)} className="p-1 hover:text-primary text-muted-foreground" title="تعديل">
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => duplicateAssetRow(asset)} className="p-1 hover:text-primary text-muted-foreground" title="نسخ">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => deleteAsset(asset.id)} className="p-1 hover:text-destructive text-muted-foreground" title="حذف">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expanded detail */}
                        {expandedId === asset.id && (
                          <TableRow key={`${asset.id}-exp`}>
                            <TableCell colSpan={9} className="bg-muted/20 p-4">
                              <div className="space-y-3">
                                {/* Description */}
                                {asset.description && (
                                  <div className="p-2 rounded-lg bg-card border text-sm text-muted-foreground">
                                    {asset.description}
                                  </div>
                                )}

                                {/* Missing fields warning */}
                                {(asset.missing_fields?.length || 0) > 0 && (
                                  <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                                    <p className="text-xs font-bold text-destructive mb-1">حقول مطلوبة ناقصة:</p>
                                    <div className="flex flex-wrap gap-1">
                                      {asset.missing_fields.map(f => (
                                        <Badge key={f} variant="outline" className="text-[9px] border-destructive/30 text-destructive">{f}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Fields */}
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-bold text-muted-foreground">المواصفات ({fields.length} حقل)</p>
                                  <Button size="sm" variant="ghost" className="text-[10px] h-6 gap-1"
                                    onClick={() => addFieldToAsset(asset.id)}>
                                    <Plus className="w-3 h-3" /> إضافة حقل
                                  </Button>
                                </div>
                                {fields.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {fields.map((field: any) => (
                                      <div key={field.key} className="p-2 rounded-lg border bg-card flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] text-muted-foreground">{field.label}</span>
                                          <span className={`text-[9px] font-mono ${getConfidenceColor(field.confidence)}`}>
                                            {field.confidence}%
                                          </span>
                                        </div>
                                        <Input value={field.value}
                                          onChange={e => updateAssetField(asset.id, field.key, e.target.value)}
                                          className="h-6 text-xs" />
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Source evidence */}
                                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <FileText className="w-3 h-3" />
                                  المصدر: {asset.source_evidence || "غير محدد"}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Classifications */}
      {files.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              تصنيف المستندات ({files.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {files.map(file => (
                <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{file.file_name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {CATEGORY_LABELS[file.document_category] || file.document_category}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${
                    file.relevance === "high" ? "border-emerald-300 text-emerald-600" :
                    file.relevance === "medium" ? "border-amber-300 text-amber-600" :
                    "border-border text-muted-foreground"
                  }`}>
                    {file.relevance === "high" ? "عالي" : file.relevance === "medium" ? "متوسط" : "منخفض"}
                  </Badge>
                  {file.processing_status === "failed" && (
                    <Badge variant="destructive" className="text-[9px]">فشل</Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit button */}
      <div className="space-y-2">
        {!reviewGate.canProceed && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 inline ml-1" />
            {reviewGate.needsReviewCount + reviewGate.pendingCount > 0 && ` ${reviewGate.needsReviewCount + reviewGate.pendingCount} أصل يحتاج مراجعة.`}
            {reviewGate.duplicatesUnresolved > 0 && ` ${reviewGate.duplicatesUnresolved} تكرار محتمل.`}
            {" "}يرجى معالجة جميع العناصر قبل الإرسال أو اعتماد الكل.
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            العودة للتعديل
          </Button>
          <Button
            onClick={() => onSubmit(assets, discipline, description)}
            className="flex-1 gap-2"
            disabled={!reviewGate.canProceed}
          >
            <ShieldCheck className="w-4 h-4" />
            إرسال طلب التقييم ({reviewGate.approvedCount} أصل)
          </Button>
        </div>
      </div>
    </div>
  );

  async function duplicateAssetRow(asset: ExtractedAsset) {
    const maxIdx = Math.max(0, ...assets.map(a => a.asset_index));
    const dup = {
      job_id: jobId,
      asset_index: maxIdx + 1,
      name: `${asset.name} (نسخة)`,
      asset_type: asset.asset_type,
      category: asset.category,
      subcategory: asset.subcategory,
      description: asset.description,
      quantity: asset.quantity,
      condition: asset.condition,
      confidence: asset.confidence,
      asset_data: asset.asset_data,
      source_evidence: asset.source_evidence,
      review_status: "pending",
      missing_fields: asset.missing_fields,
    };
    const { data } = await supabase.from("extracted_assets").insert(dup).select().single();
    if (data) setAssets(prev => [...prev, data as any]);
  }

  async function addFieldToAsset(assetId: string) {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const fields = [...(asset.asset_data?.fields || []), {
      key: `custom_${Date.now()}`, label: "حقل جديد", value: "", confidence: 100,
    }];
    updateAsset(assetId, { asset_data: { ...asset.asset_data, fields } } as any);
  }
}
