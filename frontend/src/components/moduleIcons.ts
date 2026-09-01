import {
  faHome, faTimeline, faBuilding, faCalendar, faBullseye, faFileLines, faChartBar,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

/** The 7 navigation modules (Sidebar.tsx's NAV items). */
export type NavModule = 'home' | 'tracker' | 'suppliers' | 'events' | 'strategy' | 'reports' | 'visuals';

/**
 * Single source of truth for "which icon represents this module" — the
 * sidebar is the user's visual reference, so its icon wins here. Screens
 * that show a loading spinner for one of these modules (including their
 * detail sub-screens) pull their `LoadingState` icon from this map instead
 * of picking one by hand, so the two can no longer drift apart.
 */
export const moduleIcons: Record<NavModule, IconDefinition> = {
  home: faHome,
  tracker: faTimeline,
  suppliers: faBuilding,
  events: faCalendar,
  strategy: faBullseye,
  reports: faFileLines,
  visuals: faChartBar,
};

/** A nav module together with the route it owns and the label the sidebar shows. */
export interface NavModuleRoute {
  /** Route prefix owned by the module: the path itself and everything under it. */
  path: string;
  module: NavModule;
  label: string;
}

/**
 * The 7 nav destinations, in sidebar order. This is also the route → module
 * mapping: `Sidebar`'s `NavLink`s match by prefix (no `end`), so `/tracker`
 * owns `/tracker/stage/...` and `/strategy` owns `/strategy/mrl`, exactly as
 * the highlighted sidebar item already tells the user.
 *
 * `Sidebar` renders it and `App.tsx` resolves the current module from it for
 * the lazy-route `<Suspense>` fallback icon, so the two can never disagree
 * about which module a URL belongs to.
 */
export const navModules: NavModuleRoute[] = [
  { path: '/home',       module: 'home',      label: 'Home' },
  { path: '/tracker',    module: 'tracker',   label: 'Tracker' },
  { path: '/suppliers',  module: 'suppliers', label: 'Suppliers' },
  { path: '/events',     module: 'events',    label: 'Events' },
  { path: '/strategy',   module: 'strategy',  label: 'Strategy' },
  { path: '/reports',    module: 'reports',   label: 'Reports' },
  { path: '/visuals',    module: 'visuals',   label: 'Visuals' },
];
