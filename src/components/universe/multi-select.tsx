"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

/**
 * Checkbox-style multi-select. Same trigger shape as SearchableSelect so the two
 * sit together in a filter bar, but toggles values instead of replacing them and
 * keeps the popover open while you tick.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const displayValue =
    selected.length === 0
      ? `${label}: all`
      : selected.length === 1
        ? `${label}: ${options.find((o) => o.value === selected[0])?.label ?? selected[0]}`
        : `${label}: ${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 min-w-[140px] justify-between text-sm font-normal",
            selected.length > 0 && "text-foreground"
          )}
        >
          <span className="truncate max-w-[180px]">{displayValue}</span>
          <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder || `Search ${label.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {selected.length > 0 && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onChange([]);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  <span className="mr-2 h-4 w-4" />
                  Clear selection
                </CommandItem>
              )}
              {options.map((opt) => {
                const isOn = selected.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => toggle(opt.value)}
                  >
                    <span
                      className={cn(
                        "mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-input",
                        isOn && "border-primary bg-primary text-primary-foreground"
                      )}
                    >
                      <Check className={cn("h-3 w-3", !isOn && "opacity-0")} />
                    </span>
                    <span className="flex-1 truncate">{opt.label}</span>
                    {opt.count !== undefined && (
                      <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                        {opt.count.toLocaleString()}
                      </span>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
