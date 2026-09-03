import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Requirement = {
  id: string;
  roleName: string;
  roleNameEdited: string | null;
  standardRole: string | null;
  requiredCount: number | null;
  requiredCountValidated: number | null;
  requiredWithinMonths: number | null;
  skills: string | null;
  currentEmployment: number | null;
  qualification: string | null;
  experienceFrom: number | null;
  experienceTo: number | null;
  genderPreference: string | null;
  ageLimit: string | null;
  salary: string | null;
  pwd: boolean | null;
  timing: string | null;
  timingDate: string | null;
  needTraining: boolean;
  qpCode: string | null;
  classification: string | null;
  collectorDistrict: string | null;
  status: string;
  handoffComment: string | null;
  comment: string | null;
  flags: string | null;
  version: number;
};

function classificationColor(cls: string | null): string {
  if (cls === "kaushalam") return "border-l-green-500";
  if (cls === "collector" || cls === "apssdc") return "border-l-gray-400";
  return "border-l-gray-200";
}

function classificationBadge(cls: string | null) {
  if (!cls) return <Badge variant="outline" className="bg-gray-100 text-gray-600 text-xs">Not classified</Badge>;
  if (cls === "kaushalam")
    return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">Direct hiring — Kaushalam</Badge>;
  if (cls === "apssdc")
    return <Badge variant="outline" className="bg-gray-100 text-gray-600 text-xs">Needs training — APSSDC</Badge>;
  if (cls === "collector")
    return <Badge variant="outline" className="bg-gray-100 text-gray-600 text-xs">Collector handoff</Badge>;
  return null;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    captured: "bg-gray-100 text-gray-600",
    validated: "bg-green-50 text-green-700 border-green-200",
    handed_over_scheduling: "bg-green-50 text-green-700 border-green-200",
    handed_over_collector: "bg-gray-100 text-gray-600",
    handed_over_apssdc: "bg-gray-100 text-gray-600",
    no_requirement: "bg-red-50 text-red-700 border-red-200",
    not_operational: "bg-red-50 text-red-700 border-red-200",
    do_not_call: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <Badge variant="outline" className={`${colors[status] || "bg-gray-100 text-gray-600"} text-xs`}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export function RequirementsList({ requirements, qualificationMap }: { requirements: Requirement[]; qualificationMap?: Record<string, string> }) {
  const totalOpenings = requirements.reduce((sum, r) => sum + (r.requiredCountValidated ?? r.requiredCount ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Requirements</CardTitle>
          <span className="text-xs text-muted-foreground">
            {requirements.length} role{requirements.length !== 1 ? "s" : ""} · {totalOpenings} openings
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {requirements.map((req) => {
          const flagList = req.flags?.split(";").filter(Boolean) ?? [];
          return (
            <div
              key={req.id}
              className={`border rounded-md p-4 border-l-4 ${classificationColor(req.classification)}`}
            >
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h3 className="text-sm font-semibold">{req.roleNameEdited || req.roleName}</h3>
                {classificationBadge(req.classification)}
                {statusBadge(req.status)}
                <span className="text-xs text-muted-foreground ml-auto">v{req.version}</span>
              </div>

              <div className="grid grid-cols-4 gap-x-4 gap-y-2">
                <Field label="Openings (EDB)" value={req.requiredCount} />
                <Field label="Validated count" value={req.requiredCountValidated} />
                <Field label="Within months" value={req.requiredWithinMonths} />
                <Field label="Current employment" value={req.currentEmployment} />
                <Field label="Qualification" value={
                  req.qualification && qualificationMap
                    ? req.qualification.split(";").map((id) => qualificationMap[id] || id).join(", ")
                    : req.qualification
                } />
                <Field label="Gender" value={req.genderPreference} />
                <Field label="Age limit" value={req.ageLimit} />
                <Field label="Salary" value={req.salary} />
                <Field label="Experience" value={req.experienceFrom != null && req.experienceTo != null ? `${req.experienceFrom}–${req.experienceTo} yrs` : null} />
                <Field label="PWD" value={req.pwd ? "Yes" : "No"} />
                <Field label="Timing" value={req.timing} />
                {req.timing === "later" && <Field label="Timing date" value={req.timingDate} />}
                <Field label="Standard role" value={req.standardRole} />
                <Field label="Skills (EDB)" value={req.skills} />
                {req.needTraining && <Field label="QP code" value={req.qpCode} />}
                {req.classification === "collector" && (
                  <Field label="Collector district" value={req.collectorDistrict} />
                )}
              </div>

              {req.comment && (
                <div className="mt-2 text-sm text-muted-foreground">
                  Comment: {req.comment}
                </div>
              )}
              {req.handoffComment && (
                <div className="mt-1 text-sm text-muted-foreground">
                  Handoff: {req.handoffComment}
                </div>
              )}

              {flagList.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
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
            </div>
          );
        })}

        {requirements.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No requirements</p>
        )}
      </CardContent>
    </Card>
  );
}
