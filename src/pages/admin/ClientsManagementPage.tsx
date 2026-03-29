import TopBar from "@/components/layout/TopBar";
import ClientsManagement from "@/components/admin/ClientsManagement";

export default function ClientsManagementPage() {
  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">إدارة المستخدمين</h1>
          <p className="text-sm text-muted-foreground mt-1">عرض وإدارة جميع المستخدمين المسجلين وأدوارهم</p>
        </div>
        <ClientsManagement />
      </div>
    </div>
  );
}
