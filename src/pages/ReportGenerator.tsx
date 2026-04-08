import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FileText, Globe, Languages, Lock, Download, Eye,
  CheckCircle2, AlertTriangle, Loader2, Stamp, Archive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ReportPreview from "@/components/reports/ReportPreview";
import ReportPreviewProfessional from "@/components/reports/ReportPreviewProfessional";
import ReportSectionEditor from "@/components/reports/ReportSectionEditor";
import ConsistencyChecker from "@/components/reports/ConsistencyChecker";
import SignatureUpload from "@/components/reports/SignatureUpload";
import QRCodeGeneratorComponent from "@/components/reports/QRCodeGenerator";
import ReportWorkflowPanel from "@/components/reports/ReportWorkflowPanel";
import ReportGenerationStepper, { type GenerationStep } from "@/components/reports/ReportGenerationStepper";
import { type ReportLanguage, type ReportData } from "@/lib/report-types";
import { translateReportSections } from "@/lib/report-api";
import { exportReportToPDF, downloadPdfBlob } from "@/services/pdfExportService";
import { isReportLocked, getStatusLabel, getStatusColor } from "@/utils/reportWorkflow";
import RaqeemContextCard from "@/components/raqeem/RaqeemContextCard";
import { mockReports } from "@/data/mockReports";
import type { Report } from "@/types/report";
import { formatDate } from "@/lib/utils";


const SAMPLE_REPORT: ReportData = {
  cover_title_ar: "تقرير تقييم عقاري",
  cover_title_en: "Real Estate Valuation Report",
  reference_number: "VAL-2026-0042",
  report_date: "2026-03-28",
  valuation_date: "2026-03-25",
  client_name_ar: "شركة الرحمانية للتطوير",
  client_name_en: "Al-Rahmaniyah Development Co.",
  client_id_number: "1010XXXXXX",
  purpose_ar: "تقدير القيمة السوقية للعقار لغرض البيع",
  purpose_en: "Estimate the Market Value of the property for sale purposes",
  intended_use_ar: "اتخاذ قرار البيع",
  intended_use_en: "Sale decision making",
  intended_users_ar: "شركة الرحمانية للتطوير",
  intended_users_en: "Al-Rahmaniyah Development Co.",
  basis_of_value_ar: "القيمة السوقية",
  basis_of_value_en: "Market Value",
  scope_ar: "تقييم شامل يتضمن معاينة داخلية وخارجية للعقار، ودراسة السوق المحلي، وتحليل المقارنات السوقية",
  scope_en: "Comprehensive valuation including internal and external inspection, local market study, and comparable market analysis",
  property_description_ar: "فيلا سكنية مكونة من طابقين وملحق علوي بمساحة بناء 450 متر مربع",
  property_description_en: "Residential villa consisting of two floors and a rooftop annex with a built-up area of 450 sqm",
  legal_description_ar: "صك رقم 310XXXXXX، مخطط رقم 2150، قطعة رقم 340",
  legal_description_en: "Title Deed No. 310XXXXXX, Plan No. 2150, Plot No. 340",
  property_address_ar: "حي النرجس، الرياض",
  property_address_en: "Al-Narjis District, Riyadh",
  property_city_ar: "الرياض",
  property_city_en: "Riyadh",
  land_area: "625",
  building_area: "450",
  property_type_ar: "سكني",
  property_type_en: "Residential",
  ownership_ar: "ملكية حرة كاملة",
  ownership_en: "Freehold ownership",
  inspection_date: "2026-03-20",
  inspection_notes_ar: "تمت المعاينة الداخلية والخارجية الكاملة. العقار بحالة جيدة جداً.",
  inspection_notes_en: "Full internal and external inspection completed. Property in very good condition.",
  market_overview_ar: "يشهد سوق العقارات في حي النرجس طلباً متزايداً مع استقرار نسبي في الأسعار خلال الربع الأول من 2026",
  market_overview_en: "The real estate market in Al-Narjis district is experiencing increasing demand with relative price stability during Q1 2026",
  highest_best_use_ar: "الاستخدام الحالي كفيلا سكنية هو الاستخدام الأعلى والأفضل",
  highest_best_use_en: "The current use as a residential villa represents the Highest and Best Use",
  approaches_considered_ar: "تم استخدام أسلوب المقارنة بالمبيعات كأسلوب رئيسي، مع الاستعانة بأسلوب التكلفة كأسلوب مساند",
  approaches_considered_en: "The Sales Comparison Approach was used as the primary method, supported by the Cost Approach",
  calculations_ar: "تم تحليل 5 عقارات مقارنة وإجراء التعديلات اللازمة على الموقع والمساحة والحالة",
  calculations_en: "Five comparable properties were analyzed with necessary adjustments for location, area, and condition",
  reconciliation_ar: "بعد تحليل النتائج من أسلوبي المقارنة والتكلفة، تم الترجيح لصالح أسلوب المقارنة بالمبيعات بنسبة 70٪ وأسلوب التكلفة بنسبة 30٪",
  reconciliation_en: "After analyzing results from both comparison and cost approaches, the Sales Comparison Approach was weighted at 70% and the Cost Approach at 30%",
  final_value: "3,250,000",
  final_value_text_ar: "ثلاثة ملايين ومائتان وخمسون ألف ريال سعودي",
  final_value_text_en: "Three Million Two Hundred and Fifty Thousand Saudi Riyals",
  currency: "SAR",
  assumptions_ar: "تم افتراض صحة المعلومات المقدمة من العميل وسلامة الصكوك القانونية",
  assumptions_en: "Information provided by the client was assumed to be accurate and legal documents were assumed to be valid",
  special_assumptions_ar: "لا توجد افتراضات خاصة",
  special_assumptions_en: "No special assumptions",
  limiting_conditions_ar: "التقييم قائم على أساس المعلومات المتاحة في تاريخ التقييم ولا يشكل ضماناً لسعر البيع الفعلي",
  limiting_conditions_en: "This valuation is based on information available at the valuation date and does not guarantee the actual selling price",
  compliance_statement_ar: "تم إعداد هذا التقرير وفقاً لمعايير التقييم الدولية (IVS 2025) ومتطلبات الهيئة السعودية للمقيّمين المعتمدين (تقييم)",
  compliance_statement_en: "This report has been prepared in accordance with International Valuation Standards (IVS 2025) and the requirements of the Saudi Authority for Accredited Valuers (TAQEEM)",
  signer_name_ar: "احمد المالكي",
  signer_name_en: "Ahmed Al-Malki",
  signer_title_ar: "مقيّم معتمد",
  signer_title_en: "Certified Valuer",
  signer_license: "1210XXXXXX",
};

