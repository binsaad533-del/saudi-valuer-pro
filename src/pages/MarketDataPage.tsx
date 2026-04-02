import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, Database, Upload, Search, Plus,
  MapPin, Calendar, DollarSign, Loader2, CheckCircle2,
  BarChart3, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";

interface MarketEntry {
  id?: string;
  property_type: string;
  city_ar: string;
  district_ar: string;
  price: number;
  price_per_sqm: number;
  land_area: number;
  transaction_date: string;
  transaction_type: string;
  source: string;
}

export default function MarketDataIntegration() {
  const [activeTab, setActiveTab] = useState("browse");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchCity, setSearchCity] = useState("");
  const [searchType, setSearchType] = useState("");
  const [zoneStats, setZoneStats] = useState<any[]>([]);

  // Manual entry state
  const [newEntry, setNewEntry] = useState<MarketEntry>({
    property_type: "residential",
    city_ar: "",
    district_ar: "",
    price: 0,
    price_per_sqm: 0,
    land_area: 0,
    transaction_date: new Date().toISOString().split("T")[0],
    transaction_type: "sale",
    source: "manual",
  });

  const searchComparables = async () => {
    if (!searchCity && !searchType) {
      toast.error("اختر مدينة أو نوع عقار للبحث");
      return;
    }
    setLoading(true);
    try {
      let query = supabase.from("comparables").select("*").order("transaction_date", { ascending: false }).limit(50);
      if (searchCity) query = query.ilike("city_ar", `%${searchCity}%`);
      if (searchType) query = query.eq("property_type", searchType as any);
      const { data, error } = await query;
      if (error) throw error;
      setSearchResults(data || []);
      toast.success(`تم العثور على ${data?.length || 0} مقارنة`);
    } catch (err) {
      toast.error("خطأ في البحث");
    } finally {
      setLoading(false);
    }
  };

  const loadZoneStats = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("market_zones")
        .select("name_ar, city_ar, avg_price_per_sqm, trend, zone_type, last_updated")
        .order("avg_price_per_sqm", { ascending: false })
        .limit(20);
      setZoneStats(data || []);
    } catch {
      toast.error("خطأ في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  const addComparable = async () => {
    if (!newEntry.city_ar || !newEntry.price) {
      toast.error("أكمل البيانات المطلوبة");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("user_id", user.id).maybeSingle();
      if (!profile?.organization_id) throw new Error("No organization");

      const { error } = await supabase.from("comparables").insert({
        property_type: newEntry.property_type as any,
        city_ar: newEntry.city_ar,
        district_ar: newEntry.district_ar,
        price: newEntry.price,
        price_per_sqm: newEntry.price_per_sqm,
        land_area: newEntry.land_area,
        transaction_date: newEntry.transaction_date,
        transaction_type: newEntry.transaction_type,
        organization_id: profile.organization_id,
        created_by: user.id,
      });

      if (error) throw error;
      toast.success("تمت إضافة المقارنة بنجاح");
      setNewEntry({
        property_type: "residential",
        city_ar: "", district_ar: "", price: 0, price_per_sqm: 0,
        land_area: 0, transaction_date: new Date().toISOString().split("T")[0],
        transaction_type: "sale", source: "manual",
      });
    } catch (err: any) {
      toast.error(err.message || "خطأ في الإضافة");
    } finally {
      setLoading(false);
    }
  };

  const trendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (trend === "down") return <TrendingUp className="h-3 w-3 text-red-600 rotate-180" />;
    return <BarChart3 className="h-3 w-3 text-gray-400" />;
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          بيانات السوق والمقارنات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">استيراد وإدارة بيانات السوق العقاري</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList>
          <TabsTrigger value="browse" className="gap-1"><Search className="h-3 w-3" /> البحث</TabsTrigger>
          <TabsTrigger value="zones" className="gap-1" onClick={loadZoneStats}><MapPin className="h-3 w-3" /> المناطق</TabsTrigger>
          <TabsTrigger value="add" className="gap-1"><Plus className="h-3 w-3" /> إضافة مقارنة</TabsTrigger>
        </TabsList>

        {/* Search Tab */}
        <TabsContent value="browse" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">المدينة</Label>
                  <Input
                    placeholder="الرياض، جدة..."
                    value={searchCity}
                    onChange={e => setSearchCity(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">نوع العقار</Label>
                  <Select value={searchType} onValueChange={setSearchType}>
                    <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">سكني</SelectItem>
                      <SelectItem value="commercial">تجاري</SelectItem>
                      <SelectItem value="land">أراضي</SelectItem>
                      <SelectItem value="industrial">صناعي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={searchComparables} disabled={loading} className="w-full gap-1">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    بحث
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {searchResults.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">النتائج ({searchResults.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2 text-right font-medium text-muted-foreground">المدينة</th>
                        <th className="p-2 text-right font-medium text-muted-foreground">الحي</th>
                        <th className="p-2 text-right font-medium text-muted-foreground">النوع</th>
                        <th className="p-2 text-center font-medium text-muted-foreground">السعر (ر.س)</th>
                        <th className="p-2 text-center font-medium text-muted-foreground">م²</th>
                        <th className="p-2 text-center font-medium text-muted-foreground">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((r, i) => (
                        <tr key={r.id || i} className="border-t border-border/50">
                          <td className="p-2">{r.city_ar || "—"}</td>
                          <td className="p-2">{r.district_ar || "—"}</td>
                          <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.property_type}</Badge></td>
                          <td className="p-2 text-center font-mono">{formatNumber(r.price || 0)}</td>
                          <td className="p-2 text-center">{r.land_area || "—"}</td>
                          <td className="p-2 text-center text-xs">{r.transaction_date?.substring(0, 10) || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Zones Tab */}
        <TabsContent value="zones" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : zoneStats.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <MapPin className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>لا توجد بيانات مناطق. اضغط على تبويب "المناطق" لتحميل البيانات.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {zoneStats.map((z, i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm text-foreground">{z.name_ar}</p>
                        <p className="text-xs text-muted-foreground">{z.city_ar} • {z.zone_type || "عام"}</p>
                      </div>
                      {trendIcon(z.trend)}
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-lg font-bold text-primary">{formatNumber(z.avg_price_per_sqm || 0)}</span>
                      <span className="text-xs text-muted-foreground">ر.س/م²</span>
                    </div>
                    {z.last_updated && (
                      <p className="text-[10px] text-muted-foreground mt-1">آخر تحديث: {z.last_updated.substring(0, 10)}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Add Tab */}
        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                إضافة مقارنة سوقية جديدة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>نوع العقار</Label>
                  <Select value={newEntry.property_type} onValueChange={v => setNewEntry(p => ({ ...p, property_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">سكني</SelectItem>
                      <SelectItem value="commercial">تجاري</SelectItem>
                      <SelectItem value="land">أراضي</SelectItem>
                      <SelectItem value="industrial">صناعي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>نوع الصفقة</Label>
                  <Select value={newEntry.transaction_type} onValueChange={v => setNewEntry(p => ({ ...p, transaction_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">بيع</SelectItem>
                      <SelectItem value="rent">إيجار</SelectItem>
                      <SelectItem value="auction">مزاد</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>المدينة *</Label>
                  <Input value={newEntry.city_ar} onChange={e => setNewEntry(p => ({ ...p, city_ar: e.target.value }))} placeholder="الرياض" />
                </div>
                <div>
                  <Label>الحي</Label>
                  <Input value={newEntry.district_ar} onChange={e => setNewEntry(p => ({ ...p, district_ar: e.target.value }))} placeholder="النرجس" />
                </div>
                <div>
                  <Label>السعر (ر.س) *</Label>
                  <Input type="number" value={newEntry.price || ""} onChange={e => setNewEntry(p => ({ ...p, price: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>سعر المتر (ر.س/م²)</Label>
                  <Input type="number" value={newEntry.price_per_sqm || ""} onChange={e => setNewEntry(p => ({ ...p, price_per_sqm: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>المساحة (م²)</Label>
                  <Input type="number" value={newEntry.land_area || ""} onChange={e => setNewEntry(p => ({ ...p, land_area: Number(e.target.value) }))} />
                </div>
                <div>
                  <Label>تاريخ الصفقة</Label>
                  <Input type="date" value={newEntry.transaction_date} onChange={e => setNewEntry(p => ({ ...p, transaction_date: e.target.value }))} />
                </div>
              </div>
              <Button onClick={addComparable} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                حفظ المقارنة
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
