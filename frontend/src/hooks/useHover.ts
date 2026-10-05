import { useState } from 'react';

/**
 * Hover as React state — the ONLY way components in this kit do hover.
 *
 * Writing `e.currentTarget.style.backgroundColor` from onMouseEnter/Leave makes
 * hover fight every other state that wants the same property (selected row,
 * active item, zebra stripe): hovering a selected row "unselects" it visually,
 * and leaving a zebra row restores the wrong stripe. With state, all of them
 * feed ONE computed style and the priority is explicit:
 *
 *   const [hovered, hoverProps] = useHover();
 *   const bg = selected ? SELECTED : hovered ? HOVER : REST;
 *   <div {...hoverProps} style={{ backgroundColor: bg }} />
 */
export function useHover(disabled = false) {
  const [hovered, setHovered] = useState(false);
  const hoverProps = {
    onMouseEnter: () => { if (!disabled) setHovered(true); },
    onMouseLeave: () => setHovered(false),
  };
  return [hovered && !disabled, hoverProps] as const;
}
