export const plans = {
  standard: { name: "Standard", cents: 2300, credits: 1000, concurrency: 1 },
  metal: { name: "Metal", cents: 3500, credits: 1500, concurrency: 2 },
  gold: { name: "Gold", cents: 5600, credits: 2500, concurrency: 3 },
} as const;
export type Plan = keyof typeof plans;
export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && Object.hasOwn(plans, value);
}
