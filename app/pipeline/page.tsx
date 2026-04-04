'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Play, Clock, Zap, AlertCircle, CheckCircle2, Loader2,
  ChevronRight, X, RefreshCw, Activity, Users, Globe,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Agent {
  id: string;
  name: string;
  market: string;
  status: 'active' | 'idle' | 'error';
  last_action: string | null;
  last_run: string | null;
  runs_today: number;
}

interface AgentLog {
  id: string;
  agent_id: string;
  action: string;
  details: string | null;
  result: 'success' | 'error' | 'info';
  created_at: string;
}

// ─── Static org metadata ──────────────────────────────────────────────────────
const ORG: Record<string, { role: string; schedule: string; color: string }> = {
  'cso':            { role: 'Strategisk analyse · pipeline-overblik · Slack-rapport til ledelsen', schedule: 'Mandage 07:00', color: '#E84025' },
  'se-prospecting': { role: 'Finder og kvalificerer nye svenske leads', schedule: 'Mandage 08:00', color: '#3498DB' },
  'se-outreach':    { role: 'Sender første kontakt-email til prospects', schedule: 'Tirsdage 09:00', color: '#3498DB' },
  'se-followup':    { role: 'Automatisk opfølgning på udsendte mails', schedule: 'Onsdage 09:00', color: '#3498DB' },
  'se-booking':     { role: 'Forsøger at booke møde med interesserede', schedule: 'Torsdage 09:00', color: '#3498DB' },
  'se-imap':        { role: 'Overvåger indbakken · opdaterer lead-status', schedule: 'Dagligt 06:00', color: '#3498DB' },
  'dk-prospecting': { role: 'Finder nye danske leads i relevante brancher', schedule: 'Mandage 08:30', color: '#2ECC71' },
  'dk-callprep':    { role: 'Genererer call-brief inden møde', schedule: 'Hverdage 07:30', color: '#2ECC71' },
  'dk-calllog':     { role: 'Logger og opsummerer gennemførte opkald', schedule: 'Hverdage 18:00', color: '#2ECC71' },
  'dk-followup':    { role: 'Sender opfølgningsmail efter kontakt', schedule: 'Tirsdage 10:00', color: '#2ECC71' },
  'dk-nurture':     { role: 'Vedligeholder relation til kolde leads', schedule: 'Fredage 09:00', color: '#2ECC71' },
  'dk-pipeline':    { role: 'Opdaterer og prioriterer pipeline-status', schedule: 'Dagligt 06:30', color: '#2ECC71' },
};

const SE_FLOW = ['se-prospecting', 'se-outreach', 'se-followup', 'se-booking', 'se-imap'];
const DK_FLOW = ['dk-prospecting', 'dk-callprep', 'dk-calllog', 'dk-followup', 'dk-nurture', 'dk-pipeline'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string | null): string {
  if (!iso) return 'Aldrig kørt';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Lige nu';
  if (mins < 60) return `${mins} min siden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} t siden`;
  return `${Math.floor(hrs / 24)} dage siden`;
}

