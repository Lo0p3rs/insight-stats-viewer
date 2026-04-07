"use client"

import Link from "next/link"
import { ChevronDown, ChevronUp, FilterX, Shield } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import RetryError from "@/components/RetryError"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchEventTeams, fetchTeamAnalytics } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { useEventContext } from "@/lib/event-context"
import { formatEventDate } from "@/lib/format"
import { formatMatchLabel, hasSummaryContent } from "@/lib/team-metrics"
import { teamAvatarUrl, teamDisplayName, teamNumberFromKey } from "@/lib/team-utils"
import { cn } from "@/lib/utils"
import type {
  EventTeam,
  TeamAnalytics,
  TeamSummaryDefenseEffectiveness,
  TeamSummaryDefenseItem,
  TeamSummaryDriverQuality,
  TeamSummaryFoulRisk,
} from "@/lib/types"

const allFilterValue = "__all__"

type FilterState = {
  strategy: string
  impact: string
  driver: string
  foulRisk: string
}

type DefenderRow = TeamAnalytics & {
  displayName: string
  teamNumber: number
  patterns: TeamSummaryDefenseItem[]
}

type VisibleDefenderRow = DefenderRow & {
  visiblePatterns: TeamSummaryDefenseItem[]
}

function titleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ")
}

function buildNameMap(eventTeams: EventTeam[]) {
  return Object.fromEntries(
    eventTeams.map((team) => [team.teamKey, teamDisplayName(team.name)])
  )
}

function collectOptions(
  teams: DefenderRow[],
  selector: (item: TeamSummaryDefenseItem) => string,
  options?: {
    preferredOrder?: string[]
    alphabetical?: boolean
  }
) {
  const values = teams
    .flatMap((team) => team.patterns)
    .map(selector)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)

  if (options?.preferredOrder) {
    return values.sort((left, right) => {
      const leftIndex = options.preferredOrder!.indexOf(left)
      const rightIndex = options.preferredOrder!.indexOf(right)

      if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right)
      if (leftIndex === -1) return 1
      if (rightIndex === -1) return -1
      return leftIndex - rightIndex
    })
  }

  if (options?.alphabetical) {
    return values.sort((left, right) => left.localeCompare(right))
  }

  return values
}

function getVisiblePatterns(team: DefenderRow, filters: FilterState, hasActiveFilters: boolean) {
  if (!hasActiveFilters) {
    return team.patterns
  }

  return team.patterns.filter((item) => {
    return (
      (filters.strategy === allFilterValue || item.strategy === filters.strategy) &&
      (filters.impact === allFilterValue || item.defenseEffectiveness === filters.impact) &&
      (filters.driver === allFilterValue || item.driverQuality === filters.driver) &&
      (filters.foulRisk === allFilterValue || item.foulRisk === filters.foulRisk)
    )
  })
}

function phaseLabel(phase: TeamSummaryDefenseItem["whenUsed"]["matchPhase"]) {
  switch (phase) {
    case "auto":
      return "Auto"
    case "teleop_early":
      return "Tele Early"
    case "teleop_mid":
      return "Tele Mid"
    case "teleop_late":
      return "Tele Late"
    case "endgame":
      return "Endgame"
    default:
      return null
  }
}

function patternMetaText(item: TeamSummaryDefenseItem) {
  const parts: string[] = []
  const phase = phaseLabel(item.whenUsed.matchPhase)
  if (phase) {
    parts.push(phase)
  }

  if (item.whenUsed.situation?.trim()) {
    parts.push(item.whenUsed.situation.trim())
  }

  if (item.supportingMatches.length > 0) {
    const shownMatches = item.supportingMatches
      .slice(0, 2)
      .map((matchKey) => formatMatchLabel(matchKey))
      .join(", ")

    if (shownMatches) {
      const remaining = item.supportingMatches.length - 2
      parts.push(remaining > 0 ? `${shownMatches} +${remaining}` : shownMatches)
    }
  }

  if (item.confidence) {
    parts.push(`Confidence ${titleCase(item.confidence)}`)
  }

  return parts.length > 0 ? parts.join(" • ") : null
}

