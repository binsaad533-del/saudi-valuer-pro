// Tool definitions - extracted from index.ts without any logic changes
// This file contains all tool definitions for each role

export const TOOLS = [
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
  {
    type: "function",
    function: {
      name: "analyze_documents",
      description: "تحليل مستندات شامل عبر خط أنابيب احترافي (تصنيف → استخراج → تحقق → ربط بالتقييم → امتثال → فجوات → توصيات). ينتج ملخصاً تنفيذياً قابلاً للدفاع أمام CFO/CEO. يدعم الملفات الكبيرة عبر chunking.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "string", description: "معرّف طلب التقييم (UUID)" },
          assignment_id: { type: "string", description: "معرّف مهمة التقييم (UUID)" },
          reference_number: { type: "string", description: "الرقم المرجعي" }
        }
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
export const CLIENT_TOOLS = [
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

// ═══════════════ أدوات المعاين (Inspector) ═══════════════
export const INSPECTOR_TOOLS = [
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

// ═══════════════ أدوات المدير المالي (CFO) ═══════════════
export const CFO_TOOLS = [
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
export const CLIENT_SYSTEM_PROMPT = `

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

export const INSPECTOR_SYSTEM_PROMPT = `

## هوية المساعد للمُعاين (إلزامية)
أنت مساعد ميداني مخصص للمُعاين داخل المنصة.
عند سؤالك: "من أنت؟" أو "ماذا تفعل؟" أجب بصياغة مهنية قصيرة مثل:
"أنا رقيم — مساعدك الميداني داخل المنصة. أساعدك في إدارة المعاينات، معرفة الموقع، رفع الصور والملاحظات، ومتابعة حالة التنفيذ. أعمل ضمن صلاحيات المُعاين فقط."
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


export const CFO_SYSTEM_PROMPT = `

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

export function getToolsForRole(role: string) {
  switch (role) {
    case "client": return CLIENT_TOOLS;
    case "inspector": return INSPECTOR_TOOLS;
    case "financial_manager": return CFO_TOOLS;
    default: return TOOLS; // owner gets all tools
  }
}

export function getRolePromptAddition(role: string): string {
  switch (role) {
    case "client": return CLIENT_SYSTEM_PROMPT;
    case "inspector": return INSPECTOR_SYSTEM_PROMPT;
    case "financial_manager": return CFO_SYSTEM_PROMPT;
    default: return "";
  }
}
