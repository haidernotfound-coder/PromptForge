import { TemplateGallery } from "@/components/prompts/template-gallery";

export const metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <div className="space-y-1">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Templates</h1>
        <p className="mt-1 text-sm text-text-muted">
          Start from a ready-made prompt instead of a blank page. Using a template creates an
          editable copy in your workspace.
        </p>
      </div>
      <TemplateGallery />
    </div>
  );
}
