let lastSequence = 5; // Start after mock data

export function generateReportNumber(year?: number): string {
  const y = year ?? new Date().getFullYear();
  lastSequence += 1;
  return `RPT-${y}-${String(lastSequence).padStart(5, "0")}`;
}

export function resetSequence(value: number) {
  lastSequence = value;
}
