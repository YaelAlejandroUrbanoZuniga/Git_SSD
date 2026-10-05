import type { ReactNode } from 'react';
import { type } from '../tokens/typography';
import { gap } from '../tokens/spacing';

interface Props {
  title: string;
  /** A FACT — how many, or when ("128 suppliers registered", "Updated 5 minutes ago").
   *  Never a slogan ("Manage your suppliers here"). */
  subtitle?: ReactNode;
  /** Buttons on the right (one primary at most). */
  actions?: ReactNode;
}

/** Title block of every list / module screen. Detail screens use DetailHero instead. */
export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: gap.screenBlocks, marginBottom: gap.screenBlocks }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ ...type.pageTitle, margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ ...type.pageSubtitle, margin: '4px 0 0' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: gap.buttons, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
