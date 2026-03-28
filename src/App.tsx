import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ValuationsList from "@/pages/ValuationsList";
import NewValuation from "@/pages/NewValuation";
import ComparablesPage from "@/pages/ComparablesPage";
import ArchivePage from "@/pages/ArchivePage";
import VerifyReport from "@/pages/VerifyReport";
import ReportGenerator from "@/pages/ReportGenerator";
import ClientRequests from "@/pages/admin/ClientRequests";
import ValuationProduction from "@/pages/admin/ValuationProduction";
import NotFound from "./pages/NotFound.tsx";

// Client Portal
import ClientLogin from "@/pages/client/ClientLogin";
import ClientRegister from "@/pages/client/ClientRegister";
import ClientDashboard from "@/pages/client/ClientDashboard";
import NewRequest from "@/pages/client/NewRequest";
import RequestDetails from "@/pages/client/RequestDetails";
import InspectorDashboard from "@/pages/inspector/InspectorDashboard";
import InspectorCoverage from "@/pages/admin/InspectorCoverage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Admin Routes */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/valuations" element={<ValuationsList />} />
            <Route path="/valuations/new" element={<NewValuation />} />
            <Route path="/comparables" element={<ComparablesPage />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/reports/generate" element={<ReportGenerator />} />
            <Route path="/verify" element={<VerifyReport />} />
            <Route path="/client-requests" element={<ClientRequests />} />
            <Route path="/valuation-production/:assignmentId" element={<ValuationProduction />} />
            <Route path="/inspector" element={<InspectorDashboard />} />
          </Route>

          {/* Client Portal Routes */}
          <Route path="/client/login" element={<ClientLogin />} />
          <Route path="/client/register" element={<ClientRegister />} />
          <Route path="/client" element={<ClientDashboard />} />
          <Route path="/client/new-request" element={<NewRequest />} />
          <Route path="/client/request/:id" element={<RequestDetails />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
