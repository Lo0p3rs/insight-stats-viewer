"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { loginWithCode } from "@/lib/api"
import { getToken, setToken } from "@/lib/auth"
import { mapErrorToMessage } from "@/lib/errors"

export default function LoginPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<unknown | null>(null)

  useEffect(() => {
    if (getToken()) {
      router.replace("/overview")
    }
  }, [router])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (code.length !== 6) {
      setError("Enter your 6-character access code.")
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const token = await loginWithCode(code)
      setToken(token)
      router.replace("/overview")
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-xs border-border/80 bg-card shadow-none">
        <CardHeader className="space-y-1.5 pb-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            FM Insight
          </p>
          <CardTitle className="text-xl tracking-tight">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Enter the 6-character access code.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              value={code}
              onChange={(event) =>
                setCode(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6)
                )
              }
              maxLength={6}
              autoComplete="one-time-code"
              inputMode="text"
              autoFocus
              placeholder="ABC123"
              className="h-10 border-border/80 bg-background text-center font-mono text-base tracking-[0.3em]"
            />

            {error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {mapErrorToMessage(error)}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Verifying..." : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
