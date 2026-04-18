"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import RetryError from "@/components/RetryError"
import TrendChart from "@/components/TrendChart"
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
import { fetchEventTeams, fetchScouts, fetchTeamAnalytics, fetchTeamDetail } from "@/lib/api"
import { getToken } from "@/lib/auth"
import { useEventContext } from "@/lib/event-context"
import { formatPercent } from "@/lib/format"
import {
  average,
  computeTeamRanks,
  formatContributionStatus,
  formatMatchLabel,
  formatRank,
  getAutoPathRows,
  getCombinedAccuracy,
  getCombinedApc,
  getCombinedCycles,
  getMatchActualContribution,
  getMatchEstimatedContribution,
  getMedianActualContribution,
  getMedianEstimatedContribution,
  getMostUsedAutoPath,
  getRecentEstimatedContribution,
  getSummaryEvidenceCount,
  getSummaryHeadline,
  getSummaryStatusLabel,
  getTrendMatches,
  hasSummaryContent,
  isHighConfidenceContribution,
  trend,
  trendMetricOptions,
  trendRangeOptions,
  type RankMetricKey,
  type TrendMetricKey,
  type TrendRangeKey,
} from "@/lib/team-metrics"
import {
  resolveTeamDisplayName,
  teamAvatarUrl,
  teamNumberFromKey,
} from "@/lib/team-utils"
import type { EventTeam, Scout, TeamAnalytics, TeamDetail } from "@/lib/types"

type StatItem = {
  label: string
  value: string
  note: string
  rankKey?: RankMetricKey
}

type StatPage = {
  label: string
  items: StatItem[]
}

