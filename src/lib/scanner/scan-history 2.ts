/**
 * Scanner history — P9.1d.
 *
 * Persists the last N scans in localStorage so users can review what
 * they scanned even after navigating away.
 *
 * Client-only — all functions no-op on the server.
 */

// ---------------------------------------------------------------------------
// localStorage-backed scan history (self-contained, no Dexie dependency).
// ---------------------------------------------------------------------------

// Instead of modifying the shared Dexie class (which requires a version
// bump and migration), we use a simple localStorage-backed approach for
// scan history. This avoids coupling scanner history to the offline DB
// versioning lifecycle and keeps the feature self-contained.

const STORAGE_KEY = "oneace-scan-history";
const MAX_ENTRIES = 50;

export interface ScanHistoryEntry {
  id: string;
  barcode: string;
  itemName: string | null;
  itemId: string | null;
  found: boolean;
  quantity: number;
  timestamp: string; // ISO
}

function readEntries(): ScanHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScanHistoryEntry[];
  } catch {
    return [];
  }
}

function writeEntries(entries: ScanHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch {
    // Quota exceeded — silently drop.
  }
}

/** Generate a simple unique id. */
function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Add a scan result to history (prepended — newest first). */
export function addScanEntry(entry: Omit<ScanHistoryEntry, "id" | "timestamp">): ScanHistoryEntry {
  const full: ScanHistoryEntry = {
    ...entry,
    id: uid(),
    timestamp: new Date().toISOString(),
  };
  const existing = readEntries();
  existing.unshift(full);
  writeEntries(existing);
  return full;
}

/** Get all history entries (newest first). */
export function getScanHistory(): ScanHistoryEntry[] {
  return readEntries();
}

/** Clear all scan history. */
export function clearScanHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Update quantity for a specific history entry (for auto-increment). */
export function incrementScanEntry(id: string, delta = 1): ScanHistoryEntry | null {
  const entries = readEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const entry = entries[idx];
  if (!entry) return null;
  entry.quantity += delta;
  writeEntries(entries);
  return entry;
}

/** Get total number of scans in current history. */
export function getScanCount(): number {
  return readEntries().length;
}
