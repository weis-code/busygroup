'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts';
import { MarketBadge, LeadStatusBadge } from '@/components/StatusBadge';

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

const customTooltipStyle = {
  background: '#1A2A38',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '6px',
  color: '#ECF0F1',
  fontSize: '12px',
};

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    Promise.all([fetch('/api/pipeline'), fetch('/api/leads')])
      .then(([p, l]) => Promise.all([p.json(), l.json()]))
      .then(([p, l]) => { setPipeline(p); setLeads(l); })
      .catch(console.error);
  }, []);

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

  function convRate(from: number, to: number) {
    if (!from) return '0%';
    return `${Math.round((to / from) * 100)}%`;
  }

  const cardStyle: React.CSSProperties = {
    background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px', padding: '20px',
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1440px', margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#ECF0F1' }}>
        Pipeline Analytics
      </h1>

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total leads', value: pipeline?.total_leads || 0 },
          { label: 'Conversion rate', value: `${pipeline?.conversion_rate || 0}%` },
          { label: 'Møder denne uge', value: pipeline?.meetings_this_week || 0 },
          { label: 'Vundet', value: pipeline?.won || 0 },
        ].map(({ label, value }) => (
          <div key={label} style={cardStyle}>
            <div style={{ fontSize: '11px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#ECF0F1' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Funnel */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>Salgstragt</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={funnelData} layout="vertical" barSize={28}>
              <XAxis type="number" tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {funnelData.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Conversion rates */}
          {pipeline && (
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
              {[
                { from: 'Lead → Kontaktet', rate: convRate(pipeline.total_leads, pipeline.contacted) },
                { from: 'Kontaktet → Svar', rate: convRate(pipeline.contacted, pipeline.replied) },
                { from: 'Svar → Interesseret', rate: convRate(pipeline.replied, pipeline.interested) },
                { from: 'Interesseret → Møde', rate: convRate(pipeline.interested, pipeline.booked) },
              ].map(({ from, rate }) => (
                <div key={from} style={{
                  background: 'rgba(255,255,255,0.04)', borderRadius: '6px',
                  padding: '4px 8px', fontSize: '11px',
                }}>
                  <span style={{ color: '#667788' }}>{from}: </span>
                  <span style={{ color: '#2ECC71', fontWeight: 600 }}>{rate}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly trend */}
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>Møder booket per uge</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={WEEK_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="week" tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Line
                type="monotone" dataKey="moeder" stroke="#185FA5"
                strokeWidth={2} dot={{ fill: '#185FA5', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#2ECC71' }}
                name="Møder"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline distribution bar */}
      <div style={{ ...cardStyle, marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>Distribution per status</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} barSize={36}>
            <XAxis dataKey="name" tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#667788', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={customTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Leads">
              {barData.map((entry, index) => (
                <rect key={`rect-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top leads table */}
      <div style={cardStyle}>
        <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 600, color: '#ECF0F1' }}>Top prioritet – aktive leads</h3>
        {topLeads.length === 0 ? (
          <div style={{ color: '#667788', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Ingen høj-prioritets leads</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Firma', 'Kontakt', 'Marked', 'Status', 'Sidst opdateret'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', color: '#667788', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topLeads.map((lead, i) => (
                <tr key={lead.id} style={{ borderBottom: i < topLeads.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <td style={{ padding: '10px 12px', fontSize: '13px', fontWeight: 500, color: '#ECF0F1' }}>
                    <span style={{ marginRight: '6px', color: '#E74C3C' }}>●</span>
                    {lead.company}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#667788' }}>{lead.contact_name || '—'}</td>
                  <td style={{ padding: '10px 12px' }}><MarketBadge market={lead.market} /></td>
                  <td style={{ padding: '10px 12px' }}><LeadStatusBadge status={lead.status} /></td>
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
  );
}
