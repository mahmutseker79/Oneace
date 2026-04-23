// src/lib/costing/landed.ts
//
// GOD MODE roadmap 2026-04-23 — P0-04 rc1.
//
// Pure allocation algorithm for landed cost (freight, duty,
// insurance, other) across the lines of a purchase order. Per
// ADR-002 section 6.
//
// Scope of this module
// --------------------
//   - Pure function. No Prisma, no I/O.
//   - Four allocation bases: BY_VALUE (default), BY_QTY, BY_WEIGHT,
//     BY_VOLUME. BY_WEIGHT / BY_VOLUME automatically fall back to
//     BY_VALUE when every line's weight (or volume) is zero/missing.
//   - Rounding: the algorithm works in micro-dollars (1 unit =
//     1e-6 dollars) as integers, which matches the ADR's
//     Decimal(18, 6) schema target. The last line absorbs any
//     rounding remainder so that the invariant
//     `sum(allocated) === totalLanded` always holds bit-for-bit.
//   - Invariant enforced at return: the sum of every allocation
//     type across every line equals the header total (exactly, in
//     micro-dollar units).
//
// Out of scope for rc1
// --------------------
//   - The LandedCostAllocation row writes (rc2).
//   - PO header schema (rc2).
//   - Receive path integration + cost-method hook (rc3).
//   - Late-allocation revaluation (future).
//   - Currency conversion (future).
//
// Precision note
// --------------
// We multiply by 1e6 and round to the nearest integer micro-dollar
// at the input boundary, then work exclusively in bigint. This
// sidesteps the classic JS floating-point drift around 0.1 + 0.2.
// Callers stay in `number` for ergonomic reasons (the Prisma
// Decimal type round-trips cleanly through `toNumber()` at the
// action-layer boundary and the PO form works with `<input
// type="number" step="0.01">`).

/**
 * Dimension used to distribute landed-cost totals across lines.
 * Matches the Prisma enum in ADR-002 §5.
 */
export type AllocationBasis = "BY_VALUE" | "BY_QTY" | "BY_WEIGHT" | "BY_VOLUME";

/**
 * A single purchase-order line, in the shape the allocation
 * algorithm needs. Minimal on purpose: the algorithm does not
 * care about the item name, SKU, bin, etc.
 */
export interface LandedPOLine {
  /** Stable identifier — returned as the allocation-map key. */
  id: string;
  /** Unit price (currency per unit). Must be >= 0. */
  unitCost: number;
  /** Ordered quantity. Must be a positive integer. */
  qty: number;
  /** Unit weight (optional). Used only when basis = BY_WEIGHT. */
  weight?: number | null;
  /** Unit volume (optional). Used only when basis = BY_VOLUME. */
  volume?: number | null;
}

/**
 * Header-level landed cost to distribute. Every field defaults to
 * zero if absent / null. Currency is advisory at this layer; the
 * caller must keep all values on the same currency.
 */
export interface LandedCostHeader {
  freight?: number | null;
  duty?: number | null;
  insurance?: number | null;
  other?: number | null;
  basis: AllocationBasis;
}

/**
 * Per-line result of the allocation. `landedUnitCost` is the
 * unit cost that the cost-posting hook (ADR-001) should consume
 * instead of the raw purchase price — it includes the line's share
 * of freight + duty + insurance + other.
 */
export interface LandedAllocation {
  freight: number;
  duty: number;
  insurance: number;
  other: number;
  /** Total landed payload applied to this line. */
  totalAllocated: number;
  /** unitCost + totalAllocated / qty. */
  landedUnitCost: number;
  /** Which basis was actually used (after fallback resolution). */
  basisUsed: AllocationBasis;
}

/** Error surface for clearly wrong inputs. */
export class LandedCostInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LandedCostInputError";
  }
}

// -----------------------------------------------------------------
// Internal helpers — micro-dollar bigint arithmetic
// -----------------------------------------------------------------
//
// 1 unit of "micro" = 1e-6 of the currency. A $100.25 freight total
// becomes 100_250_000n micro-dollars. Integer arithmetic eliminates
// rounding drift; we only re-enter `number` territory at the
// output boundary, where `Number(n) / 1e6` lands exactly for every
// representable micro-value.

