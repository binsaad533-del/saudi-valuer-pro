import { useState } from "react";
import TopBar from "@/components/layout/TopBar";
import ClientsManagement from "@/components/admin/ClientsManagement";
import ClientIdentityPanel from "@/components/admin/ClientIdentityPanel";

export default function ClientsManagementPage() {
  const [tab, setTab] = useState<"users" | "records">("users");

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">إدارة العملاء والمستخدمين</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة حسابات المستخدمين وسجلات العملاء الدائمة</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 rounded-lg bg-muted p-1 mb-6 w-fit">
          <button
            onClick={() => setTab("users")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "users" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            حسابات المستخدمين
          </button>
          <button
            onClick={() => setTab("records")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === "records" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            سجلات العملاء
          </button>
        </div>

        {tab === "users" ? <ClientsManagement /> : <ClientIdentityPanel />}
      </div>
    </div>
  );
}
