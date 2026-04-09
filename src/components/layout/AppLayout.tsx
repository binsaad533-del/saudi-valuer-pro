import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import RaqeemFloatingButton from "@/components/raqeem/RaqeemFloatingButton";

export default function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-auto">
          <header className="h-11 flex items-center border-b border-border px-3 shrink-0 lg:hidden">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      <RaqeemFloatingButton />
    </SidebarProvider>
  );
}
