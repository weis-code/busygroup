'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import MetricTile from '@/components/MetricTile';
import AgentSidebar from '@/components/AgentSidebar';
import { AlertTriangle, Clock, Calendar, Target, RefreshCw, Bot } from 'lucide-react';

const OrgChart = dynamic(() => import('@/components/OrgChart'), { ssr: false });

interface Agent {
  id: string;
  name: string;
  market: string;
  status: string;
  last_action: string;
  last_run: string;
  runs_today: number;
}

interface Pipeline {
  new: number;
  contacted: number;
  replied: number;
  interested: number;
  booked: number;
  won: number;
  total_leads: number;
  meetings_this_week: number;
  outreach_sent: number;
  conversion_rate: number;
}

interface DigestLead {
  id: string;
  company: string;
  contact_name: string;
  status: string;
  priority?: string;
  channel?: string;
  step?: number;
}

interface DigestMeeting {
  company: string;
  contact_name: string;
  scheduled_at: string;
  meeting_link?: string;
}

interface Digest {
  date: string;
  urgent: DigestLead[];
  follow_ups_due: DigestLead[];
  meetings_today: DigestMeeting[];
  suggested_focus: string;
  created_at: string | null;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Lige nu';
  if (mins < 60) return `${mins}m siden`;
  return `${Math.floor(mins / 60)}t siden`;
}

function TodaysFocusPanel({ digest, onRefresh }: { digest: Digest | null; onRefresh: () => void }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/agents/dk-pipeline/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    } finally {
      setTimeout(() => { setRefreshing(false); onRefresh(); }, 1500);
    }
  };

  return (
    <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#ECF0F1', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Target size={13} style={{ color: '#185FA5' }} /> Dagens fokus · DK
        </h2>
        <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#667788', fontSize: '11px', cursor: 'pointer' }}>
          <RefreshCw size={11} /> {refreshing ? 'Opdaterer...' : 'Opdater'}
        </button>
      </div>

      {digest ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* AI suggestion */}
          {digest.suggested_focus && (
            <div style={{ background: 'rgba(24,95,165,0.08)', border: '1px solid rgba(24,95,165,0.2)', borderRadius: '7px', padding: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Bot size={13} style={{ color: '#185FA5', flexShrink: 0, marginTop: '1px' }} />
              <p style={{ margin: 0, fontSize: '12px', color: '#AAB8C2', lineHeight: 1.5 }}>{digest.suggested_focus}</p>
            </div>
          )}

          {/* Meetings today */}
          {digest.meetings_today.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={10} /> Møder i dag ({digest.meetings_today.length})
              </div>
              {digest.meetings_today.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: 'rgba(46,204,113,0.07)', border: '1px solid rgba(46,204,113,0.15)', borderRadius: '6px', marginBottom: '4px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#ECF0F1' }}>{m.company}</span>
                    <span style={{ fontSize: '11px', color: '#667788', marginLeft: '6px' }}>{m.contact_name}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#2ECC71' }}>
                    {new Date(m.scheduled_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Urgent leads */}
          {digest.urgent.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={10} style={{ color: '#E74C3C' }} /> Presserende ({digest.urgent.length})
              </div>
              {digest.urgent.map((l) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#1A2A38', borderRadius: '6px', marginBottom: '4px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#ECF0F1' }}>{l.company}</span>
                    {l.contact_name && <span style={{ fontSize: '11px', color: '#667788', marginLeft: '6px' }}>{l.contact_name}</span>}
                  </div>
                  <span style={{ fontSize: '10px', color: l.priority === 'high' ? '#E74C3C' : '#F39C12', fontWeight: 600, background: l.priority === 'high' ? 'rgba(231,76,60,0.1)' : 'rgba(243,156,18,0.1)', borderRadius: '4px', padding: '2px 6px' }}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Follow-ups due */}
          {digest.follow_ups_due.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={10} /> Opfølgninger klar ({digest.follow_ups_due.length})
              </div>
              {digest.follow_ups_due.slice(0, 4).map((l) => (
                <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: '#1A2A38', borderRadius: '6px', marginBottom: '4px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#AAB8C2' }}>{l.company}</span>
                  </div>
                  <span style={{ fontSize: '10px', color: '#185FA5', fontWeight: 600 }}>
                    {l.channel === 'linkedin' ? '💼' : '📧'} Trin {l.step}
                  </span>
                </div>
              ))}
              {digest.follow_ups_due.length > 4 && (
                <div style={{ fontSize: '11px', color: '#667788', textAlign: 'center', padding: '4px' }}>+{digest.follow_ups_due.length - 4} mere</div>
              )}
            </div>
          )}

          {digest.created_at && (
            <div style={{ fontSize: '10px', color: '#445566', textAlign: 'right' }}>
              Opdateret {timeAgo(digest.created_at)}
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px', color: '#667788' }}>
          <Bot size={24} style={{ marginBottom: '8px', opacity: 0.4 }} />
          <div style={{ fontSize: '12px' }}>Kør DK Pipeline agent for at generere dagens fokus</div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [digest, setDigest] = useState<Digest | null>(null);

  const loadDigest = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-digest');
      if (res.ok) setDigest(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, pipelineRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/pipeline'),
      ]);
      if (agentsRes.ok) setAgents(await agentsRes.json());
      if (pipelineRes.ok) setPipeline(await pipelineRes.json());
    } catch (e) {
      console.error('Fetch error', e);
    }
  }, []);

  useEffect(() => {
    fetchData();
    loadDigest();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData, loadDigest]);

  const selectedAgentData = agents.find(a => a.id === selectedAgent) || null;

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Metrics strip */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <MetricTile label="Leads fundet" value={pipeline?.total_leads || 0} trend={3} />
        <MetricTile label="Outreach sendt" value={pipeline?.outreach_sent || 0} trend={5} />
        <MetricTile label="Svar modtaget" value={pipeline?.replied || 0} trend={1} />
        <MetricTile label="Møder booket" value={pipeline?.meetings_this_week || 0} trend={1} />
        <MetricTile label="Conversion" value={pipeline?.conversion_rate || 0} suffix="%" trend={2} />
      </div>

      {/* Main area: Org chart + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', alignItems: 'start', marginBottom: '16px' }}>
        <div>
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#ECF0F1' }}>Agent Org Chart</h2>
            <span style={{ fontSize: '11px', color: '#667788' }}>Opdateres hvert 30. sekund · Klik på en agent for detaljer</span>
          </div>
          <OrgChart agents={agents} onSelectAgent={setSelectedAgent} selectedAgent={selectedAgent} />
        </div>
        <div style={{ height: '480px' }}>
          <AgentSidebar agentId={selectedAgent} agent={selectedAgentData} />
        </div>
      </div>

      {/* DK Today's focus */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <TodaysFocusPanel digest={digest} onRefresh={loadDigest} />
        <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#ECF0F1' }}>Pipeline Oversigt</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Nye leads', value: pipeline?.new || 0, color: '#667788' },
              { label: 'Kontaktet', value: pipeline?.contacted || 0, color: '#185FA5' },
              { label: 'Svaret', value: pipeline?.replied || 0, color: '#1ABC9C' },
              { label: 'Interesseret', value: pipeline?.interested || 0, color: '#F39C12' },
              { label: 'Booket', value: pipeline?.booked || 0, color: '#9B59B6' },
              { label: 'Vundet', value: pipeline?.won || 0, color: '#2ECC71' },
            ].map(s => (
              <div key={s.label} style={{ background: '#1A2A38', borderRadius: '7px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#667788' }}>{s.label}</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
