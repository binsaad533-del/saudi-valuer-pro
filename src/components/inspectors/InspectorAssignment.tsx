import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, User, RefreshCw, AlertTriangle, CheckCircle, History,
  Zap, Target, Hand, Loader2, Star, Navigation, TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Props {
  assignmentId: string;
  currentInspectorId?: string | null;
  propertyCityAr?: string | null;
  propertyDistrictAr?: string | null;
  propertyLatitude?: number | null;
  propertyLongitude?: number | null;
  onAssigned?: () => void;
}

interface SmartMatch {
  inspector_profile_id: string;
  user_id: string;
  full_name_ar: string;
  availability_status: string;
  current_workload: number;
  max_concurrent_tasks: number;
  quality_score: number;
  total_completed: number;
  coverage_match: "city_district" | "city" | "region" | "fallback";
  distance_km: number | null;
  score: number;
  cities: string[];
  districts: string[];
}

interface SmartResult {
  recommended: SmartMatch | null;
  alternatives: SmartMatch[];
  fallback_needed: boolean;
  total_inspectors: number;
  message: string;
}

type AssignmentMode = "smart" | "suggested" | "manual";

const coverageLabels: Record<string, string> = {
  city_district: "مدينة + حي",
  city: "مدينة",
  region: "منطقة",
  fallback: "بدون تغطية",
};

const coverageColors: Record<string, string> = {
  city_district: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400",
  city: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400",
  region: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
  fallback: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default function InspectorAssignment({
  assignmentId, currentInspectorId, propertyCityAr, propertyDistrictAr,
  propertyLatitude, propertyLongitude, onAssigned,
}: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<AssignmentMode>("smart");
  const [smartResult, setSmartResult] = useState<SmartResult | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const [allInspectors, setAllInspectors] = useState<SmartMatch[]>([]);
  const [selectedInspector, setSelectedInspector] = useState<string>("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [currentInspectorName, setCurrentInspectorName] = useState<string>("");

  useEffect(() => {
    if (currentInspectorId) {
      loadHistory();
      loadCurrentInspectorName();
    }
  }, [assignmentId, currentInspectorId]);

  const loadCurrentInspectorName = async () => {
    if (!currentInspectorId) return;
    const { data } = await supabase
      .from("profiles")
      .select("full_name_ar")
      .eq("user_id", currentInspectorId)
      .maybeSingle();
    setCurrentInspectorName(data?.full_name_ar || "معاين");
  };

  const runSmartAssignment = useCallback(async () => {
    setSmartLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smart-inspector-assignment", {
        body: {
          assignment_id: assignmentId,
          property_city_ar: propertyCityAr,
          property_district_ar: propertyDistrictAr,
          property_latitude: propertyLatitude,
          property_longitude: propertyLongitude,
        },
      });
      if (error) throw error;
      setSmartResult(data as SmartResult);
      const allMatches = [
        ...(data.recommended ? [data.recommended] : []),
        ...(data.alternatives || []),
      ];
      setAllInspectors(allMatches);
      if (data.recommended) {
        setSelectedInspector(data.recommended.user_id);
      }
    } catch (err: any) {
      toast({ title: "خطأ في التعيين الذكي", description: err.message, variant: "destructive" });
    } finally {
      setSmartLoading(false);
    }
  }, [assignmentId, propertyCityAr, propertyDistrictAr, propertyLatitude, propertyLongitude]);

  const loadHistory = async () => {
    const { data } = await supabase
      .from("inspector_reassignment_log")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false });
    setHistory(data || []);
  };

  const handleAssign = async (inspectorUserId?: string) => {
    const targetId = inspectorUserId || selectedInspector;
    if (!targetId) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const isReassignment = !!currentInspectorId;

      let inspectionStarted = false;
      if (isReassignment && currentInspectorId) {
        const { data: existingInsp } = await supabase
          .from("inspections")
          .select("id")
          .eq("assignment_id", assignmentId)
          .eq("inspector_id", currentInspectorId);
        inspectionStarted = (existingInsp || []).length > 0;
      }

      if (isReassignment) {
        await supabase.from("inspector_reassignment_log").insert({
          assignment_id: assignmentId,
          previous_inspector_id: currentInspectorId,
          new_inspector_id: targetId,
          reason: reason || `تعيين ${mode === "smart" ? "ذكي تلقائي" : mode === "suggested" ? "مقترح" : "يدوي"}`,
          reassigned_by: user!.id,
          inspection_was_started: inspectionStarted,
        });
      }

      await supabase
        .from("valuation_assignments")
        .update({ assigned_inspector_id: targetId })
        .eq("id", assignmentId);

      await supabase.from("audit_logs").insert({
        user_id: user!.id,
        action: isReassignment ? "update" as const : "create" as const,
        table_name: "valuation_assignments",
        record_id: assignmentId,
        assignment_id: assignmentId,
        description: `${isReassignment ? "إعادة" : ""} تعيين المعاين (${mode})`,
        new_data: { assigned_inspector_id: targetId, mode, reason } as any,
      });

      toast({
        title: "✅ تم تعيين المعاين",
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

  // Already assigned view
  if (currentInspectorId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            المعاين الميداني
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{currentInspectorName}</p>
                <p className="text-[10px] text-muted-foreground">معاين ميداني معيّن</p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => { runSmartAssignment(); setReassignOpen(true); }}>
                <RefreshCw className="w-3 h-3 ml-1" /> إعادة تعيين
              </Button>
              {history.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => { loadHistory(); setHistoryOpen(true); }}>
                  <History className="w-3 h-3 ml-1" /> السجل ({history.length})
                </Button>
              )}
            </div>
          </div>
        </CardContent>

        {/* Reassignment Dialog */}
        <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
          <DialogContent dir="rtl" className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                إعادة تعيين المعاين الميداني
              </DialogTitle>
            </DialogHeader>
            <InspectorSelectionUI
              smartResult={smartResult}
              smartLoading={smartLoading}
              allInspectors={allInspectors}
              selectedInspector={selectedInspector}
              setSelectedInspector={setSelectedInspector}
              mode={mode}
              setMode={setMode}
              onRunSmart={runSmartAssignment}
              excludeUserId={currentInspectorId}
            />
            <div className="space-y-2">
              <Label>سبب إعادة التعيين</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="اذكر سبب إعادة التعيين..." className="h-16" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReassignOpen(false)}>إلغاء</Button>
              <Button onClick={() => handleAssign()} disabled={!selectedInspector || loading}>
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
                <History className="w-4 h-4 text-primary" /> سجل إعادة التعيين
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

  // Not yet assigned view
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          تعيين المعاين الميداني
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InspectorSelectionUI
          smartResult={smartResult}
          smartLoading={smartLoading}
          allInspectors={allInspectors}
          selectedInspector={selectedInspector}
          setSelectedInspector={setSelectedInspector}
          mode={mode}
          setMode={setMode}
          onRunSmart={runSmartAssignment}
        />
        <Button onClick={() => handleAssign()} disabled={!selectedInspector || loading} className="w-full gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {loading ? "جاري التعيين..." : "تعيين المعاين"}
        </Button>
      </CardContent>
    </Card>
  );
}

