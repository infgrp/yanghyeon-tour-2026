import QRCode from "qrcode";

// QR 텍스트 형식: "bus=N"
export function busQrText(busNumber: number): string {
  return `bus=${busNumber}`;
}

export function parseBusQr(text: string): number | null {
  const match = text.match(/^bus=(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export async function generateBusQrDataUrl(busNumber: number): Promise<string> {
  return QRCode.toDataURL(busQrText(busNumber), {
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

// 10대 버스 QR PDF 생성 (브라우저에서 인쇄)
export async function printBusQRs(totalBuses = 10) {
  const dataUrls: string[] = [];
  for (let i = 1; i <= totalBuses; i++) {
    dataUrls.push(await generateBusQrDataUrl(i));
  }

  const html = `<!DOCTYPE html><html><head><title>버스 QR</title>
  <style>
    body { margin: 0; font-family: sans-serif; }
    .page { page-break-after: always; display: flex; flex-direction: column;
            align-items: center; justify-content: center; height: 100vh; }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 3rem; margin-bottom: 1rem; }
    img { width: 300px; height: 300px; }
    p { font-size: 1.2rem; color: #555; margin-top: 0.5rem; }
  </style></head><body>
  ${dataUrls
    .map(
      (url, i) => `<div class="page">
    <h1>${i + 1}호차</h1>
    <img src="${url}" alt="bus=${i + 1}" />
    <p>탑승 후 카메라로 스캔하세요</p>
  </div>`
    )
    .join("")}
  </body></html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}
