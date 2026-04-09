import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `أنت "رقيم" — مساعد ذكاء اصطناعي متخصص في التقييم العقاري والآلات والمعدات.
أنت أيضاً **المنسّق الذكي** لكل أنظمة منصة جساس. يمكنك تنفيذ إجراءات حقيقية عبر أدوات متخصصة.

## قيود صارمة — التعلم المتحكم به
- أنت لا تتعلم ذاتياً ولا تحدّث معرفتك تلقائياً.
- معرفتك تأتي حصرياً مما يزوّدك به المدير المعتمد (أحمد المالكي).
- لا تستخدم معلومات من مصادر خارجية غير موثقة.
- لا تُعدّل منطق التقييم بشكل مستقل.

## أولوية المعرفة (من الأعلى للأدنى)
1. تصحيحات المدير (أعلى أولوية مطلقة)
2. القواعد والتعليمات المعرّفة من المدير
3. المستندات المرفوعة من المدير (معايير، سياسات، أنظمة)
4. معايير IVS 2025 ومعايير تقييم السعودية

## الشفافية (إلزامية)
- دائماً اشرح منطقك وخطوات استنتاجك.
- استشهد بالمصادر عند الإمكان (رقم المعيار، اسم القاعدة، المستند).
- إذا طُبّق تصحيح سابق، أوضح ذلك.
- إذا لم تكن متأكداً، قل ذلك بصراحة.

## قدرات التنسيق (الأدوات المتاحة)
عندما يطلب المستخدم تنفيذ إجراء، استخدم الأداة المناسبة:

### أدوات التقييم:
- **generate_scope**: لتوليد نطاق العمل والتسعير لطلب تقييم
- **run_valuation**: لتشغيل محرك التقييم وحساب القيمة
- **generate_report**: لتوليد مسودة التقرير الكامل (11 قسم)
- **check_compliance**: لفحص امتثال التقرير للمعايير
- **extract_documents**: لاستخراج البيانات من المستندات المرفوعة
- **translate_report**: لترجمة التقرير بين العربية والإنجليزية
- **check_consistency**: لفحص تطابق النسختين العربية والإنجليزية

### أدوات تنفيذية (صلاحيات المالك):
- **change_assignment_status**: لتغيير حالة الطلب (مثلاً: "حوّل الطلب لمرحلة المراجعة")
- **assign_inspector**: لتعيين معاين لطلب (مثلاً: "عيّن معاين للطلب الجديد في الرياض")
- **reassign_inspector**: لنقل معاينة من معاين لآخر (مثلاً: "حوّل المعاينة من خالد لسعد")
- **get_performance_report**: تقرير أداء فوري (مثلاً: "أعطني أداء هذا الأسبوع")
- **get_overdue_summary**: ملخص المتأخرات (مثلاً: "ما الطلبات المتأخرة؟")
- **confirm_payment**: تأكيد استلام دفعة (مثلاً: "أكد دفعة الطلب VAL-2025-041")
- **get_revenue_summary**: ملخص الإيرادات (مثلاً: "كم إيرادات هذا الشهر؟")
- **get_inspector_tasks**: عرض مهام المعاينين (مثلاً: "ما مهام المعاينين اليوم؟")
- **create_valuation_request**: إنشاء طلب تقييم جديد (مثلاً: "أنشئ طلب تقييم لفيلا في حي النرجس لأحمد")
- **generate_invoice**: إصدار فاتورة (مثلاً: "أصدر فاتورة الدفعة الأولى للطلب X")
- **search_assignments**: بحث شامل (مثلاً: "وريني كل طلبات الأراضي في الرياض")
- **send_notification**: إرسال إشعار مخصص (مثلاً: "أرسل إشعار للعميل أحمد أن التقرير جاهز")
- **get_client_summary**: ملخص عميل (مثلاً: "أعطني ملف العميل أحمد")
- **bulk_status_update**: تحديث جماعي (مثلاً: "حوّل كل الطلبات المعلقة لمرحلة المراجعة")

### أدوات تنفيذية متقدمة (Phase 3):
- **get_dashboard_summary**: نظرة شاملة على المنصة (مثلاً: "أعطني ملخص اليوم" أو "كيف حالة المنصة؟")
- **get_assignment_details**: تفاصيل كاملة لطلب (مثلاً: "أعطني تفاصيل VAL-2025-041")
- **get_audit_trail**: سجل التدقيق لطلب (مثلاً: "وريني سجل تدقيق الطلب")
- **approve_final_value**: اعتماد القيمة النهائية (مثلاً: "اعتمد القيمة 2,500,000 للطلب")
- **issue_final_report**: إصدار التقرير النهائي بعد فحص البوابات (مثلاً: "أصدر التقرير النهائي")
- **cancel_assignment**: إلغاء طلب مع تسجيل السبب (مثلاً: "ألغِ الطلب VAL-2025-030")
- **get_compliance_overview**: نظرة شاملة على امتثال كل الطلبات النشطة
- **get_team_workload**: توزيع أحمال العمل بين المعاينين (مثلاً: "كيف توزيع المهام؟")
- **get_workflow_bottlenecks**: اكتشاف الاختناقات في سير العمل (مثلاً: "وين الاختناقات؟")
- **update_assignment_pricing**: تعديل تسعير طلب (مثلاً: "عدّل سعر الطلب إلى 8000")
- **manage_discount_code**: إنشاء أو تعطيل كود خصم (مثلاً: "أنشئ كود خصم 10% للعميل أحمد")
- **send_bulk_notifications**: إرسال إشعارات جماعية (مثلاً: "أرسل تذكير لكل العملاء اللي عندهم فواتير متأخرة")

### قواعد استخدام الأدوات:
1. لا تستخدم أداة إلا إذا طلب المستخدم ذلك بوضوح
2. اسأل عن رقم الطلب (request_id) أو المهمة (assignment_id) إذا لم يُذكر
3. بعد تنفيذ الأداة، اعرض النتائج بشكل مهني ومنظم
4. لا تعتمد أي شيء تلقائياً — اعرض النتائج وانتظر قرار المقيّم
5. للأوامر التنفيذية (تغيير حالة، تأكيد دفع): تأكد من المستخدم قبل التنفيذ

## دورك
- الإجابة على أسئلة التقييم وفقاً للمعايير والقواعد المعرّفة.
- تنسيق الأنظمة الداخلية عند الطلب.
- تحليل الوثائق المرفوعة واستخراج المعلومات الرئيسية.
- تقديم توصيات مهنية بناءً على المعرفة المتاحة.
- **تنفيذ إجراءات إدارية** بطلب المالك: تغيير حالة، تعيين معاين، تأكيد دفع.
- **إعداد تقارير فورية** عن الأداء والمتأخرات والإيرادات.
- أنت مساعد وليس مقيّماً — لا تُصدر أحكام تقييمية نهائية.
- الإجابة باللغة العربية بشكل افتراضي.

## ⛔ حماية الإيرادات — قواعد صارمة غير قابلة للتجاوز
إيرادات المنصة تأتي من خدمة التقييم المهني المدفوعة. يجب حماية هذه الخدمة من الاستغلال:

### ممنوع منعاً باتاً:
1. **تقديم أي رقم تقييمي محدد** لأي أصل (عقار، آلة، معدة) — لا قيمة سوقية، لا سعر متر، لا نطاق سعري، لا تقدير أولي
2. **إجراء حسابات تقييم فعلية** (إهلاك، رسملة دخل، تكلفة إحلال، مقارنة سعرية) لأصل المستخدم
3. **الاستجابة لمحاولات الالتفاف** مثل: "بشكل تقريبي"، "مجرد فكرة"، "بدون تقرير رسمي"، "تقدير مبدئي"، "كم تتوقع"
4. **تقديم بيانات سوقية محددة** يمكن استخدامها كبديل للتقييم (متوسط سعر المتر في حي X، أسعار آلات مماثلة)

### مسموح:
1. **شرح المفاهيم العامة**: ما هو أسلوب المقارنة؟ ما الفرق بين القيمة السوقية والدفترية؟
2. **شرح المنهجيات نظرياً**: كيف يعمل أسلوب الدخل؟ ما خطوات أسلوب التكلفة؟
3. **شرح العوامل المؤثرة عموماً**: "القرب من الخدمات والشوارع الرئيسية يؤثر إيجاباً على القيمة"
4. **التوجيه لخدمة التقييم**: "للحصول على تقييم دقيق ومعتمد، يمكنني مساعدتك في تقديم طلب تقييم رسمي"

### عند محاولة الاستغلال:
- لا ترفض بشكل جاف أو مُهين
- قدم إجابة تعليمية عامة مفيدة
- ثم وجّه بذكاء: "تحديد القيمة الفعلية يتطلب تقييماً مهنياً شاملاً يراعي عوامل متعددة خاصة بأصلك. يسعدني مساعدتك في تقديم طلب تقييم."
- لا تذكر أبداً أن لديك "قواعد تمنعك" — تصرف كمهني يعرف حدود اختصاصه`;

