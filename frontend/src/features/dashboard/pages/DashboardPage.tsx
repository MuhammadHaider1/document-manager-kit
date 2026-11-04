import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
}: {
  label: string
  value: number | string
  hint: string
  icon: typeof FileStack
  tone?: 'default' | 'success' | 'warning' | 'danger'
  loading?: boolean
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
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-card sm:p-5">
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
    </div>
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
            />
            <StatCard
              label="Indexed"
              value={stats.indexed}
              hint={sampleHint}
              icon={CheckCircle2}
              tone="success"
              loading={documentsQuery.isLoading}
            />
            <StatCard
              label="Processing"
              value={stats.inFlight}
              hint="Queued or extracting text"
              icon={Loader2}
              tone="warning"
              loading={documentsQuery.isLoading}
            />
            <StatCard
              label="Failed"
              value={stats.failed}
              hint="Need a corrected version"
              icon={FileWarning}
              tone="danger"
              loading={documentsQuery.isLoading}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <Card>
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
              </Card>

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
              <Card>
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
              </Card>

              <Card>
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
              </Card>

              {can('audit:read') && (
                <Card>
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
                </Card>
              )}
            </div>
          </div>

          <Card>
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
          </Card>
        </>
      )}
    </div>
  )
}
