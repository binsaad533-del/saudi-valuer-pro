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

// ─── Helper: run SQL safely ───
async function runSQL(sb: any, sql: string): Promise<any[]> {
  try {
    const { data, error } = await sb.rpc("exec_readonly_sql", { query: sql });
    if (error) return [];
    return data || [];
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(supabaseUrl, serviceKey);
    const { action = "full_scan" } = await req.json().catch(() => ({}));
    const startTime = Date.now();
    const scanId = crypto.randomUUID();
    const findings: Finding[] = [];

    // ═══════════════════════════════════════════════════════
    // PILLAR 1: ARCHITECTURE HEALTH (البنية والتصميم)
    // ═══════════════════════════════════════════════════════
    if (action === "full_scan" || action === "architecture") {
      // 1.1 Orphaned requests (no assignment)
      const { count: orphanedRequests } = await sb
        .from("valuation_requests")
        .select("*", { count: "exact", head: true })
        .is("assignment_id", null)
        .neq("status", "draft");

      if (orphanedRequests && orphanedRequests > 0) {
        findings.push({
          pillar: "architecture",
          severity: "warning",
          title_ar: "طلبات بدون ملفات تقييم مرتبطة",
          description_ar: `يوجد ${orphanedRequests} طلب بحالة غير مسودة بدون ملف تقييم. خلل في trigger الإنشاء التلقائي.`,
          fix_suggestion_ar: "تحقق من trigger auto_create_assignment_on_request. أنشئ ملفات يدوياً للطلبات المعلقة.",
          difficulty: "medium",
          metadata: { count: orphanedRequests },
        });
      }

      // 1.2 Assignments without clients
      const { count: noClientAssignments } = await sb
        .from("valuation_assignments")
        .select("*", { count: "exact", head: true })
        .is("client_id", null)
        .not("status", "in", '("cancelled","draft")');

      if (noClientAssignments && noClientAssignments > 0) {
        findings.push({
          pillar: "architecture",
          severity: "critical",
          title_ar: "ملفات تقييم نشطة بدون عميل",
          description_ar: `يوجد ${noClientAssignments} ملف تقييم نشط بدون عميل مرتبط — خلل بنيوي.`,
          fix_suggestion_ar: "اربط كل ملف بعميل صحيح من قاعدة البيانات.",
          difficulty: "easy",
          metadata: { count: noClientAssignments },
        });
      }

      // 1.3 Duplicate clients
      const { data: orgData } = await sb.from("organizations").select("id").limit(1).single();
      if (orgData) {
        const { data: duplicates } = await sb.rpc("find_duplicate_clients", { _org_id: orgData.id });
        if (duplicates && duplicates.length > 0) {
          findings.push({
            pillar: "architecture",
            severity: "warning",
            title_ar: "عملاء مكررون في النظام",
            description_ar: `تم اكتشاف ${duplicates.length} حالة تكرار (تطابق هاتف/بريد/سجل تجاري).`,
            fix_suggestion_ar: "استخدم أداة دمج العملاء لتوحيد السجلات المكررة.",
            difficulty: "easy",
            metadata: { duplicates_count: duplicates.length },
          });
        }
      }

      // 1.4 Profiles without organization
      const { count: noOrgProfiles } = await sb
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .is("organization_id", null);

      if (noOrgProfiles && noOrgProfiles > 0) {
        findings.push({
          pillar: "architecture",
          severity: "warning",
          title_ar: "مستخدمون بدون منظمة",
          description_ar: `يوجد ${noOrgProfiles} مستخدم بدون ربط بمنظمة — قد يفقدون الوصول.`,
          fix_suggestion_ar: "اربط المستخدمين بالمنظمة الافتراضية.",
          difficulty: "easy",
          metadata: { count: noOrgProfiles },
        });
      }

      // 1.5 Requests with mismatched assignment status
      const { data: mismatchedData } = await sb
        .from("valuation_requests")
        .select("id, status, assignment_id")
        .not("assignment_id", "is", null)
        .in("status", ["submitted", "draft"]);

      if (mismatchedData) {
        for (const req of mismatchedData.slice(0, 5)) {
          const { data: asgn } = await sb
            .from("valuation_assignments")
            .select("status")
            .eq("id", req.assignment_id)
            .single();
          if (asgn && asgn.status !== req.status && asgn.status !== "submitted" && asgn.status !== "draft") {
            findings.push({
              pillar: "architecture",
              severity: "warning",
              title_ar: "تناقض حالة بين الطلب وملف التقييم",
              description_ar: `الطلب ${req.id.slice(0,8)} في حالة "${req.status}" بينما ملف التقييم في حالة "${asgn.status}".`,
              fix_suggestion_ar: "تحقق من sync_assignment_status_to_request trigger.",
              difficulty: "medium",
              metadata: { request_id: req.id, req_status: req.status, assignment_status: asgn.status },
            });
          }
        }
      }

      // 1.6 Invoices without linked payments
      const { data: orphanedInvoices } = await sb
        .from("invoices")
        .select("id, invoice_number, total_amount")
        .is("payment_id", null)
        .eq("status", "sent")
        .limit(20);

      if (orphanedInvoices && orphanedInvoices.length > 3) {
        findings.push({
          pillar: "architecture",
          severity: "info",
          title_ar: `${orphanedInvoices.length} فاتورة مرسلة بدون ربط بدفعة`,
          description_ar: "فواتير مرسلة لم يتم ربطها بسجل دفع — قد تكون قديمة أو بحاجة لمتابعة.",
          fix_suggestion_ar: "راجع الفواتير المعلقة وأغلق القديمة أو اربطها بسجلات الدفع.",
          difficulty: "easy",
          metadata: { count: orphanedInvoices.length },
        });
      }
    }

    // ═══════════════════════════════════════════════════════
    // PILLAR 2: WORKFLOW INTEGRITY (سلامة سير العمل)
    // ═══════════════════════════════════════════════════════
    if (action === "full_scan" || action === "workflow") {
      // 2.1 Stalled assignments (>48h)
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: stalledAssignments } = await sb
        .from("valuation_assignments")
        .select("id, status, updated_at, reference_number")
        .lt("updated_at", twoDaysAgo)
        .not("status", "in", '("issued","archived","cancelled","draft")');

      if (stalledAssignments && stalledAssignments.length > 0) {
        const byStat: Record<string, number> = {};
        stalledAssignments.forEach((a: any) => { byStat[a.status] = (byStat[a.status] || 0) + 1; });
        findings.push({
          pillar: "workflow",
          severity: stalledAssignments.length > 5 ? "critical" : "warning",
          title_ar: `${stalledAssignments.length} ملف متعثر (أكثر من 48 ساعة)`,
          description_ar: `التوزيع: ${Object.entries(byStat).map(([k, v]) => `${k}: ${v}`).join("، ")}`,
          fix_suggestion_ar: "راجع كل ملف وحدد سبب التوقف: انتظار دفع، نقص مستندات، عدم إسناد.",
          difficulty: "medium",
          metadata: { count: stalledAssignments.length, by_status: byStat },
        });
      }

      // 2.2 Payment/status inconsistency
      const { data: paidNotAdvanced } = await sb
        .from("valuation_assignments")
        .select("id, status, reference_number")
        .in("status", ["scope_approved"]);

      if (paidNotAdvanced && paidNotAdvanced.length > 0) {
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
                description_ar: `الملف في "نطاق معتمد" رغم وجود دفعة مؤكدة.`,
                fix_suggestion_ar: "استخدم update_request_status لتقدم الحالة إلى first_payment_confirmed.",
                difficulty: "easy",
                metadata: { assignment_id: a.id, ref: a.reference_number },
              });
            }
          }
        }
      }

      // 2.3 Overdue inspections
      const { data: pendingInspections } = await sb
        .from("inspections")
        .select("id, assignment_id, inspection_date, inspector_id")
        .eq("status", "pending")
        .lt("inspection_date", new Date().toISOString().split("T")[0]);

      if (pendingInspections && pendingInspections.length > 0) {
        findings.push({
          pillar: "workflow",
          severity: "warning",
          title_ar: `${pendingInspections.length} معاينة متأخرة عن موعدها`,
          description_ar: "معاينات تجاوزت التاريخ المحدد ولم تبدأ بعد.",
          fix_suggestion_ar: "تواصل مع المعاينين أو أعد الإسناد.",
          difficulty: "easy",
          metadata: { count: pendingInspections.length },
        });
      }

      // 2.4 Assignments in inspection_pending without inspector
      const { data: noInspector } = await sb
        .from("valuation_assignments")
        .select("id, reference_number")
        .eq("status", "inspection_pending")
        .is("inspector_id", null);

      if (noInspector && noInspector.length > 0) {
        findings.push({
          pillar: "workflow",
          severity: "critical",
          title_ar: `${noInspector.length} ملف في انتظار المعاينة بدون معاين مُسند`,
          description_ar: "ملفات وصلت لمرحلة المعاينة لكن لم يُسند إليها معاين — مسار مسدود.",
          fix_suggestion_ar: "أسند معاين لكل ملف من صفحة إدارة المعاينات.",
          difficulty: "easy",
          metadata: { refs: noInspector.slice(0, 5).map((n: any) => n.reference_number) },
        });
      }

      // 2.5 Notifications not delivered
      const { count: failedNotifs } = await sb
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("delivery_status", "failed");

      if (failedNotifs && failedNotifs > 0) {
        findings.push({
          pillar: "workflow",
          severity: "warning",
          title_ar: `${failedNotifs} إشعار فاشل التسليم`,
          description_ar: "إشعارات لم تصل للمستخدمين — قد يفوتهم إجراءات مهمة.",
          fix_suggestion_ar: "تحقق من نظام الإشعارات وأعد إرسال الفاشلة.",
          difficulty: "medium",
          metadata: { count: failedNotifs },
        });
      }
    }

    // ═══════════════════════════════════════════════════════
    // PILLAR 3: PERFORMANCE & STABILITY (الأداء والاستقرار)
    // ═══════════════════════════════════════════════════════
    if (action === "full_scan" || action === "performance") {
      // 3.1 Large tables
      const tables = [
        "valuation_assignments", "audit_logs", "valuation_requests",
        "notifications", "request_audit_log", "inspection_photos",
        "attachments", "raqeem_expert_findings"
      ];
      for (const table of tables) {
        try {
          const { count } = await sb.from(table).select("*", { count: "exact", head: true });
          if (count && count > 5000) {
            findings.push({
              pillar: "performance",
              severity: count > 50000 ? "critical" : "warning",
              title_ar: `جدول ${table}: ${count.toLocaleString()} سجل`,
              description_ar: count > 50000
                ? "حجم كبير جداً — يؤثر مباشرة على سرعة الاستعلامات."
                : "حجم متوسط — يُنصح بالمراقبة وإضافة فهارس.",
              fix_suggestion_ar: count > 50000
                ? "أنشئ استراتيجية أرشفة تلقائية. أضف فهارس مركبة على الأعمدة الأكثر استخداماً."
                : "أضف فهارس على أعمدة البحث والفرز المتكررة.",
              difficulty: count > 50000 ? "hard" : "medium",
              metadata: { table, row_count: count },
            });
          }
        } catch { /* table might not exist */ }
      }

      // 3.2 Storage usage
      const buckets = ["attachments", "reports", "inspection-photos", "client-uploads", "archived-reports"];
      for (const bucket of buckets) {
        try {
          const { data: files } = await sb.storage.from(bucket).list("", { limit: 1000 });
          if (files && files.length > 500) {
            findings.push({
              pillar: "performance",
              severity: "info",
              title_ar: `مخزن ${bucket}: ${files.length}+ ملف`,
              description_ar: "عدد كبير من الملفات — يحتاج تنظيم.",
              fix_suggestion_ar: "نظّم الملفات في مجلدات فرعية حسب السنة/الشهر.",
              difficulty: "easy",
              metadata: { bucket, file_count: files.length },
            });
          }
        } catch { /* bucket might not exist */ }
      }

      // 3.3 Old unread notifications
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: oldUnread } = await sb
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false)
        .lt("created_at", thirtyDaysAgo);

      if (oldUnread && oldUnread > 100) {
        findings.push({
          pillar: "performance",
          severity: "info",
          title_ar: `${oldUnread} إشعار غير مقروء أقدم من 30 يوم`,
          description_ar: "إشعارات قديمة تتراكم وتثقل الاستعلامات.",
          fix_suggestion_ar: "أرشف الإشعارات القديمة (>30 يوم) تلقائياً أو ضع علامة مقروء عليها.",
          difficulty: "easy",
          metadata: { count: oldUnread },
        });
      }

      // 3.4 Old audit logs accumulation
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const { count: oldAuditLogs } = await sb
        .from("audit_logs")
        .select("*", { count: "exact", head: true })
        .lt("created_at", sixMonthsAgo);

      if (oldAuditLogs && oldAuditLogs > 10000) {
        findings.push({
          pillar: "performance",
          severity: "warning",
          title_ar: `${oldAuditLogs.toLocaleString()} سجل تدقيق أقدم من 6 أشهر`,
          description_ar: "تراكم كبير في سجلات التدقيق يبطئ الاستعلامات.",
          fix_suggestion_ar: "أنشئ جدول أرشيف لسجلات التدقيق القديمة مع الاحتفاظ بالبيانات.",
          difficulty: "medium",
          metadata: { count: oldAuditLogs },
        });
      }
    }

    // ═══════════════════════════════════════════════════════
    // PILLAR 4: DEEP SECURITY (الأمان العميق)
    // ═══════════════════════════════════════════════════════
    if (action === "full_scan" || action === "security") {
      // 4.1 Failed login attempts (brute force)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: failedLogins } = await sb
        .from("login_attempts")
        .select("email, ip_address")
        .eq("success", false)
        .gte("created_at", oneHourAgo);

      if (failedLogins && failedLogins.length > 10) {
        const byEmail: Record<string, number> = {};
        failedLogins.forEach((l: any) => { byEmail[l.email] = (byEmail[l.email] || 0) + 1; });
        const suspicious = Object.entries(byEmail).filter(([, c]) => c >= 3);
        if (suspicious.length > 0) {
          findings.push({
            pillar: "security",
            severity: "critical",
            title_ar: "محاولات اختراق محتملة",
            description_ar: `${failedLogins.length} محاولة فاشلة خلال ساعة. حسابات مشبوهة: ${suspicious.map(([e, c]) => `${e} (${c})`).join("، ")}`,
            fix_suggestion_ar: "فعّل حظر مؤقت بعد 5 محاولات. راجع عناوين IP المشبوهة.",
            difficulty: "medium",
            metadata: { total: failedLogins.length, suspicious },
          });
        }
      }

      // 4.2 Multi-session anomalies
      const { data: activeSessions } = await sb
        .from("active_sessions")
        .select("user_id, device_info");

      if (activeSessions) {
        const sessionsByUser: Record<string, number> = {};
        activeSessions.forEach((s: any) => { sessionsByUser[s.user_id] = (sessionsByUser[s.user_id] || 0) + 1; });
        const multiSession = Object.entries(sessionsByUser).filter(([, c]) => c > 3);
        if (multiSession.length > 0) {
          findings.push({
            pillar: "security",
            severity: "warning",
            title_ar: `${multiSession.length} مستخدم بجلسات متعددة مشبوهة`,
            description_ar: "أكثر من 3 جلسات نشطة متزامنة — قد يشير لمشاركة كلمات المرور.",
            fix_suggestion_ar: "أغلق الجلسات القديمة. فعّل تنبيه الجلسات المتعددة.",
            difficulty: "easy",
            metadata: { users: multiSession.length },
          });
        }
      }

      // 4.3 Unresolved security alerts
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
          title_ar: `${recentAlerts.length} تنبيه أمني غير معالج`,
          description_ar: "تنبيهات أمنية بحالة 'جديد' تحتاج مراجعة.",
          fix_suggestion_ar: "راجع كل تنبيه واتخذ الإجراء: تحقيق، حظر، أو إغلاق.",
          difficulty: "easy",
          metadata: { count: recentAlerts.length },
        });
      }

      // 4.4 Users without roles
      const { data: allProfiles } = await sb
        .from("profiles")
        .select("user_id")
        .limit(500);

      if (allProfiles) {
        let noRoleCount = 0;
        for (const p of allProfiles.slice(0, 50)) {
          const { count } = await sb
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("user_id", p.user_id);
          if (!count || count === 0) noRoleCount++;
        }
        if (noRoleCount > 0) {
          findings.push({
            pillar: "security",
            severity: "warning",
            title_ar: `${noRoleCount} مستخدم بدون دور محدد`,
            description_ar: "مستخدمون مسجلون بدون أدوار — قد يفقدون الوصول أو يحصلون على صلاحيات خاطئة.",
            fix_suggestion_ar: "أسند دور مناسب لكل مستخدم من صفحة إدارة المستخدمين.",
            difficulty: "easy",
            metadata: { count: noRoleCount },
          });
        }
      }

      // 4.5 Old sessions (>7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: oldSessions } = await sb
        .from("active_sessions")
        .select("*", { count: "exact", head: true })
        .lt("last_active_at", sevenDaysAgo);

      if (oldSessions && oldSessions > 0) {
        findings.push({
          pillar: "security",
          severity: "info",
          title_ar: `${oldSessions} جلسة خاملة (أكثر من 7 أيام)`,
          description_ar: "جلسات لم يتفاعل معها المستخدم منذ أسبوع — يُنصح بإنهائها.",
          fix_suggestion_ar: "أغلق الجلسات الخاملة تلقائياً بعد 7 أيام من عدم النشاط.",
          difficulty: "easy",
          metadata: { count: oldSessions },
        });
      }
    }

    // ═══════════════════════════════════════════════════════
    // PILLAR 5: CODE QUALITY & TYPE SAFETY (جودة الكود)
    // ═══════════════════════════════════════════════════════
    if (action === "full_scan" || action === "code_quality") {
      // 5.1 Check for compliance check failures
      const { count: failedChecks } = await sb
        .from("compliance_check_results")
        .select("*", { count: "exact", head: true })
        .eq("passed", false);

      if (failedChecks && failedChecks > 0) {
        findings.push({
          pillar: "code_quality",
          severity: failedChecks > 10 ? "critical" : "warning",
          title_ar: `${failedChecks} فحص امتثال فاشل`,
          description_ar: "فحوصات امتثال لم تجتز — قد تشير لمشاكل في منطق التحقق أو بيانات غير مكتملة.",
          fix_suggestion_ar: "راجع تفاصيل كل فحص فاشل وأصلح السبب الجذري.",
          difficulty: "medium",
          metadata: { count: failedChecks },
        });
      }

      // 5.2 Processing jobs stuck
      const { data: stuckJobs } = await sb
        .from("processing_jobs")
        .select("id, status, created_at")
        .in("status", ["processing", "pending"])
        .lt("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

      if (stuckJobs && stuckJobs.length > 0) {
        findings.push({
          pillar: "code_quality",
          severity: "critical",
          title_ar: `${stuckJobs.length} مهمة معالجة عالقة`,
          description_ar: "مهام معالجة (AI/OCR) عالقة منذ أكثر من ساعتين — خلل في Edge Function أو timeout.",
          fix_suggestion_ar: "تحقق من logs الـ Edge Functions. أعد تشغيل المهام العالقة أو ألغها.",
          difficulty: "medium",
          metadata: { count: stuckJobs.length, ids: stuckJobs.slice(0, 5).map((j: any) => j.id) },
        });
      }

      // 5.3 File classifications with errors
      const { count: classErrors } = await sb
        .from("file_classifications")
        .select("*", { count: "exact", head: true })
        .eq("processing_status", "error");

      if (classErrors && classErrors > 0) {
        findings.push({
          pillar: "code_quality",
          severity: classErrors > 5 ? "warning" : "info",
          title_ar: `${classErrors} ملف فشل في التصنيف`,
          description_ar: "ملفات رُفعت لكن فشل تصنيفها بالذكاء الاصطناعي.",
          fix_suggestion_ar: "تحقق من error_message لكل ملف. الأسباب الشائعة: حجم كبير، صيغة غير مدعومة، خطأ AI.",
          difficulty: "easy",
          metadata: { count: classErrors },
        });
      }

      // 5.4 Extracted assets with low confidence
      const { count: lowConfAssets } = await sb
        .from("extracted_assets")
        .select("*", { count: "exact", head: true })
        .lt("confidence", 0.5)
        .eq("review_status", "pending");

      if (lowConfAssets && lowConfAssets > 5) {
        findings.push({
          pillar: "code_quality",
          severity: "warning",
          title_ar: `${lowConfAssets} أصل مستخرج بثقة منخفضة (<50%)`,
          description_ar: "أصول استخرجها AI بثقة منخفضة — تحتاج مراجعة بشرية.",
          fix_suggestion_ar: "راجع هذه الأصول يدوياً وصحح البيانات المستخرجة.",
          difficulty: "medium",
          metadata: { count: lowConfAssets },
        });
      }

      // 5.5 Duplicate extracted assets
      const { count: duplicateAssets } = await sb
        .from("extracted_assets")
        .select("*", { count: "exact", head: true })
        .eq("duplicate_status", "duplicate");

      if (duplicateAssets && duplicateAssets > 0) {
        findings.push({
          pillar: "code_quality",
          severity: "info",
          title_ar: `${duplicateAssets} أصل مكرر مكتشف`,
          description_ar: "أصول تم تصنيفها كمكررة — تحتاج حل (دمج أو حذف).",
          fix_suggestion_ar: "استخدم أداة إدارة الأصول لمعالجة المكررات.",
          difficulty: "easy",
          metadata: { count: duplicateAssets },
        });
      }

      // 5.6 Email send failures
      const { count: emailErrors } = await sb
        .from("email_send_log")
        .select("*", { count: "exact", head: true })
        .eq("status", "error");

      if (emailErrors && emailErrors > 0) {
        findings.push({
          pillar: "code_quality",
          severity: emailErrors > 10 ? "warning" : "info",
          title_ar: `${emailErrors} بريد إلكتروني فشل في الإرسال`,
          description_ar: "رسائل بريد لم تُرسل بنجاح — قد يفوت العملاء إشعارات مهمة.",
          fix_suggestion_ar: "تحقق من إعدادات البريد وحدود الإرسال. راجع error_message لكل فشل.",
          difficulty: "medium",
          metadata: { count: emailErrors },
        });
      }
    }

    // ═══════════════════════════════════════════════════════
    // PILLAR 6: SMART PROACTIVE REPORT (التقرير الاستباقي)
    // ═══════════════════════════════════════════════════════
    const pillarScores: Record<string, number> = {
      architecture: 100, workflow: 100, performance: 100,
      security: 100, code_quality: 100, reporting: 100
    };

    for (const f of findings) {
      const penalty = f.severity === "critical" ? 20 : f.severity === "warning" ? 10 : 3;
      pillarScores[f.pillar] = Math.max(0, (pillarScores[f.pillar] || 100) - penalty);
    }

    const overallScore = Object.values(pillarScores).reduce((a, b) => a + b, 0) / Object.keys(pillarScores).length;

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
      await sb.from("raqeem_expert_findings").insert(
        findings.map(f => ({ ...f, scan_batch_id: scanId, status: "open" }))
      );
    }

    // Store scan record
    await sb.from("raqeem_expert_scans").insert({
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
    });

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
