
export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  valuationType: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue" | "cancelled";
}

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  method: "bank_transfer" | "credit_card" | "cash" | "cheque";
  date: string;
}

const methodLabels: Record<Payment["method"], string> = {
  bank_transfer: "تحويل بنكي",
  credit_card: "بطاقة ائتمان",
  cash: "نقدي",
  cheque: "شيك",
};

const statusLabels: Record<Invoice["status"], string> = {
  paid: "مدفوعة",
  pending: "معلقة",
  overdue: "متأخرة",
  cancelled: "ملغاة",
};

export { methodLabels, statusLabels };

export const monthlyRevenue = [
  { month: "يناير", revenue: 185000 },
  { month: "فبراير", revenue: 210000 },
  { month: "مارس", revenue: 195000 },
  { month: "أبريل", revenue: 240000 },
  { month: "مايو", revenue: 225000 },
  { month: "يونيو", revenue: 260000 },
  { month: "يوليو", revenue: 235000 },
  { month: "أغسطس", revenue: 215000 },
  { month: "سبتمبر", revenue: 275000 },
  { month: "أكتوبر", revenue: 290000 },
  { month: "نوفمبر", revenue: 310000 },
  { month: "ديسمبر", revenue: 330000 },
];

export const invoices: Invoice[] = [
  { id: "1", invoiceNumber: "INV-2025-001", clientName: "شركة الراجحي للتطوير العقاري", valuationType: "تقييم عقاري سكني", amount: 15000, issueDate: "2025-01-05", dueDate: "2025-02-05", status: "paid" },
  { id: "2", invoiceNumber: "INV-2025-002", clientName: "مؤسسة الفهد التجارية", valuationType: "تقييم تجاري", amount: 25000, issueDate: "2025-01-12", dueDate: "2025-02-12", status: "paid" },
  { id: "3", invoiceNumber: "INV-2025-003", clientName: "بنك البلاد", valuationType: "تقييم ضمانات بنكية", amount: 35000, issueDate: "2025-01-20", dueDate: "2025-02-20", status: "paid" },
  { id: "4", invoiceNumber: "INV-2025-004", clientName: "شركة جبل عمر للتطوير", valuationType: "تقييم أراضي", amount: 45000, issueDate: "2025-02-01", dueDate: "2025-03-01", status: "paid" },
  { id: "5", invoiceNumber: "INV-2025-005", clientName: "مجموعة العليان", valuationType: "تقييم محفظة عقارية", amount: 60000, issueDate: "2025-02-15", dueDate: "2025-03-15", status: "pending" },
  { id: "6", invoiceNumber: "INV-2025-006", clientName: "شركة المراعي", valuationType: "تقييم منشآت صناعية", amount: 55000, issueDate: "2025-02-20", dueDate: "2025-03-20", status: "pending" },
  { id: "7", invoiceNumber: "INV-2025-007", clientName: "الهيئة الملكية لمدينة الرياض", valuationType: "تقييم أراضي حكومية", amount: 80000, issueDate: "2025-03-01", dueDate: "2025-04-01", status: "overdue" },
  { id: "8", invoiceNumber: "INV-2025-008", clientName: "شركة سابك", valuationType: "تقييم مجمع صناعي", amount: 120000, issueDate: "2025-03-05", dueDate: "2025-04-05", status: "overdue" },
  { id: "9", invoiceNumber: "INV-2025-009", clientName: "مصرف الإنماء", valuationType: "تقييم عقاري", amount: 18000, issueDate: "2025-03-10", dueDate: "2025-04-10", status: "pending" },
  { id: "10", invoiceNumber: "INV-2025-010", clientName: "شركة الأهلي العقارية", valuationType: "تقييم سكني", amount: 12000, issueDate: "2025-03-15", dueDate: "2025-04-15", status: "cancelled" },
  { id: "11", invoiceNumber: "INV-2025-011", clientName: "وزارة الإسكان", valuationType: "تقييم مشاريع إسكان", amount: 95000, issueDate: "2025-03-18", dueDate: "2025-04-18", status: "paid" },
  { id: "12", invoiceNumber: "INV-2025-012", clientName: "شركة دار الأركان", valuationType: "تقييم مجمع سكني", amount: 42000, issueDate: "2025-03-22", dueDate: "2025-04-22", status: "pending" },
];

export const payments: Payment[] = [
  { id: "1", paymentNumber: "PAY-001", invoiceNumber: "INV-2025-001", clientName: "شركة الراجحي للتطوير العقاري", amount: 15000, method: "bank_transfer", date: "2025-01-28" },
  { id: "2", paymentNumber: "PAY-002", invoiceNumber: "INV-2025-002", clientName: "مؤسسة الفهد التجارية", amount: 25000, method: "credit_card", date: "2025-02-08" },
  { id: "3", paymentNumber: "PAY-003", invoiceNumber: "INV-2025-003", clientName: "بنك البلاد", amount: 35000, method: "bank_transfer", date: "2025-02-18" },
  { id: "4", paymentNumber: "PAY-004", invoiceNumber: "INV-2025-004", clientName: "شركة جبل عمر للتطوير", amount: 45000, method: "bank_transfer", date: "2025-02-25" },
  { id: "5", paymentNumber: "PAY-005", invoiceNumber: "INV-2025-011", clientName: "وزارة الإسكان", amount: 95000, method: "cheque", date: "2025-04-10" },
  { id: "6", paymentNumber: "PAY-006", invoiceNumber: "INV-2025-001", clientName: "شركة الراجحي للتطوير العقاري", amount: 8000, method: "cash", date: "2025-03-05" },
];
