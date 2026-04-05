import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import ExecutiveDashboard from "@/pages/ExecutiveDashboard";
import ValuationsList from "@/pages/ValuationsList";
import NewValuation from "@/pages/NewValuation";

import ArchivePage from "@/pages/ArchivePage";
import VerifyReport from "@/pages/VerifyReport";
import ReportGenerator from "@/pages/ReportGenerator";
import ClientRequests from "@/pages/admin/ClientRequests";
import ValuationProduction from "@/pages/admin/ValuationProduction";
import ReviewPage from "@/pages/ReviewPage";
import SearchPage from "@/pages/SearchPage";
import SettingsPage from "@/pages/SettingsPage";
import ReportsListPage from "@/pages/ReportsListPage";
import ValuationDetailPage from "@/pages/ValuationDetailPage";
import NotFound from "./pages/NotFound.tsx";

// Unified Login
import UnifiedLogin from "@/pages/UnifiedLogin";

// Admin
import ClientsManagementPage from "@/pages/admin/ClientsManagementPage";
import InspectorsListPage from "@/pages/admin/InspectorsListPage";
import InspectorProfilePage from "@/pages/admin/InspectorProfilePage";
import InspectorCoverage from "@/pages/admin/InspectorCoverage";
import ClientProfilePage from "@/pages/admin/ClientProfilePage";
import MarketDataPage from "@/pages/MarketDataPage";
import AnalyticsDashboardPage from "@/pages/AnalyticsDashboardPage";
import CFODashboardPage from "@/pages/CFODashboardPage";
import AssignmentHubPage from "@/pages/AssignmentHubPage";
import ValuationWorkspacePage from "@/pages/ValuationWorkspacePage";
import KnowledgeBasePage from "@/pages/KnowledgeBasePage";
import UnsubscribePage from "@/pages/UnsubscribePage";
import UserSettingsPage from "@/pages/UserSettingsPage";
import NotificationsPage from "@/pages/NotificationsPage";
import NotificationSettingsPage from "@/pages/NotificationSettingsPage";
import AuditLogPage from "@/pages/AuditLogPage";
import CommercialDashboardPage from "@/pages/CommercialDashboardPage";
import SystemMonitoringPage from "@/pages/SystemMonitoringPage";

// Client Portal
import ClientRegister from "@/pages/client/ClientRegister";
import ForgotPassword from "@/pages/client/ForgotPassword";
import ResetPassword from "@/pages/client/ResetPassword";
import ClientDashboard from "@/pages/client/ClientDashboard";
import NewRequest from "@/pages/client/NewRequest";
import RequestDetails from "@/pages/client/RequestDetails";
import ClientRequestsPage from "@/pages/client/ClientRequestsPage";

// Inspector Portal
import InspectorDashboard from "@/pages/inspector/InspectorDashboard";
import MobileInspectionFlow from "@/pages/inspector/MobileInspectionFlow";

// Field Inspection (standalone)
import FieldInspectionPage from "@/pages/FieldInspectionPage";

