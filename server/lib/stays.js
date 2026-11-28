import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".data", "stays.json");

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

export function saveStay(stay) {
  const rows = readAll().filter((item) => item.bookingId !== stay.bookingId);
  rows.push(stay);
  writeAll(rows);
  return stay;
}

export function staysFor(owner) {
  if (!owner) return [];
  return readAll()
    .filter((item) => item.owner === owner)
    .sort((a, b) => String(b.bookedAt).localeCompare(String(a.bookedAt)));
}
