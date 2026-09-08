import { cn } from "@/lib/utils";

export function NarwhalMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/icon.png" alt="" className={cn("size-8 rounded-[22%]", className)} />
  );
}
