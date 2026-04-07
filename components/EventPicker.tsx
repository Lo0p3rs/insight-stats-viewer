"use client"

import type { Event } from "@/lib/types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type EventPickerProps = {
  events: Event[]
  selectedEventKey: string | null
  loading: boolean
  onSelect: (key: string) => void
}

export default function EventPicker({
  events,
  selectedEventKey,
  loading,
  onSelect,
}: EventPickerProps) {
  const selectedEvent =
    events.find((event) => event.eventKey === selectedEventKey) ?? null

  return (
    <div className="w-full min-w-[220px] md:w-[320px]">
      <Select
        value={selectedEventKey ?? undefined}
        onValueChange={onSelect}
        disabled={loading || events.length === 0}
      >
        <SelectTrigger className="h-9 border-border/80 bg-muted/20 text-left">
          <SelectValue
            placeholder={loading ? "Loading events..." : "Choose event"}
          >
            {selectedEvent ? `${selectedEvent.name}` : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          {events.map((event) => (
            <SelectItem key={event.eventKey} value={event.eventKey}>
              {event.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
