'use client';

import { useEffect, useMemo, useState } from 'react';
import { stageConfig, sourceLabel, fmtDateShort, daysUntil } from '@/lib/recruitment';

interface FunnelRow { stage: string; label: string; count: number; pct_of_total: number; dropoff: number; dropoff_pct: number }
interface StageDuration { stage: string; label: string; avg_days: number | null }
interface SourceRow { source: string; count: number; hired: number; hire_rate: number }
interface CompanyRow { company_id: number | null; company_name: string; count: number; hired: number; hire_rate: number }
interface UpcomingStart {
  id: number; full_name: string; applying_for: string; company_id: number | null;
  company_name: string | null; company_color: string | null; start_date: string;
  checklist_total: number; checklist_done: number;
}
interface Analytics {
  from: string; to: string;
  total_applications: number; total_applications_prev: number;
  by_stage: Record<string, number>;
  hired_count: number; stopped_count: number;
  conversion_rates: {
    application_to_interview: number; application_to_offer: number; application_to_hire: number;
    samtale_to_tilbud: number; tilbud_to_ansat: number;
    hire_retention_30d: number | null; hire_retention_90d: number | null;
  };
  avg_days_to_hire: number | null;
  avg_days_per_stage: StageDuration[];
  by_source: SourceRow[];
  by_company: CompanyRow[];
  upcoming_starts: UpcomingStart[];
  funnel: FunnelRow[];
  cohort_size: number;
}

const RANGE_OPTIONS = [
  { key: '30', label: 'Sidste 30 dage', days: 30 },
  { key: '90', label: 'Sidste 90 dage', days: 90 },
  { key: '180', label: 'Sidste 6 måneder', days: 180 },
  { key: '365', label: 'Sidste 12 måneder', days: 365 },
  { key: 'all', label: 'Alt', days: 3650 },
];

// Fixed categorical hues, in order — mirrors the accent colors already used for
// company/avatar badges elsewhere in the app (see lib/recruitment.ts avatarColor).
const SOURCE_COLORS = ['#4f8ef7', '#2dd4a0', '#a78bfa', '#f59e0b', '#ff6b35'];

