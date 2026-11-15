import { getModuleClips } from "@/lib/content/static";
import { CatalogView } from "./view";

export const metadata = { title: "Cours" };

export default function CatalogPage() {
  return <CatalogView clips={getModuleClips()} />;
}
