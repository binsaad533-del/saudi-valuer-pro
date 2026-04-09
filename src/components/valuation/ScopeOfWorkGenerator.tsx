import { useState } from "react";
import BidiText from "@/components/ui/bidi-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText, Loader2, RefreshCw, Lock, Unlock, CheckCircle2,
  Edit3, Eye, AlertTriangle, BookOpen, Target,
  Users, Scale, Calendar, Building2, Search, FileCheck,
  Shield, ListChecks,
} from "lucide-react";
import RaqeemIcon from "@/components/ui/RaqeemIcon";

interface ScopeSection {
  key: string;
  title: string;
  icon: React.ElementType;
  content: string;
}

interface ScopeOfWorkGeneratorProps {
  purpose?: string;
  purposeText?: string;
  intendedUsers?: string;
  intendedUsersText?: string;
  assetDescription?: string;
  assetType?: string;
  clientName?: string;
  city?: string;
  district?: string;
  area?: string;
  documents?: { name: string }[];
  assignmentId?: string;
  onScopeGenerated?: (scope: string, sections: Record<string, string>) => void;
  onLocked?: (locked: boolean) => void;
}

export default function ScopeOfWorkGenerator({
  purpose,
  purposeText,
  intendedUsers,
  intendedUsersText,
  assetDescription,
  assetType,
  clientName,
  city,
  district,
  area,
  documents,
  assignmentId,
  onScopeGenerated,
  onLocked,
}: ScopeOfWorkGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [sections, setSections] = useState<ScopeSection[]>([]);
  const [fullText, setFullText] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [locked, setLocked] = useState(false);
  const [methodology, setMethodology] = useState("");
  const [basisInfo, setBasisInfo] = useState<{ ar: string; en: string; ivs: string } | null>(null);

  const sectionIcons: Record<string, React.ElementType> = {
    purpose_section: Target,
    intended_users_section: Users,
    basis_of_value_section: Scale,
    valuation_date_section: Calendar,
    asset_description_section: Building2,
    inspection_scope_section: Search,
    data_sources_section: BookOpen,
    assumptions_section: FileCheck,
    limiting_conditions_section: Shield,
  };

  const sectionTitles: Record<string, string> = {
    purpose_section: "الغرض من التقييم",
    intended_users_section: "المستخدمون المقصودون",
    basis_of_value_section: "أساس القيمة",
    valuation_date_section: "تاريخ التقييم",
    asset_description_section: "وصف الأصل",
    inspection_scope_section: "نطاق المعاينة",
    data_sources_section: "مصادر البيانات",
    assumptions_section: "الافتراضات",
    limiting_conditions_section: "القيود والتحفظات",
  };

  const generateScope = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-scope-work", {
        body: {
          purpose,
          purposeText,
          intendedUsers,
          intendedUsersText,
          assetDescription,
          assetType,
          clientName,
          city,
          district,
          area,
          documents,
          assignmentId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const scope = data.scope;
      const sectionKeys = Object.keys(sectionTitles);
      const mapped: ScopeSection[] = sectionKeys
        .filter((k) => scope[k])
        .map((k) => ({
          key: k,
          title: sectionTitles[k],
          icon: sectionIcons[k] || FileText,
          content: scope[k],
        }));

      setSections(mapped);
      setFullText(scope.full_scope_text || "");
      setEditedText(scope.full_scope_text || "");
      setMethodology(scope.methodology_recommendation || "");
      setBasisInfo(data.basisOfValue || null);

      onScopeGenerated?.(scope.full_scope_text, scope);
      toast.success("تم توليد نطاق العمل بنجاح");
    } catch (err: any) {
      console.error("Scope generation error:", err);
      if (err.message?.includes("429")) {
        toast.error("تم تجاوز حد الطلبات، يرجى المحاولة بعد قليل");
      } else if (err.message?.includes("402")) {
        toast.error("رصيد غير كافٍ، يرجى شحن الرصيد");
      } else {
        toast.error("حدث خطأ أثناء توليد نطاق العمل");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = () => {
    const newLocked = !locked;
    setLocked(newLocked);
    if (newLocked && editMode) {
      setFullText(editedText);
      setEditMode(false);
    }
    onLocked?.(newLocked);
    toast.success(newLocked ? "تم قفل نطاق العمل" : "تم فتح نطاق العمل للتعديل");
  };

  const saveEdits = () => {
    setFullText(editedText);
    setEditMode(false);
    onScopeGenerated?.(editedText, {});
    toast.success("تم حفظ التعديلات");
  };

  const hasContent = sections.length > 0 || fullText;

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              نطاق العمل الآلي
              {locked && (
                <Badge className="bg-green-500/10 text-green-600 text-[10px]">
                  <Lock className="w-3 h-3 ml-0.5" />
                  مقفل
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {hasContent && !locked && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={() => {
                      setEditMode(!editMode);
                      if (!editMode) setEditedText(fullText);
                    }}
                  >
                    {editMode ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                    {editMode ? "معاينة" : "تحرير"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] gap-1"
                    onClick={generateScope}
                    disabled={loading}
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                    إعادة التوليد
                  </Button>
                </>
              )}
              {hasContent && (
                <Button
                  variant={locked ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[11px] gap-1"
                  onClick={toggleLock}
                >
                  {locked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                  {locked ? "فتح" : "قفل"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Not generated yet */}
          {!hasContent && !loading && (
            <div className="text-center py-6 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center">
                <RaqeemIcon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  توليد نطاق العمل تلقائياً
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  سيتم إنشاء نطاق عمل مهني متوافق مع IVS 2025 بناءً على بيانات الطلب
                </p>
              </div>
              <Button onClick={generateScope} className="gap-1.5 text-xs" size="sm">
                <RaqeemIcon size={14} />
                توليد نطاق العمل
              </Button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">جارِ توليد نطاق العمل...</span>
            </div>
          )}

          {/* Basis of Value badge */}
          {basisInfo && !loading && (
            <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/10">
              <Scale className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground">
                  أساس القيمة: {basisInfo.ar}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {basisInfo.en} — {basisInfo.ivs}
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px] shrink-0">تلقائي</Badge>
            </div>
          )}

          {/* Methodology recommendation */}
          {methodology && !loading && (
            <div className="flex items-start gap-2 p-2 bg-accent/50 rounded-lg border border-border">
              <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] font-medium text-foreground">المنهجية المقترحة</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{methodology}</p>
              </div>
            </div>
          )}

          {/* Sections preview */}
          {!editMode && sections.length > 0 && !loading && (
            <div className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.key} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-foreground">{section.title}</span>
                    </div>
                    <div className="px-3 py-2">
                      <BidiText className="text-[11px] text-foreground/90" preserveNewlines>
                        {section.content}
                      </BidiText>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit mode */}
          {editMode && !locked && !loading && (
            <div className="space-y-2">
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="min-h-[300px] text-xs leading-relaxed font-sans"
                dir="rtl"
                placeholder="نص نطاق العمل..."
              />
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7"
                  onClick={() => {
                    setEditMode(false);
                    setEditedText(fullText);
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  size="sm"
                  className="text-[11px] h-7 gap-1"
                  onClick={saveEdits}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  حفظ التعديلات
                </Button>
              </div>
            </div>
          )}

          {/* Locked state info */}
          {locked && !loading && (
            <div className="flex items-center gap-2 p-2 bg-green-500/5 rounded-lg border border-green-500/20">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <p className="text-[11px] text-green-700">
                تم تأكيد نطاق العمل. سيتم تضمينه في التقرير النهائي.
              </p>
            </div>
          )}

          {/* Missing data warning */}
          {!purpose && !hasContent && !loading && (
            <div className="flex items-start gap-2 p-2 bg-warning/10 rounded-lg border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-warning">
                يرجى تحديد الغرض من التقييم والمستخدمين المقصودين قبل التوليد لضمان دقة نطاق العمل.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
