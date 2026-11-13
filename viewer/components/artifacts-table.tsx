"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BracesIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  GlobeIcon,
  ImageIcon,
  LockIcon,
  SearchIcon,
} from "lucide-react"
import { toast } from "sonner"

import { starArtifact } from "@/app/actions"
import {
  DeleteArtifactDialog,
  EditDetailsDialog,
  type DialogTarget,
} from "@/components/artifact-dialogs"
import { copyText } from "@/components/copy-button"
import { RelativeTime } from "@/components/relative-time"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ArtifactSummary } from "@/lib/artifacts"

export type ArtifactRow = ArtifactSummary & {
  /** Framed link, the one to share. */
  shareUrl: string
  /** The artifact on its own page. */
  bareUrl: string
}

type Kind = "mine" | "starred"

type RowActions = {
  kind: Kind
  canWrite: boolean
  onEdit: (artifact: DialogTarget) => void
  onDelete: (artifact: DialogTarget) => void
  onUnstar: (artifact: ArtifactRow) => void
}

const features = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
  // Only the sort functions that are registered here are bundled.
  sortFns: { basic: sortFn_basic, text: sortFn_text },
})

const columnHelper = createColumnHelper<typeof features, ArtifactRow>()

const PAGE_SIZE = 20

const VISIBILITY_ITEMS = [
  { value: "all", label: "All visibility" },
  { value: "public", label: "Public" },
  { value: "unlisted", label: "Unlisted" },
]

function MediaIcon({ mediaType }: { mediaType: string | null }) {
  const className = "size-4 shrink-0 text-muted-foreground"
  if (mediaType === "text/html") return <FileCodeIcon className={className} />
  if (mediaType === "application/json") return <BracesIcon className={className} />
  if (mediaType?.startsWith("image/")) return <ImageIcon className={className} />
  if (mediaType?.startsWith("text/")) return <FileTextIcon className={className} />
  return <FileIcon className={className} />
}

function SortHeader({
  label,
  sorted,
  onToggle,
  align = "start",
}: {
  label: string
  sorted: false | "asc" | "desc"
  onToggle: () => void
  align?: "start" | "end"
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className={align === "end" ? "-mr-2.5 ml-auto flex" : "-ml-2.5"}
      aria-label={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUpIcon data-icon="inline-end" />
      ) : sorted === "desc" ? (
        <ArrowDownIcon data-icon="inline-end" />
      ) : (
        <ArrowUpDownIcon data-icon="inline-end" className="opacity-50" />
      )}
    </Button>
  )
}

