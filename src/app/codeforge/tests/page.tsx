import { CodeForgeToolPanel } from "@/components/codeforge/tool-panel";

export const metadata = { title: "Generate Unit Tests" };

export default function CodeForgeTestsPage() {
  return <CodeForgeToolPanel tool="tests" />;
}
