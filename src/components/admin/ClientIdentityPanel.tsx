import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Loader2, Users, Link2, GitMerge, UserCheck, UserPlus, Building2,
  AlertTriangle, CheckCircle2, History, Plus, Zap,
} from "lucide-react";
import { format } from "date-fns";

interface ClientRecord {
  id: string;
  name_ar: string;
  email: string | null;
  phone: string | null;
  cr_number: string | null;
  client_type: string;
  client_status: string;
  portal_user_id: string | null;
  is_active: boolean;
  created_at: string;
  contact_person_ar: string | null;
}

interface DuplicatePair {
  client_id_1: string;
  client_id_2: string;
  match_field: string;
  match_value: string;
}

interface MergeLogEntry {
  id: string;
  target_client_id: string;
  source_client_id: string;
  source_client_name: string | null;
  target_client_name: string | null;
  match_field: string | null;
  confidence_score: number | null;
  reason: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  potential: { label: "عميل محتمل", color: "bg-muted text-muted-foreground", icon: UserPlus },
  verified: { label: "عميل مؤكد", color: "bg-info/10 text-info", icon: UserCheck },
  portal: { label: "لديه حساب", color: "bg-success/10 text-success", icon: CheckCircle2 },
};

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-success bg-success/10" : score >= 60 ? "text-warning bg-warning/10" : "text-destructive bg-destructive/10";
  const label = score >= 80 ? "عالية" : score >= 60 ? "متوسطة" : "منخفضة";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${color}`}>
      {score}% — {label}
    </span>
  );
}

export default function ClientIdentityPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [merging, setMerging] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

  // Manual link dialog
  const [linkDialog, setLinkDialog] = useState<ClientRecord | null>(null);
  const [linkTargetId, setLinkTargetId] = useState("");

  // Merge reason dialog
  const [mergeDialog, setMergeDialog] = useState<{ targetId: string; sourceId: string } | null>(null);
  const [mergeReason, setMergeReason] = useState("");

  // Merge history
  const [showHistory, setShowHistory] = useState(false);
  const [mergeHistory, setMergeHistory] = useState<MergeLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Suggested matches
  const [matchResults, setMatchResults] = useState<Record<string, { matched_id: string; confidence: number; match_field: string }>>({});

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("id, name_ar, email, phone, cr_number, client_type, client_status, portal_user_id, is_active, created_at, contact_person_ar")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setClients(data || []);
    setLoading(false);
  };

  const fetchOrgId = async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle();
    if (data?.organization_id) setOrgId(data.organization_id);
  };

  useEffect(() => {
    fetchClients();
    fetchOrgId();
  }, [user]);

  const handleFindDuplicates = async () => {
    if (!orgId) { toast.error("لم يتم تحديد المنظمة"); return; }
    const { data, error } = await supabase.rpc("find_duplicate_clients", { _org_id: orgId });
    if (error) { toast.error("خطأ في البحث عن التكرارات"); return; }

    // Compute confidence for each pair
    const pairs = data || [];
    const confidenceMap: Record<string, { matched_id: string; confidence: number; match_field: string }> = {};
    for (const p of pairs) {
      const conf = p.match_field === "phone" ? 95 : p.match_field === "email" ? 90 : 85;
      confidenceMap[`${p.client_id_1}-${p.client_id_2}`] = {
        matched_id: p.client_id_2,
        confidence: conf,
        match_field: p.match_field,
      };
    }
    setMatchResults(confidenceMap);
    setDuplicates(pairs);
    setShowDuplicates(true);
    if (!pairs.length) toast.info("لا توجد سجلات مكررة");
  };

  const openMergeDialog = (targetId: string, sourceId: string) => {
    setMergeDialog({ targetId, sourceId });
    setMergeReason("");
  };

  const handleMerge = async () => {
    if (!mergeDialog) return;
    setMerging(true);
    const { error } = await supabase.rpc("merge_client_records", {
      _target_id: mergeDialog.targetId,
      _source_id: mergeDialog.sourceId,
      _merged_by: user?.id || null,
      _reason: mergeReason || null,
    });
    if (error) toast.error("فشل الدمج");
    else {
      toast.success("تم دمج السجلات بنجاح");
      setMergeDialog(null);
      fetchClients();
      handleFindDuplicates();
    }
    setMerging(false);
  };

  const handleManualLink = async () => {
    if (!linkDialog || !linkTargetId || !user) return;
    // Get the profile user_id from profiles matching the selected client
    const { error } = await supabase
      .from("clients")
      .update({ portal_user_id: linkTargetId, client_status: "portal", updated_at: new Date().toISOString() })
      .eq("id", linkDialog.id);
    if (error) toast.error("فشل الربط اليدوي");
    else {
      toast.success("تم ربط العميل بالحساب يدوياً");
      setLinkDialog(null);
      setLinkTargetId("");
      fetchClients();
    }
  };

  const fetchMergeHistory = async () => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from("client_merge_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setMergeHistory((data as MergeLogEntry[]) || []);
    setHistoryLoading(false);
    setShowHistory(true);
  };

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchSearch = !search || c.name_ar.includes(search) || (c.email || "").includes(search) || (c.phone || "").includes(search);
      const matchStatus = statusFilter === "all" || c.client_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [clients, search, statusFilter]);

  const stats = useMemo(() => ({
    total: clients.length,
    potential: clients.filter(c => c.client_status === "potential").length,
    verified: clients.filter(c => c.client_status === "verified").length,
    portal: clients.filter(c => c.client_status === "portal").length,
  }), [clients]);

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name_ar || id.slice(0, 8);

  // Get unlinked profiles for manual linking
  const [profiles, setProfiles] = useState<{ user_id: string; full_name_ar: string; email: string | null }[]>([]);
  const fetchProfiles = async () => {
    const linkedIds = clients.filter(c => c.portal_user_id).map(c => c.portal_user_id!);
    const { data } = await supabase
      .from("profiles")
      .select("user_id, full_name_ar, email")
      .not("user_id", "in", linkedIds.length > 0 ? `(${linkedIds.join(",")})` : "(00000000-0000-0000-0000-000000000000)")
      .limit(50);
    setProfiles(data || []);
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "إجمالي السجلات", value: stats.total, icon: Users, color: "text-primary", bg: "bg-primary/10" },
          { label: "عملاء محتملون", value: stats.potential, icon: UserPlus, color: "text-muted-foreground", bg: "bg-muted" },
          { label: "عملاء مؤكدون", value: stats.verified, icon: UserCheck, color: "text-info", bg: "bg-info/10" },
          { label: "لديهم حساب", value: stats.portal, icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
        ].map(s => (
          <Card key={s.label} className="shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم، البريد أو الجوال..." value={search} onChange={e => setSearch(e.target.value)} className="pr-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["all", "potential", "verified", "portal"].map(s => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "الكل" : STATUS_CONFIG[s]?.label || s}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleFindDuplicates} className="gap-1.5">
            <GitMerge className="w-4 h-4" />
            كشف التكرارات
          </Button>
          <Button variant="outline" size="sm" onClick={fetchMergeHistory} className="gap-1.5">
            <History className="w-4 h-4" />
            سجل الدمج
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">لا توجد سجلات</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الجوال</TableHead>
                    <TableHead className="text-right">البريد</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">حساب البوابة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const cfg = STATUS_CONFIG[c.client_status] || STATUS_CONFIG.potential;
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/clients/${c.id}`)}>
                        <TableCell className="font-medium">
                          {c.name_ar}
                          {c.contact_person_ar && (
                            <span className="text-xs text-muted-foreground block">{c.contact_person_ar}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {c.client_type === "company" ? <><Building2 className="w-3 h-3 ml-1" /> شركة</> : "فرد"}
                          </Badge>
                        </TableCell>
                        <TableCell dir="ltr" className="text-left text-sm">{c.phone || "—"}</TableCell>
                        <TableCell dir="ltr" className="text-left text-sm">{c.email || "—"}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </TableCell>
                        <TableCell>
                          {c.portal_user_id ? (
                            <Badge variant="default" className="text-[10px] bg-success/80">مرتبط</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">غير مرتبط</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!c.portal_user_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => { setLinkDialog(c); fetchProfiles(); }}
                            >
                              <Link2 className="w-3 h-3" />
                              ربط يدوي
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicates Dialog with Confidence */}
      <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              سجلات مكررة ({duplicates.length})
            </DialogTitle>
          </DialogHeader>
          {duplicates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-success" />
              <p className="text-sm">لا توجد سجلات مكررة</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {duplicates.map((d, i) => {
                const key = `${d.client_id_1}-${d.client_id_2}`;
                const conf = matchResults[key];
                return (
                  <div key={i} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs">
                        تطابق: {d.match_field === "phone" ? "رقم الجوال" : d.match_field === "email" ? "البريد" : "السجل التجاري"}
                      </Badge>
                      {conf && <ConfidenceBadge score={conf.confidence} />}
                      <span className="text-xs text-muted-foreground" dir="ltr">{d.match_value}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{getClientName(d.client_id_1)}</span>
                      <span className="text-muted-foreground">←</span>
                      <span className="font-medium">{getClientName(d.client_id_2)}</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="text-xs gap-1" disabled={merging}
                        onClick={() => openMergeDialog(d.client_id_1, d.client_id_2)}>
                        <GitMerge className="w-3 h-3" /> دمج في الأول
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs gap-1" disabled={merging}
                        onClick={() => openMergeDialog(d.client_id_2, d.client_id_1)}>
                        <GitMerge className="w-3 h-3" /> دمج في الثاني
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Merge Confirmation Dialog with Reason */}
      <Dialog open={!!mergeDialog} onOpenChange={() => setMergeDialog(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="w-5 h-5 text-primary" />
              تأكيد الدمج
            </DialogTitle>
          </DialogHeader>
          {mergeDialog && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p>سيتم نقل جميع التقارير والطلبات من <strong>{getClientName(mergeDialog.sourceId)}</strong> إلى <strong>{getClientName(mergeDialog.targetId)}</strong></p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">سبب الدمج (اختياري)</label>
                <Textarea
                  placeholder="مثال: سجل مكرر لنفس العميل..."
                  value={mergeReason}
                  onChange={e => setMergeReason(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialog(null)}>إلغاء</Button>
            <Button onClick={handleMerge} disabled={merging} className="gap-1">
              {merging && <Loader2 className="w-4 h-4 animate-spin" />}
              تأكيد الدمج
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Link Dialog */}
      <Dialog open={!!linkDialog} onOpenChange={() => setLinkDialog(null)}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              ربط يدوي بحساب
            </DialogTitle>
          </DialogHeader>
          {linkDialog && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">{linkDialog.name_ar}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {linkDialog.phone || "—"} · {linkDialog.email || "—"}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">اختر حساب المستخدم</label>
                <Select value={linkTargetId} onValueChange={setLinkTargetId}>
                  <SelectTrigger><SelectValue placeholder="اختر حساباً..." /></SelectTrigger>
                  <SelectContent>
                    {profiles.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.full_name_ar} {p.email ? `(${p.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>إلغاء</Button>
            <Button onClick={handleManualLink} disabled={!linkTargetId} className="gap-1">
              <Link2 className="w-3.5 h-3.5" />
              ربط
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              سجل عمليات الدمج
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : mergeHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">لا توجد عمليات دمج سابقة</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {mergeHistory.map(log => (
                <div key={log.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "yyyy/MM/dd HH:mm")}
                    </span>
                    {log.confidence_score && <ConfidenceBadge score={log.confidence_score} />}
                  </div>
                  <p className="text-sm">
                    <span className="text-destructive line-through">{log.source_client_name || "—"}</span>
                    <span className="text-muted-foreground mx-2">→</span>
                    <span className="font-medium text-foreground">{log.target_client_name || "—"}</span>
                  </p>
                  {log.match_field && (
                    <p className="text-xs text-muted-foreground mt-1">
                      حقل التطابق: {log.match_field === "phone" ? "رقم الجوال" : log.match_field === "email" ? "البريد" : log.match_field}
                    </p>
                  )}
                  {log.reason && (
                    <p className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                      {log.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
