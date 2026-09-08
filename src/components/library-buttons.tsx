"use client";

import { Heart, ListPlus } from "lucide-react";
import { useProfiles } from "@/components/profile-provider";
import { Button } from "@/components/ui/button";

export function LibraryButtons({ itemId, disabled }: { itemId: string; disabled?: boolean }) {
  const { isFavorite, isWatchlisted, toggleFavorite, toggleWatchlist } = useProfiles();
  const liked = isFavorite(itemId);
  const listed = isWatchlisted(itemId);
  return (
    <>
      <Button
        size="lg"
        variant={listed ? "default" : "secondary"}
        className="h-11 rounded-full px-6 text-base"
        disabled={disabled}
        onClick={() => toggleWatchlist(itemId)}
      >
        <ListPlus data-icon="inline-start" />
        {listed ? "On my list" : "My list"}
      </Button>
      <Button
        size="lg"
        variant={liked ? "default" : "secondary"}
        className="h-11 rounded-full px-6 text-base"
        disabled={disabled}
        onClick={() => toggleFavorite(itemId)}
      >
        <Heart data-icon="inline-start" className={liked ? "fill-current" : ""} />
        {liked ? "Favorited" : "Favorite"}
      </Button>
    </>
  );
}
