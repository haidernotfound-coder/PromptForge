// All of /chat's UI is mounted by its layout.tsx (`<ChatApp />`) so it can
// own the full-height app shell (sidebar, header, account footer) instead
// of being nested inside a page rendered by that layout. This file only
// exists because Next.js requires every route segment to have one.
export default function ChatPage() {
  return null;
}
