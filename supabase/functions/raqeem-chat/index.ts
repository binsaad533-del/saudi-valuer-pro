import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AI } from "../_shared/assistantIdentity.ts";
import { resolveIdsFromContext } from "./_tools/helpers.ts";
import { execute as executeValuationTools } from "./_tools/valuation-tools.ts";
import { execute as executeExecutiveTools } from "./_tools/executive-tools.ts";
import { execute as executeInspectorTools } from "./_tools/inspector-tools.ts";
import { execute as executeClientTools } from "./_tools/client-tools.ts";
import { execute as executeCfoTools } from "./_tools/cfo-tools.ts";

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
 
 ### الحظر المطلق (انتهاك أي منها = فشل كامل)
 - **ممنوع منعاً باتاً** عرض أي كلمة إنجليزية خام من قاعدة البيانات: لا submitted, لا field, لا residential, لا sale_purchase, لا desktop_with_photos, لا pending, لا any_english_value.
 - **ممنوع** عرض أسماء أدوات أو أسماء جداول أو أسماء أعمدة أو معرّفات UUID.
 - **ممنوع** عرض JSON خام أو بنية بيانات برمجية.
 - **ممنوع** قول "أحتاج رقم الطلب" أو "أرسل رقم الطلب" أو "اختر إجراء" عندما يكون السياق محمّلاً.
 - **ممنوع** عرض قوائم تعليمية من نوع "أرسل رقم الطلب الآن" أو "قل: اعرض طلباتي".
 - إذا كانت قيمة ما فارغة أو "—" أو null، **لا تعرض السطر إطلاقاً** — تجاوزه بصمت.
 
 ### بنية ملخص حالة الطلب (بالترتيب الدقيق)
 عند عرض حالة طلب، ابدأ فوراً بالملخص المنظم — بدون مقدمات أو عبارات ترحيبية:
 1. **رقم الطلب**
 2. **الحالة** (بالعربية فقط)
 3. **الغرض** (بالعربية فقط)
 4. **نوع الأصل** (بالعربية فقط)
 5. **وضع التنفيذ** (معاينة ميدانية / مكتبي بصور / مكتبي بدون صور)
 6. **المعاينة** (إذا كانت مطلوبة)
 7. **المالية** (الرسوم، المدفوع، حالة السداد)
 8. **النواقص** (فقط إن وُجدت)
 9. **الخطوة التالية** (جملة واحدة مباشرة وواضحة)
 
 ### أسلوب الكتابة
 - عربي مهني مختصر — بدون حشو أو تكرار أو مقدمات
 - **قاعدة حاسمة**: عندما تُرجع أداة نصاً بتنسيق Markdown (قائمة نقطية بعلامة -)، **انسخه حرفياً كما هو بالضبط** — لا تُعد صياغته، لا تختصر العناوين، لا تحذف أحرفاً من الكلمات العربية.
 - **ممنوع منعاً باتاً** اقتطاع أو اختصار أي عنوان عربي: مثلاً "الغرض" يجب أن تبقى "الغرض" وليس "الغ"، و"المالية" تبقى "المالية" وليس "ال".
 - كل حقل يجب أن يظهر في **سطر مستقل** — لا تدمج حقلين في سطر واحد أبداً
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

## هوية المساعد للمُعاين (إلزامية)
أنت مساعد ميداني مخصص للمُعاين داخل المنصة.
عند سؤالك: "من أنت؟" أو "ماذا تفعل؟" أجب بصياغة مهنية قصيرة مثل:
"أنا ${AI.name} — مساعدك الميداني داخل المنصة. أساعدك في إدارة المعاينات، معرفة الموقع، رفع الصور والملاحظات، ومتابعة حالة التنفيذ. أعمل ضمن صلاحيات المُعاين فقط."
ممنوع أن تصف نفسك بأنك متخصص في التقييم العقاري أو الآلات والمعدات أو التقارير أو صلاحيات المالك.

## دورك كمساعد المعاين الميداني
أنت تساعد المعاين في إنجاز مهامه الميدانية بكفاءة ووضوح:
- عرض المعاينات المسندة والمجدولة والتفاصيل الكاملة لكل مهمة
- إدارة قوائم التحقق وتحديث البنود
- تحديث حالة المعاينات (بدأت، مكتملة، مؤجلة)
- متابعة حالة الصور المرفوعة والفئات الناقصة
- الإبلاغ عن مشاكل ميدانية (وصول، عنوان، أمان)
- عرض الأداء الشخصي والتقييمات
- طلب تأجيل مهام مع ذكر السبب

