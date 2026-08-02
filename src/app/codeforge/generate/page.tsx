import { CodeForgeToolPanel } from "@/components/codeforge/tool-panel";

export const metadata = { title: "Generate Code" };

export default function CodeForgeGeneratePage() {
  return <CodeForgeToolPanel tool="generate" />;
}