// Shared selection UI component
function InspectorSelectionUI({
  smartResult, smartLoading, allInspectors, selectedInspector,
  setSelectedInspector, mode, setMode, onRunSmart, excludeUserId,
}: {
  smartResult: SmartResult | null;
  smartLoading: boolean;
  allInspectors: SmartMatch[];
  selectedInspector: string;
  setSelectedInspector: (v: string) => void;
  mode: AssignmentMode;
  setMode: (m: AssignmentMode) => void;
  onRunSmart: () => void;
  excludeUserId?: string | null;
}) {
  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <Tabs value={mode} onValueChange={v => setMode(v as AssignmentMode)} dir="rtl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="smart" className="gap-1 text-xs">
            <Zap className="w-3 h-3" /> تلقائي ذكي
          </TabsTrigger>
          <TabsTrigger value="suggested" className="gap-1 text-xs">
            <Target className="w-3 h-3" /> مقترح
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1 text-xs">
            <Hand className="w-3 h-3" /> يدوي
          </TabsTrigger>
        </TabsList>

        {/* Smart / Suggested */}
        <TabsContent value="smart" className="mt-3 space-y-3">
          <Button onClick={onRunSmart} disabled={smartLoading} variant="outline" className="w-full gap-2">
            {smartLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {smartLoading ? "جاري البحث..." : "بحث ذكي عن أفضل معاين"}
          </Button>
          {smartResult && <SmartResultView result={smartResult} selected={selectedInspector} onSelect={setSelectedInspector} autoAssign={true} excludeUserId={excludeUserId} />}
        </TabsContent>

        <TabsContent value="suggested" className="mt-3 space-y-3">
          <Button onClick={onRunSmart} disabled={smartLoading} variant="outline" className="w-full gap-2">
            {smartLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4" />}
            {smartLoading ? "جاري البحث..." : "عرض الاقتراحات"}
          </Button>
          {smartResult && <SmartResultView result={smartResult} selected={selectedInspector} onSelect={setSelectedInspector} autoAssign={false} excludeUserId={excludeUserId} />}
        </TabsContent>

        <TabsContent value="manual" className="mt-3 space-y-3">
          {!smartResult && (
            <Button onClick={onRunSmart} disabled={smartLoading} variant="ghost" size="sm" className="w-full text-xs gap-1">
              <Loader2 className={`w-3 h-3 ${smartLoading ? "animate-spin" : ""}`} /> تحميل قائمة المعاينين
            </Button>
          )}
          {allInspectors.length > 0 && (
            <Select value={selectedInspector} onValueChange={setSelectedInspector}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المعاين الميداني" />
              </SelectTrigger>
              <SelectContent>
                {allInspectors
                  .filter(i => !excludeUserId || i.user_id !== excludeUserId)
                  .map(insp => (
                    <SelectItem key={insp.user_id} value={insp.user_id}>
                      <span className="flex items-center gap-2">
                        {insp.full_name_ar}
                        <Badge variant="outline" className="text-[10px] h-4">{insp.cities.join(", ") || "—"}</Badge>
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SmartResultView({
  result, selected, onSelect, autoAssign, excludeUserId,
}: {
  result: SmartResult;
  selected: string;
  onSelect: (id: string) => void;
  autoAssign: boolean;
  excludeUserId?: string | null;
}) {
  const allMatches = [
    ...(result.recommended ? [result.recommended] : []),
    ...result.alternatives,
  ].filter(m => !excludeUserId || m.user_id !== excludeUserId);

  return (
    <div className="space-y-3">
      {/* Fallback warning */}
      {result.fallback_needed && (
        <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" />
            {result.message}
          </p>
        </div>
      )}

      {/* Inspector cards */}
      {allMatches.map((match, idx) => {
        const isRecommended = idx === 0 && !result.fallback_needed;
        const isSelected = selected === match.user_id;
        const workloadPct = match.max_concurrent_tasks > 0
          ? (match.current_workload / match.max_concurrent_tasks) * 100
          : 0;

        return (
          <div
            key={match.user_id}
            onClick={() => onSelect(match.user_id)}
            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
              isSelected
                ? "border-primary bg-primary/5"
                : isRecommended
                  ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20"
                  : "border-border hover:border-primary/30"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isRecommended ? "bg-green-100 dark:bg-green-900" : "bg-muted"}`}>
                  {isRecommended ? <Star className="w-4 h-4 text-green-600" /> : <User className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{match.full_name_ar}</p>
                    {isRecommended && <Badge className="text-[10px] h-4 bg-green-600">موصى به</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge className={`text-[10px] h-4 ${coverageColors[match.coverage_match]}`}>
                      {coverageLabels[match.coverage_match]}
                    </Badge>
                    <Badge variant={match.availability_status === "available" ? "default" : "secondary"} className="text-[10px] h-4">
                      {match.availability_status === "available" ? "متاح" : "مشغول"}
                    </Badge>
                    {match.distance_km !== null && (
                      <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
                        <Navigation className="w-2.5 h-2.5" /> {match.distance_km} كم
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <TrendingUp className="w-3 h-3" />
                  <span className="font-mono">{match.score}</span>
                </div>
              </div>
            </div>

            {/* Workload bar */}
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-16">عبء العمل</span>
              <Progress value={workloadPct} className="h-1.5 flex-1" />
              <span className="text-[10px] text-muted-foreground">{match.current_workload}/{match.max_concurrent_tasks}</span>
            </div>

            {/* Cities & districts */}
            {(match.cities.length > 0 || match.districts.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {match.cities.map(c => (
                  <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{c}</span>
                ))}
                {match.districts.map(d => (
                  <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{d}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {allMatches.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">لا يوجد معاينين متاحين</p>
      )}
    </div>
  );
}
