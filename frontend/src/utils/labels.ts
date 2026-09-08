/**
 * Etiquetas traducidas para estados y severidades.
 * Los valores crudos vienen del backend en inglés (triggered, warning, ...);
 * estas funciones los convierten a la etiqueta del idioma activo.
 * Si el valor es desconocido, se devuelve tal cual (sin romper la UI).
 */

export function alertStateLabel(state: string | undefined, t: (key: string) => string): string {
  switch (state) {
    case 'triggered':
      return t('state_triggered');
    case 'acknowledged':
      return t('state_acknowledged');
    case 'resolved':
      return t('state_resolved');
    default:
      return state ?? '--';
  }
}

export function severityLabel(severity: string | undefined, t: (key: string) => string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
      return t('severity_critical');
    case 'warning':
      return t('severity_warning');
    case 'low':
      return t('severity_low');
    default:
      return severity ?? '--';
  }
}

export function deviceStatusLabel(status: string | undefined, t: (key: string) => string): string {
  switch (status) {
    case 'online':
      return t('dev_online');
    case 'warning':
      return t('dev_warning');
    case 'critical':
      return t('dev_critical');
    case 'offline':
      return t('dev_offline');
    default:
      return status ?? '--';
  }
}
