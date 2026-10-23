import type { PendingDecision, PendingDecisionSummary } from '@eldritch/protocol'

/** Private messages and public schema patches can arrive in either order. */
export function createPrivateDecisionInbox() {
  const decisions = new Map<string, PendingDecision>()
  return {
    receive(decision: PendingDecision): PendingDecision {
      decisions.set(decision.id, decision)
      // Keep a bounded history while older public patches are in flight.
      if (decisions.size > 8) decisions.delete(decisions.keys().next().value!)
      return decision
    },
    sync(summary?: PendingDecisionSummary): PendingDecision | PendingDecisionSummary | undefined {
      return summary ? decisions.get(summary.id) ?? summary : undefined
    },
    clear(): void { decisions.clear() }
  }
}
