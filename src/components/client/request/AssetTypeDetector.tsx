/**
 * Asset Type Detector — AI detection + manual override panel
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle, AlertTriangle,
  PenLine, RotateCcw, Sparkles,
  Building2, Cog,
} from "lucide-react";

const ASSET_TYPES = [
  { key: "real_estate", label: "عقار", icon: Building2, desc: "أراضٍ، مباني، شقق، فلل" },
  { key: "machinery_equipment", label: "آلات ومعدات", icon: Cog, desc: "معدات صناعية، أجهزة، مركبات، أثاث" },
  { key: "both", label: "عقار + آلات ومعدات", icon: Sparkles, desc: "تقييم مختلط يشمل كلا النوعين" },
] as const;

const ASSET_TYPE_MAP: Record<string, typeof ASSET_TYPES[number]> = Object.fromEntries(
  ASSET_TYPES.map(t => [t.key, t])
);

export { ASSET_TYPES, ASSET_TYPE_MAP };

interface AssetTypeDetectorProps {
  detecting: boolean;
  confirmedType: string | null;
  detectedType: string | null;
  detectionFailed: boolean;
  detectionConfidence: number;
  detectionReason: string;
  showManualOverride: boolean;
  onConfirm: () => void;
  onManualSelect: (type: string) => void;
  onResetConfirmation: () => void;
  onShowManualOverride: () => void;
}

export default function AssetTypeDetector({
  detecting, confirmedType, detectedType, detectionFailed,
  detectionConfidence, detectionReason, showManualOverride,
  onConfirm, onManualSelect, onResetConfirmation, onShowManualOverride,
}: AssetTypeDetectorProps) {
  const confirmedInfo = confirmedType ? ASSET_TYPE_MAP[confirmedType] : null;
  const ConfirmedIcon = confirmedInfo?.icon;

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-primary" />
          نوع الأصل
          <Badge variant="secondary" className="text-[10px]">تحديد تلقائي</Badge>
        </p>

        {detecting && (
          <div className="border-2 border-dashed border-primary/30 rounded-xl p-5 text-center bg-primary/5">
            <Loader2 className="w-7 h-7 text-primary animate-spin mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">جارٍ تحليل الملفات...</p>
            <p className="text-xs text-muted-foreground mt-1">يتم تحديد نوع الأصل تلقائياً بالذكاء الاصطناعي</p>
          </div>
        )}

        {!detecting && confirmedType && confirmedInfo && ConfirmedIcon && (
          <div className="border-2 border-primary rounded-xl p-4 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <ConfirmedIcon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-foreground">{confirmedInfo.label}</h4>
                  <Badge variant="default" className="text-[10px]">مؤكد ✓</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{confirmedInfo.desc}</p>
              </div>
              <CheckCircle className="w-5 h-5 text-primary shrink-0" />
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={onResetConfirmation} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                <RotateCcw className="w-3 h-3" /> تغيير
              </button>
            </div>
          </div>
        )}

        {!detecting && !confirmedType && detectedType && !detectionFailed && (
          <div className="space-y-3">
            {(() => {
              const info = ASSET_TYPE_MAP[detectedType];
              const Icon = info?.icon;
              if (!info || !Icon) return null;
              return (
                <div className="border-2 border-border rounded-xl p-4 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">تم التعرف على نوع الأصل:</p>
                      <h4 className="font-bold text-sm text-foreground">{info.label}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{info.desc}</p>
                      {detectionReason && <p className="text-[10px] text-muted-foreground/70 mt-1">{detectionReason}</p>}
                    </div>
                    <Badge variant={detectionConfidence >= 70 ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {detectionConfidence}%
                    </Badge>
                  </div>
                  {detectionConfidence < 60 && (
                    <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                      <p className="text-[10px] text-destructive">ثقة التصنيف منخفضة — يرجى التحقق وتأكيد النوع الصحيح</p>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1 gap-1.5" onClick={onConfirm}>
                      <CheckCircle className="w-3.5 h-3.5" /> تأكيد
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={onShowManualOverride}>
                      <PenLine className="w-3.5 h-3.5" /> تعديل
                    </Button>
                  </div>
                </div>
              );
            })()}
            {showManualOverride && <ManualAssetSelector onSelect={onManualSelect} />}
          </div>
        )}

        {!detecting && !confirmedType && detectionFailed && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-destructive/30 rounded-xl p-4 text-center bg-destructive/5">
              <AlertTriangle className="w-7 h-7 text-destructive mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">تعذر التحديد التلقائي</p>
              <p className="text-xs text-muted-foreground mt-1">يرجى اختيار نوع الأصل يدوياً</p>
            </div>
            <ManualAssetSelector onSelect={onManualSelect} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ManualAssetSelector({ onSelect }: { onSelect: (type: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">اختر النوع الصحيح:</p>
      <div className="grid grid-cols-3 gap-2">
        {ASSET_TYPES.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => onSelect(t.key)}
              className="border-2 border-border rounded-lg p-3 text-center hover:border-primary/50 hover:bg-primary/5 transition-all">
              <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center mx-auto mb-1.5">
                <Icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-[11px] font-semibold text-foreground">{t.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
