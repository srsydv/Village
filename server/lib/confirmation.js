import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import PDFDocument from "pdfkit";

const ICON = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "client", "public", "icon-192.png");
const INK = "#171512";
const SOFT = "#5e584e";
const MUTED = "#8a847a";
const LINE = "#ece7df";
const CREAM = "#f6efe4";
const GOLD = "#c9a36a";

function formatDay(iso) {
  const day = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const date = new Date(`${day}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function clock(iso) {
  const match = String(iso || "").match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function duration(minutes) {
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return "";
  const hours = Math.floor(n / 60);
  const rest = n % 60;
  if (hours && rest) return `${hours}h ${rest}m`;
  if (hours) return `${hours}h`;
  return `${rest}m`;
}

function moneyLine(amount, currency) {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number(amount) % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return currency ? `${currency} ${formatted}` : formatted;
}

function flightNo(segment) {
  const raw = String(segment.number || "").trim();
  const code = String(segment.code || "").trim();
  if (code && raw.toUpperCase().startsWith(code)) return raw.slice(code.length).trim();
  return raw;
}

function place(name, code) {
  if (name && code) return `${name} (${code})`;
  return name || code || "";
}

function statusLabel(status) {
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "CANCELLED_WITH_CHARGES") return "Cancelled with charges";
  const text = String(status || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function genderLabel(value) {
  if (value === "M") return "Male";
  if (value === "F") return "Female";
  return value || "";
}

function bagLabel(bag) {
  const bits = [];
  if (bag.pieces) bits.push(String(bag.pieces));
  if (bag.name) bits.push(bag.name);
  if (bag.weightKg) bits.push(`${bag.weightKg} kg`);
  const text = bits.join(" ");
  return bag.size ? `${text}, ${bag.size}` : text;
}

async function imageBuffer(url) {
  if (!String(url || "").startsWith("https://")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 40 || buf.length > 500000) return null;
    return buf;
  } catch {
    return null;
  }
}

function paintImage(doc, buffer, x, y, size) {
  if (!buffer) return false;
  try {
    doc.image(buffer, x, y, { fit: [size, size], align: "center", valign: "center" });
    return true;
  } catch {
    return false;
  }
}

export async function confirmationPdf(detail, { sandbox = false } = {}) {
  let mark = null;
  try {
    mark = fs.readFileSync(ICON);
  } catch {
    mark = null;
  }
  const logos = [];
  for (const segment of detail.segments || []) logos.push(await imageBuffer(segment.logo));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 32 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = 32;
    const width = doc.page.width - 64;
    let y = 28;

    paintImage(doc, mark, left, y, 42);
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(22).text("Safar", left + 52, y + 2, { lineBreak: false });
    doc.fillColor(MUTED).font("Helvetica").fontSize(9).text("E-ticket", left + 52, y + 26, { lineBreak: false });
    const status = statusLabel(detail.status);
    if (status) {
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(status, left, y + 4, { width, align: "right", lineBreak: false });
    }
    if (detail.bookingRef) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("BOOKING REFERENCE", left, y + 20, { width, align: "right", lineBreak: false });
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(detail.bookingRef, left, y + 32, { width, align: "right", lineBreak: false });
    }
    y += 58;
    doc.moveTo(left, y).lineTo(left + width, y).strokeColor(GOLD).lineWidth(1.5).stroke();
    y += 14;

    if (sandbox) {
      doc.roundedRect(left, y, width, 36, 8).fillColor("#f8efe0").fill();
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text("Test booking", left + 12, y + 6, { lineBreak: false });
      doc.font("Helvetica").fontSize(8).fillColor(SOFT)
        .text("The airline will not issue a boarding pass for this test, and it will not appear in the airline app.", left + 12, y + 18, { width: width - 24 });
      y += 48;
    }

    const people = detail.passengers || [];
    if (people.length) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("TRAVELLER", left, y, { lineBreak: false });
      y += 12;
      for (const person of people) {
        const bits = [person.name, genderLabel(person.gender), formatDay(person.birthday), person.nationality].filter(Boolean);
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(bits.join("   ·   "), left, y, { width });
        y = doc.y + 2;
      }
      const contact = [detail.contact?.email, detail.contact?.phone].filter(Boolean).join("   ·   ");
      if (contact) {
        doc.fillColor(SOFT).font("Helvetica").fontSize(9).text(contact, left, y, { width });
        y = doc.y + 8;
      } else {
        y += 8;
      }
    }

    const airline = detail.segments?.find((segment) => segment.airline)?.airline || "the airline";
    (detail.segments || []).forEach((segment, index) => {
      if (y > 680) {
        doc.addPage();
        y = 36;
      }
      const from = place(segment.fromName, segment.from);
      const to = place(segment.toName, segment.to);
      const bags = (detail.bags || []).map(bagLabel).filter(Boolean);
      const cardH = 118 + (bags.length ? 22 : 0);
      doc.roundedRect(left, y, width, cardH, 12).strokeColor(LINE).lineWidth(1).stroke();
      doc.rect(left, y + 12, 3, cardH - 24).fillColor(GOLD).fill();

      const logoOk = paintImage(doc, logos[index], left + 16, y + 14, 36);
      const nameX = left + (logoOk ? 60 : 16);
      const title = segment.airline || "Flight";
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text(title, nameX, y + 16, { width: 220, lineBreak: false });
      const number = flightNo(segment);
      if (number) doc.fillColor(MUTED).font("Helvetica").fontSize(10).text(number, nameX, y + 32, { lineBreak: false });
      const day = formatDay(segment.departAt);
      if (day) doc.fillColor(SOFT).font("Helvetica").fontSize(10).text(day, left, y + 20, { width: width - 16, align: "right", lineBreak: false });

      const timeY = y + 58;
      const col = (width - 120) / 2;
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(18).text(clock(segment.departAt) || "—", left + 16, timeY, { width: col, lineBreak: false });
      doc.text(clock(segment.arriveAt) || "—", left + 16 + col + 88, timeY, { width: col, align: "right", lineBreak: false });
      const dur = duration(segment.minutes);
      if (dur) doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(dur, left + 16 + col, timeY + 6, { width: 88, align: "center", lineBreak: false });

      doc.fillColor(SOFT).font("Helvetica").fontSize(8).text(from, left + 16, timeY + 24, { width: col });
      const leftBottom = doc.y;
      doc.fillColor(SOFT).font("Helvetica").fontSize(8).text(to, left + 16 + col + 88, timeY + 24, { width: col, align: "right" });
      let next = Math.max(leftBottom, doc.y) + 8;
      const arriveDay = formatDay(segment.arriveAt);
      if (arriveDay && arriveDay !== day) {
        doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(`Arrives ${arriveDay}`, left + 16 + col + 88, next - 4, { width: col, align: "right", lineBreak: false });
      }
      if (bags.length) {
        const bagY = y + cardH - 24;
        doc.moveTo(left + 16, bagY - 6).lineTo(left + width - 16, bagY - 6).strokeColor(LINE).lineWidth(1).stroke();
        doc.fillColor(SOFT).font("Helvetica").fontSize(8).text(bags.join("    ·    "), left + 16, bagY, { width: width - 32, lineBreak: false });
      }
      y += cardH + 12;
      next = y;
      y = next;
    });

    const fareBits = [detail.cabin, detail.family].filter(Boolean);
    if (fareBits.length) {
      doc.fillColor(SOFT).font("Helvetica").fontSize(9).text(fareBits.join("  ·  "), left, y, { width });
      y = doc.y + 10;
    }

    if (y > 700) {
      doc.addPage();
      y = 36;
    }
    const pnrH = detail.airlinePnr ? 72 : 36;
    doc.roundedRect(left, y, width, pnrH, 12).fillColor(CREAM).fill();
    if (detail.airlinePnr) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("AIRLINE CODE", left + 16, y + 12, { lineBreak: false });
      doc.fillColor(INK).font("Helvetica-Bold").fontSize(20).text(detail.airlinePnr, left + 16, y + 26, { lineBreak: false });
      doc.fillColor(SOFT).font("Helvetica").fontSize(8)
        .text(`Check in with ${airline} using this code. ${airline} issues the boarding pass the airport scans.`, left + 16, y + 50, { width: width - 32 });
    } else {
      doc.fillColor(SOFT).font("Helvetica").fontSize(9)
        .text("The airline code appears when the airline assigns it. Check-in uses that code.", left + 16, y + 12, { width: width - 32 });
    }
    y += pnrH + 16;

    const price = detail.price;
    const rows = [
      price?.base != null ? ["Fare", moneyLine(price.base, price.currency)] : null,
      price?.taxes != null ? ["Taxes", moneyLine(price.taxes, price.currency)] : null,
      price?.fees != null ? ["Fees", moneyLine(price.fees, price.currency)] : null,
      ...(detail.extras || []).map((extra) => [extra.name || "Extra", moneyLine(extra.amount, extra.currency || price?.currency)]),
    ].filter((row) => row && row[1]);
    if (rows.length || detail.paid) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text("FARE", left, y, { lineBreak: false });
      y += 16;
      for (const [label, value] of rows) {
        doc.fillColor(SOFT).font("Helvetica").fontSize(10).text(label, left, y, { width: width / 2, lineBreak: false });
        doc.fillColor(INK).font("Helvetica").fontSize(10).text(value, left, y, { width, align: "right", lineBreak: false });
        y += 16;
      }
      if (detail.paid) {
        y += 2;
        doc.moveTo(left, y).lineTo(left + width, y).strokeColor(LINE).lineWidth(1).stroke();
        y += 8;
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text("Paid to the booking partner", left, y, { width: width * 0.62, lineBreak: false });
        doc.text(moneyLine(detail.paid.amount, detail.paid.currency || price?.currency), left, y, { width, align: "right", lineBreak: false });
        y += 22;
      }
    }

    if (detail.ticketNumbers?.length) {
      doc.fillColor(SOFT).font("Helvetica").fontSize(9).text(`Ticket number  ${detail.ticketNumbers.join(", ")}`, left, y, { width });
      y = doc.y + 8;
    }
    for (const line of (detail.terms || []).slice(0, 6)) {
      doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(line, left, y, { width });
      y = doc.y + 2;
    }
    y += 8;
    doc.fillColor(MUTED).font("Helvetica").fontSize(8)
      .text("Safar prepared this e-ticket from the booking. The card was charged by the booking partner. Check in with the airline to get the boarding pass the airport scans.", left, y, { width });

    doc.end();
  });
}
