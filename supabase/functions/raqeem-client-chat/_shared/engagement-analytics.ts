/**
 * Level 66: Smart Marketing Analytics Engine
 * Tracks campaign effectiveness, conversion rates, and client engagement metrics
 */

interface CampaignMetric {
  campaignType: string;
  sent: number;
  responded: number;
  converted: number;
  conversionRate: number;
}

interface EngagementAnalyticsResult {
  section: string;
  totalCampaignsSent: number;
  overallResponseRate: number;
  overallConversionRate: number;
  activeClients: number;
  dormantClients: number;
  atRiskClients: number;
  topCampaigns: CampaignMetric[];
  recommendations: string[];
}

export async function analyzeEngagementAnalytics(
  db: any,
  organizationId: string | undefined
): Promise<EngagementAnalyticsResult> {
  const empty: EngagementAnalyticsResult = {
    section: "", totalCampaignsSent: 0, overallResponseRate: 0,
    overallConversionRate: 0, activeClients: 0, dormantClients: 0,
    atRiskClients: 0, topCampaigns: [], recommendations: [],
  };

  try {
    // Get engagement scores summary
    const { data: scores } = await db
      .from("client_engagement_scores")
      .select("activity_status, engagement_score, churn_risk_score")
      .limit(500);

    const activeClients = scores?.filter((s: any) => s.activity_status === "active").length || 0;
    const dormantClients = scores?.filter((s: any) => ["dormant", "churned"].includes(s.activity_status)).length || 0;
    const atRiskClients = scores?.filter((s: any) => s.churn_risk_score > 50).length || 0;

    // Get campaign performance
    const { data: logs } = await db
      .from("engagement_logs")
      .select("campaign_type, delivery_status, responded_at, conversion_value")
      .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
      .limit(1000);

    const totalSent = logs?.length || 0;
    const totalResponded = logs?.filter((l: any) => l.responded_at).length || 0;
    const totalConverted = logs?.filter((l: any) => l.conversion_value > 0).length || 0;

    // Group by campaign type
    const byType: Record<string, { sent: number; responded: number; converted: number }> = {};
    for (const l of logs || []) {
      if (!byType[l.campaign_type]) byType[l.campaign_type] = { sent: 0, responded: 0, converted: 0 };
      byType[l.campaign_type].sent++;
      if (l.responded_at) byType[l.campaign_type].responded++;
      if (l.conversion_value > 0) byType[l.campaign_type].converted++;
    }

    const topCampaigns: CampaignMetric[] = Object.entries(byType)
      .map(([type, m]) => ({
        campaignType: type,
        ...m,
        conversionRate: m.sent > 0 ? Math.round((m.converted / m.sent) * 100) : 0,
      }))
      .sort((a, b) => b.conversionRate - a.conversionRate);

    // Generate recommendations
    const recommendations: string[] = [];
    if (dormantClients > activeClients * 0.3) {
      recommendations.push(`${dormantClients} عميل خامل — يُوصى بحملة إعادة تفاعل مع عرض خاص`);
    }
    if (atRiskClients > 0) {
      recommendations.push(`${atRiskClients} عميل معرض لخطر الانقطاع — أولوية التواصل الشخصي`);
    }
    if (totalSent > 0 && (totalResponded / totalSent) < 0.1) {
      recommendations.push("معدل الاستجابة أقل من 10% — راجع توقيت الإرسال ومحتوى الرسائل");
    }

    let section = "";
    if (totalSent > 0 || scores?.length) {
      section = "\n\n## تحليلات التسويق الذكي (المستوى 66)\n";
      section += `- العملاء: نشط ${activeClients} | خامل ${dormantClients} | معرض للانقطاع ${atRiskClients}\n`;
      section += `- الحملات (90 يوم): مرسلة ${totalSent} | استجابة ${totalResponded} | تحويل ${totalConverted}\n`;
      if (recommendations.length > 0) {
        for (const r of recommendations) section += `📊 ${r}\n`;
      }
    }

    return {
      section, totalCampaignsSent: totalSent,
      overallResponseRate: totalSent > 0 ? Math.round((totalResponded / totalSent) * 100) : 0,
      overallConversionRate: totalSent > 0 ? Math.round((totalConverted / totalSent) * 100) : 0,
      activeClients, dormantClients, atRiskClients, topCampaigns, recommendations,
    };
  } catch (e) {
    console.error("Engagement analytics error:", e);
    return empty;
  }
}