function formatGeneratedAt(value: string | null) {
  if (!value) return "Unknown"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

function formatNoteDate(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(parsed)
}

function titleCase(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

function buildScoutNameMap(scouts: Scout[]) {
  return Object.fromEntries(scouts.map((scout) => [scout.id, scout.name]))
}

function formatContributionValue(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined ? "—" : value.toFixed(digits)
}

function buildStatPages(team: TeamAnalytics): StatPage[] {
  const autoEstimated = getRecentEstimatedContribution(team, "auto")
  const autoEstimatedMedian = getMedianEstimatedContribution(team, "auto")
  const autoActualMedian = getMedianActualContribution(team, "auto")
  const teleEstimated = getRecentEstimatedContribution(team, "tele")
  const teleEstimatedMedian = getMedianEstimatedContribution(team, "tele")
  const teleActualMedian = getMedianActualContribution(team, "tele")
  const totalMedian = getMedianActualContribution(team)

  return [
    {
      label: "Auto",
      items: [
        {
          label: "Actual mean",
          value: team.robot.autoFuelApc.toFixed(1),
          note:
            autoEstimated !== null
              ? `mean auto AHP • est ${autoEstimated.toFixed(1)}`
              : "mean auto AHP",
          rankKey: "autoFuelApc",
        },
        {
          label: "Actual median",
          value: formatContributionValue(autoActualMedian),
          note: "typical auto contribution",
        },
        {
          label: "Estimated mean",
          value: formatContributionValue(autoEstimated),
          note: "mean auto EHP",
        },
        {
          label: "Estimated median",
          value: formatContributionValue(autoEstimatedMedian),
          note: "typical auto EHP",
        },
        { label: "Avg fuel/cycle", value: (team.robot.autoCycleFuelCountAvg ?? 0).toFixed(1), note: "average per auto cycle", rankKey: "autoCycleFuelCountAvg" },
        { label: "Cycle count", value: team.robot.autoCycleCountAvg.toFixed(1), note: "average auto cycles", rankKey: "autoCycleCountAvg" },
        { label: "Accuracy", value: formatPercent(team.robot.autoCycleAccuracy), note: "success rate", rankKey: "autoCycleAccuracy" },
        { label: "Tower", value: formatPercent(team.robot.autoTowerReliability), note: "tower success rate", rankKey: "autoTowerReliability" },
      ],
    },
    {
      label: "Teleop",
      items: [
        {
          label: "Actual mean",
          value: team.robot.teleFuelApc.toFixed(1),
          note:
            teleEstimated !== null
              ? `mean tele AHP • est ${teleEstimated.toFixed(1)}`
              : "mean tele AHP",
          rankKey: "teleFuelApc",
        },
        {
          label: "Actual median",
          value: formatContributionValue(teleActualMedian),
          note: "typical tele contribution",
        },
        {
          label: "Estimated mean",
          value: formatContributionValue(teleEstimated),
          note: "mean tele EHP",
        },
        {
          label: "Estimated median",
          value: formatContributionValue(teleEstimatedMedian),
          note: "typical tele EHP",
        },
        { label: "Avg fuel/cycle", value: (team.robot.teleCycleFuelCountAvg ?? 0).toFixed(1), note: "average per teleop cycle", rankKey: "teleCycleFuelCountAvg" },
        { label: "Cycle count", value: team.robot.teleCycleCountAvg.toFixed(1), note: "average tele cycles", rankKey: "teleCycleCountAvg" },
        { label: "Accuracy", value: formatPercent(team.robot.teleCycleAccuracy), note: "success rate", rankKey: "teleCycleAccuracy" },
        { label: "Tower level", value: team.robot.teleTowerLevel.toUpperCase(), note: `${formatPercent(team.robot.teleTowerReliability)} success rate` },
      ],
    },
    {
      label: "Defense & Reliability",
      items: [
        { label: "Defense score", value: team.robot.defenseScore.toFixed(1), note: "overall defensive impact", rankKey: "defenseScore" },
        {
          label: "Typical actual",
          value: formatContributionValue(totalMedian),
          note: "median total contribution",
          rankKey: undefined,
        },
        { label: "Failures", value: team.robot.failureCount.toFixed(0), note: "lower is better", rankKey: "failureCount" },
        { label: "Recovery", value: formatPercent(team.robot.failureRecovery), note: "recovered after issues", rankKey: "failureRecovery" },
        { label: "Drivetrain", value: team.robot.drivetrain ? titleCase(team.robot.drivetrain) : "Unknown", note: "most common setup" },
      ],
    },
  ]
}

export default function TeamDetailPage() {
  const params = useParams()
  const teamKey = Array.isArray(params.teamKey) ? params.teamKey[0] : params.teamKey
  const { selectedEvent, selectedEventKey, eventVersion, loading: eventLoading } = useEventContext()
  const [detail, setDetail] = useState<TeamDetail | null>(null)
  const [eventTeams, setEventTeams] = useState<EventTeam[]>([])
  const [allTeams, setAllTeams] = useState<TeamAnalytics[]>([])
  const [scouts, setScouts] = useState<Scout[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [statPageIndex, setStatPageIndex] = useState(0)
  const [trendMetric, setTrendMetric] = useState<TrendMetricKey>("totalActualContribution")
  const [trendRange, setTrendRange] = useState<TrendRangeKey>("all")

  useEffect(() => {
    if (eventLoading) return
    const token = getToken()
    if (!teamKey || !selectedEventKey || !token) {
      setDetail(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchTeamDetail(token, teamKey, selectedEventKey)
      .then((teamDetail) => {
        if (!cancelled) setDetail(teamDetail)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [eventLoading, eventVersion, reloadNonce, selectedEventKey, teamKey])

  useEffect(() => {
    if (eventLoading) return
    const token = getToken()
    if (!teamKey || !selectedEventKey || !token) {
      setEventTeams([])
      setAllTeams([])
      setScouts([])
      return
    }
    let cancelled = false
    Promise.allSettled([
      fetchEventTeams(token, selectedEventKey),
      fetchTeamAnalytics(token, selectedEventKey),
      fetchScouts(token),
    ]).then(([eventTeamsResult, analyticsResult, scoutsResult]) => {
      if (cancelled) return
      setEventTeams(eventTeamsResult.status === "fulfilled" ? eventTeamsResult.value : [])
      setAllTeams(analyticsResult.status === "fulfilled" ? analyticsResult.value : [])
      setScouts(scoutsResult.status === "fulfilled" ? scoutsResult.value : [])
    })
    return () => {
      cancelled = true
    }
  }, [eventLoading, reloadNonce, selectedEventKey, teamKey])

  const overview = useMemo(() => {
    if (!detail) return null
    return detail.overviews.find((entry) => entry.eventKey === selectedEventKey) ?? detail.overviews[0] ?? null
  }, [detail, selectedEventKey])

  const qualificationMatches = useMemo(() => {
    if (!detail) return []
    return [...detail.matches].filter((match) => match.level === "qm").sort((left, right) => left.matchSort - right.matchSort)
  }, [detail])

  const scoutedMatches = qualificationMatches.filter((match) => match.robot)
  const statPages = overview ? buildStatPages(overview) : []
  const teamRanks = teamKey ? computeTeamRanks(allTeams, teamKey) : {}
  const scoutNames = buildScoutNameMap(scouts)

  useEffect(() => {
    setStatPageIndex(0)
  }, [teamKey, selectedEventKey])

  useEffect(() => {
    if (statPages.length === 0) {
      setStatPageIndex(0)
      return
    }
    setStatPageIndex((currentIndex) => Math.min(currentIndex, statPages.length - 1))
  }, [statPages.length])

  const trendMetricOption = trendMetricOptions.find((option) => option.key === trendMetric) ?? trendMetricOptions[0]
  const trendMatches = getTrendMatches(scoutedMatches, trendRange)
  const trendSeries = trendMatches
    .map((match) => ({ label: formatMatchLabel(match.matchKey, match.matchNumber), value: trendMetricOption.value(match) }))
    .filter((entry): entry is { label: string; value: number } => entry.value !== null && Number.isFinite(entry.value))
  const trendValues = trendSeries.map((entry) => entry.value)
  const trendLabels = trendSeries.map((entry) => entry.label)
  const trendAverage = average(trendValues)
  const trendDelta = trend(trendValues)
  const trendBest = trendValues.length > 0 ? Math.max(...trendValues) : 0

  const pageLoading = eventLoading || loading
  const fallbackName = eventTeams.find((team) => team.teamKey === teamKey)?.name ?? ""
  const displayName = resolveTeamDisplayName({
    analyticsName: overview?.name ?? "",
    detail,
    eventKey: selectedEventKey,
    fallbackName,
  })

  if (!pageLoading && !selectedEventKey) {
    return (
      <Card className="border-dashed border-border/80 bg-muted/20">
        <CardContent className="p-6">
          <p className="font-medium">No event selected.</p>
          <p className="mt-1 text-sm text-muted-foreground">Choose an event from the top bar before opening a team page.</p>
        </CardContent>
      </Card>
    )
  }

  if (pageLoading) {
    return (
      <Card className="border-border/70 bg-card/90">
        <CardContent className="p-6 text-sm text-muted-foreground">Loading team profile...</CardContent>
      </Card>
    )
  }

  if (error) {
    return <RetryError error={error} onRetry={() => setReloadNonce((value) => value + 1)} />
  }

  if (!detail || !overview) {
    return (
      <Card className="border-dashed border-border/80 bg-muted/20">
        <CardContent className="p-6">
          <p className="font-medium">Team data unavailable.</p>
        </CardContent>
      </Card>
    )
  }

  const summary = overview.summary
  const summaryHeadline = getSummaryHeadline(summary)
  const summaryText = summary?.summaryText?.trim() ?? ""
  const showSummaryText = summaryText.length > 0 && summaryText !== summaryHeadline.trim()
  const activeStatPage = statPages[statPageIndex] ?? statPages[0]!
  const mostUsedAutoPath = getMostUsedAutoPath(overview)
  const autoPathRows = getAutoPathRows(overview)
  const noteList = [...overview.robot.scoutNotes].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const teamNumber = teamNumberFromKey(detail.teamKey)
  const overviewStats = [
    {
      label: "Record",
      value: `${overview.tba.wins}-${overview.tba.losses}-${overview.tba.ties}`,
      note: "wins-losses-ties",
    },
    {
      label: "Actual contribution",
      value: getCombinedApc(overview).toFixed(1),
      note:
        getRecentEstimatedContribution(overview) !== null
          ? `mean AHP • est ${getRecentEstimatedContribution(overview)!.toFixed(1)}`
          : "mean AHP",
    },
    {
      label: "Avg cycles",
      value: getCombinedCycles(overview).toFixed(1),
      note: "per match",
    },
    {
      label: "Avg accuracy",
      value: formatPercent(getCombinedAccuracy(overview)),
      note: "weighted",
    },
    {
      label: "Defense",
      value: overview.robot.defenseScore.toFixed(1),
      note: "overall score",
    },
    {
      label: "Matches tracked",
      value: `${scoutedMatches.length}/${qualificationMatches.length}`,
      note: "matches available",
    },
  ]
  const summaryGroups = [
    { label: "Strengths", items: summary?.notes.strengths ?? [] },
    { label: "Watch for", items: summary?.notes.concerns ?? [] },
    { label: "Best role", items: summary?.notes.allianceFit ?? [] },
    { label: "Additional notes", items: summary?.notes.isolatedNotes ?? [] },
  ]
  const defenseRows = [
    {
      label: "Unaware",
      score: "-",
      quantity: overview.robot.defenseUnawareCount,
    },
    {
      label: "Penalty prone",
      score: "-",
      quantity: overview.robot.defensePenaltyProneCount,
    },
    {
      label: "Reckless",
      score: "-",
      quantity: overview.robot.defenseRecklessCount,
    },
    {
      label: "Shut down",
      score: "-",
      quantity: overview.robot.defenseShutDownCount,
    },
    {
      label: "Elite driving",
      score: "-",
      quantity: overview.robot.defenseEliteDrivingCount,
    },
  ]

  return (
    <div className="space-y-5">
      <Card className="border-border/70 bg-card/90">
        <CardHeader className="gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <Button asChild variant="outline" size="icon" className="mt-0.5 h-8 w-8 rounded-lg">
              <Link href="/overview" aria-label="Back to overview">
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </Button>

            <img
              className="h-14 w-14 rounded-xl border border-border/80 bg-muted/20 object-cover"
              src={teamAvatarUrl(detail.teamKey)}
              alt=""
              loading="lazy"
            />

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono tracking-[0.14em]">
                  Team Profile
                </Badge>
                <Badge variant="outline">{overview.tba.rank > 0 ? `Rank #${overview.tba.rank}` : "Unranked"}</Badge>
              </div>
              <div>
                <CardTitle className="text-2xl tracking-tight">Team {teamNumber}</CardTitle>
                <CardDescription className="mt-1">
                  {displayName || `Team ${teamNumber}`}
                  {selectedEvent ? ` • ${selectedEvent.name}` : ""}
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {overviewStats.map((item) => (
              <div key={item.label} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 font-mono text-lg font-semibold">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Summary</Badge>
              <Badge variant="outline">{getSummaryStatusLabel(summary)}</Badge>
              <Badge variant="outline">{summary?.evidence.matchCount ?? 0} matches</Badge>
              <Badge variant="outline">{summary?.evidence.robotReportCount ?? 0} match details</Badge>
              <Badge variant="outline">{getSummaryEvidenceCount(summary)} notes</Badge>
            </div>
            <div>
              <CardTitle className="text-lg">{summaryHeadline}</CardTitle>
              <CardDescription className="mt-1">
                Updated {formatGeneratedAt(summary?.generatedAt ?? null)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasSummaryContent(summary) ? (
              <>
                {showSummaryText ? (
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-4 text-sm leading-6 text-foreground/90">
                    {summaryText}
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-2">
                  {summaryGroups.map((group) => (
                    <div key={group.label} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                        {group.label}
                      </p>
                      {group.items.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {group.items.map((item, index) => (
                            <p key={`${group.label}-${index}`} className="text-sm leading-5 text-foreground/90">
                              {item}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">No highlights available.</p>
                      )}
                    </div>
                  ))}
                </div>

                {summary && summary.defense.length > 0 ? (
                  <div className="space-y-3">
                    <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      Defensive style
                    </div>
                    <div className="space-y-3">
                      {summary.defense.map((item, index) => (
                        <div key={`${item.strategy}-${index}`} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium">{titleCase(item.strategy)}</p>
                            <Badge variant="outline">{titleCase(item.confidence)}</Badge>
                            <Badge variant="outline">{titleCase(item.defenseEffectiveness)}</Badge>
                            <Badge variant="outline">Driving {titleCase(item.driverQuality)}</Badge>
                            <Badge variant="outline">Penalty risk {titleCase(item.foulRisk)}</Badge>
                          </div>
                          <p className="mt-2 text-sm leading-5 text-foreground/90">{item.description}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {titleCase(item.whenUsed.matchPhase)}
                            {item.whenUsed.situation ? ` • ${item.whenUsed.situation}` : ""}
                            {item.supportingMatches.length > 0
                              ? ` • ${item.supportingMatches.map((matchKey) => formatMatchLabel(matchKey)).join(", ")}`
                              : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-6 text-sm text-muted-foreground">
                A written summary is not available for this team yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Badge variant="outline">Performance</Badge>
                <CardTitle className="mt-2 text-lg">{activeStatPage.label}</CardTitle>
                <CardDescription className="mt-1">
                  Page {statPageIndex + 1} of {statPages.length}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={statPages.length <= 1}
                  onClick={() =>
                    setStatPageIndex((currentIndex) =>
                      statPages.length === 0
                        ? 0
                        : (currentIndex - 1 + statPages.length) % statPages.length
                    )
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={statPages.length <= 1}
                  onClick={() =>
                    setStatPageIndex((currentIndex) =>
                      statPages.length === 0 ? 0 : (currentIndex + 1) % statPages.length
                    )
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeStatPage.items.map((item) => (
                <div key={item.label} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                      {item.label}
                    </p>
                    {item.rankKey ? (
                      <Badge variant="outline">{formatRank(teamRanks[item.rankKey]) ?? "Unranked"}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 font-mono text-lg font-semibold">{item.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Defense</Badge>
              <Badge variant="outline">Score {overview.robot.defenseScore.toFixed(1)}</Badge>
            </div>
            <CardTitle className="mt-2 text-lg">Defensive Profile</CardTitle>
            <CardDescription>
              Observed defensive traits across matches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {defenseRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_80px_72px] items-center gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.label}</p>
                </div>
                <p className="text-right font-mono text-sm text-foreground">{row.score}</p>
                <p className="text-right font-mono text-sm text-muted-foreground">{row.quantity}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Auto Paths</Badge>
              <Badge variant="outline">
                Most used {mostUsedAutoPath ? `${mostUsedAutoPath.label} (${mostUsedAutoPath.count})` : "None"}
              </Badge>
            </div>
            <CardTitle className="mt-2 text-lg">Auto Paths</CardTitle>
            <CardDescription>
              Quantity of each observed auto path.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {autoPathRows.map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 px-3 py-2">
                <p className="text-sm font-medium">{row.label}</p>
                <p className="font-mono text-sm text-muted-foreground">{row.count}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/90">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Performance</Badge>
              <Badge variant="outline">{trendMetricOption.label}</Badge>
            </div>
            <CardTitle className="mt-2 text-lg">Performance Trend</CardTitle>
            <CardDescription className="mt-1">
              Match-by-match performance over time.
            </CardDescription>
          </div>

          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-[420px]">
            <Select value={trendMetric} onValueChange={(value) => setTrendMetric(value as TrendMetricKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Metric" />
              </SelectTrigger>
              <SelectContent>
                {trendMetricOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={trendRange} onValueChange={(value) => setTrendRange(value as TrendRangeKey)}>
              <SelectTrigger>
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                {trendRangeOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <TrendChart values={trendValues} labels={trendLabels} formatValue={trendMetricOption.format} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Average
              </p>
              <p className="mt-2 font-mono text-lg font-semibold">{trendMetricOption.format(trendAverage)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Trend
              </p>
              <p className="mt-2 font-mono text-lg font-semibold">
                {trendValues.length >= 2 ? `${trendDelta >= 0 ? "+" : ""}${trendDelta.toFixed(0)}%` : "-"}
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Best
              </p>
              <p className="mt-2 font-mono text-lg font-semibold">{trendMetricOption.format(trendBest)}</p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Matches shown
                </p>
                <p className="mt-2 font-mono text-lg font-semibold">{trendSeries.length}</p>
              </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Matches</Badge>
              <Badge variant="outline">{qualificationMatches.length} shown</Badge>
            </div>
            <CardTitle className="mt-2 text-lg">Match Details</CardTitle>
            <CardDescription>Match-by-match contribution, scoring, and defensive performance.</CardDescription>
          </CardHeader>
          <CardContent>
            {qualificationMatches.length > 0 ? (
              <div className="space-y-3">
                {qualificationMatches.map((match) => (
                  <div key={match.matchKey} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">
                          {formatMatchLabel(match.matchKey, match.matchNumber)}
                        </p>
                        <Badge variant="outline">
                          {match.robot
                            ? "Report available"
                            : match.contribution
                              ? "Contribution only"
                              : "No details"}
                        </Badge>
                        {match.contribution ? (
                          <Badge variant="outline">
                            {formatContributionStatus(match.contribution.status)}
                          </Badge>
                        ) : null}
                        {match.contribution && !isHighConfidenceContribution(match.contribution.status) ? (
                          <Badge variant="outline">Lower confidence</Badge>
                        ) : null}
                      </div>
                      {match.robot?.drivetrain ? (
                        <Badge variant="outline">{titleCase(match.robot.drivetrain)}</Badge>
                      ) : null}
                    </div>

                    {match.robot || match.contribution ? (
                      <>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-md border border-border/80 bg-background/40 px-2.5 py-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              Actual contribution
                            </p>
                            <p className="mt-1 font-mono text-sm">
                              {formatContributionValue(getMatchActualContribution(match))}
                            </p>
                          </div>
                          <div className="rounded-md border border-border/80 bg-background/40 px-2.5 py-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                              Estimated contribution
                            </p>
                            <p className="mt-1 font-mono text-sm">
                              {formatContributionValue(getMatchEstimatedContribution(match))}
                            </p>
                          </div>
                          <div className="rounded-md border border-border/80 bg-background/40 px-2.5 py-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Defense</p>
                            <p className="mt-1 font-mono text-sm">
                              {match.robot ? match.robot.defense.calculatedScore.toFixed(1) : "—"}
                            </p>
                          </div>
                          <div className="rounded-md border border-border/80 bg-background/40 px-2.5 py-2">
                            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Failures</p>
                            <p className="mt-1 font-mono text-sm">
                              {match.robot ? match.robot.failures.count : "—"}
                            </p>
                          </div>
                        </div>

                        {match.contribution ? (
                          <div className="mt-3 rounded-md border border-border/80 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
                            <span>
                              Auto {formatContributionValue(getMatchActualContribution(match, "auto"))} actual /{" "}
                              {formatContributionValue(getMatchEstimatedContribution(match, "auto"))} est
                            </span>
                            <span className="mx-2">•</span>
                            <span>
                              Tele {formatContributionValue(getMatchActualContribution(match, "tele"))} actual /{" "}
                              {formatContributionValue(getMatchEstimatedContribution(match, "tele"))} est
                            </span>
                            {match.contribution.missingPartnerCount > 0 ? (
                              <>
                                <span className="mx-2">•</span>
                                <span>{match.contribution.missingPartnerCount} partner reports missing</span>
                              </>
                            ) : null}
                          </div>
                        ) : null}

                        {match.robot ? (
                          <>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {match.robot.autoPath ? (
                                <Badge variant="outline">{titleCase(match.robot.autoPath)}</Badge>
                              ) : null}
                              {match.robot.notes ? (
                                <Badge variant="outline">Match notes</Badge>
                              ) : null}
                              {match.robot.defenseNotes ? (
                                <Badge variant="outline">Defensive notes</Badge>
                              ) : null}
                            </div>

                            {match.robot.notes ? (
                              <p className="mt-3 text-sm leading-5 text-foreground/90">{match.robot.notes}</p>
                            ) : null}
                            {match.robot.defenseNotes ? (
                              <p className="mt-2 text-sm leading-5 text-muted-foreground">{match.robot.defenseNotes}</p>
                            ) : null}
                          </>
                        ) : (
                          <p className="mt-3 text-sm text-muted-foreground">
                            A scouting report is not available for this match, but contribution data was returned.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Detailed match data is not available for this match.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-6 text-sm text-muted-foreground">
                No matches are available for this event.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/90">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Badge variant="outline">Team Notes</Badge>
              <Badge variant="outline">{noteList.length} entries</Badge>
            </div>
            <CardTitle className="mt-2 text-lg">Team Notes</CardTitle>
            <CardDescription>Recent observations about the team.</CardDescription>
          </CardHeader>
          <CardContent>
            {noteList.length > 0 ? (
              <div className="space-y-3">
                {noteList.map((note) => (
                  <div key={note.id} className="rounded-lg border border-border/80 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{scoutNames[note.scoutId] ?? "Unknown author"}</p>
                      <Badge variant="outline">{formatNoteDate(note.createdAt)}</Badge>
                      {note.matchKey ? (
                        <Badge variant="outline">{formatMatchLabel(note.matchKey)}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-5 text-foreground/90">{note.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/10 p-6 text-sm text-muted-foreground">
                No team notes are available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
