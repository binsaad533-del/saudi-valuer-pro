/**
 * Level 64: Occasion & Relationship Messages Engine
 * Sends personalized greetings, thank-you notes, satisfaction surveys, and annual summaries
 */

interface OccasionMessage {
  type: string;
  message: string;
  includeOffer: boolean;
  offerCode?: string;
  offerDiscount?: number;
}

interface OccasionResult {
  section: string;
  activeOccasions: OccasionMessage[];
  satisfactionPending: boolean;
  annualSummaryAvailable: boolean;
}

export async function analyzeOccasionMessages(
  db: any,
  assignmentId: string | undefined,
  clientUserId: string | undefined,
  requestStatus: string | undefined
): Promise<OccasionResult> {
  const empty: OccasionResult = { section: "", activeOccasions: [], satisfactionPending: false, annualSummaryAvailable: false };
  if (!clientUserId) return empty;

  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const activeOccasions: OccasionMessage[] = [];

    // 1. Check active occasions from DB
    const { data: occasions } = await db
      .from("occasion_templates")
      .select("*")
      .eq("is_active", true);

    for (const occ of occasions || []) {
      let isActive = false;

      // Check Gregorian dates
      if (occ.gregorian_month && occ.gregorian_day) {
        const daysBefore = occ.send_days_before || 0;
        const occasionDate = new Date(now.getFullYear(), occ.gregorian_month - 1, occ.gregorian_day);
        const diff = Math.ceil((occasionDate.getTime() - now.getTime()) / 86400000);
        isActive = diff >= -3 && diff <= daysBefore + 3; // 3 days window after
      }

      // For Hijri dates, approximate (Ramadan, Eid, etc.) - use month matching
      if (occ.hijri_month && !occ.gregorian_month) {
        // Approximate Hijri month mapping for 2026
        const hijriApprox: Record<number, number[]> = {
          9: [2, 3],    // Ramadan ~ Feb-Mar 2026
          10: [3, 4],   // Shawwal/Eid Fitr ~ Mar-Apr 2026
          12: [5, 6],   // Dhul Hijjah/Eid Adha ~ May-Jun 2026
        };
        const months = hijriApprox[occ.hijri_month] || [];
        isActive = months.includes(currentMonth);
      }

      if (isActive) {
        const msg: OccasionMessage = {
          type: occ.occasion_key,
          message: occ.default_message_ar,
          includeOffer: occ.include_offer,
        };
        if (occ.include_offer && occ.offer_discount_pct) {
          msg.offerDiscount = occ.offer_discount_pct;
          msg.offerCode = `${occ.occasion_key.toUpperCase()}-${now.getFullYear()}`;
        }
        activeOccasions.push(msg);
      }
    }

    // 2. Post-completion thank you & satisfaction
    let satisfactionPending = false;
    if (requestStatus === "issued") {
      // Check if we already sent a thank-you for this assignment
      const { data: existingLog } = await db
        .from("engagement_logs")
        .select("id")
        .eq("client_user_id", clientUserId)
        .eq("campaign_type", "thank_you")
        .gte("created_at", new Date(now.getTime() - 7 * 86400000).toISOString())
        .limit(1);

      if (!existingLog?.length) {
        activeOccasions.push({
          type: "completion_thank_you",
          message: "شكراً لثقتكم بشركة جسّاس للتقييم! يسعدنا أن التقرير صدر بنجاح. رأيكم يهمنا — كيف تقيّمون تجربتكم معنا؟ (ممتاز / جيد / يحتاج تحسين)",
          includeOffer: true,
          offerDiscount: 5,
          offerCode: "THANKYOU",
        });
        satisfactionPending = true;
      }
    }

    // 3. Annual summary availability (January)
    let annualSummaryAvailable = false;
    if (currentMonth === 1 || currentMonth === 2) {
      const { data: clientLinks } = await db
        .from("clients")
        .select("id")
        .eq("portal_user_id", clientUserId);

      if (clientLinks?.length) {
        const lastYear = now.getFullYear() - 1;
        const { count } = await db
          .from("valuation_assignments")
          .select("id", { count: "exact", head: true })
          .in("client_id", clientLinks.map((c: any) => c.id))
          .in("status", ["issued", "archived"])
          .gte("created_at", `${lastYear}-01-01`)
          .lte("created_at", `${lastYear}-12-31`);

        if ((count || 0) > 0) {
          annualSummaryAvailable = true;
          activeOccasions.push({
            type: "annual_summary",
            message: `📊 تقريرك السنوي لعام ${lastYear} جاهز! يتضمن ملخص جميع تقييماتك (${count} تقييم) وتحليل أداء محفظتك. هل تود الاطلاع عليه؟`,
            includeOffer: false,
          });
        }
      }
    }

    // 4. New service announcement
    if (currentMonth === 3 || currentMonth === 9) {
      activeOccasions.push({
        type: "service_update",
        message: "🆕 أطلقنا خدمة التقييم المكتبي السريع — نتائج خلال 48 ساعة! مثالية للأصول المتشابهة والأساطيل. استفسر عن التفاصيل.",
        includeOffer: false,
      });
    }

    let section = "";
    if (activeOccasions.length > 0) {
      section = "\n\n## رسائل المناسبات والعلاقات (المستوى 64)\n";
      section += `- مناسبات نشطة: ${activeOccasions.length}${satisfactionPending ? " | تقييم رضا معلّق" : ""}${annualSummaryAvailable ? " | التقرير السنوي متاح" : ""}\n`;
      for (const o of activeOccasions) {
        section += `🎉 ${o.message}${o.offerCode ? ` [كود: ${o.offerCode} — خصم ${o.offerDiscount}%]` : ""}\n`;
      }
      section += "\nادمج هذه الرسائل بطبيعية في بداية المحادثة أو نهايتها حسب السياق. هنّئ العميل بالمناسبة ثم أجب على سؤاله.\n";
    }

    return { section, activeOccasions, satisfactionPending, annualSummaryAvailable };
  } catch (e) {
    console.error("Occasion messages error:", e);
    return empty;
  }
}
