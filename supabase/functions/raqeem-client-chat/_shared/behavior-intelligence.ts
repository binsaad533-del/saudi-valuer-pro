/**
 * Level 63: Client Behavior Intelligence & Recommendations
 * Detects dormant clients, cross-sell opportunities, market alerts, and personalized insights
 */

interface BehaviorInsight {
  type: string;
  priority: "low" | "medium" | "high";
  message: string;
  actionSuggestion?: string;
}

interface BehaviorResult {
  section: string;
  insights: BehaviorInsight[];
  activityStatus: "active" | "cooling" | "dormant" | "churned";
  daysSinceLastActivity: number;
  crossSellOpportunities: string[];
  engagementScore: number;
}

export async function analyzeBehaviorIntelligence(
  db: any,
  assignmentId: string | undefined,
  clientUserId: string | undefined
): Promise<BehaviorResult> {
  const empty: BehaviorResult = {
    section: "", insights: [], activityStatus: "active",
    daysSinceLastActivity: 0, crossSellOpportunities: [], engagementScore: 50,
  };
  if (!clientUserId) return empty;

  try {
    const now = Date.now();
    const insights: BehaviorInsight[] = [];
    const crossSellOpportunities: string[] = [];

    // Get client data
    const { data: clientLinks } = await db
      .from("clients")
      .select("id, created_at")
      .eq("portal_user_id", clientUserId);

    if (!clientLinks?.length) return empty;
    const clientIds = clientLinks.map((c: any) => c.id);

    // Get all assignments for analysis
    const { data: assignments } = await db
      .from("valuation_assignments")
      .select("id, property_type, status, created_at, final_value_sar, total_fees")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!assignments?.length) return empty;

    // Activity analysis
    const lastActivityDate = new Date(assignments[0].created_at);
    const daysSinceLastActivity = Math.ceil((now - lastActivityDate.getTime()) / 86400000);

    const activityStatus: "active" | "cooling" | "dormant" | "churned" =
      daysSinceLastActivity <= 30 ? "active" :
      daysSinceLastActivity <= 90 ? "cooling" :
      daysSinceLastActivity <= 180 ? "dormant" : "churned";

    // Dormant client re-engagement
    if (activityStatus === "dormant" || activityStatus === "churned") {
      const avgValue = assignments
        .filter((a: any) => a.final_value_sar)
        .reduce((s: number, a: any) => s + a.final_value_sar, 0) / Math.max(1, assignments.filter((a: any) => a.final_value_sar).length);

      insights.push({
        type: "dormant_reengagement",
        priority: "high",
        message: `لم نسمع منك منذ ${daysSinceLastActivity} يوماً! نتمنى أن تكون بخير. هل لديك أصول تحتاج تقييم أو تحديث؟ يسعدنا خدمتك دائماً.`,
        actionSuggestion: avgValue > 1000000 ? "عرض حزمة VIP لإعادة التقييم" : "عرض خصم عودة العميل",
      });
    }

    // Cross-sell analysis - detect property types NOT yet used
    const usedTypes = [...new Set(assignments.map((a: any) => a.property_type).filter(Boolean))];
    const allTypes = ["residential", "commercial", "industrial", "land", "machinery", "vehicles", "equipment"];
    const unusedTypes = allTypes.filter(t => !usedTypes.includes(t));

    if (usedTypes.includes("residential") && !usedTypes.includes("commercial")) {
      crossSellOpportunities.push("commercial");
      insights.push({
        type: "cross_sell",
        priority: "medium",
        message: "لاحظنا اهتمامك بالأصول السكنية. هل لديك أصول تجارية تحتاج تقييم أيضاً؟ نقدم خبرة متخصصة في التقييم التجاري.",
      });
    }

    if (usedTypes.includes("residential") || usedTypes.includes("commercial")) {
      if (!usedTypes.includes("machinery") && !usedTypes.includes("equipment")) {
        crossSellOpportunities.push("machinery");
        insights.push({
          type: "cross_sell",
          priority: "low",
          message: "هل تعلم أننا نقدم أيضاً تقييم الآلات والمعدات؟ ترخيص رقم 4114000015 من تقييم.",
        });
      }
    }

    // High-value client special attention
    const totalValue = assignments
      .filter((a: any) => a.final_value_sar)
      .reduce((s: number, a: any) => s + a.final_value_sar, 0);

    if (totalValue > 10000000) {
      insights.push({
        type: "high_value_attention",
        priority: "medium",
        message: "كعميل من فئة VIP، نقدم لك خدمة مدير حساب مخصص ومراجعات دورية مجانية لمحفظتك.",
      });
    }

    // Market change alerts based on client's property cities
    const clientCities = [...new Set(assignments.map((a: any) => a.property_city).filter(Boolean))];
    if (clientCities.length > 0) {
      insights.push({
        type: "market_alert",
        priority: "low",
        message: `السوق العقاري في ${clientCities.slice(0, 2).join(" و")} يشهد تحركات. هل ترغب في تقرير تحليلي مختصر عن أداء منطقتك؟`,
      });
    }

    // Engagement score calculation
    const recencyScore = Math.max(0, 100 - daysSinceLastActivity);
    const frequencyScore = Math.min(100, assignments.length * 10);
    const monetaryScore = Math.min(100, Math.floor(totalValue / 100000));
    const engagementScore = Math.round((recencyScore * 0.4 + frequencyScore * 0.3 + monetaryScore * 0.3));

    // Update engagement score in DB
    if (clientLinks[0]?.id) {
      await db.from("client_engagement_scores").upsert({
        client_id: clientLinks[0].id,
        client_user_id: clientUserId,
        engagement_score: engagementScore,
        activity_status: activityStatus,
        last_interaction_at: new Date().toISOString(),
        last_request_at: lastActivityDate.toISOString(),
        total_requests: assignments.length,
        total_revenue: assignments.reduce((s: number, a: any) => s + (a.total_fees || 0), 0),
        interests: usedTypes,
        lifecycle_stage: activityStatus === "active" ? "engaged" : activityStatus === "cooling" ? "at_risk" : "lapsed",
        churn_risk_score: activityStatus === "churned" ? 90 : activityStatus === "dormant" ? 70 : activityStatus === "cooling" ? 40 : 10,
      }, { onConflict: "client_id" }).catch(() => {});
    }

    let section = "";
    if (insights.length > 0) {
      const statusLabels = { active: "نشط", cooling: "يتراجع", dormant: "خامل", churned: "منقطع" };
      section = "\n\n## ذكاء سلوك العميل (المستوى 63)\n";
      section += `- حالة النشاط: ${statusLabels[activityStatus]} | آخر نشاط: ${daysSinceLastActivity} يوم | درجة التفاعل: ${engagementScore}/100\n`;
      section += `- فرص البيع المتقاطع: ${crossSellOpportunities.length > 0 ? crossSellOpportunities.join("، ") : "لا يوجد حالياً"}\n`;
      for (const i of insights) {
        section += `💡 [${i.priority}] ${i.message}\n`;
      }
      section += "\nاستخدم هذه الرؤى بلباقة وبشكل طبيعي في المحادثة. لا تبدو كمندوب مبيعات.\n";
    }

    return { section, insights, activityStatus, daysSinceLastActivity, crossSellOpportunities, engagementScore };
  } catch (e) {
    console.error("Behavior intelligence error:", e);
    return empty;
  }
}