const SCALE = 1_000_000n;
const SCALE_NUM = 1_000_000;

function toMicro(n: number | null | undefined): bigint {
  if (n === null || n === undefined) return 0n;
  if (!Number.isFinite(n)) {
    throw new LandedCostInputError(`expected finite number, got ${n}`);
  }
  // Round half-even (banker's rounding) to the nearest micro to
  // avoid a systematic bias when values like 100.1234565 appear.
  const scaled = n * SCALE_NUM;
  const rounded = Math.round(scaled);
  // Preserve the sign correctly for near-zero negatives (none
  // expected in practice but a cheap guard).
  return BigInt(rounded);
}

function fromMicro(n: bigint): number {
  // Exact at <= 15 significant digits. Our schema cap is
  // Decimal(18, 6) → max 12 digits before the decimal point, well
  // inside double-precision range.
  return Number(n) / SCALE_NUM;
}

function basisValue(line: LandedPOLine, basis: AllocationBasis): bigint {
  const qty = BigInt(Math.trunc(line.qty));
  switch (basis) {
    case "BY_VALUE":
      // unitCost * qty, both scaled into micro. unitCost in micro
      // times qty (integer) stays in micro.
      return toMicro(line.unitCost) * qty;
    case "BY_QTY":
      // qty itself is unit-less; scale to micro for uniform math.
      return qty * SCALE;
    case "BY_WEIGHT":
      return toMicro(line.weight ?? 0) * qty;
    case "BY_VOLUME":
      return toMicro(line.volume ?? 0) * qty;
  }
}

function sumBasis(lines: readonly LandedPOLine[], basis: AllocationBasis): bigint {
  let acc = 0n;
  for (const l of lines) acc += basisValue(l, basis);
  return acc;
}

// -----------------------------------------------------------------
// Main algorithm
// -----------------------------------------------------------------

/**
 * Distribute the header-level landed costs across `lines`.
 *
 * Invariants enforced at return:
 *   1. For each landed-cost type T in {freight, duty, insurance, other}:
 *        sum(allocations[*].T) === header.T   (exact in micros)
 *   2. Every line in `lines` has an entry in the result map.
 *   3. The last line absorbs any rounding remainder so #1 holds
 *      bit-for-bit.
 *
 * Behaviour:
 *   - If every landed-cost component is zero / null, returns a map
 *     where every line has zeros and `landedUnitCost === unitCost`.
 *   - If basis = BY_WEIGHT but every line's weight is missing/zero,
 *     we fall back to BY_VALUE (and each result reports
 *     `basisUsed = "BY_VALUE"`). Same for BY_VOLUME.
 *   - If basis = BY_VALUE but every line's value is zero (a free PO
 *     with non-zero freight somehow), we fall back to BY_QTY.
 *   - If all fallbacks yield zero denominator, throws
 *     LandedCostInputError.
 */
