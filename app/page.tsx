"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { getToken } from "@/lib/auth"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(getToken() ? "/overview" : "/login")
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border/70 bg-card/80">
        <CardContent className="space-y-2 p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Insight
          </p>
          <h1 className="text-xl font-semibold tracking-tight">Opening site</h1>
          <p className="text-sm text-muted-foreground">
            Checking your session and loading the latest event.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
