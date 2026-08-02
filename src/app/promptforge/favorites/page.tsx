import { Suspense } from "react";
import { PromptsBrowser } from "@/components/prompts/prompts-browser";

export const metadata = { title: "Favorites" };

export default function FavoritesPage() {
  return (
    <Suspense fallback={null}>
      <PromptsBrowser
        favoritesOnly
        title="Favorites"
        description="Prompts you've starred for quick access."
      />
    </Suspense>
  );
}
