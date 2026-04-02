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
import ValuationsList from "@/pages/ValuationsList";
import NewValuation from "@/pages/NewValuation";

import ArchivePage from "@/pages/ArchivePage";
import VerifyReport from "@/pages/VerifyReport";
import ReportGenerator from "@/pages/ReportGenerator";
import ClientRequests from "@/pages/admin/ClientRequests";
import ValuationProduction from "@/pages/admin/ValuationProduction";
import ReviewPage from "@/pages/ReviewPage";
import SearchPage from "@/pages/SearchPage";
import CompliancePage from "@/pages/CompliancePage";
import SettingsPage from "@/pages/SettingsPage";
import ValuationProductionList from "@/pages/ValuationProductionList";
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
import RaqeemPage from "@/pages/RaqeemPage";

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
import CFODashboardPage from "@/pages/CFODashboardPage";
import CoordinatorDashboard from "@/pages/coordinator/CoordinatorDashboard";
import AIDocumentProcessingPage from "@/pages/AIDocumentProcessingPage";
import ScopeAndPricingPage from "@/pages/ScopeAndPricingPage";
import AIReportGenerationPage from "@/pages/AIReportGenerationPage";
import SmartToolsPage from "@/pages/SmartToolsPage";
import AssignmentHubPage from "@/pages/AssignmentHubPage";
import AnalyticsDashboardPage from "@/pages/AnalyticsDashboardPage";
import MarketDataPage from "@/pages/MarketDataPage";

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

          {/* Admin Routes - Protected */}
          <Route element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Dashboard />} />
            <Route path="/valuations" element={<ValuationsList />} />
            <Route path="/valuations/new" element={<NewValuation />} />
            <Route path="/valuations/:id" element={<ValuationDetailPage />} />
            <Route path="/assignment/:id" element={<AssignmentHubPage />} />
            <Route path="/valuations/review" element={<ValuationsList />} />
            <Route path="/valuations/completed" element={<ValuationsList />} />
            <Route path="/comparables" element={<MarketDataPage />} />
            <Route path="/market-data" element={<MarketDataPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/reports" element={<ReportsListPage />} />
            <Route path="/reports/generate" element={<ReportGenerator />} />
            <Route path="/reports/generate/:id" element={<ReportGenerator />} />
            <Route path="/client-requests" element={<ClientRequests />} />
            <Route path="/valuation-production" element={<ValuationProductionList />} />
            <Route path="/valuation-production/:assignmentId" element={<ValuationProduction />} />
            <Route path="/inspector-coverage" element={<InspectorCoverage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/raqeem" element={<RaqeemPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/clients-management" element={<ClientsManagementPage />} />
            <Route path="/inspectors" element={<InspectorsListPage />} />
            <Route path="/inspectors/:userId" element={<InspectorProfilePage />} />
            <Route path="/cfo-dashboard" element={<CFODashboardPage />} />
            <Route path="/coordinator-dashboard" element={<CoordinatorDashboard />} />
            <Route path="/smart-tools" element={<SmartToolsPage />} />
            <Route path="/ai-document-processing" element={<AIDocumentProcessingPage />} />
            <Route path="/scope-and-pricing" element={<ScopeAndPricingPage />} />
            <Route path="/ai-scope-pricing" element={<ScopeAndPricingPage />} />
            <Route path="/ai-report-generation" element={<AIReportGenerationPage />} />
            <Route path="/analytics" element={<AnalyticsDashboardPage />} />
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
