import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Plus, Trash2, Edit3, ChevronDown, ChevronUp,
  Building2, Wrench, Package, FileText, AlertTriangle, X, Copy,
  ShieldCheck, Eye, CheckCircle, XCircle, RefreshCw, Filter, Layers,
  LayoutGrid, List, History, Merge, Download,
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
  review_notes: string | null;
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
  pending: { label: "جديد", color: "bg-muted text-muted-foreground", icon: Eye },
  needs_review: { label: "يحتاج مراجعة", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: AlertTriangle },
  corrected: { label: "تم التصحيح", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Edit3 },
  verified: { label: "موثّق", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", icon: ShieldCheck },
  approved: { label: "معتمد", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle },
  merged: { label: "مُدمج", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Merge },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  deed: "صك ملكية", building_permit: "رخصة بناء", floor_plan: "مخطط",
  property_photo: "صورة عقار", machinery_photo: "صورة معدة", identity_doc: "وثيقة هوية",
  invoice: "فاتورة", contract: "عقد", technical_report: "تقرير فني",
  location_map: "خريطة", spreadsheet: "جدول بيانات", archive: "مضغوط", other: "أخرى",
};

type SortField = "asset_index" | "name" | "asset_type" | "confidence" | "review_status";
type ViewMode = "table" | "cards" | "grouped";

