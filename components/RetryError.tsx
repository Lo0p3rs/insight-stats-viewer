"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { mapErrorToMessage } from "@/lib/errors"

type RetryErrorProps = {
  error: unknown
  onRetry: () => void
  compact?: boolean
}

export default function RetryError({
  error,
  onRetry,
  compact = false,
}: RetryErrorProps) {
  return (
    <Card className="border-destructive/30 bg-destructive/10">
      <CardContent
        className={
          compact
            ? "flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
            : "flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between"
        }
      >
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {compact ? "Unable to load data" : "Something went wrong"}
            </p>
            <p className="text-sm text-muted-foreground">
              {mapErrorToMessage(error)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  )
}
