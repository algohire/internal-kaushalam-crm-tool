"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CompanyHeader } from "@/components/company/company-header";
import { EdbDetails } from "@/components/company/edb-details";
import { ContactsTable } from "@/components/company/contacts-table";
import { RequirementsList } from "@/components/company/requirements-list";
import { VersionHistory } from "@/components/company/version-history";
import { Timeline } from "@/components/company/timeline";

type CompanyRow = {
  companyCode: string;
  companyName: string;
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  udyamNumber: string | null;
  sector: string | null;
  sectors: string | null;
  subsectors: string | null;
  lineOfActivity: string | null;
  plantLocation: string | null;
  district: string | null;
  mandal: string | null;
  village: string | null;
  stage: string | null;
  projectName: string | null;
  presentHeadcount: number | null;
  totalRequired: number | null;
  companyRank: number | null;
  tier: number | null;
  flags: string | null;
  tags: string | null;
  lastDisposition: string | null;
  lastContactAt: string | null;
  contactCount: number;
};

type TaskRow = {
  id: string;
  title: string;
  dueDate: string;
};

type Props = {
  company: CompanyRow;
  contacts: Array<{
    id: string;
    name: string | null;
    designation: string | null;
    mobile: string | null;
    mobileRaw: string | null;
    email: string | null;
    pocFor: string | null;
    source: string;
    isPrimary: boolean;
    valid: boolean;
  }>;
  requirements: Array<{
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
  }>;
  versions: Array<{
    id: string;
    requirementId: string;
    version: number;
    changedAt: string;
    changedBy: string;
    diffJson: string;
    snapshotJson: string;
  }>;
  interactions: Array<{
    id: string;
    username: string;
    team: string;
    channel: string;
    disposition: string;
    comment: string;
    nextStep: string;
    nextActionDate: string;
    fieldsChangedJson: string | null;
    source: string;
    createdAt: string;
  }>;
  openTasks: TaskRow[];
  latestOpenTask: TaskRow | null;
  requirementNames: Record<string, string>;
  currentTags: string[];
  timelineTotal: number;
  timelinePage: number;
  timelinePageSize: number;
  qualificationMap?: Record<string, string>;
};

export function CompanyPageClient({
  company: comp,
  contacts,
  requirements,
  versions,
  interactions,
  openTasks,
  latestOpenTask,
  requirementNames,
  currentTags,
  timelineTotal,
  timelinePage,
  timelinePageSize,
  qualificationMap,
}: Props) {
  const [contactDialogOpen, setContactDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <CompanyHeader
        companyCode={comp.companyCode}
        companyName={comp.companyName}
        tier={comp.tier}
        rank={comp.companyRank}
        lastDisposition={comp.lastDisposition}
        lastContactAt={comp.lastContactAt}
        nextStep={latestOpenTask?.title ?? null}
        nextStepDate={latestOpenTask?.dueDate ?? null}
        currentTags={currentTags}
        onAddContact={() => setContactDialogOpen(true)}
      />

      {openTasks.length > 0 && (
        <div className="border-l-3 border-l-[#D9601F] bg-[#FFF7F1] p-3 rounded-r-md text-sm">
          <b>Open tasks:</b>{" "}
          {openTasks.map((t, i) => (
            <span key={t.id}>
              {i > 0 && " · "}
              {t.title}{" "}
              <span className="text-muted-foreground">due {t.dueDate}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-6">
        <div className="flex-[2] space-y-4 min-w-0">
          <EdbDetails
            legalName={comp.legalName}
            gstin={comp.gstin}
            pan={comp.pan}
            udyamNumber={comp.udyamNumber}
            sector={comp.sector}
            subsectors={comp.subsectors}
            lineOfActivity={comp.lineOfActivity}
            plantLocation={comp.plantLocation}
            district={comp.district}
            mandal={comp.mandal}
            village={comp.village}
            stage={comp.stage}
            presentHeadcount={comp.presentHeadcount}
            projectName={comp.projectName}
            flags={comp.flags}
          />

          <ContactsTable
            contacts={contacts}
            companyCode={comp.companyCode}
            dialogOpen={contactDialogOpen}
            onDialogChange={setContactDialogOpen}
          />

          <RequirementsList requirements={requirements} qualificationMap={qualificationMap} />

          <VersionHistory versions={versions} requirementNames={requirementNames} />
        </div>

        <div className="flex-[1] min-w-0">
          <Timeline
            interactions={interactions}
            total={timelineTotal}
            page={timelinePage}
            pageSize={timelinePageSize}
            companyCode={comp.companyCode}
          />
        </div>
      </div>
    </div>
  );
}
