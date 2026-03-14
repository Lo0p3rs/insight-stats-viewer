'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken, getToken } from '@/lib/auth';
import { EventProvider, useEventContext } from '@/lib/event-context';

const navItems = [{ label: 'Overview', href: '/overview' }];

function ShellFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [eventQuery, setEventQuery] = useState('');
  const { events, selectedEvent, selectedEventKey, setEventKey, loading, error } =
    useEventContext();

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    }
  }, [router]);

  const pageTitle = pathname?.startsWith('/teams') ? 'Team Detail' : 'Overview';
  const normalizedQuery = eventQuery.trim().toLowerCase();
  const filteredEvents = normalizedQuery
    ? events.filter((event) => {
        const name = event.name.toLowerCase();
        const key = event.eventKey.toLowerCase();
        return name.includes(normalizedQuery) || key.includes(normalizedQuery);
      })
    : events;

  const handleLogout = () => {
    clearToken();
    router.replace('/login');
  };

  return (
    <div className="app-shell">
      <aside className={`nav ${navOpen ? 'open' : ''}`}>
        <div className="nav-header">
          <div className="nav-title">Insight</div>
          <label className="helper-text">Event</label>
          <input
            className="event-search"
            placeholder="Search events"
            value={eventQuery}
            onChange={(event) => setEventQuery(event.target.value)}
          />
          <select
            value={selectedEventKey ?? ''}
            onChange={(event) => {
              if (event.target.value) {
                setEventKey(event.target.value);
              }
            }}
          >
            {loading ? (
              <option value="">Loading events...</option>
            ) : null}
            {!loading && filteredEvents.length === 0 ? (
              <option value="">
                {events.length === 0 ? 'No events found' : 'No matching events'}
              </option>
            ) : null}
            {filteredEvents.map((event) => (
              <option key={event.eventKey} value={event.eventKey}>
                {event.name}
              </option>
            ))}
          </select>
          {error ? <div className="error">{error}</div> : null}
        </div>
        <nav className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={`nav-link ${pathname === item.href ? 'active' : ''}`}
              href={item.href}
              onClick={() => setNavOpen(false)}
            >
              <span>{item.label}</span>
              <span>{'>'}</span>
            </Link>
          ))}
        </nav>
        <div className="nav-footer">
          <button className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      <div className="content">
        <div className="topbar">
          <button className="menu-toggle" onClick={() => setNavOpen(true)}>
            Menu
          </button>
          <div className="topbar-title">{pageTitle}</div>
          {selectedEvent ? (
            <div className="topbar-pill">{selectedEvent.name}</div>
          ) : null}
          <div className="topbar-spacer" />
          <button className="btn btn-secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
        <main>{children}</main>
      </div>

      {navOpen ? (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <EventProvider>
      <ShellFrame>{children}</ShellFrame>
    </EventProvider>
  );
}
