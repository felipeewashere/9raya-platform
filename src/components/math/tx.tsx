import { Md } from "./md";

/**
 * Short text (title, caption, heading, label) that may contain inline math `$…$`.
 * Plain strings render as-is; strings with math render through KaTeX.
 */
export function Tx({ children, className }: { children: string | null | undefined; className?: string }) {
  if (!children) return null;
  if (!children.includes("$") && !children.includes("\\(")) return className ? <span className={className}>{children}</span> : <>{children}</>;
  return <Md inline className={className}>{children}</Md>;
}
