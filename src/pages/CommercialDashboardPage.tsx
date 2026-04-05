import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PAYMENT_STATUS_LABELS } from "@/lib/commercial-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CurrencyDisplay } from "@/components/ui/saudi-riyal";
import CompanyTaxHeader from "@/components/commercial/CompanyTaxHeader";
import {
  Wallet, FileText, Clock, CheckCircle, AlertTriangle,
  TrendingUp, Ticket, ArrowRight, Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

export default function CommercialDashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [discountUsage, setDiscountUsage] = useState<any[]>([]);
  const [stats, setStats] = useState({
    pendingQuotations: 0,
    awaitingPayment: 0,
    paidRequests: 0,
    overduePayments: 0,
    totalRevenue: 0,
    totalDiscounts: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [assignRes, invoiceRes, usageRes] = await Promise.all([
      supabase
        .from("valuation_assignments")
        .select("id, reference_number, status, payment_status, quotation_amount, total_fees, amount_paid, client_name_ar, created_at")
        .in("status", [
          "under_pricing", "quotation_sent", "quotation_approved",
          "awaiting_payment", "payment_uploaded", "in_progress",
          "review", "approved", "issued",
        ] as any)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("invoices" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("discount_usage_log" as any)
        .select("*, discount_codes!inner(code)")
        .order("used_at", { ascending: false })
        .limit(50),
    ]);

    const a = assignRes.data || [];
    const inv = invoiceRes.data || [];
    const usage = usageRes.data || [];

    setAssignments(a);
    setInvoices(inv);
    setDiscountUsage(usage);

    // Calculate stats
    const pendingQuotations = a.filter((r: any) => ["under_pricing", "quotation_sent"].includes(r.status)).length;
    const awaitingPayment = a.filter((r: any) => ["awaiting_payment", "payment_uploaded"].includes(r.status)).length;
    const paidRequests = a.filter((r: any) => r.payment_status === "paid").length;
    const overduePayments = inv.filter((i: any) => i.payment_status === "overdue").length;
    const totalRevenue = a.reduce((sum: number, r: any) => sum + (r.amount_paid || 0), 0);
    const totalDiscounts = usage.reduce((sum: number, u: any) => sum + (u.discount_applied || 0), 0);

    setStats({ pendingQuotations, awaitingPayment, paidRequests, overduePayments, totalRevenue, totalDiscounts });
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  const statCards = [
    { label: "عروض أسعار معلقة", value: stats.pendingQuotations, icon: FileText, color: "text-sky-600" },
    { label: "بانتظار الدفع", value: stats.awaitingPayment, icon: Clock, color: "text-amber-600" },
    { label: "طلبات مدفوعة", value: stats.paidRequests, icon: CheckCircle, color: "text-emerald-600" },
    { label: "مدفوعات متأخرة", value: stats.overduePayments, icon: AlertTriangle, color: "text-destructive" },
    { label: "إجمالي الإيرادات", value: <CurrencyDisplay amount={stats.totalRevenue} />, icon: TrendingUp, color: "text-primary" },
    { label: "خصومات مستخدمة", value: <CurrencyDisplay amount={stats.totalDiscounts} />, icon: Ticket, color: "text-violet-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Wallet className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">العمليات التجارية</h1>
          <p className="text-sm text-muted-foreground">عروض الأسعار والمدفوعات والفواتير</p>
        </div>
      </div>

      {/* Company Tax Info */}
      <CompanyTaxHeader showLogo />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((s, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} />
              <div className="text-lg font-bold text-foreground">{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="quotations" dir="rtl">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="quotations">عروض الأسعار</TabsTrigger>
          <TabsTrigger value="invoices">الفواتير</TabsTrigger>
          <TabsTrigger value="discounts">الخصومات</TabsTrigger>
        </TabsList>

        {/* Quotations Tab */}
        <TabsContent value="quotations" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المرجع</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">حالة الدفع</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.slice(0, 30).map((a) => {
                    const ps = PAYMENT_STATUS_LABELS[a.payment_status || "draft"] || PAYMENT_STATUS_LABELS.draft;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.reference_number}</TableCell>
                        <TableCell className="text-sm">{a.client_name_ar || "—"}</TableCell>
                        <TableCell><CurrencyDisplay amount={a.quotation_amount || a.total_fees || 0} /></TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${ps.color} border-0`}>{ps.ar}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.status}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(a.created_at), "yyyy/MM/dd")}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/assignment/${a.id}`)}>
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {assignments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                        لا توجد عروض أسعار
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم الفاتورة</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">الخصم</TableHead>
                    <TableHead className="text-right">الضريبة</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => {
                    const ps = PAYMENT_STATUS_LABELS[inv.payment_status] || PAYMENT_STATUS_LABELS.draft;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell><CurrencyDisplay amount={inv.subtotal} /></TableCell>
                        <TableCell className="text-destructive"><CurrencyDisplay amount={inv.discount_amount} /></TableCell>
                        <TableCell><CurrencyDisplay amount={inv.vat_amount} /></TableCell>
                        <TableCell className="font-semibold"><CurrencyDisplay amount={inv.total_amount} /></TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${ps.color} border-0`}>{ps.ar}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(inv.created_at), "yyyy/MM/dd")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {invoices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                        لا توجد فواتير
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Discounts Tab */}
        <TabsContent value="discounts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="w-4 h-4 text-primary" />
                سجل استخدام الخصومات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {discountUsage.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد خصومات مستخدمة</p>
              ) : (
                <div className="space-y-2">
                  {discountUsage.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <Badge variant="outline" className="font-mono text-xs">{u.discount_codes?.code}</Badge>
                        <span className="text-xs text-muted-foreground mr-2">
                          {format(new Date(u.used_at), "yyyy/MM/dd")}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-destructive">-<CurrencyDisplay amount={u.discount_applied} /></span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
