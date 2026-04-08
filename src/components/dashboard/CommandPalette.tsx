import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Command, CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  FileText, Users, Settings, Search, BarChart3,
  Scale, Archive, Shield, MapPin, Bell, BookOpen,
  DollarSign, ClipboardList, UserCheck, Activity,
} from "lucide-react";

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  path: string;
  group: string;
}

const PAGES: SearchResult[] = [
  { id: "dashboard", label: "مركز التحكم", icon: BarChart3, path: "/", group: "صفحات" },
  { id: "requests", label: "طلبات العملاء", icon: ClipboardList, path: "/client-requests", group: "صفحات" },
  { id: "valuations", label: "ملفات التقييم", icon: Scale, path: "/valuations", group: "صفحات" },
  { id: "reports", label: "التقارير", icon: FileText, path: "/reports", group: "صفحات" },
  { id: "clients", label: "إدارة العملاء", icon: Users, path: "/clients-management", group: "صفحات" },
  { id: "inspectors", label: "المعاينون", icon: UserCheck, path: "/inspectors", group: "صفحات" },
  { id: "coverage", label: "تغطية المعاينين", icon: MapPin, path: "/inspector-coverage", group: "صفحات" },
  { id: "archive", label: "الأرشيف", icon: Archive, path: "/archive", group: "صفحات" },
  { id: "cfo", label: "اللوحة المالية", icon: DollarSign, path: "/cfo-dashboard", group: "صفحات" },
  { id: "knowledge", label: "قاعدة المعرفة", icon: BookOpen, path: "/knowledge", group: "صفحات" },
  { id: "analytics", label: "التحليلات", icon: BarChart3, path: "/analytics", group: "صفحات" },
  { id: "audit", label: "سجل التدقيق", icon: Shield, path: "/audit-log", group: "صفحات" },
  { id: "notifications", label: "الإشعارات", icon: Bell, path: "/notifications", group: "صفحات" },
  { id: "monitoring", label: "مراقبة النظام", icon: Activity, path: "/system-monitoring", group: "صفحات" },
  { id: "settings", label: "الإعدادات", icon: Settings, path: "/settings", group: "صفحات" },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const searchDB = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    const results: SearchResult[] = [];

    // Search clients
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name_ar, phone")
      .or(`name_ar.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(5);

    (clients || []).forEach((c: any) => {
      results.push({
        id: `client-${c.id}`,
        label: c.name_ar,
        sublabel: c.phone || "",
        icon: Users,
        path: `/clients/${c.id}`,
        group: "عملاء",
      });
    });

    // Search assignments by reference_number
    const { data: assignments } = await supabase
      .from("valuation_assignments")
      .select("id, reference_number, property_type")
      .or(`reference_number.ilike.%${query}%`)
      .limit(5);

    (assignments || []).forEach((a: any) => {
      results.push({
        id: `assignment-${a.id}`,
        label: a.reference_number || a.id.slice(0, 8),
        sublabel: a.property_type || "",
        icon: Scale,
        path: `/assignment/${a.id}`,
        group: "ملفات تقييم",
      });
    });

    setSearchResults(results);
    setSearching(false);
  }, []);

  const handleSearch = (value: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchDB(value), 300);
  };

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <Command dir="rtl" className="rounded-lg">
        <CommandInput
          placeholder="ابحث عن عميل، ملف تقييم، أو صفحة..."
          onValueChange={handleSearch}
          className="text-right"
        />
        <CommandList>
          <CommandEmpty>
            {searching ? "جارٍ البحث..." : "لا توجد نتائج"}
          </CommandEmpty>

          {/* Dynamic search results */}
          {searchResults.length > 0 && (
            <>
              {["عملاء", "ملفات تقييم"].map(group => {
                const items = searchResults.filter(r => r.group === group);
                if (items.length === 0) return null;
                return (
                  <CommandGroup key={group} heading={group}>
                    {items.map(item => {
                      const Icon = item.icon;
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.label}
                          onSelect={() => handleSelect(item.path)}
                          className="gap-2"
                        >
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {item.sublabel && (
                            <span className="text-xs text-muted-foreground" dir="ltr">{item.sublabel}</span>
                          )}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
            </>
          )}

          {/* Static pages */}
          <CommandGroup heading="صفحات">
            {PAGES.map(page => {
              const Icon = page.icon;
              return (
                <CommandItem
                  key={page.id}
                  value={page.label}
                  onSelect={() => handleSelect(page.path)}
                  className="gap-2"
                >
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{page.label}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
