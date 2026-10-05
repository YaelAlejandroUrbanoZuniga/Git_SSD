import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faPlus, faPen, faTrash, faEye, faDownload, faFilter, faMagnifyingGlass, faXmark,
  faArrowLeft, faStickyNote, faRotateRight, faCheck, faLock, faTriangleExclamation,
  faCircleCheck, faCircleInfo, faCircleXmark, faFileExcel, faFilePdf, faUser,
  faUsersGear, faRightFromBracket, faBuilding, faSearchMinus, faCompass, faInbox,
  faChevronLeft, faChevronRight, faChevronDown, faUpload, faCopy, faFloppyDisk,
  faArrowUp, faArrowDown, faBan, faHome,
} from '@fortawesome/free-solid-svg-icons';

/**
 * ============================================================================
 * ICONS — Nexteer UI Kit v7
 * ============================================================================
 * ONE library: Font Awesome 7 (solid by default). No Lucide, Material,
 * Heroicons or loose SVGs — two libraries on one screen change stroke weight
 * and optical box, and it shows even when nobody can say why.
 *
 * Regular (outline) icons are used ONLY to express the filled/empty pair of the
 * same concept: bell with / without unread, checkbox checked / unchecked.
 *
 * Two maps live in a system:
 *   1. `actionIcons` (this file) — universal actions. Same action → same icon
 *      in every system. Do not pick "another pencil".
 *   2. The module map (app/modules.ts) — which icon represents each module.
 *      Sidebar, LoadingState and the module's headers all read from it.
 * ============================================================================
 */
export const actionIcons = {
  add: faPlus,
  edit: faPen,
  delete: faTrash,
  view: faEye,
  save: faFloppyDisk,
  copy: faCopy,
  export: faDownload,
  import: faUpload,
  filter: faFilter,
  search: faMagnifyingGlass,
  close: faXmark,
  back: faArrowLeft,
  notes: faStickyNote,
  reload: faRotateRight,
  confirm: faCheck,
  locked: faLock,
  warning: faTriangleExclamation,
  success: faCircleCheck,
  info: faCircleInfo,
  error: faCircleXmark,
  block: faBan,
  excel: faFileExcel,
  pdf: faFilePdf,
  profile: faUser,
  userAdmin: faUsersGear,
  signOut: faRightFromBracket,
  home: faHome,
  expand: faChevronDown,
  collapseSidebar: faChevronLeft,
  expandSidebar: faChevronRight,
  sortAsc: faArrowUp,
  sortDesc: faArrowDown,
} as const satisfies Record<string, IconDefinition>;

/** Icons of the canonical empty / error situations. */
export const stateIcons = {
  noResults: faSearchMinus,
  notFound: faCompass,
  emptyChart: faInbox,
  genericEntity: faBuilding,
  error: faTriangleExclamation,
} as const satisfies Record<string, IconDefinition>;