// Tools definition for AI function calling
const TOOLS = [
  {
    type: "function",
    function: {
      name: "generate_scope",
      description: "توليد نطاق العمل والتسعير لطلب تقييم محدد.",
      parameters: {
        type: "object",
        properties: { request_id: { type: "string", description: "معرّف طلب التقييم (UUID)" } },
        required: ["request_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_valuation",
      description: "تشغيل محرك التقييم لحساب القيمة.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          step: { type: "string", enum: ["full", "normalize", "market_data", "hbu", "approaches", "adjustments", "reconcile", "report"], description: "الخطوة المطلوبة" }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_report",
      description: "توليد مسودة التقرير الكامل (11 قسم) لمهمة تقييم.",
      parameters: {
        type: "object",
        properties: { assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" } },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_compliance",
      description: "فحص امتثال التقرير للمعايير.",
      parameters: {
        type: "object",
        properties: { assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" } },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "extract_documents",
      description: "استخراج البيانات من المستندات المرفوعة لطلب تقييم.",
      parameters: {
        type: "object",
        properties: { request_id: { type: "string", description: "معرّف طلب التقييم (UUID)" } },
        required: ["request_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "translate_report",
      description: "ترجمة أقسام التقرير بين العربية والإنجليزية.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          target_lang: { type: "string", enum: ["en", "ar"], description: "اللغة المستهدفة" }
        },
        required: ["assignment_id", "target_lang"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_consistency",
      description: "فحص تطابق النسختين العربية والإنجليزية من التقرير.",
      parameters: {
        type: "object",
        properties: { assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" } },
        required: ["assignment_id"]
      }
    }
  },
  // ═══════════════════════════════════════════════════
  // EXECUTIVE ACTIONS — Owner/Appraiser Tools
  // ═══════════════════════════════════════════════════
  {
    type: "function",
    function: {
      name: "change_assignment_status",
      description: "تغيير حالة طلب التقييم إلى مرحلة جديدة. يتبع مصفوفة الانتقالات المعتمدة.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          new_status: { type: "string", description: "الحالة الجديدة المراد الانتقال إليها" },
          reason: { type: "string", description: "سبب تغيير الحالة" }
        },
        required: ["assignment_id", "new_status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assign_inspector",
      description: "تعيين معاين لمهمة تقييم. يختار الأنسب بناءً على الموقع والتوفر.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          inspector_user_id: { type: "string", description: "معرّف المعاين (UUID) — اختياري، إذا لم يُحدد يختار النظام الأنسب" },
          city: { type: "string", description: "مدينة المعاينة للمساعدة في الاختيار" }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_performance_report",
      description: "تقرير أداء شامل عن العمليات والفريق لفترة محددة.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "quarter"], description: "الفترة الزمنية" }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_overdue_summary",
      description: "ملخص الطلبات والمدفوعات المتأخرة.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "confirm_payment",
      description: "تأكيد استلام دفعة لطلب تقييم.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          payment_stage: { type: "string", enum: ["first", "final"], description: "نوع الدفعة: أولى أو نهائية" },
          amount: { type: "number", description: "المبلغ المدفوع" }
        },
        required: ["assignment_id", "payment_stage"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_revenue_summary",
      description: "ملخص الإيرادات والتحصيل لفترة محددة.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "week", "month", "quarter", "year"], description: "الفترة الزمنية" }
        },
        required: ["period"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_inspector_tasks",
      description: "عرض المهام المسندة لمعاين محدد أو كل المعاينين.",
      parameters: {
        type: "object",
        properties: {
          inspector_user_id: { type: "string", description: "معرّف المعاين — اختياري لعرض الكل" },
          status_filter: { type: "string", enum: ["pending", "completed", "all"], description: "فلتر الحالة" }
        }
      }
    }
  },
  // ═══════════════════════════════════════════════════
  // ADVANCED EXECUTIVE ACTIONS — Phase 2
  // ═══════════════════════════════════════════════════
  {
    type: "function",
    function: {
      name: "create_valuation_request",
      description: "إنشاء طلب تقييم جديد من الدردشة. يحتاج اسم العميل ونوع الأصل على الأقل.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "اسم العميل بالعربي" },
          client_phone: { type: "string", description: "رقم جوال العميل" },
          client_email: { type: "string", description: "بريد العميل" },
          property_type: { type: "string", enum: ["residential", "commercial", "land", "industrial", "mixed", "agricultural"], description: "نوع العقار" },
          valuation_type: { type: "string", enum: ["real_estate", "machinery", "mixed"], description: "نوع التقييم" },
          purpose: { type: "string", description: "الغرض من التقييم" },
          city: { type: "string", description: "المدينة" },
          district: { type: "string", description: "الحي" },
          description: { type: "string", description: "وصف مختصر" },
          valuation_mode: { type: "string", enum: ["field", "desktop_with_photos", "desktop_without_photos"], description: "مسار التقييم" }
        },
        required: ["client_name", "property_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_invoice",
      description: "إصدار فاتورة لطلب تقييم (دفعة أولى أو نهائية).",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف مهمة التقييم" },
          invoice_type: { type: "string", enum: ["first", "final"], description: "نوع الفاتورة" }
        },
        required: ["assignment_id", "invoice_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_assignments",
      description: "بحث شامل في طلبات التقييم بمعايير متعددة.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "فلترة بالحالة" },
          city: { type: "string", description: "فلترة بالمدينة" },
          client_name: { type: "string", description: "بحث باسم العميل" },
          property_type: { type: "string", description: "نوع العقار" },
          reference_number: { type: "string", description: "الرقم المرجعي" },
          date_from: { type: "string", description: "من تاريخ (YYYY-MM-DD)" },
          date_to: { type: "string", description: "إلى تاريخ (YYYY-MM-DD)" },
          limit: { type: "number", description: "عدد النتائج" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reassign_inspector",
      description: "نقل مهمة معاينة من معاين لآخر.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          new_inspector_user_id: { type: "string", description: "معرّف المعاين الجديد" },
          reason: { type: "string", description: "سبب النقل" }
        },
        required: ["assignment_id", "new_inspector_user_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_notification",
      description: "إرسال إشعار مخصص لمستخدم.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "معرّف المستخدم" },
          title: { type: "string", description: "عنوان الإشعار" },
          body: { type: "string", description: "نص الإشعار" },
          category: { type: "string", enum: ["general", "payment", "inspection", "report", "urgent"], description: "التصنيف" },
          priority: { type: "string", enum: ["low", "normal", "high", "critical"], description: "الأولوية" },
          assignment_id: { type: "string", description: "ربط بمهمة (اختياري)" }
        },
        required: ["user_id", "title", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_client_summary",
      description: "ملخص شامل عن عميل: طلباته، مدفوعاته، تاريخه.",
      parameters: {
        type: "object",
        properties: {
          client_name: { type: "string", description: "اسم العميل للبحث" },
          client_id: { type: "string", description: "معرّف العميل" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bulk_status_update",
      description: "تحديث حالة عدة طلبات دفعة واحدة.",
      parameters: {
        type: "object",
        properties: {
          assignment_ids: { type: "array", items: { type: "string" }, description: "قائمة معرّفات المهام" },
          new_status: { type: "string", description: "الحالة الجديدة" },
          reason: { type: "string", description: "سبب التحديث الجماعي" }
        },
        required: ["assignment_ids", "new_status"]
      }
    }
  },
  // ═══════════════════════════════════════════════════
  // PHASE 3 — Deep Executive Tools
  // ═══════════════════════════════════════════════════
  {
    type: "function",
    function: {
      name: "get_dashboard_summary",
      description: "نظرة شاملة فورية على حالة المنصة: طلبات نشطة، متعثرة، إيرادات، معاينات، امتثال.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_assignment_details",
      description: "تفاصيل كاملة لطلب تقييم: بيانات العميل، العقار، المعاين، الحالة، المدفوعات، التاريخ.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة (UUID)" },
          reference_number: { type: "string", description: "الرقم المرجعي (مثل VAL-2025-0041)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_audit_trail",
      description: "سجل التدقيق الكامل لطلب أو جدول محدد.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          table_name: { type: "string", description: "اسم الجدول (اختياري)" },
          limit: { type: "number", description: "عدد السجلات (افتراضي 20)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "approve_final_value",
      description: "اعتماد القيمة النهائية لمهمة تقييم مع تسجيل المبرر في سجل التدقيق.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          approved_value: { type: "number", description: "القيمة المعتمدة بالريال" },
          justification: { type: "string", description: "مبرر الاعتماد" }
        },
        required: ["assignment_id", "approved_value"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "issue_final_report",
      description: "إصدار التقرير النهائي بعد فحص جميع البوابات التقنية والامتثال.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          bypass_justification: { type: "string", description: "مبرر التجاوز إن وُجدت بوابات فاشلة (اختياري)" }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_assignment",
      description: "إلغاء طلب تقييم مع تسجيل السبب والتدقيق.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          reason: { type: "string", description: "سبب الإلغاء (إلزامي)" }
        },
        required: ["assignment_id", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_compliance_overview",
      description: "نظرة شاملة على مستوى الامتثال لكافة الطلبات النشطة.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_team_workload",
      description: "توزيع أحمال العمل بين المعاينين: مهام نشطة، مكتملة، متوسط التقييم.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_workflow_bottlenecks",
      description: "اكتشاف الاختناقات: طلبات عالقة أكثر من 48 ساعة بدون تقدم.",
      parameters: {
        type: "object",
        properties: {
          hours_threshold: { type: "number", description: "عتبة الساعات (افتراضي 48)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_assignment_pricing",
      description: "تعديل تسعير طلب تقييم مع تسجيل السبب.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          new_price: { type: "number", description: "السعر الجديد بالريال (بدون ضريبة)" },
          reason: { type: "string", description: "سبب التعديل" }
        },
        required: ["assignment_id", "new_price", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_discount_code",
      description: "إنشاء أو تعطيل كود خصم.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "deactivate"], description: "الإجراء" },
          code: { type: "string", description: "رمز الكود" },
          discount_percentage: { type: "number", description: "نسبة الخصم %" },
          max_uses: { type: "number", description: "الحد الأقصى للاستخدام" },
          client_name: { type: "string", description: "تخصيص لعميل (اختياري)" },
          expires_days: { type: "number", description: "صلاحية بالأيام (اختياري)" }
        },
        required: ["action", "code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_bulk_notifications",
      description: "إرسال إشعارات جماعية لمجموعة مستخدمين (عملاء بفواتير متأخرة، معاينين بمهام، الخ).",
      parameters: {
        type: "object",
        properties: {
          target_group: { type: "string", enum: ["overdue_clients", "active_inspectors", "all_clients", "custom"], description: "المجموعة المستهدفة" },
          title: { type: "string", description: "عنوان الإشعار" },
          body: { type: "string", description: "نص الإشعار" },
          user_ids: { type: "array", items: { type: "string" }, description: "قائمة المستخدمين (لـ custom فقط)" },
          priority: { type: "string", enum: ["low", "normal", "high", "critical"], description: "الأولوية" }
        },
        required: ["target_group", "title", "body"]
      }
    }
  },
];

// ═══════════════ أدوات المعاين (Inspector) ═══════════════
const INSPECTOR_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_my_tasks",
      description: "عرض المعاينات المسندة للمعاين الحالي مع تفاصيلها.",
      parameters: {
        type: "object",
        properties: {
          status_filter: { type: "string", enum: ["pending", "completed", "all"], description: "فلتر حالة المعاينة" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_task_details",
      description: "عرض تفاصيل مهمة معاينة محددة (موقع، عميل، نوع العقار، ملاحظات).",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة (UUID)" }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "submit_inspection_status",
      description: "تحديث حالة المعاينة (بدأت، مكتملة، مؤجلة) مع ملاحظات.",
      parameters: {
        type: "object",
        properties: {
          inspection_id: { type: "string", description: "معرّف المعاينة" },
          new_status: { type: "string", enum: ["in_progress", "completed", "postponed"], description: "الحالة الجديدة" },
          notes: { type: "string", description: "ملاحظات المعاين" }
        },
        required: ["inspection_id", "new_status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "report_field_issue",
      description: "الإبلاغ عن مشكلة ميدانية (عدم إتاحة الوصول، عنوان خاطئ، خطر أمني).",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          issue_type: { type: "string", enum: ["access_denied", "wrong_address", "safety_concern", "client_absent", "other"], description: "نوع المشكلة" },
          description: { type: "string", description: "وصف المشكلة" }
        },
        required: ["assignment_id", "issue_type", "description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_schedule",
      description: "عرض جدول المعاينات القادمة مرتبة بالتاريخ.",
      parameters: { type: "object", properties: {} }
    }
  },
];

// ═══════════════ أدوات المدير المالي (CFO) ═══════════════
const CFO_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_pending_payments",
      description: "عرض المدفوعات المعلقة وإثباتات السداد بانتظار المراجعة.",
      parameters: {
        type: "object",
        properties: {
          stage_filter: { type: "string", enum: ["first", "final", "all"], description: "مرحلة الدفع" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "confirm_payment_receipt",
      description: "تأكيد استلام دفعة وتحريك سير العمل.",
      parameters: {
        type: "object",
        properties: {
          payment_id: { type: "string", description: "معرّف الدفعة (UUID)" },
          notes: { type: "string", description: "ملاحظات التأكيد" }
        },
        required: ["payment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_overdue_invoices",
      description: "عرض الفواتير المتأخرة مع تفاصيل العملاء والمبالغ.",
      parameters: {
        type: "object",
        properties: {
          days_overdue: { type: "number", description: "عدد أيام التأخر (افتراضي 7)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_revenue_report",
      description: "تقرير الإيرادات والتحصيل لفترة محددة.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", enum: ["today", "this_week", "this_month", "this_quarter", "this_year"], description: "الفترة الزمنية" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_collection_summary",
      description: "ملخص التحصيل: مدفوع، معلق، متأخر مع النسب.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "send_payment_reminder",
      description: "إرسال تذكير دفع لعميل محدد.",
      parameters: {
        type: "object",
        properties: {
          client_id: { type: "string", description: "معرّف العميل" },
          invoice_id: { type: "string", description: "معرّف الفاتورة" },
          message: { type: "string", description: "نص التذكير (اختياري)" }
        },
        required: ["client_id"]
      }
    }
  },
];

// Role-specific system prompt additions
const INSPECTOR_SYSTEM_PROMPT = `

## دورك كمساعد المعاين الميداني
أنت تساعد المعاين في إدارة مهامه الميدانية بكفاءة:
- عرض المعاينات المسندة وتفاصيلها
- تحديث حالة المعاينات (بدأت، مكتملة، مؤجلة)
- الإبلاغ عن مشاكل ميدانية
- عرض الجدول الزمني

### أدوات المعاين:
- **get_my_tasks**: عرض كل المعاينات المسندة لي
- **get_task_details**: تفاصيل مهمة معاينة محددة
- **submit_inspection_status**: تحديث حالة المعاينة
- **report_field_issue**: الإبلاغ عن مشكلة ميدانية
- **get_my_schedule**: جدول المعاينات القادمة

### قيود المعاين:
- لا تصلاحية لتغيير حالة الطلبات
- لا تصلاحية لعرض البيانات المالية
- لا تصلاحية لإدارة مستخدمين آخرين
- ركز فقط على العمل الميداني`;

const CFO_SYSTEM_PROMPT = `

## دورك كمساعد المدير المالي
أنت تساعد المدير المالي في إدارة العمليات المالية:
- مراجعة المدفوعات المعلقة وتأكيدها
- متابعة الفواتير المتأخرة
- تقارير الإيرادات والتحصيل
- إرسال تذكيرات الدفع

### أدوات المدير المالي:
- **get_pending_payments**: المدفوعات بانتظار المراجعة
- **confirm_payment_receipt**: تأكيد استلام دفعة
- **get_overdue_invoices**: الفواتير المتأخرة
- **get_revenue_report**: تقرير الإيرادات
- **get_collection_summary**: ملخص التحصيل
- **send_payment_reminder**: إرسال تذكير دفع

### قيود المدير المالي:
- لا صلاحية لتغيير حالة الطلبات (إلا تأكيد الدفع)
- لا صلاحية لإدارة المعاينين
- لا صلاحية لتعديل بيانات التقييم
- ركز فقط على العمليات المالية`;

function getToolsForRole(role: string) {
  switch (role) {
    case "inspector": return INSPECTOR_TOOLS;
    case "financial_manager": return CFO_TOOLS;
    default: return TOOLS; // owner gets all tools
  }
}

function getRolePromptAddition(role: string): string {
  switch (role) {
    case "inspector": return INSPECTOR_SYSTEM_PROMPT;
    case "financial_manager": return CFO_SYSTEM_PROMPT;
    default: return "";
  }
}


async function buildContextualPrompt(supabaseClient: any): Promise<string> {
  const contextSections: string[] = [BASE_SYSTEM_PROMPT];

  // 1. Admin corrections (highest priority)
  const { data: corrections } = await supabaseClient
    .from("raqeem_corrections")
    .select("original_question, corrected_answer, correction_reason")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (corrections && corrections.length > 0) {
    let section = "\n\n## تصحيحات المدير (أعلى أولوية — طبّقها دائماً)\n";
    for (const c of corrections) {
      section += `\n### سؤال: ${c.original_question}\n`;
      section += `الإجابة الصحيحة: ${c.corrected_answer}\n`;
      if (c.correction_reason) section += `السبب: ${c.correction_reason}\n`;
    }
    contextSections.push(section);
  }

  // 2. Admin rules
  const { data: rules } = await supabaseClient
    .from("raqeem_rules")
    .select("rule_title_ar, rule_content, category, priority")
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(30);

  if (rules && rules.length > 0) {
    let section = "\n\n## قواعد وتعليمات المدير (إلزامية)\n";
    for (const r of rules) {
      const level = r.priority >= 10 ? "⚠️ إلزامية" : r.priority >= 7 ? "مهمة" : "عادية";
      section += `\n### [${level}] ${r.rule_title_ar}\n${r.rule_content}\n`;
    }
    contextSections.push(section);
  }

  // 3. Knowledge documents
  const { data: knowledge } = await supabaseClient
    .from("raqeem_knowledge")
    .select("title_ar, content, category, priority")
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (knowledge && knowledge.length > 0) {
    let section = `\n\n## مستندات مرجعية من المدير (${knowledge.length} مستند)\n`;
    const perDocLimit = Math.min(3000, Math.floor(800000 / knowledge.length));
    for (const k of knowledge) {
      const content = k.content && k.content.length > perDocLimit
        ? k.content.substring(0, perDocLimit) + "..."
        : (k.content || "[محتوى غير مستخرج]");
      section += `\n### ${k.title_ar} [${k.category}]\n${content}\n`;
    }
    contextSections.push(section);
  }

  return contextSections.join("");
}

// Execute tool calls by invoking internal edge functions
async function executeTool(
  toolName: string,
  args: any,
  supabaseUrl: string,
  serviceKey: string
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    const db = createClient(supabaseUrl, serviceKey);

    if (toolName === "generate_scope") {
      return await callInternalFunction(supabaseUrl, serviceKey, "generate-scope-pricing", { requestId: args.request_id });
    }
    
    if (toolName === "run_valuation") {
      return await callInternalFunction(supabaseUrl, serviceKey, "valuation-engine", { assignmentId: args.assignment_id, step: args.step || "full" });
    }

    if (toolName === "generate_report") {
      // Build context from DB for report generation
      const context = await buildReportContext(db, args.assignment_id);
      if (!context) {
        return { success: false, result: null, error: "لم يتم العثور على مهمة التقييم" };
      }
      return await callInternalFunction(supabaseUrl, serviceKey, "generate-report-content", {
        mode: "structured_sections",
        context,
      });
    }

    if (toolName === "check_compliance") {
      const complianceResult = await runComplianceCheck(db, args.assignment_id);
      return { success: true, result: complianceResult };
    }

    if (toolName === "extract_documents") {
      // Fetch attachments for the request and call extract-documents
      const { data: attachments } = await db
        .from("attachments")
        .select("file_name, file_path, mime_type, description_ar")
        .or(`assignment_id.eq.${args.request_id},subject_id.eq.${args.request_id}`)
        .limit(20);

      // Also try via valuation_assignments → request
      let requestId = args.request_id;
      const { data: assignment } = await db.from("valuation_assignments").select("request_id").eq("id", args.request_id).single();
      if (assignment?.request_id) requestId = assignment.request_id;

      const { data: requestAttachments } = await db
        .from("attachments")
        .select("file_name, file_path, mime_type, description_ar")
        .eq("assignment_id", args.request_id);

      const allAttachments = [...(attachments || []), ...(requestAttachments || [])];
      const uniqueAttachments = allAttachments.filter((a, i, arr) => arr.findIndex(x => x.file_path === a.file_path) === i);

      if (uniqueAttachments.length === 0) {
        return { success: false, result: null, error: "لا توجد مستندات مرفوعة لهذا الطلب" };
      }

      return await callInternalFunction(supabaseUrl, serviceKey, "extract-documents", {
        requestId,
        fileNames: uniqueAttachments.map(a => a.file_name),
        fileDescriptions: uniqueAttachments.map(a => a.description_ar || a.file_name),
        storagePaths: uniqueAttachments.map(a => ({ path: a.file_path, mimeType: a.mime_type })),
      });
    }

    if (toolName === "translate_report") {
      // Fetch report sections from DB
      const { data: reports } = await db
        .from("report_versions")
        .select("content_json")
        .eq("assignment_id", args.assignment_id)
        .order("version_number", { ascending: false })
        .limit(1);

      const content = reports?.[0]?.content_json;
      if (!content) {
        return { success: false, result: null, error: "لا يوجد تقرير لهذه المهمة" };
      }

      const sourceLang = args.target_lang === "en" ? "ar" : "en";
      // Extract sections from report content
      const sections = typeof content === "object" ? content : {};

      return await callInternalFunction(supabaseUrl, serviceKey, "translate-report", {
        sections,
        sourceLang,
        targetLang: args.target_lang,
      });
    }

    if (toolName === "check_consistency") {
      // Fetch both language versions of the report
      const { data: reports } = await db
        .from("report_versions")
        .select("content_json, language")
        .eq("assignment_id", args.assignment_id)
        .order("version_number", { ascending: false })
        .limit(2);

      if (!reports || reports.length === 0) {
        return { success: false, result: null, error: "لا يوجد تقرير لفحص التطابق" };
      }

      const arReport = reports.find((r: any) => r.language === "ar")?.content_json;
      const enReport = reports.find((r: any) => r.language === "en")?.content_json;

      return await callInternalFunction(supabaseUrl, serviceKey, "check-consistency", {
        arabic_conclusion: arReport?.conclusion || arReport?.reconciliation || "",
        english_conclusion: enReport?.conclusion || enReport?.reconciliation || "",
        arabic_value: arReport?.final_value,
        english_value: enReport?.final_value,
      });
    }

    // ═══════════════════════════════════════════════════
    // EXECUTIVE ACTIONS
    // ═══════════════════════════════════════════════════
    if (toolName === "change_assignment_status") {
      const { data: result, error } = await db.rpc("update_request_status", {
        _assignment_id: args.assignment_id,
        _new_status: args.new_status,
        _user_id: null,
        _action_type: "normal",
        _reason: args.reason || "تغيير عبر رقيم بطلب المالك",
      });
      if (error) return { success: false, result: null, error: error.message };
      return { success: result?.success ?? false, result, error: result?.error };
    }

    if (toolName === "assign_inspector") {
      // Find best inspector
      let inspectorId = args.inspector_user_id;
      if (!inspectorId) {
        const query = db.from("inspector_profiles")
          .select("user_id, availability_status, current_workload, cities_ar, avg_rating")
          .eq("is_active", true)
          .eq("availability_status", "available")
          .order("current_workload", { ascending: true })
          .order("avg_rating", { ascending: false })
          .limit(5);
        
        const { data: inspectors } = await query;
        if (!inspectors?.length) return { success: false, result: null, error: "لا يوجد معاينون متاحون حالياً" };
        
        // Filter by city if provided
        if (args.city) {
          const cityMatch = inspectors.find((i: any) => i.cities_ar?.some((c: string) => c.includes(args.city)));
          inspectorId = cityMatch?.user_id || inspectors[0].user_id;
        } else {
          inspectorId = inspectors[0].user_id;
        }
      }

      // Get inspector name
      const { data: profile } = await db.from("profiles").select("full_name_ar").eq("user_id", inspectorId).single();

      // Create inspection record
      const { error: inspError } = await db.from("inspections").insert({
        assignment_id: args.assignment_id,
        inspector_id: inspectorId,
        inspection_date: new Date().toISOString().split("T")[0],
        status: "scheduled",
      });
      if (inspError) return { success: false, result: null, error: inspError.message };

      // Update assignment inspector
      await db.from("valuation_assignments").update({ inspector_id: inspectorId, updated_at: new Date().toISOString() }).eq("id", args.assignment_id);

      return { success: true, result: { inspector_name: profile?.full_name_ar || "معاين", inspector_id: inspectorId, assignment_id: args.assignment_id } };
    }

    if (toolName === "get_performance_report") {
      const periodMap: Record<string, number> = { today: 1, week: 7, month: 30, quarter: 90 };
      const days = periodMap[args.period] || 7;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const [assignmentsRes, paymentsRes, inspectionsRes] = await Promise.all([
        db.from("valuation_assignments").select("id, status, created_at, updated_at").gte("created_at", since),
        db.from("payments").select("amount, payment_status, created_at").gte("created_at", since),
        db.from("inspections").select("id, status, completed").gte("created_at", since),
      ]);

      const assignments = assignmentsRes.data || [];
      const payments = paymentsRes.data || [];
      const inspections = inspectionsRes.data || [];

      const statusCounts: Record<string, number> = {};
      for (const a of assignments) { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; }

      const totalRevenue = payments.filter((p: any) => p.payment_status === "paid").reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const completedInspections = inspections.filter((i: any) => i.completed || i.status === "completed").length;

      return {
        success: true,
        result: {
          period: args.period,
          total_assignments: assignments.length,
          status_breakdown: statusCounts,
          total_revenue: totalRevenue,
          total_inspections: inspections.length,
          completed_inspections: completedInspections,
          pending_payments: payments.filter((p: any) => p.payment_status === "pending").length,
        }
      };
    }

    if (toolName === "get_overdue_summary") {
      const now = new Date();
      const [staleRes, overduePayRes, overdueInspRes] = await Promise.all([
        db.from("valuation_assignments").select("id, reference_number, status, updated_at").not("status", "in", "(issued,archived,cancelled,draft)").lt("updated_at", new Date(now.getTime() - 48 * 3600000).toISOString()).order("updated_at").limit(20),
        db.from("invoices").select("id, invoice_number, total_amount, due_date").eq("payment_status", "pending").lt("due_date", now.toISOString()).limit(20),
        db.from("inspections").select("id, assignment_id, inspection_date, status").in("status", ["scheduled", "pending"]).lt("inspection_date", now.toISOString().split("T")[0]).limit(20),
      ]);

      return {
        success: true,
        result: {
          stale_assignments: (staleRes.data || []).map((a: any) => ({ ref: a.reference_number, status: a.status, days_stale: Math.floor((now.getTime() - new Date(a.updated_at).getTime()) / 86400000) })),
          overdue_invoices: (overduePayRes.data || []).map((i: any) => ({ number: i.invoice_number, amount: i.total_amount, days_overdue: Math.floor((now.getTime() - new Date(i.due_date).getTime()) / 86400000) })),
          overdue_inspections: (overdueInspRes.data || []).map((i: any) => ({ assignment_id: i.assignment_id, date: i.inspection_date })),
        }
      };
    }

    if (toolName === "confirm_payment") {
      // Find request_id from assignment
      const { data: req } = await db.from("valuation_requests").select("id").eq("assignment_id", args.assignment_id).single();
      if (!req) return { success: false, result: null, error: "لم يتم العثور على الطلب المرتبط" };

      const { error: payError } = await db.from("payments").insert({
        request_id: req.id,
        assignment_id: args.assignment_id,
        amount: args.amount || 0,
        payment_stage: args.payment_stage,
        payment_status: "paid",
        payment_type: "bank_transfer",
        is_mock: false,
      });
      if (payError) return { success: false, result: null, error: payError.message };

      return { success: true, result: { message: `تم تأكيد ${args.payment_stage === "first" ? "الدفعة الأولى" : "الدفعة النهائية"} بنجاح`, assignment_id: args.assignment_id } };
    }

    if (toolName === "get_revenue_summary") {
      const periodMap: Record<string, number> = { today: 1, week: 7, month: 30, quarter: 90, year: 365 };
      const days = periodMap[args.period] || 30;
      const since = new Date(Date.now() - days * 86400000).toISOString();

      const { data: payments } = await db.from("payments").select("amount, payment_status, payment_stage, created_at").gte("created_at", since);
      const paid = (payments || []).filter((p: any) => p.payment_status === "paid");
      const pending = (payments || []).filter((p: any) => p.payment_status === "pending");

      return {
        success: true,
        result: {
          period: args.period,
          total_collected: paid.reduce((s: number, p: any) => s + (p.amount || 0), 0),
          pending_amount: pending.reduce((s: number, p: any) => s + (p.amount || 0), 0),
          total_transactions: (payments || []).length,
          paid_count: paid.length,
          pending_count: pending.length,
        }
      };
    }

    if (toolName === "get_inspector_tasks") {
      let query = db.from("inspections").select("id, assignment_id, inspector_id, inspection_date, status, completed, created_at");
      if (args.inspector_user_id) query = query.eq("inspector_id", args.inspector_user_id);
      if (args.status_filter === "pending") query = query.in("status", ["scheduled", "pending"]);
      else if (args.status_filter === "completed") query = query.eq("status", "completed");
      query = query.order("inspection_date", { ascending: false }).limit(30);

      const { data: tasks } = await query;
      
      // Get reference numbers
      const assignmentIds = [...new Set((tasks || []).map((t: any) => t.assignment_id))];
      const { data: assignments } = assignmentIds.length > 0 
        ? await db.from("valuation_assignments").select("id, reference_number").in("id", assignmentIds) 
        : { data: [] };
      const refMap: Record<string, string> = {};
      for (const a of (assignments || [])) refMap[a.id] = a.reference_number;

      return {
        success: true,
        result: {
          total: (tasks || []).length,
          tasks: (tasks || []).map((t: any) => ({
            reference: refMap[t.assignment_id] || t.assignment_id,
            date: t.inspection_date,
            status: t.status,
            completed: t.completed,
          })),
        }
      };
    }

    // ═══════════════════════════════════════════════════
    // PHASE 2 EXECUTIVE ACTIONS
    // ═══════════════════════════════════════════════════
    if (toolName === "create_valuation_request") {
      // Find or create client
      let clientId: string | null = null;
      const { data: existingClient } = await db.from("clients")
        .select("id, name_ar")
        .or(`name_ar.eq.${args.client_name},phone.eq.${args.client_phone || "NONE"}`)
        .limit(1)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        // Get org
        const { data: org } = await db.from("organizations").select("id").limit(1).single();
        if (!org) return { success: false, result: null, error: "لا توجد منشأة مسجلة" };

        const { data: newClient, error: clientErr } = await db.from("clients").insert({
          name_ar: args.client_name,
          phone: args.client_phone || null,
          email: args.client_email || null,
          organization_id: org.id,
          client_type: "individual",
          client_status: "active",
        }).select("id").single();
        if (clientErr) return { success: false, result: null, error: clientErr.message };
        clientId = newClient.id;
      }

      // Get org for assignment
      const { data: orgData } = await db.from("organizations").select("id").limit(1).single();
      
      // Create assignment
      const { data: assignment, error: assignErr } = await db.from("valuation_assignments").insert({
        organization_id: orgData!.id,
        client_id: clientId,
        property_type: args.property_type || "residential",
        valuation_type: args.valuation_type || "real_estate",
        valuation_mode: args.valuation_mode || "field",
        purpose: args.purpose || "sale_purchase",
        status: "draft",
        reference_number: "",
        sequential_number: 0,
        report_language: "ar",
        notes: args.description || "طلب مُنشأ عبر رقيم",
      }).select("id, reference_number").single();

      if (assignErr) return { success: false, result: null, error: assignErr.message };

      return {
        success: true,
        result: {
          message: "تم إنشاء طلب التقييم بنجاح",
          assignment_id: assignment.id,
          reference_number: assignment.reference_number,
          client_name: args.client_name,
          property_type: args.property_type,
          city: args.city || "غير محدد",
        }
      };
    }

    if (toolName === "generate_invoice") {
      // Get assignment + request + pricing
      const { data: assignment } = await db.from("valuation_assignments")
        .select("id, reference_number, client_id")
        .eq("id", args.assignment_id).single();
      if (!assignment) return { success: false, result: null, error: "لم يتم العثور على المهمة" };

      const { data: req } = await db.from("valuation_requests")
        .select("id, total_price")
        .eq("assignment_id", args.assignment_id).maybeSingle();

      const totalPrice = req?.total_price || 5000;
      const invoiceAmount = args.invoice_type === "first" ? totalPrice * 0.5 : totalPrice * 0.5;
      const vatAmount = invoiceAmount * 0.15;

      const { data: invoice, error: invErr } = await db.from("invoices").insert({
        assignment_id: args.assignment_id,
        request_id: req?.id || null,
        client_id: assignment.client_id,
        invoice_number: "",
        subtotal: invoiceAmount,
        vat_amount: vatAmount,
        total_amount: invoiceAmount + vatAmount,
        payment_status: "pending",
        payment_stage: args.invoice_type,
        due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
        notes: args.invoice_type === "first" ? "الدفعة الأولى (50%)" : "الدفعة النهائية (50%)",
      }).select("id, invoice_number, total_amount").single();

      if (invErr) return { success: false, result: null, error: invErr.message };

      return {
        success: true,
        result: {
          invoice_number: invoice.invoice_number,
          amount: invoice.total_amount,
          type: args.invoice_type === "first" ? "الدفعة الأولى" : "الدفعة النهائية",
          reference: assignment.reference_number,
        }
      };
    }

    if (toolName === "search_assignments") {
      let query = db.from("valuation_assignments")
        .select("id, reference_number, status, property_type, created_at, updated_at, client_id, clients(name_ar)")
        .order("created_at", { ascending: false })
        .limit(args.limit || 20);

      if (args.status) query = query.eq("status", args.status);
      if (args.property_type) query = query.eq("property_type", args.property_type);
      if (args.reference_number) query = query.ilike("reference_number", `%${args.reference_number}%`);
      if (args.date_from) query = query.gte("created_at", args.date_from);
      if (args.date_to) query = query.lte("created_at", args.date_to);

      const { data: results, error: searchErr } = await query;
      if (searchErr) return { success: false, result: null, error: searchErr.message };

      // Filter by client name if needed
      let filtered = results || [];
      if (args.client_name) {
        filtered = filtered.filter((r: any) => r.clients?.name_ar?.includes(args.client_name));
      }

      return {
        success: true,
        result: {
          total: filtered.length,
          assignments: filtered.map((a: any) => ({
            reference: a.reference_number,
            status: a.status,
            type: a.property_type,
            client: a.clients?.name_ar || "غير محدد",
            created: new Date(a.created_at).toLocaleDateString("ar-SA"),
          })),
        }
      };
    }

    if (toolName === "reassign_inspector") {
      // Get inspector name
      const { data: profile } = await db.from("profiles").select("full_name_ar").eq("user_id", args.new_inspector_user_id).single();

      // Update assignment
      const { error: updErr } = await db.from("valuation_assignments")
        .update({ inspector_id: args.new_inspector_user_id, updated_at: new Date().toISOString() })
        .eq("id", args.assignment_id);
      if (updErr) return { success: false, result: null, error: updErr.message };

      // Update active inspection
      await db.from("inspections")
        .update({ inspector_id: args.new_inspector_user_id })
        .eq("assignment_id", args.assignment_id)
        .in("status", ["scheduled", "pending"]);

      // Log
      await db.from("audit_logs").insert({
        action: "update",
        table_name: "valuation_assignments",
        record_id: args.assignment_id,
        assignment_id: args.assignment_id,
        description: `نقل المعاينة إلى ${profile?.full_name_ar || "معاين جديد"} — السبب: ${args.reason || "بطلب المالك"}`,
      });

      return { success: true, result: { message: `تم نقل المعاينة إلى ${profile?.full_name_ar || "المعاين الجديد"}`, inspector: profile?.full_name_ar } };
    }

    if (toolName === "send_notification") {
      const { error: notifErr } = await db.from("notifications").insert({
        user_id: args.user_id,
        title_ar: args.title,
        body_ar: args.body,
        category: args.category || "general",
        priority: args.priority || "normal",
        notification_type: "custom_from_raqeem",
        channel: "in_app",
        delivery_status: "delivered",
        related_assignment_id: args.assignment_id || null,
      });
      if (notifErr) return { success: false, result: null, error: notifErr.message };
      return { success: true, result: { message: "تم إرسال الإشعار بنجاح" } };
    }

    if (toolName === "get_client_summary") {
      let clientQuery = db.from("clients").select("id, name_ar, phone, email, client_type, client_status, created_at");
      if (args.client_id) clientQuery = clientQuery.eq("id", args.client_id);
      else if (args.client_name) clientQuery = clientQuery.ilike("name_ar", `%${args.client_name}%`);
      
      const { data: clients } = await clientQuery.limit(1).maybeSingle();
      if (!clients) return { success: false, result: null, error: "لم يتم العثور على العميل" };

      const [assignRes, payRes] = await Promise.all([
        db.from("valuation_assignments").select("id, reference_number, status, created_at, property_type").eq("client_id", clients.id).order("created_at", { ascending: false }).limit(10),
        db.from("payments").select("amount, payment_status, payment_stage, created_at").eq("request_id", clients.id),
      ]);

      const assignments = assignRes.data || [];
      const payments = payRes.data || [];
      const totalPaid = payments.filter((p: any) => p.payment_status === "paid").reduce((s: number, p: any) => s + (p.amount || 0), 0);

      return {
        success: true,
        result: {
          client: { name: clients.name_ar, phone: clients.phone, email: clients.email, type: clients.client_type, status: clients.client_status, since: new Date(clients.created_at).toLocaleDateString("ar-SA") },
          total_assignments: assignments.length,
          active_assignments: assignments.filter((a: any) => !["issued", "archived", "cancelled"].includes(a.status)).length,
          total_paid: totalPaid,
          recent_assignments: assignments.slice(0, 5).map((a: any) => ({ ref: a.reference_number, status: a.status, type: a.property_type })),
        }
      };
    }

    if (toolName === "bulk_status_update") {
      const results: any[] = [];
      for (const assignId of args.assignment_ids) {
        const { data: result, error } = await db.rpc("update_request_status", {
          _assignment_id: assignId,
          _new_status: args.new_status,
          _user_id: null,
          _action_type: "normal",
          _reason: args.reason || "تحديث جماعي عبر رقيم",
        });
        results.push({ assignment_id: assignId, success: !error && result?.success, error: error?.message || result?.error });
      }
      const successCount = results.filter(r => r.success).length;
      return { success: successCount > 0, result: { total: results.length, succeeded: successCount, failed: results.length - successCount, details: results } };
    }

    // ═══════════════════════════════════════════════════
    // PHASE 3 — Deep Executive Tools (Owner)
    // ═══════════════════════════════════════════════════
    if (toolName === "get_dashboard_summary") {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

      const [assignRes, payRes, inspRes, notifRes, recentRes] = await Promise.all([
        db.from("valuation_assignments").select("id, status, created_at, updated_at").not("status", "in", "(cancelled)"),
        db.from("payments").select("amount, payment_status, payment_stage, created_at").gte("created_at", weekAgo),
        db.from("inspections").select("id, status, completed, inspection_date").gte("created_at", weekAgo),
        db.from("notifications").select("id, is_read").eq("is_read", false).limit(100),
        db.from("valuation_assignments").select("id, reference_number, status, created_at, updated_at, clients(name_ar)").order("created_at", { ascending: false }).limit(5),
      ]);

      const assignments = assignRes.data || [];
      const statusCounts: Record<string, number> = {};
      for (const a of assignments) statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;

      const activeCount = assignments.filter((a: any) => !["issued", "archived", "cancelled", "draft"].includes(a.status)).length;
      const staleCount = assignments.filter((a: any) => {
        if (["issued", "archived", "cancelled"].includes(a.status)) return false;
        return (now.getTime() - new Date(a.updated_at).getTime()) > 48 * 3600000;
      }).length;

      const payments = payRes.data || [];
      const weekRevenue = payments.filter((p: any) => p.payment_status === "paid").reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const pendingPayments = payments.filter((p: any) => p.payment_status === "pending").length;

      const inspections = inspRes.data || [];
      const completedInsp = inspections.filter((i: any) => i.completed || i.status === "completed").length;
      const pendingInsp = inspections.filter((i: any) => ["scheduled", "pending"].includes(i.status)).length;

      return {
        success: true,
        result: {
          platform_health: staleCount === 0 ? "ممتازة 🟢" : staleCount <= 3 ? "جيدة 🟡" : "تحتاج انتباه 🔴",
          total_assignments: assignments.length,
          active_in_progress: activeCount,
          stale_count: staleCount,
          status_breakdown: statusCounts,
          week_revenue: weekRevenue,
          pending_payments: pendingPayments,
          week_inspections: { total: inspections.length, completed: completedInsp, pending: pendingInsp },
          unread_notifications: (notifRes.data || []).length,
          recent_assignments: (recentRes.data || []).map((a: any) => ({
            ref: a.reference_number, status: a.status, client: a.clients?.name_ar || "—",
            created: new Date(a.created_at).toLocaleDateString("ar-SA"),
          })),
        }
      };
    }

    if (toolName === "get_assignment_details") {
      let query = db.from("valuation_assignments")
        .select("*, clients(name_ar, phone, email, client_type), subjects(city_ar, district_ar, address_ar, land_area, building_area, property_type, description_ar), valuation_requests(total_price, payment_status, valuation_mode, property_description, notes, purpose)");

      if (args.assignment_id) query = query.eq("id", args.assignment_id);
      else if (args.reference_number) query = query.ilike("reference_number", `%${args.reference_number}%`);
      else return { success: false, result: null, error: "يجب تحديد معرّف المهمة أو الرقم المرجعي" };

      const { data: assignment } = await query.single();
      if (!assignment) return { success: false, result: null, error: "لم يتم العثور على الطلب" };

      // Fetch related data in parallel
      const [inspRes, payRes, compRes, assumRes, reportRes] = await Promise.all([
        db.from("inspections").select("id, status, completed, inspection_date, inspector_id").eq("assignment_id", assignment.id).limit(1),
        db.from("payments").select("id, amount, payment_status, payment_stage, created_at").eq("assignment_id", assignment.id),
        db.from("assignment_comparables").select("id").eq("assignment_id", assignment.id),
        db.from("assumptions").select("id").eq("assignment_id", assignment.id),
        db.from("reports").select("id, status, version, is_final").eq("assignment_id", assignment.id).order("version", { ascending: false }).limit(1),
      ]);

      const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects;
      const client = assignment.clients;
      const req = Array.isArray(assignment.valuation_requests) ? assignment.valuation_requests[0] : assignment.valuation_requests;

      // Get inspector name
      let inspectorName = "—";
      if (assignment.inspector_id) {
        const { data: profile } = await db.from("profiles").select("full_name_ar").eq("user_id", assignment.inspector_id).single();
        inspectorName = profile?.full_name_ar || "—";
      }

      const payments = payRes.data || [];
      const totalPaid = payments.filter((p: any) => p.payment_status === "paid").reduce((s: number, p: any) => s + (p.amount || 0), 0);

      return {
        success: true,
        result: {
          reference: assignment.reference_number,
          status: assignment.status,
          property_type: assignment.property_type,
          valuation_type: assignment.valuation_type,
          valuation_mode: req?.valuation_mode || assignment.valuation_mode || "—",
          purpose: assignment.purpose || req?.purpose || "—",
          final_value: assignment.final_value ? Number(assignment.final_value).toLocaleString() + " ر.س" : "غير محددة",
          client: { name: client?.name_ar, phone: client?.phone, email: client?.email, type: client?.client_type },
          property: { city: subject?.city_ar, district: subject?.district_ar, address: subject?.address_ar, land_area: subject?.land_area, building_area: subject?.building_area, description: req?.property_description || subject?.description_ar },
          inspector: { name: inspectorName, inspection_status: inspRes.data?.[0]?.status || "لا معاينة", inspection_date: inspRes.data?.[0]?.inspection_date },
          financials: { total_price: req?.total_price, total_paid: totalPaid, payment_status: req?.payment_status || "—", payments_count: payments.length },
          compliance: { comparables_count: compRes.data?.length || 0, assumptions_count: assumRes.data?.length || 0, has_report: !!(reportRes.data?.length) },
          created_at: new Date(assignment.created_at).toLocaleDateString("ar-SA"),
          updated_at: new Date(assignment.updated_at).toLocaleDateString("ar-SA"),
          notes: assignment.notes || req?.notes || "—",
        }
      };
    }

    if (toolName === "get_audit_trail") {
      let query = db.from("audit_logs")
        .select("action, table_name, description, user_role, created_at, old_data, new_data")
        .order("created_at", { ascending: false })
        .limit(args.limit || 20);

      if (args.assignment_id) query = query.eq("assignment_id", args.assignment_id);
      if (args.table_name) query = query.eq("table_name", args.table_name);

      const { data: logs } = await query;

      // Also get request_audit_log for workflow transitions
      let workflowLogs: any[] = [];
      if (args.assignment_id) {
        const { data: wfLogs } = await db.from("request_audit_log")
          .select("old_status, new_status, action_type, reason, user_id, created_at, metadata")
          .eq("assignment_id", args.assignment_id)
          .order("created_at", { ascending: false })
          .limit(20);
        workflowLogs = wfLogs || [];
      }

      return {
        success: true,
        result: {
          audit_logs: (logs || []).map((l: any) => ({
            action: l.action, table: l.table_name, description: l.description, role: l.user_role,
            date: new Date(l.created_at).toLocaleString("ar-SA"),
          })),
          workflow_transitions: workflowLogs.map((w: any) => ({
            from: w.old_status, to: w.new_status, type: w.action_type, reason: w.reason,
            date: new Date(w.created_at).toLocaleString("ar-SA"),
            role: w.metadata?.user_role || "—",
          })),
        }
      };
    }

    if (toolName === "approve_final_value") {
      const { error: updateErr } = await db.from("valuation_assignments")
        .update({ final_value: args.approved_value, updated_at: new Date().toISOString() })
        .eq("id", args.assignment_id);
      if (updateErr) return { success: false, result: null, error: updateErr.message };

      await db.from("audit_logs").insert({
        action: "update",
        table_name: "valuation_assignments",
        record_id: args.assignment_id,
        assignment_id: args.assignment_id,
        description: `اعتماد القيمة النهائية: ${args.approved_value.toLocaleString()} ر.س${args.justification ? ` | المبرر: ${args.justification}` : ""}`,
        new_data: { approved_value: args.approved_value, approved_at: new Date().toISOString() },
      });

      return { success: true, result: { message: `تم اعتماد القيمة النهائية: ${args.approved_value.toLocaleString()} ر.س`, assignment_id: args.assignment_id } };
    }

    if (toolName === "issue_final_report") {
      // Run issuance gate checks
      const checks: { code: string; label: string; passed: boolean; details?: string }[] = [];

      const { data: assignment } = await db.from("valuation_assignments").select("*, subjects(*)").eq("id", args.assignment_id).single();
      if (!assignment) return { success: false, result: null, error: "المهمة غير موجودة" };

      // Check final value
      checks.push({ code: "FINAL_VALUE", label: "القيمة النهائية", passed: !!assignment.final_value, details: assignment.final_value ? `${Number(assignment.final_value).toLocaleString()} ر.س` : "غير محددة" });

      // Check report exists
      const { data: reports } = await db.from("reports").select("id, content_ar").eq("assignment_id", args.assignment_id).order("version", { ascending: false }).limit(1);
      checks.push({ code: "REPORT", label: "وجود التقرير", passed: !!(reports?.length), details: reports?.length ? "موجود" : "لا يوجد تقرير" });
      if (reports?.[0]) checks.push({ code: "CONTENT", label: "محتوى التقرير", passed: !!reports[0].content_ar });

      // Check assumptions
      const { count: assumCount } = await db.from("assumptions").select("id", { count: "exact", head: true }).eq("assignment_id", args.assignment_id);
      checks.push({ code: "ASSUMPTIONS", label: "الافتراضات", passed: (assumCount || 0) > 0, details: `${assumCount || 0} بند` });

      // Check inspection (unless desktop)
      if (assignment.valuation_mode !== "desktop") {
        const { data: insp } = await db.from("inspections").select("completed, status").eq("assignment_id", args.assignment_id).limit(1);
        const inspDone = insp?.[0]?.completed || insp?.[0]?.status === "completed";
        checks.push({ code: "INSPECTION", label: "المعاينة", passed: !!inspDone });
      }

      // Check compliance
      const { data: compChecks } = await db.from("compliance_checks").select("is_passed, is_mandatory").eq("assignment_id", args.assignment_id);
      if (compChecks?.length) {
        const mandatoryFailed = compChecks.filter((c: any) => c.is_mandatory && !c.is_passed);
        checks.push({ code: "COMPLIANCE", label: "فحوصات الامتثال", passed: mandatoryFailed.length === 0, details: mandatoryFailed.length > 0 ? `${mandatoryFailed.length} فحوصات فاشلة` : "جميعها ناجحة" });
      }

      // Check payment
      const { data: linkedReq } = await db.from("valuation_requests").select("id").eq("assignment_id", args.assignment_id).maybeSingle();
      if (linkedReq) {
        const { data: finalPay } = await db.from("payments").select("id").eq("request_id", linkedReq.id).eq("payment_stage", "final").eq("payment_status", "paid").limit(1);
        checks.push({ code: "PAYMENT", label: "الدفعة النهائية", passed: !!(finalPay?.length), details: finalPay?.length ? "مدفوعة" : "غير مدفوعة" });
      }

      const failedChecks = checks.filter(c => !c.passed);
      const canIssue = failedChecks.length === 0;

      if (!canIssue && !args.bypass_justification) {
        return {
          success: false,
          result: {
            can_issue: false,
            passed: checks.filter(c => c.passed).length,
            total: checks.length,
            checks,
            blocked_reasons: failedChecks.map(c => `${c.label}: ${c.details || "لم يجتز"}`),
            message: "لا يمكن الإصدار — يوجد بوابات فاشلة. يمكنك تقديم مبرر للتجاوز.",
          },
          error: "بوابات فاشلة تمنع الإصدار"
        };
      }

      // Issue the report
      const { data: result, error: statusErr } = await db.rpc("update_request_status", {
        _assignment_id: args.assignment_id,
        _new_status: "issued",
        _user_id: null,
        _action_type: args.bypass_justification ? "bypass" : "normal",
        _reason: "إصدار التقرير النهائي عبر رقيم",
        _bypass_justification: args.bypass_justification || null,
      });

      if (statusErr || !result?.success) {
        return { success: false, result: null, error: statusErr?.message || result?.error || "فشل الإصدار" };
      }

      return {
        success: true,
        result: {
          message: "✅ تم إصدار التقرير النهائي بنجاح",
          checks_passed: checks.filter(c => c.passed).length,
          total_checks: checks.length,
          bypassed: !!args.bypass_justification,
        }
      };
    }

    if (toolName === "cancel_assignment") {
      const { data: result, error } = await db.rpc("update_request_status", {
        _assignment_id: args.assignment_id,
        _new_status: "cancelled",
        _user_id: null,
        _action_type: "normal",
        _reason: args.reason,
      });
      if (error) return { success: false, result: null, error: error.message };
      if (!result?.success) return { success: false, result: null, error: result?.error || "لا يمكن الإلغاء من الحالة الحالية" };
      return { success: true, result: { message: `تم إلغاء الطلب بنجاح | السبب: ${args.reason}` } };
    }

    if (toolName === "get_compliance_overview") {
      const { data: active } = await db.from("valuation_assignments")
        .select("id, reference_number, status, final_value, methodology, purpose")
        .not("status", "in", "(issued,archived,cancelled,draft)")
        .order("created_at", { ascending: false })
        .limit(50);

      const overview: any[] = [];
      for (const a of (active || [])) {
        const [subjRes, compRes, assumRes, inspRes] = await Promise.all([
          db.from("subjects").select("id").eq("assignment_id", a.id),
          db.from("assignment_comparables").select("id").eq("assignment_id", a.id),
          db.from("assumptions").select("id").eq("assignment_id", a.id),
          db.from("inspections").select("completed, status").eq("assignment_id", a.id).limit(1),
        ]);

        const score = [
          !!(subjRes.data?.length),
          (compRes.data?.length || 0) >= 3,
          (assumRes.data?.length || 0) > 0,
          !!a.final_value,
          !!a.methodology,
          inspRes.data?.[0]?.completed || inspRes.data?.[0]?.status === "completed",
        ].filter(Boolean).length;

        overview.push({
          ref: a.reference_number, status: a.status,
          compliance_score: Math.round((score / 6) * 100),
          missing: [
            !(subjRes.data?.length) && "بيانات العقار",
            (compRes.data?.length || 0) < 3 && "مقارنات (≥3)",
            !(assumRes.data?.length) && "افتراضات",
            !a.final_value && "القيمة النهائية",
            !a.methodology && "المنهجية",
            !(inspRes.data?.[0]?.completed) && !(inspRes.data?.[0]?.status === "completed") && "المعاينة",
          ].filter(Boolean),
        });
      }

      const avgScore = overview.length > 0 ? Math.round(overview.reduce((s, o) => s + o.compliance_score, 0) / overview.length) : 0;
      return {
        success: true,
        result: {
          total_active: overview.length,
          average_compliance: avgScore,
          fully_compliant: overview.filter(o => o.compliance_score === 100).length,
          needs_attention: overview.filter(o => o.compliance_score < 60).length,
          assignments: overview,
        }
      };
    }

    if (toolName === "get_team_workload") {
      const { data: inspectors } = await db.from("inspector_profiles")
        .select("user_id, is_active, availability_status, current_workload, avg_rating, cities_ar, profiles(full_name_ar)")
        .eq("is_active", true);

      const workloads: any[] = [];
      for (const insp of (inspectors || [])) {
        const [activeRes, completedRes] = await Promise.all([
          db.from("inspections").select("id").eq("inspector_id", insp.user_id).in("status", ["scheduled", "pending", "in_progress"]),
          db.from("inspections").select("id").eq("inspector_id", insp.user_id).in("status", ["completed", "submitted"]),
        ]);

        workloads.push({
          name: insp.profiles?.full_name_ar || "—",
          availability: insp.availability_status,
          active_tasks: activeRes.data?.length || 0,
          completed_tasks: completedRes.data?.length || 0,
          workload: insp.current_workload || 0,
          rating: insp.avg_rating || 0,
          cities: insp.cities_ar || [],
        });
      }

      workloads.sort((a, b) => b.active_tasks - a.active_tasks);
      return {
        success: true,
        result: {
          total_inspectors: workloads.length,
          available: workloads.filter(w => w.availability === "available").length,
          overloaded: workloads.filter(w => w.active_tasks > 5).length,
          inspectors: workloads,
        }
      };
    }

    if (toolName === "get_workflow_bottlenecks") {
      const threshold = (args.hours_threshold || 48) * 3600000;
      const cutoff = new Date(Date.now() - threshold).toISOString();

      const { data: stale } = await db.from("valuation_assignments")
        .select("id, reference_number, status, updated_at, created_at, clients(name_ar)")
        .not("status", "in", "(issued,archived,cancelled,draft)")
        .lt("updated_at", cutoff)
        .order("updated_at", { ascending: true })
        .limit(30);

      const bottlenecks: Record<string, any[]> = {};
      for (const a of (stale || [])) {
        if (!bottlenecks[a.status]) bottlenecks[a.status] = [];
        bottlenecks[a.status].push({
          ref: a.reference_number,
          client: a.clients?.name_ar || "—",
          hours_stuck: Math.round((Date.now() - new Date(a.updated_at).getTime()) / 3600000),
          since: new Date(a.updated_at).toLocaleDateString("ar-SA"),
        });
      }

      const stageLabels: Record<string, string> = {
        submitted: "بانتظار التسعير", scope_generated: "بانتظار موافقة العميل", scope_approved: "بانتظار الدفعة الأولى",
        first_payment_confirmed: "بانتظار فتح جمع البيانات", data_collection_open: "جمع بيانات جاري",
        data_collection_complete: "بانتظار المعاينة", inspection_pending: "معاينة معلقة",
        inspection_completed: "بانتظار التحقق", data_validated: "بانتظار التحليل",
        analysis_complete: "بانتظار المراجعة المهنية", professional_review: "مراجعة مهنية جارية",
        draft_report_ready: "بانتظار مراجعة العميل", client_review: "العميل يراجع",
        draft_approved: "بانتظار الدفعة النهائية", final_payment_confirmed: "بانتظار الإصدار",
      };

      return {
        success: true,
        result: {
          total_bottlenecks: (stale || []).length,
          by_stage: Object.entries(bottlenecks).map(([stage, items]) => ({
            stage, label: stageLabels[stage] || stage, count: items.length, assignments: items,
          })),
          recommendation: (stale || []).length === 0
            ? "لا توجد اختناقات — سير العمل يتحرك بسلاسة ✅"
            : `يوجد ${(stale || []).length} طلبات عالقة تحتاج تدخل فوري ⚠️`,
        }
      };
    }

    if (toolName === "update_assignment_pricing") {
      const { data: req } = await db.from("valuation_requests")
        .select("id, total_price")
        .eq("assignment_id", args.assignment_id)
        .maybeSingle();

      const oldPrice = req?.total_price || 0;
      if (req) {
        await db.from("valuation_requests")
          .update({ total_price: args.new_price, updated_at: new Date().toISOString() })
          .eq("id", req.id);
      }

      await db.from("audit_logs").insert({
        action: "update",
        table_name: "valuation_requests",
        record_id: req?.id || args.assignment_id,
        assignment_id: args.assignment_id,
        description: `تعديل التسعير: ${oldPrice} → ${args.new_price} ر.س | السبب: ${args.reason}`,
        old_data: { total_price: oldPrice },
        new_data: { total_price: args.new_price, reason: args.reason },
      });

      return { success: true, result: { message: `تم تعديل السعر من ${oldPrice.toLocaleString()} إلى ${args.new_price.toLocaleString()} ر.س`, old_price: oldPrice, new_price: args.new_price } };
    }

    if (toolName === "manage_discount_code") {
      if (args.action === "create") {
        let clientId: string | null = null;
        if (args.client_name) {
          const { data: client } = await db.from("clients").select("id").ilike("name_ar", `%${args.client_name}%`).limit(1).maybeSingle();
          clientId = client?.id || null;
        }

        const { data: dc, error: dcErr } = await db.from("discount_codes").insert({
          code: args.code.toUpperCase(),
          discount_percentage: args.discount_percentage || 10,
          discount_type: "percentage",
          max_uses: args.max_uses || null,
          client_id: clientId,
          is_active: true,
          expires_at: args.expires_days ? new Date(Date.now() + args.expires_days * 86400000).toISOString() : null,
        }).select("id, code").single();

        if (dcErr) return { success: false, result: null, error: dcErr.message };
        return { success: true, result: { message: `تم إنشاء كود الخصم: ${args.code.toUpperCase()}`, discount_id: dc.id } };
      }

      if (args.action === "deactivate") {
        const { error } = await db.from("discount_codes").update({ is_active: false }).eq("code", args.code.toUpperCase());
        if (error) return { success: false, result: null, error: error.message };
        return { success: true, result: { message: `تم تعطيل كود الخصم: ${args.code.toUpperCase()}` } };
      }

      return { success: false, result: null, error: "إجراء غير معروف" };
    }

    if (toolName === "send_bulk_notifications") {
      let userIds: string[] = args.user_ids || [];

      if (args.target_group === "overdue_clients") {
        const { data: overdueInv } = await db.from("invoices")
          .select("client_id, clients(portal_user_id)")
          .in("status", ["unpaid", "overdue"])
          .lt("due_date", new Date().toISOString())
          .limit(100);
        userIds = (overdueInv || []).map((i: any) => i.clients?.portal_user_id).filter(Boolean);
      } else if (args.target_group === "active_inspectors") {
        const { data: inspectors } = await db.from("inspector_profiles").select("user_id").eq("is_active", true);
        userIds = (inspectors || []).map((i: any) => i.user_id);
      } else if (args.target_group === "all_clients") {
        const { data: clients } = await db.from("clients").select("portal_user_id").not("portal_user_id", "is", null).eq("is_active", true).limit(200);
        userIds = (clients || []).map((c: any) => c.portal_user_id).filter(Boolean);
      }

      const uniqueIds = [...new Set(userIds)];
      if (uniqueIds.length === 0) return { success: false, result: null, error: "لم يتم العثور على مستخدمين في المجموعة المستهدفة" };

      const notifications = uniqueIds.map(uid => ({
        user_id: uid,
        title_ar: args.title,
        body_ar: args.body,
        category: "general",
        priority: args.priority || "normal",
        notification_type: "bulk_from_raqeem",
        channel: "in_app",
        delivery_status: "delivered",
      }));

      const { error: bulkErr } = await db.from("notifications").insert(notifications);
      if (bulkErr) return { success: false, result: null, error: bulkErr.message };

      return { success: true, result: { message: `تم إرسال ${uniqueIds.length} إشعار بنجاح`, recipients_count: uniqueIds.length, target_group: args.target_group } };
    }
    if (toolName === "get_my_tasks") {
      const { data: inspections } = await db.from("inspections")
        .select("id, assignment_id, inspection_date, status, notes_ar, valuation_assignments(reference_number, property_type, valuation_type, subjects(city_ar, district_ar, address_ar))")
        .order("inspection_date", { ascending: false })
        .limit(20);

      const statusFilter = args.status_filter || "all";
      let filtered = inspections || [];
      if (statusFilter === "pending") filtered = filtered.filter((i: any) => !["completed", "submitted"].includes(i.status));
      if (statusFilter === "completed") filtered = filtered.filter((i: any) => ["completed", "submitted"].includes(i.status));

      return {
        success: true,
        result: {
          total: filtered.length,
          tasks: filtered.map((i: any) => ({
            inspection_id: i.id,
            assignment_id: i.assignment_id,
            reference: i.valuation_assignments?.reference_number || "—",
            date: i.inspection_date,
            status: i.status,
            property_type: i.valuation_assignments?.property_type || "—",
            location: i.valuation_assignments?.subjects?.[0]?.city_ar || i.valuation_assignments?.subjects?.city_ar || "—",
            address: i.valuation_assignments?.subjects?.[0]?.address_ar || i.valuation_assignments?.subjects?.address_ar || "—",
          })),
        }
      };
    }

    if (toolName === "get_task_details") {
      const { data: assignment } = await db.from("valuation_assignments")
        .select("*, subjects(*), clients(name_ar, phone), valuation_requests(property_description, notes, valuation_mode)")
        .eq("id", args.assignment_id)
        .single();
      if (!assignment) return { success: false, result: null, error: "لم يتم العثور على المهمة" };

      const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects;
      return {
        success: true,
        result: {
          reference: assignment.reference_number,
          status: assignment.status,
          property_type: assignment.property_type,
          valuation_type: assignment.valuation_type,
          valuation_mode: assignment.valuation_requests?.valuation_mode || assignment.valuation_mode,
          client_name: assignment.clients?.name_ar || "—",
          client_phone: assignment.clients?.phone || "—",
          location: { city: subject?.city_ar, district: subject?.district_ar, address: subject?.address_ar },
          description: assignment.valuation_requests?.property_description || "—",
          notes: assignment.valuation_requests?.notes || assignment.notes || "—",
        }
      };
    }

    if (toolName === "submit_inspection_status") {
      const statusMap: Record<string, string> = { in_progress: "in_progress", completed: "submitted", postponed: "postponed" };
      const dbStatus = statusMap[args.new_status] || args.new_status;
      
      const updateData: any = { status: dbStatus, updated_at: new Date().toISOString() };
      if (args.new_status === "completed") {
        updateData.completed = true;
        updateData.submitted_at = new Date().toISOString();
      }
      if (args.notes) updateData.notes_ar = args.notes;

      const { error } = await db.from("inspections").update(updateData).eq("id", args.inspection_id);
      if (error) return { success: false, result: null, error: error.message };
      return { success: true, result: { message: `تم تحديث حالة المعاينة إلى: ${args.new_status}` } };
    }

    if (toolName === "report_field_issue") {
      const issueLabels: Record<string, string> = {
        access_denied: "عدم إتاحة الوصول",
        wrong_address: "عنوان خاطئ",
        safety_concern: "خطر أمني",
        client_absent: "العميل غير موجود",
        other: "أخرى",
      };

      // Log as notification to owner
      await db.from("notifications").insert({
        user_id: "00000000-0000-0000-0000-000000000000", // placeholder — will need owner lookup
        title_ar: `⚠️ مشكلة ميدانية: ${issueLabels[args.issue_type] || args.issue_type}`,
        body_ar: args.description,
        category: "inspection",
        priority: "critical",
        notification_type: "field_issue",
        channel: "in_app",
        delivery_status: "delivered",
        related_assignment_id: args.assignment_id,
      });

      // Log in audit
      await db.from("audit_logs").insert({
        action: "create",
        table_name: "inspections",
        record_id: args.assignment_id,
        assignment_id: args.assignment_id,
        description: `مشكلة ميدانية: ${issueLabels[args.issue_type]} — ${args.description}`,
      });

      return { success: true, result: { message: "تم الإبلاغ عن المشكلة الميدانية وإرسال إشعار للإدارة" } };
    }

    if (toolName === "get_my_schedule") {
      const { data: upcoming } = await db.from("inspections")
        .select("id, assignment_id, inspection_date, inspection_time, status, valuation_assignments(reference_number, property_type, subjects(city_ar, address_ar))")
        .in("status", ["scheduled", "pending", "in_progress"])
        .gte("inspection_date", new Date().toISOString().split("T")[0])
        .order("inspection_date", { ascending: true })
        .limit(15);

      return {
        success: true,
        result: {
          total: upcoming?.length || 0,
          schedule: (upcoming || []).map((i: any) => ({
            inspection_id: i.id,
            reference: i.valuation_assignments?.reference_number || "—",
            date: i.inspection_date,
            time: i.inspection_time || "غير محدد",
            status: i.status,
            location: i.valuation_assignments?.subjects?.[0]?.city_ar || "—",
            address: i.valuation_assignments?.subjects?.[0]?.address_ar || "—",
          })),
        }
      };
    }

    // ═══════════════ CFO Tools Execution ═══════════════
    if (toolName === "get_pending_payments") {
      let query = db.from("payments")
        .select("id, amount, payment_stage, payment_status, payment_type, created_at, request_id, assignment_id, valuation_requests(client_name_ar), valuation_assignments(reference_number)")
        .in("payment_status", ["pending", "proof_uploaded"])
        .order("created_at", { ascending: false })
        .limit(30);

      if (args.stage_filter && args.stage_filter !== "all") {
        query = query.eq("payment_stage", args.stage_filter);
      }

      const { data: payments } = await query;
      return {
        success: true,
        result: {
          total: payments?.length || 0,
          payments: (payments || []).map((p: any) => ({
            id: p.id,
            amount: p.amount,
            stage: p.payment_stage,
            status: p.payment_status,
            type: p.payment_type,
            date: new Date(p.created_at).toLocaleDateString("ar-SA"),
            client: p.valuation_requests?.client_name_ar || "—",
            reference: p.valuation_assignments?.reference_number || "—",
          })),
        }
      };
    }

    if (toolName === "confirm_payment_receipt") {
      const { error } = await db.from("payments")
        .update({
          payment_status: "paid",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", args.payment_id);

      if (error) return { success: false, result: null, error: error.message };

      await db.from("audit_logs").insert({
        action: "status_change",
        table_name: "payments",
        record_id: args.payment_id,
        description: `تأكيد استلام دفعة عبر رقيم${args.notes ? ' — ' + args.notes : ''}`,
      });

      return { success: true, result: { message: "تم تأكيد الدفعة بنجاح وتحريك سير العمل" } };
    }

    if (toolName === "get_overdue_invoices") {
      const daysOverdue = args.days_overdue || 7;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

      const { data: invoices } = await db.from("invoices")
        .select("id, invoice_number, total_amount, due_date, status, created_at, assignment_id, valuation_assignments(reference_number, clients(name_ar, phone))")
        .in("status", ["unpaid", "overdue"])
        .lt("due_date", new Date().toISOString())
        .order("due_date", { ascending: true })
        .limit(30);

      return {
        success: true,
        result: {
          total: invoices?.length || 0,
          invoices: (invoices || []).map((inv: any) => ({
            invoice_number: inv.invoice_number,
            amount: inv.total_amount,
            due_date: inv.due_date,
            days_late: Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
            client: inv.valuation_assignments?.clients?.name_ar || "—",
            phone: inv.valuation_assignments?.clients?.phone || "—",
            reference: inv.valuation_assignments?.reference_number || "—",
          })),
        }
      };
    }

    if (toolName === "get_revenue_report") {
      const now = new Date();
      let startDate: Date;
      switch (args.period || "this_month") {
        case "today": startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case "this_week": startDate = new Date(now); startDate.setDate(now.getDate() - now.getDay()); break;
        case "this_quarter": startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
        case "this_year": startDate = new Date(now.getFullYear(), 0, 1); break;
        default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const { data: payments } = await db.from("payments")
        .select("amount, payment_status, payment_stage, paid_at")
        .gte("created_at", startDate.toISOString());

      const paid = (payments || []).filter((p: any) => p.payment_status === "paid");
      const pending = (payments || []).filter((p: any) => p.payment_status !== "paid" && p.payment_status !== "rejected");
      const totalPaid = paid.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const totalPending = pending.reduce((s: number, p: any) => s + (p.amount || 0), 0);

      return {
        success: true,
        result: {
          period: args.period || "this_month",
          total_revenue: totalPaid,
          pending_amount: totalPending,
          total_transactions: (payments || []).length,
          paid_count: paid.length,
          pending_count: pending.length,
          collection_rate: (payments || []).length > 0 ? Math.round((paid.length / (payments || []).length) * 100) : 0,
        }
      };
    }

    if (toolName === "get_collection_summary") {
      const { data: allPayments } = await db.from("payments")
        .select("amount, payment_status, payment_stage")
        .limit(1000);

      const paid = (allPayments || []).filter((p: any) => p.payment_status === "paid");
      const pending = (allPayments || []).filter((p: any) => ["pending", "proof_uploaded"].includes(p.payment_status));
      const overdue = (allPayments || []).filter((p: any) => p.payment_status === "overdue");

      const totalPaid = paid.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const totalPending = pending.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const totalOverdue = overdue.reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const grandTotal = totalPaid + totalPending + totalOverdue;

      return {
        success: true,
        result: {
          total_collected: totalPaid,
          total_pending: totalPending,
          total_overdue: totalOverdue,
          grand_total: grandTotal,
          collection_rate: grandTotal > 0 ? Math.round((totalPaid / grandTotal) * 100) : 0,
          counts: { paid: paid.length, pending: pending.length, overdue: overdue.length },
        }
      };
    }

    if (toolName === "send_payment_reminder") {
      const { data: client } = await db.from("clients").select("name_ar, portal_user_id").eq("id", args.client_id).single();
      if (!client?.portal_user_id) return { success: false, result: null, error: "العميل غير مسجل في البوابة" };

      const reminderText = args.message || `تذكير: لديك فاتورة بانتظار السداد. يرجى المبادرة بالدفع لتفعيل خدمة التقييم.`;

      await db.from("notifications").insert({
        user_id: client.portal_user_id,
        title_ar: "💳 تذكير بالسداد",
        body_ar: reminderText,
        category: "payment",
        priority: "high",
        notification_type: "payment_reminder",
        channel: "in_app",
        delivery_status: "delivered",
      });

      return { success: true, result: { message: `تم إرسال تذكير الدفع للعميل ${client.name_ar}` } };
    }

    return { success: false, result: null, error: `أداة غير معروفة: ${toolName}` };
  } catch (e) {
    console.error(`Tool execution error (${toolName}):`, e);
    return { success: false, result: null, error: e instanceof Error ? e.message : "خطأ غير متوقع" };
  }
}

async function callInternalFunction(
  supabaseUrl: string,
  serviceKey: string,
  functionName: string,
  body: any
): Promise<{ success: boolean; result: any; error?: string }> {
  const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    return { success: false, result: null, error: data.error || `خطأ ${resp.status}` };
  }
  return { success: true, result: data };
}

// Build report context from DB tables
async function buildReportContext(db: any, assignmentId: string) {
  const { data: assignment } = await db
    .from("valuation_assignments")
    .select("*, valuation_requests(*), subjects(*)")
    .eq("id", assignmentId)
    .single();

  if (!assignment) return null;

  const request = assignment.valuation_requests;
  const subjects = Array.isArray(assignment.subjects) ? assignment.subjects : assignment.subjects ? [assignment.subjects] : [];
  const subject = subjects[0] || {};

  // Fetch client
  let clientName = "";
  if (request?.client_id) {
    const { data: client } = await db.from("clients").select("name_ar").eq("id", request.client_id).single();
    clientName = client?.name_ar || "";
  }

  // Fetch inspection summary
  let inspectionSummary = "";
  const { data: inspection } = await db.from("inspections").select("findings_ar, notes_ar").eq("assignment_id", assignmentId).limit(1).single();
  if (inspection) {
    inspectionSummary = [inspection.findings_ar, inspection.notes_ar].filter(Boolean).join(". ");
  }

  // Fetch comparables
  const { data: assocComps } = await db.from("assignment_comparables").select("comparable_id, weight, notes").eq("assignment_id", assignmentId);
  let comparables: any[] = [];
  if (assocComps?.length) {
    const ids = assocComps.map((c: any) => c.comparable_id);
    const { data: comps } = await db.from("comparables").select("*").in("id", ids);
    comparables = (comps || []).map((c: any) => ({
      description: c.description_ar || c.address_ar || "مقارن",
      value: c.price || 0,
      source: c.transaction_type || "",
    }));
  }

  return {
    assetType: assignment.valuation_type || "عقاري",
    assetDescription: subject.description_ar || request?.property_description || "",
    assetLocation: subject.address_ar || "",
    assetCity: subject.city_ar || "",
    methodology: assignment.methodology || "أسلوب المقارنة",
    estimatedValue: assignment.final_value || undefined,
    clientName,
    purposeOfValuation: assignment.purpose_ar || request?.purpose || "تقدير القيمة السوقية",
    landArea: subject.land_area ? String(subject.land_area) : "",
    buildingArea: subject.building_area ? String(subject.building_area) : "",
    propertyType: subject.property_type || "سكني",
    inspectionDate: inspection?.inspection_date || "",
    referenceNumber: assignment.reference_number || "",
    inspectionSummary,
    comparables,
  };
}

// Run compliance check against assignment data
async function runComplianceCheck(db: any, assignmentId: string) {
  const checks: { check: string; passed: boolean; note: string }[] = [];

  // 1. Assignment exists
  const { data: assignment } = await db.from("valuation_assignments").select("*").eq("id", assignmentId).single();
  if (!assignment) {
    return { passed: false, score: 0, checks: [{ check: "وجود المهمة", passed: false, note: "لم يتم العثور على مهمة التقييم" }] };
  }

  // 2. Subject property
  const { data: subjects } = await db.from("subjects").select("*").eq("assignment_id", assignmentId);
  const hasSubject = subjects && subjects.length > 0;
  checks.push({ check: "بيانات العقار محل التقييم", passed: !!hasSubject, note: hasSubject ? `${subjects.length} عقار مسجل` : "لا توجد بيانات عقار" });

  // 3. Inspection
  const { data: inspections } = await db.from("inspections").select("id, status, completed").eq("assignment_id", assignmentId);
  const completedInspection = inspections?.find((i: any) => i.completed || i.status === "completed");
  checks.push({ check: "المعاينة الميدانية", passed: !!completedInspection, note: completedInspection ? "مكتملة" : "غير مكتملة أو غير موجودة" });

  // 4. Comparables
  const { data: comps } = await db.from("assignment_comparables").select("id").eq("assignment_id", assignmentId);
  const hasComps = comps && comps.length >= 3;
  checks.push({ check: "المقارنات السوقية (≥3)", passed: !!hasComps, note: `${comps?.length || 0} مقارنات` });

  // 5. Methodology defined
  checks.push({ check: "المنهجية محددة", passed: !!assignment.methodology, note: assignment.methodology || "غير محددة" });

  // 6. Purpose defined
  checks.push({ check: "غرض التقييم محدد", passed: !!(assignment.purpose_ar || assignment.purpose_en), note: assignment.purpose_ar || "غير محدد" });

  // 7. Reference number
  checks.push({ check: "الرقم المرجعي", passed: !!assignment.reference_number, note: assignment.reference_number || "غير مُولّد" });

  // 8. Value assigned
  checks.push({ check: "القيمة النهائية", passed: !!assignment.final_value, note: assignment.final_value ? `${Number(assignment.final_value).toLocaleString()} ر.س` : "غير محددة" });

  // 9. Assumptions
  const { data: assumptions } = await db.from("assumptions").select("id").eq("assignment_id", assignmentId);
  checks.push({ check: "الافتراضات والشروط المقيدة", passed: !!(assumptions && assumptions.length > 0), note: `${assumptions?.length || 0} بند` });

  // 10. Photos
  const inspectionIds = inspections?.map((i: any) => i.id) || [];
  let photoCount = 0;
  if (inspectionIds.length > 0) {
    const { data: photos } = await db.from("inspection_photos").select("id").in("inspection_id", inspectionIds);
    photoCount = photos?.length || 0;
  }
  checks.push({ check: "صور المعاينة (≥5)", passed: photoCount >= 5, note: `${photoCount} صورة` });

  const passedCount = checks.filter(c => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  return {
    passed: score >= 80,
    score,
    total_checks: checks.length,
    passed_checks: passedCount,
    checks,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, correction, userRole } = await req.json();
    const effectiveRole = (userRole === "admin_coordinator" || userRole === "valuation_manager" || userRole === "valuer") ? "owner" : (userRole || "owner");

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Handle correction submission
    if (correction) {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "");
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user } } = await userClient.auth.getUser(token);

      if (!user) {
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabaseClient.from("raqeem_corrections").insert({
        original_question: correction.original_question,
        original_answer: correction.original_answer,
        corrected_answer: correction.corrected_answer,
        correction_reason: correction.reason || null,
        corrected_by: user.id,
      });

      if (error) {
        console.error("Correction save error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save correction" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build contextual system prompt with role-specific additions
    const basePrompt = await buildContextualPrompt(supabaseClient);
    const systemPrompt = basePrompt + getRolePromptAddition(effectiveRole);
    const roleTools = getToolsForRole(effectiveRole);

    // First call: with tools enabled (non-streaming to detect tool calls)
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: roleTools,
        tool_choice: "auto",
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      return handleAIError(firstResponse);
    }

    const firstData = await firstResponse.json();
    const choice = firstData.choices?.[0];

    // Check if AI wants to call tools
    if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
      const toolCalls = choice.message.tool_calls;
      const toolResults: any[] = [];

      // Send orchestration status event first
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          // Send initial status
          const statusEvent = {
            type: "orchestration_status",
            tools: toolCalls.map((tc: any) => ({
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments || "{}"),
              status: "running"
            }))
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "" }, orchestration: statusEvent }] })}\n\n`));

          // Execute all tool calls
          for (const tc of toolCalls) {
            const args = JSON.parse(tc.function.arguments || "{}");
            const result = await executeTool(tc.function.name, args, supabaseUrl, supabaseServiceKey);
            toolResults.push({
              tool_call_id: tc.id,
              role: "tool",
              name: tc.function.name,
              content: JSON.stringify(result),
            });

            // Send tool completion status
            const doneEvent = {
              type: "tool_complete",
              tool: tc.function.name,
              success: result.success,
              result: result.success ? result.result : null,
              error: result.error || null,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "" }, orchestration: doneEvent }] })}\n\n`));
          }

          // Second call: AI summarizes tool results (streaming)
          const secondMessages = [
            { role: "system", content: systemPrompt },
            ...messages,
            choice.message,
            ...toolResults,
          ];

          const secondResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: secondMessages,
              stream: true,
            }),
          });

          if (!secondResponse.ok || !secondResponse.body) {
            const errText = "حدث خطأ في تحليل النتائج";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errText } }] })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // Pipe the streaming response
          const reader = secondResponse.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls — stream a normal response
    const normalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!normalResponse.ok) {
      return handleAIError(normalResponse);
    }

    return new Response(normalResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("raqeem-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleAIError(response: Response) {
  if (response.status === 429) {
    return new Response(
      JSON.stringify({ error: "تم تجاوز الحد المسموح للطلبات، يرجى المحاولة لاحقاً." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (response.status === 402) {
    return new Response(
      JSON.stringify({ error: "يرجى إضافة رصيد لاستخدام المساعد الذكي." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const t = await response.text();
  console.error("AI gateway error:", response.status, t);
  return new Response(
    JSON.stringify({ error: "حدث خطأ في الاتصال بالمساعد الذكي" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
