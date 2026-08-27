import { redirect } from "next/navigation";

/**
 * The standalone StudyForge AI Study Chat panel has been retired in favor
 * of the unified AI Chat (`/chat`), which now automatically detects
 * study/quiz questions and delegates to this exact same StudyForge chat
 * endpoint/key pool (see `src/lib/server/chat-intent.ts` and
 * `src/app/api/chat/route.ts`). This route is kept only so old
 * bookmarks/links land somewhere useful instead of 404ing.
 */
export default function StudyForgeChatPage() {
  redirect("/chat");
}
