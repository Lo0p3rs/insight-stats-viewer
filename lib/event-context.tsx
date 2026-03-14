'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { fetchEvents } from '@/lib/api';
import { getSelectedEventKey, getToken, setSelectedEventKey } from '@/lib/auth';
import type { Event } from '@/lib/types';

type EventContextValue = {
  events: Event[];
  selectedEventKey: string | null;
  selectedEvent: Event | null;
  setEventKey: (key: string) => void;
  refreshEvents: () => Promise<void>;
  loading: boolean;
  error: string | null;
};

const EventContext = createContext<EventContextValue | null>(null);

function sortEvents(list: Event[]): Event[] {
  return [...list].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name, undefined, {
      sensitivity: 'base',
    });
    if (nameCompare !== 0) return nameCompare;
    return a.eventKey.localeCompare(b.eventKey);
  });
}

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventKey, setSelectedEventKeyState] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshEvents = async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvents(token);
      const sorted = sortEvents(data);
      setEvents(sorted);

      const storedKey = getSelectedEventKey();
      const fallbackKey = sorted[0]?.eventKey ?? null;
      const nextKey =
        storedKey && sorted.some((event) => event.eventKey === storedKey)
          ? storedKey
          : fallbackKey;
      if (nextKey) {
        setSelectedEventKey(nextKey);
        setSelectedEventKeyState(nextKey);
      } else {
        setSelectedEventKeyState(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshEvents();
  }, []);

  const setEventKey = (key: string) => {
    setSelectedEventKey(key);
    setSelectedEventKeyState(key);
  };

  const selectedEvent =
    events.find((event) => event.eventKey === selectedEventKey) ?? null;

  return (
    <EventContext.Provider
      value={{
        events,
        selectedEventKey,
        selectedEvent,
        setEventKey,
        refreshEvents,
        loading,
        error,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEventContext() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventContext must be used within EventProvider.');
  }
  return context;
}
