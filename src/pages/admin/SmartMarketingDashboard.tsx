import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Megaphone, Users, TrendingUp, Gift, Calendar, Heart,
  AlertTriangle, Target, BarChart3, RefreshCw, Send, Eye
} from "lucide-react";

interface EngagementScore {
  id: string;
  client_id: string;
  engagement_score: number;
  activity_status: string;
  total_requests: number;
  total_revenue: number;
  churn_risk_score: number;
  lifecycle_stage: string;
  last_request_at: string;
}

interface EngagementLog {
  id: string;
  client_id: string;
  campaign_type: string;
  channel: string;
  message_ar: string;
  delivery_status: string;
  opened_at: string | null;
  responded_at: string | null;
  discount_code: string | null;
  created_at: string;
}

interface OccasionTemplate {
  id: string;
  occasion_key: string;
  occasion_name_ar: string;
  default_message_ar: string;
  gregorian_month: number | null;
  gregorian_day: number | null;
  is_active: boolean;
  include_offer: boolean;
  offer_discount_pct: number | null;
}

interface LoyaltyReward {
  id: string;
  reward_name_ar: string;
  reward_type: string;
  discount_percentage: number | null;
  min_requests: number;
  is_active: boolean;
  trigger_condition: any;
}

export default function SmartMarketingDashboard() {
  const [scores, setScores] = useState<EngagementScore[]>([]);
  const [logs, setLogs] = useState<EngagementLog[]>([]);
  const [occasions, setOccasions] = useState<OccasionTemplate[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [scoresRes, logsRes, occasionsRes, rewardsRes] = await Promise.all([
      supabase.from("client_engagement_scores").select("*").order("engagement_score", { ascending: false }).limit(100),
      supabase.from("engagement_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("occasion_templates").select("*").order("gregorian_month"),
      supabase.from("loyalty_rewards").select("*").order("min_requests"),
    ]);

    setScores((scoresRes.data || []) as any);
    setLogs((logsRes.data || []) as any);
    setOccasions((occasionsRes.data || []) as any);
    setRewards((rewardsRes.data || []) as any);
    setLoading(false);
  }

  async function triggerEngagement() {
    setTriggering(true);
    try {
      await supabase.functions.invoke("raqeem-smart-engagement");
      await loadData();
    } catch (e) {
      console.error(e);
    }
    setTriggering(false);
  }

  // Stats
  const activeClients = scores.filter(s => s.activity_status === "active").length;
  const dormantClients = scores.filter(s => ["dormant", "churned"].includes(s.activity_status)).length;
  const atRiskClients = scores.filter(s => s.churn_risk_score > 50).length;
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, c) => s + c.engagement_score, 0) / scores.length) : 0;

  const totalSent = logs.length;
  const totalResponded = logs.filter(l => l.responded_at).length;
  const responseRate = totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0;

  const campaignTypeLabels: Record<string, string> = {
    report_expiry: "انتهاء تقرير",
    dormant_reengagement: "إعادة تفاعل",
    satisfaction_survey: "تقييم رضا",
    budget_season: "موسم الميزانية",
    occasion_eid_fitr: "عيد الفطر",
    occasion_eid_adha: "عيد الأضحى",
    occasion_saudi_national_day: "اليوم الوطني",
    occasion_saudi_founding_day: "يوم التأسيس",
    occasion_ramadan: "رمضان",
    occasion_new_year: "رأس السنة",
  };

  const statusLabels: Record<string, string> = {
    active: "نشط",
    cooling: "يتراجع",
    dormant: "خامل",
    churned: "منقطع",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cooling: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    dormant: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    churned: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Megaphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">التسويق الذكي</h1>
            <p className="text-sm text-muted-foreground">محرك التفاعل والعلاقات — المستويات 61-66</p>
          </div>
        </div>
        <Button onClick={triggerEngagement} disabled={triggering} size="sm">
          <Send className="h-4 w-4 ml-2" />
          {triggering ? "جارٍ التشغيل..." : "تشغيل محرك التفاعل"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-2 text-green-500" />
            <div className="text-2xl font-bold">{activeClients}</div>
            <div className="text-xs text-muted-foreground">عملاء نشطون</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-orange-500" />
            <div className="text-2xl font-bold">{dormantClients}</div>
            <div className="text-xs text-muted-foreground">عملاء خاملون</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-2 text-red-500" />
            <div className="text-2xl font-bold">{atRiskClients}</div>
            <div className="text-xs text-muted-foreground">معرضون للانقطاع</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-2 text-blue-500" />
            <div className="text-2xl font-bold">{avgScore}%</div>
            <div className="text-xs text-muted-foreground">متوسط التفاعل</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Send className="h-5 w-5 mx-auto mb-2 text-purple-500" />
            <div className="text-2xl font-bold">{totalSent}</div>
            <div className="text-xs text-muted-foreground">رسائل مرسلة</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-2 text-teal-500" />
            <div className="text-2xl font-bold">{responseRate}%</div>
            <div className="text-xs text-muted-foreground">معدل الاستجابة</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="clients" dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="clients">العملاء</TabsTrigger>
          <TabsTrigger value="campaigns">سجل الحملات</TabsTrigger>
          <TabsTrigger value="occasions">المناسبات</TabsTrigger>
          <TabsTrigger value="rewards">مكافآت الولاء</TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                مؤشرات تفاعل العملاء
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scores.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد بيانات بعد. شغّل محرك التفاعل لتحليل العملاء.</p>
              ) : (
                <div className="space-y-3">
                  {scores.slice(0, 20).map(score => (
                    <div key={score.id} className="flex items-center gap-4 p-3 rounded-lg border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={statusColors[score.activity_status] || ""} variant="secondary">
                            {statusLabels[score.activity_status] || score.activity_status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {score.total_requests} طلب | {score.total_revenue?.toLocaleString()} ر.س
                          </span>
                        </div>
                        <Progress value={score.engagement_score} className="h-2" />
                      </div>
                      <div className="text-center min-w-[60px]">
                        <div className="text-lg font-bold">{score.engagement_score}</div>
                        <div className="text-[10px] text-muted-foreground">تفاعل</div>
                      </div>
                      {score.churn_risk_score > 50 && (
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5" />
                سجل الرسائل والحملات
              </CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد رسائل مرسلة بعد.</p>
              ) : (
                <div className="space-y-2">
                  {logs.slice(0, 30).map(log => (
                    <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {campaignTypeLabels[log.campaign_type] || log.campaign_type}
                          </Badge>
                          <Badge variant={log.responded_at ? "default" : "secondary"} className="text-xs">
                            {log.responded_at ? "تمت الاستجابة" : log.delivery_status === "sent" ? "مرسلة" : "معلقة"}
                          </Badge>
                          {log.discount_code && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                              <Gift className="h-3 w-3 ml-1" />
                              {log.discount_code}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground line-clamp-2">{log.message_ar}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleDateString("ar-SA")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Occasions Tab */}
        <TabsContent value="occasions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                قوالب المناسبات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {occasions.map(occ => (
                  <div key={occ.id} className="p-4 rounded-lg border space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{occ.occasion_name_ar}</h3>
                      <Badge variant={occ.is_active ? "default" : "secondary"}>
                        {occ.is_active ? "مفعّل" : "معطّل"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{occ.default_message_ar}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {occ.gregorian_month && occ.gregorian_day && (
                        <span>{occ.gregorian_day}/{occ.gregorian_month}</span>
                      )}
                      {occ.include_offer && occ.offer_discount_pct && (
                        <Badge variant="outline" className="text-xs">
                          <Gift className="h-3 w-3 ml-1" />
                          خصم {occ.offer_discount_pct}%
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5" />
                برنامج مكافآت الولاء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rewards.map(reward => (
                  <div key={reward.id} className="flex items-center gap-4 p-4 rounded-lg border">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Gift className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{reward.reward_name_ar}</h3>
                      <p className="text-sm text-muted-foreground">
                        الحد الأدنى: {reward.min_requests} طلب
                        {reward.trigger_condition?.type && ` | النوع: ${reward.trigger_condition.type}`}
                      </p>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-primary">{reward.discount_percentage}%</div>
                      <div className="text-xs text-muted-foreground">خصم</div>
                    </div>
                    <Badge variant={reward.is_active ? "default" : "secondary"}>
                      {reward.is_active ? "نشط" : "معطّل"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
