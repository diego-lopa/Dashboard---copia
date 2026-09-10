import { format, formatDistanceToNow } from 'date-fns';

function toValidDate(input?: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Distancia temporal ("hace 5 minutos") sin lanzar nunca.
 * Devuelve '--' ante fechas ausentes o inválidas en vez de romper el render.
 */
export function formatRelative(
  input?: string | null,
  options?: { addSuffix?: boolean; locale?: any },
): string {
  const d = toValidDate(input);
  if (!d) return '--';
  try {
    return formatDistanceToNow(d, options);
  } catch {
    return '--';
  }
}

/**
 * Fecha formateada ("dd/MM/yyyy HH:mm:ss") sin lanzar nunca.
 * Devuelve '--' ante fechas ausentes o inválidas en vez de romper el render.
 */
export function formatDateTime(input?: string | null, fmt = 'dd/MM/yyyy HH:mm:ss'): string {
  const d = toValidDate(input);
  if (!d) return '--';
  try {
    return format(d, fmt);
  } catch {
    return '--';
  }
}
