/**
 * Utilidades de batería (Li-ion 1S 3.0–4.2 V). Espejo de la semántica del
 * frontend (`frontend/src/utils/battery.ts`) para que API, worker y panel
 * evalúen "batería baja" igual:
 *  - Umbral > 15  → porcentaje (20 = 20 %).
 *  - Umbral <= 15 → voltios (3.3 = 3.3 V).
 */

export const BATTERY_EMPTY_V = 3.0;
export const BATTERY_FULL_V = 4.2;

/** Voltaje (V) → % estimado 0-100 redondeado. null sin dato. */
export function batteryPercent(voltage?: number | null): number | null {
  if (voltage === undefined || voltage === null || Number.isNaN(voltage)) return null;
  const pct = ((voltage - BATTERY_EMPTY_V) / (BATTERY_FULL_V - BATTERY_EMPTY_V)) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

/** ¿Batería baja según el umbral (auto-detecta % o V)? */
export function isLowBattery(voltage?: number | null, threshold?: number | null): boolean {
  if (voltage === undefined || voltage === null || Number.isNaN(voltage)) return false;
  if (threshold === undefined || threshold === null || Number.isNaN(threshold)) return false;
  if (threshold > 15) {
    const pct = batteryPercent(voltage);
    return pct !== null && pct <= threshold;
  }
  return voltage <= threshold;
}
