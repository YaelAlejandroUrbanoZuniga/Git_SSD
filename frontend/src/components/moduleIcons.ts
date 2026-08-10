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
