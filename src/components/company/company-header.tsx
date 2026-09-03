"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Phone, Plus, Tag } from "lucide-react";
import { tags as fixedTags } from "@/lib/config/dropdowns";
import { updateCompanyTags } from "@/lib/actions/company";

type Props = {
  companyCode: string;
  companyName: string;
  tier: number | null;
  rank: number | null;
  lastDisposition: string | null;
  lastContactAt: string | null;
  nextStep: string | null;
  nextStepDate: string | null;
  currentTags: string[];
  onAddContact: () => void;
};

function dispositionLabel(code: string): string {
  const map: Record<string, string> = {
    no_answer: "No answer",
    wrong_contact: "Wrong contact",
    hiring_now: "Hiring now",
    hiring_later: "Hiring later",
    no_requirement: "No requirement",
    not_operational: "Not operational",
    do_not_call: "Do not call",
    duplicate: "Duplicate",
  };
  return map[code] || code;
}

function dispositionColor(code: string): string {
  if (code === "hiring_now") return "bg-green-50 text-green-700 border-green-200";
  if (code === "hiring_later") return "bg-amber-50 text-amber-700 border-amber-200";
  if (code === "no_answer" || code === "wrong_contact") return "bg-red-50 text-red-700 border-red-200";
  if (code === "no_requirement" || code === "not_operational" || code === "do_not_call")
    return "bg-gray-100 text-gray-600";
  return "bg-gray-100 text-gray-600";
}

export function CompanyHeader({
  companyCode,
  companyName,
  tier,
  rank,
  lastDisposition,
  lastContactAt,
  nextStep,
  nextStepDate,
  currentTags,
  onAddContact,
}: Props) {
  const [selectedTags, setSelectedTags] = useState<string[]>(currentTags);
  const [isPending, startTransition] = useTransition();

  function handleTagToggle(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(next);
    startTransition(() => {
      updateCompanyTags(companyCode, next);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>{companyCode}</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
              EDB record
            </Badge>
          </div>
          <h1 className="text-2xl font-semibold">{companyName}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {tier && (
              <Badge variant="outline" className="bg-[#FBEFE3] text-[#620124] border-[#E7CDB9]">
                Tier {tier}
              </Badge>
            )}
            {rank && (
              <Badge variant="outline" className="text-muted-foreground">
                Rank #{rank}
              </Badge>
            )}
            {lastDisposition && (
              <Badge variant="outline" className={dispositionColor(lastDisposition)}>
                {dispositionLabel(lastDisposition)}
              </Badge>
            )}
            {lastContactAt && (
              <span className="text-sm text-muted-foreground">
                Last contact{" "}
                {new Date(lastContactAt).toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata",
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {nextStep && (
              <span className="text-sm text-muted-foreground">
                Next: <span className="font-medium text-foreground">{nextStep}</span>
                {nextStepDate && ` · ${nextStepDate}`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onAddContact}>
            <Plus className="w-4 h-4 mr-1" />
            Add Contact
          </Button>
          <Link href={`/company/${companyCode}/call`}>
            <Button size="sm" className="bg-[#620124] hover:bg-[#7B1A36]">
              <Phone className="w-4 h-4 mr-1" />
              Log a Call
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {selectedTags.map((tag) => (
          <Badge key={tag} variant="outline" className="bg-gray-50 text-gray-700 text-xs">
            {tag}
          </Badge>
        ))}
        <Popover>
          <PopoverTrigger>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={isPending}>
              <Tag className="w-3 h-3 mr-1" />
              Tags
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3">
            <div className="space-y-2">
              {fixedTags.map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedTags.includes(tag)}
                    onCheckedChange={() => handleTagToggle(tag)}
                  />
                  {tag}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
