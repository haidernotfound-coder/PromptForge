import { CollectionGallery } from "@/components/prompts/collection-gallery";

export const metadata = { title: "Collections" };

export default function CollectionsPage() {
  return (
    <div className="space-y-1">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Collections</h1>
        <p className="mt-1 text-sm text-text-muted">
          Group related prompts together and share the whole set with a single public link.
        </p>
      </div>
      <CollectionGallery />
    </div>
  );
}
