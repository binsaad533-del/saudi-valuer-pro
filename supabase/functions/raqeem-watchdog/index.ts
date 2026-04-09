import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Finding {
  category: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  fingerprint: string;
  details?: Record<string, unknown>;
  related_entity_type?: string;
  related_entity_id?: string;
  related_user_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const scanId = crypto.randomUUID();
  const startTime = Date.now();
  const allFindings: Finding[] = [];
  const errors: string[] = [];

  try {
    const { action } = await req.json().catch(() => ({ action: "full_scan" }));

    if (action === "full_scan" || action === "scan") {
      // Record scan start
      await supabase.from("raqeem_watchdog_scans").insert({
        id: scanId, scan_type: "full",
        categories_scanned: ["technical","security","workflow","legal","financial","user_behavior","performance"],
      });

      // ============================================================
      // LAYER 1: TECHNICAL MONITORING
      // ============================================================
      try {
        // 1a. Check for stale health checks
        const { data: lastHealth } = await supabase
          .from("system_health_checks")
          .select("status, response_time_ms, checked_at")
          .order("checked_at", { ascending: false }).limit(1).maybeSingle();

        if (lastHealth) {
          if (lastHealth.status === "down") {
            allFindings.push({
              category: "technical", severity: "critical",
              title: "قاعدة البيانات غير متاحة",
              description: "آخر فحص صحة أظهر أن قاعدة البيانات غير متاحة",
              recommendation: "تحقق من حالة الخادم فوراً وأعد التشغيل إذا لزم الأمر",
              fingerprint: "tech_db_down",
              details: { last_check: lastHealth.checked_at },
            });
          } else if (lastHealth.response_time_ms > 2000) {
            allFindings.push({
              category: "technical", severity: "high",
              title: "بطء في استجابة قاعدة البيانات",
              description: `وقت الاستجابة: ${lastHealth.response_time_ms}ms — أعلى من الحد الطبيعي (2000ms)`,
              recommendation: "فحص الاستعلامات البطيئة وإضافة فهارس إذا لزم الأمر، أو ترقية حجم الخادم",
              fingerprint: "tech_db_slow",
              details: { response_time_ms: lastHealth.response_time_ms },
            });
          }
        }

        // 1b. Check for orphan requests (no assignment)
        const { count: orphanRequests } = await supabase
          .from("valuation_requests")
          .select("*", { count: "exact", head: true })
          .is("assignment_id", null)
          .eq("status", "submitted");

        if (orphanRequests && orphanRequests > 0) {
          allFindings.push({
            category: "technical", severity: "high",
            title: `${orphanRequests} طلب بدون ملف تقييم مرتبط`,
            description: "طلبات مقدمة لم يتم إنشاء ملف تقييم لها تلقائياً — خلل في trigger auto_create_assignment",
            recommendation: "فحص trigger auto_create_assignment_on_request والتأكد من عمله بشكل صحيح",
            fingerprint: `tech_orphan_requests_${orphanRequests}`,
            details: { count: orphanRequests },
          });
        }

        // 1c. Check storage usage
        const { count: totalAttachments } = await supabase
          .from("attachments")
          .select("*", { count: "exact", head: true });

        if (totalAttachments && totalAttachments > 5000) {
          allFindings.push({
            category: "technical", severity: "medium",
            title: "عدد المرفقات المخزنة مرتفع",
            description: `يوجد ${totalAttachments} مرفق في النظام — قد يؤثر على الأداء`,
            recommendation: "مراجعة سياسة الأرشفة وحذف المرفقات غير المستخدمة",
            fingerprint: "tech_high_attachments",
            details: { count: totalAttachments },
          });
        }
      } catch (e) { errors.push(`technical: ${e.message}`); }

      // ============================================================
      // LAYER 2: SECURITY MONITORING
      // ============================================================
      try {
        // 2a. Brute force detection (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: failedLogins } = await supabase
          .from("login_attempts")
          .select("email, ip_address")
          .eq("success", false)
          .gte("created_at", oneHourAgo);

        if (failedLogins && failedLogins.length > 0) {
          // Group by email
          const emailCounts: Record<string, number> = {};
          failedLogins.forEach(l => { emailCounts[l.email] = (emailCounts[l.email] || 0) + 1; });

          for (const [email, count] of Object.entries(emailCounts)) {
            if (count >= 3) {
              allFindings.push({
                category: "security", severity: count >= 10 ? "critical" : "high",
                title: `محاولات دخول فاشلة متكررة: ${email}`,
                description: `${count} محاولة فاشلة في الساعة الأخيرة — قد يكون هجوم brute force`,
                recommendation: "حظر عنوان IP مؤقتاً أو تفعيل المصادقة الثنائية",
                fingerprint: `sec_brute_force_${email.replace(/[^a-z0-9]/gi, '_')}`,
                details: { email, count, period: "1h" },
              });
            }
          }
        }

        // 2b. Multiple active sessions per user
        const { data: sessions } = await supabase
          .from("active_sessions")
          .select("user_id, device_info, ip_address");

        if (sessions) {
          const userSessions: Record<string, typeof sessions> = {};
          sessions.forEach(s => {
            if (!userSessions[s.user_id]) userSessions[s.user_id] = [];
            userSessions[s.user_id].push(s);
          });

          for (const [userId, userSess] of Object.entries(userSessions)) {
            if (userSess.length >= 3) {
              const ips = [...new Set(userSess.map(s => s.ip_address).filter(Boolean))];
              if (ips.length >= 2) {
                allFindings.push({
                  category: "security", severity: "medium",
                  title: `جلسات متعددة من أجهزة مختلفة`,
                  description: `مستخدم لديه ${userSess.length} جلسات نشطة من ${ips.length} عناوين IP مختلفة`,
                  recommendation: "التحقق من هوية المستخدم وإنهاء الجلسات المشبوهة",
                  fingerprint: `sec_multi_session_${userId}`,
                  related_user_id: userId,
                  details: { session_count: userSess.length, ips },
                });
              }
            }
          }
        }

        // 2c. Unresolved security alerts
        const { count: unresolvedAlerts } = await supabase
          .from("security_alerts")
          .select("*", { count: "exact", head: true })
          .eq("is_resolved", false)
          .in("severity", ["critical", "high"]);

        if (unresolvedAlerts && unresolvedAlerts > 0) {
          allFindings.push({
            category: "security", severity: "high",
            title: `${unresolvedAlerts} تنبيه أمني عالي الخطورة غير محلول`,
            description: "تنبيهات أمنية حرجة تنتظر المعالجة",
            recommendation: "مراجعة التنبيهات الأمنية فوراً واتخاذ الإجراءات اللازمة",
            fingerprint: `sec_unresolved_alerts_${unresolvedAlerts}`,
            details: { count: unresolvedAlerts },
          });
        }

        // 2d. Users with high privileges but inactive
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id, role");

        if (adminRoles) {
          for (const ar of adminRoles.filter(r => r.role === "owner")) {
            const { data: lastLogin } = await supabase
              .from("login_attempts")
              .select("created_at")
              .eq("user_id", ar.user_id)
              .eq("success", true)
              .order("created_at", { ascending: false })
              .limit(1).maybeSingle();

            if (lastLogin && lastLogin.created_at < thirtyDaysAgo) {
              allFindings.push({
                category: "security", severity: "medium",
                title: "مستخدم بصلاحيات عالية غير نشط",
                description: "حساب بصلاحيات مالك لم يسجل دخول منذ أكثر من 30 يوماً",
                recommendation: "مراجعة الحساب وتعليق الصلاحيات إذا لم يعد مستخدماً",
                fingerprint: `sec_inactive_admin_${ar.user_id}`,
                related_user_id: ar.user_id,
                details: { last_login: lastLogin.created_at, role: ar.role },
              });
            }
          }
        }
      } catch (e) { errors.push(`security: ${e.message}`); }

      // ============================================================
      // LAYER 3: WORKFLOW MONITORING
      // ============================================================
      try {
        // 3a. Stalled requests (same status > 48 hours)
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
        const { data: stalledAssignments } = await supabase
          .from("valuation_assignments")
          .select("id, reference_number, status, updated_at")
          .lt("updated_at", twoDaysAgo)
          .not("status", "in", '("completed","archived","cancelled","issued")');

        if (stalledAssignments && stalledAssignments.length > 0) {
          const byStatus: Record<string, number> = {};
          stalledAssignments.forEach(a => { byStatus[a.status] = (byStatus[a.status] || 0) + 1; });

          allFindings.push({
            category: "workflow", severity: stalledAssignments.length >= 5 ? "high" : "medium",
            title: `${stalledAssignments.length} طلب متعثر (بدون تقدم > 48 ساعة)`,
            description: `توزيع: ${Object.entries(byStatus).map(([s,c]) => `${s}: ${c}`).join(', ')}`,
            recommendation: "مراجعة الطلبات المتعثرة وتحديد أسباب التأخير واتخاذ إجراء",
            fingerprint: `wf_stalled_${stalledAssignments.length}`,
            details: { count: stalledAssignments.length, by_status: byStatus, sample_refs: stalledAssignments.slice(0,5).map(a => a.reference_number) },
          });
        }

        // 3b. Bypassed payment gates
        const { data: bypasses } = await supabase
          .from("request_audit_log")
          .select("assignment_id, new_status, reason, created_at")
          .eq("action_type", "bypass")
          .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (bypasses && bypasses.length > 0) {
          allFindings.push({
            category: "workflow", severity: "high",
            title: `${bypasses.length} تجاوز لبوابة الدفع في آخر 7 أيام`,
            description: "تم تجاوز متطلبات الدفع يدوياً — يتطلب مراجعة المبررات",
            recommendation: "مراجعة كل حالة تجاوز والتأكد من وجود مبرر مقبول",
            fingerprint: `wf_payment_bypass_${bypasses.length}`,
            details: { count: bypasses.length, bypasses: bypasses.slice(0, 10) },
          });
        }

        // 3c. Workflow bottlenecks (3+ requests in same status)
        const { data: allActive } = await supabase
          .from("valuation_assignments")
          .select("status")
          .not("status", "in", '("completed","archived","cancelled","issued")');

        if (allActive) {
          const statusCounts: Record<string, number> = {};
          allActive.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

          for (const [status, count] of Object.entries(statusCounts)) {
            if (count >= 3) {
              allFindings.push({
                category: "workflow", severity: count >= 10 ? "high" : "medium",
                title: `اختناق في مرحلة "${status}": ${count} طلبات`,
                description: `تراكم ${count} طلبات في نفس المرحلة — يشير لاختناق تشغيلي`,
                recommendation: "تخصيص موارد إضافية لهذه المرحلة أو مراجعة سبب التأخير",
                fingerprint: `wf_bottleneck_${status}`,
                details: { status, count },
              });
            }
          }
        }
      } catch (e) { errors.push(`workflow: ${e.message}`); }

      // ============================================================
      // LAYER 4: LEGAL COMPLIANCE
      // ============================================================
      try {
        // 4a. Assignments nearing issuance without compliance checks
        const { data: preIssuance } = await supabase
          .from("valuation_assignments")
          .select("id, reference_number, status")
          .in("status", ["professional_review", "draft_report_ready", "client_review", "draft_approved"]);

        if (preIssuance) {
          for (const assignment of preIssuance) {
            const { count: failedChecks } = await supabase
              .from("compliance_checks")
              .select("*", { count: "exact", head: true })
              .eq("assignment_id", assignment.id)
              .eq("is_mandatory", true)
              .eq("is_passed", false);

            if (failedChecks && failedChecks > 0) {
              allFindings.push({
                category: "legal", severity: "critical",
                title: `${assignment.reference_number}: فحوصات امتثال إلزامية فاشلة`,
                description: `${failedChecks} فحص إلزامي فاشل رغم تقدم الملف نحو الإصدار`,
                recommendation: "يجب إصلاح فحوصات الامتثال قبل السماح بالإصدار",
                fingerprint: `legal_compliance_fail_${assignment.id}`,
                related_entity_type: "assignment",
                related_entity_id: assignment.id,
                details: { reference: assignment.reference_number, failed_count: failedChecks, status: assignment.status },
              });
            }

            // Check for missing assumptions
            const { count: assumptions } = await supabase
              .from("assumptions")
              .select("*", { count: "exact", head: true })
              .eq("assignment_id", assignment.id);

            if (!assumptions || assumptions === 0) {
              allFindings.push({
                category: "legal", severity: "high",
                title: `${assignment.reference_number}: لا توجد افتراضات موثقة`,
                description: "ملف تقييم بدون افتراضات خاصة — مخالفة لمعايير IVS 2025",
                recommendation: "إضافة الافتراضات الخاصة والمحددات قبل الإصدار",
                fingerprint: `legal_no_assumptions_${assignment.id}`,
                related_entity_type: "assignment",
                related_entity_id: assignment.id,
                details: { reference: assignment.reference_number },
              });
            }
          }
        }

        // 4b. Reports without professional judgment
        const { data: postAnalysis } = await supabase
          .from("valuation_assignments")
          .select("id, reference_number")
          .in("status", ["draft_report_ready", "client_review", "draft_approved", "final_payment_confirmed"]);

        if (postAnalysis) {
          for (const a of postAnalysis) {
            const { count: judgments } = await supabase
              .from("audit_logs")
              .select("*", { count: "exact", head: true })
              .eq("assignment_id", a.id)
              .eq("action", "override");

            // Check if final value was approved
            const { count: valueApproval } = await supabase
              .from("audit_logs")
              .select("*", { count: "exact", head: true })
              .eq("assignment_id", a.id)
              .eq("action", "approve")
              .ilike("description", "%قيمة%");

            if (!valueApproval || valueApproval === 0) {
              allFindings.push({
                category: "legal", severity: "critical",
                title: `${a.reference_number}: لم يتم اعتماد القيمة النهائية`,
                description: "لا يوجد سجل اعتماد للقيمة النهائية من المقيم المعتمد — إلزامي بموجب IVS 105",
                recommendation: "يجب على المقيم المعتمد مراجعة واعتماد القيمة النهائية",
                fingerprint: `legal_no_value_approval_${a.id}`,
                related_entity_type: "assignment",
                related_entity_id: a.id,
                details: { reference: a.reference_number, has_judgment: (judgments || 0) > 0 },
              });
            }
          }
        }
      } catch (e) { errors.push(`legal: ${e.message}`); }

      // ============================================================
      // LAYER 5: FINANCIAL MONITORING
      // ============================================================
      try {
        // 5a. Pending payments > 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: pendingPayments } = await supabase
          .from("payments")
          .select("id, amount, payment_stage, created_at, request_id")
          .eq("payment_status", "pending")
          .lt("created_at", sevenDaysAgo);

        if (pendingPayments && pendingPayments.length > 0) {
          const totalAmount = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
          allFindings.push({
            category: "financial", severity: "high",
            title: `${pendingPayments.length} مدفوعات معلقة > 7 أيام`,
            description: `إجمالي المبالغ المعلقة: ${totalAmount.toLocaleString()} ر.س`,
            recommendation: "متابعة العملاء بشأن المدفوعات المعلقة أو إلغاء الطلبات المتأخرة",
            fingerprint: `fin_pending_payments_${pendingPayments.length}`,
            details: { count: pendingPayments.length, total_amount: totalAmount },
          });
        }

        // 5b. Invoices without payment
        const { data: unpaidInvoices } = await supabase
          .from("invoices")
          .select("id, invoice_number, total_amount, status, created_at")
          .eq("status", "sent")
          .lt("created_at", sevenDaysAgo);

        if (unpaidInvoices && unpaidInvoices.length > 0) {
          allFindings.push({
            category: "financial", severity: "medium",
            title: `${unpaidInvoices.length} فاتورة بدون تحصيل > 7 أيام`,
            description: "فواتير مرسلة لم يتم تحصيلها بعد",
            recommendation: "إرسال تذكير للعملاء أو متابعة عبر الهاتف",
            fingerprint: `fin_unpaid_invoices_${unpaidInvoices.length}`,
            details: { count: unpaidInvoices.length, invoices: unpaidInvoices.slice(0, 5).map(i => i.invoice_number) },
          });
        }

        // 5c. Excessive discount usage
        const { data: discountUsage } = await supabase
          .from("discount_usage_log")
          .select("discount_code_id, discount_applied")
          .gte("used_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        if (discountUsage && discountUsage.length > 10) {
          const totalDiscount = discountUsage.reduce((sum, d) => sum + (d.discount_applied || 0), 0);
          allFindings.push({
            category: "financial", severity: "medium",
            title: `${discountUsage.length} استخدام خصم في آخر 30 يوم`,
            description: `إجمالي الخصومات الممنوحة: ${totalDiscount.toLocaleString()} ر.س`,
            recommendation: "مراجعة سياسة الخصومات والتأكد من عدم الإفراط",
            fingerprint: `fin_discount_heavy`,
            details: { count: discountUsage.length, total: totalDiscount },
          });
        }
      } catch (e) { errors.push(`financial: ${e.message}`); }

      // ============================================================
      // LAYER 6: USER BEHAVIOR
      // ============================================================
      try {
        // 6a. Inspectors with overdue inspections
        const { data: overdueInspections } = await supabase
          .from("inspections")
          .select("id, inspector_id, assignment_id, inspection_date, status")
          .in("status", ["scheduled", "pending"])
          .lt("inspection_date", new Date().toISOString().split("T")[0]);

        if (overdueInspections && overdueInspections.length > 0) {
          const byInspector: Record<string, number> = {};
          overdueInspections.forEach(i => { byInspector[i.inspector_id] = (byInspector[i.inspector_id] || 0) + 1; });

          allFindings.push({
            category: "user_behavior", severity: "high",
            title: `${overdueInspections.length} معاينة متأخرة عن موعدها`,
            description: `${Object.keys(byInspector).length} معاين لديهم مهام متأخرة`,
            recommendation: "التواصل مع المعاينين المتأخرين وإعادة جدولة المهام إذا لزم الأمر",
            fingerprint: `ub_overdue_inspections_${overdueInspections.length}`,
            details: { count: overdueInspections.length, by_inspector: byInspector },
          });
        }

        // 6b. Client non-response (draft pending > 5 days)
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
        const { data: pendingClientReview } = await supabase
          .from("valuation_assignments")
          .select("id, reference_number, client_id, updated_at")
          .eq("status", "client_review")
          .lt("updated_at", fiveDaysAgo);

        if (pendingClientReview && pendingClientReview.length > 0) {
          allFindings.push({
            category: "user_behavior", severity: "medium",
            title: `${pendingClientReview.length} عميل لم يستجب لمسودة التقرير > 5 أيام`,
            description: "مسودات تقارير تنتظر مراجعة العميل دون استجابة",
            recommendation: "إرسال تذكير للعملاء عبر البريد أو الهاتف",
            fingerprint: `ub_client_nonresponse_${pendingClientReview.length}`,
            details: { count: pendingClientReview.length, refs: pendingClientReview.map(r => r.reference_number) },
          });
        }

        // 6c. Unauthorized access attempts (checking audit logs for redirect patterns)
        const { count: accessDenied } = await supabase
          .from("audit_logs")
          .select("*", { count: "exact", head: true })
          .ilike("description", "%غير مصرّح%")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (accessDenied && accessDenied > 0) {
          allFindings.push({
            category: "user_behavior", severity: "medium",
            title: `${accessDenied} محاولة وصول غير مصرح في آخر 24 ساعة`,
            description: "مستخدمون حاولوا الوصول لصفحات ليس لديهم صلاحية عليها",
            recommendation: "مراجعة سجلات الوصول والتأكد من صحة الصلاحيات",
            fingerprint: `ub_unauthorized_access_${accessDenied}`,
            details: { count: accessDenied },
          });
        }
      } catch (e) { errors.push(`user_behavior: ${e.message}`); }

      // ============================================================
      // LAYER 7: PERFORMANCE MONITORING
      // ============================================================
      try {
        // 7a. Large processing jobs stuck
        const { data: stuckJobs } = await supabase
          .from("processing_jobs")
          .select("id, status, created_at")
          .in("status", ["pending", "processing"])
          .lt("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());

        if (stuckJobs && stuckJobs.length > 0) {
          allFindings.push({
            category: "performance", severity: "high",
            title: `${stuckJobs.length} مهمة معالجة عالقة > ساعة`,
            description: "مهام معالجة مستندات لم تكتمل — قد تكون معلقة",
            recommendation: "إعادة تشغيل المهام المعلقة أو فحص سجلات الأخطاء",
            fingerprint: `perf_stuck_jobs_${stuckJobs.length}`,
            details: { count: stuckJobs.length, job_ids: stuckJobs.map(j => j.id) },
          });
        }

        // 7b. Email queue health
        const { data: emailState } = await supabase
          .from("email_send_state")
          .select("retry_after_until")
          .eq("id", 1).maybeSingle();

        if (emailState?.retry_after_until) {
          const retryUntil = new Date(emailState.retry_after_until);
          if (retryUntil > new Date()) {
            allFindings.push({
              category: "performance", severity: "high",
              title: "خدمة البريد الإلكتروني تحت ضغط",
              description: `تم تحديد حد المعدل — الاستئناف: ${retryUntil.toISOString()}`,
              recommendation: "تقليل حجم الإرسال مؤقتاً أو انتظار انتهاء فترة الحظر",
              fingerprint: "perf_email_rate_limited",
              details: { retry_after_until: emailState.retry_after_until },
            });
          }
        }

        // 7c. Failed emails in last 24h
        const { count: failedEmails } = await supabase
          .from("email_send_log")
          .select("*", { count: "exact", head: true })
          .in("status", ["failed", "dlq"])
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (failedEmails && failedEmails > 0) {
          allFindings.push({
            category: "performance", severity: failedEmails >= 10 ? "high" : "medium",
            title: `${failedEmails} بريد إلكتروني فشل إرساله في آخر 24 ساعة`,
            description: "رسائل بريد إلكتروني لم تصل للمستلمين",
            recommendation: "فحص سجلات البريد الإلكتروني وإعادة إرسال الرسائل الفاشلة",
            fingerprint: `perf_failed_emails_${failedEmails}`,
            details: { count: failedEmails },
          });
        }
      } catch (e) { errors.push(`performance: ${e.message}`); }

      // ============================================================
      // PERSIST FINDINGS
      // ============================================================
      let created = 0, updated = 0, autoResolved = 0;

      for (const finding of allFindings) {
        // Try to upsert based on fingerprint
        const { data: existing } = await supabase
          .from("raqeem_watchdog_findings")
          .select("id, detection_count")
          .eq("fingerprint", finding.fingerprint)
          .not("status", "in", '("resolved","ignored")')
          .maybeSingle();

        if (existing) {
          await supabase.from("raqeem_watchdog_findings")
            .update({
              last_detected_at: new Date().toISOString(),
              detection_count: existing.detection_count + 1,
              title: finding.title,
              description: finding.description,
              severity: finding.severity,
              details: finding.details || {},
            })
            .eq("id", existing.id);
          updated++;
        } else {
          await supabase.from("raqeem_watchdog_findings").insert({
            ...finding,
            details: finding.details || {},
          });
          created++;
        }
      }

      // Auto-resolve findings that are no longer detected
      const currentFingerprints = allFindings.map(f => f.fingerprint);
      if (currentFingerprints.length > 0) {
        const { data: openFindings } = await supabase
          .from("raqeem_watchdog_findings")
          .select("id, fingerprint")
          .eq("status", "open");

        if (openFindings) {
          for (const of_ of openFindings) {
            if (!currentFingerprints.includes(of_.fingerprint)) {
              await supabase.from("raqeem_watchdog_findings")
                .update({ status: "resolved", auto_resolved: true, resolved_at: new Date().toISOString() })
                .eq("id", of_.id);
              autoResolved++;
            }
          }
        }
      }

      // Update scan record
      await supabase.from("raqeem_watchdog_scans")
        .update({
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          findings_created: created,
          findings_updated: updated,
          findings_auto_resolved: autoResolved,
          errors: errors.length > 0 ? errors : [],
        })
        .eq("id", scanId);

      return new Response(JSON.stringify({
        success: true,
        scan_id: scanId,
        duration_ms: Date.now() - startTime,
        findings: { total: allFindings.length, created, updated, auto_resolved: autoResolved },
        errors: errors.length > 0 ? errors : undefined,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get latest findings for dashboard
    if (action === "get_findings") {
      const { data: findings } = await supabase
        .from("raqeem_watchdog_findings")
        .select("*")
        .in("status", ["open", "acknowledged", "escalated"])
        .order("severity", { ascending: true })
        .order("last_detected_at", { ascending: false })
        .limit(100);

      const { data: lastScan } = await supabase
        .from("raqeem_watchdog_scans")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1).maybeSingle();

      // Category counts
      const stats: Record<string, number> = {};
      const severityStats: Record<string, number> = {};
      (findings || []).forEach(f => {
        stats[f.category] = (stats[f.category] || 0) + 1;
        severityStats[f.severity] = (severityStats[f.severity] || 0) + 1;
      });

      return new Response(JSON.stringify({
        findings: findings || [],
        stats, severity_stats: severityStats,
        total: (findings || []).length,
        last_scan: lastScan,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update finding status
    if (action === "update_finding") {
      const { finding_id, status, resolution_notes } = await req.json();
      const updateData: Record<string, unknown> = { status };
      if (status === "resolved") {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolution_notes = resolution_notes || null;
      }
      await supabase.from("raqeem_watchdog_findings").update(updateData).eq("id", finding_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
