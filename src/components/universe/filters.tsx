"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "./searchable-select";
import { X, Search } from "lucide-react";

export interface FilterOptions {
  districts: string[];
  sectors: string[];
  subsectors: string[];
  mandals: string[];
  stages: string[];
  tags: string[];
  statuses: string[];
  classifications: string[];
  tiers: number[];
}

interface FiltersProps {
  options: FilterOptions;
}

export function UniverseFilters({ options }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`/universe?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const current = searchParams.get("q") ?? "";
      if (searchValue !== current) {
        updateParam("q", searchValue);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue, searchParams, updateParam]);

  const clearFilters = useCallback(() => {
    setSearchValue("");
    router.push("/universe");
  }, [router]);

  const hasFilters = searchParams.toString().length > 0;

  const activeCount = [
    "q", "district", "sector", "subsector", "mandal", "stage",
    "tier", "classification", "status", "tags", "worked",
  ].filter((k) => searchParams.get(k)).length;

  return (
    <div className="space-y-2 mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search company, EDB code, or mobile..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-72 pl-8 h-9"
          />
        </div>

        <SearchableSelect
          label="District"
          options={options.districts}
          value={searchParams.get("district") ?? ""}
          onChange={(v) => updateParam("district", v)}
        />

        <SearchableSelect
          label="Sector"
          options={options.sectors}
          value={searchParams.get("sector") ?? ""}
          onChange={(v) => updateParam("sector", v)}
        />

        <SearchableSelect
          label="Sub-sector"
          options={options.subsectors}
          value={searchParams.get("subsector") ?? ""}
          onChange={(v) => updateParam("subsector", v)}
        />

        <SearchableSelect
          label="Tier"
          options={options.tiers.map(String)}
          value={searchParams.get("tier") ?? ""}
          onChange={(v) => updateParam("tier", v)}
        />

        <SearchableSelect
          label="Classification"
          options={["Not classified", ...options.classifications]}
          value={searchParams.get("classification") ?? ""}
          onChange={(v) => updateParam("classification", v)}
        />

        <SearchableSelect
          label="Status"
          options={options.statuses}
          value={searchParams.get("status") ?? ""}
          onChange={(v) => updateParam("status", v)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchableSelect
          label="Mandal"
          options={options.mandals}
          value={searchParams.get("mandal") ?? ""}
          onChange={(v) => updateParam("mandal", v)}
        />

        <SearchableSelect
          label="Stage"
          options={options.stages}
          value={searchParams.get("stage") ?? ""}
          onChange={(v) => updateParam("stage", v)}
        />

        <SearchableSelect
          label="Tags"
          options={options.tags}
          value={searchParams.get("tags") ?? ""}
          onChange={(v) => updateParam("tags", v)}
        />

        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={searchParams.get("worked") ?? ""}
          onChange={(e) => updateParam("worked", e.target.value)}
        >
          <option value="">Previously worked on: any</option>
          <option value="never">Never contacted</option>
          <option value="60d">No contact in 60 days</option>
          <option value="month">Contacted this month</option>
        </select>

        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters} className="h-9 gap-1.5">
            <X className="h-3.5 w-3.5" />
            Clear {activeCount > 0 && `(${activeCount})`}
          </Button>
        )}
      </div>
    </div>
  );
}
