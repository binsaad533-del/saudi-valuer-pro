import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function SectionHeader({ num, title, icon: Icon, subtitle }: { num: number; title: string; icon: any; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
        {num}
      </div>
      <div className="flex-1">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" /> {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function ExpandableSection({ icon, title, children, defaultOpen = false, badge }: { icon: string; title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-right transition-colors hover:bg-muted/50">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-bold text-foreground flex-1">{title}</span>
          {badge && <Badge variant="secondary" className="text-[10px] h-5">{badge}</Badge>}
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
