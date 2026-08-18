import { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUsers, faFileImport, faPen, faTrash, faCalendarPlus, faExternalLinkAlt,
} from '@fortawesome/free-solid-svg-icons';
import type { AppRole, EventProspect, EventProspectsResponse } from '../../types';
import {
  getProspects, markInterest, unmarkInterest, setProspectB2b, deleteImportBatch,
} from '../../services/eventProspectsService';
import { ApiError } from '../../services/api.config';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { relativeLabel, MONTHS_SHORT } from '../../utils/date-helpers';
import { ProspectImportModal } from './ProspectImportModal';
import { ACCENT_COLORS, BRAND_COLORS, NEUTRAL_COLORS } from '../../constants/designTokens';

interface Props {
  eventId: string;
  eventName: string;
  /** Lets the parent keep the tab-count badge and ScoutingEvent.prospectsRegistered in sync without a reload. */
  onCountChange?: (total: number) => void;
}

interface Batch {
  importBatchId: string;
  sourceFileName: string | null;
  importedBy: string;
  importedAt: string;
  rows: EventProspect[];
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

function formatB2bDateTime(value: string): string {
  const [datePart, timePart] = value.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}, ${timePart}`;
}

function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function groupByBatch(prospects: EventProspect[]): Batch[] {
  const map = new Map<string, EventProspect[]>();
  for (const p of prospects) {
    const list = map.get(p.importBatchId);
    if (list) list.push(p); else map.set(p.importBatchId, [p]);
  }
  return [...map.entries()]
    .map(([importBatchId, rows]) => {
      const newest = rows.reduce((max, r) => (r.importedAt > max.importedAt ? r : max), rows[0]);
      return {
        importBatchId,
        sourceFileName: newest.sourceFileName,
        importedBy: newest.importedBy,
        importedAt: newest.importedAt,
        rows: [...rows].sort((a, b) => a.companyName.localeCompare(b.companyName)),
      };
    })
    .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

function StatBlock({ label, value, valueColor }: { label: string; value: number; valueColor?: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: BRAND_COLORS.sidebar, fontWeight: 500, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: valueColor ?? '#000000', margin: '2px 0 0' }}>{value}</p>
    </div>
  );
}

const smallInputStyle: React.CSSProperties = {
  fontSize: 12, padding: '4px 8px', border: `1px solid ${NEUTRAL_COLORS.border}`, borderRadius: 4,
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

function B2bCell({
  eventId, prospect, editable, onUpdated,
}: {
  eventId: string;
  prospect: EventProspect;
  editable: boolean;
  onUpdated: (updated: EventProspect) => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [dateTime, setDateTime] = useState(prospect.b2bDateTime ?? '');
  const [location, setLocation] = useState(prospect.b2bLocation ?? '');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDateTime(prospect.b2bDateTime ?? '');
    setLocation(prospect.b2bLocation ?? '');
    setEditing(true);
  }

  function save() {
    if (!dateTime) {
      toast.validationError('Date & time required', 'Pick a date and time for the B2B meeting.');
      return;
    }
    setSaving(true);
    setProspectB2b(eventId, prospect.id, { b2bScheduled: true, b2bDateTime: dateTime, b2bLocation: location.trim() || null })
      .then(updated => { onUpdated(updated); setEditing(false); })
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The B2B meeting could not be scheduled.'))
      .finally(() => setSaving(false));
  }

  function cancelSchedule() {
    setSaving(true);
    setProspectB2b(eventId, prospect.id, { b2bScheduled: false })
      .then(updated => { onUpdated(updated); setEditing(false); })
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The B2B meeting could not be cancelled.'))
      .finally(() => setSaving(false));
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
        <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} style={smallInputStyle} />
        <input type="text" placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} style={smallInputStyle} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, border: 'none', backgroundColor: BRAND_COLORS.accentRed, color: BRAND_COLORS.cards, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={saving}
            style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, border: `1px solid ${NEUTRAL_COLORS.border}`, backgroundColor: BRAND_COLORS.cards, color: '#000000', cursor: saving ? 'not-allowed' : 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!prospect.b2bScheduled) {
    if (!editable) return <span style={{ color: BRAND_COLORS.sidebar }}>—</span>;
    return (
      <button
        onClick={startEdit}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: `1px solid ${ACCENT_COLORS.info}`, backgroundColor: BRAND_COLORS.cards, color: ACCENT_COLORS.info, cursor: 'pointer' }}
      >
        <FontAwesomeIcon icon={faCalendarPlus} style={{ fontSize: 11 }} /> Schedule B2B
      </button>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: '#000000' }}>
        {formatB2bDateTime(prospect.b2bDateTime!)}
        {prospect.b2bLocation ? ` · ${prospect.b2bLocation}` : ''}
      </span>
      {editable && (
        <>
          <button onClick={startEdit} title="Edit" style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: BRAND_COLORS.sidebar }}>
            <FontAwesomeIcon icon={faPen} style={{ fontSize: 11 }} />
          </button>
          <button onClick={cancelSchedule} disabled={saving} title="Cancel B2B" style={{ background: 'none', border: 'none', padding: 2, cursor: saving ? 'not-allowed' : 'pointer', color: BRAND_COLORS.sidebar }}>
            <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
          </button>
        </>
      )}
    </div>
  );
}

export function TabProspects({ eventId, eventName, onCountChange }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const { canWrite, role } = usePermissions();
  const [data, setData] = useState<EventProspectsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [removingBatch, setRemovingBatch] = useState<Batch | null>(null);
  const [removing, setRemoving] = useState(false);

  function refresh() {
    setLoading(true);
    getProspects(eventId)
      .then(res => {
        setData(res);
        onCountChange?.(res.meta.total);
      })
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'Could not load prospects.'))
      .finally(() => setLoading(false));
  }

  // Mounted only once the tab is first opened (EventDetail renders it conditionally), so this is the lazy fetch.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  function updateOne(updated: EventProspect) {
    setData(prev => (prev ? { ...prev, prospects: prev.prospects.map(p => (p.id === updated.id ? updated : p)) } : prev));
  }

  function handleMark(prospect: EventProspect) {
    const previous = prospect;
    const optimistic: EventProspect = {
      ...prospect,
      interested: true,
      interestedBy: user?.displayName ?? null,
      interestedById: user?.id ?? null,
      interestedAt: new Date().toISOString(),
    };
    updateOne(optimistic);
    markInterest(eventId, prospect.id)
      .then(updateOne)
      .catch(err => {
        if (err instanceof ApiError && err.status === 409) {
          toast.warning('Already marked', err.message);
          refresh();
          return;
        }
        updateOne(previous);
        toast.systemError(err instanceof ApiError ? err.message : 'Interest could not be marked.');
      });
  }

  function handleUnmark(prospect: EventProspect) {
    const previous = prospect;
    const optimistic: EventProspect = {
      ...prospect, interested: false, interestedBy: null, interestedById: null, interestedAt: null,
    };
    updateOne(optimistic);
    unmarkInterest(eventId, prospect.id)
      .then(updateOne)
      .catch(err => {
        if (err instanceof ApiError && err.status === 403) {
          toast.warning('Could not remove this interest', err.message);
          refresh();
          return;
        }
        updateOne(previous);
        toast.systemError(err instanceof ApiError ? err.message : 'Interest could not be removed.');
      });
  }

  function handleRemoveBatch() {
    if (!removingBatch) return;
    setRemoving(true);
    deleteImportBatch(eventId, removingBatch.importBatchId)
      .then(res => {
        toast.success('Import removed', `${res.deleted} prospect(s) from "${removingBatch.sourceFileName ?? 'unnamed file'}" were removed.`);
        setRemovingBatch(null);
        refresh();
      })
      .catch(err => toast.systemError(err instanceof ApiError ? err.message : 'The import could not be removed.'))
      .finally(() => setRemoving(false));
  }

  if (loading) {
    return <LoadingState entity="Prospects" icon={faUsers} />;
  }
  if (!data) return null;

  const batches = groupByBatch(data.prospects);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        {canWrite && (
          <button
            onClick={() => setShowImport(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, border: `1px solid ${NEUTRAL_COLORS.border}`, backgroundColor: BRAND_COLORS.cards, color: '#000000', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = NEUTRAL_COLORS.panelBg)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = BRAND_COLORS.cards)}
          >
            <FontAwesomeIcon icon={faFileImport} style={{ fontSize: 12 }} /> Import Excel
          </button>
        )}
      </div>

      {data.prospects.length === 0 ? (
        <EmptyState icon={faUsers} title="No prospects" description="No prospect list has been imported for this event yet." />
      ) : (
        <>
          {/* Summary strip */}
          <div style={{
            backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', marginBottom: 16,
          }}>
            <StatBlock label="Total" value={data.meta.total} />
            <StatBlock label="Interested" value={data.meta.interested} valueColor="#6ABF4B" />
            <StatBlock label="Unmarked" value={data.meta.unmarked} />
            <StatBlock label="B2B scheduled" value={data.meta.b2bScheduled} valueColor={ACCENT_COLORS.info} />
            {data.meta.interestDeadline && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: BRAND_COLORS.sidebar, margin: 0 }}>Interest deadline</p>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#000000', margin: '2px 0 0' }}>
                  {formatIsoDate(data.meta.interestDeadline)}
                </p>
                {data.meta.deadlinePassed && (
                  <p style={{ fontSize: 11, fontWeight: 700, color: BRAND_COLORS.accentRed, margin: '4px 0 0' }}>Interest deadline passed</p>
                )}
              </div>
            )}
          </div>

          {/* Table, grouped by import batch */}
          <div style={{ backgroundColor: BRAND_COLORS.cards, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: NEUTRAL_COLORS.panelBg, borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}` }}>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Company</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Type of product</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Website</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>Interest</th>
                  <th style={{ textAlign: 'left', padding: '10px 16px', fontWeight: 600, color: NEUTRAL_COLORS.textDark }}>B2B</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <BatchGroup
                    key={batch.importBatchId}
                    batch={batch}
                    eventId={eventId}
                    role={role}
                    currentUserId={user?.id}
                    onRowUpdated={updateOne}
                    onMark={handleMark}
                    onUnmark={handleUnmark}
                    onRemoveBatch={() => setRemovingBatch(batch)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showImport && (
        <ProspectImportModal
          eventId={eventId}
          eventName={eventName}
          onClose={() => setShowImport(false)}
          onImported={refresh}
        />
      )}

      {removingBatch && (
        <ConfirmDialog
          title="Remove this import?"
          message={(
            <>
              This permanently deletes all <strong style={{ color: '#000000' }}>{removingBatch.rows.length}</strong> prospect(s)
              imported from <strong style={{ color: '#000000' }}>"{removingBatch.sourceFileName ?? 'unnamed file'}"</strong>. This
              cannot be undone.
            </>
          )}
          confirmLabel={removing ? 'Removing…' : 'Remove import'}
          confirmDisabled={removing}
          onCancel={() => setRemovingBatch(null)}
          onConfirm={handleRemoveBatch}
        />
      )}
    </div>
  );
}

