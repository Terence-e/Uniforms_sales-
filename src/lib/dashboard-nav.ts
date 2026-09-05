import {
  LayoutDashboard,
  UserRound,
  ShoppingCart,
  PackagePlus,
  ClipboardList,
  Scissors,
  Boxes,
  RefreshCcw,
  Ban,
  Receipt,
  BarChart3,
  ScrollText,
  Bug,
  Tags,
  Users,
  SlidersHorizontal,
  type LucideIcon
} from 'lucide-react';
import type { UserRole } from '@/types/database.types';
import { OPERATOR_ROLES } from '@/lib/roles';

export type NavSection = 'overview' | 'operations' | 'records' | 'admin';

export type NavItem = {
  key: string; // matches a Dashboard.modules.<key> label, or handled specially
  href?: string; // present when a real page exists; otherwise "soon"
  icon: LucideIcon;
  section: NavSection;
  roles: readonly UserRole[];
};

const ALL: readonly UserRole[] = ['seller', 'administration', 'maintenance', 'super_admin'];
// Shared with every screen that hides a write control from Administration, so
// there is one list of "who can write" rather than this file's copy quietly
// drifting from the rest of the app's.
const OPERATORS: readonly UserRole[] = OPERATOR_ROLES;

// Ordering here is the rendering order within each section.
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'overview', roles: ALL },
  { key: 'profile', href: '/profile', icon: UserRound, section: 'overview', roles: ALL },

  { key: 'sales', href: '/sales', icon: ShoppingCart, section: 'operations', roles: ALL },
  { key: 'orders', href: '/orders', icon: PackagePlus, section: 'operations', roles: ALL },
  { key: 'openJobs', href: '/open-jobs', icon: ClipboardList, section: 'operations', roles: ALL },
  { key: 'alterations', href: '/alterations', icon: Scissors, section: 'operations', roles: ALL },
  { key: 'production', href: '/stock', icon: Boxes, section: 'operations', roles: ALL },
  { key: 'returns', href: '/returns', icon: RefreshCcw, section: 'operations', roles: OPERATORS },
  { key: 'cancellations', href: '/cancellations', icon: Ban, section: 'operations', roles: OPERATORS },

  { key: 'receipts', href: '/receipts', icon: Receipt, section: 'records', roles: ALL },
  { key: 'reports', href: '/reports', icon: BarChart3, section: 'records', roles: ALL },
  { key: 'audit', href: '/audit', icon: ScrollText, section: 'records', roles: ALL },
  // Maintenance and the Super Admin only -- RLS enforces it too; this just
  // keeps the nav honest about who the screen is for.
  {
    key: 'bugReports',
    href: '/bug-reports',
    icon: Bug,
    section: 'records',
    roles: ['maintenance', 'super_admin']
  },

  { key: 'catalogue', href: '/catalogue', icon: Tags, section: 'admin', roles: ['super_admin'] },
  { key: 'accounts', href: '/accounts', icon: Users, section: 'admin', roles: ['super_admin'] },
  // The return windows are settings so the rule can change without a
  // deployment (A-FR-8.8) -- but only for the one role that should be setting
  // it. RLS enforces the same thing.
  {
    key: 'settings',
    href: '/settings',
    icon: SlidersHorizontal,
    section: 'admin',
    roles: ['super_admin']
  }
];

export const NAV_SECTION_ORDER: readonly NavSection[] = [
  'overview',
  'operations',
  'records',
  'admin'
];

export function navItemsFor(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
