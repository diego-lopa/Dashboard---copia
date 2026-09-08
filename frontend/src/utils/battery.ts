/**
 * Utilidades de batería para sondas LoRaWAN alimentadas por batería
 * recargable (Li-ion 1S) + panel solar.
 *
 * Rango operativo típico de la celda:
 *   - 3.0 V  -> 0 % (vacía / corte)
 *   - 4.2 V  -> 100 % (carga completa)
 *
 * El porcentaje se estima por interpolación lineal y se limita a [0, 100].
 * Es una estimación indicativa: con carga solar el voltaje fluctúa y la
 * curva real de descarga no es perfectamente lineal.
 */

export const BATTERY_EMPTY_V = 3.0;
export const BATTERY_FULL_V = 4.2;

/** Convierte voltaje (V) a porcentaje estimado (0-100). null si no hay dato. */
export function batteryPercent(voltage?: number | null): number | null {
  if (voltage === undefined || voltage === null || Number.isNaN(voltage)) return null;
  const pct = ((voltage - BATTERY_EMPTY_V) / (BATTERY_FULL_V - BATTERY_EMPTY_V)) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

/**
 * Unidad del umbral de batería baja.
 * Umbrales > 15 se interpretan como porcentaje (ej. 20 = 20 %);
 * umbrales <= 15 se interpretan como voltios (ej. 3.3 V).
 */
export function batteryThresholdUnit(threshold?: number | null): '%' | 'V' {
  return threshold !== undefined && threshold !== null && threshold <= 15 ? 'V' : '%';
}

/** ¿La batería está baja según el umbral configurado (auto-detecta % o V)? */
export function isLowBattery(voltage?: number | null, threshold?: number | null): boolean {
  if (voltage === undefined || voltage === null || Number.isNaN(voltage)) return false;
  if (threshold === undefined || threshold === null || Number.isNaN(threshold)) return false;
  if (threshold > 15) {
    const pct = batteryPercent(voltage);
    return pct !== null && pct <= threshold;
  }
  return voltage <= threshold;
}

/** Formato compacto "3.82V · 68 %" o "--" sin dato. */
export function formatBattery(voltage?: number | null): string {
  if (voltage === undefined || voltage === null || Number.isNaN(voltage)) return '--';
  const pct = batteryPercent(voltage);
  return `${voltage}V · ${pct}%`;
}
