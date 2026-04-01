import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  MapPin, Camera, ClipboardCheck, Send, ChevronRight, ChevronLeft, ChevronDown,
  Loader2, CheckCircle, AlertTriangle, Navigation, Trash2,
  Info, Building2, Ruler, Wrench, Zap, TrendingUp, ShieldAlert,
  FileCheck, UserCheck, Home, Upload, LayoutGrid, Sparkles, Copy, Lock,
} from "lucide-react";
import SectionPhotoUpload, { type SectionPhoto } from "@/components/inspection/SectionPhotoUpload";
import AiSuggestionBox from "@/components/inspection/AiSuggestionBox";
import { SectionHeader, FieldGroup, ExpandableSection } from "./helpers";
import type { FormData, PhotoItem, ChecklistItem } from "./types";
import { toast } from "sonner";

export default function SectionDocumentation({ photos, onCapture, onRemove, onDescriptionChange, requiredPhotoDone, requiredPhotoTotal }: any) {
  const groups = [
    { key: "exterior", title: "📸 صور خارجية", icon: "🏢" },
    { key: "interior", title: "🏠 صور داخلية", icon: "🛋️" },
    { key: "plan", title: "📐 مخططات ووثائق", icon: "📋" },
    { key: "problems", title: "⚠️ مشاكل وعيوب", icon: "🔍" },
    { key: "other", title: "📎 صور إضافية", icon: "📷" },
  ];

  const totalPhotos = photos.length;

  return (
    <div className="space-y-4">
      <SectionHeader num={11} title="التوثيق المصور" icon={Camera} subtitle={`${totalPhotos} صورة — ${requiredPhotoDone}/${requiredPhotoTotal} إجباري`} />
      {requiredPhotoDone < requiredPhotoTotal && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          أكمل جميع الصور المطلوبة ({requiredPhotoTotal - requiredPhotoDone} متبقية)
        </div>
      )}
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {groups.map(g => {
          const count = photos.filter((p: PhotoItem) => PHOTO_CATEGORIES.find(c => c.key === p.category)?.group === g.key).length;
          return count > 0 ? <Badge key={g.key} variant="secondary" className="text-xs">{g.icon} {count}</Badge> : null;
        })}
      </div>
      {groups.map(g => {
        const cats = PHOTO_CATEGORIES.filter(c => c.group === g.key);
        return (
          <Card key={g.key}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{g.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cats.map((cat) => (
                <PhotoCategoryRow key={cat.key} cat={cat} photos={photos} onCapture={onCapture} onRemove={onRemove} onDescriptionChange={onDescriptionChange} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PhotoCategoryRow({ cat, photos, onCapture, onRemove, onDescriptionChange }: any) {
  const catPhotos = photos.filter((p: PhotoItem) => p.category === cat.key);
  return (
    <div className={`border rounded-lg p-3 ${catPhotos.length > 0 ? "border-green-200 dark:border-green-800" : cat.required ? "border-yellow-200 dark:border-yellow-800" : "border-border"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{cat.label}</span>
          {cat.required && <Badge variant="secondary" className="text-[8px] px-1">مطلوب</Badge>}
        </div>
        <Badge variant={catPhotos.length > 0 ? "default" : "outline"} className="text-[10px]">{catPhotos.length} صور</Badge>
      </div>
      {catPhotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {catPhotos.map((p: PhotoItem, i: number) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-border bg-muted group">
              <div className="aspect-square">
                <img src={p.preview} alt={p.description || ""} className="w-full h-full object-cover" />
              </div>
              {/* Overlay controls */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-1 gap-1">
                <button onClick={() => onRemove(p)} className="bg-destructive text-destructive-foreground p-1.5 rounded-md shadow">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Description */}
              <div className="p-1.5">
                <Input
                  value={p.description || ""}
                  onChange={(e: any) => onDescriptionChange(p, e.target.value)}
                  placeholder="وصف..."
                  className="text-[10px] h-6 px-1.5 border-none bg-transparent focus-visible:ring-1"
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <label className="block">
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => onCapture(cat.key, e.target.files)} />
        <div className="flex items-center justify-center gap-2 h-10 border-2 border-dashed rounded-md text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors">
          <Camera className="w-4 h-4" /> التقاط / رفع صورة
        </div>
      </label>
    </div>
  );
}

