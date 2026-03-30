'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/UserContext';
import {
  TrendingUp, Bot, Users, Zap, Target,
  CheckSquare, Square, ArrowRight, Plus,
  ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPI {
  pipeline_total: number;
  active_deals: number;
  outreach_this_month: number;
  meetings_this_week: number;
  won_this_month: number;
  total_leads: number;
}

interface KanbanLead {
  id: string;
  company: string;
  contact_name: string | null;
  status: string;
  priority: string;
  market: string;
  assigned_name: string | null;
  pipeline_value: number;
}

interface ActivityItem {
  id: string;
  action: string;
  details: string | null;
  result: string;
  created_at: string;
  agent_name: string;
  lead_company: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AgentItem {
  id: string;
  name: string;
  market: string;
  status: string;
  last_action: string | null;
  last_run: string | null;
}

interface DashData {
  kpi: KPI;
  status_counts: Record<string, number>;
  kanban: KanbanLead[];
  activity: ActivityItem[];
  users: TeamMember[];
  agents: AgentItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 10) return 'God morgen';
  if (h < 13) return 'God formiddag';
  if (h < 17) return 'God eftermiddag';
  return 'God aften';
}

function fmtKr(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

function timeAgo(iso: string) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'nu';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} time${h > 1 ? 'r' : ''}`;
  return `${Math.floor(h / 24)} dag${Math.floor(h / 24) > 1 ? 'e' : ''}`;
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const STATUS_COLORS: Record<string, string> = {
  info: '#E84025',
  success: '#2ECC71',
  warning: '#F39C12',
  error: '#E74C3C',
};

const AGENT_COLORS = [
  '#E84025', '#2ECC71', '#9B59B6', '#E74C3C',
  '#F39C12', '#1ABC9C', '#E91E63', '#FF5722',
];

// ─── Kanban columns config ─────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'new',        label: 'NY',           color: '#445566' },
  { key: 'contacted',  label: 'KONTAKTET',    color: '#E84025' },
  { key: 'replied',    label: 'SVAREDE',      color: '#1ABC9C' },
  { key: 'interested', label: 'INTERESSERET', color: '#F39C12' },
  { key: 'booked',     label: 'BOOKET',       color: '#9B59B6' },
  { key: 'won',        label: 'VUNDET',       color: '#2ECC71' },
];

// ─── Sparkline SVG ─────────────────────────────────────────────────────────────

function Spark({ color }: { color: string }) {
  // Fake sparkline — decorative
  const pts = [8, 12, 7, 14, 10, 16, 11, 18, 13, 15, 17, 20];
  const w = 64, h = 24;
  const min = Math.min(...pts), max = Math.max(...pts);
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

// ─── Tasks (urgent + follow-ups from status_counts) ────────────────────────────

const TASK_COLORS: Record<string, string> = {
  CRM: '#E84025',
  Agent: '#9B59B6',
  Mail: '#1ABC9C',
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useUser();
  const [data, setData] = useState<DashData | null>(null);
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Tjek interesserede leads i CRM', tag: 'CRM', done: false },
    { id: 2, text: 'Gennemgå ny outreach klar til send', tag: 'Agent', done: false },
    { id: 3, text: 'Besvar mails i indbakken', tag: 'Mail', done: false },
  ]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const kpi = data?.kpi;
  const pipelineTotal = kpi ? Object.entries(data!.status_counts)
    .filter(([s]) => !['deleted', 'lost'].includes(s))
    .reduce((a, [, v]) => a + v, 0) : 0;

  return (
    <div style={{ padding: '0', minHeight: '100vh', background: '#0B1520' }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={{
        padding: '18px 28px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#ECF0F1', letterSpacing: '-0.3px' }}>
            {greeting()}, {user?.name?.split(' ')[0] || 'der'} 👋
          </h1>
          <div style={{ fontSize: '12px', color: '#445566', marginTop: '3px' }}>
            {new Date().toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}BusyGroup
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link href="/crm" style={{
            padding: '8px 14px', borderRadius: '7px',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#AAB8C2', fontSize: '12px', fontWeight: 500,
            textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px',
            background: 'transparent',
          }}>
            <TrendingUp size={13} /> Åbn CRM
          </Link>
          <Link href="/pipeline" style={{
            padding: '8px 16px', borderRadius: '7px',
            background: '#E84025', color: '#fff',
            fontSize: '12px', fontWeight: 600, textDecoration: 'none',
            display: 'flex', alignItems: 'center', gap: '5px',
          }}>
            <Bot size={13} /> Agenter
          </Link>
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────── */}
      <div style={{ padding: '16px 28px 0', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>

        {/* Pipeline total */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', color: '#445566', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Pipeline Værdi
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#ECF0F1', lineHeight: 1 }}>
                {kpi ? fmtKr(kpi.pipeline_total) : '—'} <span style={{ fontSize: '14px', color: '#445566' }}>kr.</span>
              </div>
              <div style={{ fontSize: '11px', color: '#2ECC71', marginTop: '5px' }}>
                ↑ Aktiv pipeline
              </div>
            </div>
            <Spark color="#2ECC71" />
          </div>
        </div>

        {/* Aktive deals */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', color: '#445566', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Aktive Deals
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#ECF0F1', lineHeight: 1 }}>
                {kpi?.active_deals ?? '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#E84025', marginTop: '5px' }}>
                ↑ {data?.status_counts?.new || 0} nye leads
              </div>
            </div>
            <Spark color="#E84025" />
          </div>
        </div>

        {/* Outreach */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', color: '#445566', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Outreach denne md.
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#ECF0F1', lineHeight: 1 }}>
                {kpi?.outreach_this_month ?? '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#F39C12', marginTop: '5px' }}>
                emails sendt
              </div>
            </div>
            <Spark color="#F39C12" />
          </div>
        </div>

        {/* Møder */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px 18px' }}>
          <div style={{ fontSize: '11px', color: '#445566', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Møder denne uge
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#ECF0F1', lineHeight: 1 }}>
                {kpi?.meetings_this_week ?? '—'}
              </div>
              <div style={{ fontSize: '11px', color: '#9B59B6', marginTop: '5px' }}>
                bookede møder
              </div>
            </div>
            <Spark color="#9B59B6" />
          </div>
        </div>
      </div>

      {/* ── Main area: Pipeline + Sidebar ───────────────────── */}
      <div style={{ padding: '16px 28px 0', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '14px' }}>

        {/* Pipeline Kanban */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Target size={14} style={{ color: '#E84025' }} />
              <span style={{ fontWeight: 600, fontSize: '13px', color: '#ECF0F1' }}>Sales Pipeline</span>
              <span style={{ fontSize: '11px', color: '#445566', background: 'rgba(255,255,255,0.04)', borderRadius: '5px', padding: '2px 8px' }}>
                {pipelineTotal} leads
              </span>
            </div>
            <Link href="/crm" style={{
              fontSize: '11px', color: '#E84025', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '3px',
            }}>
              Åbn CRM <ArrowRight size={11} />
            </Link>
          </div>

          {/* Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', overflowX: 'auto' }}>
            {COLUMNS.map(col => {
              const leads = (data?.kanban || []).filter(l => l.status === col.key).slice(0, 4);
              const count = data?.status_counts?.[col.key] || 0;
              return (
                <div key={col.key} style={{ minWidth: 0 }}>
                  {/* Column header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '8px',
                  }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: col.color, letterSpacing: '0.06em' }}>
                      {col.label}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 700,
                      background: `${col.color}22`, color: col.color,
                      borderRadius: '8px', padding: '1px 6px',
                    }}>
                      {count}
                    </span>
                  </div>

                  {/* Lead cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {leads.length === 0 ? (
                      <div style={{
                        height: '60px', borderRadius: '7px',
                        border: '1px dashed rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: '10px', color: '#334455' }}>Tom</span>
                      </div>
                    ) : (
                      leads.map(lead => (
                        <Link
                          key={lead.id}
                          href="/crm"
                          style={{
                            background: '#0F1923', border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: '7px', padding: '8px 10px', textDecoration: 'none',
                            display: 'block', transition: 'border-color 0.15s',
                            borderLeft: `2px solid ${col.color}`,
                          }}
                        >
                          <div style={{
                            fontSize: '11px', fontWeight: 600, color: '#ECF0F1',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginBottom: '3px',
                          }}>
                            {lead.company}
                          </div>
                          {lead.contact_name && (
                            <div style={{
                              fontSize: '10px', color: '#445566',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              marginBottom: '4px',
                            }}>
                              {lead.contact_name}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            {lead.pipeline_value > 0 ? (
                              <span style={{ fontSize: '10px', color: col.color, fontWeight: 600 }}>
                                {fmtKr(lead.pipeline_value)} kr.
                              </span>
                            ) : (
                              <span style={{ fontSize: '10px', color: '#334455' }}>
                                {lead.market?.toUpperCase()}
                              </span>
                            )}
                            {lead.assigned_name && (
                              <span style={{
                                fontSize: '9px', color: '#334455',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                maxWidth: '50px',
                              }}>
                                {lead.assigned_name.split(' ')[0]}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))
                    )}
                    {count > 4 && (
                      <Link href="/crm" style={{
                        fontSize: '10px', color: '#445566', textAlign: 'center', padding: '4px',
                        textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                      }}>
                        +{count - 4} mere <ChevronRight size={9} />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar: Live aktivitet + Mine opgaver */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Live aktivitet */}
          <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={13} style={{ color: '#F39C12' }} />
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#ECF0F1' }}>Live aktivitet</span>
              </div>
              <Link href="/pipeline" style={{ fontSize: '11px', color: '#445566', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}>
                Alt <ArrowRight size={10} />
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(data?.activity || []).length === 0 ? (
                <div style={{ fontSize: '12px', color: '#334455', textAlign: 'center', padding: '16px 0' }}>
                  Ingen aktivitet endnu
                </div>
              ) : (
                (data?.activity || []).slice(0, 6).map((item, i) => {
                  const color = AGENT_COLORS[i % AGENT_COLORS.length];
                  const initStr = initials(item.agent_name || 'AG');
                  return (
                    <div key={item.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                        background: `${color}22`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 700, color,
                      }}>
                        {initStr}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '11px', color: '#ECF0F1', lineHeight: 1.4 }}>
                          <span style={{ color, fontWeight: 600 }}>{item.agent_name}</span>
                          {' '}{item.action}
                          {item.lead_company && (
                            <span style={{ color: '#AAB8C2' }}> — {item.lead_company}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '10px', color: '#334455', marginTop: '2px', display: 'flex', gap: '6px' }}>
                          <span>{timeAgo(item.created_at)}</span>
                          <span style={{
                            color: STATUS_COLORS[item.result] || '#445566',
                            background: `${STATUS_COLORS[item.result] || '#445566'}18`,
                            borderRadius: '3px', padding: '0 4px',
                          }}>
                            {item.result}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Mine opgaver */}
          <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckSquare size={13} style={{ color: '#2ECC71' }} />
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#ECF0F1' }}>Mine opgaver</span>
              </div>
              <button
                onClick={() => setTasks(prev => [...prev, { id: Date.now(), text: 'Ny opgave', tag: 'CRM', done: false }])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2ECC71', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px' }}
              >
                <Plus size={12} /> Ny
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tasks.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, done: !t.done } : t))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: task.done ? '#2ECC71' : '#445566', flexShrink: 0 }}
                  >
                    {task.done ? <CheckSquare size={14} /> : <Square size={14} />}
                  </button>
                  <span style={{
                    flex: 1, fontSize: '12px', color: task.done ? '#445566' : '#AAB8C2',
                    textDecoration: task.done ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {task.text}
                  </span>
                  <span style={{
                    fontSize: '9px', fontWeight: 600, color: TASK_COLORS[task.tag] || '#445566',
                    background: `${TASK_COLORS[task.tag] || '#445566'}20`,
                    borderRadius: '4px', padding: '2px 5px', flexShrink: 0,
                  }}>
                    {task.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom row ───────────────────────────────────────── */}
      <div style={{ padding: '14px 28px 28px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>

        {/* Lead funnel */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#ECF0F1', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={13} style={{ color: '#E84025' }} /> Lead Funnel
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {COLUMNS.map(col => {
              const cnt = data?.status_counts?.[col.key] || 0;
              const max = Math.max(...COLUMNS.map(c => data?.status_counts?.[c.key] || 0), 1);
              const pct = Math.round((cnt / max) * 100);
              return (
                <div key={col.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', color: '#667788' }}>{col.label}</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: col.color }}>{cnt}</span>
                  </div>
                  <div style={{ height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: col.color, borderRadius: '3px', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Team status */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#ECF0F1', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={13} style={{ color: '#2ECC71' }} /> Team
            </h3>
            <Link href="/settings" style={{ fontSize: '11px', color: '#445566', textDecoration: 'none' }}>
              Administrer
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(data?.users || []).length === 0 ? (
              <div style={{ fontSize: '12px', color: '#334455', textAlign: 'center', padding: '16px 0' }}>Ingen brugere</div>
            ) : (
              (data?.users || []).map((u, i) => {
                const color = AGENT_COLORS[i % AGENT_COLORS.length];
                return (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                      background: `${color}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color,
                    }}>
                      {initials(u.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: '#ECF0F1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.name}
                      </div>
                      <div style={{ fontSize: '10px', color: '#445566' }}>{u.email}</div>
                    </div>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
                      color: u.role === 'admin' ? '#E74C3C' : '#E84025',
                      background: u.role === 'admin' ? 'rgba(231,76,60,0.1)' : 'rgba(232,64,37,0.1)',
                      borderRadius: '4px', padding: '2px 6px',
                    }}>
                      {u.role === 'admin' ? 'Admin' : 'Sælger'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Agenter status */}
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#ECF0F1', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={13} style={{ color: '#9B59B6' }} /> Agenter
            </h3>
            <Link href="/pipeline" style={{ fontSize: '11px', color: '#445566', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}>
              Alle <ArrowRight size={10} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {(data?.agents || []).length === 0 ? (
              <div style={{ fontSize: '12px', color: '#334455', textAlign: 'center', padding: '16px 0' }}>Ingen agenter</div>
            ) : (
              (data?.agents || []).slice(0, 6).map(agent => {
                const isRunning = agent.status === 'running';
                const isError = agent.status === 'error';
                const dotColor = isRunning ? '#2ECC71' : isError ? '#E74C3C' : '#445566';
                return (
                  <div key={agent.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                      background: dotColor,
                      boxShadow: isRunning ? `0 0 6px ${dotColor}` : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: '#AAB8C2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {agent.name}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '9px', color: '#334455',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: '70px', textAlign: 'right',
                    }}>
                      {agent.last_run ? timeAgo(agent.last_run) : 'Aldrig'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
