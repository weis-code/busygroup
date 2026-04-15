'use client';

import { useState, useEffect } from 'react';
import { Search, Briefcase, Mail, Play, RefreshCw, CheckCircle2, Clock, AlertCircle, Zap, ChevronDown, ChevronRight } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  market: string;
  status: string;
  last_action: string | null;
  last_run: string | null;
  runs_today: number;
}

interface AgentLog {
  id: string;
  agent_id: string;
  action: string;
  details: string;
  result: string;
  created_at: string;
}

interface DailyStats {
  leadsToday: number;
  lastRun: string | null;
  totalRuns: number;
}

const PIPELINE_AGENTS = [
  {
    id: 'se-prospecting',
    label: 'Prospecting Agent',
    icon: Search,
    color: '#5B9BD5',
    description: 'Finder 20–50 svenske servicevirksomheder (klinikker & håndværkere) og opretter dem som leads i CRM.',
    badge: 'Agent 1',
  },
  {
    id: 'se-outreach',
    label: 'Research Agent',
    icon: Briefcase,
    color: '#2ECC71',
    description: 'Analyserer hvert lead og skriver 3 research-punkter om smertepunkter og værdiskabelse.',
    badge: 'Agent 2',
  },
  {
    id: 'se-followup',
    label: 'Email Writer Agent',
    icon: Mail,
    color: '#F39C12',
    description: 'Skriver personlige engelske cold emails til hvert lead baseret på research.',
    badge: 'Agent 3',
  },
];

function StatusDot({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    running: { color: '#2ECC71', label: 'Kørende' },
    idle: { color: '#445566', label: 'Inaktiv' },
    error: { color: '#E74C3C', label: 'Fejl' },
  };
  const s = map[status] || map.idle;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: s.color }}>
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%', background: s.color, flexShrink: 0,
        boxShadow: status === 'running' ? `0 0 6px ${s.color}` : 'none',
        animation: status === 'running' ? 'pulse 1s infinite' : 'none',
      }} />
      {s.label}
    </span>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Aldrig';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Lige nu';
  if (mins < 60) return `${mins}m siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t siden`;
  const days = Math.floor(hours / 24);
  return `${days}d siden`;
}

