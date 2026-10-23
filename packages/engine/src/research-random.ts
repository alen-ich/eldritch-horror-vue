import type { CommandResult, EngineContext } from "./index.js";

/** A rejected Research transition must not advance retained deterministic input. */
export function withResearchRandomTransaction(context: EngineContext, run: () => CommandResult): CommandResult {
  const checkpoint = context.checkpoint?.();
  try {
    const result = run();
    if (result.ok) checkpoint?.commit(); else checkpoint?.rollback();
    return result;
  } catch {
    checkpoint?.rollback();
    return { ok: false, error: { code: "RANDOM_INPUT_REQUIRED", message: "Research transitions require valid deterministic random input." } };
  }
}
