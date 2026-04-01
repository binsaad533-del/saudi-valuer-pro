import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Edit3, Loader2, Search, Save } from "lucide-react";

interface Props {
  requests: any[];
  onRefresh: () => void;
}

export default function CoordinatorClientCorrections({ requests, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    cityAr: "",
    districtAr: "",
    landArea: "",
    buildingArea: "",
    descriptionAr: "",
    correctionNote: "",
  });

  const editableRequests = requests.filter(r =>
    !["completed", "closed", "report_issued"].includes(r.status)
  );

  const filtered = editableRequests.filter(r =>
    !search ||
    (r.property_description_ar || "").includes(search) ||
    (r.reference_number || "").includes(search)
  );

  const openEdit = (req: any) => {
    setSelectedReq(req);
    setEditForm({
      cityAr: req.property_city_ar || "",
      districtAr: req.property_district_ar || "",
      landArea: req.land_area?.toString() || "",
      buildingArea: req.building_area?.toString() || "",
      descriptionAr: req.property_description_ar || "",
      correctionNote: "",
    });
    setEditDialog(true);
  };

  const handleSave = async () => {
    if (!selectedReq || !editForm.correctionNote.trim()) {
      toast.error("يرجى كتابة سبب التصحيح");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("valuation_requests" as any).update({
        property_city_ar: editForm.cityAr || null,
        property_district_ar: editForm.districtAr || null,
        land_area: editForm.landArea ? parseFloat(editForm.landArea) : null,
        building_area: editForm.buildingArea ? parseFloat(editForm.buildingArea) : null,
        property_description_ar: editForm.descriptionAr || null,
      } as any).eq("id", selectedReq.id);

      if (error) throw error;

      // Log correction
      await supabase.from("request_messages" as any).insert({
        request_id: selectedReq.id,
        sender_type: "system" as any,
        content: `تصحيح بيانات بواسطة المنسق: ${editForm.correctionNote}`,
      });

      toast.success("تم تصحيح البيانات بنجاح");
      setEditDialog(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-warning" />
            تصحيح أخطاء بيانات العملاء
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            يمكنك تعديل بيانات الطلب لتصحيح الأخطاء الإدخالية مع توثيق سبب التعديل
          </p>
          <div className="relative mt-3">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث في الطلبات القابلة للتصحيح..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرقم المرجعي</TableHead>
                  <TableHead className="text-right">الوصف</TableHead>
                  <TableHead className="text-right">المدينة</TableHead>
                  <TableHead className="text-right">المساحة</TableHead>
                  <TableHead className="text-right">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      لا توجد طلبات قابلة للتصحيح
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 20).map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-xs" dir="ltr">{req.reference_number || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{req.property_description_ar || "—"}</TableCell>
                      <TableCell className="text-sm">{req.property_city_ar || "—"}</TableCell>
                      <TableCell className="text-sm">{req.land_area ? `${req.land_area} م²` : "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => openEdit(req)}>
                          <Edit3 className="w-3 h-3 ml-1" />تصحيح
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>تصحيح بيانات الطلب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">المدينة</Label>
                <Input value={editForm.cityAr} onChange={e => setEditForm(p => ({ ...p, cityAr: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">الحي</Label>
                <Input value={editForm.districtAr} onChange={e => setEditForm(p => ({ ...p, districtAr: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">مساحة الأرض</Label>
                <Input type="number" value={editForm.landArea} onChange={e => setEditForm(p => ({ ...p, landArea: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">مساحة البناء</Label>
                <Input type="number" value={editForm.buildingArea} onChange={e => setEditForm(p => ({ ...p, buildingArea: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الوصف</Label>
              <Textarea value={editForm.descriptionAr} onChange={e => setEditForm(p => ({ ...p, descriptionAr: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-destructive">سبب التصحيح *</Label>
              <Textarea
                placeholder="اكتب سبب التعديل للتوثيق..."
                value={editForm.correctionNote}
                onChange={e => setEditForm(p => ({ ...p, correctionNote: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
              حفظ التصحيح
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