function scoreTone(score: number) {
  if (score >= 6.67) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
  }
  if (score >= 3.34) {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200"
  }
  return "border-red-500/25 bg-red-500/10 text-red-300"
}

function effectivenessTone(value: TeamSummaryDefenseEffectiveness | TeamSummaryDriverQuality) {
  switch (value) {
    case "elite":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
    case "good":
      return "border-lime-500/25 bg-lime-500/10 text-lime-300"
    case "mixed":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200"
    case "poor":
      return "border-red-500/25 bg-red-500/10 text-red-300"
    default:
      return "border-border bg-muted/30 text-muted-foreground"
  }
}

function foulRiskTone(value: TeamSummaryFoulRisk) {
  switch (value) {
    case "low":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
    case "medium":
      return "border-amber-400/25 bg-amber-400/10 text-amber-200"
    case "high":
      return "border-red-500/25 bg-red-500/10 text-red-300"
    default:
      return "border-border bg-muted/30 text-muted-foreground"
  }
}

function FilterField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (nextValue: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 bg-background">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={allFilterValue}>All {label.toLowerCase()}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {titleCase(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function DefendersPage() {
  const {
    selectedEvent,
    selectedEventKey,
    eventVersion,
    loading: eventLoading,
  } = useEventContext()
  const [teams, setTeams] = useState<TeamAnalytics[]>([])
  const [eventTeams, setEventTeams] = useState<EventTeam[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [filtersExpanded, setFiltersExpanded] = useState(true)
  const [showOnlyTeamsWithSummary, setShowOnlyTeamsWithSummary] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    strategy: allFilterValue,
    impact: allFilterValue,
    driver: allFilterValue,
    foulRisk: allFilterValue,
  })

  useEffect(() => {
    if (eventLoading) return

    const token = getToken()
    if (!selectedEventKey || !token) {
      setTeams([])
      setEventTeams([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      fetchTeamAnalytics(token, selectedEventKey),
      fetchEventTeams(token, selectedEventKey),
    ])
      .then(([teamAnalytics, eventTeamList]) => {
        if (cancelled) return
        setTeams(teamAnalytics)
        setEventTeams(eventTeamList)
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [eventLoading, eventVersion, reloadNonce, selectedEventKey])

  useEffect(() => {
    setShowOnlyTeamsWithSummary(false)
    setFiltersExpanded(true)
    setFilters({
      strategy: allFilterValue,
      impact: allFilterValue,
      driver: allFilterValue,
      foulRisk: allFilterValue,
    })
  }, [selectedEventKey])

  const rows = useMemo(() => {
    const nameByTeamKey = buildNameMap(eventTeams)

    return teams.map((team) => ({
      ...team,
      displayName:
        teamDisplayName(nameByTeamKey[team.teamKey]) ||
        teamDisplayName(team.name) ||
        "",
      teamNumber: Number(teamNumberFromKey(team.teamKey)),
      patterns: team.summary?.defense ?? [],
    }))
  }, [eventTeams, teams])

  const hasActiveFilters =
    showOnlyTeamsWithSummary ||
    filters.strategy !== allFilterValue ||
    filters.impact !== allFilterValue ||
    filters.driver !== allFilterValue ||
    filters.foulRisk !== allFilterValue

  const strategyOptions = useMemo(
    () => collectOptions(rows, (item) => item.strategy, { alphabetical: true }),
    [rows]
  )
  const impactOptions = useMemo(
    () =>
      collectOptions(rows, (item) => item.defenseEffectiveness, {
        preferredOrder: ["elite", "good", "mixed", "poor", "unknown"],
      }),
    [rows]
  )
  const driverOptions = useMemo(
    () =>
      collectOptions(rows, (item) => item.driverQuality, {
        preferredOrder: ["elite", "good", "mixed", "poor", "unknown"],
      }),
    [rows]
  )
  const foulRiskOptions = useMemo(
    () =>
      collectOptions(rows, (item) => item.foulRisk, {
        preferredOrder: ["low", "medium", "high", "unknown"],
      }),
    [rows]
  )

  const filteredTeams = useMemo<VisibleDefenderRow[]>(() => {
    return rows
      .map((team) => ({
        ...team,
        visiblePatterns: getVisiblePatterns(team, filters, hasActiveFilters),
      }))
      .filter((team) => {
        if (showOnlyTeamsWithSummary && !hasSummaryContent(team.summary)) {
          return false
        }

        return !hasActiveFilters || team.visiblePatterns.length > 0
      })
      .sort((left, right) => {
        const scoreComparison = right.robot.defenseScore - left.robot.defenseScore
        if (scoreComparison !== 0) return scoreComparison
        return left.teamNumber - right.teamNumber
      })
  }, [filters, hasActiveFilters, rows, showOnlyTeamsWithSummary])

  const pageLoading = eventLoading || loading
  const teamsWithPatterns = rows.filter((team) => team.patterns.length > 0).length
  const averageDefense =
    rows.length > 0
      ? rows.reduce((sum, team) => sum + team.robot.defenseScore, 0) / rows.length
      : 0

  if (!pageLoading && !selectedEventKey) {
    return (
      <Card className="border-dashed border-border/80 bg-muted/20">
        <CardContent className="p-6">
          <p className="font-medium">No event selected.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose an event from the top bar to load defenders.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (pageLoading) {
    return (
      <Card className="border-border/70 bg-card/90">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Loading defenders...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return <RetryError error={error} onRetry={() => setReloadNonce((value) => value + 1)} />
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/70 bg-card/90">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono tracking-[0.14em]">
                Defenders
              </Badge>
            </div>
            <CardTitle className="text-2xl tracking-tight">
              {selectedEvent?.name ?? "Choose an event"}
            </CardTitle>
            <CardDescription>
              {selectedEvent
                ? `${selectedEvent.eventKey} • ${formatEventDate(selectedEvent.startDate)}`
                : "Choose an event from the top bar to explore defensive teams."}
            </CardDescription>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Teams
              </div>
              <div className="mt-2 font-mono text-lg font-semibold">{rows.length}</div>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                With patterns
              </div>
              <div className="mt-2 font-mono text-lg font-semibold">{teamsWithPatterns}</div>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Avg defense
              </div>
              <div className="mt-2 font-mono text-lg font-semibold">
                {averageDefense.toFixed(1)}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card className="border-border/70 bg-card/90">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Filters</Badge>
                {hasActiveFilters ? (
                  <Badge variant="outline">{filteredTeams.length} teams match</Badge>
                ) : (
                  <Badge variant="outline">Sorted by defense score</Badge>
                )}
              </div>
              <CardTitle className="mt-2 text-lg">Defensive Style Filters</CardTitle>
              <CardDescription className="mt-1">
                Narrow teams by defensive strategy, impact, driver quality, and foul risk.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={showOnlyTeamsWithSummary ? "default" : "outline"}
                onClick={() => setShowOnlyTeamsWithSummary((current) => !current)}
              >
                Written summaries only
              </Button>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowOnlyTeamsWithSummary(false)
                    setFilters({
                      strategy: allFilterValue,
                      impact: allFilterValue,
                      driver: allFilterValue,
                      foulRisk: allFilterValue,
                    })
                  }}
                >
                  <FilterX className="mr-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setFiltersExpanded((current) => !current)}
                aria-label={filtersExpanded ? "Collapse filters" : "Expand filters"}
              >
                {filtersExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        {filtersExpanded ? (
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FilterField
              label="Strategy"
              value={filters.strategy}
              options={strategyOptions}
              onChange={(nextValue) =>
                setFilters((current) => ({ ...current, strategy: nextValue }))
              }
            />
            <FilterField
              label="Impact"
              value={filters.impact}
              options={impactOptions}
              onChange={(nextValue) =>
                setFilters((current) => ({ ...current, impact: nextValue }))
              }
            />
            <FilterField
              label="Driver"
              value={filters.driver}
              options={driverOptions}
              onChange={(nextValue) =>
                setFilters((current) => ({ ...current, driver: nextValue }))
              }
            />
            <FilterField
              label="Foul risk"
              value={filters.foulRisk}
              options={foulRiskOptions}
              onChange={(nextValue) =>
                setFilters((current) => ({ ...current, foulRisk: nextValue }))
              }
            />
          </CardContent>
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          {filteredTeams.length} team{filteredTeams.length === 1 ? "" : "s"}{" "}
          {hasActiveFilters ? "match the current filters" : "ranked by defense score"}
        </p>
        <Badge variant="outline">High to low</Badge>
      </div>

      {filteredTeams.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-muted/20">
          <CardContent className="flex min-h-[180px] flex-col items-center justify-center gap-3 p-6 text-center">
            <Shield className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="font-medium">No teams match the current filters.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Clear one or more filters to see more teams.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredTeams.map((team) => (
            <Card key={team.teamKey} className="border-border/70 bg-card/90">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  <img
                    className="h-12 w-12 rounded-xl border border-border/80 bg-muted/20 object-cover"
                    src={teamAvatarUrl(team.teamKey)}
                    alt=""
                    loading="lazy"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/teams/${team.teamKey}`}
                        className="text-lg font-semibold tracking-tight hover:text-primary"
                      >
                        Team {team.teamNumber}
                      </Link>
                      <Badge variant="outline">#{team.tba.rank || "-"}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {team.displayName || `Team ${team.teamNumber}`}
                    </p>
                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {team.visiblePatterns.length > 0
                        ? `${team.visiblePatterns.length} pattern${team.visiblePatterns.length === 1 ? "" : "s"}${hasActiveFilters ? " matched" : ""}`
                        : "No defensive patterns available"}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "min-w-[76px] rounded-xl border px-3 py-2 text-center",
                      scoreTone(team.robot.defenseScore)
                    )}
                  >
                    <p className="font-mono text-base font-semibold">
                      {Math.max(0, Math.min(10, team.robot.defenseScore)).toFixed(1)}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em]">
                      Defense
                    </p>
                  </div>
                </div>

                {team.visiblePatterns.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-4 text-sm text-muted-foreground">
                    A defensive summary is not available for this team yet.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {team.visiblePatterns.map((pattern, index) => {
                      const metaText = patternMetaText(pattern)

                      return (
                        <div
                          key={`${team.teamKey}-${pattern.strategy}-${index}`}
                          className="rounded-lg border border-border/80 bg-muted/20 p-3"
                        >
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-300">
                              {titleCase(pattern.strategy)}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                effectivenessTone(pattern.defenseEffectiveness)
                              )}
                            >
                              Impact {titleCase(pattern.defenseEffectiveness)}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                effectivenessTone(pattern.driverQuality)
                              )}
                            >
                              Driver {titleCase(pattern.driverQuality)}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                foulRiskTone(pattern.foulRisk)
                              )}
                            >
                              Risk {titleCase(pattern.foulRisk)}
                            </span>
                          </div>

                          {pattern.description.trim() ? (
                            <p className="mt-3 text-sm leading-5 text-foreground/90">
                              {pattern.description.trim()}
                            </p>
                          ) : null}

                          {metaText ? (
                            <p className="mt-3 text-xs font-medium text-muted-foreground">
                              {metaText}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/70 pt-3">
                  <div className="text-xs text-muted-foreground">
                    Record {team.tba.wins}-{team.tba.losses}-{team.tba.ties}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/teams/${team.teamKey}`}>View team</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
