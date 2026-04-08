import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { type AssetLocation } from "@/components/client/AssetLocationPicker";
import { openLocationInGoogleMaps } from "@/lib/google-maps";

interface LocationsSummaryProps {
  locations: AssetLocation[];
}

export function LocationsSummary({ locations }: LocationsSummaryProps) {
  if (locations.length === 0) return null;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          مواقع الأصول ({locations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {locations.map(loc => (
            <button
              key={loc.id}
              type="button"
              onClick={() => openLocationInGoogleMaps(loc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary/40 transition-colors shadow-sm text-sm font-medium text-foreground hover:text-primary"
            >
              <Navigation className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="max-w-[160px] truncate">{loc.name}</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
