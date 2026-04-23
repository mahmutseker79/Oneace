// src/lib/movements/index.ts
//
// Barrel for the movements seam. Call sites import from here:
//
//   import { postMovement } from "@/lib/movements";
//
// Re-exports keep the internal file layout flexible — we can split
// `post.ts` into `post/{seam,hook,invariants}.ts` later without
// touching every caller.

export {
  postMovement,
  registerCostPostingHook,
  withHook,
  type StockMovementInput,
  type CostPostingHook,
  type TxClient,
} from "./post";
