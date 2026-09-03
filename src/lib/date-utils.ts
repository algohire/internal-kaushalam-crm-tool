export function formatIST(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

export function formatDateIST(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  });
}

export function utcNow(): string {
  return new Date().toISOString();
}

export function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function daysBetween(dateStr: string, refDate?: string): number {
  const d1 = new Date(dateStr);
  const d2 = refDate ? new Date(refDate) : new Date();
  const diff = d2.getTime() - d1.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
