import type { CommandResult, EngineContext } from "./index.js";

/** Keep failed Other World transitions from advancing retained deterministic input. */
export function withOtherWorldRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult {
  const checkpoint = context.checkpoint?.();
  try {
    const result = run();
    if (result.ok) checkpoint?.commit(); else checkpoint?.rollback();
    return result;
  } catch {
    checkpoint?.rollback();
    return { ok: false, error: { code: "RANDOM_INPUT_REQUIRED", message: "Other World transitions require valid deterministic random input." } };
  }
}
