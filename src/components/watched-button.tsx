"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WatchedButton({
  played,
  onToggle,
  disabled,
}: {
  played: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      size="lg"
      variant={played ? "default" : "secondary"}
      className={cn("h-12 rounded-full px-6 text-base", played && "bg-zinc-900 dark:bg-zinc-100")}
      disabled={disabled}
      onClick={onToggle}
    >
      <Check data-icon="inline-start" />
      {played ? "Watched" : "Mark watched"}
    </Button>
  );
}