export default function AnalyticsModal({ onClose, onOpenCandidate }: { onClose: () => void; onOpenCandidate: (id: number) => void }) {
  const [range, setRange] = useState('90');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const opt = RANGE_OPTIONS.find(o => o.key === range)!;
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - opt.days * 86400000).toISOString().slice(0, 10);
    setLoading(true);
    fetch(`/api/hr/recruitment/analytics?from=${from}&to=${to}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [range]);

  const deltaPct = useMemo(() => {
    if (!data || !data.total_applications_prev) return null;
    return ((data.total_applications - data.total_applications_prev) / data.total_applications_prev) * 100;
  }, [data]);

  const hireRatePct = data && data.total_applications > 0 ? (data.hired_count / data.total_applications) * 100 : 0;
  const maxFunnel = data ? Math.max(1, ...data.funnel.map(f => f.count)) : 1;
  const maxStageDuration = data ? Math.max(1, ...data.avg_days_per_stage.map(s => s.avg_days ?? 0)) : 1;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', zIndex: 600, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--s1)', borderRadius: 14, width: 700, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 40px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--s1)', borderBottom: '1px solid var(--bd)', padding: '18px 24px', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)' }}>Rekruttering — Overblik</div>
          <select value={range} onChange={e => setRange(e.target.value)} style={{ marginLeft: 'auto', fontSize: 12, width: 'auto' }}>
            {RANGE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t3)', fontSize: 20, cursor: 'pointer', padding: 0 }}>×</button>
        </div>

        {loading || !data ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>
        ) : (
          <div style={{ padding: '20px 24px 32px' }}>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
              <KpiCard label="Ansøgninger i alt" value={String(data.total_applications)}
                sub={deltaPct !== null ? `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(0)}% vs. forrige periode` : undefined} />
              <KpiCard label="Ansættelsesrate" value={`${hireRatePct.toFixed(1)}%`}
                sub={data.total_applications > 0 ? `1 ud af ${Math.round(data.total_applications / Math.max(1, data.hired_count))} ansøgninger` : undefined} />
              <KpiCard label="Gns. tid til ansættelse" value={data.avg_days_to_hire !== null ? `${data.avg_days_to_hire.toFixed(0)} dage` : '—'} />
              <KpiCard label="Retention > 30 dage"
                value={data.conversion_rates.hire_retention_30d !== null ? `${(data.conversion_rates.hire_retention_30d * 100).toFixed(0)}%` : '—'}
                color={data.conversion_rates.hire_retention_30d === null ? undefined : data.conversion_rates.hire_retention_30d > 0.8 ? 'var(--gr)' : data.conversion_rates.hire_retention_30d > 0.6 ? 'var(--ye)' : 'var(--re)'} />
            </div>

            {/* Funnel */}
            <SectionTitle>Rekrutteringstragt</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {data.funnel.map(f => {
                const color = stageConfig(f.stage)?.color ?? 'var(--bl)';
                return (
                  <div key={f.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 100, fontSize: 11, color: 'var(--t2)', flexShrink: 0 }}>{f.label}</div>
                    <div style={{ flex: 1, height: 18, background: 'var(--s3)', borderRadius: 4, overflow: 'hidden' }} title={`${f.count} (${(f.pct_of_total * 100).toFixed(0)}%)`}>
                      <div style={{ height: '100%', width: `${(f.count / maxFunnel) * 100}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ width: 56, textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--t1)', flexShrink: 0 }}>{f.count}</div>
                    <div style={{ width: 42, textAlign: 'right', fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{(f.pct_of_total * 100).toFixed(0)}%</div>
                    <div style={{ width: 60, textAlign: 'right', fontSize: 10, color: f.dropoff > 0 ? 'var(--re)' : 'var(--t3)', flexShrink: 0 }}>
                      {f.dropoff > 0 ? `-${f.dropoff} (-${(f.dropoff_pct * 100).toFixed(0)}%)` : ''}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Conversion metrics */}
            <SectionTitle>Konverteringsrater</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              <ConversionRow label="Ansøgning → Samtale" value={data.conversion_rates.application_to_interview} benchmark={[0.3, 0.6]} />
              <ConversionRow label="Samtale → Tilbud" value={data.conversion_rates.samtale_to_tilbud} benchmark={[0.2, 0.4]} />
              <ConversionRow label="Tilbud → Ansat" value={data.conversion_rates.tilbud_to_ansat} benchmark={[0.4, 0.7]} />
              <ConversionRow label="Ansat → > 30 dage" value={data.conversion_rates.hire_retention_30d} benchmark={[0.7, 0.9]} />
              <ConversionRow label="Ansat → > 90 dage" value={data.conversion_rates.hire_retention_90d} benchmark={[0.6, 0.85]} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 28 }}>Typisk: Ansøgning → Ansættelse er 5-15% ({(data.conversion_rates.application_to_hire * 100).toFixed(1)}% i denne periode)</div>

            {/* Time per stage */}
            <SectionTitle>Tid i hvert stadie (gennemsnit)</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {data.avg_days_per_stage.map(s => (
                <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 160, fontSize: 11, color: 'var(--t2)', flexShrink: 0 }}>{s.label}</div>
                  <div style={{ flex: 1, height: 14, background: 'var(--s3)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${((s.avg_days ?? 0) / maxStageDuration) * 100}%`, background: 'var(--bl)', borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 60, textAlign: 'right', fontSize: 11, color: 'var(--t1)', flexShrink: 0 }}>{s.avg_days !== null ? `${s.avg_days.toFixed(1)} dage` : '—'}</div>
                </div>
              ))}
            </div>

            {/* Upcoming starts */}
            <SectionTitle>Kommende opstarter</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
              {data.upcoming_starts.map(u => {
                const days = daysUntil(u.start_date) ?? 0;
                const pct = u.checklist_total > 0 ? u.checklist_done / u.checklist_total : 0;
                const lowChecklist = pct < 0.5 && days <= 7;
                return (
                  <div key={u.id} onClick={() => onOpenCandidate(u.id)}
                    style={{ padding: '10px 12px', borderRadius: 8, background: lowChecklist ? 'var(--re2)' : 'var(--s2)', border: `1px solid ${lowChecklist ? 'var(--re)' : 'var(--bd)'}`, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{u.full_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--t3)' }}>· {u.applying_for}</span>
                      {u.company_name && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: `${u.company_color ?? '#4f8ef7'}22`, color: u.company_color ?? '#4f8ef7' }}>{u.company_name}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>Starter: {fmtDateShort(u.start_date)} (om {days} {days === 1 ? 'dag' : 'dage'})</div>
                    <div style={{ fontSize: 11, color: lowChecklist ? 'var(--re)' : 'var(--t3)' }}>
                      Tjekliste: {u.checklist_done}/{u.checklist_total} {u.checklist_total - u.checklist_done > 0 ? `— ${u.checklist_total - u.checklist_done} opgaver mangler` : '✓'}
                    </div>
                  </div>
                );
              })}
              {data.upcoming_starts.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>Ingen kommende opstarter</div>}
            </div>

            {/* Source breakdown */}
            <SectionTitle>Ansøgninger per kilde</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.by_source.map((s, i) => {
                const total = data.by_source.reduce((sum, r) => sum + r.count, 0);
                const pct = total > 0 ? (s.count / total) * 100 : 0;
                return (
                  <div key={s.source} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: SOURCE_COLORS[i % SOURCE_COLORS.length], flexShrink: 0 }} />
                    <div style={{ width: 90, fontSize: 11, color: 'var(--t2)', flexShrink: 0 }}>{sourceLabel(s.source)}</div>
                    <div style={{ flex: 1, height: 14, background: 'var(--s3)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: SOURCE_COLORS[i % SOURCE_COLORS.length], borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 90, textAlign: 'right', fontSize: 11, color: 'var(--t1)', flexShrink: 0 }}>{s.count} ({pct.toFixed(0)}%)</div>
                    <div style={{ width: 90, textAlign: 'right', fontSize: 10, color: 'var(--t3)', flexShrink: 0 }}>{(s.hire_rate * 100).toFixed(0)}% ansat</div>
                  </div>
                );
              })}
              {data.by_source.length === 0 && <div style={{ fontSize: 12, color: 'var(--t3)' }}>Ingen data i perioden</div>}
              {data.by_source.length > 0 && (() => {
                const best = [...data.by_source].sort((a, b) => b.hire_rate - a.hire_rate)[0];
                return best && best.count > 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                    {sourceLabel(best.source)} har højest ansættelsesrate ({(best.hire_rate * 100).toFixed(0)}%)
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 9, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 700, color: color ?? 'var(--t1)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>{children}</div>;
}

function ConversionRow({ label, value, benchmark }: { label: string; value: number | null; benchmark: [number, number] }) {
  const color = value === null ? 'var(--t3)' : value >= benchmark[1] ? 'var(--gr)' : value >= benchmark[0] ? 'var(--ye)' : 'var(--re)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value !== null ? `${(value * 100).toFixed(0)}%` : '—'}</span>
    </div>
  );
}
