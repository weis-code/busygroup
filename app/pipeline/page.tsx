'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { MarketBadge, LeadStatusBadge } from '@/components/StatusBadge';
import { Bot, Play, Clock, Zap, TrendingUp, AlertCircle } from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Agent {
  id: string;
  name: string;
  market: string;
  status: 'active' | 'idle' | 'error';
  last_action: string | null;
  last_run: string | null;
  runs_today: number;
}

interface Pipeline {
  new: number;
  contacted: number;
  replied: number;
  interested: number;
  booked: number;
  won: number;
  lost: number;
  total_leads: number;
  meetings_this_week: number;
  outreach_sent: number;
  conversion_rate: number;
}

interface Lead {
  id: string;
  company: string;
  contact_name: string;
  priority: string;
  status: string;
  market: string;
  updated_at: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function timeAgo(iso: string | null): string {
  if (!iso) return 'Aldrig';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Lige nu';
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} t siden`;
  const days = Math.floor(hrs / 24);
  return `${days} dag${days !== 1 ? 'e' : ''} siden`;
}

function statusDotColor(status: Agent['status']): string {
  if (status === 'active') return '#2ECC71';
  if (status === 'error') return '#E74C3C';
  return '#F39C12';
}

function convRate(from: number, to: number): string {
  if (!from) return '0%';
  return `${Math.round((to / from) * 100)}%`;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const WEEK_DATA = [
  { week: 'Uge 1', moeder: 1 },
  { week: 'Uge 2', moeder: 0 },
  { week: 'Uge 3', moeder: 2 },
  { week: 'Uge 4', moeder: 1 },
  { week: 'Uge 5', moeder: 3 },
  { week: 'Uge 6', moeder: 2 },
  { week: 'Uge 7', moeder: 1 },
  { week: 'Uge 8', moeder: 2 },
];

const tooltipStyle: React.CSSProperties = {
  background: '#1A2A38',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '6px',
  color: '#ECF0F1',
  fontSize: '12px',
};

const card: React.CSSProperties = {
  background: '#111E2A',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '10px',
  padding: '16px',
};

/* ─── Agent Card ────────────────────────────────────────────────────────── */

function AgentCard({ agent, onRun }: { agent: Agent; onRun: (id: string) => Promise<void> }) {
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState<'ok' | 'err' | null>(null);

  const dotColor = statusDotColor(agent.status);

  async function handleRun() {
    setRunning(true);
    try {
      await onRun(agent.id);
      setFlash('ok');
    } catch {
      setFlash('err');
    } finally {
      setRunning(false);
      setTimeout(() => setFlash(null), 2500);
    }
  }

  return (
    <div style={{
      ...card,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'border-color 0.2s',
      borderColor: flash === 'ok'
        ? 'rgba(46,204,113,0.35)'
        : flash === 'err'
        ? 'rgba(231,76,60,0.35)'
        : 'rgba(255,255,255,0.06)',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Status dot */}
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
          boxShadow: agent.status === 'active' ? `0 0 6px ${dotColor}` : 'none',
        }} />

        {/* Agent name */}
        <span style={{
          flex: 1,
          fontSize: '13px',
          fontWeight: 600,
          color: '#ECF0F1',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {agent.name}
        </span>

        {/* Market badge */}
        <MarketBadge market={agent.market} />
      </div>

      {/* Last action */}
      <div style={{
        fontSize: '12px',
        color: '#667788',
        lineHeight: '1.4',
        minHeight: '34px',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
      }}>
        {agent.last_action || 'Ingen handling endnu'}
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#445566' }}>
          <Clock size={11} />
          {timeAgo(agent.last_run)}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#445566' }}>
          <Zap size={11} />
          {agent.runs_today} kørsel{agent.runs_today !== 1 ? 'er' : ''} i dag
        </span>
        {agent.status === 'error' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#E74C3C' }}>
            <AlertCircle size={11} />
            Fejl
          </span>
        )}
      </div>

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '7px 0',
          borderRadius: '7px',
          border: '1px solid rgba(24,95,165,0.4)',
          background: running
            ? 'rgba(24,95,165,0.08)'
            : flash === 'ok'
            ? 'rgba(46,204,113,0.12)'
            : flash === 'err'
            ? 'rgba(231,76,60,0.12)'
            : 'rgba(24,95,165,0.12)',
          color: running
            ? '#445566'
            : flash === 'ok'
            ? '#2ECC71'
            : flash === 'err'
            ? '#E74C3C'
            : '#185FA5',
          fontSize: '12px',
          fontWeight: 600,
          cursor: running ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s, color 0.15s',
          width: '100%',
        }}
      >
        <Play size={11} style={{ opacity: running ? 0.4 : 1 }} />
        {running ? 'Kører…' : flash === 'ok' ? 'Startet' : flash === 'err' ? 'Fejlede' : 'Kør nu'}
      </button>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function AgenterPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/agents').then(r => r.json()),
      fetch('/api/pipeline').then(r => r.json()),
      fetch('/api/leads').then(r => r.json()),
    ])
      .then(([a, p, l]) => {
        setAgents(a);
        setPipeline(p);
        setLeads(l);
      })
      .catch(console.error);
  }, []);

  const runAgent = useCallback(async (id: string) => {
    const res = await fetch(`/api/agents/${id}/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Run failed');
    // Refresh agent list after a short delay so runs_today updates
    setTimeout(() => {
      fetch('/api/agents').then(r => r.json()).then(setAgents).catch(() => null);
    }, 800);
  }, []);

  const activeCount = agents.filter(a => a.status === 'active').length;

  const funnelData = pipeline ? [
    { name: 'Leads', value: pipeline.total_leads, fill: '#185FA5' },
    { name: 'Kontaktet', value: pipeline.contacted + pipeline.replied + pipeline.interested + pipeline.booked + pipeline.won, fill: '#1A6DB5' },
    { name: 'Svar', value: pipeline.replied + pipeline.interested + pipeline.booked + pipeline.won, fill: '#1E7BC5' },
    { name: 'Interesseret', value: pipeline.interested + pipeline.booked + pipeline.won, fill: '#2ECC71' },
    { name: 'Møde', value: pipeline.booked + pipeline.won, fill: '#27AE60' },
    { name: 'Vundet', value: pipeline.won, fill: '#1D8348' },
  ] : [];

  const barData = pipeline ? [
    { name: 'Ny', value: pipeline.new, color: '#667788' },
    { name: 'Kontaktet', value: pipeline.contacted, color: '#185FA5' },
    { name: 'Svaret', value: pipeline.replied, color: '#F39C12' },
    { name: 'Interesseret', value: pipeline.interested, color: '#0F6E56' },
    { name: 'Booket', value: pipeline.booked, color: '#2ECC71' },
    { name: 'Vundet', value: pipeline.won, color: '#1D8348' },
    { name: 'Tabt', value: pipeline.lost, color: '#E74C3C' },
  ] : [];

  const topLeads = leads
    .filter(l => !['lost', 'deleted', 'won'].includes(l.status))
    .filter(l => l.priority === 'high')
    .sort((a, b) => new Date(b.updated_at || '').getTime() - new Date(a.updated_at || '').getTime())
    .slice(0, 10);

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto' }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 28px 0' }}>
        <h1 style={{ margin: '0 0 2px', fontSize: '20px', fontWeight: 700, color: '#ECF0F1' }}>
          Agenter
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#AAB8C2' }}>
          {agents.length === 0
            ? 'Indlæser…'
            : `${agents.length} agenter · ${activeCount} aktive`}
        </p>
      </div>

      {/* ── Agents grid ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        padding: '16px 28px 0',
      }}>
        {agents.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ ...card, height: '148px', opacity: 0.4 }} />
            ))
          : agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} onRun={runAgent} />
            ))}
      </div>

      {/* ── Section divider ──────────────────────────────────────────────── */}
      <div style={{ padding: '28px 28px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <TrendingUp size={14} color="#185FA5" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#AAB8C2', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Pipeline Analytics
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        padding: '16px 28px 0',
      }}>
        {[
          { label: 'Total leads', value: pipeline?.total_leads ?? '—' },
          { label: 'Conversion rate', value: pipeline ? `${pipeline.conversion_rate}%` : '—' },
          { label: 'Møder denne uge', value: pipeline?.meetings_this_week ?? '—' },
          { label: 'Vundet', value: pipeline?.won ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} style={card}>
            <div style={{ fontSize: '11px', color: '#445566', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              {label}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#ECF0F1' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Charts row ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        padding: '12px 28px 0',
      }}>
        {/* Funnel */}
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>Salgstragt</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData} layout="vertical" barSize={28}>
              <XAxis type="number" tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {funnelData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {pipeline && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
              {[
                { from: 'Lead → Kontaktet', rate: convRate(pipeline.total_leads, pipeline.contacted) },
                { from: 'Kontaktet → Svar', rate: convRate(pipeline.contacted, pipeline.replied) },
                { from: 'Svar → Interesseret', rate: convRate(pipeline.replied, pipeline.interested) },
                { from: 'Interesseret → Møde', rate: convRate(pipeline.interested, pipeline.booked) },
              ].map(({ from, rate }) => (
                <div key={from} style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                }}>
                  <span style={{ color: '#667788' }}>{from}: </span>
                  <span style={{ color: '#2ECC71', fontWeight: 600 }}>{rate}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly trend */}
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>Møder booket per uge</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={WEEK_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="moeder"
                stroke="#185FA5"
                strokeWidth={2}
                dot={{ fill: '#185FA5', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#2ECC71' }}
                name="Møder"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Distribution bar ─────────────────────────────────────────────── */}
      <div style={{ padding: '12px 28px 0' }}>
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>Distribution per status</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={barData} barSize={36}>
              <XAxis dataKey="name" tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Leads">
                {barData.map((entry, index) => (
                  <rect key={`rect-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Top leads table ──────────────────────────────────────────────── */}
      <div style={{ padding: '12px 28px 24px' }}>
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>
            Top prioritet – aktive leads
          </h3>
          {topLeads.length === 0 ? (
            <div style={{ color: '#445566', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
              Ingen høj-prioritets leads
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  {['Firma', 'Kontakt', 'Marked', 'Status', 'Sidst opdateret'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: '11px',
                      color: '#445566',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topLeads.map((lead, i) => (
                  <tr
                    key={lead.id}
                    style={{ borderBottom: i < topLeads.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                  >
                    <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500, color: '#ECF0F1' }}>
                      <span style={{ marginRight: '6px', color: '#E74C3C' }}>●</span>
                      {lead.company}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '12px', color: '#667788' }}>
                      {lead.contact_name || '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <MarketBadge market={lead.market} />
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: '11px', color: '#667788' }}>
                      {lead.updated_at ? new Date(lead.updated_at).toLocaleDateString('da-DK') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