export default function ReportGeneratorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Load report from mock data if ID provided
  const initialReport = id ? mockReports.find((r) => r.id === id) : null;

  const [report, setReport] = useState<Report | null>(initialReport || null);
  const [language, setLanguage] = useState<ReportLanguage>("bilingual");
  const [reportData, setReportData] = useState<ReportData>(SAMPLE_REPORT);
  const [activeTab, setActiveTab] = useState("professional");
  const [isTranslating, setIsTranslating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [generationStep, setGenerationStep] = useState<GenerationStep>("received");
  const [consistencyResult, setConsistencyResult] = useState<null | { consistent: boolean; issues: any[] }>(null);
  const { toast } = useToast();

  const locked = report ? isReportLocked(report.status) : false;

  const getStatusStep = (status: string): GenerationStep => {
    switch (status) {
      case "draft": return "received";
      case "review": return "processing";
      case "approved": return "review";
      case "issued":
      case "delivered": return "ready";
      default: return "received";
    }
  };

  const reportStep = report ? getStatusStep(report.status) : "received";

  const handleTranslate = async (sourceLang: "ar" | "en") => {
    setIsTranslating(true);
    try {
      const targetLang = sourceLang === "ar" ? "en" : "ar";
      const suffix = `_${sourceLang}`;
      const sections: Record<string, string> = {};

      Object.entries(reportData).forEach(([key, val]) => {
        if (key.endsWith(suffix) && typeof val === "string" && val.trim()) {
          sections[key.replace(suffix, "")] = val;
        }
      });

      const translated = await translateReportSections(sections, sourceLang, targetLang);
      const targetSuffix = `_${targetLang}`;
      const updates: Partial<ReportData> = {};

      Object.entries(translated).forEach(([key, val]) => {
        const fullKey = `${key}${targetSuffix}` as keyof ReportData;
        if (fullKey in reportData) {
          (updates as any)[fullKey] = val;
        }
      });

      setReportData((prev) => ({ ...prev, ...updates }));
      toast({
        title: targetLang === "en" ? "تمت الترجمة بنجاح" : "Translation completed",
      });
    } catch (e: any) {
      toast({ title: "خطأ في الترجمة", description: e.message, variant: "destructive" });
    } finally {
      setIsTranslating(false);
    }
  };

  const handleExportPdf = useCallback(async () => {
    if (!report) return;
    setIsExporting(true);
    setGenerationStep("received");

    toast({ title: "جاري تصدير التقرير...", description: report.reportNumber });

    try {
      await new Promise((r) => setTimeout(r, 800));
      setGenerationStep("processing");
      await new Promise((r) => setTimeout(r, 800));
      setGenerationStep("review");
      await new Promise((r) => setTimeout(r, 400));

      const blob = await exportReportToPDF(report);
      const filename = `${report.reportNumber}.pdf`;
      downloadPdfBlob(blob, filename);

      setGenerationStep("ready");
      toast({ title: "تم تصدير التقرير بنجاح", description: filename });

      if (report.status === "issued" || report.status === "delivered") {
        setReport((prev) =>
          prev ? { ...prev, isArchived: true, archivedAt: new Date().toISOString() } : prev
        );
      }
    } catch {
      toast({ title: "فشل التصدير", variant: "destructive" });
      setGenerationStep("received");
    } finally {
      setIsExporting(false);
    }
  }, [report, toast]);

  const handleReportUpdate = (updated: Report) => {
    setReport(updated);
  };

  // If no report loaded by ID, show the bilingual editor view
  const showWorkflowView = !!report;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {showWorkflowView ? "تقرير التقييم" : "إنشاء التقرير"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {report
              ? `${report.reportNumber} — ${report.clientName}`
              : `${reportData.reference_number} — ${reportData.client_name_ar}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report && (
            <Badge className={getStatusColor(report.status)}>
              {getStatusLabel(report.status)}
            </Badge>
          )}
          {locked && (
            <Badge variant="outline" className="gap-1">
              <Lock className="w-3 h-3" /> غير قابل للتعديل
            </Badge>
          )}
          {consistencyResult && (
            <Badge variant={consistencyResult.consistent ? "default" : "destructive"} className="gap-1">
              {consistencyResult.consistent ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> متسق</>
              ) : (
                <><AlertTriangle className="w-3.5 h-3.5" /> غير متسق</>
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Generation Stepper - show during export or as status indicator */}
      {isExporting ? (
        <Card>
          <CardContent className="pt-6 pb-4">
            <ReportGenerationStepper currentStep={generationStep} />
          </CardContent>
        </Card>
      ) : report && (
        <Card>
          <CardContent className="pt-6 pb-4">
            <ReportGenerationStepper currentStep={reportStep} isStatic />
          </CardContent>
        </Card>
      )}

      {/* Lock Banner */}
      {locked && report && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4" dir="rtl">
          <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="font-bold text-destructive">هذا التقرير نهائي وغير قابل للتعديل</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              حالة التقرير: {getStatusLabel(report.status)} — لا يمكن إجراء أي تعديلات على التقارير الصادرة أو المُسلَّمة
            </p>
          </div>
        </div>
      )}

      {/* Workflow View: Professional Preview + Workflow Panel + Actions */}
      {showWorkflowView && report && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main: Professional Preview */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-0">
                <ReportPreviewProfessional report={report} />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: Workflow + Actions */}
          <div className="space-y-4">
            {/* Action Buttons */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Button
                  className="w-full gap-2"
                  onClick={handleExportPdf}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  تصدير PDF
                </Button>

                {report.isArchived && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                    <Archive className="w-4 h-4" />
                    تم أرشفة التقرير
                    {report.archivedAt && ` — ${formatDate(report.archivedAt)}`}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workflow Panel - always show, read-only when locked */}
            <ReportWorkflowPanel
              report={report}
              isOwner={!locked}
              onReportUpdate={handleReportUpdate}
            />

            {/* Signature - hide for issued/archived */}
            {!locked && (
              <SignatureUpload
                currentUrl={report.signatureImageUrl}
                onSignatureChange={(url) =>
                  setReport((prev) => (prev ? { ...prev, signatureImageUrl: url } : prev))
                }
                disabled={locked}
              />
            )}

            {/* QR Code */}
            <QRCodeGeneratorComponent
              referenceNumber={report.reportNumber}
              verificationToken={report.verificationToken}
              reportDate={
                report.issuedAt
                  ? formatDate(report.issuedAt)
                  : undefined
              }
            />
          </div>
        </div>
      )}

      {/* Editor View: Bilingual Report Builder */}
      {!showWorkflowView && (
        <>
          {/* Language Selector + Actions */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <div className="flex items-center gap-2">
                  <Languages className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">لغة التقرير:</span>
                  <div className="flex gap-1">
                    {(["ar", "en", "bilingual"] as ReportLanguage[]).map((lang) => (
                      <Button
                        key={lang}
                        size="sm"
                        variant={language === lang ? "default" : "outline"}
                        onClick={() => setLanguage(lang)}
                      >
                        {lang === "ar" ? "عربي" : lang === "en" ? "English" : "ثنائي اللغة"}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleTranslate("ar")} disabled={isTranslating}>
                    {isTranslating ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Globe className="w-4 h-4 ml-1" />}
                    ترجمة عربي ← إنجليزي
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleTranslate("en")} disabled={isTranslating}>
                    {isTranslating ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Globe className="w-4 h-4 ml-1" />}
                    Translate EN → AR
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="professional" className="gap-1">
                <Stamp className="w-4 h-4" /> معاينة احترافية
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1">
                <Eye className="w-4 h-4" /> معاينة ثنائية
              </TabsTrigger>
              <TabsTrigger value="edit" className="gap-1">
                <FileText className="w-4 h-4" /> تحرير الأقسام
              </TabsTrigger>
              <TabsTrigger value="consistency" className="gap-1">
                <Lock className="w-4 h-4" /> فحص التطابق
              </TabsTrigger>
            </TabsList>

            <TabsContent value="professional" className="mt-4 space-y-4">
              {/* Show professional preview with a default report object */}
              <Card>
                <CardContent className="p-0">
                  <ReportPreviewProfessional
                    report={{
                      id: "preview",
                      reportNumber: reportData.reference_number,
                      valuationRequestId: "",
                      clientName: reportData.client_name_ar,
                      clientPhone: "",
                      clientEmail: "",
                      assetType: "real_estate",
                      assetDescription: reportData.property_description_ar,
                      assetLocation: `${reportData.property_address_ar}، ${reportData.property_city_ar}`,
                      methodology: "market_comparison",
                      marketAnalysis: reportData.market_overview_ar,
                      comparables: [],
                      estimatedValue: Number(reportData.final_value.replace(/,/g, "")) || 0,
                      currency: reportData.currency,
                      notes: "",
                      status: "draft",
                      evaluatorName: reportData.signer_name_ar,
                      evaluatorCredentials: {
                        saudiAuthority: "الهيئة السعودية للمقيمين المعتمدين - تقييم",
                        rics: "MRICS",
                        asa: "ASA",
                      },
                      signatureImageUrl: reportData.signature_image_url || null,
                      qrCodeUrl: null,
                      verificationToken: reportData.reference_number,
                      createdAt: reportData.report_date,
                      updatedAt: reportData.report_date,
                      approvedAt: null,
                      issuedAt: null,
                      deliveredAt: null,
                      archivedAt: null,
                      isArchived: false,
                      auditLog: [],
                    }}
                  />
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SignatureUpload
                  currentUrl={reportData.signature_image_url ?? null}
                  onSignatureChange={(url) => setReportData((prev) => ({ ...prev, signature_image_url: url }))}
                />
                <QRCodeGeneratorComponent
                  referenceNumber={reportData.reference_number}
                  reportDate={reportData.report_date}
                />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4 space-y-4">
              <ReportPreview data={reportData} language={language} />
            </TabsContent>

            <TabsContent value="edit" className="mt-4">
              <ReportSectionEditor
                data={reportData}
                language={language}
                onChange={(updates) => setReportData((prev) => ({ ...prev, ...updates }))}
              />
            </TabsContent>

            <TabsContent value="consistency" className="mt-4">
              <ConsistencyChecker
                data={reportData}
                result={consistencyResult}
                onCheck={setConsistencyResult}
              />
            </TabsContent>
          </Tabs>

          {/* Raqeem Agent */}
          {id && (
            <RaqeemContextCard
              assignmentId={id}
              stage="report_generation"
              pageContext="صفحة إعداد التقرير - Report Generator"
              className="mt-4"
            />
          )}
        </>
      )}
    </div>
  );
}
