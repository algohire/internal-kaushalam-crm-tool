import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CallerRow = {
  name: string;
  dials: number;
  connects: number;
  connectPct: string;
  reqsValidated: number;
  openingsValidated: number;
  handoffsS: number;
  handoffsC: number;
  handoffsA: number;
  overdueTasks: number;
};

export function CallerTable({ rows }: { rows: CallerRow[] }) {
  return (
    <div className="border rounded-lg bg-card">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">Per-Caller Performance</h2>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Caller</TableHead>
            <TableHead className="text-right">Dials</TableHead>
            <TableHead className="text-right">Connects</TableHead>
            <TableHead className="text-right">Connect %</TableHead>
            <TableHead className="text-right">Reqs Validated</TableHead>
            <TableHead className="text-right">Openings</TableHead>
            <TableHead className="text-right">Handoffs S/C/A</TableHead>
            <TableHead className="text-right">Overdue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                No caller activity in this period.
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.name}>
              <TableCell className="font-medium text-sm">{r.name}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{r.dials}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{r.connects}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{r.connectPct}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{r.reqsValidated}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">{r.openingsValidated}</TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {r.handoffsS} / {r.handoffsC} / {r.handoffsA}
              </TableCell>
              <TableCell className="text-right tabular-nums text-sm">
                {r.overdueTasks > 0 ? (
                  <span className="text-destructive font-medium">{r.overdueTasks}</span>
                ) : (
                  r.overdueTasks
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
