import {
  Sparkles, FileText, Wand2, CheckCircle2, Database, Layers,
  FileCheck, Download, Eye, BarChart3, Scale,
  BookOpen, Target, Landmark, Map, TrendingUp, Home, Gavel, Calculator,
  DollarSign, ShieldCheck, Award, Paperclip, ClipboardCheck, Building2, User,
  type LucideIcon,
} from "lucide-react";

export const PIPELINE_STEPS = [
  { key: "data", label: "جمع البيانات", icon: Database, desc: "ربط الطلب وجمع جميع البيانات" },
  { key: "generate", label: "توليد المسودة", icon: Wand2, desc: "توليد أقسام التقرير بالذكاء الاصطناعي" },
  { key: "sections", label: "مراجعة الأقسام", icon: Layers, desc: "مراجعة وتعديل كل قسم" },
  { key: "review", label: "فحص الجودة", icon: Eye, desc: "مراجعة شاملة وتحسينات" },
  { key: "preview", label: "المعاينة", icon: FileCheck, desc: "معاينة التقرير النهائي" },
  { key: "export", label: "التصدير", icon: Download, desc: "إنشاء مسودة التقرير" },
];

export const SECTION_ICONS: Record<string, LucideIcon> = {
  cover_page: FileText,
  table_of_contents: BookOpen,
  executive_summary: Sparkles,
  engagement_letter: FileCheck,
  purpose_and_intended_use: Target,
  scope_of_work: ClipboardCheck,
  property_identification: Landmark,
  property_description: Building2,
  legal_description: Gavel,
  location_analysis: Map,
  market_overview: TrendingUp,
  highest_and_best_use: Home,
  valuation_approaches: Layers,
  sales_comparison_approach: BarChart3,
  cost_approach: Calculator,
  income_approach: TrendingUp,
  reconciliation: Scale,
  assumptions_and_limiting_conditions: DollarSign,
  compliance_statement: ShieldCheck,
  valuer_certification: Award,
  appendices: Paperclip,
};

export const SECTION_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  executive_summary:       { bg: "bg-primary/10",        text: "text-primary",        accent: "border-primary/30" },
  scope_of_work:           { bg: "bg-info/10",           text: "text-info",           accent: "border-info/30" },
  property_description:    { bg: "bg-amber-500/10",      text: "text-amber-600",      accent: "border-amber-500/30" },
  location_analysis:       { bg: "bg-emerald-500/10",    text: "text-emerald-600",    accent: "border-emerald-500/30" },
  market_overview:         { bg: "bg-cyan-500/10",       text: "text-cyan-600",       accent: "border-cyan-500/30" },
  sales_comparison_approach: { bg: "bg-violet-500/10",   text: "text-violet-600",     accent: "border-violet-500/30" },
  cost_approach:           { bg: "bg-orange-500/10",     text: "text-orange-600",     accent: "border-orange-500/30" },
  reconciliation:          { bg: "bg-rose-500/10",       text: "text-rose-600",       accent: "border-rose-500/30" },
  assumptions_and_limiting_conditions: { bg: "bg-yellow-500/10", text: "text-yellow-600", accent: "border-yellow-500/30" },
  compliance_statement:    { bg: "bg-teal-500/10",       text: "text-teal-600",       accent: "border-teal-500/30" },
  valuer_certification:    { bg: "bg-indigo-500/10",     text: "text-indigo-600",     accent: "border-indigo-500/30" },
  cover_page:              { bg: "bg-slate-500/10",      text: "text-slate-600",      accent: "border-slate-500/30" },
  table_of_contents:       { bg: "bg-gray-500/10",       text: "text-gray-600",       accent: "border-gray-500/30" },
  engagement_letter:       { bg: "bg-sky-500/10",        text: "text-sky-600",        accent: "border-sky-500/30" },
  purpose_and_intended_use:{ bg: "bg-fuchsia-500/10",    text: "text-fuchsia-600",    accent: "border-fuchsia-500/30" },
  property_identification: { bg: "bg-lime-500/10",       text: "text-lime-600",       accent: "border-lime-500/30" },
  legal_description:       { bg: "bg-stone-500/10",      text: "text-stone-600",      accent: "border-stone-500/30" },
  highest_and_best_use:    { bg: "bg-pink-500/10",       text: "text-pink-600",       accent: "border-pink-500/30" },
  valuation_approaches:    { bg: "bg-blue-500/10",       text: "text-blue-600",       accent: "border-blue-500/30" },
  income_approach:         { bg: "bg-green-500/10",      text: "text-green-600",      accent: "border-green-500/30" },
  appendices:              { bg: "bg-neutral-500/10",     text: "text-neutral-600",    accent: "border-neutral-500/30" },
};

export const DEFAULT_SECTION_COLOR = { bg: "bg-primary/10", text: "text-primary", accent: "border-primary/30" };

export const DATA_CATEGORIES = [
  { key: "request", label: "بيانات الطلب", icon: FileText },
  { key: "client", label: "بيانات العميل", icon: User },
  { key: "subject", label: "وصف العقار", icon: Building2 },
  { key: "inspection", label: "المعاينة الميدانية", icon: ClipboardCheck },
  { key: "comparables", label: "المقارنات السوقية", icon: BarChart3 },
  { key: "reconciliation", label: "التسوية والقيمة", icon: Scale },
];
