'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import EventPicker from '@/components/EventPicker';
import RetryError from '@/components/RetryError';
import { clearToken, getToken } from '@/lib/auth';
import { EventProvider, useEventContext } from '@/lib/event-context';

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const {
    events,
    selectedEvent,
    selectedEventKey,
    setEventKey,
    refreshEvents,
    loading,
    error,
  } = useEventContext();

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    }
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncViewport = () => {
      setIsMobileViewport(window.innerWidth <= 960);
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);

    return () => {
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const toggleNavigation = () => {
    if (isMobileViewport) {
      setNavOpen((value) => !value);
      return;
    }

    setNavCollapsed((value) => !value);
  };

  const closeNavigation = () => {
    if (isMobileViewport) {
      setNavOpen(false);
      return;
    }

    setNavCollapsed(true);
  };

  const onTeamPage = pathname?.startsWith('/teams/') ?? false;
  const onAnalysisPage = pathname === '/analysis';
  const onComparePage = pathname === '/compare';
  const pageTitle = onTeamPage
    ? 'Team'
    : onAnalysisPage
      ? 'Analysis'
      : onComparePage
        ? 'Compare'
        : 'Overview';
  const menuButtonLabel = isMobileViewport
    ? navOpen
      ? 'Close'
      : 'Menu'
    : navCollapsed
      ? 'Menu'
      : 'Hide';

  return (
    <div className={`app-shell ${navCollapsed ? 'nav-collapsed' : ''}`}>
      <aside
        className={`nav ${navOpen ? 'open' : ''} ${
          navCollapsed ? 'nav-desktop-hidden' : ''
        }`}
      >
        <div className="nav-header">
          <div>
            <div className="nav-eyebrow">Future Martians</div>
            <div className="nav-title">InSight</div>
          </div>
          {isMobileViewport ? (
            <button
              type="button"
              className="nav-close"
              onClick={closeNavigation}
              aria-label="Close navigation"
            >
              <span className="nav-close-icon" aria-hidden="true">
                ×
              </span>
              <span className="nav-close-copy">Close</span>
            </button>
          ) : null}
        </div>

        <section className="nav-section nav-section-emphasis">
          <div className="nav-section-heading">
            <span className="nav-section-title">Event</span>
            <span className="nav-section-value">{events.length} loaded</span>
          </div>
          <EventPicker
            events={events}
            selectedEventKey={selectedEventKey}
            loading={loading}
            onSelect={setEventKey}
          />
          {error ? (
            <RetryError
              compact
              error={error}
              onRetry={() => void refreshEvents()}
            />
          ) : null}
        </section>

        <section className="nav-section">
          <div className="nav-section-heading">
            <span className="nav-section-title">Pages</span>
          </div>
          <nav className="nav-links">
            <Link
              href="/overview"
              className={`nav-link ${
                pathname === '/overview' || onTeamPage ? 'active' : ''
              }`}
            >
              <span className="nav-link-copy">
                <strong>Overview</strong>
              </span>
            </Link>
            <Link
              href="/analysis"
              className={`nav-link ${onAnalysisPage ? 'active' : ''}`}
            >
              <span className="nav-link-copy">
                <strong>Analysis</strong>
              </span>
            </Link>
            <Link
              href="/compare"
              className={`nav-link ${onComparePage ? 'active' : ''}`}
            >
              <span className="nav-link-copy">
                <strong>Compare</strong>
              </span>
            </Link>
          </nav>
        </section>

        <div className="nav-footer">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void refreshEvents()}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh events'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              clearToken();
              router.replace('/login');
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="content">
        <header className="workspace-topbar">
          <div className="workspace-heading">
            <button
              type="button"
              className="menu-toggle"
              onClick={toggleNavigation}
              aria-label={menuButtonLabel}
            >
              <span className="menu-toggle-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span className="menu-toggle-copy">
                <strong>{menuButtonLabel}</strong>
              </span>
            </button>
            <div>
              <div className="workspace-title">{pageTitle}</div>
            </div>
          </div>

          <div className="workspace-actions">
            <div className="workspace-badge">
              <span>Event</span>
              <strong>{selectedEvent?.name ?? 'No event selected'}</strong>
              <small>
                {selectedEvent ? selectedEvent.eventKey : 'Select an event'}
              </small>
            </div>
          </div>
        </header>

        <main className="workspace-main">{children}</main>
      </div>

      {navOpen ? (
        <button
          type="button"
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
    </div>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <EventProvider>
      <ShellFrame>{children}</ShellFrame>
    </EventProvider>
  );
}
