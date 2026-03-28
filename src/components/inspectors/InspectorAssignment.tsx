import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MapPin, User, RefreshCw, AlertTriangle, CheckCircle, History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  assignmentId: string;
  currentInspectorId?: string | null;
  onAssigned?: () => void;
}

interface InspectorOption {
  user_id: string;
  full_name_ar: string;
  cities_ar: string[];
  regions_ar: string[];
  availability_status: string;
  current_workload: number;
  max_concurrent_tasks: number;
}

export default function InspectorAssignment({ assignmentId, currentInspectorId, onAssigned }: Props) {
  const { toast } = useToast();
  const [inspectors, setInspectors] = useState<InspectorOption[]>([]);
  const [selectedInspector, setSelectedInspector] = useState<string>("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    loadInspectors();
    if (currentInspectorId) loadHistory();
  }, [assignmentId, currentInspectorId]);

  const loadInspectors = async () => {
    // Get inspector profiles joined with their profile names
    const { data: inspProfiles } = await supabase
      .from("inspector_profiles")
      .select("user_id, cities_ar, regions_ar, availability_status, current_workload, max_concurrent_tasks")
      .eq("is_active", true);

    if (!inspProfiles || inspProfiles.length === 0) {
      setInspectors([]);
      return;
    }

    const userIds = inspProfiles.map(ip => ip.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name_ar")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const merged: InspectorOption[] = inspProfiles.map(ip => ({
      user_id: ip.user_id,
      full_name_ar: profileMap.get(ip.user_id)?.full_name_ar || "معاين",
      cities_ar: ip.cities_ar || [],
      regions_ar: ip.regions_ar || [],
      availability_status: ip.availability_status,
      current_workload: ip.current_workload || 0,
      max_concurrent_tasks: ip.max_concurrent_tasks || 5,
    }));

    setInspectors(merged);
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from("inspector_reassignment_log")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false });
    setHistory(data || []);
  };

  const handleAssign = async () => {
    if (!selectedInspector) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isReassignment = !!currentInspectorId;

      // Check if inspection was started
      let inspectionStarted = false;
      if (isReassignment && currentInspectorId) {
        const { data: existingInsp } = await supabase
          .from("inspections")
          .select("id, completed")
          .eq("assignment_id", assignmentId)
          .eq("inspector_id", currentInspectorId);
        inspectionStarted = (existingInsp || []).length > 0;
      }

      // Log reassignment
      if (isReassignment) {
        await supabase.from("inspector_reassignment_log").insert({
          assignment_id: assignmentId,
          previous_inspector_id: currentInspectorId,
          new_inspector_id: selectedInspector,
          reason: reason || "إعادة تعيين بواسطة المسؤول",
          reassigned_by: user!.id,
          inspection_was_started: inspectionStarted,
        });
      }

      // Update assignment
      await supabase
        .from("valuation_assignments")
        .update({ assigned_inspector_id: selectedInspector })
        .eq("id", assignmentId);

      // Log audit
      await supabase.from("audit_logs").insert({
        user_id: user!.id,
        action: isReassignment ? "update" : "create",
        table_name: "valuation_assignments",
        record_id: assignmentId,
        assignment_id: assignmentId,
        description: isReassignment
          ? `إعادة تعيين المعاين من ${currentInspectorId} إلى ${selectedInspector}`
          : `تعيين المعاين ${selectedInspector}`,
        new_data: { assigned_inspector_id: selectedInspector, reason } as any,
      });

      toast({
        title: isReassignment ? "✅ تم إعادة التعيين" : "✅ تم تعيين المعاين",
        description: "تم تحديث المعاين الميداني بنجاح",
      });

      setReassignOpen(false);
      setReason("");
      onAssigned?.();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const currentInspector = inspectors.find(i => i.user_id === currentInspectorId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          المعاين الميداني
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentInspectorId && currentInspector ? (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{currentInspector.full_name_ar}</p>
                <div className="flex gap-1 mt-0.5">
                  {currentInspector.cities_ar.slice(0, 2).map(c => (
                    <Badge key={c} variant="outline" className="text-[10px] h-4">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setReassignOpen(true)}>
                <RefreshCw className="w-3 h-3 ml-1" /> إعادة تعيين
              </Button>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { loadHistory(); setHistoryOpen(true); }}>
                  <History className="w-3 h-3 ml-1" /> السجل
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">لم يتم تعيين معاين بعد</p>
            <Select value={selectedInspector} onValueChange={setSelectedInspector}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المعاين الميداني" />
              </SelectTrigger>
              <SelectContent>
                {inspectors.map(insp => (
                  <SelectItem key={insp.user_id} value={insp.user_id}>
                    <div className="flex items-center gap-2">
                      <span>{insp.full_name_ar}</span>
                      <Badge variant={insp.availability_status === "available" ? "default" : "secondary"} className="text-[10px] h-4">
                        {insp.availability_status === "available" ? "متاح" : "مشغول"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        ({insp.current_workload}/{insp.max_concurrent_tasks})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssign} disabled={!selectedInspector || loading} size="sm" className="w-full">
              <CheckCircle className="w-3.5 h-3.5 ml-1" /> تعيين المعاين
            </Button>
          </div>
        )}
      </CardContent>

      {/* Reassignment Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              إعادة تعيين المعاين
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                سيتم تسجيل إعادة التعيين في سجل التدقيق
              </p>
            </div>
            <div className="space-y-2">
              <Label>المعاين الجديد</Label>
              <Select value={selectedInspector} onValueChange={setSelectedInspector}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المعاين" />
                </SelectTrigger>
                <SelectContent>
                  {inspectors.filter(i => i.user_id !== currentInspectorId).map(insp => (
                    <SelectItem key={insp.user_id} value={insp.user_id}>
                      <div className="flex items-center gap-2">
                        <span>{insp.full_name_ar}</span>
                        <Badge variant={insp.availability_status === "available" ? "default" : "secondary"} className="text-[10px]">
                          {insp.availability_status === "available" ? "متاح" : "مشغول"}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>سبب إعادة التعيين</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="اذكر سبب إعادة التعيين..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>إلغاء</Button>
            <Button onClick={handleAssign} disabled={!selectedInspector || loading}>
              {loading ? "جاري..." : "تأكيد إعادة التعيين"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              سجل إعادة التعيين
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-72 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">السبب</TableHead>
                  <TableHead className="text-right">بدأت المعاينة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{format(new Date(h.created_at), "yyyy-MM-dd HH:mm")}</TableCell>
                    <TableCell className="text-xs">{h.reason || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={h.inspection_was_started ? "destructive" : "secondary"} className="text-[10px]">
                        {h.inspection_was_started ? "نعم" : "لا"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
