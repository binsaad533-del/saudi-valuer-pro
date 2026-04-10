import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { RaqeemAgentProvider } from "@/contexts/RaqeemAgentContext";
import SecurityWatermark from "@/components/security/SecurityWatermark";
import AppLayout from "@/components/layout/AppLayout";
import ClientLayout from "@/components/layout/ClientLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import ExecutiveDashboard from "@/pages/ExecutiveDashboard";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
import SmartMarketingDashboard from "@/pages/admin/SmartMarketingDashboard";
import RaqeemWatchdogPage from "@/pages/RaqeemWatchdogPage";
import RaqeemTechEnginePage from "@/pages/RaqeemTechEnginePage";
import RaqeemExpertPage from "@/pages/RaqeemExpertPage";
import RaqeemChatPage from "@/pages/RaqeemChatPage";
import RaqeemFloatingButton from "@/components/raqeem/RaqeemFloatingButton";
import ClientAuth from "@/pages/client/ClientAuth";
import ForgotPassword from "@/pages/client/ForgotPassword";
import RecoveryCallback from "@/pages/client/RecoveryCallback";
import ResetPassword from "@/pages/client/ResetPassword";
import ClientDashboard from "@/pages/client/ClientDashboard";
import SimplifiedJourney from "@/pages/client/SimplifiedJourney";
import RequestDetails from "@/pages/client/RequestDetails";
import ClientRequestsPage from "@/pages/client/ClientRequestsPage";
import ClientChatPage from "@/pages/client/ClientChatPage";

// Inspector Portal
import InspectorDashboard from "@/pages/inspector/InspectorDashboard";
import MobileInspectionFlow from "@/pages/inspector/MobileInspectionFlow";
import InspectorChatPage from "@/pages/inspector/InspectorChatPage";

// CFO Chat
import CFOChatPage from "@/pages/cfo/CFOChatPage";

// Field Inspection (standalone)
import FieldInspectionPage from "@/pages/FieldInspectionPage";

const queryClient = new QueryClient();
const ADMIN_ROLES = ["owner", "admin_coordinator", "financial_manager"];
function ExecutiveDashboardOrRedirect() {
  const { role } = useAuth();
  if (role === "financial_manager") return <Navigate to="/cfo-dashboard" replace />;
  return <ExecutiveDashboard />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <LanguageProvider>
    <RaqeemAgentProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <SecurityWatermark />
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
            <Route path="/" element={<ExecutiveDashboardOrRedirect />} />
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
            <Route path="/cfo-chat" element={<CFOChatPage />} />
            <Route path="/knowledge" element={<KnowledgeBasePage />} />
            <Route path="/analytics" element={<AnalyticsDashboardPage />} />
            <Route path="/account" element={<UserSettingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/notification-settings" element={<NotificationSettingsPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/commercial" element={<CommercialDashboardPage />} />
            <Route path="/system-monitoring" element={<SystemMonitoringPage />} />
            <Route path="/smart-marketing" element={<SmartMarketingDashboard />} />
            <Route path="/watchdog" element={<RaqeemWatchdogPage />} />
            <Route path="/tech-engine" element={<RaqeemTechEnginePage />} />
            <Route path="/expert" element={<RaqeemExpertPage />} />
          </Route>

          {/* Inspector Portal - Protected */}
          <Route path="/inspector" element={
            <ProtectedRoute allowedRoles={["inspector"]} redirectTo="/login">
              <InspectorDashboard />
            </ProtectedRoute>
          } />
          <Route path="/inspector/chat" element={
            <ProtectedRoute allowedRoles={["inspector"]} redirectTo="/login">
              <InspectorChatPage />
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
          <Route path="/client/auth" element={<ClientAuth />} />
          <Route path="/client/register" element={<Navigate to="/client/auth" replace />} />
          <Route path="/client/register-advanced" element={<Navigate to="/client/auth" replace />} />
          <Route path="/client/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/recovery" element={<RecoveryCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={
            <ProtectedRoute allowedRoles={["client"]} redirectTo="/login">
              <ClientLayout />
            </ProtectedRoute>
          }>
            <Route path="/client" element={<ClientDashboard />} />
            <Route path="/client/dashboard" element={<ClientDashboard />} />
            <Route path="/client/requests" element={<ClientRequestsPage />} />
            <Route path="/client/new-request" element={<SimplifiedJourney />} />
            <Route path="/client/new-request-full" element={<Navigate to="/client/new-request" replace />} />
            <Route path="/client/new-request-advanced" element={<Navigate to="/client/new-request" replace />} />
            <Route path="/client/request/:id" element={<RequestDetails />} />
            <Route path="/client/settings" element={<UserSettingsPage />} />

            <Route path="/client/chat" element={<ClientChatPage />} />
            <Route path="/client/notifications" element={<NotificationsPage />} />
            <Route path="/client/notification-settings" element={<NotificationSettingsPage />} />
          </Route>

          {/* Raqeem Chat — accessible to all authenticated users */}
          <Route path="/raqeem-chat" element={<RaqeemChatPage />} />

          {/* Public Verification */}
          <Route path="/verify" element={<VerifyReport />} />
          <Route path="/verify/:token" element={<VerifyReport />} />

          {/* Field Inspection (standalone) */}
          <Route path="/field-inspection" element={<FieldInspectionPage />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        <RaqeemFloatingButton />
      </BrowserRouter>
    </TooltipProvider>
    </RaqeemAgentProvider>
    </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
