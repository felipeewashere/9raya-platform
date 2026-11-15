import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/shell";
import { displayName, requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Administration", template: "%s · Admin 9raya" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // server-side role check from the database (never from the client)
  const profile = await requireAdmin();
  return <AdminShell user={{ name: profile.full_name || displayName(profile), avatar: profile.avatar_url }}>{children}</AdminShell>;
}
