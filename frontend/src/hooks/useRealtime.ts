import { useEffect, useRef, useState } from 'react';
import { RealtimeEvent } from '../types';

export const useRealtime = (onEventReceived?: (event: RealtimeEvent) => void) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const handlerRef = useRef(onEventReceived);
  useEffect(() => {
    handlerRef.current = onEventReceived;
  }, [onEventReceived]);

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || '/api/v1';
    const streamUrl = `${base.replace(/\/$/, '')}/stream/events`;

    const connect = () => {
      try {
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
        };

        es.onmessage = (messageEvent) => {
          try {
            const parsedData: RealtimeEvent = JSON.parse(messageEvent.data);
            if (handlerRef.current) {
              handlerRef.current(parsedData);
            }
          } catch (e) {
            console.error('Error parseando evento SSE:', e);
          }
        };

        es.onerror = () => {
          setIsConnected(false);
          es.close();
          // Reintentar conexión tras 4 segundos
          setTimeout(connect, 4000);
        };
      } catch (err) {
        console.error('Error iniciando EventSource:', err);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return { isConnected };
};
