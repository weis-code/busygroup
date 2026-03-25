export type AgentStatus = 'active' | 'idle' | 'error';
export type LeadStatus = 'new' | 'contacted' | 'replied' | 'interested' | 'booked' | 'won' | 'lost' | 'deleted';

const agentStatusConfig: Record<AgentStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Aktiv', color: '#2ECC71', bg: 'rgba(46,204,113,0.12)' },
  idle: { label: 'Idle', color: '#667788', bg: 'rgba(102,119,136,0.12)' },
  error: { label: 'Fejl', color: '#E74C3C', bg: 'rgba(231,76,60,0.12)' },
};

const leadStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'Ny', color: '#667788', bg: 'rgba(102,119,136,0.12)' },
  contacted: { label: 'Kontaktet', color: '#185FA5', bg: 'rgba(24,95,165,0.15)' },
  replied: { label: 'Svaret', color: '#F39C12', bg: 'rgba(243,156,18,0.12)' },
  interested: { label: 'Interesseret', color: '#0F6E56', bg: 'rgba(15,110,86,0.15)' },
  booked: { label: 'Booket', color: '#2ECC71', bg: 'rgba(46,204,113,0.12)' },
  won: { label: 'Vundet', color: '#2ECC71', bg: 'rgba(46,204,113,0.2)' },
  lost: { label: 'Tabt', color: '#E74C3C', bg: 'rgba(231,76,60,0.12)' },
  deleted: { label: 'Slettet', color: '#667788', bg: 'rgba(102,119,136,0.08)' },
};

export function AgentStatusBadge({ status }: { status: string }) {
  const cfg = agentStatusConfig[status as AgentStatus] || agentStatusConfig.idle;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '2px 8px', borderRadius: '100px',
      fontSize: '11px', fontWeight: 500,
      color: cfg.color, background: cfg.bg,
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%', background: cfg.color,
        animation: status === 'active' ? 'pulse-dot 1.5s ease-in-out infinite' : undefined,
      }} />
      {cfg.label}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: string }) {
  const cfg = leadStatusConfig[status] || leadStatusConfig.new;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: '100px',
      fontSize: '11px', fontWeight: 500,
      color: cfg.color, background: cfg.bg,
    }}>
      {cfg.label}
    </span>
  );
}

export function MarketBadge({ market }: { market: string }) {
  const isSE = market === 'sweden';
  return (
    <span style={{
      padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
      color: isSE ? '#185FA5' : '#0F6E56',
      background: isSE ? 'rgba(24,95,165,0.15)' : 'rgba(15,110,86,0.15)',
    }}>
      {isSE ? 'SE' : 'DK'}
    </span>
  );
}
