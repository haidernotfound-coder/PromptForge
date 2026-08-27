import { redirect } from "next/navigation";

/**
 * The standalone CodeForge AI Coding Chat panel has been retired in favor
 * of the unified AI Chat (`/chat`), which now automatically detects
 * coding questions and delegates to this exact same CodeForge chat
 * endpoint/key pool (see `src/lib/server/chat-intent.ts` and
 * `src/app/api/chat/route.ts`). This route is kept only so old
 * bookmarks/links land somewhere useful instead of 404ing.
 */
export default function CodeForgeChatPage() {
  redirect("/chat");
}