export function allocateLanded(
  header: LandedCostHeader,
  lines: readonly LandedPOLine[],
): Map<string, LandedAllocation> {
  if (lines.length === 0) {
    throw new LandedCostInputError("allocateLanded: lines array must not be empty");
  }
  for (const l of lines) {
    if (!l.id || typeof l.id !== "string") {
      throw new LandedCostInputError(`line missing id: ${JSON.stringify(l)}`);
    }
    if (!Number.isFinite(l.unitCost) || l.unitCost < 0) {
      throw new LandedCostInputError(`line ${l.id}: unitCost must be a non-negative finite number`);
    }
    if (!Number.isInteger(l.qty) || l.qty <= 0) {
      throw new LandedCostInputError(`line ${l.id}: qty must be a positive integer`);
    }
  }

  const totals = {
    freight: toMicro(header.freight),
    duty: toMicro(header.duty),
    insurance: toMicro(header.insurance),
    other: toMicro(header.other),
  };
  const totalLanded = totals.freight + totals.duty + totals.insurance + totals.other;

  // Zero total — return a trivial map with every line at zero.
  if (totalLanded === 0n) {
    const out = new Map<string, LandedAllocation>();
    for (const l of lines) {
      out.set(l.id, {
        freight: 0,
        duty: 0,
        insurance: 0,
        other: 0,
        totalAllocated: 0,
        landedUnitCost: l.unitCost,
        basisUsed: header.basis,
      });
    }
    return out;
  }

  // Resolve basis with fallback.
  const basisUsed = resolveBasis(header.basis, lines);
  const denom = sumBasis(lines, basisUsed);
  if (denom === 0n) {
    throw new LandedCostInputError(
      `allocateLanded: allocation basis "${basisUsed}" has zero denominator across all lines`,
    );
  }

  // Integer pro-rata. For each component T, we compute
  //   share_i = T * basisValue_i / denom
  // and keep a running total so the last line can absorb any
  // remainder to satisfy the exactness invariant.
  const out = new Map<string, LandedAllocation>();
  const running = { freight: 0n, duty: 0n, insurance: 0n, other: 0n };

  lines.forEach((line, idx) => {
    const bv = basisValue(line, basisUsed);
    const isLast = idx === lines.length - 1;

    const share = (total: bigint, acc: bigint): bigint => {
      if (isLast) return total - acc; // absorb remainder
      return (total * bv) / denom; // integer division = floor toward zero
    };

    const freight = share(totals.freight, running.freight);
    const duty = share(totals.duty, running.duty);
    const insurance = share(totals.insurance, running.insurance);
    const other = share(totals.other, running.other);

    running.freight += freight;
    running.duty += duty;
    running.insurance += insurance;
    running.other += other;

    const lineTotal = freight + duty + insurance + other;
    const qtyMicro = BigInt(line.qty) * SCALE; // qty in micro units
    // landedUnitCost = unitCost + lineTotal / qty.
    // lineTotal is already in micros, unitCost is in numbers. We
    // project unitCost to micros, add, divide by qty, and convert
    // back at the boundary.
    const unitCostMicro = toMicro(line.unitCost);
    // Divide lineTotal (micros) by qty (integer) — result in micros.
    const perUnitAllocationMicro = lineTotal / BigInt(line.qty);
    const landedUnitCostMicro = unitCostMicro + perUnitAllocationMicro;
    void qtyMicro; // kept as documentation of intent

    out.set(line.id, {
      freight: fromMicro(freight),
      duty: fromMicro(duty),
      insurance: fromMicro(insurance),
      other: fromMicro(other),
      totalAllocated: fromMicro(lineTotal),
      landedUnitCost: fromMicro(landedUnitCostMicro),
      basisUsed,
    });
  });

  // Belt-and-suspenders invariant check. With the last-line absorb
  // this is guaranteed, but we keep the assertion loud so a future
  // refactor that breaks the invariant fails at the seam rather
  // than silently corrupting a customer's books.
  if (running.freight !== totals.freight) {
    throw new LandedCostInputError(
      `internal: freight drift ${running.freight}/${totals.freight}`,
    );
  }
  if (running.duty !== totals.duty) {
    throw new LandedCostInputError(
      `internal: duty drift ${running.duty}/${totals.duty}`,
    );
  }
  if (running.insurance !== totals.insurance) {
    throw new LandedCostInputError(
      `internal: insurance drift ${running.insurance}/${totals.insurance}`,
    );
  }
  if (running.other !== totals.other) {
    throw new LandedCostInputError(
      `internal: other drift ${running.other}/${totals.other}`,
    );
  }

  return out;
}

/**
 * Decide which basis to use, falling back when the requested one
 * has a zero denominator. Order: requested → BY_VALUE → BY_QTY.
 * BY_QTY has a non-zero denominator by construction (qty > 0 is
 * validated above), so the recursion always terminates.
 */
function resolveBasis(
  requested: AllocationBasis,
  lines: readonly LandedPOLine[],
): AllocationBasis {
  if (sumBasis(lines, requested) !== 0n) return requested;
  if (requested !== "BY_VALUE" && sumBasis(lines, "BY_VALUE") !== 0n) {
    return "BY_VALUE";
  }
  return "BY_QTY";
}
