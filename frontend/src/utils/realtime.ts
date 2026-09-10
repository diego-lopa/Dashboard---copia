import { AlertEvent } from '../types';

/**
 * Normaliza un evento de alerta recibido por SSE al tipo AlertEvent.
 * El backend emite claves camelCase (ruleId, deviceName, triggeredAt…),
 * mientras la UI trabaja con snake_case (rule_id, device_name, triggered_at…).
 * Sin esta normalización, los campos llegan como `undefined` y el render
 * (p. ej. formatear `triggered_at`) lanza excepciones que desmontan la app.
 */
export function normalizeAlertEvent(data: any, fallbackTs?: string): AlertEvent {
  const ts = new Date().toISOString();
  return {
    id: data?.id ?? `sse-${Date.now()}`,
    rule_id: data?.rule_id ?? data?.ruleId ?? '',
    rule_name: data?.rule_name ?? data?.ruleName ?? '',
    metric: data?.metric ?? '',
    condition: data?.condition ?? '',
    threshold: data?.threshold ?? 0,
    device_id: data?.device_id ?? data?.deviceId ?? '',
    device_name: data?.device_name ?? data?.deviceName ?? '',
    dev_eui: data?.dev_eui ?? data?.devEui ?? '',
    state: data?.state ?? 'triggered',
    severity: data?.severity ?? 'warning',
    value: data?.value ?? 0,
    message: data?.message ?? '',
    triggered_at: data?.triggered_at ?? data?.triggeredAt ?? fallbackTs ?? ts,
    resolved_at: data?.resolved_at ?? data?.resolvedAt,
    acknowledged_at: data?.acknowledged_at ?? data?.acknowledgedAt,
    acknowledged_by_email: data?.acknowledged_by_email ?? data?.acknowledgedByEmail,
  };
}
