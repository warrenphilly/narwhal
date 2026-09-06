"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { homeHref, lastTab } from "@/lib/media-tab";
import { cn } from "@/lib/utils";

export function BackButton({ className }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/") return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(homeHref(lastTab()));
  }

  return (
    <Button variant="ghost" className={className} onClick={goBack} aria-label="Back">
      <ArrowLeft data-icon="inline-start" />
      Back
    </Button>
  );
}

export function PageBack({ className }: { className?: string }) {
  return <BackButton className={cn("-ml-2 mb-3 self-start", className)} />;
}
