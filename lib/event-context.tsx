'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { fetchEvents } from '@/lib/api';
import { getSelectedEventKey, getToken, setSelectedEventKey } from '@/lib/auth';
import type { Event } from '@/lib/types';

const EVENTS_CACHE_KEY = 'insight_events_cache';

type EventContextValue = {
  events: Event[];
  selectedEventKey: string | null;
  selectedEvent: Event | null;
  setEventKey: (key: string) => void;
  refreshEvents: (options?: { silent?: boolean }) => Promise<void>;
  eventVersion: number;
  loading: boolean;
  error: unknown | null;
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

function readCachedEvents(): Event[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(EVENTS_CACHE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortEvents(
      parsed
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          name: typeof item.name === 'string' ? item.name : '',
          eventKey: typeof item.eventKey === 'string' ? item.eventKey : '',
          startDate: typeof item.startDate === 'string' ? item.startDate : '',
        }))
        .filter((event) => event.eventKey),
    );
  } catch {
    return [];
  }
}

function writeCachedEvents(events: Event[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(events));
}

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventKey, setSelectedEventKeyState] = useState<string | null>(
    null,
  );
  const [eventVersion, setEventVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  const refreshEvents = async (options?: { silent?: boolean }) => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    if (!options?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const data = await fetchEvents(token);
      const sorted = sortEvents(data);
      setEvents(sorted);
      writeCachedEvents(sorted);

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
      setEventVersion((prev) => prev + 1);
    } catch (err) {
      const cached = readCachedEvents();
      if (cached.length > 0) {
        setEvents(cached);
        const storedKey = getSelectedEventKey();
        const fallbackKey = cached[0]?.eventKey ?? null;
        const nextKey =
          storedKey && cached.some((event) => event.eventKey === storedKey)
            ? storedKey
            : fallbackKey;
        setSelectedEventKeyState(nextKey);
      }

      setError(err);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const token = getToken();
    const cached = readCachedEvents();
    const storedKey = getSelectedEventKey();

    if (cached.length > 0) {
      setEvents(cached);
      const fallbackKey = cached[0]?.eventKey ?? null;
      const nextKey =
        storedKey && cached.some((event) => event.eventKey === storedKey)
          ? storedKey
          : fallbackKey;
      setSelectedEventKeyState(nextKey);
      setLoading(false);
    } else if (!token) {
      setLoading(false);
    }

    if (token) {
      void refreshEvents({ silent: cached.length > 0 });
    }

    const intervalId = window.setInterval(() => {
      void refreshEvents({ silent: true });
    }, 60000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const setEventKey = (key: string) => {
    setSelectedEventKey(key);
    setSelectedEventKeyState(key);
    setEventVersion((prev) => prev + 1);
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
        eventVersion,
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
