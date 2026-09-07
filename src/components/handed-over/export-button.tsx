"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { exportHandedOverCSV } from "@/lib/actions/export-handed-over";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function ExportButton() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();

  async function handleExport() {
    setLoading(true);
    try {
      const result = await exportHandedOverCSV({
        route: searchParams.get("route") || undefined,
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
      });

      if (result.count === 0) {
        toast.error("No records to export.");
        setLoading(false);
        return;
      }

      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().split("T")[0];
      a.href = url;
      a.download = `handed-over-${result.route}-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${result.count} records.`);
    } catch {
      toast.error("Export failed.");
    }
    setLoading(false);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      Export CSV
    </Button>
  );
}
