import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, MessageSquare, Scale, BarChart3, FlaskConical, Sparkles } from "lucide-react";
import KnowledgeBaseModule from "@/components/raqeem/KnowledgeBaseModule";
import CorrectionsModule from "@/components/raqeem/CorrectionsModule";
import RulesEngineModule from "@/components/raqeem/RulesEngineModule";
import PerformanceDashboard from "@/components/raqeem/PerformanceDashboard";
import TestHistoryModule from "@/components/raqeem/TestHistoryModule";

export default function RaqeemTrainingPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">لوحة تدريب رقيم</h1>
          <p className="text-sm text-muted-foreground">
            نظام تحسين الذكاء الاصطناعي المتحكم به — لا يوجد تعلم ذاتي
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="dashboard" dir="rtl">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="dashboard" className="text-xs gap-1">
            <BarChart3 className="w-3.5 h-3.5" /> الأداء
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs gap-1">
            <BookOpen className="w-3.5 h-3.5" /> المعرفة
          </TabsTrigger>
          <TabsTrigger value="corrections" className="text-xs gap-1">
            <MessageSquare className="w-3.5 h-3.5" /> التصحيحات
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs gap-1">
            <Scale className="w-3.5 h-3.5" /> القواعد
          </TabsTrigger>
          <TabsTrigger value="tests" className="text-xs gap-1">
            <FlaskConical className="w-3.5 h-3.5" /> الاختبارات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <PerformanceDashboard />
        </TabsContent>
        <TabsContent value="knowledge" className="mt-6">
          <KnowledgeBaseModule />
        </TabsContent>
        <TabsContent value="corrections" className="mt-6">
          <CorrectionsModule />
        </TabsContent>
        <TabsContent value="rules" className="mt-6">
          <RulesEngineModule />
        </TabsContent>
        <TabsContent value="tests" className="mt-6">
          <TestHistoryModule />
        </TabsContent>
      </Tabs>
    </div>
  );
}
