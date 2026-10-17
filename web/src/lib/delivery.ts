/**
 * Delivery charge per shop order (decision D9): Tk 70 inside Dhaka, Tk 130 outside Dhaka for
 * the first 1 kg, plus Tk 20 for every started kg above 1 kg (1,001 g to 2,000 g is one extra kg).
 * Pure, so the product page, the cart (US-058) and checkout (US-051) all charge the same.
 * The rates are passed in so an admin-set rate table (delivery_rate) can replace the defaults.
 */

export type DeliveryZone = "inside_dhaka" | "outside_dhaka";

export interface DeliveryRates {
  /** Tk for an order up to `includedGrams`, by zone. */
  base: Record<DeliveryZone, number>;
  /** Weight covered by the base charge. */
  includedGrams: number;
  /** Tk for each started kg above `includedGrams`. */
  extraPerKg: number;
}

export const DEFAULT_DELIVERY_RATES: DeliveryRates = {
  base: { inside_dhaka: 70, outside_dhaka: 130 },
  includedGrams: 1000,
  extraPerKg: 20,
};

export interface DeliveryInput {
  insideDhaka: boolean;
  /** Total weight of the shop order in grams (sum of item weight × quantity). */
  weightGrams: number;
}

export interface DeliveryBreakdown {
  zone: DeliveryZone;
  weightGrams: number;
  /** Tk for the first kg. */
  base: number;
  /** Started kg above the included weight (rounded up). */
  extraKg: number;
  /** Tk for the extra kg. */
  extraCharge: number;
  /** Tk to pay: base + extraCharge. */
  total: number;
}

const GRAMS_PER_KG = 1000;

/** Delivery charge with its parts. Throws a RangeError for a negative or non-finite weight. */
export function deliveryBreakdown(input: DeliveryInput, rates: DeliveryRates = DEFAULT_DELIVERY_RATES): DeliveryBreakdown {
  const { weightGrams } = input;
  if (!Number.isFinite(weightGrams) || weightGrams < 0) {
    throw new RangeError(`Weight must be a non-negative number of grams, got ${weightGrams}`);
  }
  const zone: DeliveryZone = input.insideDhaka ? "inside_dhaka" : "outside_dhaka";
  const base = rates.base[zone];
  const extraKg = Math.max(0, Math.ceil((weightGrams - rates.includedGrams) / GRAMS_PER_KG));
  const extraCharge = extraKg * rates.extraPerKg;
  return { zone, weightGrams, base, extraKg, extraCharge, total: base + extraCharge };
}

/** Tk to charge for one shop order. */
export function deliveryCharge(input: DeliveryInput, rates: DeliveryRates = DEFAULT_DELIVERY_RATES): number {
  return deliveryBreakdown(input, rates).total;
}

/** Total weight of a shop order: Σ weightGrams × quantity. */
export function orderWeightGrams(items: readonly { weightGrams: number; quantity: number }[]): number {
  return items.reduce((sum, i) => sum + i.weightGrams * i.quantity, 0);
}

/** "Tk 70 (up to 1 kg)" / "Tk 90 (1.5 kg: Tk 70 + 1 extra kg × Tk 20)". */
export function describeDelivery(b: DeliveryBreakdown, rates: DeliveryRates = DEFAULT_DELIVERY_RATES): string {
  if (b.extraKg === 0) return `Tk ${b.total} (up to ${rates.includedGrams / GRAMS_PER_KG} kg)`;
  const kg = Math.round((b.weightGrams / GRAMS_PER_KG) * 100) / 100;
  return `Tk ${b.total} (${kg} kg: Tk ${b.base} + ${b.extraKg} extra kg × Tk ${rates.extraPerKg})`;
}
