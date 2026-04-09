/**
 * Level 62: Smart Loyalty & Incentive Pricing Engine
 * Auto-calculates loyalty discounts, anniversary rewards, and portfolio bundle offers
 */

interface LoyaltyOffer {
  rewardType: string;
  rewardName: string;
  discountPercent: number;
  message: string;
  code?: string;
  validUntil?: string;
}

interface LoyaltyResult {
  section: string;
  offers: LoyaltyOffer[];
  clientTier: "new" | "returning" | "loyal" | "vip";
  totalRequests: number;
  totalRevenue: number;
  anniversaryDate?: string;
}

export async function analyzeLoyaltyOffers(
  db: any,
  assignmentId: string | undefined,
  clientUserId: string | undefined
): Promise<LoyaltyResult> {
  const empty: LoyaltyResult = { section: "", offers: [], clientTier: "new", totalRequests: 0, totalRevenue: 0 };
  if (!clientUserId) return empty;

  try {
    // Get client links
    const { data: clientLinks } = await db
      .from("clients")
      .select("id, created_at")
      .eq("portal_user_id", clientUserId);

    if (!clientLinks?.length) return empty;
    const clientIds = clientLinks.map((c: any) => c.id);
    const firstClientDate = new Date(Math.min(...clientLinks.map((c: any) => new Date(c.created_at).getTime())));

    // Count completed requests
    const { data: completedAssignments } = await db
      .from("valuation_assignments")
      .select("id, final_value_sar, total_fees, created_at")
      .in("client_id", clientIds)
      .in("status", ["issued", "archived"])
      .order("created_at", { ascending: false })
      .limit(100);

    const totalRequests = completedAssignments?.length || 0;
    const totalRevenue = completedAssignments?.reduce((s: number, a: any) => s + (a.total_fees || 0), 0) || 0;

    // Determine tier
    const clientTier: "new" | "returning" | "loyal" | "vip" =
      totalRequests >= 10 ? "vip" : totalRequests >= 5 ? "loyal" : totalRequests >= 2 ? "returning" : "new";

    // Get active loyalty rewards
    const { data: rewards } = await db
      .from("loyalty_rewards")
      .select("*")
      .eq("is_active", true);

    const offers: LoyaltyOffer[] = [];
    const now = new Date();

    for (const reward of rewards || []) {
      const cond = reward.trigger_condition || {};

      if (cond.type === "repeat_client" && totalRequests >= (cond.min_requests || 3)) {
        offers.push({
          rewardType: "repeat_client",
          rewardName: reward.reward_name_ar,
          discountPercent: reward.discount_percentage,
          message: `🎁 كعميل متكرر (${totalRequests} طلبات مكتملة)، تحصل على خصم ${reward.discount_percentage}% على طلبك القادم!`,
          code: `LOYAL-${clientUserId.substring(0, 6).toUpperCase()}`,
        });
      }

      if (cond.type === "annual_loyalty" && totalRequests >= (cond.min_requests || 5)) {
        offers.push({
          rewardType: "annual_loyalty",
          rewardName: reward.reward_name_ar,
          discountPercent: reward.discount_percentage,
          message: `🏆 أنت من عملائنا المميزين! خصم ${reward.discount_percentage}% حصري على جميع الخدمات طوال السنة.`,
          code: `VIP-${now.getFullYear()}`,
        });
      }

      if (cond.type === "early_renewal") {
        offers.push({
          rewardType: "early_renewal",
          rewardName: reward.reward_name_ar,
          discountPercent: reward.discount_percentage,
          message: `⏰ جدد تقييمك مبكراً واحصل على خصم ${reward.discount_percentage}%! العرض ساري لمدة ${reward.validity_days} يوم.`,
        });
      }

      if (cond.type === "portfolio_bundle" && totalRequests >= (cond.min_assets || 5)) {
        offers.push({
          rewardType: "portfolio_bundle",
          rewardName: reward.reward_name_ar,
          discountPercent: reward.discount_percentage,
          message: `📦 حزمة إعادة تقييم المحفظة — وفر ${reward.discount_percentage}% عند تقييم 5 أصول أو أكثر في طلب واحد!`,
          code: `BUNDLE-${now.getFullYear()}`,
        });
      }

      if (cond.type === "anniversary") {
        const yearsAsClient = Math.floor((now.getTime() - firstClientDate.getTime()) / (365.25 * 86400000));
        const daysSinceAnniversary = Math.floor(
          ((now.getTime() - firstClientDate.getTime()) % (365.25 * 86400000)) / 86400000
        );

        if (yearsAsClient >= (cond.years || 1) && daysSinceAnniversary <= 30) {
          offers.push({
            rewardType: "anniversary",
            rewardName: reward.reward_name_ar,
            discountPercent: reward.discount_percentage,
            message: `🎂 ذكرى تعاملك الـ${yearsAsClient} معنا! خصم ${reward.discount_percentage}% هدية منا — نقدّر ثقتك المستمرة.`,
            code: `ANNIV-${yearsAsClient}Y`,
            validUntil: new Date(now.getTime() + (reward.validity_days || 30) * 86400000).toLocaleDateString("ar-SA"),
          });
        }
      }
    }

    let section = "";
    if (offers.length > 0 || clientTier !== "new") {
      const tierLabels = { new: "عميل جديد", returning: "عميل متكرر", loyal: "عميل مخلص", vip: "عميل VIP" };
      section = "\n\n## محرك الولاء والحوافز (المستوى 62)\n";
      section += `- فئة العميل: ${tierLabels[clientTier]} | الطلبات المكتملة: ${totalRequests} | إجمالي الإيرادات: ${totalRevenue.toLocaleString()} ر.س\n`;
      for (const o of offers) {
        section += `🎁 ${o.message}${o.code ? ` [كود: ${o.code}]` : ""}\n`;
      }
      section += "\nاستخدم هذه العروض بذكاء عند اللحظة المناسبة (نهاية محادثة، سؤال عن أسعار، طلب جديد). لا تعرضها جميعاً دفعة واحدة.\n";
    }

    return {
      section, offers, clientTier, totalRequests, totalRevenue,
      anniversaryDate: firstClientDate.toLocaleDateString("ar-SA"),
    };
  } catch (e) {
    console.error("Loyalty engine error:", e);
    return empty;
  }
}
