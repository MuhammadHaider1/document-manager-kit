import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileStack,
  FileWarning,
  Loader2,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MotionCard } from '@/components/motion/MotionCard'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { FileTypeIcon } from '@/components/shared/FileTypeIcon'
import { PageHeader } from '@/components/shared/PageHeader'
import { RelativeTime } from '@/components/shared/RelativeTime'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { auditApi } from '@/lib/api/endpoints'
import { queryKeys } from '@/lib/queryClient'
import { titleCase } from '@/lib/utils'
import { useActiveOrganization } from '@/hooks/useActiveOrganization'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuthStore } from '@/store/auth'
import { useDocuments } from '@/features/documents/hooks'
import { documentFileLabel, latestVersion } from '@/features/documents/utils'

const SAMPLE_SIZE = 100

function localDateKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-')
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  loading,
  delay = 0,
}: {
  label: string
  value: number | string
  hint: string
  icon: typeof FileStack
  tone?: 'default' | 'success' | 'warning' | 'danger'
  loading?: boolean
  delay?: number
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-success/10 text-success'
      : tone === 'warning'
        ? 'bg-warning/10 text-warning'
        : tone === 'danger'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-primary/10 text-primary dark:text-foreground'

  return (
    <MotionCard delay={delay} className="h-full p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label-caps">{label}</p>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneClass}`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p className="mt-2 font-display text-[1.75rem] leading-none tracking-tight">{value}</p>
      )}
      <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">{hint}</p>
    </MotionCard>
  )
}

export function DashboardPage() {
  useDocumentTitle('Overview')
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { activeOrganization } = useActiveOrganization()
  const { can, roleName, isLoading: roleLoading } = useCapabilities()

  const documentsQuery = useDocuments({
    page: 1,
    page_size: SAMPLE_SIZE,
    sort_by: 'updated_at',
    sort_order: 'desc',
  })

  const auditQuery = useQuery({
    queryKey: queryKeys.audit(activeOrganization?.id ?? null, { limit: 6, dashboard: true }),
    queryFn: () => auditApi.list({ organization_id: activeOrganization!.id, limit: 6, offset: 0 }),
    enabled: Boolean(activeOrganization?.id && can('audit:read')),
  })

  const documents = useMemo(() => documentsQuery.data?.items ?? [], [documentsQuery.data])
  const total = documentsQuery.data?.total ?? 0
  const sampleSize = documents.length

  const stats = useMemo(() => {
    const indexed = documents.filter(
      (document) => document.processing_status === 'completed'
    ).length
    const inFlight = documents.filter(
      (document) =>
        document.processing_status === 'pending' || document.processing_status === 'processing'
    ).length
    const failed = documents.filter((document) => document.processing_status === 'failed').length
    return { indexed, inFlight, failed }
  }, [documents])

  const failedDocuments = useMemo(
    () => documents.filter((document) => document.processing_status === 'failed').slice(0, 3),
    [documents]
  )

  const statusBreakdown = useMemo(
    () =>
      [
        {
          label: 'Indexed',
          value: stats.indexed,
          barClass: 'bg-success',
          dotClass: 'bg-success',
        },
        {
          label: 'Processing',
          value: stats.inFlight,
          barClass: 'bg-warning',
          dotClass: 'bg-warning',
        },
        {
          label: 'Failed',
          value: stats.failed,
          barClass: 'bg-destructive',
          dotClass: 'bg-destructive',
        },
      ].map((entry) => ({
        ...entry,
        percent: sampleSize === 0 ? 0 : Math.round((entry.value / sampleSize) * 100),
      })),
    [sampleSize, stats]
  )

  const uploadActivity = useMemo(() => {
    const counts = new Map<string, number>()
    for (const document of documents) {
      const createdAt = new Date(document.created_at)
      if (Number.isNaN(createdAt.getTime())) continue
      const key = localDateKey(createdAt)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const today = new Date()
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index))
      const key = localDateKey(date)
      return {
        key,
        label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date),
        dateLabel: new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
        }).format(date),
        count: counts.get(key) ?? 0,
      }
    })

    return {
      days,
      max: Math.max(1, ...days.map((day) => day.count)),
      total: days.reduce((sum, day) => sum + day.count, 0),
    }
  }, [documents])

  const recentDocuments = documents.slice(0, 5)
  const coverage = sampleSize === 0 ? 0 : Math.round((stats.indexed / sampleSize) * 100)
  const sampleHint =
    total > sampleSize
      ? `Across the latest ${sampleSize} of ${total} documents`
      : `Across all ${total} ${total === 1 ? 'document' : 'documents'}`

  const firstName = user?.full_name?.trim().split(/\s+/)[0]

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={activeOrganization?.name ?? 'Workspace'}
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        description="A working view of your organization's document estate, indexing health and recent activity."
        context={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {roleLoading ? 'Resolving role…' : (roleName ?? 'No role assigned')}
            </Badge>
            {activeOrganization?.is_active === false && (
              <Badge tone="warning">Workspace inactive</Badge>
            )}
          </div>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/app/ask">
                <Sparkles />
                Ask AI
              </Link>
            </Button>
            {can('documents:create') ? (
              <Button variant="accent" onClick={() => navigate('/app/documents?upload=1')}>
                <Upload />
                Upload document
              </Button>
            ) : (
              <Button variant="outline" disabled title="Your role cannot upload documents">
                <Upload />
                Upload document
              </Button>
            )}
          </>
        }
      />

      {documentsQuery.isError ? (
        <ErrorState error={documentsQuery.error} onRetry={() => void documentsQuery.refetch()} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Documents"
              value={total}
              hint="Active documents in this organization"
              icon={FileStack}
              loading={documentsQuery.isLoading}
              delay={0.02}
            />
            <StatCard
              label="Indexed"
              value={stats.indexed}
              hint={sampleHint}
              icon={CheckCircle2}
              tone="success"
              loading={documentsQuery.isLoading}
              delay={0.07}
            />
            <StatCard
              label="Processing"
              value={stats.inFlight}
              hint="Queued or extracting text"
              icon={Loader2}
              tone="warning"
              loading={documentsQuery.isLoading}
              delay={0.12}
            />
            <StatCard
              label="Failed"
              value={stats.failed}
              hint="Need a corrected version"
              icon={FileWarning}
              tone="danger"
              loading={documentsQuery.isLoading}
              delay={0.17}
            />
          </div>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <MotionCard interactive={false} delay={0.08}>
                <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>Recently updated</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      The five most recently changed documents.
                    </p>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="shrink-0">
                    <Link to="/app/documents">
                      All documents
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {documentsQuery.isLoading ? (
                    <div className="space-y-3">
                      {[0, 1, 2, 3, 4].map((index) => (
                        <div key={index} className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-lg" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-3.5 w-2/5" />
                            <Skeleton className="h-3 w-1/4" />
                          </div>
                          <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                      ))}
                    </div>
                  ) : recentDocuments.length === 0 ? (
                    <EmptyState
                      icon={FileStack}
                      title="Your workspace is empty"
                      description="Upload a contract, pleading or lease to start building the searchable index."
                      className="border-0 bg-transparent py-8"
                      action={
                        can('documents:create') ? (
                          <Button
                            variant="accent"
                            onClick={() => navigate('/app/documents?upload=1')}
                          >
                            <Upload />
                            Upload a document
                          </Button>
                        ) : undefined
                      }
                    />
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {recentDocuments.map((document) => {
                        const version = latestVersion(document)
                        return (
                          <li key={document.id}>
                            <Link
                              to={`/app/documents/${document.id}`}
                              className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                            >
                              <FileTypeIcon
                                fileName={version?.file_name}
                                mimeType={version?.mime_type}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-[0.8125rem] font-medium underline-offset-4 group-hover:text-accent group-hover:underline">
                                  {document.title}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-2xs text-muted-foreground">
                                  {documentFileLabel(document)} · updated{' '}
                                  <RelativeTime value={document.updated_at} />
                                </p>
                              </div>
                              <StatusBadge
                                status={document.processing_status}
                                className="shrink-0"
                              />
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardContent>
              </MotionCard>

              <MotionCard interactive={false} delay={0.1}>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>Index health</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      How the loaded documents are distributed across processing states.
                    </p>
                  </div>
                  <Badge tone={stats.failed > 0 ? 'warning' : 'success'}>
                    {stats.failed > 0 ? `${stats.failed} need attention` : 'Healthy'}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {documentsQuery.isLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-3 w-full rounded-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : sampleSize === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Upload a document to start seeing indexing health here.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div
                        className="flex h-3 overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={statusBreakdown
                          .map((entry) => `${entry.label}: ${entry.value} of ${sampleSize}`)
                          .join(', ')}
                      >
                        {statusBreakdown.map((entry) =>
                          entry.value > 0 ? (
                            <span
                              key={entry.label}
                              className={entry.barClass}
                              style={{ width: `${(entry.value / sampleSize) * 100}%` }}
                            />
                          ) : null
                        )}
                      </div>
                      <dl className="grid gap-3 sm:grid-cols-3">
                        {statusBreakdown.map((entry) => (
                          <div key={entry.label}>
                            <dt className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                              <span
                                className={`h-2 w-2 rounded-full ${entry.dotClass}`}
                                aria-hidden="true"
                              />
                              {entry.label}
                            </dt>
                            <dd className="mt-1 flex items-baseline gap-1.5">
                              <span className="font-display text-xl leading-none">
                                {entry.value}
                              </span>
                              <span className="text-2xs text-muted-foreground">
                                {entry.percent}%
                              </span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="text-2xs leading-relaxed text-muted-foreground">
                        {sampleSize === total
                          ? 'Calculated from every active document in this workspace.'
                          : `Based on the latest ${sampleSize} of ${total} active documents.`}
                      </p>
                    </div>
                  )}
                </CardContent>
              </MotionCard>

              <MotionCard interactive={false} delay={0.12}>
                <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle>Upload activity</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Documents added to this workspace over the last seven days.
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-foreground">
                    <BarChart3 className="h-4 w-4" aria-hidden="true" />
                  </span>
                </CardHeader>
                <CardContent>
                  {documentsQuery.isLoading ? (
                    <Skeleton className="h-44 w-full rounded-lg" />
                  ) : (
                    <div className="space-y-4">
                      <div
                        className="flex h-40 items-end gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 pb-2 pt-4 sm:gap-3"
                        role="img"
                        aria-label={uploadActivity.days
                          .map((day) => `${day.dateLabel}: ${day.count} uploads`)
                          .join(', ')}
                      >
                        {uploadActivity.days.map((day) => (
                          <div key={day.key} className="flex h-full min-w-0 flex-1 flex-col">
                            <div className="flex min-h-0 flex-1 items-end justify-center">
                              <span
                                className="w-full max-w-10 rounded-t-md bg-accent/80 transition-[height] motion-reduce:transition-none"
                                style={{
                                  height:
                                    day.count === 0
                                      ? '0.25rem'
                                      : `${Math.max(12, (day.count / uploadActivity.max) * 100)}%`,
                                }}
                                title={`${day.count} uploaded on ${day.dateLabel}`}
                              />
                            </div>
                            <span className="mt-2 text-center text-2xs text-muted-foreground">
                              {day.label}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <p className="text-muted-foreground">Added in the last seven days</p>
                        <p className="font-medium">
                          {uploadActivity.total}{' '}
                          {uploadActivity.total === 1 ? 'document' : 'documents'}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </MotionCard>

              {failedDocuments.length > 0 && (
                <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                      <FileWarning className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Documents that need attention</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Processing failed for these files. Upload a corrected version to retry
                        indexing.
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {failedDocuments.map((document) => (
                          <li key={document.id}>
                            <Link
                              to={`/app/documents/${document.id}?tab=versions`}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground underline-offset-4 hover:text-accent hover:underline"
                            >
                              <ArrowRight className="h-3 w-3" aria-hidden="true" />
                              {document.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-5">
              <MotionCard interactive={false} delay={0.08}>
                <CardHeader>
                  <CardTitle>Index coverage</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Share of the sampled documents that are searchable and available to Ask AI.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between">
                    <p className="font-display text-[1.75rem] leading-none tracking-tight">
                      {coverage}%
                    </p>
                    <p className="text-2xs text-muted-foreground">
                      {stats.indexed} of {sampleSize || 0} loaded
                    </p>
                  </div>
                  <Progress value={coverage} aria-label={`Index coverage ${coverage}%`} />
                  <p className="text-2xs leading-relaxed text-muted-foreground">
                    {total > sampleSize
                      ? `Based on the latest ${sampleSize} documents. The API exposes no aggregate status endpoint, so older documents are not included in this figure.`
                      : 'Calculated from every active document returned by the API.'}
                  </p>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/app/documents">Review document statuses</Link>
                  </Button>
                </CardContent>
              </MotionCard>

              <MotionCard interactive={false} delay={0.12}>
                <CardHeader>
                  <CardTitle>Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  <Button asChild variant="outline" className="justify-start">
                    <Link to="/app/ask">
                      <Sparkles className="text-accent" />
                      Ask across the organization
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="justify-start">
                    <Link to="/app/documents">
                      <FileStack />
                      Browse documents
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="justify-start">
                    <Link to="/app/team">
                      <Users />
                      {can('members:invite') || can('members:manage_roles') || can('members:remove')
                        ? 'Manage team & roles'
                        : 'View team & roles'}
                    </Link>
                  </Button>
                  {can('audit:read') && (
                    <Button asChild variant="outline" className="justify-start">
                      <Link to="/app/audit">
                        <ScrollText />
                        Open audit log
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </MotionCard>

              {can('audit:read') && (
                <MotionCard interactive={false} delay={0.16}>
                  <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                    <CardTitle>Recent activity</CardTitle>
                    <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-2xs">
                      <Link to="/app/audit">View all</Link>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {auditQuery.isLoading ? (
                      <div className="space-y-3">
                        {[0, 1, 2].map((index) => (
                          <div key={index} className="space-y-1.5">
                            <Skeleton className="h-3 w-2/3" />
                            <Skeleton className="h-3 w-1/3" />
                          </div>
                        ))}
                      </div>
                    ) : auditQuery.isError ? (
                      <p className="text-xs text-muted-foreground">
                        Activity could not be loaded right now.
                      </p>
                    ) : (auditQuery.data ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No audit events have been recorded for this organization yet.
                      </p>
                    ) : (
                      <ol className="space-y-3">
                        {(auditQuery.data ?? []).map((entry) => (
                          <li key={entry.id} className="flex gap-2.5">
                            <span
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                              aria-hidden="true"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium">{titleCase(entry.action)}</p>
                              <p className="mt-0.5 text-2xs text-muted-foreground">
                                {titleCase(entry.entity_type)} ·{' '}
                                <RelativeTime value={entry.created_at} />
                              </p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </CardContent>
                </MotionCard>
              )}
            </div>
          </div>

          <MotionCard interactive={false} delay={0.18}>
            <CardHeader>
              <SectionHeading
                title="Where to start"
                description="Docuflow keeps source files, versions and the searchable index in one place."
              />
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: 'Upload with intent',
                  body: 'Add titles and descriptions you would search for later. Every file keeps an immutable version history.',
                },
                {
                  title: 'Ask in plain language',
                  body: 'Ask AI retrieves passages from this organization’s index. Answers are model output, so verify against the source.',
                },
                {
                  title: 'Review the trail',
                  body: 'Uploads, versions, archives and restores are recorded in the audit log with actor and timestamp.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-border/70 bg-muted/20 p-4"
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </CardContent>
          </MotionCard>
        </>
      )}
    </div>
  )
}