export default function AssetReviewWorkspace({ jobId, onSubmit, onBack }: Props) {
  const { toast } = useToast();
  const [assets, setAssets] = useState<ExtractedAsset[]>([]);
  const [files, setFiles] = useState<FileClassification[]>([]);
  const [loading, setLoading] = useState(true);
  const [discipline, setDiscipline] = useState("real_estate");
  const [description, setDescription] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [activePanel, setActivePanel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("asset_index");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null));
  }, []);

  useEffect(() => { loadData(); }, [jobId]);

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

  const logEdit = useCallback(async (assetId: string, action: string, fieldName?: string, oldVal?: string, newVal?: string) => {
    if (!userId) return;
    try {
      await supabase.from("asset_edit_logs" as any).insert({
        asset_id: assetId, job_id: jobId, user_id: userId, action,
        field_name: fieldName || null, old_value: oldVal || null, new_value: newVal || null,
      });
    } catch { /* silent */ }
  }, [userId, jobId]);

  const loadAuditLogs = async () => {
    const { data } = await supabase
      .from("asset_edit_logs" as any).select("*").eq("job_id", jobId)
      .order("created_at", { ascending: false }).limit(100);
    if (data) setAuditLogs(data);
    setShowAuditLog(true);
  };

  // Review gate
  const reviewGate = useMemo<ReviewGate>(() => {
    const approvedCount = assets.filter(a => ["approved", "verified"].includes(a.review_status)).length;
    const needsReviewCount = assets.filter(a => a.review_status === "needs_review").length;
    const pendingCount = assets.filter(a => a.review_status === "pending").length;
    const rejectedCount = assets.filter(a => a.review_status === "rejected").length;
    const duplicatesUnresolved = assets.filter(a => a.duplicate_status === "potential_duplicate").length;
    const missingCriticalFields = assets.filter(a => (a.missing_fields?.length || 0) > 0 && a.review_status !== "rejected").length;
    const lowConfidenceItems = assets.filter(a => a.confidence < 60 && a.review_status !== "rejected").length;
    return {
      totalAssets: assets.length, approvedCount, needsReviewCount, pendingCount, rejectedCount,
      duplicatesUnresolved, missingCriticalFields, lowConfidenceItems,
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
    else if (activePanel === "approved") items = items.filter(a => ["approved", "verified"].includes(a.review_status));

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(a => a.name.toLowerCase().includes(q) || (a.category || "").toLowerCase().includes(q) || (a.description || "").toLowerCase().includes(q));
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

  const groupedAssets = useMemo(() => {
    const groups: Record<string, ExtractedAsset[]> = {};
    for (const a of filteredAssets) {
      const key = a.category || (a.asset_type === "real_estate" ? "عقارات" : "آلات ومعدات");
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
    return groups;
  }, [filteredAssets]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
  };

  // ── Bulk selection ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAssets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAssets.map(a => a.id)));
    }
  };

  const bulkSetStatus = async (status: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, review_status: status } : a));
    await supabase.from("extracted_assets").update({ review_status: status } as any).in("id", ids);
    toast({ title: `تم تحديث ${ids.length} أصل إلى "${REVIEW_STATUS_CONFIG[status]?.label || status}"` });
    setSelectedIds(new Set());
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setAssets(prev => prev.filter(a => !ids.includes(a.id)));
    await supabase.from("extracted_assets").delete().in("id", ids);
    toast({ title: `تم حذف ${ids.length} أصل` });
    setSelectedIds(new Set());
  };

  // ── Asset CRUD ──
  const updateAsset = async (id: string, updates: Partial<ExtractedAsset>, logAction?: string, fieldName?: string, oldVal?: string, newVal?: string) => {
    setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    await supabase.from("extracted_assets").update(updates as any).eq("id", id);
    if (logAction) logEdit(id, logAction, fieldName, oldVal, newVal);
  };

  const updateAssetField = (id: string, fieldKey: string, newValue: string) => {
    const asset = assets.find(a => a.id === id);
    if (!asset) return;
    const fields = (asset.asset_data?.fields || []).map((f: any) => f.key === fieldKey ? { ...f, value: newValue } : f);
    const oldField = (asset.asset_data?.fields || []).find((f: any) => f.key === fieldKey);
    updateAsset(id, { asset_data: { ...asset.asset_data, fields } } as any, "edit_field", fieldKey, oldField?.value, newValue);
  };

  const setReviewStatus = (id: string, status: string) => {
    const asset = assets.find(a => a.id === id);
    updateAsset(id, { review_status: status } as any, "status_change", "review_status", asset?.review_status, status);
  };

  const approveAll = async () => {
    const ids = assets.filter(a => a.review_status !== "rejected").map(a => a.id);
    setAssets(prev => prev.map(a => ids.includes(a.id) ? { ...a, review_status: "approved" } : a));
    await supabase.from("extracted_assets").update({ review_status: "approved" } as any).eq("job_id", jobId).neq("review_status", "rejected");
    toast({ title: `تم اعتماد ${ids.length} أصل` });
  };

  const deleteAsset = async (id: string) => {
    const asset = assets.find(a => a.id === id);
    logEdit(id, "delete", "asset", asset?.name);
    setAssets(prev => prev.filter(a => a.id !== id));
    await supabase.from("extracted_assets").delete().eq("id", id);
  };

  const mergeAssets = async (keepId: string, removeId: string) => {
    const keep = assets.find(a => a.id === keepId);
    const remove = assets.find(a => a.id === removeId);
    if (!keep || !remove) return;
    const keepFields = [...(keep.asset_data?.fields || [])];
    for (const rf of (remove.asset_data?.fields || [])) {
      const existing = keepFields.find((f: any) => f.key === rf.key);
      if (!existing || (!existing.value && rf.value) || (rf.confidence > existing.confidence)) {
        if (existing) Object.assign(existing, rf); else keepFields.push(rf);
      }
    }
    await updateAsset(keepId, { asset_data: { ...keep.asset_data, fields: keepFields }, confidence: Math.max(keep.confidence, remove.confidence), review_status: "merged", duplicate_status: "resolved" } as any, "merge", "merged_with", remove.name);
    await updateAsset(removeId, { review_status: "rejected", duplicate_status: "resolved" } as any, "merged_into", "merged_into", keep.name);
  };

  const addManualAsset = async () => {
    const maxIdx = Math.max(0, ...assets.map(a => a.asset_index));
    const { data } = await supabase.from("extracted_assets").insert({
      job_id: jobId, asset_index: maxIdx + 1, name: "أصل جديد", asset_type: "real_estate",
      quantity: 1, condition: "unknown", confidence: 100, asset_data: { fields: [] },
      source_evidence: "إدخال يدوي", review_status: "approved", missing_fields: [],
    }).select().single();
    if (data) { setAssets(prev => [...prev, data as any]); logEdit((data as any).id, "create_manual"); }
  };

  const duplicateAssetRow = async (asset: ExtractedAsset) => {
    const maxIdx = Math.max(0, ...assets.map(a => a.asset_index));
    const { data } = await supabase.from("extracted_assets").insert({
      job_id: jobId, asset_index: maxIdx + 1, name: `${asset.name} (نسخة)`, asset_type: asset.asset_type,
      category: asset.category, subcategory: asset.subcategory, description: asset.description,
      quantity: asset.quantity, condition: asset.condition, confidence: asset.confidence,
      asset_data: asset.asset_data, source_evidence: asset.source_evidence,
      review_status: "pending", missing_fields: asset.missing_fields,
    }).select().single();
    if (data) { setAssets(prev => [...prev, data as any]); logEdit((data as any).id, "duplicate", "source", asset.name); }
  };

  const addFieldToAsset = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const fields = [...(asset.asset_data?.fields || []), { key: `custom_${Date.now()}`, label: "حقل جديد", value: "", confidence: 100 }];
    updateAsset(assetId, { asset_data: { ...asset.asset_data, fields } } as any, "add_field");
  };

  // ── Export to CSV ──
  const exportToCSV = () => {
    const activeAssets = assets.filter(a => a.review_status !== "rejected");
    const headers = ["#", "الاسم", "النوع", "التصنيف", "الكمية", "الحالة", "الثقة%", "المصدر", "المراجعة"];
    const rows = activeAssets.map(a => [
      a.asset_index, a.name, a.asset_type === "real_estate" ? "عقار" : "آلة/معدة",
      a.category || "", a.quantity, CONDITION_LABELS[a.condition] || a.condition,
      a.confidence, a.source_evidence || "", REVIEW_STATUS_CONFIG[a.review_status]?.label || a.review_status,
    ]);
    const BOM = "\uFEFF";
    const csv = BOM + [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `asset-inventory-${jobId.substring(0, 8)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast({ title: `تم تصدير ${activeAssets.length} أصل` });
  };

  const getConfidenceColor = (c: number) => c >= 85 ? "text-emerald-600 dark:text-emerald-400" : c >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400";
  const getConfidenceBg = (c: number) => c >= 85 ? "bg-emerald-500" : c >= 70 ? "bg-amber-500" : "bg-red-500";

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

  const reCount = assets.filter(a => a.asset_type === "real_estate" && a.review_status !== "rejected").length;
  const meCount = assets.filter(a => a.asset_type === "machinery_equipment" && a.review_status !== "rejected").length;

  // ── Render asset card ──
  const renderAssetCard = (asset: ExtractedAsset) => {
    const reviewCfg = REVIEW_STATUS_CONFIG[asset.review_status] || REVIEW_STATUS_CONFIG.pending;
    const ReviewIcon = reviewCfg.icon;
    const fields = asset.asset_data?.fields || [];
    const isSelected = selectedIds.has(asset.id);

    return (
      <Card key={asset.id} className={`shadow-sm hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-primary" : ""}`}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(asset.id)} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant={asset.asset_type === "real_estate" ? "default" : "secondary"} className="text-[9px] shrink-0">
                    {asset.asset_type === "real_estate" ? "عقار" : "آلة"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">#{asset.asset_index}</span>
                </div>
                <p className="text-sm font-semibold truncate">{asset.name}</p>
              </div>
            </div>
            <Badge className={`text-[9px] gap-0.5 shrink-0 ${reviewCfg.color}`}>
              <ReviewIcon className="w-3 h-3" /> {reviewCfg.label}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {fields.slice(0, 4).map((f: any) => (
              <div key={f.key} className="text-[10px]">
                <span className="text-muted-foreground">{f.label}: </span>
                <span className="font-medium">{f.value || "—"}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${getConfidenceBg(asset.confidence)}`} />
              <span className={`text-[10px] font-mono ${getConfidenceColor(asset.confidence)}`}>{asset.confidence}%</span>
              <span className="text-[10px] text-muted-foreground">• كمية: {asset.quantity}</span>
            </div>
            <div className="flex gap-0.5">
              <button onClick={() => setReviewStatus(asset.id, "approved")} className="p-1 hover:text-success text-muted-foreground"><CheckCircle className="w-3 h-3" /></button>
              <button onClick={() => setExpandedId(asset.id)} className="p-1 hover:text-primary text-muted-foreground"><Eye className="w-3 h-3" /></button>
              <button onClick={() => deleteAsset(asset.id)} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3 h-3" /></button>
            </div>
          </div>
          {(asset.duplicate_status === "potential_duplicate" || (asset.missing_fields?.length || 0) > 0) && (
            <div className="flex gap-1 flex-wrap">
              {asset.duplicate_status === "potential_duplicate" && (
                <Badge variant="outline" className="text-[8px] border-amber-300 text-amber-600"><Layers className="w-2 h-2 ml-0.5" /> تكرار</Badge>
              )}
              {(asset.missing_fields?.length || 0) > 0 && (
                <Badge variant="outline" className="text-[8px] border-destructive/30 text-destructive">{asset.missing_fields.length} ناقص</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // ── Render table row ──
  const renderTableRow = (asset: ExtractedAsset) => {
    const reviewCfg = REVIEW_STATUS_CONFIG[asset.review_status] || REVIEW_STATUS_CONFIG.pending;
    const ReviewIcon = reviewCfg.icon;
    const fields = asset.asset_data?.fields || [];
    const isExpanded = expandedId === asset.id;
    const isSelected = selectedIds.has(asset.id);

    return (
      <>
        <TableRow key={asset.id} className={`cursor-pointer hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
          onClick={() => setExpandedId(isExpanded ? null : asset.id)}>
          <TableCell className="text-center" onClick={e => e.stopPropagation()}>
            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(asset.id)} />
          </TableCell>
          <TableCell className="text-center font-mono text-xs text-muted-foreground">{asset.asset_index}</TableCell>
          <TableCell>
            {editingId === asset.id ? (
              <Input value={asset.name}
                onChange={e => updateAsset(asset.id, { name: e.target.value } as any, "edit", "name", asset.name, e.target.value)}
                onBlur={() => setEditingId(null)} onKeyDown={e => e.key === "Enter" && setEditingId(null)}
                className="h-7 text-sm" autoFocus onClick={e => e.stopPropagation()} />
            ) : (
              <div>
                <span className="text-sm font-medium">{asset.name}</span>
                {asset.duplicate_status === "potential_duplicate" && (
                  <Badge variant="outline" className="text-[9px] mr-1 border-amber-300 text-amber-600">
                    <Layers className="w-2.5 h-2.5 ml-0.5" /> تكرار
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
            <Badge variant="outline" className="text-[10px]">{CONDITION_LABELS[asset.condition] || asset.condition}</Badge>
          </TableCell>
          <TableCell className="text-center">
            <div className="flex items-center justify-center gap-1">
              <div className={`w-2 h-2 rounded-full ${getConfidenceBg(asset.confidence)}`} />
              <span className={`text-xs font-mono ${getConfidenceColor(asset.confidence)}`}>{asset.confidence}%</span>
            </div>
          </TableCell>
          <TableCell className="text-[10px] text-muted-foreground truncate max-w-[100px]">{asset.source_evidence || "—"}</TableCell>
          <TableCell>
            <Badge className={`text-[10px] gap-0.5 ${reviewCfg.color}`}><ReviewIcon className="w-3 h-3" /> {reviewCfg.label}</Badge>
          </TableCell>
          <TableCell>
            <div className="flex items-center justify-center gap-0.5" onClick={e => e.stopPropagation()}>
              <button onClick={() => setReviewStatus(asset.id, "approved")} className="p-1 hover:text-success text-muted-foreground" title="اعتماد"><CheckCircle className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditingId(asset.id)} className="p-1 hover:text-primary text-muted-foreground" title="تعديل"><Edit3 className="w-3.5 h-3.5" /></button>
              <button onClick={() => duplicateAssetRow(asset)} className="p-1 hover:text-primary text-muted-foreground" title="نسخ"><Copy className="w-3.5 h-3.5" /></button>
              <button onClick={() => deleteAsset(asset.id)} className="p-1 hover:text-destructive text-muted-foreground" title="حذف"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </TableCell>
        </TableRow>

        {isExpanded && (
          <TableRow key={`${asset.id}-exp`}>
            <TableCell colSpan={10} className="bg-muted/20 p-4">
              <div className="space-y-3">
                {asset.description && (
                  <div className="p-2 rounded-lg bg-card border text-sm text-muted-foreground">{asset.description}</div>
                )}
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

                {asset.duplicate_status === "potential_duplicate" && asset.duplicate_group && (
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-2">تكرار محتمل — اختر الإجراء:</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => {
                        updateAsset(asset.id, { duplicate_status: "resolved", review_status: "approved" } as any, "resolve_duplicate");
                      }}><CheckCircle className="w-3 h-3" /> ليس تكراراً</Button>
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => {
                        const siblings = assets.filter(a => a.duplicate_group === asset.duplicate_group && a.id !== asset.id);
                        if (siblings.length > 0) mergeAssets(siblings[0].id, asset.id);
                      }}><Merge className="w-3 h-3" /> دمج مع الأصل</Button>
                      <Button size="sm" variant="destructive" className="text-xs h-7 gap-1" onClick={() => deleteAsset(asset.id)}>
                        <Trash2 className="w-3 h-3" /> حذف
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-muted-foreground">المواصفات ({fields.length} حقل)</p>
                  <Button size="sm" variant="ghost" className="text-[10px] h-6 gap-1" onClick={() => addFieldToAsset(asset.id)}>
                    <Plus className="w-3 h-3" /> إضافة حقل
                  </Button>
                </div>
                {fields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {fields.map((field: any) => (
                      <div key={field.key} className="p-2 rounded-lg border bg-card flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{field.label}</span>
                          <span className={`text-[9px] font-mono ${getConfidenceColor(field.confidence)}`}>{field.confidence}%</span>
                        </div>
                        <Input value={field.value} onChange={e => updateAssetField(asset.id, field.key, e.target.value)} className="h-6 text-xs" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground">تغيير الحالة:</span>
                  {Object.entries(REVIEW_STATUS_CONFIG).filter(([k]) => k !== "merged").map(([key, cfg]) => (
                    <button key={key} onClick={() => setReviewStatus(asset.id, key)}
                      className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                        asset.review_status === key ? cfg.color : "border-border text-muted-foreground hover:border-primary/40"
                      }`}>{cfg.label}</button>
                  ))}
                </div>

                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <FileText className="w-3 h-3" /> المصدر: {asset.source_evidence || "غير محدد"}
                </div>
              </div>
            </TableCell>
          </TableRow>
        )}
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Review Gate */}
      <Card className={`shadow-card border-2 ${reviewGate.canProceed ? "border-success/30" : "border-amber-400/30"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${reviewGate.canProceed ? "bg-success/10" : "bg-amber-100 dark:bg-amber-900/20"}`}>
              {reviewGate.canProceed ? <ShieldCheck className="w-5 h-5 text-success" /> : <AlertTriangle className="w-5 h-5 text-amber-500" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                {reviewGate.canProceed ? "سجل الأصول جاهز للإرسال" : "يلزم مراجعة السجل قبل الإرسال"}
              </p>
              <p className="text-xs text-muted-foreground">
                {reviewGate.totalAssets} أصل • {reviewGate.approvedCount} معتمد • {reviewGate.rejectedCount} مرفوض
              </p>
            </div>
            <Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1" onClick={loadAuditLogs}>
              <History className="w-3 h-3" /> سجل التعديلات
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <p className="text-lg font-bold text-foreground">{reviewGate.totalAssets}</p>
              <p className="text-[10px] text-muted-foreground">إجمالي</p>
            </div>
            <button onClick={() => setActivePanel("duplicates")} className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <p className={`text-lg font-bold ${reviewGate.duplicatesUnresolved > 0 ? "text-amber-500" : "text-success"}`}>{reviewGate.duplicatesUnresolved}</p>
              <p className="text-[10px] text-muted-foreground">تكرارات</p>
            </button>
            <button onClick={() => setActivePanel("missing")} className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <p className={`text-lg font-bold ${reviewGate.missingCriticalFields > 0 ? "text-destructive" : "text-success"}`}>{reviewGate.missingCriticalFields}</p>
              <p className="text-[10px] text-muted-foreground">حقول ناقصة</p>
            </button>
            <button onClick={() => setActivePanel("low_confidence")} className="text-center p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
              <p className={`text-lg font-bold ${reviewGate.lowConfidenceItems > 0 ? "text-orange-500" : "text-success"}`}>{reviewGate.lowConfidenceItems}</p>
              <p className="text-[10px] text-muted-foreground">ثقة منخفضة</p>
            </button>
          </div>

          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>تقدم المراجعة</span>
              <span>{reviewGate.approvedCount} / {reviewGate.totalAssets}</span>
            </div>
            <Progress value={reviewGate.totalAssets > 0 ? (reviewGate.approvedCount / reviewGate.totalAssets) * 100 : 0} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      {/* Audit Log */}
      {showAuditLog && (
        <Card className="shadow-card border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4 text-primary" /> سجل التعديلات</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowAuditLog(false)}><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="max-h-[200px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد تعديلات بعد</p>
            ) : (
              <div className="space-y-1.5">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center gap-2 text-[11px] p-1.5 rounded bg-muted/30">
                    <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString("ar-SA")}</span>
                    <Badge variant="outline" className="text-[9px]">{log.action}</Badge>
                    {log.field_name && <span className="text-foreground font-medium">{log.field_name}</span>}
                    {log.old_value && <span className="text-destructive line-through">{log.old_value?.substring(0, 30)}</span>}
                    {log.new_value && <span className="text-success">{log.new_value?.substring(0, 30)}</span>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                <SelectTrigger className="h-8 border-none shadow-none p-0 w-auto text-sm font-bold gap-1"><SelectValue /></SelectTrigger>
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
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1"><FileText className="w-3 h-3" /> الوصف المهني</span>
              <Button variant="ghost" size="sm" onClick={() => setEditingDescription(!editingDescription)} className="text-[10px] h-6 gap-1">
                <Edit3 className="w-3 h-3" /> {editingDescription ? "حفظ" : "تعديل"}
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
              <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث في الأصول..." className="pr-9 text-sm h-8" />
            </div>
            <Select value={activePanel} onValueChange={setActivePanel}>
              <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
                <Filter className="w-3 h-3 ml-1" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل ({assets.length})</SelectItem>
                <SelectItem value="needs_review">يحتاج مراجعة ({reviewGate.needsReviewCount + reviewGate.pendingCount})</SelectItem>
                <SelectItem value="approved">معتمد ({reviewGate.approvedCount})</SelectItem>
                <SelectItem value="duplicates">تكرارات ({reviewGate.duplicatesUnresolved})</SelectItem>
                <SelectItem value="low_confidence">ثقة منخفضة ({reviewGate.lowConfidenceItems})</SelectItem>
                <SelectItem value="missing">حقول ناقصة ({reviewGate.missingCriticalFields})</SelectItem>
                <SelectItem value="real_estate">عقارات ({reCount})</SelectItem>
                <SelectItem value="machinery">آلات ({meCount})</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex border border-border rounded-md overflow-hidden">
              <button onClick={() => setViewMode("table")} className={`p-1.5 ${viewMode === "table" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} title="جدول"><List className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode("cards")} className={`p-1.5 ${viewMode === "cards" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} title="بطاقات"><LayoutGrid className="w-3.5 h-3.5" /></button>
              <button onClick={() => setViewMode("grouped")} className={`p-1.5 ${viewMode === "grouped" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} title="مجموعات"><Layers className="w-3.5 h-3.5" /></button>
            </div>

            <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={addManualAsset}><Plus className="w-3 h-3" /> إضافة</Button>
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={approveAll}><CheckCircle className="w-3 h-3" /> اعتماد الكل</Button>
            <Button variant="outline" size="sm" className="text-xs h-8 gap-1" onClick={exportToCSV}><Download className="w-3 h-3" /> تصدير</Button>
          </div>

          {/* Bulk actions bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-xs font-medium text-primary">{selectedIds.size} أصل محدد</span>
              <div className="flex gap-1 mr-auto">
                <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1" onClick={() => bulkSetStatus("approved")}>
                  <CheckCircle className="w-3 h-3" /> اعتماد
                </Button>
                <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1" onClick={() => bulkSetStatus("needs_review")}>
                  <AlertTriangle className="w-3 h-3" /> مراجعة
                </Button>
                <Button size="sm" variant="outline" className="text-[10px] h-6 gap-1" onClick={() => bulkSetStatus("rejected")}>
                  <XCircle className="w-3 h-3" /> رفض
                </Button>
                <Button size="sm" variant="destructive" className="text-[10px] h-6 gap-1" onClick={bulkDelete}>
                  <Trash2 className="w-3 h-3" /> حذف
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="text-[10px] h-6" onClick={() => setSelectedIds(new Set())}>
                إلغاء التحديد
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asset Display */}
      {filteredAssets.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="py-10 text-center text-muted-foreground">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">لا توجد أصول مطابقة</p>
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAssets.map(renderAssetCard)}
        </div>
      ) : viewMode === "grouped" ? (
        <div className="space-y-4">
          {Object.entries(groupedAssets).map(([group, items]) => (
            <Card key={group} className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" /> {group} <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10 text-center">#</TableHead>
                        <TableHead>الأصل</TableHead>
                        <TableHead className="w-14 text-center">كمية</TableHead>
                        <TableHead className="w-16 text-center">الثقة</TableHead>
                        <TableHead className="w-24">المراجعة</TableHead>
                        <TableHead className="w-20 text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(asset => {
                        const rc = REVIEW_STATUS_CONFIG[asset.review_status] || REVIEW_STATUS_CONFIG.pending;
                        const RI = rc.icon;
                        return (
                          <TableRow key={asset.id}>
                            <TableCell className="text-center text-xs text-muted-foreground">{asset.asset_index}</TableCell>
                            <TableCell className="text-sm">{asset.name}</TableCell>
                            <TableCell className="text-center text-sm">{asset.quantity}</TableCell>
                            <TableCell className="text-center">
                              <span className={`text-xs font-mono ${getConfidenceColor(asset.confidence)}`}>{asset.confidence}%</span>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-[9px] gap-0.5 ${rc.color}`}><RI className="w-3 h-3" /> {rc.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-0.5">
                                <button onClick={() => setReviewStatus(asset.id, "approved")} className="p-1 hover:text-success text-muted-foreground"><CheckCircle className="w-3 h-3" /></button>
                                <button onClick={() => deleteAsset(asset.id)} className="p-1 hover:text-destructive text-muted-foreground"><Trash2 className="w-3 h-3" /></button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">
                      <Checkbox
                        checked={selectedIds.size === filteredAssets.length && filteredAssets.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-10 text-center cursor-pointer" onClick={() => toggleSort("asset_index")}>#<SortIcon field="asset_index" /></TableHead>
                    <TableHead className="min-w-[200px] cursor-pointer" onClick={() => toggleSort("name")}>الأصل<SortIcon field="name" /></TableHead>
                    <TableHead className="w-20 cursor-pointer" onClick={() => toggleSort("asset_type")}>النوع<SortIcon field="asset_type" /></TableHead>
                    <TableHead className="w-14 text-center">كمية</TableHead>
                    <TableHead className="w-20">الحالة</TableHead>
                    <TableHead className="w-16 text-center cursor-pointer" onClick={() => toggleSort("confidence")}>الثقة<SortIcon field="confidence" /></TableHead>
                    <TableHead className="w-24">المصدر</TableHead>
                    <TableHead className="w-28 cursor-pointer" onClick={() => toggleSort("review_status")}>المراجعة<SortIcon field="review_status" /></TableHead>
                    <TableHead className="w-24 text-center">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map(renderTableRow)}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Classifications */}
      {files.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> تصنيف المستندات ({files.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {files.map(file => (
                <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate flex-1">{file.file_name}</span>
                  <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABELS[file.document_category] || file.document_category}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${
                    file.relevance === "high" ? "border-emerald-300 text-emerald-600" :
                    file.relevance === "medium" ? "border-amber-300 text-amber-600" : "border-border text-muted-foreground"
                  }`}>
                    {file.relevance === "high" ? "عالي" : file.relevance === "medium" ? "متوسط" : "منخفض"}
                  </Badge>
                  {file.processing_status === "failed" && <Badge variant="destructive" className="text-[9px]">فشل</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit */}
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
          <Button variant="outline" onClick={onBack} className="flex-1">العودة للتعديل</Button>
          <Button onClick={() => onSubmit(assets, discipline, description)} className="flex-1 gap-2" disabled={!reviewGate.canProceed}>
            <ShieldCheck className="w-4 h-4" /> إرسال طلب التقييم ({reviewGate.approvedCount} أصل)
          </Button>
        </div>
      </div>
    </div>
  );
}
