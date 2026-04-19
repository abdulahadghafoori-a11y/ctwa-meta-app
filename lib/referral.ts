/** Human-readable line for CTWA session rows (slim schema). */
export function summarizeCtwaSessionLabel(s: {
  customerProfile: Record<string, unknown>;
  sourceType: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  sendTime: string;
}): string {
  const parts: string[] = [];
  const name =
    typeof s.customerProfile.name === "string"
      ? s.customerProfile.name.trim()
      : null;
  if (name) parts.push(name);
  if (s.sourceType) parts.push(s.sourceType);
  if (s.sourceId) parts.push(`id ${s.sourceId}`);
  if (s.sourceUrl) {
    const u = s.sourceUrl.length > 40 ? `${s.sourceUrl.slice(0, 40)}…` : s.sourceUrl;
    parts.push(u);
  }
  try {
    const d = new Date(s.sendTime);
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(d),
      );
    }
  } catch {
    parts.push(s.sendTime);
  }
  return parts.join(" · ") || "CTWA session";
}
