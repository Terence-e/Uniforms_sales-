import {
  LayoutDashboard,
  UserRound,
  ShoppingCart,
  PackagePlus,
  ClipboardList,
  Boxes,
  RefreshCcw,
  Ban,
  Receipt,
  BarChart3,
  ScrollText,
  Tags,
  Users,
  type LucideIcon
} from 'lucide-react';
import type { UserRole } from '@/types/database.types';

export type NavSection = 'overview' | 'operations' | 'records' | 'admin';

export type NavItem = {
  key: string; // matches a Dashboard.modules.<key> label, or handled specially
  href?: string; // present when a real page exists; otherwise "soon"
  icon: LucideIcon;
  section: NavSection;
  roles: readonly UserRole[];
};

const ALL: readonly UserRole[] = ['seller', 'administration', 'maintenance', 'super_admin'];
const OPERATORS: readonly UserRole[] = ['seller', 'maintenance', 'super_admin'];

// Ordering here is the rendering order within each section.
export const NAV_ITEMS: readonly NavItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, section: 'overview', roles: ALL },
  { key: 'profile', href: '/profile', icon: UserRound, section: 'overview', roles: ALL },

  { key: 'sales', href: '/sales', icon: ShoppingCart, section: 'operations', roles: ALL },
  { key: 'orders', href: '/orders', icon: PackagePlus, section: 'operations', roles: ALL },
  { key: 'openJobs', icon: ClipboardList, section: 'operations', roles: ALL },
  { key: 'production', href: '/stock', icon: Boxes, section: 'operations', roles: ALL },
  { key: 'returns', icon: RefreshCcw, section: 'operations', roles: OPERATORS },
  { key: 'cancellations', icon: Ban, section: 'operations', roles: OPERATORS },

  { key: 'receipts', icon: Receipt, section: 'records', roles: ALL },
  { key: 'reports', href: '/reports', icon: BarChart3, section: 'records', roles: ALL },
  { key: 'audit', href: '/audit', icon: ScrollText, section: 'records', roles: ALL },

  { key: 'catalogue', href: '/catalogue', icon: Tags, section: 'admin', roles: ['super_admin'] },
  { key: 'accounts', href: '/accounts', icon: Users, section: 'admin', roles: ['super_admin'] }
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