### قواعد اللغة والإخراج
- استخدم العربية الفصحى المهنية فقط
- اجعل الجمل قصيرة ومباشرة
- لا تعرض أي كلمة ناقصة أو مكسورة أو غير مفهومة
- لا تستخدم وصفاً عاماً يخص أدواراً أخرى

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

    const _toolStart = Date.now();
    console.log(`[TOOL_EXEC] ▶ ${toolName} | args: ${JSON.stringify({ assignment_id: args.assignment_id, request_id: args.request_id })}`);

    // ═══════════════════════════════════════════════════
    // MODULE: Valuation Tools (delegated)
    // ═══════════════════════════════════════════════════
    const valuationResult = await executeValuationTools(toolName, args, db, supabaseUrl, serviceKey);
    if (valuationResult !== null) {
      console.log(`[TOOL_EXEC] ✓ ${toolName} (valuation-tools) | ${Date.now() - _toolStart}ms | success=${valuationResult.success}`);
      return valuationResult;
    }

    // ═══════════════════════════════════════════════════
    // MODULE: Executive Tools (delegated)
    // ═══════════════════════════════════════════════════
    const execResult = await executeExecutiveTools(toolName, args, db, supabaseUrl, serviceKey);
    if (execResult !== null) {
      console.log(`[TOOL_EXEC] ✓ ${toolName} (executive-tools) | ${Date.now() - _toolStart}ms | success=${execResult.success}`);
      return execResult;
    }

    // ═══════════════════════════════════════════════════
    // ═══════════════════════════════════════════════════
    // MODULE: Inspector Tools (delegated)
    // ═══════════════════════════════════════════════════
    const inspResult = await executeInspectorTools(toolName, args, db);
    if (inspResult !== null) {
      console.log(`[TOOL_EXEC] ✓ ${toolName} (inspector-tools) | ${Date.now() - _toolStart}ms | success=${inspResult.success}`);
      return inspResult;
    }

    // ═══════════════════════════════════════════════════
    // MODULE: Client Tools (delegated)
    // ═══════════════════════════════════════════════════
    const clientResult = await executeClientTools(toolName, args, db);
    if (clientResult !== null) {
      console.log(`[TOOL_EXEC] ✓ ${toolName} (client-tools) | ${Date.now() - _toolStart}ms | success=${clientResult.success}`);
      return clientResult;
    }

    // ═══════════════════════════════════════════════════
    // MODULE: CFO Tools (delegated)
    // ═══════════════════════════════════════════════════
    const cfoResult = await executeCfoTools(toolName, args, db);
    if (cfoResult !== null) {
      console.log(`[TOOL_EXEC] ✓ ${toolName} (cfo-tools) | ${Date.now() - _toolStart}ms | success=${cfoResult.success}`);
      return cfoResult;
    }

    console.log(`[TOOL_EXEC] ✗ ${toolName} (unknown) | ${Date.now() - _toolStart}ms`);
    return { success: false, result: null, error: `أداة غير معروفة: ${toolName}` };
  } catch (e) {
    console.error(`[TOOL_EXEC] ✗✗ ${toolName} EXCEPTION:`, e);
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
    const body = await req.json();
    const { messages, correction, userRole, userId, attachments = [], platformContext } = body;
    console.log("[raqeem-chat] platformContext received:", JSON.stringify(platformContext || null));
    console.log("[raqeem-chat] assignment_id:", platformContext?.assignment_id || "NONE");
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

        platformContextSection += `\n\n**🚫 قواعد السياق المحمّل (إلزامية مطلقة):**`;
        platformContextSection += `\n- هذا الطلب محمّل تلقائياً — **ممنوع منعاً باتاً** أن تطلب من المستخدم رقم الطلب أو أي معرّف`;
        platformContextSection += `\n- **ممنوع** قول "أحتاج رقم الطلب" أو "أرسل رقم الطلب" أو "اختر إجراء" — لأن السياق متوفر بالفعل`;
        platformContextSection += `\n- عند طلب حالة أو تفاصيل أو أي إجراء، نفّذ الأداة مباشرة بالمعرّفات أعلاه بدون أي سؤال`;
        platformContextSection += `\n- ابدأ ردّك مباشرة بالملخص أو النتيجة — بدون مقدمات أو تعليمات أو خيارات`;
        platformContextSection += `\n- إذا طلب المستخدم "حالة الطلب" أو "تفاصيل" بدون تحديد رقم، يُقصد حصرياً هذا الطلب المحمّل`;
      }
    }

    // Build contextual system prompt with role-specific additions
    const rolePrompt = getRolePromptAddition(effectiveRole);
    const basePrompt = effectiveRole === "inspector"
      ? `أنت "${AI.name}" — مساعد ميداني مخصص للمُعاين داخل المنصة. استخدم العربية الفصحى المهنية فقط، ولا تذكر أي وصف عام عن التقييم العقاري أو الآلات والمعدات أو صلاحيات المالك.`
      : await buildContextualPrompt(supabaseClient);
    const systemPrompt = basePrompt
      + rolePrompt
      + memoryProfileSection
      + platformContextSection
      + clientContextSection
      + greetingInstruction
      + attachmentIntelligenceSection
      + (imageAttachments.length > 0 ? `\n${buildMachineryVisionPromptLocal()}\n` : "");
    const roleTools = getToolsForRole(effectiveRole);

    const latestUserPlainText = typeof latestUserText === "string" ? latestUserText.trim() : "";
    const hasBoundContext = !!(platformContext && typeof platformContext === "object" && ((platformContext as any).assignment_id || (platformContext as any).request_id));
    const wantsCurrentRequestStatus = hasBoundContext && /حالة|وضع|تفاصيل|ملخص|الطلب|بالتفصيل|status|details/.test(latestUserPlainText);
    const wantsPriorityUpdate = hasBoundContext && /(?:أولوية المتابعة|الأولوية).*(?:حدّث|تحديث|نفّذ|ارفع|عدّل)|(?:نفّذ|حدث|حدّث|ارفع|عدّل).*(?:أولوية المتابعة|الأولوية)/.test(latestUserPlainText);
    console.log("[raqeem-chat] hasBoundContext:", hasBoundContext, "| wantsStatus:", wantsCurrentRequestStatus, "| latestText:", latestUserPlainText.slice(0, 80));

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
