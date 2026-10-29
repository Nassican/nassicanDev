import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { BillingParty, BillingIssuer, BillingInstallment } from "@nassican/shared";
import { billingMoney } from "./billing-values";
import { formatPartialDate } from "./draft-fields";
import { moneyInWords } from "./money-words";

export type CommercialPdfDocument = {
  kind: "quote" | "charge";
  reference: string;
  issued: string;
  validity?: string;
  dueDate?: string | null;
  title: string;
  concept: string;
  description: string;
  amount: number;
  currency: string;
  unit?: string;
  issuer: BillingIssuer;
  recipient: BillingParty;
  logo: Uint8Array;
  installments?: BillingInstallment[];
  paymentTerms?: string;
  deliveryTerms?: string;
  period?: string;
  status?: string;
  quoteReference?: string;
  paid?: number;
  canceled?: boolean;
  cancellationReason?: string;
  receipts?: { amount: number; paidAt: string; reference: string }[];
};

type PdfDensity = {
  body: number;
  leading: number;
  spacing: number;
  tableLeading: number;
  partyLeading: number;
  headerRule: number;
  contentTop: number;
  floor: number;
  repeatIssuer: boolean;
};
const densities: readonly PdfDensity[] = [
  {
    body: 10,
    leading: 1.45,
    spacing: 1,
    tableLeading: 12.5,
    partyLeading: 13,
    headerRule: 102,
    contentTop: 124,
    floor: 79,
    repeatIssuer: true,
  },
  {
    body: 9.5,
    leading: 1.28,
    spacing: 0.75,
    tableLeading: 11.8,
    partyLeading: 12,
    headerRule: 95,
    contentTop: 109,
    floor: 74,
    repeatIssuer: false,
  },
  {
    body: 9,
    leading: 1.22,
    spacing: 0.55,
    tableLeading: 11.2,
    partyLeading: 11.5,
    headerRule: 92,
    contentTop: 104,
    floor: 70,
    repeatIssuer: false,
  },
];

/** Prefer one readable A4 page; reduce spacing before using a smaller body font (minimum 9 pt). */
export async function renderCommercialPdf(doc: CommercialPdfDocument) {
  let best: Awaited<ReturnType<typeof composeCommercialPdf>> | undefined;
  for (const density of densities) {
    const result = await composeCommercialPdf(doc, density);
    if (!best || result.pages < best.pages) best = result;
    if (result.pages === 1) return result.bytes;
  }
  return best!.bytes;
}

