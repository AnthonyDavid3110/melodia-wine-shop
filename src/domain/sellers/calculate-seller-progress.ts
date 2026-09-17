import { type Money } from "../money";

export interface SellerProgress {
  amount: Money;
  target: Money;
  /** Rounded percentage; can exceed 100 once the target is reached (docs/03-USER-FLOWS.md §34). */
  percentage: number;
}

/** Handles a zero/unset target without dividing by zero. */
export function calculateSellerProgress(salesAmount: Money, targetAmount: Money): SellerProgress {
  const percentage = targetAmount === 0 ? 0 : Math.round((salesAmount / targetAmount) * 100);
  return { amount: salesAmount, target: targetAmount, percentage };
}
