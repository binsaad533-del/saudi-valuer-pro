import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Loader2, Users, Link2, GitMerge, UserCheck, UserPlus, Building2,
  AlertTriangle, CheckCircle2, Eye,
} from "lucide-react";

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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  potential: { label: "عميل محتمل", color: "bg-muted text-muted-foreground", icon: UserPlus },
  verified: { label: "عميل مؤكد", color: "bg-info/10 text-info", icon: UserCheck },
  portal: { label: "لديه حساب", color: "bg-success/10 text-success", icon: CheckCircle2 },
};

export default function ClientIdentityPanel() {
  const { user } = useAuth();
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [merging, setMerging] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);

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
    setDuplicates(data || []);
    setShowDuplicates(true);
    if (!data?.length) toast.info("لا توجد سجلات مكررة");
  };

  const handleMerge = async (targetId: string, sourceId: string) => {
    if (!confirm("هل أنت متأكد من دمج السجلين؟ سيتم نقل جميع التقارير والطلبات إلى السجل المستهدف.")) return;
    setMerging(true);
    const { data, error } = await supabase.rpc("merge_client_records", { _target_id: targetId, _source_id: sourceId });
    if (error) toast.error("فشل الدمج");
    else {
      toast.success("تم دمج السجلات بنجاح");
      fetchClients();
      handleFindDuplicates();
    }
    setMerging(false);
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
        <div className="flex gap-2">
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
        <Button variant="outline" size="sm" onClick={handleFindDuplicates} className="gap-1.5">
          <GitMerge className="w-4 h-4" />
          كشف التكرارات
        </Button>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const cfg = STATUS_CONFIG[c.client_status] || STATUS_CONFIG.potential;
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={c.id}>
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicates Dialog */}
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
              {duplicates.map((d, i) => (
                <div key={i} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      تطابق: {d.match_field === "phone" ? "رقم الجوال" : d.match_field === "email" ? "البريد" : "السجل التجاري"}
                    </Badge>
                    <span className="text-xs text-muted-foreground" dir="ltr">{d.match_value}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{getClientName(d.client_id_1)}</span>
                    <span className="text-muted-foreground">←</span>
                    <span className="font-medium">{getClientName(d.client_id_2)}</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="text-xs gap-1" disabled={merging}
                      onClick={() => handleMerge(d.client_id_1, d.client_id_2)}>
                      <GitMerge className="w-3 h-3" /> دمج في الأول
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs gap-1" disabled={merging}
                      onClick={() => handleMerge(d.client_id_2, d.client_id_1)}>
                      <GitMerge className="w-3 h-3" /> دمج في الثاني
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
