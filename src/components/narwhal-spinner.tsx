import { cn } from "@/lib/utils";

export function NarwhalSpinner({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative size-12">
        <div className="narwhal-orbit absolute inset-0 rounded-full border-2 border-[#00A4DC]/15 border-t-[#00A4DC] border-r-[#AA5CC3]" />
        <div className="narwhal-orbit-slow absolute inset-1.5 rounded-full border border-dashed border-[#AA5CC3]/40" />
      </div>
      {label && <p className="text-sm font-medium tracking-wide text-zinc-500">{label}</p>}
    </div>
  );
}

export function PageSpinner({ label = "Just a splash…" }: { label?: string }) {
  return (
    <div className="tv-root flex min-h-full items-center justify-center">
      <NarwhalSpinner label={label} />
    </div>
  );
}
