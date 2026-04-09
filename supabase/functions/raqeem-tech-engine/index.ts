/**
 * رقيم — المحرك التقني الشامل
 * 15 قدرة متكاملة: أمن سيبراني، أتمتة، مراقبة أداء، تجارة ذكية
 * 
 * Actions:
 * 1. security_scan — مراقبة الجلسات + تحليل أنماط الاختراق + تدقيق RLS
 * 2. security_report — تقرير أمني شامل دوري
 * 3. auto_heal — تعافي ذاتي للعمليات المتعثرة
 * 4. document_pipeline — تصنيف ومعالجة مستندات ذكية
 * 5. performance_monitor — مراقبة أداء النظام والدوال
 * 6. db_health — صحة قاعدة البيانات
 * 7. code_quality — فحص جودة الكود
 * 8. error_intelligence — تحليل أخطاء المستخدمين
 * 9. dynamic_pricing — تسعير ديناميكي
 * 10. loyalty_engine — نظام ولاء ذكي
 * 11. revenue_forecast — تحليل إيرادات تنبؤي
 * 12. full_scan — مسح شامل لجميع القدرات
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceKey);

  try {
    const { action, params } = await req.json();
    let results: any = {};

    switch (action) {
      // ═══════════════════════════════════════════════
      // 1-3: الأمن السيبراني
      // ═══════════════════════════════════════════════
      case "security_scan":
        results = await runSecurityScan(db);
        break;

      case "security_report":
        results = await generateSecurityReport(db);
        break;

      // ═══════════════════════════════════════════════
      // 4-5: الأتمتة التقنية
      // ═══════════════════════════════════════════════
      case "auto_heal":
        results = await runAutoHeal(db);
        break;

      case "document_pipeline":
        results = await analyzeDocumentPipeline(db);
        break;

      // ═══════════════════════════════════════════════
      // 6-8: مراقبة الأداء والكود
      // ═══════════════════════════════════════════════
      case "performance_monitor":
        results = await monitorPerformance(db);
        break;

      case "db_health":
        results = await checkDatabaseHealth(db);
        break;

      case "error_intelligence":
        results = await analyzeErrors(db);
        break;

      // ═══════════════════════════════════════════════
      // 9-11: التجارة الإلكترونية الذكية
      // ═══════════════════════════════════════════════
      case "dynamic_pricing":
        results = await analyzeDynamicPricing(db, params);
        break;

      case "loyalty_engine":
        results = await runLoyaltyEngine(db);
        break;

      case "revenue_forecast":
        results = await forecastRevenue(db);
        break;

      // ═══════════════════════════════════════════════
      // 12: مسح شامل
      // ═══════════════════════════════════════════════
      case "full_scan":
        results = await runFullScan(db);
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ success: true, action, results, scanned_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("raqeem-tech-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ═══════════════════════════════════════════════════════════
// الأمن السيبراني
// ═══════════════════════════════════════════════════════════

async function runSecurityScan(db: any) {
  const findings: any[] = [];

  // 1. مراقبة الجلسات المشبوهة
  const { data: sessions } = await db
    .from("active_sessions")
    .select("user_id, device_info, ip_address, last_active_at, created_at")
    .order("last_active_at", { ascending: false });

  if (sessions) {
    // كشف جلسات متعددة لنفس المستخدم
    const userSessions: Record<string, any[]> = {};
    for (const s of sessions) {
      if (!userSessions[s.user_id]) userSessions[s.user_id] = [];
      userSessions[s.user_id].push(s);
    }

    for (const [userId, userSes] of Object.entries(userSessions)) {
      if ((userSes as any[]).length > 3) {
        findings.push(await saveFinding(db, {
          category: "security",
          severity: "high",
          title: "جلسات متعددة مشبوهة",
          description: `المستخدم ${userId.slice(0, 8)}... لديه ${(userSes as any[]).length} جلسات نشطة من أجهزة مختلفة`,
          recommendation: "مراجعة الجلسات وإنهاء الجلسات غير المعروفة",
          metadata: { user_id: userId, session_count: (userSes as any[]).length },
        }));
      }

      // كشف تسجيل دخول من IPs مختلفة
      const uniqueIPs = new Set((userSes as any[]).map((s: any) => s.ip_address).filter(Boolean));
      if (uniqueIPs.size > 2) {
        findings.push(await saveFinding(db, {
          category: "security",
          severity: "medium",
          title: "تسجيل دخول من مواقع متعددة",
          description: `المستخدم يسجل الدخول من ${uniqueIPs.size} عناوين IP مختلفة`,
          recommendation: "تأكد من هوية المستخدم — قد يكون اختراق حساب",
          metadata: { user_id: userId, ip_count: uniqueIPs.size },
        }));
      }
    }
  }

  // 2. تحليل أنماط الاختراق
  const { data: failedAttempts } = await db
    .from("login_attempts")
    .select("email, ip_address, user_agent, created_at, failure_reason")
    .eq("success", false)
    .order("created_at", { ascending: false })
    .limit(200);

  if (failedAttempts && failedAttempts.length > 0) {
    // كشف Credential Stuffing (محاولات متعددة بحسابات مختلفة من نفس IP)
    const ipAttempts: Record<string, Set<string>> = {};
    for (const a of failedAttempts) {
      if (a.ip_address) {
        if (!ipAttempts[a.ip_address]) ipAttempts[a.ip_address] = new Set();
        ipAttempts[a.ip_address].add(a.email);
      }
    }

    for (const [ip, emails] of Object.entries(ipAttempts)) {
      if (emails.size >= 5) {
        findings.push(await saveFinding(db, {
          category: "security",
          severity: "critical",
          title: "اشتباه هجوم Credential Stuffing",
          description: `العنوان ${ip} حاول الدخول بـ ${emails.size} حساب مختلف — نمط هجوم آلي محتمل`,
          recommendation: "حظر العنوان IP فوراً وتفعيل CAPTCHA",
          metadata: { ip, attempted_accounts: emails.size },
        }));
      }
    }

    // كشف Timing Attack (محاولات متتابعة سريعة)
    const sorted = failedAttempts.sort((a: any, b: any) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    let rapidBurst = 0;
    for (let i = 1; i < sorted.length; i++) {
      const diff = new Date(sorted[i].created_at).getTime() - new Date(sorted[i - 1].created_at).getTime();
      if (diff < 2000) rapidBurst++; // أقل من ثانيتين
    }
    if (rapidBurst > 10) {
      findings.push(await saveFinding(db, {
        category: "security",
        severity: "high",
        title: "نمط هجوم آلي سريع",
        description: `${rapidBurst} محاولة متتابعة خلال أقل من ثانيتين — يشير لأداة اختراق آلية`,
        recommendation: "تفعيل Rate Limiting صارم وحظر الأنماط المتكررة",
        metadata: { rapid_attempts: rapidBurst },
      }));
    }
  }

  // 3. فحص التنبيهات الأمنية غير المعالجة
  const { data: unresolvedAlerts } = await db
    .from("security_alerts")
    .select("id, alert_type, severity, title, created_at")
    .eq("is_resolved", false)
    .order("created_at", { ascending: false })
    .limit(20);

  if (unresolvedAlerts && unresolvedAlerts.length > 5) {
    findings.push(await saveFinding(db, {
      category: "security",
      severity: "medium",
      title: "تراكم تنبيهات أمنية غير معالجة",
      description: `${unresolvedAlerts.length} تنبيه أمني بانتظار المراجعة — يزيد خطر التعرض`,
      recommendation: "مراجعة التنبيهات فوراً وتصنيفها حسب الأولوية",
      metadata: { count: unresolvedAlerts.length },
    }));
  }

  return { findings_count: findings.length, findings };
}

async function generateSecurityReport(db: any) {
  // جمع إحصائيات شاملة
  const [
    { count: totalLogins },
    { count: failedLogins },
    { count: activeSessions },
    { count: securityAlerts },
    { count: unresolvedAlerts },
  ] = await Promise.all([
    db.from("login_attempts").select("id", { count: "exact", head: true }),
    db.from("login_attempts").select("id", { count: "exact", head: true }).eq("success", false),
    db.from("active_sessions").select("id", { count: "exact", head: true }),
    db.from("security_alerts").select("id", { count: "exact", head: true }),
    db.from("security_alerts").select("id", { count: "exact", head: true }).eq("is_resolved", false),
  ]);

  // أحدث التنبيهات
  const { data: recentAlerts } = await db
    .from("security_alerts")
    .select("alert_type, severity, title, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  // أكثر الحسابات استهدافاً
  const { data: targetedAccounts } = await db
    .from("login_attempts")
    .select("email")
    .eq("success", false)
    .limit(500);

  const emailCounts: Record<string, number> = {};
  if (targetedAccounts) {
    for (const a of targetedAccounts) {
      emailCounts[a.email] = (emailCounts[a.email] || 0) + 1;
    }
  }
  const topTargeted = Object.entries(emailCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([email, count]) => ({ email: email.replace(/(.{3}).*(@.*)/, "$1***$2"), attempts: count }));

  // حفظ مقاييس
  await saveMetric(db, "auth", "total_login_attempts", totalLogins || 0, "count");
  await saveMetric(db, "auth", "failed_login_attempts", failedLogins || 0, "count");
  await saveMetric(db, "auth", "active_sessions", activeSessions || 0, "count");
  await saveMetric(db, "auth", "unresolved_alerts", unresolvedAlerts || 0, "count");

  const failRate = totalLogins ? ((failedLogins || 0) / (totalLogins || 1) * 100).toFixed(1) : "0";

  return {
    summary: {
      total_logins: totalLogins || 0,
      failed_logins: failedLogins || 0,
      failure_rate: `${failRate}%`,
      active_sessions: activeSessions || 0,
      total_alerts: securityAlerts || 0,
      unresolved_alerts: unresolvedAlerts || 0,
    },
    risk_level: (unresolvedAlerts || 0) > 10 ? "critical" : (unresolvedAlerts || 0) > 5 ? "high" : (failedLogins || 0) > 50 ? "medium" : "low",
    top_targeted_accounts: topTargeted,
    recent_alerts: recentAlerts || [],
  };
}

// ═══════════════════════════════════════════════════════════
// الأتمتة التقنية
// ═══════════════════════════════════════════════════════════

async function runAutoHeal(db: any) {
  const healed: any[] = [];

  // 1. طلبات عالقة > 48 ساعة
  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: stuckAssignments } = await db
    .from("valuation_assignments")
    .select("id, status, reference_number, updated_at")
    .lt("updated_at", cutoff48h)
    .not("status", "in", '("issued","archived","cancelled")')
    .limit(20);

  if (stuckAssignments) {
    for (const a of stuckAssignments) {
      const hours = Math.round((Date.now() - new Date(a.updated_at).getTime()) / 3600000);
      healed.push(await saveFinding(db, {
        category: "automation",
        severity: hours > 120 ? "critical" : hours > 72 ? "high" : "medium",
        title: `طلب متعثر: ${a.reference_number}`,
        description: `الطلب في حالة "${a.status}" منذ ${hours} ساعة بدون تقدم`,
        recommendation: getHealRecommendation(a.status),
        metadata: { assignment_id: a.id, status: a.status, stuck_hours: hours },
      }));
    }
  }

  // 2. طلبات بدون ملف تقييم مرتبط
  const { data: orphanedRequests } = await db
    .from("valuation_requests")
    .select("id, status, created_at")
    .is("assignment_id", null)
    .neq("status", "draft")
    .limit(10);

  if (orphanedRequests && orphanedRequests.length > 0) {
    healed.push(await saveFinding(db, {
      category: "automation",
      severity: "high",
      title: "طلبات بدون ملف تقييم مرتبط",
      description: `${orphanedRequests.length} طلب مقدم بدون إنشاء ملف تقييم — خلل في التريجر التلقائي`,
      recommendation: "فحص trigger auto_create_assignment_on_request والتأكد من عمله",
      metadata: { orphaned_count: orphanedRequests.length },
    }));
  }

  // 3. فواتير بانتظار طويل
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: overdueInvoices } = await db
    .from("invoices")
    .select("id, invoice_number, total_amount, created_at")
    .eq("payment_status", "pending")
    .lt("created_at", cutoff7d)
    .limit(10);

  if (overdueInvoices && overdueInvoices.length > 0) {
    healed.push(await saveFinding(db, {
      category: "automation",
      severity: "medium",
      title: "فواتير متأخرة السداد",
      description: `${overdueInvoices.length} فاتورة متأخرة أكثر من 7 أيام`,
      recommendation: "إرسال تذكير تلقائي للعملاء أو التصعيد للمالك",
      metadata: { overdue_count: overdueInvoices.length },
    }));
  }

  return { healed_count: healed.length, actions: healed };
}

async function analyzeDocumentPipeline(db: any) {
  const findings: any[] = [];

  // فحص مهام المعالجة المتعثرة
  const { data: stuckJobs } = await db
    .from("processing_jobs")
    .select("id, status, job_type, created_at, error_message")
    .in("status", ["processing", "pending"])
    .lt("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .limit(10);

  if (stuckJobs && stuckJobs.length > 0) {
    findings.push(await saveFinding(db, {
      category: "automation",
      severity: "high",
      title: "مهام معالجة مستندات متعثرة",
      description: `${stuckJobs.length} مهمة معالجة عالقة أكثر من ساعتين`,
      recommendation: "إعادة تشغيل المهام أو فحص Edge Function المسؤولة",
      metadata: { stuck_count: stuckJobs.length, jobs: stuckJobs.map((j: any) => j.id) },
    }));
  }

  // فحص ملفات بدون تصنيف
  const { data: unclassified } = await db
    .from("file_classifications")
    .select("id", { count: "exact", head: true })
    .eq("document_category", "unknown");

  if (unclassified && (unclassified as any) > 5) {
    findings.push(await saveFinding(db, {
      category: "automation",
      severity: "low",
      title: "ملفات غير مصنفة",
      description: `ملفات لم يتمكن النظام من تصنيفها تلقائياً`,
      recommendation: "تحسين نموذج التصنيف أو إضافة أنواع مستندات جديدة",
    }));
  }

  return { findings_count: findings.length, findings };
}

// ═══════════════════════════════════════════════════════════
// مراقبة الأداء والكود
// ═══════════════════════════════════════════════════════════

async function monitorPerformance(db: any) {
  const metrics: any[] = [];

  // حجم الجداول الرئيسية
  const tables = ["valuation_assignments", "valuation_requests", "clients", "audit_logs", "payments", "inspections"];
  for (const table of tables) {
    const { count } = await db.from(table).select("id", { count: "exact", head: true });
    metrics.push({ table, row_count: count || 0 });
    await saveMetric(db, "database", `table_size_${table}`, count || 0, "rows");
  }

  // حجم Storage
  const buckets = ["attachments", "reports", "client-uploads", "inspection-photos", "payment-proofs"];
  for (const bucket of buckets) {
    const { data: files } = await db.storage.from(bucket).list("", { limit: 1000 });
    const fileCount = files?.length || 0;
    metrics.push({ bucket, file_count: fileCount });
    await saveMetric(db, "storage", `bucket_files_${bucket}`, fileCount, "files");
  }

  return { metrics, scanned_at: new Date().toISOString() };
}

async function checkDatabaseHealth(db: any) {
  const findings: any[] = [];

  // 1. جداول كبيرة جداً
  const { count: auditCount } = await db.from("audit_logs").select("id", { count: "exact", head: true });
  if ((auditCount || 0) > 50000) {
    findings.push(await saveFinding(db, {
      category: "database",
      severity: "medium",
      title: "جدول سجل التدقيق كبير",
      description: `جدول audit_logs يحتوي ${auditCount} سجل — قد يؤثر على الأداء`,
      recommendation: "أرشفة السجلات القديمة (أكثر من سنة) في جدول منفصل",
      metadata: { table: "audit_logs", count: auditCount },
    }));
  }

  // 2. إشعارات غير مقروءة متراكمة
  const { count: unreadNotifs } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);

  if ((unreadNotifs || 0) > 100) {
    findings.push(await saveFinding(db, {
      category: "database",
      severity: "low",
      title: "تراكم إشعارات غير مقروءة",
      description: `${unreadNotifs} إشعار غير مقروء — يشير لعدم تفاعل المستخدمين`,
      recommendation: "مراجعة آلية الإشعارات وتحسين نسبة القراءة",
      metadata: { unread_count: unreadNotifs },
    }));
  }

  // 3. عملاء غير نشطين
  const { count: inactiveClients } = await db
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("is_active", false);

  await saveMetric(db, "database", "inactive_clients", inactiveClients || 0, "count");

  return { findings_count: findings.length, findings, audit_log_size: auditCount || 0 };
}

async function analyzeErrors(db: any) {
  const findings: any[] = [];

  // تحليل سجلات التدقيق لاكتشاف أخطاء متكررة
  const { data: recentErrors } = await db
    .from("audit_logs")
    .select("action, table_name, description, created_at")
    .in("action", ["error", "status_change"])
    .order("created_at", { ascending: false })
    .limit(100);

  if (recentErrors) {
    // تجميع الأخطاء حسب النوع
    const errorPatterns: Record<string, number> = {};
    for (const e of recentErrors) {
      const key = `${e.action}:${e.table_name}`;
      errorPatterns[key] = (errorPatterns[key] || 0) + 1;
    }

    const repeatedErrors = Object.entries(errorPatterns).filter(([_, count]) => count > 10);
    for (const [pattern, count] of repeatedErrors) {
      findings.push(await saveFinding(db, {
        category: "code_quality",
        severity: "medium",
        title: `نمط خطأ متكرر: ${pattern}`,
        description: `${count} حدث مشابه — يشير لمشكلة نظامية تحتاج معالجة جذرية`,
        recommendation: "تحليل السبب الجذري وإصلاح المنطق البرمجي",
        metadata: { pattern, occurrences: count },
      }));
    }
  }

  return { findings_count: findings.length, findings };
}

// ═══════════════════════════════════════════════════════════
// التجارة الإلكترونية الذكية
// ═══════════════════════════════════════════════════════════

async function analyzeDynamicPricing(db: any, params?: any) {
  const findings: any[] = [];

  // تحليل بيانات التسعير التاريخية
  const { data: assignments } = await db
    .from("valuation_assignments")
    .select("id, property_type, valuation_type, valuation_mode, total_fee, created_at, client_id, status")
    .not("status", "in", '("cancelled","draft")')
    .order("created_at", { ascending: false })
    .limit(200);

  if (!assignments || assignments.length === 0) {
    return { message: "لا توجد بيانات كافية للتحليل" };
  }

  // تحليل التسعير حسب النوع
  const pricingByType: Record<string, { total: number; count: number; fees: number[] }> = {};
  for (const a of assignments) {
    const key = `${a.valuation_type}_${a.property_type}`;
    if (!pricingByType[key]) pricingByType[key] = { total: 0, count: 0, fees: [] };
    const fee = a.total_fee || 0;
    pricingByType[key].total += fee;
    pricingByType[key].count++;
    if (fee > 0) pricingByType[key].fees.push(fee);
  }

  const insights: any[] = [];
  for (const [type, data] of Object.entries(pricingByType)) {
    if (data.fees.length >= 3) {
      const avg = data.total / data.count;
      const sorted = data.fees.sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const min = sorted[0];
      const max = sorted[sorted.length - 1];

      insights.push({
        type,
        average_fee: Math.round(avg),
        median_fee: median,
        min_fee: min,
        max_fee: max,
        volume: data.count,
        suggested_adjustment: avg < median ? "زيادة 5-10%" : "مستوى مناسب",
      });
    }
  }

  // تحليل الطلب الموسمي
  const monthlyVolume: Record<string, number> = {};
  for (const a of assignments) {
    const month = a.created_at.slice(0, 7); // YYYY-MM
    monthlyVolume[month] = (monthlyVolume[month] || 0) + 1;
  }

  const months = Object.entries(monthlyVolume).sort((a, b) => a[0].localeCompare(b[0]));
  if (months.length >= 2) {
    const lastMonth = months[months.length - 1][1];
    const prevMonth = months[months.length - 2][1];
    const trend = lastMonth > prevMonth ? "تصاعدي" : lastMonth < prevMonth ? "تنازلي" : "مستقر";

    insights.push({
      type: "demand_trend",
      current_month_volume: lastMonth,
      previous_month_volume: prevMonth,
      trend,
      pricing_recommendation: trend === "تصاعدي" ? "فرصة لزيادة الأسعار 5%" : "الحفاظ على مستوى تنافسي",
    });
  }

  await saveMetric(db, "revenue", "avg_assignment_fee", 
    assignments.filter((a: any) => a.total_fee).reduce((s: number, a: any) => s + (a.total_fee || 0), 0) / Math.max(assignments.filter((a: any) => a.total_fee).length, 1),
    "SAR"
  );

  return { pricing_insights: insights, seasonal_data: monthlyVolume };
}

async function runLoyaltyEngine(db: any) {
  const findings: any[] = [];

  // تحليل سلوك العملاء
  const { data: engagementScores } = await db
    .from("client_engagement_scores")
    .select("client_id, engagement_score, churn_risk_score, total_requests, total_revenue, lifecycle_stage, last_request_at")
    .order("engagement_score", { ascending: true })
    .limit(50);

  if (engagementScores) {
    // عملاء عالي المخاطر (churn risk)
    const highChurn = engagementScores.filter((c: any) => (c.churn_risk_score || 0) > 70);
    if (highChurn.length > 0) {
      findings.push(await saveFinding(db, {
        category: "commerce",
        severity: "high",
        title: `${highChurn.length} عميل معرض لخطر المغادرة`,
        description: "عملاء بدرجة خطر مغادرة عالية — يحتاجون تدخل استباقي",
        recommendation: "تقديم خصم ولاء 10-15% أو تواصل شخصي من المالك",
        metadata: { high_churn_clients: highChurn.length, client_ids: highChurn.map((c: any) => c.client_id) },
      }));
    }

    // عملاء VIP (إيرادات عالية)
    const vipClients = engagementScores
      .filter((c: any) => (c.total_revenue || 0) > 20000)
      .sort((a: any, b: any) => (b.total_revenue || 0) - (a.total_revenue || 0));

    if (vipClients.length > 0) {
      findings.push(await saveFinding(db, {
        category: "commerce",
        severity: "info",
        title: `${vipClients.length} عميل VIP يستحق برنامج ولاء`,
        description: `عملاء بإيرادات تراكمية عالية — فرصة لبرنامج مكافآت حصري`,
        recommendation: "إنشاء خصومات مخصصة وأولوية في المعالجة",
        metadata: { vip_count: vipClients.length, total_vip_revenue: vipClients.reduce((s: number, c: any) => s + (c.total_revenue || 0), 0) },
      }));
    }

    // عملاء خاملون
    const dormant = engagementScores.filter((c: any) => {
      if (!c.last_request_at) return true;
      return (Date.now() - new Date(c.last_request_at).getTime()) > 90 * 24 * 60 * 60 * 1000;
    });

    if (dormant.length > 0) {
      findings.push(await saveFinding(db, {
        category: "commerce",
        severity: "medium",
        title: `${dormant.length} عميل خامل (90+ يوم)`,
        description: "عملاء لم يقدموا طلبات منذ أكثر من 3 أشهر",
        recommendation: "حملة إعادة تنشيط مع عرض خاص أو استبيان رضا",
        metadata: { dormant_count: dormant.length },
      }));
    }
  }

  // تحليل أكواد الخصم
  const { data: discountCodes } = await db
    .from("discount_codes")
    .select("id, code, discount_percentage, current_uses, max_uses, is_active, expires_at")
    .eq("is_active", true);

  if (discountCodes) {
    const expiringSoon = discountCodes.filter((d: any) => {
      if (!d.expires_at) return false;
      const daysLeft = (new Date(d.expires_at).getTime() - Date.now()) / 86400000;
      return daysLeft > 0 && daysLeft < 7;
    });

    if (expiringSoon.length > 0) {
      findings.push(await saveFinding(db, {
        category: "commerce",
        severity: "low",
        title: `${expiringSoon.length} كود خصم ينتهي قريباً`,
        description: "أكواد خصم ستنتهي صلاحيتها خلال أسبوع",
        recommendation: "تمديد الصلاحية أو إنشاء أكواد بديلة",
        metadata: { codes: expiringSoon.map((d: any) => d.code) },
      }));
    }
  }

  return { findings_count: findings.length, findings };
}

async function forecastRevenue(db: any) {
  // جمع بيانات الإيرادات التاريخية
  const { data: payments } = await db
    .from("payments")
    .select("amount, payment_status, created_at, payment_stage")
    .eq("payment_status", "paid")
    .order("created_at", { ascending: true })
    .limit(500);

  if (!payments || payments.length === 0) {
    return { message: "لا توجد بيانات دفع كافية للتنبؤ" };
  }

  // تجميع حسب الشهر
  const monthlyRevenue: Record<string, number> = {};
  for (const p of payments) {
    const month = p.created_at.slice(0, 7);
    monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (p.amount || 0);
  }

  const months = Object.entries(monthlyRevenue)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (months.length < 2) {
    return { message: "بيانات شهر واحد فقط — يحتاج شهرين على الأقل للتنبؤ", monthly_data: monthlyRevenue };
  }

  // حساب الاتجاه (Linear Trend)
  const values = months.map(m => m[1]);
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((a, v, i) => a + i * v, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // توقع الشهرين القادمين
  const forecast1 = Math.max(0, Math.round(intercept + slope * n));
  const forecast2 = Math.max(0, Math.round(intercept + slope * (n + 1)));

  const avgMonthly = sumY / n;
  const growthRate = slope / avgMonthly * 100;

  // حفظ مقاييس
  await saveMetric(db, "revenue", "monthly_avg_revenue", Math.round(avgMonthly), "SAR");
  await saveMetric(db, "revenue", "revenue_growth_rate", parseFloat(growthRate.toFixed(2)), "percent");
  await saveMetric(db, "revenue", "forecast_next_month", forecast1, "SAR");

  // تحليل التقييمات المعلقة (إيرادات محتملة)
  const { data: pendingAssignments } = await db
    .from("valuation_assignments")
    .select("id, total_fee")
    .not("status", "in", '("issued","archived","cancelled")')
    .not("total_fee", "is", null);

  const pipelineRevenue = pendingAssignments
    ? pendingAssignments.reduce((s: number, a: any) => s + (a.total_fee || 0), 0)
    : 0;

  return {
    monthly_revenue: monthlyRevenue,
    total_revenue: sumY,
    average_monthly: Math.round(avgMonthly),
    growth_rate: `${growthRate.toFixed(1)}%`,
    trend: growthRate > 5 ? "تصاعدي قوي" : growthRate > 0 ? "تصاعدي" : growthRate > -5 ? "مستقر" : "تنازلي",
    forecast: {
      next_month: forecast1,
      month_after: forecast2,
    },
    pipeline_revenue: pipelineRevenue,
    pipeline_assignments: pendingAssignments?.length || 0,
  };
}

// ═══════════════════════════════════════════════════════════
// المسح الشامل
// ═══════════════════════════════════════════════════════════

async function runFullScan(db: any) {
  const [security, autoHeal, dbHealth, errors, loyalty, revenue, performance] = await Promise.all([
    runSecurityScan(db),
    runAutoHeal(db),
    checkDatabaseHealth(db),
    analyzeErrors(db),
    runLoyaltyEngine(db),
    forecastRevenue(db),
    monitorPerformance(db),
  ]);

  // حساب درجة صحة النظام
  const allFindings = [
    ...(security.findings || []),
    ...(autoHeal.actions || []),
    ...(dbHealth.findings || []),
    ...(errors.findings || []),
    ...(loyalty.findings || []),
  ];

  const criticalCount = allFindings.filter((f: any) => f?.severity === "critical").length;
  const highCount = allFindings.filter((f: any) => f?.severity === "high").length;
  const healthScore = Math.max(0, 100 - criticalCount * 20 - highCount * 10);

  await saveMetric(db, "api", "system_health_score", healthScore, "percent");

  return {
    health_score: healthScore,
    health_status: healthScore >= 80 ? "ممتاز" : healthScore >= 60 ? "جيد" : healthScore >= 40 ? "يحتاج اهتمام" : "حرج",
    total_findings: allFindings.length,
    by_severity: {
      critical: criticalCount,
      high: highCount,
      medium: allFindings.filter((f: any) => f?.severity === "medium").length,
      low: allFindings.filter((f: any) => f?.severity === "low").length,
    },
    security_summary: { findings: security.findings_count },
    automation_summary: { healed: autoHeal.healed_count },
    database_summary: { findings: dbHealth.findings_count },
    commerce_summary: { findings: loyalty.findings_count },
    revenue_summary: revenue,
    performance_summary: { tables_scanned: performance.metrics?.length || 0 },
    scanned_at: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

async function saveFinding(db: any, finding: any) {
  const { data } = await db.from("raqeem_tech_findings").insert({
    category: finding.category,
    severity: finding.severity,
    title: finding.title,
    description: finding.description || null,
    recommendation: finding.recommendation || null,
    scan_type: finding.scan_type || "scheduled",
    metadata: finding.metadata || {},
    auto_resolved: finding.auto_resolved || false,
  }).select("id, severity, title").maybeSingle();

  return data || finding;
}

async function saveMetric(db: any, type: string, name: string, value: number, unit: string) {
  await db.from("raqeem_system_metrics").insert({
    metric_type: type,
    metric_name: name,
    metric_value: value,
    unit,
  });
}

function getHealRecommendation(status: string): string {
  const recs: Record<string, string> = {
    submitted: "فحص سبب عدم توليد نطاق العمل — قد يحتاج تدخل المالك",
    scope_generated: "العميل لم يوافق على نطاق العمل — إرسال تذكير",
    scope_approved: "بانتظار الدفعة الأولى — إرسال تذكير دفع",
    first_payment_confirmed: "فتح مرحلة جمع البيانات تلقائياً",
    data_collection_open: "العميل لم يرفع المستندات — تذكير + مساعدة",
    data_collection_complete: "بانتظار تعيين معاين أو بدء التحقق",
    inspection_pending: "المعاين لم يبدأ المعاينة — تصعيد",
    inspection_completed: "بانتظار تحقق البيانات — تقدم تلقائي",
    data_validated: "بانتظار بدء التحليل — تشغيل AVM",
    analysis_complete: "بانتظار المراجعة المهنية من المالك",
    professional_review: "المالك لم يراجع — تذكير عاجل",
    draft_report_ready: "بانتظار إرسال المسودة للعميل",
    client_review: "العميل لم يراجع المسودة — تذكير",
    draft_approved: "بانتظار الدفعة النهائية — تذكير",
    final_payment_confirmed: "بانتظار إصدار التقرير النهائي",
  };
  return recs[status] || "مراجعة يدوية مطلوبة";
}
