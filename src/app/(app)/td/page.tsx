import { tdIndex } from "@/lib/content/static";
import { TdView } from "./view";

export const metadata = { title: "TD" };

export default function TdPage() {
  return <TdView index={tdIndex()} />;
}
