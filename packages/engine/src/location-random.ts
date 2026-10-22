import type { CommandResult, EngineContext } from "./index.js";

/** Keep rejected Location transitions from consuming retained deterministic input. */
export function withLocationRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult {
  const checkpoint = context.checkpoint?.();
  try {
    const result = run();
    if (result.ok) checkpoint?.commit(); else checkpoint?.rollback();
    return result;
  } catch {
    checkpoint?.rollback();
    return { ok: false, error: { code: "RANDOM_INPUT_REQUIRED", message: "Location transitions require valid deterministic random input." } };
  }
}
