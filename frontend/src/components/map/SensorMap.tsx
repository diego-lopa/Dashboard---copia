import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { Device } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

interface SensorMapProps {
  devices: Device[];
  height?: string;
}

const STATUS_COLOR: Record<string, string> = {
  online: '#10B981',
  warning: '#F59E0B',
  critical: '#F43F5E',
  offline: '#64748B',
};

export const SensorMap: React.FC<SensorMapProps> = ({ devices, height = '300px' }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === 'dark';

  const withCoords = useMemo(
    () =>
      devices.filter(
        (d) =>
          typeof d.latitude === 'number' &&
          typeof d.longitude === 'number' &&
          !Number.isNaN(d.latitude) &&
          !Number.isNaN(d.longitude),
      ),
    [devices],
  );

  const center: [number, number] = useMemo(() => {
    if (withCoords.length === 0) return [40.4168, -3.7038];
    const lat = withCoords.reduce((s, d) => s + (d.latitude || 0), 0) / withCoords.length;
    const lon = withCoords.reduce((s, d) => s + (d.longitude || 0), 0) / withCoords.length;
    return [lat, lon];
  }, [withCoords]);

  if (withCoords.length === 0) {
    return (
      <div
        style={{ height }}
        className={`w-full rounded-2xl border flex items-center justify-center text-xs ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-400'
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >
        {t('map_subtitle')}
      </div>
    );
  }

  return (
    <div
      style={{ height }}
      className={`w-full rounded-2xl overflow-hidden border ${
        isDark ? 'border-slate-700' : 'border-slate-200'
      }`}
    >
      <MapContainer center={center} zoom={6} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {withCoords.map((d) => (
          <CircleMarker
            key={d.id}
            center={[d.latitude as number, d.longitude as number]}
            radius={9}
            pathOptions={{
              color: STATUS_COLOR[d.status] || STATUS_COLOR.offline,
              fillColor: STATUS_COLOR[d.status] || STATUS_COLOR.offline,
              fillOpacity: 0.7,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <strong>{d.name}</strong>
                <br />
                <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{d.dev_eui}</span>
                <br />
                <span>
                  {t('status')}: {d.status}
                </span>
                <br />
                <span>
                  {t('soil_moisture')}: {d.latest_humidity ?? '--'}%
                </span>
                <br />
                <Link to={`/devices/${d.id}`}>{t('full_detail')}</Link>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};

export default SensorMap;
