/**
 * Level 61: Seasonal & Strategic Reminders Engine
 * Auto-generates revaluation reminders based on fiscal calendars, report expiry, and market events
 */

interface SeasonalReminder {
  type: string;
  urgency: "low" | "medium" | "high" | "critical";
  message: string;
  actionUrl?: string;
  daysUntilDeadline?: number;
}

interface SeasonalResult {
  section: string;
  reminders: SeasonalReminder[];
  upcomingDeadlines: number;
  revaluationsDue: number;
}

export async function analyzeSeasonalReminders(
  db: any,
  assignmentId: string | undefined,
  clientUserId: string | undefined
): Promise<SeasonalResult> {
  const empty: SeasonalResult = { section: "", reminders: [], upcomingDeadlines: 0, revaluationsDue: 0 };
  if (!clientUserId) return empty;

  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const reminders: SeasonalReminder[] = [];

    // 1. Report expiry reminders (12-month validity)
    const { data: issuedReports } = await db
      .from("valuation_assignments")
      .select("id, reference_number, property_type, final_value_sar, created_at, client_id")
      .eq("status", "issued")
      .not("final_value_sar", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (issuedReports?.length) {
      // Get client_ids linked to this user
      const { data: clientLinks } = await db
        .from("clients")
        .select("id")
        .eq("portal_user_id", clientUserId);

      const clientIds = clientLinks?.map((c: any) => c.id) || [];

      for (const report of issuedReports) {
        if (!clientIds.includes(report.client_id)) continue;

        const issueDate = new Date(report.created_at);
        const expiryDate = new Date(issueDate.getTime() + 365 * 86400000);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000);

        if (daysUntilExpiry <= 0) {
          reminders.push({
            type: "report_expired",
            urgency: "critical",
            message: `تقرير ${report.reference_number} منتهي الصلاحية. القيمة السابقة: ${report.final_value_sar?.toLocaleString()} ر.س. نوصي بإعادة التقييم للحفاظ على دقة السجلات.`,
            daysUntilDeadline: daysUntilExpiry,
          });
        } else if (daysUntilExpiry <= 45) {
          reminders.push({
            type: "report_expiring_soon",
            urgency: daysUntilExpiry <= 15 ? "high" : "medium",
            message: `تقرير ${report.reference_number} ينتهي خلال ${daysUntilExpiry} يوم. احجز إعادة التقييم الآن واستفد من خصم التجديد المبكر.`,
            daysUntilDeadline: daysUntilExpiry,
          });
        }
      }
    }

    // 2. Annual budget season reminder (Oct-Nov for Saudi fiscal year)
    if (currentMonth === 10 || currentMonth === 11) {
      reminders.push({
        type: "budget_season",
        urgency: "high",
        message: "📅 موسم إعداد الميزانية السنوية! تأكد من تحديث تقييمات أصولك قبل إقفال السنة المالية. نقدم خصم 15% على حزم إعادة التقييم الشاملة.",
      });
    }

    // 3. Financial year-end for listed companies (Dec-Jan)
    if (currentMonth === 12 || currentMonth === 1) {
      reminders.push({
        type: "fiscal_year_end",
        urgency: "high",
        message: "📊 نهاية السنة المالية تقترب. الشركات المدرجة ملزمة بتحديث تقييمات الأصول وفق معايير IFRS. تواصل معنا لجدولة إعادة التقييم.",
      });
    }

    // 4. Insurance renewal reminder (varies, check quarterly)
    if (currentMonth % 3 === 0) {
      reminders.push({
        type: "insurance_review",
        urgency: "medium",
        message: "🛡️ هل اقترب موعد تجديد التأمين على أصولك؟ تقييم محدث يضمن تغطية تأمينية دقيقة ويحميك من فجوة التعويض.",
      });
    }

    // 5. Mid-year portfolio health check (June-July)
    if (currentMonth === 6 || currentMonth === 7) {
      reminders.push({
        type: "midyear_review",
        urgency: "low",
        message: "📈 منتصف العام — وقت مثالي لمراجعة أداء محفظتك العقارية والصناعية. اطلب تقرير صحة المحفظة المجاني.",
      });
    }

    const revaluationsDue = reminders.filter(r => 
      r.type === "report_expired" || r.type === "report_expiring_soon"
    ).length;

    let section = "";
    if (reminders.length > 0) {
      section = "\n\n## التذكيرات الموسمية الذكية (المستوى 61)\n";
      section += `- تذكيرات نشطة: ${reminders.length} | تقييمات تحتاج تجديد: ${revaluationsDue}\n`;
      for (const r of reminders) {
        const urgencyLabel = { low: "منخفض", medium: "متوسط", high: "مرتفع", critical: "حرج" }[r.urgency];
        section += `📌 [${urgencyLabel}] ${r.message}\n`;
      }
      section += "\nاستخدم هذه التذكيرات لتقديم اقتراحات استباقية ومخصصة للعميل عند المناسبة. لا تذكرها جميعاً دفعة واحدة.\n";
    }

    return { section, reminders, upcomingDeadlines: reminders.length, revaluationsDue };
  } catch (e) {
    console.error("Seasonal reminders error:", e);
    return empty;
  }
}
