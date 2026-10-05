import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBinoculars, faCirclePause, faClipboardCheck, faFileContract, faHandshake, faCircleCheck, faBan,
} from '@fortawesome/free-solid-svg-icons';
import { TRACKER_STAGE_CONFIG } from './designTokens';

/**
 * Translates `TRACKER_STAGE_CONFIG`'s string icon names (its convention, shared
 * with the backend's stage-config endpoint) into Font Awesome `IconDefinition`
 * objects (the convention every FontAwesomeIcon call site needs). Scoped to
 * HomeGuestView only — the dozen other files that already read
 * TRACKER_STAGE_CONFIG directly keep using its string-icon convention as-is.
 */
const ICON_BY_NAME: Record<string, IconDefinition> = {
  'fa-binoculars': faBinoculars,
  'fa-circle-pause': faCirclePause,
  'fa-clipboard-check': faClipboardCheck,
  'fa-file-contract': faFileContract,
  'fa-handshake': faHandshake,
  'fa-circle-check': faCircleCheck,
  'fa-ban': faBan,
};

export const STAGE_ICONS: Record<string, { icon: IconDefinition; color: string }> = Object.fromEntries(
  TRACKER_STAGE_CONFIG.map(s => [s.name, { icon: ICON_BY_NAME[s.icon], color: s.color }]),
);
