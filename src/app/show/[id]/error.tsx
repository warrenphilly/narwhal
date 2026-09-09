"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ShowError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Couldn’t open this show</p>
      <p className="max-w-md text-sm text-zinc-500">
        Something broke while loading the page. Try again, or go back to your library.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/shows"
          className="inline-flex h-9 items-center justify-center rounded-md border border-white/15 bg-white/10 px-4 text-sm text-zinc-900 dark:text-zinc-50"
        >
          Back to shows
        </Link>
      </div>
    </div>
  );
}
