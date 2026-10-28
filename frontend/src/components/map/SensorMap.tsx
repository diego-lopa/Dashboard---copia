import React, { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, AttributionControl, useMap } from 'react-leaflet';
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

// Centro por defecto: Santiago de Compostela (red CORNEA en Galicia),
// no el centro de la península.
const DEFAULT_CENTER: [number, number] = [42.8782, -8.5448];

// Marcador que, al hacer doble clic, acerca el mapa varios niveles hacia el sensor.
const ZoomableCircleMarker: React.FC<React.ComponentProps<typeof CircleMarker>> = (props) => {
  const map = useMap();
  const center = props.center as [number, number];
  const lat = center[0];
  const lon = center[1];
  return (
    <CircleMarker
      {...props}
      eventHandlers={{
        ...props.eventHandlers,
        dblclick: (e: any) => {
          if (e?.originalEvent) {
            e.originalEvent.stopPropagation();
            e.originalEvent.preventDefault();
          }
          const targetZoom = Math.min(map.getZoom() + 7, 18);
          map.flyTo([lat, lon], targetZoom, { duration: 1.2, easeLinearity: 0.25 });
          (props.eventHandlers as any)?.dblclick?.(e);
        },
      }}
    />
  );
};

export const SensorMap: React.FC<SensorMapProps> = ({ devices, height = '300px' }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === 'dark';

  // Las sondas llegan ya filtradas (activas + visibles según servidor);
  // aquí solo se refuerza por seguridad ante datos parciales.
  const visibleDevices = devices.filter((d) => d.enabled !== false && d.visible !== false);

  const withCoords = useMemo(
    () =>
      visibleDevices.filter(
        (d) =>
          typeof d.latitude === 'number' &&
          typeof d.longitude === 'number' &&
          !Number.isNaN(d.latitude) &&
          !Number.isNaN(d.longitude),
      ),
    [visibleDevices],
  );

  const center: [number, number] = useMemo(() => {
    if (withCoords.length === 0) return DEFAULT_CENTER;
    const lat = withCoords.reduce((s, d) => s + (d.latitude || 0), 0) / withCoords.length;
    const lon = withCoords.reduce((s, d) => s + (d.longitude || 0), 0) / withCoords.length;
    return [lat, lon];
  }, [withCoords]);

  return (
    <div
      style={{ height }}
      className={`w-full rounded-2xl overflow-hidden border ${
        isDark ? 'border-slate-700' : 'border-slate-200'
      }`}
    >
      <MapContainer
        center={center}
        zoom={6}
        minZoom={2}
        maxZoom={18}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1.0}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        doubleClickZoom={false}
        markerZoomAnimation={true}
        attributionControl={false}
      >
        <AttributionControl prefix={false} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="/osm/{z}/{x}/{y}.png"
          maxZoom={18}
        />
        {withCoords.map((d) => (
          <ZoomableCircleMarker
            key={d.id}
            center={[d.latitude as number, d.longitude as number]}
            radius={7}
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
          </ZoomableCircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};

export default SensorMap;
