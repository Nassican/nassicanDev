import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { QuoteDocument } from "./pricing-quote-document";
import { quoteStatusLabels, pricingMoney } from "./pricing-draft";
import { formatPartialDate } from "./draft-fields";

type Brand = { logo: Uint8Array; name?: string; email?: string };
const WIDTH = 595.28,
  HEIGHT = 841.89,
  MARGIN = 44,
  CONTENT = WIDTH - MARGIN * 2;
const ink = rgb(0.07, 0.07, 0.07),
  muted = rgb(0.35, 0.35, 0.35),
  line = rgb(0.85, 0.85, 0.85);

/** Server renderer: receives only the public document allowlist, never a snapshot. */
export async function createQuotePdf(quote: QuoteDocument, brand: Brand): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const [regular, bold, logo] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedPng(brand.logo),
  ]);
  const supported = new Set(regular.getCharacterSet());
  const safe = (value: string) =>
    Array.from(value.normalize("NFC").replace(/[\t\r]/g, " "))
      .map((char) => (char === "\n" || supported.has(char.codePointAt(0)!) ? char : "?"))
      .join("");
  pdf.setTitle(safe(`Cotización Nassican - ${quote.title}`));
  pdf.setAuthor("Nassican");
  pdf.setCreator("Nassican");
  pdf.setSubject("Propuesta de servicios");
  pdf.setLanguage("es-CO");
  let page = pdf.addPage([WIDTH, HEIGHT]);
  let y = 0;
  function header(first = false) {
    page.drawImage(logo, { x: MARGIN, y: HEIGHT - 88, width: 44, height: 44 });
    page.drawText("Nassican", { x: MARGIN + 57, y: HEIGHT - 62, font: bold, size: 22, color: ink });
    page.drawText("Propuesta de servicios", {
      x: MARGIN + 57,
      y: HEIGHT - 79,
      font: regular,
      size: 10,
      color: muted,
    });
    const ref = safe(quote.reference);
    page.drawText(ref, {
      x: WIDTH - MARGIN - bold.widthOfTextAtSize(ref, 9),
      y: HEIGHT - 58,
      size: 9,
      font: bold,
      color: ink,
    });
    page.drawText(first ? "Cotización" : "Continuación", {
      x: WIDTH - MARGIN - 70,
      y: HEIGHT - 77,
      size: 9,
      font: regular,
      color: muted,
    });
    page.drawLine({
      start: { x: MARGIN, y: HEIGHT - 104 },
      end: { x: WIDTH - MARGIN, y: HEIGHT - 104 },
      color: line,
      thickness: 0.7,
    });
    y = HEIGHT - 128;
  }
  function ensure(height: number) {
    if (y - height >= 86) return;
    page = pdf.addPage([WIDTH, HEIGHT]);
    header();
  }
  function lines(raw: string, size: number, width: number, font: PDFFont): string[] {
    const result: string[] = [];
    for (const paragraph of safe(raw).split("\n")) {
      if (!paragraph.trim()) {
        result.push("");
        continue;
      }
      let current = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        if (font.widthOfTextAtSize(word, size) > width) {
          if (current) {
            result.push(current);
            current = "";
          }
          for (const character of word) {
            if (font.widthOfTextAtSize(current + character, size) > width) {
              result.push(current);
              current = "";
            }
            current += character;
          }
        } else if (font.widthOfTextAtSize(current ? `${current} ${word}` : word, size) <= width) {
          current = current ? `${current} ${word}` : word;
        } else {
          result.push(current);
          current = word;
        }
      }
      if (current) result.push(current);
    }
    return result;
  }
  function text(raw: string, size = 10, font = regular, color = ink, indent = 0) {
    for (const value of lines(raw, size, CONTENT - indent, font)) {
      ensure(size * 1.5);
      if (value) page.drawText(value, { x: MARGIN + indent, y, size, font, color });
      y -= size * 1.5;
    }
  }
  function section(title: string) {
    ensure(55);
    y -= 14;
    text(title, 11, bold);
    y -= 5;
  }
  header(true);
  text(quote.title, 21, bold);
  y -= 12;
  text(`Para: ${quote.client}`, 12, bold);
  if (quote.location) text(quote.location, 10, regular, muted);
  y -= 8;
  text(`Fecha de emisión: ${quote.issued}`, 9, regular, muted);
  text(
    `Vigencia: ${quote.validity === "Sin fecha definida" ? quote.validity : formatPartialDate(quote.validity)}`,
    9,
    regular,
    muted,
  );
  text(
    `Estado: ${quoteStatusLabels[quote.status]}${quote.family ? " · Tarifa familiar" : ""}`,
    9,
    regular,
    muted,
  );
  section("Servicio propuesto");
  text(quote.service, 12, bold);
  text(
    `Alcance ${quote.scope.toLowerCase()} · Modalidad ${quote.mode.toLowerCase()}`,
    10,
    regular,
    muted,
  );
  if (quote.services.length) {
    y -= 8;
    for (const service of quote.services) text(`• ${service}`, 10, regular, ink, 8);
  }
  if (quote.description.trim()) {
    section("Alcance y entregables");
    text(quote.description, 10);
  }
  ensure(155);
  y -= 20;
  page.drawRectangle({
    x: MARGIN,
    y: y - 67,
    width: CONTENT,
    height: 78,
    color: rgb(0.95, 0.95, 0.95),
  });
  page.drawText("Valor cotizado", { x: MARGIN + 14, y: y - 8, size: 10, font: bold, color: ink });
  const amount = safe(`${pricingMoney(quote.amount, quote.currency)} ${quote.currency}`);
  const amountSize = Math.min(26, (CONTENT - 28) / bold.widthOfTextAtSize(amount, 1));
  page.drawText(amount, { x: MARGIN + 14, y: y - 39, size: amountSize, font: bold, color: ink });
  const unit =
    quote.unit === "monthly"
      ? "Por mes"
      : quote.unit === "hour"
        ? "Por hora"
        : "Por el proyecto descrito";
  page.drawText(unit, { x: MARGIN + 14, y: y - 55, size: 9, font: regular, color: muted });
  y -= 88;
  text("Tiempo de entrega y forma de pago: por acordar.", 9, regular, muted);
  text("Los cambios de alcance se cotizan por separado.", 9, regular, muted);
  if (brand.name || brand.email) {
    section("Contacto");
    if (brand.name) text(brand.name, 10, bold);
    if (brand.email) text(brand.email, 10);
  }
  const pages = pdf.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawLine({
      start: { x: MARGIN, y: 62 },
      end: { x: WIDTH - MARGIN, y: 62 },
      color: line,
      thickness: 0.7,
    });
    sheet.drawText("Nassican · nassican.com", {
      x: MARGIN,
      y: 43,
      size: 9,
      font: regular,
      color: muted,
    });
    const number = `${index + 1} / ${pages.length}`;
    sheet.drawText(number, {
      x: WIDTH - MARGIN - regular.widthOfTextAtSize(number, 9),
      y: 43,
      size: 9,
      font: regular,
      color: muted,
    });
  });
  return pdf.save();
}
