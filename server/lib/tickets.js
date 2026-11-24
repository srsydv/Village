import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".data", "bookings.json");

function readAll() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows.slice(-400), null, 2));
}

export function saveTicket(ticket) {
  const rows = readAll().filter((item) => item.bookingId !== ticket.bookingId);
  rows.push(ticket);
  writeAll(rows);
  return ticket;
}

export function ticketsFor(owner) {
  if (!owner) return [];
  return readAll()
    .filter((item) => item.owner === owner)
    .sort((a, b) => String(b.bookedAt).localeCompare(String(a.bookedAt)));
}
