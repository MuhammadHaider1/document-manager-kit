import {
  Archive,
  FileStack,
  LayoutDashboard,
  ScrollText,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Capability } from '@/lib/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  capability?: Capability
}

export const APP_NAV: NavItem[] = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/documents', label: 'Documents', icon: FileStack },
  { to: '/app/archive', label: 'Archive', icon: Archive },
  { to: '/app/ask', label: 'Ask AI', icon: Sparkles },
  { to: '/app/audit', label: 'Audit log', icon: ScrollText, capability: 'audit:read' },
  { to: '/app/team', label: 'Team & roles', icon: Users },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]
