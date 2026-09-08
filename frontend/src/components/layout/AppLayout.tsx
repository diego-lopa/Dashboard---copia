import React, { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { useRealtime } from '../../hooks/useRealtime';
import { useTheme } from '../../context/ThemeContext';

export const AppLayout: React.FC = () => {
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const { isConnected } = useRealtime((event) => {
    if (event.type === 'alert') {
      if (event.data.state === 'triggered') {
        setActiveAlertCount((prev) => prev + 1);
      } else if (event.data.state === 'resolved') {
        setActiveAlertCount((prev) => Math.max(0, prev - 1));
      }
    }
  });

  // Called when the user clicks the alert bell icon — resets the badge
  const handleAlertIconClick = useCallback(() => {
    setActiveAlertCount(0);
  }, []);

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-300 ${
        isDark ? 'bg-[#0B1120]' : 'bg-slate-100'
      }`}
    >
      <Navbar
        realtimeConnected={isConnected}
        activeAlertCount={activeAlertCount}
        onAlertIconClick={handleAlertIconClick}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
