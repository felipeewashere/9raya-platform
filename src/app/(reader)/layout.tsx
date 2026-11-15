import { requireProfile } from "@/lib/auth";

export default async function ReaderLayout({ children }: LayoutProps<"/">) {
  await requireProfile();
  return <>{children}</>;
}
