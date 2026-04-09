import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Finding {
  pillar: string;
  severity: string;
  title_ar: string;
  description_ar: string;
  fix_suggestion_ar: string;
  difficulty: string;
  file_path?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(supabaseUrl, serviceKey);
    const { action = "full_scan" } = await req.json().catch(() => ({}));
    const startTime = Date.now();
    const scanId = crypto.randomUUID();
    const findings: Finding[] = [];

    // ═══════════════════════════════════════
    // PILLAR 1: Architecture Health
    // ═══════════════════════════════════════
    if (action === "full_scan" || action === "architecture") {
      // Check for orphaned records (requests without assignments)
      const { count: orphanedRequests } = await sb
        .from("valuation_requests")
        .select("*", { count: "exact", head: true })
        .is("assignment_id", null)
        .neq("status", "draft");

      if (orphanedRequests && orphanedRequests > 0) {
        findings.push({
          pillar: "architecture",
          severity: "warning",
          title_ar: "طلبات بدون ملفات مرتبطة",
          description_ar: `يوجد ${orphanedRequests} طلب(ات) بحالة غير مسودة بدون ملف تقييم مرتبط. هذا يعني وجود خلل في مسار الإنشاء التلقائي.`,
          fix_suggestion_ar: "تحقق من تريجر auto_create_assignment_on_request وتأكد من عمله بشكل صحيح. يمكن إنشاء ملفات يدوياً للطلبات المعلقة.",
          difficulty: "medium",
          metadata: { count: orphanedRequests },
        });
      }

      // Check for assignments without clients
      const { count: noClientAssignments } = await sb
        .from("valuation_assignments")
        .select("*", { count: "exact", head: true })
        .is("client_id", null)
        .not("status", "in", '("cancelled","draft")');

      if (noClientAssignments && noClientAssignments > 0) {
        findings.push({
          pillar: "architecture",
          severity: "critical",
          title_ar: "ملفات تقييم بدون عميل",
          description_ar: `يوجد ${noClientAssignments} ملف تقييم نشط بدون عميل مرتبط. هذا خلل بنيوي يؤثر على سلامة البيانات.`,
          fix_suggestion_ar: "يجب ربط كل ملف بعميل. راجع الملفات المتأثرة واربطها بالعميل الصحيح من قاعدة البيانات.",
          difficulty: "easy",
          metadata: { count: noClientAssignments },
        });
      }

      // Check for duplicate clients
      const { data: orgData } = await sb.from("organizations").select("id").limit(1).single();
      if (orgData) {
        const { data: duplicates } = await sb.rpc("find_duplicate_clients", { _org_id: orgData.id });
        if (duplicates && duplicates.length > 0) {
          findings.push({
            pillar: "architecture",
            severity: "warning",
            title_ar: "عملاء مكررون في النظام",
            description_ar: `تم اكتشاف ${duplicates.length} حالة تكرار في سجلات العملاء (تطابق في الهاتف/البريد/السجل التجاري).`,
            fix_suggestion_ar: "استخدم أداة دمج العملاء لتوحيد السجلات المكررة والحفاظ على نظافة البيانات.",
            difficulty: "easy",
            metadata: { duplicates_count: duplicates.length },
          });
        }
      }

      // Check profiles without organization
      const { count: noOrgProfiles } = await sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .is("organization_id", null);

      if (noOrgProfiles && noOrgProfiles > 0) {
        findings.push({
          pillar: "architecture",
          severity: "warning",
          title_ar: "ملفات شخصية بدون منظمة",
          description_ar: `يوجد ${noOrgProfiles} مستخدم بدون ربط بمنظمة. قد يواجهون مشاكل في الوصول للبيانات.`,
          fix_suggestion_ar: "اربط هؤلاء المستخدمين بالمنظمة الافتراضية أو تواصل معهم لتحديد انتمائهم.",
          difficulty: "easy",
          metadata: { count: noOrgProfiles },
        });
      }
    }

    // ═══════════════════════════════════════
    // PILLAR 2: Workflow Integrity
    // ═══════════════════════════════════════
    if (action === "full_scan" || action === "workflow") {
      // Stalled assignments (>48h in same status)
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: stalledAssignments } = await sb
        .from("valuation_assignments")
        .select("id, status, updated_at, reference_number")
        .lt("updated_at", twoDaysAgo)
        .not("status", "in", '("issued","archived","cancelled","draft")');

      if (stalledAssignments && stalledAssignments.length > 0) {
        const byStat: Record<string, number> = {};
        stalledAssignments.forEach((a) => { byStat[a.status] = (byStat[a.status] || 0) + 1; });
        findings.push({
          pillar: "workflow",
          severity: stalledAssignments.length > 5 ? "critical" : "warning",
          title_ar: "ملفات متعثرة (أكثر من 48 ساعة)",
          description_ar: `يوجد ${stalledAssignments.length} ملف تقييم متعثر لم يتحرك منذ أكثر من 48 ساعة. التوزيع: ${Object.entries(byStat).map(([k, v]) => `${k}: ${v}`).join("، ")}`,
          fix_suggestion_ar: "راجع كل ملف متعثر وحدد سبب التوقف. الأسباب الشائعة: انتظار دفع، عدم إسناد معاين، نقص مستندات.",
          difficulty: "medium",
          metadata: { count: stalledAssignments.length, by_status: byStat, refs: stalledAssignments.slice(0, 5).map(a => a.reference_number) },
        });
      }

      // Inconsistency: paid invoices without status advancement
      const { data: paidNotAdvanced } = await sb
        .from("valuation_assignments")
        .select("id, status, reference_number")
        .in("status", ["scope_approved"]);

      if (paidNotAdvanced && paidNotAdvanced.length > 0) {
        // Check if any have paid payments
        for (const a of paidNotAdvanced.slice(0, 10)) {
          const { data: req } = await sb.from("valuation_requests").select("id").eq("assignment_id", a.id).limit(1).single();
          if (req) {
            const { count: paidPayments } = await sb
              .from("payments")
              .select("*", { count: "exact", head: true })
              .eq("request_id", req.id)
              .eq("payment_status", "paid");
            if (paidPayments && paidPayments > 0) {
              findings.push({
                pillar: "workflow",
                severity: "critical",
                title_ar: `تناقض: ملف ${a.reference_number} مدفوع لكن الحالة لم تتقدم`,
                description_ar: `الملف ${a.reference_number} في حالة "نطاق معتمد" رغم وجود دفعة مؤكدة. يجب أن يكون في مرحلة ما بعد الدفع.`,
                fix_suggestion_ar: "استخدم وظيفة update_request_status لتقدم الحالة يدوياً إلى first_payment_confirmed.",
                difficulty: "easy",
                metadata: { assignment_id: a.id, ref: a.reference_number },
              });
            }
          }
        }
      }

      // Inspections assigned but never started
      const { data: pendingInspections } = await sb
        .from("inspections")
        .select("id, assignment_id, inspection_date, inspector_id")
        .eq("status", "pending")
        .lt("inspection_date", new Date().toISOString().split("T")[0]);

      if (pendingInspections && pendingInspections.length > 0) {
        findings.push({
          pillar: "workflow",
          severity: "warning",
          title_ar: "معاينات متأخرة عن موعدها",
          description_ar: `يوجد ${pendingInspections.length} معاينة تجاوزت تاريخها المحدد ولم تبدأ بعد.`,
          fix_suggestion_ar: "تواصل مع المعاينين المسندة لهم هذه المهام أو أعد إسنادها لمعاينين آخرين.",
          difficulty: "easy",
          metadata: { count: pendingInspections.length },
        });
      }
    }

    // ═══════════════════════════════════════
    // PILLAR 3: Performance & Stability
    // ═══════════════════════════════════════
    if (action === "full_scan" || action === "performance") {
      // Check table sizes - large tables that might need attention
      const tables = ["valuation_assignments", "audit_logs", "valuation_requests", "notifications", "raqeem_tech_findings"];
      for (const table of tables) {
        const { count } = await sb.from(table).select("*", { count: "exact", head: true }).catch(() => ({ count: 0 }));
        if (count && count > 5000) {
          findings.push({
            pillar: "performance",
            severity: count > 50000 ? "critical" : "warning",
            title_ar: `جدول ${table} يحتوي على ${count.toLocaleString()} سجل`,
            description_ar: `الجدول كبير الحجم وقد يؤثر على الأداء. فكّر في أرشفة البيانات القديمة أو إضافة فهارس إضافية.`,
            fix_suggestion_ar: count > 50000 
              ? "أنشئ استراتيجية أرشفة تلقائية للبيانات التي تجاوزت سنة. أضف فهارس على الأعمدة الأكثر استخداماً."
              : "راقب النمو. أضف فهارس على الأعمدة المستخدمة في البحث والفرز.",
            difficulty: count > 50000 ? "hard" : "medium",
            metadata: { table, row_count: count },
          });
        }
      }

      // Storage usage check
      const buckets = ["attachments", "reports", "inspection-photos", "client-uploads", "archived-reports"];
      for (const bucket of buckets) {
        const { data: files } = await sb.storage.from(bucket).list("", { limit: 1000 });
        if (files && files.length > 500) {
          findings.push({
            pillar: "performance",
            severity: "info",
            title_ar: `مخزن ${bucket} يحتوي على عدد كبير من الملفات`,
            description_ar: `يحتوي المخزن على ${files.length}+ ملف. قد يحتاج لتنظيم أفضل أو أرشفة.`,
            fix_suggestion_ar: "نظّم الملفات في مجلدات فرعية حسب السنة/الشهر. احذف الملفات المؤقتة القديمة.",
            difficulty: "easy",
            metadata: { bucket, file_count: files.length },
          });
        }
      }
    }

    // ═══════════════════════════════════════
    // PILLAR 4: Deep Security
    // ═══════════════════════════════════════
    if (action === "full_scan" || action === "security") {
      // Check for failed login attempts
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: failedLogins } = await sb
        .from("login_attempts")
        .select("email, ip_address")
        .eq("success", false)
        .gte("created_at", oneHourAgo);

      if (failedLogins && failedLogins.length > 10) {
        const byEmail: Record<string, number> = {};
        failedLogins.forEach((l) => { byEmail[l.email] = (byEmail[l.email] || 0) + 1; });
        const suspicious = Object.entries(byEmail).filter(([, c]) => c >= 3);
        if (suspicious.length > 0) {
          findings.push({
            pillar: "security",
            severity: "critical",
            title_ar: "محاولات اختراق محتملة",
            description_ar: `تم رصد ${failedLogins.length} محاولة دخول فاشلة خلال الساعة الأخيرة. حسابات مشبوهة: ${suspicious.map(([e, c]) => `${e} (${c} محاولات)`).join("، ")}`,
            fix_suggestion_ar: "فعّل حظر الحسابات المؤقت بعد 5 محاولات فاشلة. راجع عناوين IP المشبوهة وحدد إن كانت هجمات منظمة.",
            difficulty: "medium",
            metadata: { total_failures: failedLogins.length, suspicious_accounts: suspicious },
          });
        }
      }

      // Check active sessions anomalies
      const { data: activeSessions } = await sb
        .from("active_sessions")
        .select("user_id, device_info");

      if (activeSessions) {
        const sessionsByUser: Record<string, number> = {};
        activeSessions.forEach((s) => { sessionsByUser[s.user_id] = (sessionsByUser[s.user_id] || 0) + 1; });
        const multiSession = Object.entries(sessionsByUser).filter(([, c]) => c > 3);
        if (multiSession.length > 0) {
          findings.push({
            pillar: "security",
            severity: "warning",
            title_ar: "جلسات متعددة مشبوهة",
            description_ar: `يوجد ${multiSession.length} مستخدم لديه أكثر من 3 جلسات نشطة متزامنة. قد يشير لمشاركة كلمات المرور أو اختراق.`,
            fix_suggestion_ar: "راجع الجلسات النشطة وأغلق الجلسات القديمة. فعّل تنبيه الجلسات المتعددة للمستخدمين.",
            difficulty: "easy",
            metadata: { users_with_multi_sessions: multiSession.length },
          });
        }
      }

      // Check security alerts
      const { data: recentAlerts } = await sb
        .from("security_alerts")
        .select("*")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(10);

      if (recentAlerts && recentAlerts.length > 0) {
        findings.push({
          pillar: "security",
          severity: recentAlerts.some((a: any) => a.severity === "high" || a.severity === "critical") ? "critical" : "warning",
          title_ar: "تنبيهات أمنية غير معالجة",
          description_ar: `يوجد ${recentAlerts.length} تنبيه أمني بحالة "جديد" لم تتم معالجته.`,
          fix_suggestion_ar: "راجع كل تنبيه واتخذ الإجراء المناسب: تحقيق، حظر، أو إغلاق.",
          difficulty: "easy",
          metadata: { count: recentAlerts.length },
        });
      }
    }

    // ═══════════════════════════════════════
    // PILLAR 5: Smart Proactive Report
    // ═══════════════════════════════════════
    // Calculate health scores per pillar
    const pillarScores: Record<string, number> = { architecture: 100, workflow: 100, performance: 100, security: 100, reporting: 100 };
    const pillarFindings: Record<string, Finding[]> = {};

    for (const f of findings) {
      if (!pillarFindings[f.pillar]) pillarFindings[f.pillar] = [];
      pillarFindings[f.pillar].push(f);
      
      const penalty = f.severity === "critical" ? 20 : f.severity === "warning" ? 10 : 3;
      pillarScores[f.pillar] = Math.max(0, pillarScores[f.pillar] - penalty);
    }

    const overallScore = Object.values(pillarScores).reduce((a, b) => a + b, 0) / Object.keys(pillarScores).length;

    // Generate summary
    const criticalCount = findings.filter(f => f.severity === "critical").length;
    const warningCount = findings.filter(f => f.severity === "warning").length;
    const infoCount = findings.filter(f => f.severity === "info").length;

    let summaryAr = `فحص شامل | النتيجة: ${overallScore.toFixed(0)}% | `;
    if (criticalCount > 0) summaryAr += `🔴 ${criticalCount} حرج | `;
    if (warningCount > 0) summaryAr += `🟠 ${warningCount} تحذير | `;
    if (infoCount > 0) summaryAr += `🔵 ${infoCount} معلومة | `;
    if (findings.length === 0) summaryAr += "✅ لا توجد مشاكل مكتشفة";

    // Store findings
    if (findings.length > 0) {
      const findingsToInsert = findings.map(f => ({
        ...f,
        scan_batch_id: scanId,
        status: "open",
      }));
      await sb.from("raqeem_expert_findings").insert(findingsToInsert);
    }

    // Store scan record
    const scanRecord = {
      id: scanId,
      scan_type: action,
      total_findings: findings.length,
      critical_count: criticalCount,
      warning_count: warningCount,
      info_count: infoCount,
      healthy_count: findings.filter(f => f.severity === "healthy").length,
      health_score: overallScore,
      duration_ms: Date.now() - startTime,
      triggered_by: "manual",
      summary_ar: summaryAr,
      pillar_scores: pillarScores,
    };

    await sb.from("raqeem_expert_scans").insert(scanRecord);

    return new Response(JSON.stringify({
      success: true,
      scan_id: scanId,
      health_score: overallScore,
      pillar_scores: pillarScores,
      summary: summaryAr,
      findings_count: { total: findings.length, critical: criticalCount, warning: warningCount, info: infoCount },
      findings,
      duration_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
