import "server-only";
import { plans, type Plan } from "./plans";
export function env(name: string) {
  const value = process.env[name];
  if (!value || /REPLACE|example\.supabase/.test(value))
    throw new Error(`Missing configuration: ${name}`);
  return value;
}
export function appUrl() {
  return new URL(env("APP_URL")).origin;
}
export function priceId(plan: Plan) {
  return env(`STRIPE_PRICE_${plan.toUpperCase()}`);
}
export function planForPrice(id: string) {
  return (Object.keys(plans) as Plan[]).find((p) => priceId(p) === id);
}