export default function AgenterPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [stats, setStats] = useState<DailyStats>({ leadsToday: 0, lastRun: null, totalRuns: 0 });
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [agentsRes, logsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/agent-logs?agent_id=se-prospecting&limit=10'),
      ]);
      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (logsRes.ok) {
        const logData = await logsRes.json();
        setLogs(Array.isArray(logData) ? logData : []);
      }

      // Fetch daily stats
      const statsRes = await fetch('/api/agent-stats/sweden');
      if (statsRes.ok) setStats(await statsRes.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const getAgent = (id: string) => agents.find(a => a.id === id);

  const handleRunNow = async () => {
    if (running) return;
    setRunning(true);
    setRunLog([]);
    try {
      const res = await fetch('/api/agents/sweden-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: null }),
      });
      if (!res.body) throw new Error('No stream');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const event = JSON.parse(line.replace('data: ', ''));
            setRunLog(prev => [...prev.slice(-19), `[${event.stage}] ${event.message}`]);
          } catch { /* ignore */ }
        }
      }
    } catch {
      setRunLog(prev => [...prev, '[error] Noget gik galt']);
    } finally {
      setRunning(false);
      fetchData();
    }
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: '900px', margin: '0 auto' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes flow { 0%{opacity:0.3;transform:translateY(0)} 100%{opacity:0.8;transform:translateY(6px)} }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#ECF0F1', letterSpacing: '-0.02em' }}>
          Agenter
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#445566' }}>
          AI-pipeline til automatisk prospektering og outreach på det svenske marked
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {[
          { label: 'Leads i dag', value: stats.leadsToday, icon: <Zap size={14} color="#FCD200" />, color: '#FCD200' },
          { label: 'Seneste kørsel', value: timeAgo(stats.lastRun), icon: <Clock size={14} color="#5B9BD5" />, color: '#5B9BD5' },
          { label: 'Kørsler total', value: stats.totalRuns, icon: <RefreshCw size={14} color="#2ECC71" />, color: '#2ECC71' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px', padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '140px',
          }}>
            {s.icon}
            <div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#445566' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline flow */}
      <div style={{ background: '#0C1820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>🇸🇪 Sverige Outreach Pipeline</div>
            <div style={{ fontSize: '11px', color: '#445566', marginTop: '2px' }}>3 agenter · kører automatisk kl. 08:00 hver dag</div>
          </div>
          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: running ? 'rgba(252,210,0,0.08)' : 'rgba(252,210,0,0.14)',
              border: '1px solid rgba(252,210,0,0.3)',
              borderRadius: '8px', padding: '8px 14px',
              color: '#FCD200', fontSize: '12px', fontWeight: 600,
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            <Play size={12} style={{ animation: running ? 'pulse 1s infinite' : 'none' }} />
            {running ? 'Kører...' : 'Kør nu'}
          </button>
        </div>

        {/* Agent cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {PIPELINE_AGENTS.map((pa, idx) => {
            const agent = getAgent(pa.id);
            const Icon = pa.icon;
            const isLast = idx === PIPELINE_AGENTS.length - 1;

            return (
              <div key={pa.id}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  background: '#111E2A', border: `1px solid rgba(255,255,255,0.07)`,
                  borderRadius: '10px', padding: '16px 18px',
                  position: 'relative',
                  borderLeft: `3px solid ${pa.color}`,
                }}>
                  {/* Icon */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: `${pa.color}18`, border: `1px solid ${pa.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={18} color={pa.color} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>{pa.label}</span>
                      <span style={{
                        fontSize: '9px', fontWeight: 700, color: pa.color,
                        background: `${pa.color}18`, border: `1px solid ${pa.color}30`,
                        borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.04em',
                      }}>
                        {pa.badge}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#556677', lineHeight: '1.4' }}>
                      {pa.description}
                    </p>
                  </div>

                  {/* Status */}
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    {loading ? (
                      <span style={{ fontSize: '11px', color: '#445566' }}>...</span>
                    ) : agent ? (
                      <>
                        <StatusDot status={running ? 'running' : agent.status} />
                        <div style={{ fontSize: '10px', color: '#445566', marginTop: '4px' }}>
                          {timeAgo(agent.last_run)}
                        </div>
                        {agent.runs_today > 0 && (
                          <div style={{ fontSize: '10px', color: '#334455', marginTop: '2px' }}>
                            {agent.runs_today} kørsel{agent.runs_today !== 1 ? 'er' : ''} i dag
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#445566' }}>Ukendt</span>
                    )}
                  </div>
                </div>

                {/* Connector arrow */}
                {!isLast && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0', position: 'relative' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                      <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.1)' }} />
                      <ChevronRight size={12} color="#334455" style={{ transform: 'rotate(90deg)' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live run log */}
      {(runLog.length > 0 || running) && (
        <div style={{
          background: '#080F16', border: '1px solid rgba(252,210,0,0.2)',
          borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
          fontFamily: 'monospace',
        }}>
          <div style={{ fontSize: '11px', color: '#FCD200', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={11} style={{ animation: running ? 'pulse 1s infinite' : 'none' }} />
            {running ? 'Pipeline kører live...' : 'Seneste kørsel'}
          </div>
          {runLog.map((line, i) => (
            <div key={i} style={{ fontSize: '11px', color: '#556677', lineHeight: '1.6' }}>{line}</div>
          ))}
        </div>
      )}

      {/* Agent logs */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
        <button
          onClick={() => setShowLogs(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#AAB8C8',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 600 }}>Kørselslog ({logs.length})</span>
          {showLogs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {showLogs && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', maxHeight: '320px', overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div style={{ padding: '16px 18px', fontSize: '12px', color: '#445566' }}>Ingen kørsler endnu</div>
            ) : logs.map(log => (
              <div key={log.id} style={{
                padding: '10px 18px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                display: 'flex', alignItems: 'flex-start', gap: '10px',
              }}>
                {log.result === 'success'
                  ? <CheckCircle2 size={13} color="#2ECC71" style={{ marginTop: '2px', flexShrink: 0 }} />
                  : <AlertCircle size={13} color="#E74C3C" style={{ marginTop: '2px', flexShrink: 0 }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: '#ECF0F1', fontWeight: 500 }}>
                    {log.action === 'daily_run' ? 'Automatisk daglig kørsel' : log.action}
                  </div>
                  {log.details && (
                    <div style={{ fontSize: '10px', color: '#445566', marginTop: '2px', lineHeight: '1.4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details.split('\n')[0]}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: '#334455', flexShrink: 0 }}>
                  {timeAgo(log.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