function BatchGroup({
  batch, eventId, role, currentUserId, onRowUpdated, onMark, onUnmark, onRemoveBatch,
}: {
  batch: Batch;
  eventId: string;
  role: AppRole | null;
  currentUserId: string | undefined;
  onRowUpdated: (p: EventProspect) => void;
  onMark: (p: EventProspect) => void;
  onUnmark: (p: EventProspect) => void;
  onRemoveBatch: () => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={5} style={{ padding: '8px 16px', backgroundColor: '#FAFAFA', borderTop: `1px solid ${NEUTRAL_COLORS.borderLight}`, borderBottom: `1px solid ${NEUTRAL_COLORS.borderLight}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: BRAND_COLORS.sidebar }}>
              {batch.sourceFileName ?? 'Unnamed file'} · imported {relativeLabel(batch.importedAt)} by {batch.importedBy}
            </span>
            {role === 'SSD' && (
              <button
                onClick={onRemoveBatch}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: BRAND_COLORS.accentRed }}
              >
                <FontAwesomeIcon icon={faTrash} style={{ fontSize: 10 }} /> Remove this import
              </button>
            )}
          </div>
        </td>
      </tr>
      {batch.rows.map(prospect => (
        <ProspectRow
          key={prospect.id}
          eventId={eventId}
          prospect={prospect}
          role={role}
          currentUserId={currentUserId}
          onUpdated={onRowUpdated}
          onMark={onMark}
          onUnmark={onUnmark}
        />
      ))}
    </>
  );
}

function ProspectRow({
  eventId, prospect, role, currentUserId, onUpdated, onMark, onUnmark,
}: {
  eventId: string;
  prospect: EventProspect;
  role: AppRole | null;
  currentUserId: string | undefined;
  onUpdated: (p: EventProspect) => void;
  onMark: (p: EventProspect) => void;
  onUnmark: (p: EventProspect) => void;
}) {
  const isOwner = !!currentUserId && prospect.interestedById === currentUserId;

  return (
    <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
      <td style={{ padding: '10px 16px', color: '#000000', fontWeight: 500 }}>{prospect.companyName}</td>
      <td style={{ padding: '10px 16px', color: NEUTRAL_COLORS.textDark }}>{prospect.productType ?? '—'}</td>
      <td style={{ padding: '10px 16px' }}>
        {prospect.website ? (
          <a
            href={websiteHref(prospect.website)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: ACCENT_COLORS.info, fontSize: 13, textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            {prospect.website} <FontAwesomeIcon icon={faExternalLinkAlt} style={{ fontSize: 10 }} />
          </a>
        ) : (
          <span style={{ color: BRAND_COLORS.sidebar }}>—</span>
        )}
      </td>
      <td style={{ padding: '10px 16px' }}>
        {prospect.interested ? (
          <div>
            <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#6ABF4B', backgroundColor: '#6ABF4B15', borderRadius: 4, padding: '2px 8px' }}>
              Interested
            </span>
            <p style={{ fontSize: 11, color: BRAND_COLORS.sidebar, margin: '4px 0 0' }}>
              by {prospect.interestedBy ?? '—'} · {relativeLabel(prospect.interestedAt)}
            </p>
            {isOwner && (
              <button
                onClick={() => onUnmark(prospect)}
                style={{ marginTop: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 600, color: BRAND_COLORS.accentRed }}
              >
                Unmark
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => onMark(prospect)}
            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #6ABF4B', borderRadius: 6, backgroundColor: BRAND_COLORS.cards, color: '#6ABF4B', cursor: 'pointer' }}
          >
            Mark interested
          </button>
        )}
      </td>
      <td style={{ padding: '10px 16px' }}>
        <B2bCell eventId={eventId} prospect={prospect} editable={role === 'SSD'} onUpdated={onUpdated} />
      </td>
    </tr>
  );
}
