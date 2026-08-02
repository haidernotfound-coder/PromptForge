"use client";

import * as React from "react";
import { toast } from "sonner";
import { BookOpen, Search, Star, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/prompts/confirm-dialog";
import { RECIPE_CATEGORIES, RECIPES, recipesByCategory, searchRecipes, type Recipe } from "@/lib/recipes";
import { useRecipeFavorites } from "@/lib/recipe-favorites";
import { trackEvent } from "@/lib/track";
import { cn } from "@/lib/utils";

/**
 * Phase 10 — Recipe Forge
 * -----------------------
 * Sits next to the editor toolbar. Opens a searchable, category-filterable
 * browser of built-in prompt recipes; picking one inserts its `body` into
 * the prompt currently open in the editor via `onInsert`, reusing the same
 * apply pattern `AiPanel` uses for AI actions (the caller is responsible
 * for updating state + snapshotting a version).
 */
export function RecipeForge({
  onInsert,
  hasExistingContent,
}: {
  onInsert: (body: string) => void;
  hasExistingContent: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<(typeof RECIPE_CATEGORIES)[number]>("All");
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [pendingRecipe, setPendingRecipe] = React.useState<Recipe | null>(null);

  const { favoriteIds, isFavorite, toggleFavorite } = useRecipeFavorites();

  const filtered = React.useMemo(() => {
    const byCategory = recipesByCategory(category);
    const byFavorite = favoritesOnly ? byCategory.filter((r) => favoriteIds.has(r.id)) : byCategory;
    return searchRecipes(byFavorite, query);
  }, [category, favoritesOnly, favoriteIds, query]);

  function pickRecipe(recipe: Recipe) {
    if (hasExistingContent) {
      // Don't silently blow away work already in the editor.
      setPendingRecipe(recipe);
      return;
    }
    applyRecipe(recipe);
  }

  function applyRecipe(recipe: Recipe) {
    onInsert(recipe.body);
    trackEvent("recipe.used", { recipeId: recipe.id, title: recipe.title, category: recipe.category });
    toast.success(`Inserted "${recipe.title}"`);
    setOpen(false);
    setPendingRecipe(null);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <BookOpen className="h-3.5 w-3.5" />
        Recipe Forge
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-accent" /> Recipe Forge
            </DialogTitle>
            <DialogDescription>
              Professionally structured prompt recipes, ready for your own {"{{variables}}"}. Pick one to drop into the editor.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes…"
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setFavoritesOnly((v) => !v)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  favoritesOnly
                    ? "border-brass bg-brass-soft text-brass"
                    : "border-border text-text-muted hover:bg-surface"
                )}
                aria-pressed={favoritesOnly}
              >
                <Star className={cn("h-3 w-3", favoritesOnly && "fill-brass")} />
                Favorites
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {RECIPE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  category === c
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border text-text-muted hover:bg-surface"
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-16 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-text-faint" />
              <p className="mt-3 text-sm text-text-muted">
                {favoritesOnly ? "No favorited recipes match this filter." : "No recipes match your search."}
              </p>
            </div>
          ) : (
            <div className="max-h-[26rem] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filtered.map((r) => (
                  <Card key={r.id} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{r.category}</Badge>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(r.id)}
                          aria-label={isFavorite(r.id) ? "Remove from favorites" : "Add to favorites"}
                          aria-pressed={isFavorite(r.id)}
                          className="text-text-faint transition-colors hover:text-brass"
                        >
                          <Star className={cn("h-4 w-4", isFavorite(r.id) && "fill-brass text-brass")} />
                        </button>
                      </div>
                      <CardTitle className="text-base">{r.title}</CardTitle>
                      <CardDescription>{r.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <pre className="line-clamp-3 whitespace-pre-wrap rounded-md bg-surface p-2.5 font-mono text-xs text-text-muted">
                        {r.body}
                      </pre>
                    </CardContent>
                    <CardFooter>
                      <Button size="sm" className="w-full gap-1.5" onClick={() => pickRecipe(r)}>
                        Use recipe
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-text-faint">
            {RECIPES.length} recipes across {RECIPE_CATEGORIES.length - 1} categories
          </p>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingRecipe !== null}
        onOpenChange={(next) => {
          if (!next) setPendingRecipe(null);
        }}
        title={`Replace current prompt body?`}
        description={`"${pendingRecipe?.title ?? ""}" will replace what's currently in the editor body. This can't be undone unless you've already saved a previous version.`}
        confirmLabel="Insert recipe"
        destructive={false}
        onConfirm={() => {
          if (pendingRecipe) applyRecipe(pendingRecipe);
        }}
      />
    </>
  );
}
