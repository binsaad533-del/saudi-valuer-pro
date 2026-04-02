import { useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Calculator, FileText, Sparkles } from "lucide-react";
import AIDocumentProcessingPage from "./AIDocumentProcessingPage";
import ScopeAndPricingPage from "./ScopeAndPricingPage";
import AIReportGenerationPage from "./AIReportGenerationPage";

export default function SmartToolsPage() {
  const [activeTab, setActiveTab] = useState("documents");

  return (
    <div className="min-h-screen" dir="rtl">
      <TopBar />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">الأدوات الذكية</h1>
            <p className="text-xs text-muted-foreground">معالجة المستندات • نطاق العمل والتسعير • توليد التقارير</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="documents" className="gap-1.5">
              <Brain className="w-3.5 h-3.5" />
              معالجة المستندات
            </TabsTrigger>
            <TabsTrigger value="scope" className="gap-1.5">
              <Calculator className="w-3.5 h-3.5" />
              نطاق العمل والتسعير
            </TabsTrigger>
            <TabsTrigger value="report" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              توليد التقارير
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documents" className="mt-4">
            <AIDocumentProcessingPage embedded />
          </TabsContent>
          <TabsContent value="scope" className="mt-4">
            <ScopeAndPricingPage embedded />
          </TabsContent>
          <TabsContent value="report" className="mt-4">
            <AIReportGenerationPage embedded />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
