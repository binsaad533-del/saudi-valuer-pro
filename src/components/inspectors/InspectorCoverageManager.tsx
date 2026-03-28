import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  MapPin, Users, Plus, Trash2, Globe, Building2, Star,
  Loader2, Settings,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InspectorProfile {
  id: string;
  user_id: string;
  full_name_ar: string;
  availability_status: string;
  current_workload: number;
  max_concurrent_tasks: number;
  quality_score: number;
  total_completed: number;
  cities_ar: string[];
  regions_ar: string[];
  is_active: boolean;
}

interface City {
  id: string;
  name_ar: string;
  name_en: string | null;
  region_ar: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface District {
  id: string;
  city_id: string;
  name_ar: string;
  name_en: string | null;
}

interface CoverageArea {
  id: string;
  inspector_profile_id: string;
  city_id: string;
  district_id: string | null;
  coverage_radius_km: number;
  is_primary: boolean;
  city_name?: string;
  district_name?: string;
}

export default function InspectorCoverageManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [inspectors, setInspectors] = useState<InspectorProfile[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedInspector, setSelectedInspector] = useState<InspectorProfile | null>(null);
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCityId, setNewCityId] = useState("");
  const [newDistrictId, setNewDistrictId] = useState("");
  const [newIsPrimary, setNewIsPrimary] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [inspRes, citiesRes, districtsRes] = await Promise.all([
      supabase.from("inspector_profiles").select("*").order("created_at"),
      supabase.from("cities").select("*").eq("is_active", true).order("name_ar"),
      supabase.from("districts").select("*").eq("is_active", true).order("name_ar"),
    ]);

    const inspProfiles = inspRes.data || [];
    // Enrich with profile names
    if (inspProfiles.length > 0) {
      const userIds = inspProfiles.map(ip => ip.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name_ar")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p.full_name_ar]));
      inspProfiles.forEach((ip: any) => {
        ip.full_name_ar = profileMap.get(ip.user_id) || "معاين";
      });
    }

    setInspectors(inspProfiles as any);
    setCities(citiesRes.data || []);
    setDistricts(districtsRes.data || []);
    setLoading(false);
  };

  const loadCoverage = async (inspectorProfileId: string) => {
    const { data } = await supabase
      .from("inspector_coverage_areas")
      .select("*")
      .eq("inspector_profile_id", inspectorProfileId);

    const areas = (data || []).map(ca => {
      const city = cities.find(c => c.id === ca.city_id);
      const district = ca.district_id ? districts.find(d => d.id === ca.district_id) : null;
      return {
        ...ca,
        city_name: city?.name_ar || "—",
        district_name: district?.name_ar || null,
      };
    });

    setCoverageAreas(areas);
  };

  const selectInspector = async (insp: InspectorProfile) => {
    setSelectedInspector(insp);
    await loadCoverage(insp.id);
  };

  const addCoverage = async () => {
    if (!selectedInspector || !newCityId) return;

    const { error } = await supabase.from("inspector_coverage_areas").insert({
      inspector_profile_id: selectedInspector.id,
      city_id: newCityId,
      district_id: newDistrictId || null,
      is_primary: newIsPrimary,
      coverage_radius_km: 50,
    });

    if (error) {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "✅ تمت الإضافة" });
    setAddDialogOpen(false);
    setNewCityId("");
    setNewDistrictId("");
    setNewIsPrimary(false);
    await loadCoverage(selectedInspector.id);
  };

  const removeCoverage = async (areaId: string) => {
    if (!selectedInspector) return;
    await supabase.from("inspector_coverage_areas").delete().eq("id", areaId);
    toast({ title: "✅ تم الحذف" });
    await loadCoverage(selectedInspector.id);
  };

  const filteredDistricts = districts.filter(d => d.city_id === newCityId);

  // Group cities by region
  const regionGroups = cities.reduce<Record<string, City[]>>((acc, city) => {
    const region = city.region_ar || "أخرى";
    if (!acc[region]) acc[region] = [];
    acc[region].push(city);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Globe className="w-5 h-5 text-primary" />
          إدارة التغطية الجغرافية
        </h2>
        <p className="text-sm text-muted-foreground">تعيين المدن والأحياء لكل معاين ميداني</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inspector list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              المعاينون ({inspectors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[500px] overflow-auto">
            {inspectors.map(insp => (
              <div
                key={insp.id}
                onClick={() => selectInspector(insp)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedInspector?.id === insp.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{(insp as any).full_name_ar || "معاين"}</p>
                  <Badge variant={insp.availability_status === "available" ? "default" : "secondary"} className="text-[10px]">
                    {insp.availability_status === "available" ? "متاح" : "مشغول"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>عبء: {insp.current_workload}/{insp.max_concurrent_tasks}</span>
                  <span>•</span>
                  <span>الجودة: {Number(insp.quality_score).toFixed(1)}</span>
                </div>
              </div>
            ))}
            {inspectors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">لا يوجد معاينون</p>
            )}
          </CardContent>
        </Card>

        {/* Coverage details */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                مناطق التغطية
                {selectedInspector && <span className="text-muted-foreground font-normal">— {(selectedInspector as any).full_name_ar}</span>}
              </CardTitle>
              {selectedInspector && (
                <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> إضافة تغطية
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedInspector ? (
              <p className="text-sm text-muted-foreground text-center py-8">اختر معايناً لعرض تغطيته الجغرافية</p>
            ) : coverageAreas.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <MapPin className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">لا توجد مناطق تغطية محددة</p>
                <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)} className="gap-1">
                  <Plus className="w-3.5 h-3.5" /> إضافة منطقة
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Coverage map visualization */}
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <h4 className="text-xs font-medium text-muted-foreground mb-3">خريطة التغطية</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {coverageAreas.map(area => (
                      <div
                        key={area.id}
                        className={`p-2 rounded-lg border text-center ${
                          area.is_primary
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Building2 className="w-3 h-3 text-primary" />
                          <span className="text-xs font-medium">{area.city_name}</span>
                        </div>
                        {area.district_name && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{area.district_name}</p>
                        )}
                        {area.is_primary && (
                          <Badge className="text-[8px] h-3 mt-1 bg-primary/20 text-primary">رئيسي</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coverage table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المدينة</TableHead>
                      <TableHead className="text-right">الحي</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right w-16">حذف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coverageAreas.map(area => (
                      <TableRow key={area.id}>
                        <TableCell className="text-sm">{area.city_name}</TableCell>
                        <TableCell className="text-sm">{area.district_name || "كل الأحياء"}</TableCell>
                        <TableCell>
                          {area.is_primary ? (
                            <Badge className="text-[10px] gap-0.5"><Star className="w-2.5 h-2.5" /> رئيسي</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">ثانوي</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeCoverage(area.id)}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cities reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            المدن المتاحة حسب المنطقة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(regionGroups).map(([region, citiesList]) => (
              <div key={region} className="p-3 rounded-lg border border-border">
                <p className="text-xs font-medium text-primary mb-2">{region}</p>
                <div className="flex flex-wrap gap-1">
                  {citiesList.map(city => (
                    <Badge key={city.id} variant="outline" className="text-[10px]">{city.name_ar}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add coverage dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              إضافة منطقة تغطية
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>المدينة *</Label>
              <Select value={newCityId} onValueChange={v => { setNewCityId(v); setNewDistrictId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المدينة" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map(city => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name_ar} — {city.region_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الحي (اختياري)</Label>
              <Select value={newDistrictId} onValueChange={setNewDistrictId} disabled={!newCityId}>
                <SelectTrigger>
                  <SelectValue placeholder="كل الأحياء" />
                </SelectTrigger>
                <SelectContent>
                  {filteredDistricts.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="primary" checked={newIsPrimary} onCheckedChange={v => setNewIsPrimary(v === true)} />
              <Label htmlFor="primary" className="text-sm">منطقة رئيسية</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>إلغاء</Button>
            <Button onClick={addCoverage} disabled={!newCityId}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