const queryClient = new QueryClient();
const ADMIN_ROLES = ["owner", "admin_coordinator", "financial_manager"];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <LanguageProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Unified Login */}
          <Route path="/login" element={<UnifiedLogin />} />
          <Route path="/client/login" element={<UnifiedLogin />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />

          {/* Admin Routes - Protected */}
          <Route element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<ExecutiveDashboard />} />
            <Route path="/dashboard-legacy" element={<Dashboard />} />
            <Route path="/valuations" element={<ValuationsList />} />
            <Route path="/valuations/new" element={<NewValuation />} />
            <Route path="/valuations/:id" element={<ValuationDetailPage />} />
            <Route path="/assignment/:id" element={<AssignmentHubPage />} />
            <Route path="/workspace" element={<ValuationWorkspacePage />} />
            <Route path="/market-data" element={<MarketDataPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/reports" element={<ReportsListPage />} />
            <Route path="/reports/generate" element={<ReportGenerator />} />
            <Route path="/reports/generate/:id" element={<ReportGenerator />} />
            <Route path="/client-requests" element={<ClientRequests />} />
            <Route path="/valuation-production/:assignmentId" element={<ValuationProduction />} />
            <Route path="/inspector-coverage" element={<InspectorCoverage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/clients-management" element={<ClientsManagementPage />} />
            <Route path="/clients/:clientId" element={<ClientProfilePage />} />
            <Route path="/inspectors" element={<InspectorsListPage />} />
            <Route path="/inspectors/:userId" element={<InspectorProfilePage />} />
            <Route path="/cfo-dashboard" element={<CFODashboardPage />} />
            <Route path="/knowledge" element={<KnowledgeBasePage />} />
            <Route path="/analytics" element={<AnalyticsDashboardPage />} />
            <Route path="/account" element={<UserSettingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/notification-settings" element={<NotificationSettingsPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/commercial" element={<CommercialDashboardPage />} />
            <Route path="/system-monitoring" element={<SystemMonitoringPage />} />
          </Route>

          {/* Inspector Portal - Protected */}
          <Route path="/inspector" element={
            <ProtectedRoute allowedRoles={["inspector"]} redirectTo="/login">
              <InspectorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/inspector/inspection/:inspectionId" element={
            <ProtectedRoute allowedRoles={["inspector"]} redirectTo="/login">
              <MobileInspectionFlow />
            </ProtectedRoute>
          } />
          <Route path="/inspector/settings" element={
            <ProtectedRoute allowedRoles={["inspector"]} redirectTo="/login">
              <UserSettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/inspector/notifications" element={
            <ProtectedRoute allowedRoles={["inspector"]} redirectTo="/login">
              <NotificationsPage />
            </ProtectedRoute>
          } />
          <Route path="/inspector/notification-settings" element={
            <ProtectedRoute allowedRoles={["inspector"]} redirectTo="/login">
              <NotificationSettingsPage />
            </ProtectedRoute>
          } />

          {/* Client Portal */}
          <Route path="/client/register" element={<ClientRegister />} />
          <Route path="/client/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/client" element={
            <ProtectedRoute allowedRoles={["client"]} redirectTo="/login">
              <ClientDashboard />
            </ProtectedRoute>
          } />
          <Route path="/client/dashboard" element={
            <ProtectedRoute allowedRoles={["client"]} redirectTo="/login">
              <ClientDashboard />
            </ProtectedRoute>
          } />
          <Route path="/client/requests" element={
            <ProtectedRoute allowedRoles={["client"]} redirectTo="/login">
              <ClientRequestsPage />
            </ProtectedRoute>
          } />
          <Route path="/client/new-request" element={
            <ProtectedRoute allowedRoles={["client"]} redirectTo="/login">
              <NewRequest />
            </ProtectedRoute>
          } />
          <Route path="/client/request/:id" element={
            <ProtectedRoute allowedRoles={["client"]} redirectTo="/login">
              <RequestDetails />
            </ProtectedRoute>
          } />
          <Route path="/client/settings" element={
            <ProtectedRoute allowedRoles={["client"]} redirectTo="/login">
              <UserSettingsPage />
            </ProtectedRoute>
          } />
          <Route path="/client/notifications" element={
            <ProtectedRoute allowedRoles={["client"]} redirectTo="/login">
              <NotificationsPage />
            </ProtectedRoute>
          } />
          <Route path="/client/notification-settings" element={
            <ProtectedRoute allowedRoles={["client"]} redirectTo="/login">
              <NotificationSettingsPage />
            </ProtectedRoute>
          } />

          {/* Public Verification */}
          <Route path="/verify" element={<VerifyReport />} />
          <Route path="/verify/:token" element={<VerifyReport />} />

          {/* Field Inspection (standalone) */}
          <Route path="/field-inspection" element={<FieldInspectionPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
