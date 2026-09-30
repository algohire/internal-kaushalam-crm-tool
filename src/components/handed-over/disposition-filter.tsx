"use client";

import { useState } from "react";
import { MultiSelect, type MultiSelectOption } from "@/components/universe/multi-select";

/**
 * Disposition multi-select for the Handed Over page. That filter bar is a plain
 * GET <form>, so the selection rides along in a hidden input and is applied when
 * the existing Filter button submits.
 */
export function DispositionFilter({
  options,
  defaultValue,
}: {
  options: MultiSelectOption[];
  defaultValue: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);

  return (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">Last call</label>
      <input type="hidden" name="disposition" value={selected.join(",")} />
      <MultiSelect
        label="Last call"
        options={options}
        selected={selected}
        onChange={setSelected}
        placeholder="Search disposition..."
      />
    </div>
  );
}
