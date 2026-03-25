'use client';

import { useEffect, useState } from 'react';
import { AgentStatusBadge } from './StatusBadge';
import { toast } from 'sonner';
import { Play, RefreshCw } from 'lucide-react';
import Card from './Card';

interface Agent {
  id: string;
  name: string;
  market: string;
  status: string;
  last_action: string;
  last_run: string;
  runs_today: number;
}

interface Log {
  id: string;
  action: string;
  details: string;
  result: string;
  created_at: string;
}

const agentDescriptions: Record<string, string> = {
  'cso': 'Analyserer pipeline, koordinerer agenter og rapporterer til ledelsen hver mandag.',
  'se-prospecting': 'Finder nye svenske leads vha. AI og indsætter dem i pipeline.',
  'se-outreach': 'Sender personaliserede LinkedIn DMs på svensk til nye leads.',
  'se-followup': 'Kører 4-trins follow-up sekvenser til kontaktede leads.',
  'se-booking': 'Booker møder med interesserede leads og forbereder agenda.',
};

const resultColors: Record<string, string> = {
  success: '#2ECC71',
  error: '#E74C3C',
  warning: '#F39C12',
  info: '#185FA5',
};

const resultIcons: Record<string, string> = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Lige nu';
  if (mins < 60) return `${mins}m siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t siden`;
  return `${Math.floor(hours / 24)}d siden`;
}

export default function AgentSidebar({ agentId, agent }: { agentId: string | null; agent: Agent | null }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    fetch(`/api/agents/${agentId}/logs`)
      .then(r => r.json())
      .then(setLogs)
      .catch(() => {});
  }, [agentId]);

  const handleRun = async () => {
    if (!agentId || running) return;
    setRunning(true);
    const tid = toast.loading(`Starter ${agent?.name}...`);
    try {
      const res = await fetch(`/api/agents/${agentId}/run`, { method: 'POST' });
      const json = await res.json();
      toast.dismiss(tid);
      if (json.success) {
        toast.success(`Agent kørt på ${json.duration}ms`);
      } else {
        toast.error(json.message);
      }
      // Refresh logs
      const logsRes = await fetch(`/api/agents/${agentId}/logs`);
      setLogs(await logsRes.json());
    } catch {
      toast.dismiss(tid);
      toast.error('Fejl ved kørsel');
    } finally {
      setRunning(false);
    }
  };

  if (!agentId || !agent) {
    return (
      <Card style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#667788' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>→</div>
          <div style={{ fontSize: '13px' }}>Klik på en agent i org-chartet for at se detaljer</div>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ECF0F1', marginBottom: '4px' }}>
              {agent.name}
            </div>
            <AgentStatusBadge status={agent.status} />
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: running ? 'rgba(24,95,165,0.2)' : '#185FA5',
              border: 'none', borderRadius: '6px', padding: '6px 12px',
              color: '#ECF0F1', cursor: running ? 'not-allowed' : 'pointer',
              fontSize: '12px', fontWeight: 500,
            }}
          >
            {running ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={12} />}
            {running ? 'Kører...' : 'Kør nu'}
          </button>
        </div>
        <p style={{ fontSize: '12px', color: '#667788', marginTop: '8px', marginBottom: 0, lineHeight: 1.5 }}>
          {agentDescriptions[agentId] || ''}
        </p>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {[
          { label: 'Kørsler i dag', value: agent.runs_today },
          { label: 'Sidst kørt', value: timeAgo(agent.last_run) },
          { label: 'Market', value: agent.market === 'global' ? 'Global' : agent.market === 'sweden' ? '🇸🇪 Sverige' : '🇩🇰 Danmark' },
          { label: 'Logs', value: logs.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: '12px 16px', background: '#111E2A' }}>
            <div style={{ fontSize: '10px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#ECF0F1', marginTop: '2px' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Activity Log */}
      <div style={{ padding: '12px 0', overflowY: 'auto', flex: 1 }}>
        <div style={{ padding: '0 16px 8px', fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Aktivitetslog
        </div>
        {logs.length === 0 && (
          <div style={{ padding: '20px 16px', color: '#667788', fontSize: '12px', textAlign: 'center' }}>
            Ingen logs endnu
          </div>
        )}
        {logs.slice(0, 12).map(log => (
          <div key={log.id} style={{
            padding: '8px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', gap: '10px', alignItems: 'flex-start',
          }}>
            <span style={{
              width: '16px', height: '16px', borderRadius: '50%',
              background: `${resultColors[log.result] || '#667788'}22`,
              color: resultColors[log.result] || '#667788',
              fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: '1px',
            }}>
              {resultIcons[log.result] || '·'}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 500, color: '#ECF0F1' }}>{log.action}</div>
              {log.details && (
                <div style={{ fontSize: '11px', color: '#667788', marginTop: '2px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {log.details}
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#667788', marginTop: '2px' }}>
                {timeAgo(log.created_at)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
