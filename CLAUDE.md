# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:8080
npm run build        # Production build
npm run lint         # ESLint

# Testing
npm run test         # Run all unit tests (vitest, single run)
npm run test:watch   # Vitest in watch mode
npx playwright test  # E2E tests (playwright)

# Run a single test file
npx vitest run src/test/desktop-valuation.test.ts
```

## مرجع المشروع — وثيقة جساس

### الهوية
جساس منصة تقييم احترافية ذكية مؤتمتة مرخصة ومتوافقة مع معايير IVS ومعايير هيئة تقييم السعودية. المحرك الذكي اسمه "رقيم".

### المستخدمون (5 أدوار فقط)
1. المالك — مقيّم معتمد، صلاحية كاملة، حكم مهني إلزامي
2. المدير المالي — متابعة مالية وتأكيد تحويلات فقط، لا يرى التقارير
3. المعاين — يستقبل أوامر العمل الميدانية ويرفع الصور والبيانات
4. العميل — يقدم الطلب ويرفع الملفات ويدفع
5. رقيم — المحرك الذكي يقود كل شيء تلقائياً

### دورة حياة التقييم (11 مرحلة)
1. العميل يقدم الطلب (draft)
2. رقيم يحلل الملفات ويبني فهرس الأصول (stage_1_processing → stage_2_client_review)
3. العميل يعتمد الفهرس (stage_2_client_review → stage_3_owner_scope)
4. المالك يعتمد نطاق العمل والسعر (stage_3_owner_scope → stage_4_client_scope)
5. العميل يوافق ويدفع 50% (stage_4_client_scope → pending_payment_1)
6. المعاينة الميدانية إن وجدت (stage_5_inspection → stage_6_owner_draft)
7. رقيم يشغّل محرك التقييم + المالك يطبق الحكم المهني
8. رقيم يولّد المسودة DRAFT (stage_6_owner_draft → stage_7_client_draft)
9. العميل يراجع المسودة ويدفع 50% (stage_7_client_draft → pending_payment_2)
10. المالك يوقّع إلكترونياً
11. إصدار التقرير النهائي المشفر + أرشفة 10 سنوات

### ضوابط ثابتة
- كل الأرقام إنجليزية 0123456789
- كل التواريخ ميلادية DD/MM/YYYY
- الواجهة كاملة عربية RTL
- شعار جساس في كل صفحة
- لا يُحذف أي سجل حذفاً فعلياً
- PDF مشفر غير قابل للتعديل مع علامة مائية وباركود

### القرار
البناء من صفر فوق قاعدة بيانات Supabase الموجودة مع الاستفادة من: HyperPay، محرك الحسابات، نظام الإشعارات.

---

## Architecture Overview

This is a **multi-portal SPA** for a Saudi real estate & asset valuation firm ("جساس للتقييم"), built with React 18 + TypeScript + Vite. All data and auth runs through Supabase.

### Three Portals, One App

`App.tsx` defines all routes and gates each portal by role:

| Portal | Role(s) | Root path |
|---|---|---|
| Admin / Operations | `owner`, `admin_coordinator`, `financial_manager` | `/` |
| Inspector (mobile-first) | `inspector` | `/inspector` |
| Client | `client` | `/client` |

`ProtectedRoute` reads `role` from `useAuth` and redirects unauthorized users. `admin_coordinator`, `valuation_manager`, and `valuer` are treated as `owner`-level for access checks.

### Auth & Roles

`useAuth` (`src/hooks/useAuth.tsx`) wraps Supabase auth and fetches the user's role from the `user_roles` table and `account_status` from `profiles`. The role drives both routing and sidebar navigation (see `AppSidebar`).

### Internationalization

`LanguageContext` (`src/contexts/LanguageContext.tsx`) provides bilingual support (Arabic default, English). It sets `dir="rtl|ltr"` on `<html>`. Use `const { t, dir, language } = useLanguage()` in components. All translation strings live in the `translations` map in that file — add new keys there.

### Supabase Integration

- Client: `src/integrations/supabase/client.ts` — import as `import { supabase } from "@/integrations/supabase/client"`
- Types: `src/integrations/supabase/types.ts` — auto-generated, do not edit manually
- Edge Functions: `supabase/functions/` — many AI/workflow functions (report generation, AI intake, payment processing, notifications, etc.)
- Migrations: `supabase/migrations/`

### State Management

- **Server state**: React Query (`@tanstack/react-query`) for all Supabase data fetching
- **UI state**: local `useState` / `useReducer` in components
- **Auth state**: `AuthContext` (via `useAuth`)
- **Language**: `LanguageContext` (via `useLanguage`)

### Component Organization

```
src/components/
  ui/           # shadcn/ui primitives (auto-generated, avoid editing)
  layout/       # AppLayout, AppSidebar, TopBar, ProtectedRoute
  dashboard/    # Admin dashboard widgets
  inspection/   # Field inspection sections (sectioned by asset type)
  client/       # Client portal components
  cfo/          # Financial manager views
  coordinator/  # Admin coordinator views
  payments/     # Checkout, payment proof, history
  raqeem/       # "Raqeem" AI knowledge/rules engine modules
  compliance/   # Compliance gating and alerts
  notifications/# Notification center and preferences
```

Pages in `src/pages/` mirror portal structure: `pages/admin/`, `pages/client/`, `pages/inspector/`.

### Path Alias

`@/` resolves to `src/`. Always use `@/` imports, never relative paths across directories.

### UI Primitives

shadcn/ui with Tailwind CSS. Base color: `slate`. Add new shadcn components via `npx shadcn-ui@latest add <component>`. Custom theme variables are in `src/index.css`.

### Key Environment Variables

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Set in `.env` (gitignored). The app will fail silently if these are missing.

### Services

- `src/services/fullReportGenerator.ts` — client-side report generation logic
- `src/services/pdfExportService.ts` — PDF export via jsPDF + html2canvas
- `src/utils/` — report numbering, workflow state, verification token generation
