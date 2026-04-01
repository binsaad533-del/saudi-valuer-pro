import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Send, UserPlus, Users } from "lucide-react";

interface Props {
  clients: any[];
  onCreated: () => void;
}

const PROPERTY_TYPES = [
  { value: "residential_land", label: "أرض سكنية" },
  { value: "commercial_land", label: "أرض تجارية" },
  { value: "residential_building", label: "مبنى سكني" },
  { value: "commercial_building", label: "مبنى تجاري" },
  { value: "villa", label: "فيلا" },
  { value: "apartment", label: "شقة" },
  { value: "warehouse", label: "مستودع" },
  { value: "farm", label: "مزرعة" },
  { value: "other", label: "أخرى" },
];

const PURPOSES = [
  { value: "sale_purchase", label: "بيع / شراء" },
  { value: "financing", label: "تمويل" },
  { value: "insurance", label: "تأمين" },
  { value: "legal", label: "قضائي" },
  { value: "zakat_tax", label: "زكاة / ضريبة" },
  { value: "other", label: "أخرى" },
];

export default function CoordinatorNewRequest({ clients, onCreated }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [form, setForm] = useState({
    clientId: "",
    propertyType: "",
    purpose: "",
    cityAr: "",
    districtAr: "",
    landArea: "",
    buildingArea: "",
    descriptionAr: "",
    notes: "",
  });
  const [newClient, setNewClient] = useState({
    nameAr: "",
    phone: "",
    email: "",
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    // Validate client
    if (clientMode === "existing" && !form.clientId) {
      toast.error("يرجى اختيار عميل من القائمة");
      return;
    }
    if (clientMode === "new" && !newClient.nameAr.trim()) {
      toast.error("يرجى إدخال اسم العميل الجديد");
      return;
    }
    if (!form.propertyType || !form.purpose || !form.cityAr) {
      toast.error("يرجى تعبئة الحقول المطلوبة: نوع العقار، الغرض، المدينة");
      return;
    }

    setSaving(true);
    try {
      let clientId = form.clientId;

      // Create new client if needed
      if (clientMode === "new") {
        // Get org id
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user!.id)
          .single();

        if (!profile?.organization_id) throw new Error("لم يتم العثور على المنظمة");

        const { data: newClientData, error: clientError } = await supabase
          .from("clients")
          .insert({
            name_ar: newClient.nameAr.trim(),
            phone: newClient.phone.trim() || null,
            email: newClient.email.trim() || null,
            organization_id: profile.organization_id,
            created_by: user!.id,
          })
          .select("id")
          .single();

        if (clientError) throw clientError;
        clientId = newClientData.id;
      }

      const { error } = await supabase.from("valuation_requests" as any).insert({
        client_id: clientId,
        property_type: form.propertyType,
        purpose: form.purpose,
        property_city_ar: form.cityAr,
        property_district_ar: form.districtAr || null,
        land_area: form.landArea ? parseFloat(form.landArea) : null,
        building_area: form.buildingArea ? parseFloat(form.buildingArea) : null,
        property_description_ar: form.descriptionAr || null,
        notes: form.notes || null,
        status: "submitted",
        created_by: user?.id,
        submitted_by_coordinator: true,
      } as any);

      if (error) throw error;
      toast.success("تم إنشاء الطلب بنجاح نيابةً عن العميل");
      setForm({ clientId: "", propertyType: "", purpose: "", cityAr: "", districtAr: "", landArea: "", buildingArea: "", descriptionAr: "", notes: "" });
      setNewClient({ nameAr: "", phone: "", email: "" });
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إنشاء الطلب");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          إدخال طلب تقييم نيابةً عن العميل
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">العميل *</Label>
          <Tabs value={clientMode} onValueChange={v => setClientMode(v as "existing" | "new")} dir="rtl">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="existing" className="text-xs gap-1.5">
                <Users className="w-3.5 h-3.5" />
                عميل موجود
              </TabsTrigger>
              <TabsTrigger value="new" className="text-xs gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                عميل جديد
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="mt-3">
              <Select value={form.clientId} onValueChange={v => update("clientId", v)}>
                <SelectTrigger><SelectValue placeholder="اختر العميل من القائمة" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name_ar} {c.phone ? `— ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="new" className="mt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                <div className="space-y-1">
                  <Label className="text-xs">اسم العميل *</Label>
                  <Input
                    placeholder="الاسم الكامل"
                    value={newClient.nameAr}
                    onChange={e => setNewClient(p => ({ ...p, nameAr: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">رقم الجوال</Label>
                  <Input
                    placeholder="05xxxxxxxx"
                    value={newClient.phone}
                    onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newClient.email}
                    onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Property Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">نوع العقار *</Label>
            <Select value={form.propertyType} onValueChange={v => update("propertyType", v)}>
              <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">الغرض من التقييم *</Label>
            <Select value={form.purpose} onValueChange={v => update("purpose", v)}>
              <SelectTrigger><SelectValue placeholder="اختر الغرض" /></SelectTrigger>
              <SelectContent>
                {PURPOSES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">المدينة *</Label>
            <Input placeholder="مثال: الرياض" value={form.cityAr} onChange={e => update("cityAr", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">الحي</Label>
            <Input placeholder="مثال: العليا" value={form.districtAr} onChange={e => update("districtAr", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">مساحة الأرض (م²)</Label>
            <Input type="number" placeholder="0" value={form.landArea} onChange={e => update("landArea", e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">مساحة البناء (م²)</Label>
            <Input type="number" placeholder="0" value={form.buildingArea} onChange={e => update("buildingArea", e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">وصف العقار</Label>
          <Textarea placeholder="وصف تفصيلي للعقار..." value={form.descriptionAr} onChange={e => update("descriptionAr", e.target.value)} rows={3} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">ملاحظات المنسق</Label>
          <Textarea placeholder="ملاحظات إضافية..." value={form.notes} onChange={e => update("notes", e.target.value)} rows={2} />
        </div>

        <Button onClick={handleSubmit} disabled={saving} className="w-full md:w-auto">
          {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Send className="w-4 h-4 ml-2" />}
          إرسال الطلب
        </Button>
      </CardContent>
    </Card>
  );
}
