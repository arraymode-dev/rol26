export const CERTIFICATE_FILENAME = "river-of-light-collected-2026.png";

export function certificateSvg(total: number): string {
  const lights = Array.from({ length: total }, (_, index) => {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${540 + Math.cos(angle) * 207}" cy="${474 + Math.sin(angle) * 207}" r="7" fill="#f0d999"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs>
      <radialGradient id="glow"><stop stop-color="#826331" stop-opacity=".28"/><stop offset="1" stop-color="#101b23" stop-opacity="0"/></radialGradient>
      <linearGradient id="gold" x2="1" y2="1"><stop stop-color="#b99250"/><stop offset=".5" stop-color="#f5e5b9"/><stop offset="1" stop-color="#b58b48"/></linearGradient>
    </defs>
    <rect width="1080" height="1350" fill="#101b23"/>
    <ellipse cx="540" cy="520" rx="560" ry="600" fill="url(#glow)"/>
    <rect x="38" y="38" width="1004" height="1274" rx="12" fill="none" stroke="#b99250" stroke-opacity=".5"/>
    <g text-anchor="middle">
      <text x="540" y="145" fill="#ead6a0" font-family="Arial, sans-serif" font-size="32" letter-spacing="8">RIVER OF LIGHT</text>
      <text x="540" y="195" fill="#a69d88" font-family="Arial, sans-serif" font-size="20" letter-spacing="6">LIVERPOOL · 2026</text>
      <circle cx="540" cy="474" r="177" fill="none" stroke="url(#gold)" stroke-width="2"/>
      <circle cx="540" cy="474" r="165" fill="none" stroke="#b99250" stroke-opacity=".25"/>
      ${lights}
      <text x="540" y="507" fill="url(#gold)" font-family="Georgia, serif" font-size="152">${total}</text>
      <text x="540" y="561" fill="#d7c49a" font-family="Arial, sans-serif" font-size="18" letter-spacing="4">OF ${total} LIGHTS</text>
      <text x="540" y="808" fill="#f4e6c3" font-family="Georgia, serif" font-size="87">I collected</text>
      <text x="540" y="905" fill="#f4e6c3" font-family="Georgia, serif" font-size="87">every light.</text>
      <text x="540" y="982" fill="#c5baa2" font-family="Arial, sans-serif" font-size="25">A city. A little wonder. A brilliant adventure.</text>
      <path d="M350 1080 C440 1042 470 1120 550 1080 S660 1060 730 1080" fill="none" stroke="url(#gold)" stroke-width="2"/>
      <text x="540" y="1188" fill="#d7c49a" font-family="Arial, sans-serif" font-size="19" letter-spacing="3">THE COMPLETE LIGHT COLLECTION</text>
      <text x="540" y="1250" fill="#938a78" font-family="Arial, sans-serif" font-size="17">Unofficial explorer certificate</text>
    </g>
  </svg>`;
}

export async function createCertificate(total: number): Promise<File> {
  const source = URL.createObjectURL(
    new Blob([certificateSvg(total)], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image export unavailable");
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Image export failed")),
        "image/png",
      ),
    );
    return new File([blob], CERTIFICATE_FILENAME, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(source);
  }
}

type ShareSupport = Partial<Pick<Navigator, "share" | "canShare">>;
export function canShareCertificate(
  file: File,
  support: ShareSupport,
): boolean {
  try {
    return Boolean(support.share && support.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

export async function shareCertificate(
  file: File,
  support: ShareSupport,
): Promise<"shared" | "cancelled" | "unavailable" | "failed"> {
  if (!canShareCertificate(file, support)) return "unavailable";
  try {
    // The PNG is prepared before the tap so Safari retains user activation.
    await support.share!({ files: [file] });
    return "shared";
  } catch (error) {
    return error instanceof Error && error.name === "AbortError"
      ? "cancelled"
      : "failed";
  }
}
