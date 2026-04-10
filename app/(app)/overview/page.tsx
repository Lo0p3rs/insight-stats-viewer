"use client"

import Link from "next/link"
import { ArrowUpDown } from "lucide-react"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchEventTeams, fetchTeamAnalytics, fetchTeamDetail } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { useEventContext } from "@/lib/event-context"
import { formatEventDate, formatPercent } from "@/lib/format"
import {
  getCombinedAccuracy,
  getCombinedApc,
  getCombinedCycles,
} from "@/lib/team-metrics"
import {
  teamAvatarUrl,
  teamDisplayName,
  teamNumberFromKey,
} from "@/lib/team-utils"
import { cn } from "@/lib/utils"
import type { EventTeam, TeamAnalytics, TeamDetail } from "@/lib/types"

type SortKey =
  | "team"
  | "rank"
  | "totalApc"
  | "autoApc"
  | "teleApc"
  | "avgCycles"
  | "avgAccuracy"
  | "defenseScore"

type TeamRow = TeamAnalytics & {
  displayName: string
  teamNumber: number
}

type MetricStatus = "high" | "mid" | "low" | "neutral"

const columns: Array<{
  key: SortKey
  label: string
  numeric?: boolean
  percentileDirection?: "asc" | "desc"
  value: (team: TeamRow) => number | string
  render: (team: TeamRow) => React.ReactNode
}> = [
  {
    key: "team",
    label: "Team",
    value: (team) => team.teamNumber,
    render: (team) => (
      <Link href={`/teams/${team.teamKey}`} className="flex min-w-[220px] items-center gap-3">
        <img
          className="h-8 w-8 rounded-md border border-border/80 bg-muted/20 object-cover"
          src={teamAvatarUrl(team.teamKey)}
          alt=""
          loading="lazy"
        />
        <div className="min-w-0">
          <div className="font-medium leading-none">{team.teamNumber}</div>
          <div className="truncate text-xs text-muted-foreground">
            {team.displayName || `Team ${team.teamNumber}`}
          </div>
        </div>
      </Link>
    ),
  },
  {
    key: "rank",
    label: "Rank",
    numeric: true,
    percentileDirection: "asc",
    value: (team) => team.tba.rank || Number.POSITIVE_INFINITY,
    render: (team) => <span>{team.tba.rank > 0 ? `#${team.tba.rank}` : "-"}</span>,
  },
  {
    key: "totalApc",
    label: "Total APC",
    numeric: true,
    percentileDirection: "desc",
    value: (team) => getCombinedApc(team),
    render: (team) => <span>{getCombinedApc(team).toFixed(1)}</span>,
  },
  {
    key: "autoApc",
    label: "Auto APC",
    numeric: true,
    percentileDirection: "desc",
    value: (team) => team.robot.autoFuelApc,
    render: (team) => <span>{team.robot.autoFuelApc.toFixed(1)}</span>,
  },
  {
    key: "teleApc",
    label: "Tele APC",
    numeric: true,
    percentileDirection: "desc",
    value: (team) => team.robot.teleFuelApc,
    render: (team) => <span>{team.robot.teleFuelApc.toFixed(1)}</span>,
  },
  {
    key: "avgCycles",
    label: "Avg Cycles",
    numeric: true,
    percentileDirection: "desc",
    value: (team) => getCombinedCycles(team),
    render: (team) => <span>{getCombinedCycles(team).toFixed(1)}</span>,
  },
  {
    key: "avgAccuracy",
    label: "Avg Accuracy",
    numeric: true,
    percentileDirection: "desc",
    value: (team) => getCombinedAccuracy(team),
    render: (team) => <span>{formatPercent(getCombinedAccuracy(team))}</span>,
  },
  {
    key: "defenseScore",
    label: "Defense",
    numeric: true,
    percentileDirection: "desc",
    value: (team) => team.robot.defenseScore,
    render: (team) => <span>{team.robot.defenseScore.toFixed(1)}</span>,
  },
]

function getDefaultDirection(key: SortKey) {
  return key === "team" || key === "rank" ? "asc" : "desc"
}

function buildNameMap(eventTeams: EventTeam[]) {
  return Object.fromEntries(
    eventTeams.map((team) => [team.teamKey, teamDisplayName(team.name)])
  )
}