function buildColumns(actions: RowActions) {
  return columnHelper.columns([
    columnHelper.accessor("title", {
      sortFn: "text",
      header: ({ column }) => (
        <SortHeader
          label="Title"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }) => (
        <div className="flex min-w-48 items-start gap-2.5">
          <span className="mt-0.5">
            <MediaIcon mediaType={row.original.mediaType} />
          </span>
          <div className="min-w-0">
            <Link
              href={`/g/${row.original.id}`}
              className="font-medium underline-offset-4 hover:underline"
            >
              {row.original.title}
            </Link>
            {row.original.description ? (
              <p className="max-w-md truncate text-xs text-muted-foreground">
                {row.original.description}
              </p>
            ) : null}
          </div>
        </div>
      ),
    }),
    ...(actions.kind === "starred"
      ? [
          columnHelper.accessor("owner", {
            enableSorting: false,
            header: "Owner",
            cell: ({ row }) => <span className="text-muted-foreground">{row.original.owner ?? "–"}</span>,
          }),
        ]
      : []),
    columnHelper.accessor("isPublic", {
      enableSorting: false,
      header: "Visibility",
      cell: ({ row }) => (
        <Badge variant="outline" className="px-1.5 text-muted-foreground">
          {row.original.isPublic ? <GlobeIcon /> : <LockIcon />}
          {row.original.isPublic ? "Public" : "Unlisted"}
        </Badge>
      ),
    }),
    columnHelper.accessor("fileCount", {
      enableSorting: false,
      header: () => <div className="text-right">Files</div>,
      cell: ({ row }) => <div className="text-right tabular-nums">{row.original.fileCount}</div>,
    }),
    columnHelper.accessor("commentCount", {
      enableSorting: false,
      header: () => <div className="text-right">Comments</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.commentCount > 0 ? row.original.commentCount : <span className="text-muted-foreground">–</span>}
        </div>
      ),
    }),
    columnHelper.accessor("updatedAt", {
      // ISO timestamps order correctly as plain strings.
      sortFn: "basic",
      header: ({ column }) => (
        <SortHeader
          label="Updated"
          align="end"
          sorted={column.getIsSorted()}
          onToggle={() => column.toggleSorting(column.getIsSorted() !== "desc")}
        />
      ),
      cell: ({ row }) => (
        <div className="text-right whitespace-nowrap text-muted-foreground">
          <RelativeTime iso={row.original.updatedAt} />
        </div>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const artifact = row.original
        const target = { id: artifact.id, title: artifact.title, description: artifact.description }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label={`Actions for ${artifact.title}`}
                />
              }
            >
              <EllipsisVerticalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href={`/g/${artifact.id}`} />}>Open</DropdownMenuItem>
                <DropdownMenuItem render={<a href={artifact.bareUrl} target="_blank" rel="noreferrer" />}>
                  Open full page
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyText(artifact.shareUrl)}>Copy link</DropdownMenuItem>
                <DropdownMenuItem render={<a href={artifact.htmlUrl} target="_blank" rel="noreferrer" />}>
                  View on GitHub
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {actions.canWrite ? (
                <>
                  <DropdownMenuSeparator />
                  {actions.kind === "mine" ? (
                    <DropdownMenuGroup>
                      <DropdownMenuItem onClick={() => actions.onEdit(target)}>Edit details…</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => actions.onDelete(target)}>
                        Delete…
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  ) : (
                    <DropdownMenuItem onClick={() => actions.onUnstar(artifact)}>Remove star</DropdownMenuItem>
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    }),
  ])
}

export function ArtifactsTable({
  artifacts,
  kind,
  canWrite,
}: {
  artifacts: ArtifactRow[]
  kind: Kind
  canWrite: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [visibility, setVisibility] = React.useState("all")
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "updatedAt", desc: true }])
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: PAGE_SIZE })
  const [editing, setEditing] = React.useState<DialogTarget | null>(null)
  const [deleting, setDeleting] = React.useState<DialogTarget | null>(null)

  const columns = React.useMemo(
    () =>
      buildColumns({
        kind,
        canWrite,
        onEdit: setEditing,
        onDelete: setDeleting,
        onUnstar: async (artifact) => {
          const result = await starArtifact(artifact.id, false)
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success("Star removed")
          router.refresh()
        },
      }),
    [kind, canWrite, router]
  )

  const data = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return artifacts.filter((artifact) => {
      if (visibility === "public" && !artifact.isPublic) return false
      if (visibility === "unlisted" && artifact.isPublic) return false
      if (!needle) return true
      return [artifact.title, artifact.description, artifact.owner, artifact.id].some((field) =>
        field?.toLowerCase().includes(needle)
      )
    })
  }, [artifacts, query, visibility])

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting, pagination },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  const pageCount = table.getPageCount()

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setPagination((current) => ({ ...current, pageIndex: 0 }))
            }}
            placeholder="Filter artifacts"
            aria-label="Filter artifacts"
            className="pl-8"
          />
        </div>
        <Select
          value={visibility}
          items={VISIBILITY_ITEMS}
          onValueChange={(value) => {
            setVisibility(value ?? "all")
            setPagination((current) => ({ ...current, pageIndex: 0 }))
          }}
        >
          <SelectTrigger className="w-36" aria-label="Visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {VISIBILITY_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <p className="ml-auto text-sm text-muted-foreground tabular-nums" aria-live="polite">
          {data.length === artifacts.length
            ? `${artifacts.length} ${artifacts.length === 1 ? "artifact" : "artifacts"}`
            : `${data.length} of ${artifacts.length}`}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder ? null : <FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className="last:w-10">
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No artifacts match this filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {pagination.pageIndex + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Next page"
          >
            <ChevronRightIcon />
          </Button>
        </div>
      ) : null}

      <EditDetailsDialog artifact={editing} onClose={() => setEditing(null)} onDone={() => router.refresh()} />
      <DeleteArtifactDialog artifact={deleting} onClose={() => setDeleting(null)} onDone={() => router.refresh()} />
    </div>
  )
}
