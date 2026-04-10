import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AI } from "../_shared/assistantIdentity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_SYSTEM_PROMPT = `أنت "${AI.name}" — مساعد ذكاء اصطناعي متخصص في التقييم العقاري والآلات والمعدات.
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
- **update_follow_up_priority**: تحديث أولوية متابعة الطلب الحالي مع تسجيل تدقيق (مثلاً: "ارفع أولوية المتابعة إلى عاجلة")
- **add_assignment_note**: إضافة ملاحظة تنفيذية على الطلب الحالي مع سجل تدقيق
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
2. **إذا كان سياق المنصة محمّلاً** (قسم "سياق المنصة الحالي" أعلاه)، استخدم assignment_id و request_id منه مباشرة — **لا تسأل المستخدم أبداً** عن رقم الطلب أو المعرّف
3. اسأل عن رقم الطلب **فقط** إذا لم يكن هناك سياق محمّل ولم يذكر المستخدم أي رقم
4. عند استدعاء أي أداة تتطلب assignment_id أو request_id، مرّر القيمة من سياق المنصة المحمّل تلقائياً
5. بعد تنفيذ الأداة، اعرض النتائج بشكل مهني ومنظم
 6. لا تعتمد أي شيء تلقائياً — اعرض النتائج وانتظر قرار المقيّم
 
 ## قواعد تنسيق المخرجات (إلزامية — تطبَّق على كل رد بلا استثناء)
 
 ### الحظر المطلق
 - **ممنوع منعاً باتاً** عرض أي كلمة إنجليزية خام من قاعدة البيانات: لا submitted, لا field, لا residential, لا sale_purchase, لا desktop_with_photos, لا pending, لا any_english_value.
 - **ممنوع** عرض أسماء أدوات (get_assignment_details, change_assignment_status) أو أسماء جداول أو أسماء أعمدة.
 - **ممنوع** عرض معرّفات UUID أو مفاتيح تقنية.
 - **ممنوع** عرض JSON خام أو بنية بيانات برمجية.
 - إذا كانت قيمة ما فارغة أو "—" أو null، **لا تعرض السطر إطلاقاً** — تجاوزه بصمت.
 
 ### بنية ملخص حالة الطلب (بالترتيب الدقيق)
 عند عرض حالة طلب، التزم بهذا الترتيب فقط:
 1. **رقم الطلب**
 2. **الحالة** (بالعربية فقط)
 3. **الغرض** (بالعربية فقط)
 4. **نوع الأصل** (بالعربية فقط)
 5. **وضع التنفيذ** (معاينة ميدانية / مكتبي بصور / مكتبي بدون صور)
 6. **المعاينة** (إذا كانت مطلوبة)
 7. **حالة الدفع** (مدفوع / غير مدفوع / جزئي)
 8. **النواقص** (فقط إن وُجدت)
 9. **الخطوة التالية** (جملة واحدة مباشرة)
 
 ### أسلوب الكتابة
 - عربي مهني مختصر — بدون حشو أو تكرار
 - Markdown منظم: عناوين فرعية **غامقة** وقوائم نقطية
 - لا تعرض قسم "العميل" أو "الامتثال" أو "التواريخ" إلا إذا طلبها المستخدم صراحةً
 - لا تعرض أرقام صفرية (0 مقارنات، 0 افتراضات) — تجاوزها
 - الخطوة التالية يجب أن تكون **توجيهاً واضحاً** وليس وصفاً عاماً
 
7. للأوامر التنفيذية (تغيير حالة، تأكيد دفع): تأكد من المستخدم قبل التنفيذ

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
      description: "توليد نطاق العمل والتسعير لطلب تقييم محدد. يمكن تمرير request_id مباشرة أو الاعتماد على سياق المنصة الحالي إذا كان الطلب مفتوحاً من داخل صفحة مرتبطة.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "string", description: "معرّف طلب التقييم (UUID) — اختياري إذا كان سياق المنصة الحالي يحتوي assignment_id أو request_id" },
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID) — يستخدم تلقائياً لاستخراج request_id عند توفره" },
          reference_number: { type: "string", description: "الرقم المرجعي — اختياري للمطابقة عند الحاجة" }
        }
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
      description: "استخراج البيانات من المستندات المرفوعة لطلب تقييم. يمكن الاعتماد على سياق المنصة الحالي إذا كان الطلب/المهمة محمّلاً تلقائياً.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "string", description: "معرّف طلب التقييم (UUID) — اختياري إذا كان السياق الحالي يحتوي assignment_id أو request_id" },
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID) — يستخدم تلقائياً لاستخراج request_id عند توفره" },
          reference_number: { type: "string", description: "الرقم المرجعي — اختياري للمطابقة عند الحاجة" }
        }
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
      name: "update_follow_up_priority",
      description: "تحديث أولوية متابعة الطلب الحالي مع تسجيل سجل تدقيق.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          request_id: { type: "string", description: "معرّف الطلب — اختياري إذا توفرت المهمة" },
          priority: { type: "string", enum: ["low", "normal", "high", "urgent", "critical"], description: "الأولوية الجديدة" },
          reason: { type: "string", description: "سبب التحديث" }
        },
        required: ["priority"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_assignment_note",
      description: "إضافة ملاحظة تنفيذية على الطلب الحالي مع تسجيل سجل تدقيق.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          request_id: { type: "string", description: "معرّف الطلب — اختياري إذا توفرت المهمة" },
          note: { type: "string", description: "الملاحظة المطلوب إضافتها" }
        },
        required: ["note"]
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

