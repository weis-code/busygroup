'use client';

import { useState } from 'react';
import { LeadStatusBadge, MarketBadge } from './StatusBadge';
import { ChevronUp, ChevronDown, Search, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Lead {
  id: string;
  company: string;
  contact_name: string;
  contact_title: string;
  priority: string;
  status: string;
  market: string;
  created_at: string;
}

interface LeadsTableProps {
  leads: Lead[];
  onUpdateLead: (id: string, changes: Partial<Lead>) => Promise<void>;
  onSelectLead: (lead: Lead) => void;
  onCreateLead: () => void;
}

const STATUS_ORDER = ['new', 'contacted', 'replied', 'interested', 'booked', 'won', 'lost'];
const STATUS_LABELS: Record<string, string> = {
  new: 'Ny', contacted: 'Kontaktet', replied: 'Svaret',
  interested: 'Interesseret', booked: 'Booket', won: 'Vundet', lost: 'Tabt',
};

function nextStatus(current: string): string | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

export default function LeadsTable({ leads, onUpdateLead, onSelectLead }: LeadsTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [marketFilter, setMarketFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortCol, setSortCol] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const filtered = leads
    .filter(l => l.status !== 'deleted')
    .filter(l => !statusFilter || l.status === statusFilter)
    .filter(l => !marketFilter || l.market === marketFilter)
    .filter(l => !priorityFilter || l.priority === priorityFilter)
    .filter(l => !search || [l.company, l.contact_name, l.contact_title].some(
      f => f?.toLowerCase().includes(search.toLowerCase())
    ))
    .sort((a, b) => {
      const av = String(a[sortCol as keyof Lead] || '');
      const bv = String(b[sortCol as keyof Lead] || '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const total = filtered.length;
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };

  const handleNextStatus = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    const next = nextStatus(lead.status);
    if (!next) return;
    await onUpdateLead(lead.id, { status: next });
    toast.success(`${lead.company} → ${STATUS_LABELS[next]}`);
  };

  const exportCSV = () => {
    const headers = ['Firma,Kontakt,Titel,Marked,Status,Prioritet,Oprettet'];
    const rows = filtered.map(l =>
      [l.company, l.contact_name, l.contact_title, l.market, l.status, l.priority, l.created_at]
        .map(v => `"${v || ''}"`)
        .join(',')
    );
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'leads-busygroup.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV eksporteret');
  };

  const selStyle: React.CSSProperties = {
    background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '6px 10px', color: '#ECF0F1',
    fontSize: '12px', cursor: 'pointer', outline: 'none',
  };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#667788', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Søg firma, kontakt..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ ...selStyle, paddingLeft: '30px', width: '100%' }}
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={selStyle}>
          <option value="">Alle statusser</option>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={marketFilter} onChange={e => { setMarketFilter(e.target.value); setPage(1); }} style={selStyle}>
          <option value="">Alle markeder</option>
          <option value="sweden">🇸🇪 Sverige</option>
          <option value="denmark">🇩🇰 Danmark</option>
        </select>
        <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }} style={selStyle}>
          <option value="">Alle prioriteter</option>
          <option value="high">Høj</option>
          <option value="medium">Middel</option>
        </select>
        <button onClick={exportCSV} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px', padding: '6px 12px', color: '#ECF0F1',
          fontSize: '12px', cursor: 'pointer',
        }}>
          <Download size={12} /> Eksportér CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                {[
                  { key: 'company', label: 'Firma' },
                  { key: 'contact_name', label: 'Kontakt' },
                  { key: 'market', label: 'Marked' },
                  { key: 'status', label: 'Status' },
                  { key: 'priority', label: 'Prioritet' },
                  { key: 'created_at', label: 'Oprettet' },
                  { key: 'actions', label: 'Handling' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => key !== 'actions' && handleSort(key)}
                    style={{
                      padding: '10px 14px', textAlign: 'left', fontSize: '11px',
                      color: '#667788', fontWeight: 500, textTransform: 'uppercase',
                      letterSpacing: '0.05em', cursor: key !== 'actions' ? 'pointer' : 'default',
                      userSelect: 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {label}
                      {key !== 'actions' && (
                        sortCol === key
                          ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
                          : <ChevronDown size={12} style={{ opacity: 0.3 }} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#667788', fontSize: '13px' }}>
                    Ingen leads fundet
                  </td>
                </tr>
              )}
              {paginated.map((lead, i) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  style={{
                    borderBottom: i < paginated.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#ECF0F1' }}>{lead.company}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: '12px', color: '#ECF0F1' }}>{lead.contact_name || '—'}</div>
                    <div style={{ fontSize: '11px', color: '#667788' }}>{lead.contact_title}</div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <MarketBadge market={lead.market} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {lead.priority === 'high'
                      ? <span style={{ color: '#E74C3C', fontSize: '12px', fontWeight: 500 }}>● Høj</span>
                      : <span style={{ color: '#667788', fontSize: '12px' }}>○ Middel</span>
                    }
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '11px', color: '#667788', whiteSpace: 'nowrap' }}>
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString('da-DK') : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        onClick={e => { e.stopPropagation(); onSelectLead(lead); }}
                        style={{ background: 'rgba(24,95,165,0.15)', border: '1px solid rgba(24,95,165,0.3)', borderRadius: '4px', padding: '3px 8px', color: '#185FA5', fontSize: '11px', cursor: 'pointer' }}
                      >
                        Se
                      </button>
                      {nextStatus(lead.status) && (
                        <button
                          onClick={e => handleNextStatus(e, lead)}
                          style={{ background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.2)', borderRadius: '4px', padding: '3px 8px', color: '#2ECC71', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          → {STATUS_LABELS[nextStatus(lead.status)!]}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#667788' }}>
            {total === 0 ? '0 leads' : `Viser ${Math.min((page - 1) * PAGE_SIZE + 1, total)}–${Math.min(page * PAGE_SIZE, total)} af ${total} leads`}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', color: page === 1 ? '#667788' : '#ECF0F1', fontSize: '12px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
              ←
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = i + Math.max(1, Math.min(page - 2, totalPages - 4));
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ background: p === page ? '#185FA5' : 'rgba(255,255,255,0.06)', border: `1px solid ${p === page ? '#185FA5' : 'rgba(255,255,255,0.1)'}`, borderRadius: '4px', padding: '4px 10px', color: '#ECF0F1', fontSize: '12px', cursor: 'pointer' }}>
                  {p}
                </button>
              );
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 10px', color: page === totalPages ? '#667788' : '#ECF0F1', fontSize: '12px', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
              →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
