"use client"

import Link from "next/link"
import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"

import EventPicker from "@/components/EventPicker"
import RetryError from "@/components/RetryError"
import { Button } from "@/components/ui/button"
import { clearToken, getToken } from "@/lib/auth"
import { EventProvider, useEventContext } from "@/lib/event-context"
import { cn } from "@/lib/utils"

function getPageLabel(pathname: string | null) {
  if (!pathname) {
    return "Rankings"
  }

  if (pathname.startsWith("/teams/")) {
    return "Team Profile"
  }

  if (pathname.startsWith("/defenders")) {
    return "Defenders"
  }

  return "Rankings"
}

function ShellFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    selectedEvent,
    events,
    selectedEventKey,
    setEventKey,
    refreshEvents,
    loading,
    error,
  } = useEventContext()

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login")
    }
  }, [router])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-3 px-4 py-3 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Future Martians
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight">Insight</h1>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm text-muted-foreground">
                {getPageLabel(pathname)}
              </span>
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {selectedEvent?.name ?? "Choose an event"}
            </p>
            <nav className="mt-2 flex flex-wrap items-center gap-1">
              {[
                { href: "/overview", label: "Rankings", active: pathname === "/overview" },
                { href: "/defenders", label: "Defenders", active: pathname === "/defenders" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    item.active
                      ? "border-border bg-secondary text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-accent hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <EventPicker
              events={events}
              selectedEventKey={selectedEventKey}
              loading={loading}
              onSelect={setEventKey}
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-9 justify-center border border-border/70 bg-muted/20 text-foreground hover:bg-accent"
              onClick={() => {
                clearToken()
                router.replace("/login")
              }}
            >
              Log out
            </Button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mx-auto w-full max-w-[1560px] px-4 pt-4 md:px-6">
          <RetryError compact error={error} onRetry={() => void refreshEvents()} />
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-[1560px] px-4 py-5 md:px-6 md:py-6">
        {children}
      </main>
    </div>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <EventProvider>
      <ShellFrame>{children}</ShellFrame>
    </EventProvider>
  )
}
