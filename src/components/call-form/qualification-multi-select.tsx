"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type QualificationOption = {
  id: string;
  name: string;
};

type Props = {
  options: QualificationOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  required?: boolean;
  hasError?: boolean;
};

export function QualificationMultiSelect({
  options,
  selected,
  onChange,
  required,
  hasError,
}: Props) {
  const [open, setOpen] = useState(false);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function remove(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  const selectedNames = selected
    .map((id) => options.find((o) => o.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <Button
            variant="outline"
            size="sm"
            type="button"
            className={cn(
              "w-full justify-between text-sm font-normal h-auto min-h-[36px] py-1.5 px-2.5",
              hasError && selected.length === 0 && "border-red-400 bg-red-50/50 ring-1 ring-red-200"
            )}
          >
            {selected.length === 0 ? (
              <span className="text-muted-foreground">
                Select qualification{required ? " *" : ""}…
              </span>
            ) : (
              <span className="text-sm">
                {selected.length} selected
              </span>
            )}
            <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search qualification..." />
            <CommandList>
              <CommandEmpty>No qualification found.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.name}
                    onSelect={() => toggle(opt.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selected.includes(opt.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-xs text-muted-foreground mr-1.5">{opt.id}</span>
                    {opt.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((id) => {
            const opt = options.find((o) => o.id === id);
            if (!opt) return null;
            return (
              <Badge
                key={id}
                variant="secondary"
                className="text-xs gap-1 pr-1"
              >
                {opt.name}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
