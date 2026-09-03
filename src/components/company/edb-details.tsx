import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  udyamNumber: string | null;
  sector: string | null;
  subsectors: string | null;
  lineOfActivity: string | null;
  plantLocation: string | null;
  district: string | null;
  mandal: string | null;
  village: string | null;
  stage: string | null;
  presentHeadcount: number | null;
  projectName: string | null;
  flags: string | null;
};

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

export function EdbDetails(props: Props) {
  const flagList = props.flags?.split(";").filter(Boolean) ?? [];

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Company</CardTitle>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
            From EDB · read-only
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-x-6 gap-y-3">
          <Field label="Legal name" value={props.legalName} />
          <Field label="GSTIN" value={props.gstin} />
          <Field label="PAN" value={props.pan} />
          <Field label="Udyam number" value={props.udyamNumber} />
          <Field label="Sector" value={props.sector} />
          <Field label="Sub-sectors" value={props.subsectors} />
          <Field label="Line of activity" value={props.lineOfActivity} />
          <Field label="Plant location" value={props.plantLocation} />
          <Field
            label="District · Mandal · Village"
            value={[props.district, props.mandal, props.village].filter(Boolean).join(" · ")}
          />
          <Field label="Stage" value={props.stage} />
          <Field label="Present headcount" value={props.presentHeadcount} />
          <Field label="Project name" value={props.projectName} />
        </div>
        {flagList.length > 0 && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {flagList.map((flag) => (
              <Badge
                key={flag}
                variant="outline"
                className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
              >
                {flag.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
