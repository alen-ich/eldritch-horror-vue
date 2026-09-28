export interface ResourceChange {
  value: number;
  amount: number;
}

function requireResourceValue(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a nonnegative integer.`);
  }
}

export function loseResource(current: number, requestedAmount: number): ResourceChange & { depleted: boolean } {
  requireResourceValue(current, "Current resource");
  requireResourceValue(requestedAmount, "Requested loss");
  const value = Math.max(0, current - requestedAmount);
  return {
    value,
    amount: current - value,
    depleted: current > 0 && value === 0,
  };
}

export function recoverResource(current: number, maximum: number, requestedAmount: number): ResourceChange {
  requireResourceValue(current, "Current resource");
  requireResourceValue(maximum, "Maximum resource");
  requireResourceValue(requestedAmount, "Requested recovery");
  if (current > maximum) throw new Error("Current resource cannot exceed its maximum.");
  const value = Math.min(maximum, current + requestedAmount);
  return {
    value,
    amount: value - current,
  };
}
