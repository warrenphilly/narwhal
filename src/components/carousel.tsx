"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Carousel({
  children,
  className,
  itemGap = "gap-5",
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
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(max > 8 && el.scrollLeft < max - 8);
  }

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    update();
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
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  }

  return (
    <div className={cn("relative", className)}>
      {(canPrev || canNext) && (
        <div className="pointer-events-none absolute inset-y-0 z-10 flex w-full items-center justify-between px-0.5">
          <button
            type="button"
            aria-label="Previous"
            disabled={!canPrev}
            onClick={() => move(-1)}
            className="glass-chip pointer-events-auto flex size-9 items-center justify-center rounded-full text-zinc-900 disabled:pointer-events-none disabled:opacity-0 sm:size-10 dark:text-zinc-50"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={!canNext}
            onClick={() => move(1)}
            className="glass-chip pointer-events-auto flex size-9 items-center justify-center rounded-full text-zinc-900 disabled:pointer-events-none disabled:opacity-0 sm:size-10 dark:text-zinc-50"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
      <div
        ref={scroller}
        className={cn(
          "shelf-scroll flex snap-x snap-mandatory touch-pan-x overflow-x-auto overflow-y-visible py-5 pt-6",
          "[-webkit-overflow-scrolling:touch] overscroll-x-contain",
          itemGap
        )}
      >
        {children}
      </div>
    </div>
  );
}
