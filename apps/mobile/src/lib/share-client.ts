const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export function buildWhatsAppShareUrl(args: {
  address: string;
  quoteUrl: string;
  portalUrl?: string;
  clientName?: string | null;
}): string {
  const lines = [
    args.clientName ? `G'day ${args.clientName},` : "G'day,",
    "",
    `Your landscape quote for ${args.address} is ready.`,
    `Quote: ${args.quoteUrl}`,
  ];
  if (args.portalUrl) {
    lines.push(`View online: ${args.portalUrl}`);
  }
  lines.push("", "— Curtis & Co");
  return `https://wa.me/?text=${encodeURIComponent(lines.join("\n"))}`;
}

export function quoteOutputUrl(outputId: string): string {
  return `${API_URL.replace(/\/$/, "")}/outputs/${outputId}`;
}