// ═══════════════ أدوات العميل (Client) ═══════════════
const CLIENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "track_my_requests",
      description: "عرض كل طلبات التقييم الخاصة بالعميل مع حالاتها.",
      parameters: { type: "object", properties: { status_filter: { type: "string", enum: ["active", "completed", "all"], description: "فلتر الحالة" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "get_request_status",
      description: "تفاصيل كاملة عن طلب تقييم محدد: الحالة، التقدم، المعاين، المدة المتبقية.",
      parameters: { type: "object", properties: { reference_number: { type: "string", description: "الرقم المرجعي (مثل VAL-2025-0041)" }, assignment_id: { type: "string", description: "معرّف المهمة" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_documents",
      description: "عرض المستندات المرفوعة والمطلوبة لطلب محدد.",
      parameters: { type: "object", properties: { assignment_id: { type: "string", description: "معرّف المهمة" } }, required: ["assignment_id"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_payments",
      description: "عرض حالة المدفوعات والفواتير الخاصة بالعميل.",
      parameters: { type: "object", properties: { assignment_id: { type: "string", description: "معرّف المهمة (اختياري — لعرض فواتير طلب محدد)" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "get_delivery_timeline",
      description: "عرض الجدول الزمني المتوقع للتسليم مع تفاصيل كل مرحلة.",
      parameters: { type: "object", properties: { assignment_id: { type: "string", description: "معرّف المهمة" } }, required: ["assignment_id"] }
    }
  },
  {
    type: "function",
    function: {
      name: "submit_draft_feedback",
      description: "إرسال ملاحظات العميل على مسودة التقرير.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "string", description: "معرّف المهمة" },
          feedback: { type: "string", description: "ملاحظات العميل على المسودة" },
          approve: { type: "boolean", description: "هل يوافق العميل على المسودة؟" }
        },
        required: ["assignment_id", "feedback"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "request_scope_approval",
      description: "موافقة العميل على نطاق العمل والتسعير.",
      parameters: { type: "object", properties: { assignment_id: { type: "string", description: "معرّف المهمة" }, approved: { type: "boolean", description: "الموافقة" } }, required: ["assignment_id"] }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_my_request",
      description: "إلغاء طلب التقييم (فقط في المراحل المبكرة: مسودة، مقدم، نطاق مُعد).",
      parameters: { type: "object", properties: { assignment_id: { type: "string", description: "معرّف المهمة" }, reason: { type: "string", description: "سبب الإلغاء" } }, required: ["assignment_id", "reason"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_missing_requirements",
      description: "عرض المتطلبات الناقصة لاستكمال الطلب (مستندات، صور، بيانات).",
      parameters: { type: "object", properties: { assignment_id: { type: "string", description: "معرّف المهمة" } }, required: ["assignment_id"] }
    }
  },
];

// ═══════════════ أدوات المعاين (Inspector) — موسّعة ═══════════════
const INSPECTOR_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_my_tasks",
      description: "عرض كل المعاينات المسندة مع تفاصيلها وموقعها.",
      parameters: { type: "object", properties: { status_filter: { type: "string", enum: ["pending", "completed", "all"], description: "فلتر الحالة" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "get_task_details",
      description: "تفاصيل مهمة معاينة: موقع، عميل، نوع، متطلبات، ملاحظات.",
      parameters: { type: "object", properties: { assignment_id: { type: "string", description: "معرّف المهمة" } }, required: ["assignment_id"] }
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
      description: "الإبلاغ عن مشكلة ميدانية (عدم وصول، عنوان خاطئ، خطر أمني).",
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
  {
    type: "function",
    function: {
      name: "get_inspection_checklist",
      description: "عرض قائمة التحقق المطلوبة لمعاينة محددة (بنود مطلوبة، مكتملة، ناقصة).",
      parameters: { type: "object", properties: { inspection_id: { type: "string", description: "معرّف المعاينة" } }, required: ["inspection_id"] }
    }
  },
  {
    type: "function",
    function: {
      name: "update_checklist_item",
      description: "تحديث بند في قائمة التحقق (مكتمل / غير مكتمل / ملاحظة).",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "string", description: "معرّف البند" },
          is_checked: { type: "boolean", description: "مكتمل أم لا" },
          value: { type: "string", description: "القيمة أو القراءة" },
          notes: { type: "string", description: "ملاحظات" }
        },
        required: ["item_id", "is_checked"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_photos_status",
      description: "حالة الصور المرفوعة لمعاينة: عدد الصور، التصنيفات المطلوبة، الناقصة.",
      parameters: { type: "object", properties: { inspection_id: { type: "string", description: "معرّف المعاينة" } }, required: ["inspection_id"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_my_performance",
      description: "عرض تقييمي وأدائي: عدد مهام مكتملة، معدل التقييم، ملاحظات.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "request_task_postponement",
      description: "طلب تأجيل معاينة مع ذكر السبب والتاريخ البديل.",
      parameters: {
        type: "object",
        properties: {
          inspection_id: { type: "string", description: "معرّف المعاينة" },
          reason: { type: "string", description: "سبب التأجيل" },
          suggested_date: { type: "string", description: "التاريخ البديل (YYYY-MM-DD)" }
        },
        required: ["inspection_id", "reason"]
      }
    }
  },
];

// ═══════════════ أدوات المدير المالي (CFO) — موسّعة ═══════════════
const CFO_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_pending_payments",
      description: "عرض المدفوعات المعلقة وإثباتات السداد بانتظار المراجعة.",
      parameters: { type: "object", properties: { stage_filter: { type: "string", enum: ["first", "final", "all"], description: "مرحلة الدفع" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "confirm_payment_receipt",
      description: "تأكيد استلام دفعة وتحريك سير العمل.",
      parameters: { type: "object", properties: { payment_id: { type: "string", description: "معرّف الدفعة" }, notes: { type: "string", description: "ملاحظات التأكيد" } }, required: ["payment_id"] }
    }
  },
  {
    type: "function",
    function: {
      name: "reject_payment_proof",
      description: "رفض إثبات دفع مع ذكر السبب.",
      parameters: { type: "object", properties: { payment_id: { type: "string", description: "معرّف الدفعة" }, rejection_reason: { type: "string", description: "سبب الرفض" } }, required: ["payment_id", "rejection_reason"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_overdue_invoices",
      description: "عرض الفواتير المتأخرة مع تفاصيل العملاء والمبالغ.",
      parameters: { type: "object", properties: { days_overdue: { type: "number", description: "عدد أيام التأخر (افتراضي 7)" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "get_revenue_report",
      description: "تقرير الإيرادات والتحصيل لفترة محددة.",
      parameters: { type: "object", properties: { period: { type: "string", enum: ["today", "this_week", "this_month", "this_quarter", "this_year"], description: "الفترة" } } }
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
      description: "إرسال تذكير دفع لعميل.",
      parameters: { type: "object", properties: { client_id: { type: "string", description: "معرّف العميل" }, invoice_id: { type: "string", description: "معرّف الفاتورة" }, message: { type: "string", description: "نص التذكير (اختياري)" } }, required: ["client_id"] }
    }
  },
  {
    type: "function",
    function: {
      name: "get_aging_report",
      description: "تقرير أعمار الديون: توزيع المبالغ حسب فترات التأخر (0-30، 31-60، 61-90، 90+).",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_client_payment_history",
      description: "سجل مدفوعات عميل محدد مع تقييم انضباطه.",
      parameters: { type: "object", properties: { client_name: { type: "string", description: "اسم العميل" }, client_id: { type: "string", description: "معرّف العميل" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "get_daily_cash_flow",
      description: "ملخص التدفق النقدي اليومي: مبالغ محصلة ومتوقعة.",
      parameters: { type: "object", properties: { date: { type: "string", description: "التاريخ (YYYY-MM-DD) — افتراضي اليوم" } } }
    }
  },
  {
    type: "function",
    function: {
      name: "send_bulk_payment_reminders",
      description: "إرسال تذكيرات دفع جماعية لكل العملاء المتأخرين.",
      parameters: { type: "object", properties: { days_overdue: { type: "number", description: "الحد الأدنى لأيام التأخر (افتراضي 7)" } } }
    }
  },
];

// Role-specific system prompt additions
const CLIENT_SYSTEM_PROMPT = `

## دورك كمساعد العميل
أنت تساعد العميل في إنجاز مهامه بسلاسة من تقديم الطلب حتى استلام التقرير النهائي.

### قاعدة ذهبية — لا تسأل عما تعرفه:
- بيانات العميل وطلباته محمّلة تلقائياً في سياقك أعلاه
- **لا تطلب رقم الطلب أو اسم العميل** — أنت تعرفهم بالفعل
- عند سؤال "وين طلبي" أو "حالة طلباتي": اعرض البيانات المحمّلة مباشرة
- إذا كان لديه طلب واحد: تحدث عنه مباشرة. إذا عدة طلبات: اعرضها كلها
- استخدم الأدوات فقط عند الحاجة لتفاصيل أعمق (جدول زمني، مستندات ناقصة)

### قدرات العميل:
- تتبع حالة الطلبات ومعرفة التقدم الفعلي
- عرض المستندات المطلوبة والمرفوعة
- متابعة المدفوعات والفواتير
- مراجعة المسودة وإرسال ملاحظات
- الموافقة على نطاق العمل
- معرفة الجدول الزمني والمدة المتبقية
- إلغاء الطلب في المراحل المبكرة

### أدوات العميل (للتفاصيل العميقة):
- **track_my_requests**: عرض كل طلباتي وحالاتها
- **get_request_status**: تفاصيل طلب محدد بالرقم المرجعي
- **get_my_documents**: المستندات المرفوعة والمطلوبة
- **get_my_payments**: حالة المدفوعات والفواتير
- **get_delivery_timeline**: الجدول الزمني المتوقع
- **submit_draft_feedback**: إرسال ملاحظات على المسودة
- **request_scope_approval**: الموافقة على نطاق العمل
- **cancel_my_request**: إلغاء الطلب
- **get_missing_requirements**: المتطلبات الناقصة

### قيود العميل:
- يرى فقط طلباته الخاصة
- لا يصل لبيانات عملاء آخرين
- لا يصل للبيانات المالية الشاملة
- لا يصل لأدوات إدارية`;

const INSPECTOR_SYSTEM_PROMPT = `

## دورك كمساعد المعاين الميداني
أنت تساعد المعاين في إنجاز كل مهامه الميدانية بكفاءة واحترافية:
- عرض المعاينات المسندة والمجدولة والتفاصيل الكاملة لكل مهمة
- إدارة قوائم التحقق (Checklists) وتحديث البنود
- تحديث حالة المعاينات (بدأت، مكتملة، مؤجلة)
- متابعة حالة الصور المرفوعة والفئات الناقصة
- الإبلاغ عن مشاكل ميدانية (وصول، عنوان، أمان)
- عرض الأداء الشخصي والتقييمات
- طلب تأجيل مهام مع ذكر البديل

### أدوات المعاين:
- **get_my_tasks**: كل المعاينات المسندة لي
- **get_task_details**: تفاصيل مهمة محددة
- **submit_inspection_status**: تحديث حالة المعاينة
- **report_field_issue**: الإبلاغ عن مشكلة ميدانية
- **get_my_schedule**: جدول المعاينات القادمة
- **get_inspection_checklist**: قائمة التحقق لمعاينة
- **update_checklist_item**: تحديث بند في القائمة
- **get_my_photos_status**: حالة صور المعاينة
- **get_my_performance**: أدائي وتقييمي
- **request_task_postponement**: طلب تأجيل مهمة

### قيود المعاين:
- يرى فقط المهام المسندة إليه
- لا صلاحية لتغيير حالة الطلبات الإدارية
- لا صلاحية لعرض البيانات المالية
- لا صلاحية لإدارة مستخدمين آخرين`;

const CFO_SYSTEM_PROMPT = `

## دورك كمساعد المدير المالي
أنت تساعد المدير المالي في إدارة العمليات المالية الشاملة:
- مراجعة وتأكيد أو رفض إثباتات السداد
- متابعة الفواتير المتأخرة وتقارير أعمار الديون
- تقارير الإيرادات والتحصيل والتدفق النقدي
- إرسال تذكيرات دفع فردية وجماعية
- تحليل سجل مدفوعات العملاء

### أدوات المدير المالي:
- **get_pending_payments**: المدفوعات بانتظار المراجعة
- **confirm_payment_receipt**: تأكيد استلام دفعة
- **reject_payment_proof**: رفض إثبات دفع
- **get_overdue_invoices**: الفواتير المتأخرة
- **get_revenue_report**: تقرير الإيرادات
- **get_collection_summary**: ملخص التحصيل
- **send_payment_reminder**: تذكير دفع فردي
- **get_aging_report**: تقرير أعمار الديون
- **get_client_payment_history**: سجل مدفوعات عميل
- **get_daily_cash_flow**: التدفق النقدي اليومي
- **send_bulk_payment_reminders**: تذكيرات جماعية

### قيود المدير المالي:
- لا صلاحية لتغيير حالة الطلبات (إلا عبر تأكيد الدفع)
- لا صلاحية لإدارة المعاينين أو بيانات التقييم`;

function getToolsForRole(role: string) {
  switch (role) {
    case "client": return CLIENT_TOOLS;
    case "inspector": return INSPECTOR_TOOLS;
    case "financial_manager": return CFO_TOOLS;
    default: return TOOLS; // owner gets all tools
  }
}

function getRolePromptAddition(role: string): string {
  switch (role) {
    case "client": return CLIENT_SYSTEM_PROMPT;
    case "inspector": return INSPECTOR_SYSTEM_PROMPT;
    case "financial_manager": return CFO_SYSTEM_PROMPT;
    default: return "";
  }
}

type ChatAttachment = {
  name?: string;
  type?: string;
  url?: string;
};

function isImageAttachment(att: ChatAttachment): boolean {
  return Boolean(att?.url && att?.type?.startsWith("image/"));
}

function hasMeaningfulText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function detectEquipmentSignal(latestUserText: string, attachments: ChatAttachment[]): boolean {
  const combined = [
    latestUserText,
    ...attachments.map((att) => `${att.name || ""} ${att.type || ""}`),
  ].join(" ").toLowerCase();

  const equipmentKeywords = [
    "معدات", "معده", "آلة", "آلات", "machinery", "equipment", "heavy equipment",
    "caterpillar", "cat", "komatsu", "volvo", "loader", "wheel loader", "forklift",
    "excavator", "generator", "compressor", "crane", "truck", "حفار", "شيول",
    "لودر", "رافعة", "رافعة شوكية", "كرين", "بوكلين", "مولد", "ضاغط", "شاحنة",
  ];

  return equipmentKeywords.some((keyword) => combined.includes(keyword));
}

function buildAttachmentIntelligenceSection(
  attachments: ChatAttachment[],
  latestUserText: string,
): string {
  if (!attachments.length) return "";

  const hasImages = attachments.some(isImageAttachment);
  const equipmentSignal = detectEquipmentSignal(latestUserText, attachments);

  let section = `\n\n## مرفقات الرسالة الحالية\n`;
  attachments.forEach((att, index) => {
    section += `- ملف ${index + 1}: ${att.name || "بدون اسم"} (${att.type || "غير معروف"})\n`;
  });

  if (hasImages) {
    section += `\n### تعليمات تحليل الصور\n`;
    section += `- الصور المرفقة جزء أساسي من السؤال الحالي ويجب تحليلها بصرياً، لا الاكتفاء باسم الملف.\n`;
    section += `- إذا أرسل المستخدم صوراً فقط أو نصاً عاماً، فاعتبر أن المطلوب هو تحليل الصور وتحديد نوع الأصل والحالة الظاهرية والخطوة التالية المناسبة.\n`;
    section += `- قبل أن تسأل أي سؤال، استخرج أولاً كل ما يمكن استنتاجه مباشرة من الصور نفسها.\n`;
    section += `- لا تطلب من العميل معلومات شخصية أو أرقام طلبات أو بيانات موجودة لديك بالفعل.\n`;
  }

  if (equipmentSignal) {
    section += `\n### توجيه المسار\n`;
    section += `- توجد إشارة قوية أن المرفقات تخص آلات ومعدات؛ طبّق مسار المعدات مباشرة وتجنّب أي متطلبات عقارية.\n`;
  }

  return section;
}

function buildMachineryVisionPromptLocal(): string {
  return `
## تحليل صور المعدات (عند استلام صور)
عند تحليل صورة معدة أو آلة، قدّم المعلومات التالية:

1. **النوع والفئة**: حدد نوع المعدة (ثقيلة، خفيفة، إنتاجية، كهربائية...)
2. **الشركة المصنعة**: حدد الشركة إن ظهر الشعار أو اللون المميز
3. **الموديل التقريبي**: قدّر الموديل من الشكل والمواصفات المرئية
4. **الحالة الظاهرية**: (ممتاز/جيد/متوسط/سيء) بناءً على:
   - الصدأ والتآكل
   - حالة الطلاء
   - الأجزاء المفقودة أو التالفة
   - نظافة المعدة
5. **العمر التقديري**: قدّر عمر المعدة من مظهرها
6. **لوحة البيانات**: إذا ظهرت لوحة البيانات، استخرج الرقم التسلسلي وسنة الصنع والمواصفات الفنية
7. **ملاحظات تقييمية**: أي ملاحظات تؤثر على القيمة

⚠️ نوّه دائماً أن التحليل البصري أولي ويحتاج تأكيد ميداني أو مستندي حسب مسار الطلب.
`;
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
async function resolveIdsFromContext(
  db: ReturnType<typeof createClient>,
  platformContext: any,
  rawArgs: any,
): Promise<any> {
  const args = { ...(rawArgs || {}) };
  const pc = platformContext && typeof platformContext === "object" ? platformContext : {};

  if (!args.assignment_id && pc.assignment_id) args.assignment_id = pc.assignment_id;
  if (!args.request_id && pc.request_id) args.request_id = pc.request_id;
  if (!args.reference_number && pc.reference_number) args.reference_number = pc.reference_number;

  if (!args.request_id && args.assignment_id) {
    const { data: requestLink } = await db
      .from("valuation_requests")
      .select("id")
      .eq("assignment_id", args.assignment_id)
      .maybeSingle();
    if (requestLink?.id) args.request_id = requestLink.id;
  }

  if (!args.assignment_id && args.request_id) {
    const { data: assignmentLink } = await db
      .from("valuation_requests")
      .select("assignment_id")
      .eq("id", args.request_id)
      .maybeSingle();
    if (assignmentLink?.assignment_id) args.assignment_id = assignmentLink.assignment_id;
  }

  if (!args.assignment_id && args.reference_number) {
    const { data: assignmentByRef } = await db
      .from("valuation_assignments")
      .select("id, reference_number")
      .ilike("reference_number", `%${args.reference_number}%`)
      .maybeSingle();
    if (assignmentByRef?.id) {
      args.assignment_id = assignmentByRef.id;
      args.reference_number = assignmentByRef.reference_number || args.reference_number;
    }
  }

  if (!args.request_id && args.assignment_id) {
    const { data: requestLink } = await db
      .from("valuation_requests")
      .select("id")
      .eq("assignment_id", args.assignment_id)
      .maybeSingle();
    if (requestLink?.id) args.request_id = requestLink.id;
  }

  if (!args.reference_number && args.assignment_id) {
    const { data: assignmentMeta } = await db
      .from("valuation_assignments")
      .select("reference_number")
      .eq("id", args.assignment_id)
      .maybeSingle();
    if (assignmentMeta?.reference_number) args.reference_number = assignmentMeta.reference_number;
  }

  return args;
}

async function executeTool(
  toolName: string,
  args: any,
  supabaseUrl: string,
  serviceKey: string,
  platformContext?: any,
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    const db = createClient(supabaseUrl, serviceKey);
    args = await resolveIdsFromContext(db, platformContext, args);

    if (toolName === "generate_scope") {
      if (!args.request_id) {
        return { success: false, result: null, error: "تعذر تحديد request_id من السياق الحالي أو المعرفات المتاحة" };
      }
      return await callInternalFunction(supabaseUrl, serviceKey, "generate-scope-pricing", { requestId: args.request_id });
    }
    
    if (toolName === "run_valuation") {
      return await callInternalFunction(supabaseUrl, serviceKey, "valuation-engine", { assignmentId: args.assignment_id, step: args.step || "full" });
    }

    if (toolName === "generate_report") {
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
      if (!args.request_id && !args.assignment_id) {
        return { success: false, result: null, error: "تعذر تحديد الطلب الحالي لاستخراج المستندات" };
      }

      const requestId = args.request_id;
      const assignmentId = args.assignment_id;

      const attachmentQueries = [];
      if (assignmentId) {
        attachmentQueries.push(
          db.from("attachments")
            .select("file_name, file_path, mime_type, description_ar")
            .eq("assignment_id", assignmentId)
            .limit(20)
        );
      }
      if (requestId) {
        attachmentQueries.push(
          db.from("attachments")
            .select("file_name, file_path, mime_type, description_ar")
            .or(`subject_id.eq.${requestId},assignment_id.eq.${requestId}`)
            .limit(20)
        );
      }

      const attachmentResults = await Promise.all(attachmentQueries);
      const allAttachments = attachmentResults.flatMap((res: any) => res.data || []);
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
        _reason: args.reason || AI.actionVia("تغيير بطلب المالك"),
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
        notes: args.description || AI.actionVia("طلب مُنشأ"),
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
        related_request_id: args.request_id || null,
      });
      if (notifErr) return { success: false, result: null, error: notifErr.message };
      return { success: true, result: { message: "تم إرسال الإشعار بنجاح", assignment_id: args.assignment_id || null, request_id: args.request_id || null } };
    }

    if (toolName === "update_follow_up_priority") {
      let assignmentId = args.assignment_id;
      let requestId = args.request_id;

      if (!assignmentId && requestId) {
        const { data: reqLink } = await db.from("valuation_requests").select("assignment_id").eq("id", requestId).maybeSingle();
        assignmentId = reqLink?.assignment_id || null;
      }
      if (!requestId && assignmentId) {
        const { data: requestLink } = await db.from("valuation_requests").select("id").eq("assignment_id", assignmentId).maybeSingle();
        requestId = requestLink?.id || null;
      }
      if (!assignmentId) return { success: false, result: null, error: "تعذر تحديد الطلب الحالي لتحديث أولوية المتابعة" };

      const { data: previous } = await db.from("valuation_assignments").select("priority").eq("id", assignmentId).maybeSingle();
      const { error: updErr } = await db.from("valuation_assignments")
        .update({ priority: args.priority, updated_at: new Date().toISOString() })
        .eq("id", assignmentId);
      if (updErr) return { success: false, result: null, error: updErr.message };

      await db.from("audit_logs").insert({
        action: "update",
        table_name: "valuation_assignments",
        record_id: assignmentId,
        assignment_id: assignmentId,
        description: `تحديث أولوية المتابعة من ${previous?.priority || "غير محددة"} إلى ${args.priority}${args.reason ? ` | السبب: ${args.reason}` : ""}`,
        old_data: { priority: previous?.priority || null },
        new_data: { priority: args.priority, request_id: requestId || null, reason: args.reason || null },
      });

      return { success: true, result: { message: `تم تحديث أولوية المتابعة إلى ${args.priority}`, assignment_id: assignmentId, request_id: requestId || null, priority: args.priority } };
    }

    if (toolName === "add_assignment_note") {
      let assignmentId = args.assignment_id;
      let requestId = args.request_id;

      if (!assignmentId && requestId) {
        const { data: reqLink } = await db.from("valuation_requests").select("assignment_id").eq("id", requestId).maybeSingle();
        assignmentId = reqLink?.assignment_id || null;
      }
      if (!requestId && assignmentId) {
        const { data: requestLink } = await db.from("valuation_requests").select("id").eq("assignment_id", assignmentId).maybeSingle();
        requestId = requestLink?.id || null;
      }
      if (!assignmentId) return { success: false, result: null, error: "تعذر تحديد الطلب الحالي لإضافة الملاحظة" };

      const { data: previous } = await db.from("valuation_assignments").select("notes").eq("id", assignmentId).maybeSingle();
      const mergedNotes = [previous?.notes, args.note].filter(Boolean).join("\n\n");
      const { error: updErr } = await db.from("valuation_assignments")
        .update({ notes: mergedNotes, updated_at: new Date().toISOString() })
        .eq("id", assignmentId);
      if (updErr) return { success: false, result: null, error: updErr.message };

      await db.from("audit_logs").insert({
        action: "update",
        table_name: "valuation_assignments",
        record_id: assignmentId,
        assignment_id: assignmentId,
        description: `إضافة ملاحظة تنفيذية على الطلب${requestId ? ` | request_id: ${requestId}` : ""}`,
        old_data: { notes: previous?.notes || null },
        new_data: { note: args.note, notes: mergedNotes, request_id: requestId || null },
      });

      return { success: true, result: { message: "تمت إضافة الملاحظة بنجاح", assignment_id: assignmentId, request_id: requestId || null, note: args.note } };
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
          _reason: args.reason || AI.actionVia("تحديث جماعي"),
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
        .select("*, clients(name_ar, phone, email, client_type), subjects(city_ar, district_ar, address_ar, land_area, building_area, property_type, description_ar), valuation_requests(total_fees, payment_status, valuation_mode, property_description_ar, purpose)");

      if (args.assignment_id) query = query.eq("id", args.assignment_id);
      else if (args.reference_number) query = query.ilike("reference_number", `%${args.reference_number}%`);
      else return { success: false, result: null, error: "يجب تحديد معرّف المهمة أو الرقم المرجعي" };

      const { data: assignment, error: assignmentError } = await query.maybeSingle();
      if (assignmentError) {
        console.error("[get_assignment_details] Query error:", JSON.stringify(assignmentError));
        return { success: false, result: null, error: `خطأ في الاستعلام: ${assignmentError.message}` };
      }
      if (!assignment) return { success: false, result: null, error: `لم يتم العثور على الطلب (assignment_id: ${args.assignment_id || '—'}, ref: ${args.reference_number || '—'})` };

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
      const totalPaid = payments.filter((p: any) => p.payment_status === "paid" || p.payment_status === "completed").reduce((s: number, p: any) => s + (p.amount || 0), 0);

      // ── Arabic label maps ──
      const STATUS_AR: Record<string, string> = {
        submitted: "مقدّم", pending: "قيد الانتظار", intake: "استلام", sow_pending: "بانتظار نطاق العمل",
        sow_approved: "نطاق العمل معتمد", quotation_sent: "عرض السعر مرسل", quotation_approved: "عرض السعر معتمد",
        first_payment_pending: "بانتظار الدفعة الأولى", first_payment_confirmed: "الدفعة الأولى مؤكدة",
        inspection_scheduled: "المعاينة مجدولة", inspection_completed: "المعاينة مكتملة",
        data_collection: "جمع البيانات", valuation_in_progress: "التقييم جارٍ",
        review: "قيد المراجعة", draft_ready: "المسودة جاهزة", draft_sent: "المسودة مرسلة",
        client_approved: "معتمد من العميل", final_payment_pending: "بانتظار الدفعة النهائية",
        final_payment_confirmed: "الدفعة النهائية مؤكدة", completed: "مكتمل", cancelled: "ملغى",
        archived: "مؤرشف", on_hold: "معلّق",
      };
      const PROP_TYPE_AR: Record<string, string> = {
        residential: "سكني", commercial: "تجاري", industrial: "صناعي", land: "أرض",
        mixed_use: "متعدد الاستخدام", agricultural: "زراعي", special_purpose: "أغراض خاصة",
        machinery: "آلات ومعدات", business: "منشأة تجارية", vehicle: "مركبة", equipment: "معدات",
      };
      const VAL_TYPE_AR: Record<string, string> = {
        real_estate: "عقار", machinery: "آلات ومعدات", business: "منشأة تجارية",
        vehicle: "مركبة", equipment: "معدات",
      };
      const PURPOSE_AR: Record<string, string> = {
        sale_purchase: "بيع/شراء", financing: "تمويل", insurance: "تأمين",
        legal: "قانوني/قضائي", financial_reporting: "تقارير مالية",
        zakat_tax: "زكاة وضريبة", other: "أخرى",
      };
      const MODE_AR: Record<string, string> = {
        field: "معاينة ميدانية", desktop_with_photos: "مكتبي بصور", desktop_without_photos: "مكتبي بدون صور",
      };
      const PAY_STATUS_AR: Record<string, string> = {
        unpaid: "غير مدفوع", partial: "مدفوع جزئياً", paid: "مدفوع بالكامل",
        completed: "مدفوع بالكامل", pending: "قيد الانتظار", overdue: "متأخر",
      };
      const CLIENT_TYPE_AR: Record<string, string> = {
        individual: "فرد", company: "شركة", government: "جهة حكومية",
      };
      const INSP_STATUS_AR: Record<string, string> = {
        scheduled: "مجدولة", in_progress: "جارية", completed: "مكتملة",
        submitted: "مُسلَّمة", reviewed: "مُراجَعة", cancelled: "ملغاة",
      };

      const rawMode = req?.valuation_mode || assignment.valuation_mode || "";
      const rawStatus = assignment.status || "";
      const rawPurpose = assignment.purpose || req?.purpose || "";
      const rawPropType = assignment.property_type || "";
      const rawValType = assignment.valuation_type || "";
      const rawPayStatus = req?.payment_status || "";
      const rawClientType = client?.client_type || "";
      const rawInspStatus = inspRes.data?.[0]?.status || "";

      // Build missing items list
      const missingItems: string[] = [];
      if (!subject) missingItems.push("بيانات الأصل/العقار غير مسجلة");
      if (!client?.phone && !client?.email) missingItems.push("بيانات تواصل العميل ناقصة");
      if (!req?.total_fees) missingItems.push("لم يتم التسعير بعد");
      if (!inspRes.data?.length && rawMode === "field") missingItems.push("المعاينة الميدانية غير مجدولة");

      // Determine next step
      let nextStep = "متابعة سير العمل";
      if (rawStatus === "submitted") nextStep = "مراجعة الطلب وتأكيد التصنيف ثم توليد نطاق العمل";
      else if (rawStatus === "sow_pending") nextStep = "اعتماد نطاق العمل من العميل";
      else if (rawStatus === "quotation_sent") nextStep = "انتظار موافقة العميل على عرض السعر";
      else if (rawStatus === "first_payment_pending") nextStep = "تأكيد استلام الدفعة الأولى";
      else if (rawStatus === "first_payment_confirmed" || rawStatus === "inspection_scheduled") nextStep = "تنفيذ المعاينة الميدانية";
      else if (rawStatus === "inspection_completed" || rawStatus === "data_collection") nextStep = "جمع البيانات وتحليل المقارنات";
      else if (rawStatus === "valuation_in_progress") nextStep = "إكمال التقييم وإعداد المسودة";
      else if (rawStatus === "review") nextStep = "مراجعة التقرير والتحقق من الامتثال";
      else if (rawStatus === "draft_ready" || rawStatus === "draft_sent") nextStep = "انتظار اعتماد العميل للمسودة";
      else if (rawStatus === "final_payment_pending") nextStep = "تأكيد الدفعة النهائية وإصدار التقرير";
      else if (rawStatus === "completed") nextStep = "الطلب مكتمل — لا إجراءات مطلوبة";

      // Build clean result — only non-empty values, Arabic only
      const result: Record<string, any> = {
        رقم_الطلب: assignment.reference_number,
        الحالة: STATUS_AR[rawStatus] || rawStatus,
      };

      const purposeAr = PURPOSE_AR[rawPurpose] || "";
      if (purposeAr) result["الغرض"] = purposeAr;

      const propTypeAr = PROP_TYPE_AR[rawPropType] || VAL_TYPE_AR[rawValType] || "";
      if (propTypeAr) result["نوع_الأصل"] = propTypeAr;

      const modeAr = MODE_AR[rawMode] || "";
      if (modeAr) result["وضع_التنفيذ"] = modeAr;

      if (assignment.final_value) {
        result["القيمة_النهائية"] = Number(assignment.final_value).toLocaleString() + " ر.س";
      }

      // Inspection — only if relevant
      if (rawMode === "field" || rawInspStatus) {
        result["المعاينة"] = {
          الحالة: rawInspStatus ? (INSP_STATUS_AR[rawInspStatus] || "غير محددة") : "غير مجدولة",
        };
        if (inspectorName !== "—") result["المعاينة"]["المعاين"] = inspectorName;
        if (inspRes.data?.[0]?.inspection_date) result["المعاينة"]["التاريخ"] = inspRes.data[0].inspection_date;
      }

      // Payment — always relevant
      const payStatusAr = PAY_STATUS_AR[rawPayStatus] || "";
      if (payStatusAr || totalPaid > 0 || req?.total_fees) {
        result["المالية"] = {};
        if (req?.total_fees) result["المالية"]["الرسوم"] = `${Number(req.total_fees).toLocaleString()} ر.س`;
        if (totalPaid > 0) result["المالية"]["المدفوع"] = `${totalPaid.toLocaleString()} ر.س`;
        if (payStatusAr) result["المالية"]["حالة_السداد"] = payStatusAr;
      }

      // Asset summary — compact
      if (subject) {
        const assetInfo: Record<string, string> = {};
        if (subject.city_ar) assetInfo["المدينة"] = subject.city_ar;
        if (subject.district_ar) assetInfo["الحي"] = subject.district_ar;
        if (subject.land_area) assetInfo["مساحة_الأرض"] = `${subject.land_area} م²`;
        if (subject.building_area) assetInfo["مساحة_البناء"] = `${subject.building_area} م²`;
        if (Object.keys(assetInfo).length > 0) result["الأصل"] = assetInfo;
      }

      // Client — compact
      if (client?.name_ar) {
        result["العميل"] = client.name_ar;
        const clientTypeAr = CLIENT_TYPE_AR[rawClientType] || "";
        if (clientTypeAr) result["العميل"] += ` (${clientTypeAr})`;
      }

      // Missing items
      if (missingItems.length > 0) result["النواقص"] = missingItems;

      // Next step — always present
      result["الخطوة_التالية"] = nextStep;

      return { success: true, result };
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
        _reason: AI.actionVia("إصدار التقرير النهائي"),
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
        description: `تأكيد استلام دفعة عبر ${AI.name}${args.notes ? ' — ' + args.notes : ''}`,
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

    // ═══════════════ CLIENT Tools Execution ═══════════════
    if (toolName === "track_my_requests") {
      // Get user from auth context — for now, fetch all recent
      const { data: requests } = await db.from("valuation_requests")
        .select("id, assignment_id, status, client_name_ar, property_type, created_at, total_price, amount_paid, payment_status, valuation_assignments(reference_number, status, final_value)")
        .order("created_at", { ascending: false })
        .limit(20);

      const activeStatuses = ["submitted", "scope_generated", "scope_approved", "first_payment_confirmed", "data_collection_open", "data_collection_complete", "inspection_pending", "inspection_completed", "data_validated", "analysis_complete", "professional_review", "draft_report_ready", "client_review", "draft_approved", "final_payment_confirmed"];
      const completedStatuses = ["issued", "archived"];

      let filtered = requests || [];
      if (args.status_filter === "active") filtered = filtered.filter((r: any) => activeStatuses.includes(r.valuation_assignments?.status || r.status));
      if (args.status_filter === "completed") filtered = filtered.filter((r: any) => completedStatuses.includes(r.valuation_assignments?.status || r.status));

      const statusLabels: Record<string, string> = {
        draft: "مسودة", submitted: "مقدم", scope_generated: "نطاق جاهز", scope_approved: "نطاق معتمد",
        first_payment_confirmed: "دفعة أولى مؤكدة", data_collection_open: "جمع بيانات", data_collection_complete: "بيانات مكتملة",
        inspection_pending: "معاينة معلقة", inspection_completed: "معاينة مكتملة", data_validated: "بيانات محققة",
        analysis_complete: "تحليل مكتمل", professional_review: "مراجعة مهنية", draft_report_ready: "مسودة جاهزة",
        client_review: "مراجعة العميل", draft_approved: "مسودة معتمدة", final_payment_confirmed: "دفعة نهائية",
        issued: "صادر", archived: "مؤرشف", cancelled: "ملغي",
      };

      return {
        success: true,
        result: {
          total: filtered.length,
          requests: filtered.map((r: any) => ({
            reference: r.valuation_assignments?.reference_number || "—",
            status: r.valuation_assignments?.status || r.status,
            status_label: statusLabels[r.valuation_assignments?.status || r.status] || r.status,
            property_type: r.property_type,
            total_price: r.total_price,
            amount_paid: r.amount_paid || 0,
            created: new Date(r.created_at).toLocaleDateString("ar-SA"),
          })),
        }
      };
    }

    if (toolName === "get_request_status") {
      let assignment: any = null;
      if (args.reference_number) {
        const { data } = await db.from("valuation_assignments")
          .select("*, clients(name_ar, phone), subjects(*), valuation_requests(total_price, amount_paid, payment_status, valuation_mode, property_description)")
          .ilike("reference_number", `%${args.reference_number}%`).limit(1).maybeSingle();
        assignment = data;
      } else if (args.assignment_id) {
        const { data } = await db.from("valuation_assignments")
          .select("*, clients(name_ar, phone), subjects(*), valuation_requests(total_price, amount_paid, payment_status, valuation_mode, property_description)")
          .eq("id", args.assignment_id).single();
        assignment = data;
      }
      if (!assignment) return { success: false, result: null, error: "لم يتم العثور على الطلب" };

      const subject = Array.isArray(assignment.subjects) ? assignment.subjects[0] : assignment.subjects;
      const req = Array.isArray(assignment.valuation_requests) ? assignment.valuation_requests[0] : assignment.valuation_requests;

      // Calculate timeline
      const createdDate = new Date(assignment.created_at);
      const modeMap: Record<string, number> = { field: 14, desktop_with_photos: 10, desktop_without_photos: 7 };
      const deliveryDays = modeMap[req?.valuation_mode || "field"] || 14;
      const estimatedDelivery = new Date(createdDate.getTime() + deliveryDays * 86400000);
      const remaining = Math.max(0, Math.ceil((estimatedDelivery.getTime() - Date.now()) / 86400000));

      const statusLabels: Record<string, string> = {
        draft: "مسودة", submitted: "مقدم وقيد المراجعة", scope_generated: "نطاق العمل جاهز — بانتظار موافقتك",
        scope_approved: "تمت الموافقة — بانتظار الدفعة الأولى", first_payment_confirmed: "بدأ العمل",
        data_collection_open: "جمع البيانات جارٍ", inspection_pending: "المعاينة مجدولة",
        inspection_completed: "تمت المعاينة — جارٍ التحليل", data_validated: "البيانات محققة",
        analysis_complete: "التحليل مكتمل", professional_review: "مراجعة مهنية من المقيم المعتمد",
        draft_report_ready: "المسودة جاهزة لمراجعتك", client_review: "بانتظار ملاحظاتك",
        draft_approved: "المسودة معتمدة — بانتظار الدفعة النهائية", final_payment_confirmed: "جارٍ إصدار التقرير",
        issued: "التقرير صدر ✅", archived: "مؤرشف",
      };

      return {
        success: true,
        result: {
          reference: assignment.reference_number,
          status: assignment.status,
          status_label: statusLabels[assignment.status] || assignment.status,
          property_type: assignment.property_type,
          location: { city: subject?.city_ar, district: subject?.district_ar },
          description: req?.property_description || "—",
          financials: { total_price: req?.total_price, paid: req?.amount_paid || 0, remaining: (req?.total_price || 0) - (req?.amount_paid || 0) },
          timeline: { created: createdDate.toLocaleDateString("ar-SA"), estimated_delivery: estimatedDelivery.toLocaleDateString("ar-SA"), days_remaining: remaining },
        }
      };
    }

    if (toolName === "get_my_documents") {
      const [attachRes, reqDocRes] = await Promise.all([
        db.from("attachments").select("file_name, category, mime_type, created_at, file_size").eq("assignment_id", args.assignment_id),
        db.from("request_documents").select("file_name, mime_type, ai_category, created_at").eq("request_id", args.assignment_id),
      ]);

      const docs = [...(attachRes.data || []), ...(reqDocRes.data || [])];
      return {
        success: true,
        result: {
          total: docs.length,
          documents: docs.map((d: any) => ({
            name: d.file_name,
            category: d.category || d.ai_category || "عام",
            type: d.mime_type,
            date: new Date(d.created_at).toLocaleDateString("ar-SA"),
          })),
        }
      };
    }

    if (toolName === "get_my_payments") {
      let query = db.from("payments")
        .select("id, amount, payment_stage, payment_status, payment_type, created_at, paid_at")
        .order("created_at", { ascending: false }).limit(20);
      if (args.assignment_id) query = query.eq("assignment_id", args.assignment_id);

      const { data: payments } = await query;
      const stageLabels: Record<string, string> = { first: "الدفعة الأولى (50%)", final: "الدفعة النهائية (50%)", full: "دفعة كاملة" };
      const statusLabels: Record<string, string> = { pending: "بانتظار السداد", proof_uploaded: "إثبات مرفوع — قيد المراجعة", paid: "مدفوع ✅", rejected: "مرفوض" };

      return {
        success: true,
        result: {
          total: payments?.length || 0,
          payments: (payments || []).map((p: any) => ({
            amount: p.amount,
            stage: stageLabels[p.payment_stage] || p.payment_stage,
            status: statusLabels[p.payment_status] || p.payment_status,
            type: p.payment_type,
            date: new Date(p.created_at).toLocaleDateString("ar-SA"),
            paid_date: p.paid_at ? new Date(p.paid_at).toLocaleDateString("ar-SA") : null,
          })),
        }
      };
    }

    if (toolName === "get_delivery_timeline") {
      const { data: assignment } = await db.from("valuation_assignments")
        .select("status, created_at, updated_at, valuation_requests(valuation_mode)")
        .eq("id", args.assignment_id).single();
      if (!assignment) return { success: false, result: null, error: "الطلب غير موجود" };

      const req = Array.isArray(assignment.valuation_requests) ? assignment.valuation_requests[0] : assignment.valuation_requests;
      const mode = req?.valuation_mode || "field";
      const modeMap: Record<string, number> = { field: 14, desktop_with_photos: 10, desktop_without_photos: 7 };
      const totalDays = modeMap[mode] || 14;
      const created = new Date(assignment.created_at);
      const delivery = new Date(created.getTime() + totalDays * 86400000);
      const remaining = Math.max(0, Math.ceil((delivery.getTime() - Date.now()) / 86400000));

      const allStatuses = ["submitted", "scope_generated", "scope_approved", "first_payment_confirmed", "data_collection_open", "inspection_pending", "inspection_completed", "analysis_complete", "professional_review", "draft_report_ready", "client_review", "draft_approved", "final_payment_confirmed", "issued"];
      const currentIdx = allStatuses.indexOf(assignment.status);
      const progress = currentIdx >= 0 ? Math.round(((currentIdx + 1) / allStatuses.length) * 100) : 0;

      return {
        success: true,
        result: {
          current_status: assignment.status,
          progress_percentage: progress,
          total_days: totalDays,
          days_remaining: remaining,
          created_date: created.toLocaleDateString("ar-SA"),
          estimated_delivery: delivery.toLocaleDateString("ar-SA"),
          on_track: remaining > 0,
        }
      };
    }

    if (toolName === "submit_draft_feedback") {
      if (args.approve) {
        const { data: result, error } = await db.rpc("update_request_status", {
          _assignment_id: args.assignment_id, _new_status: "draft_approved",
          _user_id: null, _action_type: "auto", _reason: `موافقة العميل عبر ${AI.name}: ${args.feedback}`,
        });
        if (error || !result?.success) return { success: false, result: null, error: error?.message || result?.error || "فشل التحديث" };
        return { success: true, result: { message: "تمت الموافقة على المسودة بنجاح. الخطوة التالية: سداد الدفعة النهائية." } };
      }
      // Just feedback without approval
      await db.from("audit_logs").insert({
        action: "create", table_name: "client_feedback", record_id: args.assignment_id, assignment_id: args.assignment_id,
        description: `ملاحظات العميل على المسودة: ${args.feedback}`,
      });
      return { success: true, result: { message: "تم إرسال ملاحظاتك بنجاح. سيتم مراجعتها وتحديث المسودة." } };
    }

    if (toolName === "request_scope_approval") {
      if (args.approved !== false) {
        const { data: result, error } = await db.rpc("update_request_status", {
          _assignment_id: args.assignment_id, _new_status: "scope_approved",
          _user_id: null, _action_type: "auto", _reason: "موافقة العميل على نطاق العمل عبر ${AI.name}",
        });
        if (error || !result?.success) return { success: false, result: null, error: error?.message || result?.error || "فشل التحديث" };
        return { success: true, result: { message: "تمت الموافقة على نطاق العمل. الخطوة التالية: سداد الدفعة الأولى (50%)." } };
      }
      return { success: true, result: { message: "تم تسجيل رفضك. يرجى توضيح ملاحظاتك ليتم مراجعة النطاق." } };
    }

    if (toolName === "cancel_my_request") {
      const { data: result, error } = await db.rpc("update_request_status", {
        _assignment_id: args.assignment_id, _new_status: "cancelled",
        _user_id: null, _action_type: "auto", _reason: `إلغاء بطلب العميل: ${args.reason}`,
      });
      if (error || !result?.success) return { success: false, result: null, error: error?.message || result?.error || "لا يمكن الإلغاء من الحالة الحالية" };
      return { success: true, result: { message: `تم إلغاء الطلب بنجاح. السبب: ${args.reason}` } };
    }

    if (toolName === "get_missing_requirements") {
      const [subjRes, attachRes, inspRes, compRes, assumRes] = await Promise.all([
        db.from("subjects").select("id, city_ar, land_area").eq("assignment_id", args.assignment_id),
        db.from("attachments").select("id, category").eq("assignment_id", args.assignment_id),
        db.from("inspections").select("id, completed, status").eq("assignment_id", args.assignment_id).limit(1),
        db.from("assignment_comparables").select("id").eq("assignment_id", args.assignment_id),
        db.from("assumptions").select("id").eq("assignment_id", args.assignment_id),
      ]);

      const missing: string[] = [];
      if (!(subjRes.data?.length)) missing.push("بيانات العقار (موقع، مساحة)");
      if ((attachRes.data?.length || 0) < 2) missing.push("مستندات داعمة (صك، رخصة، الخ)");
      const photoCategories = (attachRes.data || []).map((a: any) => a.category);
      if (!photoCategories.includes("photo")) missing.push("صور العقار");
      if (!photoCategories.includes("deed")) missing.push("صورة الصك");

      return {
        success: true,
        result: {
          total_missing: missing.length,
          missing_items: missing,
          documents_uploaded: attachRes.data?.length || 0,
          status: missing.length === 0 ? "مكتمل ✅" : `${missing.length} متطلبات ناقصة ⚠️`,
        }
      };
    }

    // ═══════════════ New Inspector Tools ═══════════════
    if (toolName === "get_inspection_checklist") {
      const { data: items } = await db.from("inspection_checklist_items")
        .select("id, category, label_ar, is_checked, is_required, value, notes, sort_order")
        .eq("inspection_id", args.inspection_id)
        .order("sort_order", { ascending: true });

      const total = items?.length || 0;
      const checked = (items || []).filter((i: any) => i.is_checked).length;
      const required = (items || []).filter((i: any) => i.is_required);
      const requiredMissing = required.filter((i: any) => !i.is_checked);

      return {
        success: true,
        result: {
          total, checked, remaining: total - checked,
          required_missing: requiredMissing.length,
          completion: total > 0 ? Math.round((checked / total) * 100) : 0,
          items: (items || []).map((i: any) => ({
            id: i.id, category: i.category, label: i.label_ar,
            checked: i.is_checked, required: i.is_required, value: i.value, notes: i.notes,
          })),
        }
      };
    }

    if (toolName === "update_checklist_item") {
      const updateData: any = { is_checked: args.is_checked };
      if (args.value) updateData.value = args.value;
      if (args.notes) updateData.notes = args.notes;

      const { error } = await db.from("inspection_checklist_items").update(updateData).eq("id", args.item_id);
      if (error) return { success: false, result: null, error: error.message };
      return { success: true, result: { message: `تم تحديث البند ${args.is_checked ? "✅" : "❌"}` } };
    }

    if (toolName === "get_my_photos_status") {
      const { data: photos } = await db.from("inspection_photos")
        .select("id, category, file_name, created_at")
        .eq("inspection_id", args.inspection_id);

      const categoryCounts: Record<string, number> = {};
      for (const p of (photos || [])) categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;

      const requiredCategories = ["exterior", "interior", "entrance", "street", "surroundings"];
      const missingCategories = requiredCategories.filter(c => !categoryCounts[c]);

      return {
        success: true,
        result: {
          total_photos: photos?.length || 0,
          by_category: categoryCounts,
          missing_categories: missingCategories,
          status: missingCategories.length === 0 ? "مكتمل ✅" : `${missingCategories.length} فئات ناقصة`,
        }
      };
    }

    if (toolName === "get_my_performance") {
      // Need user_id from context — use the auth header
      const { data: inspections } = await db.from("inspections")
        .select("id, status, completed, inspection_date, duration_minutes")
        .order("created_at", { ascending: false }).limit(100);

      const total = inspections?.length || 0;
      const completed = (inspections || []).filter((i: any) => i.completed).length;
      const avgDuration = (inspections || [])
        .filter((i: any) => i.duration_minutes)
        .reduce((s: number, i: any, _, arr) => s + (i.duration_minutes / arr.length), 0);

      const { data: evals } = await db.from("inspector_evaluations")
        .select("rating, quality_score, speed_score, notes")
        .order("created_at", { ascending: false }).limit(10);

      const avgRating = (evals || []).length > 0
        ? (evals || []).reduce((s: number, e: any) => s + e.rating, 0) / evals!.length : 0;

      return {
        success: true,
        result: {
          total_tasks: total, completed_tasks: completed,
          completion_rate: total > 0 ? Math.round((completed / total) * 100) : 0,
          avg_duration_minutes: Math.round(avgDuration),
          avg_rating: Math.round(avgRating * 10) / 10,
          recent_evaluations: (evals || []).slice(0, 3).map((e: any) => ({
            rating: e.rating, quality: e.quality_score, speed: e.speed_score, notes: e.notes,
          })),
        }
      };
    }

    if (toolName === "request_task_postponement") {
      const { error } = await db.from("inspections")
        .update({ status: "postponed", notes_ar: `طلب تأجيل: ${args.reason}${args.suggested_date ? ` | التاريخ البديل: ${args.suggested_date}` : ""}`, updated_at: new Date().toISOString() })
        .eq("id", args.inspection_id);
      if (error) return { success: false, result: null, error: error.message };

      // Notify admin
      await db.from("notifications").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        title_ar: "طلب تأجيل معاينة",
        body_ar: `معاين يطلب تأجيل معاينة. السبب: ${args.reason}`,
        category: "inspection", priority: "high",
        notification_type: "postponement_request", channel: "in_app", delivery_status: "delivered",
      });

      return { success: true, result: { message: "تم إرسال طلب التأجيل للإدارة" } };
    }

    // ═══════════════ New CFO Tools ═══════════════
    if (toolName === "reject_payment_proof") {
      const { error } = await db.from("payments")
        .update({ payment_status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", args.payment_id);
      if (error) return { success: false, result: null, error: error.message };

      await db.from("audit_logs").insert({
        action: "status_change", table_name: "payments", record_id: args.payment_id,
        description: `رفض إثبات دفع — السبب: ${args.rejection_reason}`,
      });

      return { success: true, result: { message: `تم رفض الإثبات. السبب: ${args.rejection_reason}` } };
    }

    if (toolName === "get_aging_report") {
      const { data: invoices } = await db.from("invoices")
        .select("id, total_amount, due_date, payment_status")
        .in("payment_status", ["pending", "overdue", "unpaid"])
        .limit(500);

      const now = Date.now();
      const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
      const bucketCounts = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };

      for (const inv of (invoices || [])) {
        const daysLate = Math.max(0, Math.floor((now - new Date(inv.due_date).getTime()) / 86400000));
        const bucket = daysLate <= 30 ? "0-30" : daysLate <= 60 ? "31-60" : daysLate <= 90 ? "61-90" : "90+";
        buckets[bucket] += inv.total_amount || 0;
        bucketCounts[bucket]++;
      }

      return {
        success: true,
        result: {
          total_outstanding: Object.values(buckets).reduce((s, v) => s + v, 0),
          total_invoices: invoices?.length || 0,
          aging: Object.entries(buckets).map(([range, amount]) => ({
            range: `${range} يوم`,
            amount,
            count: bucketCounts[range as keyof typeof bucketCounts],
          })),
        }
      };
    }

    if (toolName === "get_client_payment_history") {
      let clientQuery = db.from("clients").select("id, name_ar");
      if (args.client_id) clientQuery = clientQuery.eq("id", args.client_id);
      else if (args.client_name) clientQuery = clientQuery.ilike("name_ar", `%${args.client_name}%`);
      const { data: client } = await clientQuery.limit(1).maybeSingle();
      if (!client) return { success: false, result: null, error: "لم يتم العثور على العميل" };

      const { data: assignments } = await db.from("valuation_assignments").select("id").eq("client_id", client.id);
      const assignIds = (assignments || []).map((a: any) => a.id);

      let payments: any[] = [];
      if (assignIds.length > 0) {
        const { data } = await db.from("payments").select("amount, payment_status, payment_stage, created_at, paid_at").in("assignment_id", assignIds).order("created_at", { ascending: false });
        payments = data || [];
      }

      const paid = payments.filter((p: any) => p.payment_status === "paid");
      const late = payments.filter((p: any) => p.payment_status === "overdue");

      return {
        success: true,
        result: {
          client_name: client.name_ar,
          total_transactions: payments.length,
          total_paid: paid.reduce((s: number, p: any) => s + (p.amount || 0), 0),
          on_time_rate: payments.length > 0 ? Math.round((paid.length / payments.length) * 100) : 0,
          late_payments: late.length,
          discipline: late.length === 0 ? "ممتاز ✅" : late.length <= 2 ? "جيد 🟡" : "يحتاج متابعة 🔴",
        }
      };
    }

    if (toolName === "get_daily_cash_flow") {
      const targetDate = args.date || new Date().toISOString().split("T")[0];
      const dayStart = `${targetDate}T00:00:00.000Z`;
      const dayEnd = `${targetDate}T23:59:59.999Z`;

      const { data: dayPayments } = await db.from("payments")
        .select("amount, payment_status, paid_at")
        .gte("paid_at", dayStart).lte("paid_at", dayEnd).eq("payment_status", "paid");

      const { data: pendingDue } = await db.from("invoices")
        .select("total_amount, due_date")
        .eq("due_date", targetDate).in("payment_status", ["pending", "unpaid"]);

      const collected = (dayPayments || []).reduce((s: number, p: any) => s + (p.amount || 0), 0);
      const expected = (pendingDue || []).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);

      return {
        success: true,
        result: {
          date: targetDate,
          collected,
          expected,
          transactions: dayPayments?.length || 0,
          pending_invoices: pendingDue?.length || 0,
        }
      };
    }

    if (toolName === "send_bulk_payment_reminders") {
      const daysMin = args.days_overdue || 7;
      const cutoff = new Date(Date.now() - daysMin * 86400000).toISOString();

      const { data: overdueInvoices } = await db.from("invoices")
        .select("id, client_id, total_amount, clients(name_ar, portal_user_id)")
        .in("payment_status", ["pending", "unpaid", "overdue"])
        .lt("due_date", cutoff)
        .limit(50);

      let sentCount = 0;
      for (const inv of (overdueInvoices || [])) {
        const userId = inv.clients?.portal_user_id;
        if (!userId) continue;
        await db.from("notifications").insert({
          user_id: userId,
          title_ar: "تذكير بسداد فاتورة متأخرة",
          body_ar: `لديك فاتورة بمبلغ ${inv.total_amount} ر.س بانتظار السداد. يرجى المبادرة بالدفع.`,
          category: "payment", priority: "high",
          notification_type: "payment_reminder", channel: "in_app", delivery_status: "delivered",
        });
        sentCount++;
      }

      return { success: true, result: { message: `تم إرسال ${sentCount} تذكير دفع`, total_overdue: overdueInvoices?.length || 0, sent: sentCount } };
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
    const { messages, correction, userRole, userId, attachments = [], platformContext } = await req.json();
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

    // ── Identify user from auth token or userId ──
    let authenticatedUserId = userId || null;
    let userName = "";
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (token && !authenticatedUserId) {
      try {
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
        const { data: { user: authUser } } = await userClient.auth.getUser(token);
        if (authUser) {
          authenticatedUserId = authUser.id;
          userName = authUser.user_metadata?.full_name || authUser.user_metadata?.name || "";
        }
      } catch (_e) { /* ignore */ }
    }

    // Fetch user name if we have ID but no name
    if (authenticatedUserId && !userName) {
      try {
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("full_name_ar, full_name_en")
          .or(`user_id.eq.${authenticatedUserId},id.eq.${authenticatedUserId}`)
          .maybeSingle();
        if (profile?.full_name_ar || profile?.full_name_en) {
          userName = profile.full_name_ar || profile.full_name_en || "";
        }
        else {
          const { data: { user: authU } } = await supabaseClient.auth.admin.getUserById(authenticatedUserId);
          userName = authU?.user_metadata?.full_name || authU?.user_metadata?.name || "";
        }
      } catch (_e) { /* ignore */ }
    }

    // ── Load Executive Memory Profile ──
    let memoryProfileSection = "";
    if (authenticatedUserId) {
      try {
        const { data: memProfile } = await supabaseClient
          .from("executive_memory_profiles")
          .select("*")
          .eq("user_id", authenticatedUserId)
          .eq("is_active", true)
          .maybeSingle();

        if (memProfile) {
          const style = memProfile.communication_style || {};
          memoryProfileSection = `\n\n## ⚙️ ملف المستخدم التنفيذي (Executive Memory Profile)`;
          memoryProfileSection += `\n- الاسم: **${memProfile.display_name_ar || memProfile.display_name_en || ""}**`;
          memoryProfileSection += `\n- المسمى: ${memProfile.role_title_ar || memProfile.role_title_en || ""}`;
          memoryProfileSection += `\n- اللغة: ${memProfile.preferred_language === "ar" ? "العربية فقط" : memProfile.preferred_language}`;
          if (memProfile.domain_context) {
            memoryProfileSection += `\n- السياق المهني: ${memProfile.domain_context}`;
          }
          if (style.brevity === "extreme") memoryProfileSection += `\n- ⚡ اختصار شديد مطلوب — لا مقدمات ولا حشو`;
          if (style.format_preference === "tables_and_numbers") memoryProfileSection += `\n- 📊 يفضل الجداول والأرقام الدقيقة`;
          if (style.no_english_reading) memoryProfileSection += `\n- 🚫 لا يقرأ الإنجليزية — كل شيء بالعربية`;
          if (style.no_filler) memoryProfileSection += `\n- أسلوب مباشر بلا تزيين`;

          if (memProfile.behavior_directives?.length > 0) {
            memoryProfileSection += `\n\n### تعليمات السلوك الشخصية:\n`;
            memoryProfileSection += memProfile.behavior_directives.map((d: string, i: number) => `${i + 1}. ${d}`).join("\n");
          }
          if (memProfile.context_rules?.length > 0) {
            memoryProfileSection += `\n\n### قواعد السياق:\n`;
            memoryProfileSection += memProfile.context_rules.map((r: string) => `• ${r}`).join("\n");
          }
          memoryProfileSection += `\n\n**⚠️ هذه التعليمات دائمة ومُلزمة في كل جلسة — لا تتجاهلها أبداً.**`;
        }
      } catch (e) {
        console.error("Memory profile fetch error:", e);
      }
    }

    let knownClientName = "";

    // Handle correction submission
    if (correction) {
      if (!authenticatedUserId) {
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
        corrected_by: authenticatedUserId,
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

    // ── Auto-fetch client context (requests, payments) for client role ──
    let clientContextSection = "";
    if (effectiveRole === "client" && authenticatedUserId) {
      try {
        // Fetch client's requests via portal_user_id linkage
        const { data: clientRecord } = await supabaseClient
          .from("clients")
          .select("id, name_ar, name_en")
          .eq("portal_user_id", authenticatedUserId)
          .maybeSingle();

        const clientName = clientRecord?.name_ar || userName || "";
        const clientId = clientRecord?.id;
        knownClientName = clientName || knownClientName;

        clientContextSection = `\n\n## بيانات العميل الحالي`;
        clientContextSection += `\n- اسم العميل: **${clientName || "غير معروف"}**`;
        clientContextSection += `\n- معرّف المستخدم: ${authenticatedUserId}`;

        if (clientId) {
          // Fetch their active requests
          const { data: requests } = await supabaseClient
            .from("valuation_requests")
            .select("id, assignment_id, status, client_name_ar, property_type, created_at, total_price, amount_paid, payment_status, valuation_assignments(id, reference_number, status, final_value, valuation_mode)")
            .eq("client_id", clientId)
            .order("created_at", { ascending: false })
            .limit(10);

          if (requests && requests.length > 0) {
            const statusLabels: Record<string, string> = {
              draft: "مسودة", submitted: "مقدم", scope_generated: "نطاق جاهز", scope_approved: "نطاق معتمد",
              first_payment_confirmed: "دفعة أولى مؤكدة", data_collection_open: "جمع بيانات",
              inspection_pending: "معاينة معلقة", inspection_completed: "معاينة مكتملة",
              analysis_complete: "تحليل مكتمل", professional_review: "مراجعة مهنية",
              draft_report_ready: "مسودة جاهزة", client_review: "مراجعة العميل",
              draft_approved: "مسودة معتمدة", final_payment_confirmed: "دفعة نهائية",
              issued: "صادر ✅", archived: "مؤرشف", cancelled: "ملغي",
            };

            clientContextSection += `\n\n### طلبات العميل (${requests.length} طلب)\n`;
            for (const r of requests) {
              const assignment = Array.isArray(r.valuation_assignments) ? r.valuation_assignments[0] : r.valuation_assignments;
              const st = assignment?.status || r.status;
              clientContextSection += `• **${assignment?.reference_number || "—"}** | ${statusLabels[st] || st} | ${r.property_type || "غير محدد"} | ${r.total_price ? r.total_price + " ر.س" : "بدون تسعير"} | ${new Date(r.created_at).toLocaleDateString("ar-SA")}\n`;
            }
            clientContextSection += `\n**تعليمات**: عند سؤال العميل عن طلباته، اعرض هذه البيانات مباشرة دون طلب أي رقم مرجعي منه. أنت تعرف كل طلباته.`;
          } else {
            clientContextSection += `\n- لا توجد طلبات سابقة لهذا العميل.`;
          }
        } else {
          // Client might not be linked yet — try via client_user_id in requests
          const { data: requests } = await supabaseClient
            .from("valuation_requests")
            .select("id, assignment_id, status, client_name_ar, property_type, created_at, total_price, amount_paid, payment_status, valuation_assignments(id, reference_number, status, final_value)")
            .eq("client_user_id", authenticatedUserId)
            .order("created_at", { ascending: false })
            .limit(10);

          if (requests && requests.length > 0) {
            knownClientName = requests[0]?.client_name_ar || knownClientName;
            clientContextSection += `\n\n### طلبات العميل (${requests.length} طلب)\n`;
            const statusLabels: Record<string, string> = {
              draft: "مسودة", submitted: "مقدم", scope_generated: "نطاق جاهز", scope_approved: "نطاق معتمد",
              first_payment_confirmed: "دفعة أولى مؤكدة", issued: "صادر ✅", cancelled: "ملغي",
            };
            for (const r of requests) {
              const assignment = Array.isArray(r.valuation_assignments) ? r.valuation_assignments[0] : r.valuation_assignments;
              const st = assignment?.status || r.status;
              clientContextSection += `• **${assignment?.reference_number || "—"}** | ${statusLabels[st] || st} | ${r.property_type || "غير محدد"} | ${new Date(r.created_at).toLocaleDateString("ar-SA")}\n`;
            }
            clientContextSection += `\n**تعليمات**: اعرض هذه البيانات مباشرة دون طلب رقم مرجعي. أنت تعرف العميل وطلباته.`;
          }
        }
      } catch (e) {
        console.error("Client context fetch error:", e);
      }
    }

    const latestUserText = [...messages]
      .reverse()
      .find((msg: any) => msg?.role === "user" && typeof msg.content === "string")?.content || "";
    const imageAttachments = (attachments as ChatAttachment[]).filter(isImageAttachment);
    const attachmentIntelligenceSection = buildAttachmentIntelligenceSection(attachments as ChatAttachment[], latestUserText);

    // ── User greeting section for all roles ──
    const greetingName = userName || knownClientName;
    let greetingInstruction = "";
    if (greetingName) {
      greetingInstruction = `\n\n## المستخدم الحالي\nاسم المستخدم: **${greetingName}**\n- في أول رسالة: رحّب باسمه. في الرسائل التالية: ادخل مباشرة في الإجابة.\n`;
    }

    const normalizedMessages = messages.map((msg: any, index: number) => {
      const isLatestUserMessage = index === messages.length - 1 && msg?.role === "user";
      if (!isLatestUserMessage || imageAttachments.length === 0) return msg;

      const fallbackPrompt = "حلّل الصور المرفقة بصرياً وحدد نوع الأصل الظاهر والحالة الظاهرية والخطوة التالية المناسبة دون طلب معلومات معروفة مسبقاً.";
      const baseText = hasMeaningfulText(msg.content) && !/^تم إرفاق\s+\d+\s+ملف/.test(msg.content.trim())
        ? msg.content
        : fallbackPrompt;

      return {
        role: "user",
        content: [
          { type: "text", text: baseText },
          ...imageAttachments.slice(0, 4).map((image) => ({
            type: "image_url",
            image_url: { url: image.url! },
          })),
        ],
      };
    });

    // ── Build Platform Context Section ──
    let platformContextSection = "";
    if (platformContext && typeof platformContext === "object") {
      const pc = platformContext;
      if (pc.assignment_id || pc.request_id || pc.reference_number) {
        platformContextSection = `\n\n## 🔗 سياق المنصة الحالي (محمّل تلقائياً)`;
        if (pc.reference_number) platformContextSection += `\n- رقم الطلب: **${pc.reference_number}**`;
        if (pc.assignment_id) platformContextSection += `\n- معرّف المهمة: ${pc.assignment_id}`;
        if (pc.request_id) platformContextSection += `\n- معرّف الطلب: ${pc.request_id}`;
        if (pc.current_status) {
          const statusLabels: Record<string, string> = {
            draft: "مسودة", submitted: "مقدم", scope_generated: "نطاق جاهز", scope_approved: "نطاق معتمد",
            first_payment_confirmed: "دفعة أولى مؤكدة", data_collection_open: "جمع بيانات",
            data_collection_complete: "جمع بيانات مكتمل", inspection_pending: "معاينة معلقة",
            inspection_completed: "معاينة مكتملة", data_validated: "بيانات مُعتمدة",
            analysis_complete: "تحليل مكتمل", professional_review: "مراجعة مهنية",
            draft_report_ready: "مسودة جاهزة", client_review: "مراجعة العميل",
            draft_approved: "مسودة معتمدة", final_payment_confirmed: "دفعة نهائية",
            issued: "صادر ✅", archived: "مؤرشف", cancelled: "ملغي",
          };
          platformContextSection += `\n- المرحلة الحالية: **${statusLabels[pc.current_status] || pc.current_status}**`;
        }
        if (pc.property_type) platformContextSection += `\n- نوع العقار: ${pc.property_type}`;
        if (pc.client_name) platformContextSection += `\n- العميل: ${pc.client_name}`;
        if (pc.source_page) platformContextSection += `\n- مصدر الانتقال: ${pc.source_page}`;

        // Fetch full assignment details for deep context
        if (pc.assignment_id) {
          try {
            const { data: fullAssignment } = await supabaseClient
              .from("valuation_assignments")
              .select("id, reference_number, status, property_type, purpose, basis_of_value, valuation_type, valuation_mode, final_value, notes, inspector_id, created_at, updated_at, clients(name_ar, phone, email)")
              .eq("id", pc.assignment_id)
              .maybeSingle();
            if (fullAssignment) {
              if (!pc.reference_number && fullAssignment.reference_number) platformContextSection += `\n- رقم الطلب: **${fullAssignment.reference_number}**`;
              if (fullAssignment.purpose) platformContextSection += `\n- الغرض: ${fullAssignment.purpose}`;
              if (fullAssignment.valuation_mode) platformContextSection += `\n- نمط التقييم: ${fullAssignment.valuation_mode}`;
              if (fullAssignment.final_value) platformContextSection += `\n- القيمة النهائية: ${fullAssignment.final_value} ر.س`;
              if (fullAssignment.notes) platformContextSection += `\n- ملاحظات: ${fullAssignment.notes}`;
            }
          } catch (e) { console.error("Platform context fetch error:", e); }
        }

        platformContextSection += `\n\n**⚠️ تعليمات السياق:**`;
        platformContextSection += `\n- هذا الطلب محمّل تلقائياً — لا تطلب رقمه من المستخدم`;
        platformContextSection += `\n- عند طلب إجراء (حالة، ملاحظة، تفاصيل)، استخدم المعرّفات أعلاه مباشرة`;
        platformContextSection += `\n- إذا طلب المستخدم "حالة الطلب" أو "تفاصيل الطلب" بدون تحديد رقم، يُقصد هذا الطلب المحمّل`;
      }
    }

    // Build contextual system prompt with role-specific additions
    const basePrompt = await buildContextualPrompt(supabaseClient);
    const systemPrompt = basePrompt
      + getRolePromptAddition(effectiveRole)
      + memoryProfileSection
      + platformContextSection
      + clientContextSection
      + greetingInstruction
      + attachmentIntelligenceSection
      + (imageAttachments.length > 0 ? `\n${buildMachineryVisionPromptLocal()}\n` : "");
    const roleTools = getToolsForRole(effectiveRole);

    const latestUserPlainText = typeof latestUserText === "string" ? latestUserText.trim() : "";
    const hasBoundContext = !!(platformContext && typeof platformContext === "object" && ((platformContext as any).assignment_id || (platformContext as any).request_id));
    const wantsCurrentRequestStatus = hasBoundContext && /(?:حالة|وضع|تفاصيل).*(?:هذا الطلب|الطلب الحالي)|(?:اعرض|ورني|هات).*(?:حالة|تفاصيل).*(?:هذا الطلب|الطلب الحالي)/.test(latestUserPlainText);
    const wantsPriorityUpdate = hasBoundContext && /(?:أولوية المتابعة|الأولوية).*(?:حدّث|تحديث|نفّذ|ارفع|عدّل)|(?:نفّذ|حدث|حدّث|ارفع|عدّل).*(?:أولوية المتابعة|الأولوية)/.test(latestUserPlainText);

    let preflightToolCalls: any[] = [];
    if (wantsCurrentRequestStatus) {
      preflightToolCalls.push({
        id: "preflight_get_assignment_details",
        type: "function",
        function: { name: "get_assignment_details", arguments: JSON.stringify({}) },
      });
    }
    if (wantsPriorityUpdate) {
      const priorityMatch = latestUserPlainText.match(/(urgent|critical|high|normal|low|عاجل(?:ة)?|حرج(?:ة)?|عالي(?:ة)?|متوسط(?:ة)?|منخفض(?:ة)?)/i);
      const priorityMap: Record<string, string> = {
        urgent: "urgent", critical: "critical", high: "high", normal: "normal", low: "low",
        "عاجل": "urgent", "عاجلة": "urgent", "حرج": "critical", "حرجة": "critical",
        "عالي": "high", "عالية": "high", "متوسط": "normal", "متوسطة": "normal",
        "منخفض": "low", "منخفضة": "low",
      };
      preflightToolCalls.push({
        id: "preflight_update_follow_up_priority",
        type: "function",
        function: {
          name: "update_follow_up_priority",
          arguments: JSON.stringify({
            priority: priorityMap[(priorityMatch?.[0] || "high").toLowerCase()] || "high",
            reason: "طلب مباشر من المستخدم داخل سياق الطلب الحالي",
          }),
        },
      });
    }

    let choice: any;
    if (preflightToolCalls.length > 0) {
      choice = {
        finish_reason: "tool_calls",
        message: {
          role: "assistant",
          content: null,
          tool_calls: preflightToolCalls,
        },
      };
    } else {
      const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5",
          messages: [
            { role: "system", content: systemPrompt },
            ...normalizedMessages,
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
      choice = firstData.choices?.[0];
    }

    // Check if AI wants to call tools
    if (choice?.finish_reason === "tool_calls" || choice?.message?.tool_calls?.length > 0) {
      const toolCalls = choice.message.tool_calls;
      const toolResults: any[] = [];

      // Send orchestration status event first
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          const db = createClient(supabaseUrl, supabaseServiceKey);

          const resolvedToolCalls = [];
          for (const tc of toolCalls) {
            const resolvedArgs = await resolveIdsFromContext(db, platformContext, JSON.parse(tc.function.arguments || "{}"));
            resolvedToolCalls.push({ ...tc, resolvedArgs });
          }

          const statusEvent = {
            type: "orchestration_status",
            tools: resolvedToolCalls.map((tc: any) => ({
              name: tc.function.name,
              args: tc.resolvedArgs,
              status: "running"
            }))
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "" }, orchestration: statusEvent }] })}\n\n`));

          for (const tc of resolvedToolCalls) {
            const args = tc.resolvedArgs;
            const result = await executeTool(tc.function.name, args, supabaseUrl, supabaseServiceKey, platformContext);
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
            ...normalizedMessages,
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
              model: "openai/gpt-5",
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
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          ...normalizedMessages,
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
