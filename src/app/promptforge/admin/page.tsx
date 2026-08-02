import { redirect } from "next/navigation";

export const metadata = { title: "Admin Dashboard" };

export default function AdminPage() {
  redirect("/admin");
}
