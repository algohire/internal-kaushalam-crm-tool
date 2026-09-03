import { Card, CardContent } from "@/components/ui/card";

type KpiItem = {
  label: string;
  value: string | number;
  sub?: string;
};

export function KpiCards({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold tabular-nums leading-tight">
              {item.value}
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
