/** "1.1 Définition" → "Définition", "II. Groupes" → "Groupes" (headings are numbered 01, 02… instead). */
export function stripNumber(t: string) {
  return t.replace(/^\s*(?:[IVX]+|\d+)(?:[.)]\d+)*[.)]?\s+(?=\S)/, "");
}
