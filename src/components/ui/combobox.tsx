"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Label for the option that clears the selection (e.g. "Aucun membre"). Omit to hide. */
  clearLabel?: string;
  triggerAriaLabel?: string;
  className?: string;
}

/**
 * Searchable single-select combobox — the seller selector needs this for
 * ~70 names (docs/07-DESIGN-SYSTEM.md §36); a plain <select> is unusable
 * at that scale. Built from Popover (Radix) + Command (cmdk), not a
 * shadcn registry component, since neither ships one directly.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
  emptyText = "Aucun résultat.",
  clearLabel,
  triggerAriaLabel,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);
  const listId = React.useId();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-label={triggerAriaLabel}
          className={cn(
            "border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-10 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-3",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        sideOffset={4}
      >
        <CommandPrimitive className="flex flex-col" shouldFilter>
          <CommandPrimitive.Input
            placeholder={searchPlaceholder}
            className="border-border placeholder:text-muted-foreground h-10 w-full border-b bg-transparent px-3 text-sm outline-none"
          />
          <CommandPrimitive.List id={listId} className="max-h-64 overflow-y-auto p-1">
            <CommandPrimitive.Empty className="text-muted-foreground px-3 py-6 text-center text-sm">
              {emptyText}
            </CommandPrimitive.Empty>
            {clearLabel ? (
              <CommandPrimitive.Item
                value={clearLabel}
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="text-muted-foreground data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
              >
                <Check
                  className={cn("size-4", value === null ? "opacity-100" : "opacity-0")}
                  aria-hidden="true"
                />
                {clearLabel}
              </CommandPrimitive.Item>
            ) : null}
            {options.map((option) => (
              <CommandPrimitive.Item
                key={option.value}
                value={option.label}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none"
              >
                <Check
                  className={cn("size-4", option.value === value ? "opacity-100" : "opacity-0")}
                  aria-hidden="true"
                />
                {option.label}
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.List>
        </CommandPrimitive>
      </PopoverContent>
    </Popover>
  );
}
