import React, { useEffect, useState } from 'react';

interface LogoProps {
  /** sm: cabecera (40px) · lg: pantalla de acceso (64px) */
  size?: 'sm' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { box: 'w-10 h-10 rounded-xl', shadow: 'shadow-lg shadow-emerald-500/30' },
  lg: { box: 'w-16 h-16 rounded-2xl', shadow: 'shadow-xl shadow-emerald-500/30' },
};

/**
 * Icono de marca CORNEA.
 * Muestra `public/logo.png` (703x703 con transparencia) centrado al 75% dentro
 * del icono degradado existente, con el efecto de respiración aplicado a la
 * propia imagen (la transparencia sube y baja cíclicamente).
 * La imagen solo se renderiza si el fichero existe (precarga con Image()).
 */
export const Logo: React.FC<LogoProps> = ({ size = 'sm', className = '' }) => {
  const [logoOk, setLogoOk] = useState(false);
  const s = SIZES[size];

  useEffect(() => {
    const probe = new Image();
    probe.onload = () => setLogoOk(true);
    probe.onerror = () => setLogoOk(false);
    probe.src = '/logo.png';
  }, []);

  return (
    <div
      className={`${s.box} relative overflow-hidden bg-gradient-to-tr from-emerald-500 to-cyan-400 flex items-center justify-center ${s.shadow} shrink-0 ${className}`}
    >
      {logoOk && (
        <img
          src="/logo.png"
          alt="CORNEA"
          className="absolute inset-0 m-auto w-[95%] h-[95%] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)] animate-breathe"
        />
      )}
    </div>
  );
};

export default Logo;