function getMetricStatus(percentile: number | null): MetricStatus {
  if (percentile === null) return "neutral"
  if (percentile >= 75) return "high"
  if (percentile >= 30) return "mid"
  return "low"
}

function getMetricStatusClass(status: MetricStatus) {
  switch (status) {
    case "high":
      return "bg-emerald-500"
    case "mid":
      return "bg-amber-400"
    case "low":
      return "bg-red-500"
    default:
      return "bg-zinc-700"
  }
}

type CsvValue = string | number | boolean | null | undefined

function escapeCsvValue(value: CsvValue) {
  if (value === null || value === undefined) return ""
  const normalized = String(value)
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`
  }
  return normalized
}

function buildCsv(headers: string[], records: Array<Record<string, CsvValue>>) {
  const lines = [
    headers.join(","),
    ...records.map((record) => headers.map((header) => escapeCsvValue(record[header])).join(",")),
  ]
  return lines.join("\n")
}

function buildTeamNotesText(teamAnalytics: TeamAnalytics | null) {
  if (!teamAnalytics || teamAnalytics.robot.scoutNotes.length === 0) return ""
  return [...teamAnalytics.robot.scoutNotes]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .map((note) => {
      const context = note.matchKey ? `${note.createdAt} ${note.matchKey}` : note.createdAt
      return `[${context}] ${note.content}`
    })
    .join(" | ")
}

function calculateMatchFuel(cycleCount: number, fuelCountAvg: number | null) {
  return cycleCount * (fuelCountAvg ?? 0)
}

export default function OverviewPage() {
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
  const [sortKey, setSortKey] = useState<SortKey>("rank")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [exporting, setExporting] = useState(false)

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

  const rows = useMemo(() => {
    const nameByTeamKey = buildNameMap(eventTeams)

    return teams.map((team) => ({
      ...team,
      displayName:
        teamDisplayName(nameByTeamKey[team.teamKey]) ||
        teamDisplayName(team.name) ||
        "",
      teamNumber: Number(teamNumberFromKey(team.teamKey)),
    }))
  }, [eventTeams, teams])

  const activeColumn = columns.find((column) => column.key === sortKey) ?? columns[0]

  const sortedRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const leftValue = activeColumn.value(left)
      const rightValue = activeColumn.value(right)

      if (typeof leftValue === "string" || typeof rightValue === "string") {
        const comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
          sensitivity: "base",
          numeric: true,
        })
        return sortDir === "asc" ? comparison : -comparison
      }

      const comparison = Number(leftValue) - Number(rightValue)
      return sortDir === "asc" ? comparison : -comparison
    })
  }, [activeColumn, rows, sortDir])

  const metricStatuses = useMemo(() => {
    const statuses: Partial<Record<SortKey, Record<string, MetricStatus>>> = {}

    columns.forEach((column) => {
      if (!column.numeric || !column.percentileDirection) return

      const values = rows
        .map((row) => ({
          teamKey: row.teamKey,
          value: column.value(row),
        }))
        .filter(
          (entry): entry is { teamKey: string; value: number } =>
            typeof entry.value === "number" && Number.isFinite(entry.value)
        )

      statuses[column.key] = Object.fromEntries(
        values.map((entry) => {
          const betterOrEqualCount = values.filter((other) =>
            column.percentileDirection === "desc"
              ? other.value <= entry.value
              : other.value >= entry.value
          ).length

          const percentile = values.length > 0 ? (betterOrEqualCount / values.length) * 100 : null

          return [entry.teamKey, getMetricStatus(percentile)]
        })
      )
    })

    return statuses
  }, [rows])

  const averageTotalApc =
    rows.length > 0 ? rows.reduce((sum, team) => sum + getCombinedApc(team), 0) / rows.length : 0
  const averageAccuracy =
    rows.length > 0
      ? rows.reduce((sum, team) => sum + getCombinedAccuracy(team), 0) / rows.length
      : 0
  const averageDefense =
    rows.length > 0
      ? rows.reduce((sum, team) => sum + team.robot.defenseScore, 0) / rows.length
      : 0

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"))
      return
    }

    setSortKey(key)
    setSortDir(getDefaultDirection(key))
  }

  const handleExportCsv = async () => {
    const token = getToken()
    if (!token || !selectedEventKey || exporting) return

    const teamKeys =
      eventTeams.length > 0
        ? eventTeams.map((team) => team.teamKey)
        : Array.from(new Set(teams.map((team) => team.teamKey)))
    if (teamKeys.length === 0) return

    setExporting(true)
    setError(null)

    try {
      const overviewByTeamKey = new Map(teams.map((team) => [team.teamKey, team]))
      const detailResults = await Promise.allSettled(
        teamKeys.map((teamKey) => fetchTeamDetail(token, teamKey, selectedEventKey))
      )
      const details: TeamDetail[] = detailResults
        .filter((result): result is PromiseFulfilledResult<TeamDetail> => result.status === "fulfilled")
        .map((result) => result.value)
      const failedCount = detailResults.length - details.length

      if (details.length === 0) {
        throw new Error(
          `Failed to fetch team details for export (0/${detailResults.length} successful). Please try again.`
        )
      }

      const headers = [
        "event_key",
        "team_key",
        "team_number",
        "team_name",
        "rank",
        "wins",
        "losses",
        "ties",
        "total_apc",
        "auto_apc",
        "tele_apc",
        "avg_cycles",
        "avg_accuracy",
        "defense_score",
        "team_note_count",
        "team_notes",
        "export_status",
        "match_key",
        "match_level",
        "match_number",
        "set_number",
        "match_auto_fuel",
        "match_tele_fuel",
        "match_defense_score",
        "match_failures",
        "match_auto_path",
        "match_notes",
        "match_defense_notes",
      ]

      const records: Array<Record<string, CsvValue>> = []

      details.forEach((detail) => {
        const overview =
          overviewByTeamKey.get(detail.teamKey) ??
          detail.overviews.find((entry) => entry.eventKey === selectedEventKey) ??
          detail.overviews[0] ??
          null
        const teamNumber = teamNumberFromKey(detail.teamKey)
        const teamName = overview?.name ?? eventTeams.find((entry) => entry.teamKey === detail.teamKey)?.name ?? ""
        const teamNotes = buildTeamNotesText(overview)
        const matches = [...detail.matches]
          .filter((match) => match.eventKey === selectedEventKey)
          .sort((left, right) => left.matchSort - right.matchSort)

        const overviewFields = {
          event_key: selectedEventKey,
          team_key: detail.teamKey,
          team_number: teamNumber,
          team_name: teamDisplayName(teamName),
          rank: overview?.tba.rank ?? "",
          wins: overview?.tba.wins ?? "",
          losses: overview?.tba.losses ?? "",
          ties: overview?.tba.ties ?? "",
          total_apc: overview ? getCombinedApc(overview).toFixed(2) : "",
          auto_apc: overview ? overview.robot.autoFuelApc.toFixed(2) : "",
          tele_apc: overview ? overview.robot.teleFuelApc.toFixed(2) : "",
          avg_cycles: overview ? getCombinedCycles(overview).toFixed(2) : "",
          avg_accuracy: overview ? getCombinedAccuracy(overview).toFixed(2) : "",
          defense_score: overview ? overview.robot.defenseScore.toFixed(2) : "",
          team_note_count: overview?.robot.scoutNotes.length ?? 0,
          team_notes: teamNotes,
          export_status: failedCount > 0 ? `Warning: ${failedCount} teams failed to fetch` : "",
        }

        if (matches.length === 0) {
          records.push({
            ...overviewFields,
            match_key: "",
            match_level: "",
            match_number: "",
            set_number: "",
            match_auto_fuel: "",
            match_tele_fuel: "",
            match_defense_score: "",
            match_failures: "",
            match_auto_path: "",
            match_notes: "",
            match_defense_notes: "",
          })
          return
        }

        matches.forEach((match) => {
          records.push({
            ...overviewFields,
            match_key: match.matchKey,
            match_level: match.level,
            match_number: match.matchNumber,
            set_number: match.setNumber,
            match_auto_fuel: match.robot
              ? calculateMatchFuel(
                  match.robot.auto.cycles.cycleCount,
                  match.robot.auto.cycles.fuelCountAvg
                ).toFixed(2)
              : "",
            match_tele_fuel: match.robot
              ? calculateMatchFuel(
                  match.robot.tele.cycles.cycleCount,
                  match.robot.tele.cycles.fuelCountAvg
                ).toFixed(2)
              : "",
            match_defense_score: match.robot ? match.robot.defense.calculatedScore.toFixed(2) : "",
            match_failures: match.robot ? match.robot.failures.count : "",
            match_auto_path: match.robot?.autoPath ?? "",
            match_notes: match.robot?.notes ?? "",
            match_defense_notes: match.robot?.defenseNotes ?? "",
          })
        })
      })

      const csv = buildCsv(headers, records)
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = `${selectedEventKey}-event-export.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (exportError) {
      setError(exportError)
    } finally {
      setExporting(false)
    }
  }

  const pageLoading = eventLoading || loading

  return (
    <div className="space-y-5">
      <Card className="border-border/70 bg-card/90">
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono tracking-[0.14em]">
                Rankings
              </Badge>
            </div>
            <CardTitle className="text-2xl tracking-tight">
              {selectedEvent?.name ?? "Choose an event"}
            </CardTitle>
            <CardDescription>
              {selectedEvent
                ? `${selectedEvent.eventKey} • ${formatEventDate(selectedEvent.startDate)}`
                : "Choose an event from the top bar to load team rankings."}
            </CardDescription>
          </div>

          <div className="space-y-3">
            <div className="flex justify-end">
              <Button type="button" variant="outline" disabled={pageLoading || rows.length === 0 || exporting} onClick={handleExportCsv}>
                {exporting ? "Exporting..." : "Export event CSV"}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Teams
                </div>
                <div className="mt-2 font-mono text-lg font-semibold">{rows.length}</div>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Avg total APC
                </div>
                <div className="mt-2 font-mono text-lg font-semibold">{averageTotalApc.toFixed(1)}</div>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Avg accuracy
                </div>
                <div className="mt-2 font-mono text-lg font-semibold">{formatPercent(averageAccuracy)}</div>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Avg defense
                </div>
                <div className="mt-2 font-mono text-lg font-semibold">{averageDefense.toFixed(1)}</div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!pageLoading && !selectedEventKey ? (
        <Card className="border-dashed border-border/80 bg-muted/20">
          <CardContent className="p-6">
            <p className="font-medium">No event selected.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick an event from the top bar to load the overview table.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {pageLoading ? (
        <Card className="border-border/70 bg-card/90">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Loading rankings...
          </CardContent>
        </Card>
      ) : null}

      {!pageLoading && error ? (
        <RetryError error={error} onRetry={() => setReloadNonce((value) => value + 1)} />
      ) : null}

      {!pageLoading && !error && selectedEventKey ? (
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle className="text-base tracking-tight">Event rankings</CardTitle>
                <CardDescription>
                  Team performance rankings for the selected event.
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
                  Key
                </span>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500" />
                  <span>75th-100th</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-amber-400" />
                  <span>30th-74th</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-red-500" />
                  <span>Below 30th</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sortedRows.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                No team rankings are available for this event.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow className="border-border/80 hover:bg-transparent">
                      {columns.map((column) => (
                        <TableHead
                          key={column.key}
                          className={cn(column.numeric && "text-right")}
                        >
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
                              column.numeric && "justify-end"
                            )}
                            onClick={() => handleSort(column.key)}
                          >
                            <span>{column.label}</span>
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((team) => (
                      <TableRow key={team.teamKey}>
                        {columns.map((column) => (
                          <TableCell
                            key={column.key}
                            className={cn(
                              "py-2.5",
                              column.numeric &&
                                "text-right font-mono text-[13px] text-foreground"
                            )}
                          >
                            {column.numeric ? (
                              <div className="inline-flex items-center justify-end gap-2">
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "h-2.5 w-2.5 rounded-[2px]",
                                    getMetricStatusClass(
                                      metricStatuses[column.key]?.[team.teamKey] ?? "neutral"
                                    )
                                  )}
                                />
                                {column.render(team)}
                              </div>
                            ) : (
                              column.render(team)
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
