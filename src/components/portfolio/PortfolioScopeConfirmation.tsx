import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileText, MapPin, Building2, Factory } from "lucide-react";
import type { PortfolioAsset } from "./PortfolioAssetList";

interface PortfolioScopeConfirmationProps {
  assets: PortfolioAsset[];
  valuationType: string;
  purpose?: string;
  onConfirm: () => void;
  onEdit: () => void;
  confirmed: boolean;
}

export default function PortfolioScopeConfirmation({
  assets,
  valuationType,
  purpose,
  onConfirm,
  onEdit,
  confirmed,
}: PortfolioScopeConfirmationProps) {
  const realEstateCount = assets.filter(a => a.asset_type === "real_estate").length;
  const machineryCount = assets.filter(a => a.asset_type === "machinery").length;
  const cities = [...new Set(assets.map(a => a.city_ar).filter(Boolean))];
  const categories = [...new Set(assets.map(a => a.asset_category))];

  const purposeLabels: Record<string, string> = {
    sale_purchase: "بيع / شراء",
    mortgage: "رهن عقاري",
    financial_reporting: "تقارير مالية",
    insurance: "تأمين",
    taxation: "ضريبي",
    litigation: "قضائي",
    investment: "استثمار",
    other: "أخرى",
  };

  const generateScopeText = () => {
    const lines: string[] = [];
    lines.push(`محفظة تقييم تشمل ${assets.length} أصل/أصول`);
    if (realEstateCount > 0) lines.push(`• ${realEstateCount} عقار/عقارات`);
    if (machineryCount > 0) lines.push(`• ${machineryCount} آلة/معدة`);
    if (cities.length > 0) lines.push(`المدن: ${cities.join("، ")}`);
    if (purpose) lines.push(`الغرض: ${purposeLabels[purpose] || purpose}`);
    lines.push(`أنواع الأصول: ${categories.map(c => c).join("، ")}`);
    return lines.join("\n");
  };

  return (
    <Card className={`shadow-card border-2 transition-colors ${confirmed ? "border-green-500/50" : "border-primary/30"}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          نطاق العمل – المحفظة
          {confirmed && (
            <Badge className="bg-green-500/10 text-green-600 text-[10px]">
              <CheckCircle className="w-3 h-3 ml-0.5" />
              مؤكد
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-2 whitespace-pre-line text-foreground">
          {generateScopeText()}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {realEstateCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              <Building2 className="w-3 h-3 ml-0.5" />
              {realEstateCount} عقار
            </Badge>
          )}
          {machineryCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              <Factory className="w-3 h-3 ml-0.5" />
              {machineryCount} معدة
            </Badge>
          )}
          {cities.map(city => (
            <Badge key={city} variant="outline" className="text-[10px]">
              <MapPin className="w-2.5 h-2.5 ml-0.5" />
              {city}
            </Badge>
          ))}
        </div>

        {!confirmed ? (
          <div className="flex gap-2">
            <Button onClick={onConfirm} size="sm" className="flex-1 text-xs">
              <CheckCircle className="w-3.5 h-3.5 ml-1" />
              تأكيد نطاق العمل
            </Button>
            <Button onClick={onEdit} size="sm" variant="outline" className="text-xs">
              تعديل
            </Button>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground text-center">
            تم تأكيد نطاق العمل. يمكنك إرسال الطلب الآن.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
