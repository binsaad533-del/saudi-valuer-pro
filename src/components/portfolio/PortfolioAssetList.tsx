import { Badge } from "@/components/ui/badge";
import { Building2, Factory, Trash2, MapPin, Ruler } from "lucide-react";

export interface PortfolioAsset {
  id: string;
  asset_type: "real_estate" | "machinery";
  asset_category: string;
  asset_name_ar: string;
  city_ar?: string;
  district_ar?: string;
  land_area?: number;
  building_area?: number;
  description_ar?: string;
  attributes?: Record<string, any>;
  ai_extracted?: boolean;
  ai_confidence?: number;
}

interface PortfolioAssetListProps {
  assets: PortfolioAsset[];
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}

const ASSET_CATEGORY_LABELS: Record<string, string> = {
  land: "أرض",
  villa: "فيلا",
  apartment: "شقة",
  building: "عمارة",
  commercial: "تجاري",
  industrial: "صناعي",
  factory: "مصنع",
  warehouse: "مستودع",
  equipment: "معدات",
  machinery: "آلات",
  vehicle: "مركبة",
  other: "أخرى",
};

export default function PortfolioAssetList({ assets, onRemove, readOnly }: PortfolioAssetListProps) {
  const realEstateAssets = assets.filter(a => a.asset_type === "real_estate");
  const machineryAssets = assets.filter(a => a.asset_type === "machinery");

  const cities = [...new Set(assets.map(a => a.city_ar).filter(Boolean))];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-foreground">{assets.length}</p>
          <p className="text-[10px] text-muted-foreground">إجمالي الأصول</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-primary">{realEstateAssets.length}</p>
          <p className="text-[10px] text-muted-foreground">عقارات</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2 text-center">
          <p className="text-lg font-bold text-accent-foreground">{machineryAssets.length}</p>
          <p className="text-[10px] text-muted-foreground">معدات</p>
        </div>
      </div>

      {cities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {cities.map(city => (
            <Badge key={city} variant="outline" className="text-[10px]">
              <MapPin className="w-2.5 h-2.5 ml-0.5" />
              {city}
            </Badge>
          ))}
        </div>
      )}

      {/* Asset list */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {assets.map((asset, i) => (
          <div
            key={asset.id}
            className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-card text-xs"
          >
            <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
              asset.asset_type === "real_estate" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
            }`}>
              {asset.asset_type === "real_estate" ? (
                <Building2 className="w-3.5 h-3.5" />
              ) : (
                <Factory className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground truncate">{asset.asset_name_ar}</span>
                <Badge variant="secondary" className="text-[9px] h-4 shrink-0">
                  {ASSET_CATEGORY_LABELS[asset.asset_category] || asset.asset_category}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-muted-foreground">
                {asset.city_ar && <span>{asset.city_ar}</span>}
                {asset.land_area && (
                  <span className="flex items-center gap-0.5">
                    <Ruler className="w-2.5 h-2.5" />
                    {asset.land_area} م²
                  </span>
                )}
              </div>
              {asset.ai_extracted && (
                <Badge variant="outline" className="text-[9px] h-4 mt-1 border-primary/30 text-primary">
                  مستخرج بالذكاء الاصطناعي
                  {asset.ai_confidence && ` (${Math.round(asset.ai_confidence * 100)}%)`}
                </Badge>
              )}
            </div>
            {!readOnly && onRemove && (
              <button
                onClick={() => onRemove(asset.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
