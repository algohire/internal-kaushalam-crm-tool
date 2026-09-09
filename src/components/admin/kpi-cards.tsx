import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiItem = {
  label: string;
  value: string | number;
  sub?: string;
  variant?: "default" | "warn" | "bad";
};

export function KpiCards({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-9 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className={cn(
              "text-2xl font-semibold tabular-nums leading-tight",
              item.variant === "warn" && "text-amber-600",
              item.variant === "bad" && "text-red-600",
            )}>
              {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
            {item.sub && (
              <div className="text-xs text-muted-foreground mt-1.5">{item.sub}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