function statusLabel(s: Agent['status']) {
  if (s === 'active') return { label: 'Kører',  color: '#2ECC71', glow: true };
  if (s === 'error')  return { label: 'Fejl',   color: '#E74C3C', glow: false };
  return                    { label: 'Klar',    color: '#F39C12', glow: false };
}

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({
  agent, onRun, onShowLogs, isLast,
}: {
  agent: Agent;
  onRun: (id: string) => Promise<void>;
  onShowLogs: (id: string) => void;
  isLast: boolean;
}) {
  const [running, setRunning]   = useState(false);
  const [flash,   setFlash]     = useState<'ok' | 'err' | null>(null);
  const meta   = ORG[agent.id] || { role: '', schedule: '', color: '#667788' };
  const status = statusLabel(agent.status);

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRunning(true);
    try {
      await onRun(agent.id);
      setFlash('ok');
    } catch {
      setFlash('err');
    } finally {
      setRunning(false);
      setTimeout(() => setFlash(null), 3000);
    }
  };

  const borderColor = flash === 'ok'
    ? 'rgba(46,204,113,0.5)'
    : flash === 'err'
    ? 'rgba(231,76,60,0.5)'
    : 'rgba(255,255,255,0.07)';

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={() => onShowLogs(agent.id)}
        style={{
          background: '#111820',
          border: `1px solid ${borderColor}`,
          borderLeft: `3px solid ${meta.color}`,
          borderRadius: 10,
          padding: '13px 14px',
          cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.15s',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#151E28'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#111820'}
      >
        {/* Top row: status + name + run */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: status.color, flexShrink: 0,
            boxShadow: status.glow ? `0 0 8px ${status.color}` : 'none',
            animation: status.glow ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#D0E0EE', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {agent.name}
          </span>
          <button
            onClick={handleRun}
            disabled={running}
            title="Kør agent nu"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: flash === 'ok' ? 'rgba(46,204,113,0.15)' : flash === 'err' ? 'rgba(231,76,60,0.15)' : `${meta.color}18`,
              border: `1px solid ${flash === 'ok' ? 'rgba(46,204,113,0.4)' : flash === 'err' ? 'rgba(231,76,60,0.4)' : `${meta.color}44`}`,
              borderRadius: 6, padding: '4px 10px',
              color: flash === 'ok' ? '#2ECC71' : flash === 'err' ? '#E74C3C' : meta.color,
              fontSize: 11, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            {running
              ? <Loader2 size={10} style={{ animation: 'spin 0.8s linear infinite' }} />
              : flash === 'ok' ? <CheckCircle2 size={10} />
              : flash === 'err' ? <AlertCircle size={10} />
              : <Play size={10} />}
            {running ? 'Kører…' : flash === 'ok' ? 'OK' : flash === 'err' ? 'Fejl' : 'Kør'}
          </button>
        </div>

        {/* Role */}
        <div style={{ fontSize: 11, color: '#445566', lineHeight: 1.4 }}>
          {meta.role}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#2D3748', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} /> {timeAgo(agent.last_run)}
          </span>
          <span style={{ fontSize: 10, color: '#2D3748', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Zap size={10} /> {agent.runs_today}x i dag
          </span>
          <span style={{ fontSize: 10, color: '#2D3748', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Activity size={10} /> {meta.schedule}
          </span>
        </div>

        {/* Last action */}
        {agent.last_action && (
          <div style={{ fontSize: 11, color: '#334455', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: 6 }}>
            {agent.last_action}
          </div>
        )}
      </div>

      {/* Flow arrow */}
      {!isLast && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <ChevronRight size={14} color="#1E2A38" style={{ transform: 'rotate(90deg)' }} />
        </div>
      )}
    </div>
  );
}

// ─── Log Drawer ───────────────────────────────────────────────────────────────
function LogDrawer({ agentId, agents, onClose }: {
  agentId: string | null;
  agents: Agent[];
  onClose: () => void;
}) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    setLogs([]);
    fetch(`/api/agents/${agentId}/logs`)
      .then(r => r.json())
      .then(d => setLogs(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  const agent = agents.find(a => a.id === agentId);
  const meta  = agentId ? ORG[agentId] : null;

  if (!agentId || !agent) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 201,
        width: 420, background: '#0D1118',
        borderLeft: `3px solid ${meta?.color || '#667788'}`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusLabel(agent.status).color, flexShrink: 0, boxShadow: statusLabel(agent.status).glow ? `0 0 8px ${statusLabel(agent.status).color}` : 'none' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: '#ECF0F1' }}>{agent.name}</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: statusLabel(agent.status).color, background: `${statusLabel(agent.status).color}18`, padding: '2px 7px', borderRadius: 5 }}>
                {statusLabel(agent.status).label}
              </span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#445566' }}>{meta?.role}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <span style={{ fontSize: 11, color: '#2D3748', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Clock size={11} /> Sidst kørt: {timeAgo(agent.last_run)}
            </span>
            <span style={{ fontSize: 11, color: '#2D3748', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Zap size={11} /> {agent.runs_today} kørsler i dag
            </span>
          </div>
        </div>

        {/* Logs */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px' }}>
          <div style={{ fontSize: 11, color: '#2D3748', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Aktivitetslog
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#2D3748', fontSize: 12 }}>Henter logs...</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#2D3748', fontSize: 12 }}>Ingen aktivitet endnu</div>
          ) : logs.map(log => (
            <div key={log.id} style={{ marginBottom: 10, padding: '10px 12px', background: '#111820', borderRadius: 8, borderLeft: `2px solid ${log.result === 'success' ? '#2ECC71' : log.result === 'error' ? '#E74C3C' : '#445566'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: log.result === 'success' ? '#2ECC71' : log.result === 'error' ? '#E74C3C' : '#8899AA' }}>
                  {log.action}
                </span>
                <span style={{ fontSize: 10, color: '#2D3748', flexShrink: 0, marginLeft: 8 }}>
                  {new Date(log.created_at).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {log.details && (
                <div style={{ fontSize: 11, color: '#334455', lineHeight: 1.5, wordBreak: 'break-word' }}>
                  {log.details.length > 300 ? log.details.slice(0, 300) + '…' : log.details}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── CSO Card ─────────────────────────────────────────────────────────────────
function CsoCard({ agent, onRun, onShowLogs }: {
  agent: Agent | undefined;
  onRun: (id: string) => Promise<void>;
  onShowLogs: (id: string) => void;
}) {
  const [running, setRunning] = useState(false);
  const [flash, setFlash]     = useState<'ok' | 'err' | null>(null);

  if (!agent) return <div style={{ height: 80, background: '#111820', borderRadius: 12, opacity: 0.4 }} />;
  const status = statusLabel(agent.status);

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setRunning(true);
    try { await onRun(agent.id); setFlash('ok'); }
    catch { setFlash('err'); }
    finally { setRunning(false); setTimeout(() => setFlash(null), 3000); }
  };

  return (
    <div
      onClick={() => onShowLogs(agent.id)}
      style={{
        background: 'linear-gradient(135deg, #161E2A 0%, #111820 100%)',
        border: `1px solid ${flash === 'ok' ? 'rgba(46,204,113,0.5)' : 'rgba(232,64,37,0.25)'}`,
        borderTop: '3px solid #E84025',
        borderRadius: 12,
        padding: '18px 22px',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 18,
        transition: 'border-color 0.2s',
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(232,64,37,0.15)', border: '1px solid rgba(232,64,37,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 20 }}>🤖</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1' }}>{agent.name}</span>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, boxShadow: status.glow ? `0 0 8px ${status.color}` : 'none' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: status.color, background: `${status.color}18`, padding: '2px 8px', borderRadius: 5 }}>
            {status.label}
          </span>
        </div>
        <div style={{ fontSize: 12, color: '#445566' }}>{ORG['cso']?.role}</div>
        <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: '#2D3748', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} /> {timeAgo(agent.last_run)}
          </span>
          <span style={{ fontSize: 11, color: '#2D3748', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Activity size={10} /> {ORG['cso']?.schedule}
          </span>
        </div>
      </div>
      <button
        onClick={handleRun}
        disabled={running}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(232,64,37,0.15)', border: '1px solid rgba(232,64,37,0.4)',
          borderRadius: 8, padding: '8px 18px',
          color: '#E84025', fontSize: 13, fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer',
          flexShrink: 0,
        }}
      >
        {running ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Play size={13} />}
        {running ? 'Kører…' : 'Kør nu'}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AgenterPage() {
  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [logsFor,   setLogsFor]   = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/agents');
    if (res.ok) setAgents(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15s (so running status updates)
  useEffect(() => {
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const runAgent = useCallback(async (id: string) => {
    const res = await fetch(`/api/agents/${id}/run`, { method: 'POST' });
    if (!res.ok) throw new Error('Run fejlede');
    setTimeout(load, 1000);
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));
  const activeCount = agents.filter(a => a.status === 'active').length;
  const errorCount  = agents.filter(a => a.status === 'error').length;
  const totalRuns   = agents.reduce((s, a) => s + (a.runs_today || 0), 0);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 28px 48px' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#ECF0F1' }}>Agenter</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#445566' }}>
            {agents.length} agenter · {activeCount} aktive{errorCount > 0 ? ` · ${errorCount} fejl` : ''} · {totalRuns} kørsler i dag
          </p>
        </div>
        <button
          onClick={handleRefresh}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 8, padding: '8px 14px', color: '#667788', fontSize: 12, cursor: 'pointer' }}
        >
          <RefreshCw size={12} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Opdater
        </button>
      </div>

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { icon: <Activity size={14} />, label: 'Aktive agenter', value: activeCount, color: '#2ECC71' },
          { icon: <Zap size={14} />,      label: 'Kørsler i dag',   value: totalRuns,   color: '#3498DB' },
          { icon: <AlertCircle size={14} />, label: 'Fejl',         value: errorCount,  color: errorCount > 0 ? '#E74C3C' : '#2ECC71' },
        ].map(({ icon, label, value, color }) => (
          <div key={label} style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color }}>{icon}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#445566', marginTop: 3 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── CSO Agent ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: '#2D3748', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Globe size={11} /> Ledelse
        </div>
        <CsoCard agent={agentMap['cso']} onRun={runAgent} onShowLogs={setLogsFor} />
      </div>

      {/* ── Connector ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* ── Teams ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* SE Team */}
        <div>
          <div style={{ fontSize: 10, color: '#3498DB', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={11} /> 🇸🇪 Sverige-team
          </div>
          {SE_FLOW.map((id, i) => {
            const agent = agentMap[id];
            if (!agent) return (
              <div key={id} style={{ height: 90, background: '#111820', borderRadius: 10, opacity: 0.3, marginBottom: i < SE_FLOW.length - 1 ? 4 : 0 }} />
            );
            return (
              <AgentCard
                key={id}
                agent={agent}
                onRun={runAgent}
                onShowLogs={setLogsFor}
                isLast={i === SE_FLOW.length - 1}
              />
            );
          })}
        </div>

        {/* DK Team */}
        <div>
          <div style={{ fontSize: 10, color: '#2ECC71', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={11} /> 🇩🇰 Danmark-team
          </div>
          {DK_FLOW.map((id, i) => {
            const agent = agentMap[id];
            if (!agent) return (
              <div key={id} style={{ height: 90, background: '#111820', borderRadius: 10, opacity: 0.3, marginBottom: i < DK_FLOW.length - 1 ? 4 : 0 }} />
            );
            return (
              <AgentCard
                key={id}
                agent={agent}
                onRun={runAgent}
                onShowLogs={setLogsFor}
                isLast={i === DK_FLOW.length - 1}
              />
            );
          })}
        </div>
      </div>

      {/* ── Log drawer ──────────────────────────────────────────────────── */}
      <LogDrawer
        agentId={logsFor}
        agents={agents}
        onClose={() => setLogsFor(null)}
      />

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}
