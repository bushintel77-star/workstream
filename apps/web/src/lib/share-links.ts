export function buildWhatsAppShareUrl(args: {
  address: string;
  quoteUrl: string;
  portalUrl?: string;
  clientName?: string;
}): string {
  const lines = [
    args.clientName ? `Hi ${args.clientName},` : "Hi,",
    "",
    `Your landscape quote for ${args.address} is ready.`,
    `Quote: ${args.quoteUrl}`,
  ];
  if (args.portalUrl) {
    lines.push(`View online: ${args.portalUrl}`);
  }
  lines.push("", "— Workstream");
  const text = lines.join("\n");
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
