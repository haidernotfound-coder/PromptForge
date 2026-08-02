import { CodeForgeToolPanel } from "@/components/codeforge/tool-panel";

export const metadata = { title: "Generate Documentation" };

export default function CodeForgeDocsPage() {
  return <CodeForgeToolPanel tool="docs" />;
}
