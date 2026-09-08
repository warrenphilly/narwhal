"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Carousel({
  children,
  className,
  itemGap = "gap-4",
  alignStart = false,
}: {
  children: React.ReactNode;
  className?: string;
  itemGap?: string;
  alignStart?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  function update() {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 12);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 12);
  }

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [children]);

  function move(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.75), behavior: "smooth" });
  }

  return (
    <div className={cn("relative", className)}>
      {(canPrev || canNext) && (
        <div className="pointer-events-none absolute inset-y-0 z-10 flex w-full items-center justify-between">
          <button
            type="button"
            aria-label="Previous"
            disabled={!canPrev}
            onClick={() => move(-1)}
            className="pointer-events-auto ml-1 flex size-9 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md ring-1 ring-black/8 disabled:pointer-events-none disabled:opacity-0 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-white/10"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={!canNext}
            onClick={() => move(1)}
            className="pointer-events-auto mr-1 flex size-9 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-md ring-1 ring-black/8 disabled:pointer-events-none disabled:opacity-0 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-white/10"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
      <div
        ref={scroller}
        className={cn(
          "shelf-scroll flex overflow-x-auto pb-2 pt-1",
          !alignStart && (canPrev || canNext) && "px-1 sm:px-2",
          itemGap
        )}
      >
        {children}
      </div>
    </div>
  );
}