async function composeCommercialPdf(doc: CommercialPdfDocument, density: PdfDensity) {
  const pdf = await PDFDocument.create();
  const [font, bold, logo] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedPng(doc.logo),
  ]);
  const chars = new Set(font.getCharacterSet());
  const safe = (value: string) =>
    Array.from(value.normalize("NFC").replace(/[\t\r]/g, " "))
      .map((c) => (c === "\n" || chars.has(c.codePointAt(0)!) ? c : "?"))
      .join("");
  const W = 595.28,
    H = 841.89,
    M = 56.7,
    width = W - M * 2,
    floor = density.floor;
  const space = (value: number) => value * density.spacing;
  const tableHeaderHeight = Math.max(12, space(18));
  const rowPadding = space(11);
  const minimumRow = density.tableLeading + rowPadding;
  const ink = rgb(0.08, 0.08, 0.08),
    gray = rgb(0.35, 0.35, 0.35),
    rule = rgb(0.7, 0.7, 0.7);
  let page: PDFPage = pdf.addPage([W, H]);
  let y = 0;
  pdf.setTitle(
    safe(`${doc.kind === "charge" ? "Cuenta de cobro" : "Cotización"} ${doc.reference} - Nassican`),
  );
  pdf.setAuthor("Nassican");
  pdf.setCreator("Nassican");
  pdf.setLanguage("es-CO");
  function wrap(raw: string, maximum: number, size = density.body, face = font) {
    const result: string[] = [];
    for (const paragraph of safe(raw).split("\n")) {
      let current = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        if (!word) continue;
        if (face.widthOfTextAtSize(word, size) > maximum) {
          if (current) {
            result.push(current);
            current = "";
          }
          for (const c of word) {
            if (face.widthOfTextAtSize(current + c, size) > maximum) {
              result.push(current);
              current = "";
            }
            current += c;
          }
        } else if (face.widthOfTextAtSize(current ? `${current} ${word}` : word, size) <= maximum)
          current = current ? `${current} ${word}` : word;
        else {
          result.push(current);
          current = word;
        }
      }
      result.push(current);
    }
    return result;
  }
  function draw(
    value: string,
    x: number,
    baseline: number,
    size = 10,
    face: PDFFont = font,
    muted = false,
  ) {
    if (value)
      page.drawText(safe(value), { x, y: baseline, size, font: face, color: muted ? gray : ink });
  }
  function line(at = y, thickness = 0.5) {
    page.drawLine({ start: { x: M, y: at }, end: { x: W - M, y: at }, thickness, color: rule });
  }
  function header() {
    page.drawImage(logo, { x: M, y: H - 85, width: 34, height: 34 });
    draw("Nassican", M + 44, H - 66, 20, bold);
    draw("Servicios de software", M + 44, H - 82, 8.5, font, true);
    const name = doc.kind === "charge" ? "Cuenta de cobro" : "Cotización";
    draw(name, W - M - bold.widthOfTextAtSize(name, 17), H - 62, 17, bold);
    draw(doc.reference, W - M - font.widthOfTextAtSize(safe(doc.reference), 9), H - 79, 9);
    line(H - density.headerRule, 0.9);
    y = H - density.contentTop;
  }
  function ensure(height: number) {
    if (y - height < floor) {
      page = pdf.addPage([W, H]);
      header();
    }
  }
  function paragraph(raw: string, size = density.body, face = font, muted = false) {
    for (const value of wrap(raw, width, size, face)) {
      ensure(size * density.leading);
      draw(value, M, y, size, face, muted);
      y -= size * density.leading;
    }
  }
  function heading(title: string, reserve = density.body * density.leading * 2) {
    ensure(space(14) + 10.5 * density.leading + space(5) + reserve);
    y -= space(14);
    paragraph(title, 10.5, bold);
    y -= space(5);
  }
  function table(headings: string[], rows: string[][], widths: number[]) {
    const inset = 6,
      leading = density.tableLeading;
    function head() {
      ensure(tableHeaderHeight + minimumRow + 8);
      line(y + 8);
      let x = M;
      headings.forEach((label, i) => {
        draw(label, x + inset, y - 4, 9, bold);
        x += widths[i];
      });
      y -= tableHeaderHeight;
      line(y + 3);
    }
    head();
    for (const row of rows) {
      const columns = row.map((cell, index) => wrap(cell, widths[index] - inset * 2, 9));
      let offset = 0;
      const maximum = Math.max(...columns.map((c) => c.length));
      while (offset < maximum) {
        if (y - minimumRow < floor) {
          page = pdf.addPage([W, H]);
          header();
          head();
        }
        const count = Math.min(
          maximum - offset,
          Math.max(1, Math.floor((y - floor - rowPadding) / leading)),
        );
        let x = M;
        columns.forEach((column, i) => {
          column.slice(offset, offset + count).forEach((cell, n) => {
            const right = i === columns.length - 1 && /[\d$]/.test(cell);
            draw(
              cell,
              right ? x + widths[i] - inset - font.widthOfTextAtSize(cell, 9) : x + inset,
              y - 9 - n * leading,
              9,
            );
          });
          x += widths[i];
        });
        y -= count * leading + rowPadding;
        offset += count;
        if (offset < maximum) {
          page = pdf.addPage([W, H]);
          header();
          head();
        }
      }
      line(y + 3, 0.3);
    }
    y -= space(8);
  }
  function party(p: BillingParty, title: string, x: number, top: number, maximum: number) {
    let pos = top;
    draw(title, x, pos, 9, bold);
    pos -= Math.max(14, space(17));
    for (const [value, face, size] of [
      [p.name, bold, Math.max(9, density.body)],
      [p.identification ? `Identificación: ${p.identification}` : "", font, 9],
      [p.address, font, 9],
      [p.city, font, 9],
      [p.email, font, 9],
      [p.phone, font, 9],
    ] as const) {
      if (!value) continue;
      for (const item of wrap(value, maximum, size, face)) {
        draw(item, x, pos, size, face);
        pos -= density.partyLeading;
      }
    }
    return pos;
  }
  header();
  const issued = /^\d{4}-\d{2}-\d{2}$/.test(doc.issued)
    ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" }).format(
        new Date(`${doc.issued}T12:00:00Z`),
      )
    : doc.issued;
  paragraph(`Fecha de emisión: ${issued}`, 9, font, true);
  if (doc.validity)
    paragraph(`Vigencia: ${formatPartialDate(doc.validity) || doc.validity}`, 9, font, true);
  if (doc.dueDate) paragraph(`Vencimiento: ${formatPartialDate(doc.dueDate)}`, 9, font, true);
  if (doc.status) paragraph(`Estado: ${doc.status}`, 9, bold);
  y -= space(16);
  y =
    Math.min(
      party(doc.issuer, "Prestador del servicio", M, y, width / 2 - 18),
      party(doc.recipient, "Cliente / destinatario", M + width / 2 + 12, y, width / 2 - 12),
    ) - space(12);
  if (doc.quoteReference) paragraph(`Cotización relacionada: ${doc.quoteReference}`, 9, font, true);
  if (doc.title.trim() !== doc.concept.trim()) paragraph(doc.title, 12, bold);
  y -= space(10);
  table(
    ["Concepto", `Valor (${doc.currency})`],
    [[doc.concept, billingMoney(doc.amount, doc.currency)]],
    [width - 124, 124],
  );
  if (doc.period) paragraph(`Periodo: ${doc.period}`, 9);
  if (doc.description) {
    heading("Alcance y entregables");
    paragraph(doc.description);
  }
  if (doc.installments?.length) {
    heading("Forma de pago acordada", tableHeaderHeight + minimumRow + 8);
    table(
      ["Cuota", "Concepto / hito", "Vencimiento", `Valor (${doc.currency})`],
      doc.installments.map((q, i) => [
        String(i + 1),
        q.label,
        q.dueDate ? formatPartialDate(q.dueDate) : "Por acordar",
        billingMoney(Number(q.amount), doc.currency),
      ]),
      [34, width - 34 - 88 - 124, 88, 124],
    );
  }
  const words = `Son: ${moneyInWords(doc.amount, doc.currency)}.`;
  const totalRowHeight = Math.max(24, space(28));
  const balanceLineHeight = Math.max(14, space(17));
  ensure(
    space(12) +
      totalRowHeight +
      (doc.kind === "charge" ? balanceLineHeight * 2 : 0) +
      wrap(words, width, 9).length * 9 * density.leading +
      space(4),
  );
  y -= space(12);
  line(y + 8);
  const totalTitle =
    doc.kind === "charge"
      ? "Valor de esta cuenta"
      : `Valor ${doc.unit === "monthly" ? "por mes" : doc.unit === "hour" ? "por hora" : "total cotizado"}`;
  const total = `${billingMoney(doc.amount, doc.currency)} ${doc.currency}`;
  draw(totalTitle, M + 6, y - 9, 11, bold);
  draw(total, W - M - bold.widthOfTextAtSize(safe(total), 12), y - 9, 12, bold);
  y -= totalRowHeight;
  if (doc.kind === "charge") {
    const paid = doc.paid ?? 0,
      balance = doc.canceled ? 0 : Math.max(0, Math.round((doc.amount - paid) * 100) / 100);
    for (const [label, value] of [
      ["Abonos registrados", paid],
      ["Saldo pendiente", balance],
    ] as const) {
      draw(label, M + 6, y, 10);
      const valueText = billingMoney(value, doc.currency);
      draw(valueText, W - M - font.widthOfTextAtSize(safe(valueText), 10), y, 10);
      y -= balanceLineHeight;
    }
  }
  paragraph(words, 9);
  y -= space(4);
  if (doc.canceled) {
    heading("Documento anulado");
    paragraph(doc.cancellationReason || "Cuenta anulada. No efectuar pagos con este documento.");
  }
  if (doc.receipts?.length) {
    heading("Abonos registrados", tableHeaderHeight + minimumRow + 8);
    table(
      ["Fecha", "Referencia", `Valor (${doc.currency})`],
      doc.receipts.map((r) => [
        formatPartialDate(r.paidAt),
        r.reference,
        billingMoney(r.amount, doc.currency),
      ]),
      [90, width - 90 - 124, 124],
    );
  }
  heading("Condiciones");
  paragraph(doc.paymentTerms || "Forma de pago: por acordar.", 9);
  if (doc.kind === "quote") paragraph(doc.deliveryTerms || "Plazo de entrega: por acordar.", 9);
  if (doc.kind === "charge" && !doc.canceled) {
    const bank = [doc.issuer.bank, doc.issuer.accountType, doc.issuer.accountNumber]
      .filter(Boolean)
      .join(" · ");
    if (bank || doc.issuer.paymentInstructions) {
      heading("Medio de pago");
      if (bank) paragraph(bank, 9);
      if (doc.issuer.paymentInstructions) paragraph(doc.issuer.paymentInstructions, 9);
    }
  }
  if (density.repeatIssuer) {
    ensure(
      space(15) +
        wrap(doc.issuer.name || "Nassican", width, 10, bold).length * 10 * density.leading +
        (doc.issuer.identification
          ? wrap(doc.issuer.identification, width, 9).length * 9 * density.leading
          : 0),
    );
    y -= space(15);
    paragraph(doc.issuer.name || "Nassican", 10, bold);
    if (doc.issuer.identification) paragraph(doc.issuer.identification, 9);
  }
  if (doc.kind === "charge") {
    y -= space(8);
    paragraph(
      "Cuenta de cobro. No constituye factura electrónica ni documento soporte DIAN.",
      8,
      font,
      true,
    );
  }
  const pages = pdf.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawLine({
      start: { x: M, y: 54 },
      end: { x: W - M, y: 54 },
      color: rule,
      thickness: 0.5,
    });
    sheet.drawText("Nassican · nassican.com", { x: M, y: 38, size: 8, font, color: gray });
    const number = `${index + 1} / ${pages.length}`;
    sheet.drawText(number, {
      x: W - M - font.widthOfTextAtSize(number, 8),
      y: 38,
      size: 8,
      font,
      color: gray,
    });
  });
  return { bytes: await pdf.save(), pages: pages.length };
}
