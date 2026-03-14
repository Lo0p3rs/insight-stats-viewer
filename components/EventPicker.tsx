'use client';

import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { formatEventDate } from '@/lib/format';
import type { Event } from '@/lib/types';

type EventPickerProps = {
  events: Event[];
  selectedEventKey: string | null;
  loading: boolean;
  onSelect: (key: string) => void;
};

export default function EventPicker({
  events,
  selectedEventKey,
  loading,
  onSelect,
}: EventPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedEvent =
    events.find((event) => event.eventKey === selectedEventKey) ?? null;

  const filteredEvents = deferredQuery
    ? events.filter((event) => {
        const name = event.name.toLowerCase();
        const key = event.eventKey.toLowerCase();
        return name.includes(deferredQuery) || key.includes(deferredQuery);
      })
    : events;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  return (
    <div className={`event-picker ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="event-picker-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="event-picker-label">Current Event</span>
        <strong>
          {selectedEvent?.name ?? (loading ? 'Loading events...' : 'Select event')}
        </strong>
        <span className="event-picker-meta">
          {selectedEvent
            ? `${selectedEvent.eventKey} • ${formatEventDate(selectedEvent.startDate)}`
            : 'Choose from the event list'}
        </span>
      </button>

      {open ? (
        <div className="event-picker-popover" role="dialog" aria-label="Select event">
          <input
            ref={inputRef}
            className="event-picker-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events"
          />

          <div className="event-picker-results">
            {filteredEvents.length === 0 ? (
              <div className="event-option-empty">No events found</div>
            ) : (
              filteredEvents.map((event) => (
                <button
                  key={event.eventKey}
                  type="button"
                  className={`event-option ${
                    event.eventKey === selectedEventKey ? 'active' : ''
                  }`}
                  onClick={() => {
                    onSelect(event.eventKey);
                    setOpen(false);
                  }}
                >
                  <span className="event-option-name">{event.name}</span>
                  <span className="event-picker-meta">
                    {event.eventKey} • {formatEventDate(event.startDate)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
