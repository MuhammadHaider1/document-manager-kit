import { FileUp, LayoutDashboard, Search, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { APP_NAV } from '@/app/navigation'
import type { Capability } from '@/lib/permissions'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/ui'

interface Command {
  id: string
  label: string
  hint: string
  icon: typeof Search
  group: 'Go to' | 'Actions'
  run: () => void
}

export function CommandPalette({ can }: { can: (capability: Capability) => boolean }) {
  const open = useUiStore((state) => state.commandOpen)
  const setOpen = useUiStore((state) => state.setCommandOpen)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen(!useUiStore.getState().commandOpen)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [open])

  const commands = useMemo<Command[]>(() => {
    const go = APP_NAV.filter((item) => !item.capability || can(item.capability)).map((item) => ({
      id: `go-${item.to}`,
      label: item.label,
      hint: 'Navigate',
      icon: item.icon,
      group: 'Go to' as const,
      run: () => navigate(item.to),
    }))

    const actions: Command[] = [
      {
        id: 'upload',
        label: 'Upload a document',
        hint: 'Documents',
        icon: FileUp,
        group: 'Actions',
        run: () => navigate('/app/documents?upload=1'),
      },
      {
        id: 'ask',
        label: 'Ask AI a question',
        hint: 'Grounded in your documents',
        icon: Sparkles,
        group: 'Actions',
        run: () => navigate('/app/ask'),
      },
      {
        id: 'dashboard',
        label: 'Open overview',
        hint: 'Firm activity',
        icon: LayoutDashboard,
        group: 'Actions',
        run: () => navigate('/app'),
      },
    ]

    return [...go, ...actions]
  }, [can, navigate])

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return commands
    return commands.filter(
      (command) =>
        command.label.toLowerCase().includes(term) || command.hint.toLowerCase().includes(term)
    )
  }, [commands, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const runCommand = (command: Command | undefined) => {
    if (!command) return
    setOpen(false)
    command.run()
  }

  const groups = ['Go to', 'Actions'] as const

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((index) => Math.min(index + 1, filtered.length - 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => Math.max(index - 1, 0))
              } else if (event.key === 'Enter') {
                event.preventDefault()
                runCommand(filtered[activeIndex])
              }
            }}
            placeholder="Search pages, upload a document, ask AI…"
            className="h-8 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Command palette search"
            autoComplete="off"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline-block">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[22rem] overflow-y-auto p-2" role="listbox">
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No commands match “{query}”.
            </p>
          )}

          {groups.map((group) => {
            const groupCommands = filtered.filter((command) => command.group === group)
            if (groupCommands.length === 0) return null
            return (
              <div key={group} className="mb-1">
                <p className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group}
                </p>
                {groupCommands.map((command) => {
                  const index = filtered.indexOf(command)
                  const active = index === activeIndex
                  return (
                    <button
                      key={command.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => runCommand(command)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                        active ? 'bg-muted text-foreground' : 'text-foreground/85'
                      )}
                    >
                      <command.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <span className="flex-1">{command.label}</span>
                      <span className="text-2xs text-muted-foreground">{command.hint}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-2xs text-muted-foreground">
          <span>↑↓ to navigate · ↵ to select</span>
          <span>⌘K to toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
