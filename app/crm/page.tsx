'use client';

import { useState, useEffect, useCallback } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import LeadsTable from '@/components/LeadsTable';
import LeadDrawer from '@/components/LeadDrawer';
import LeadCreateModal from '@/components/LeadCreateModal';
import CsvImportModal from '@/components/CsvImportModal';
import MetricTile from '@/components/MetricTile';
import { useUser } from '@/lib/UserContext';
import { Plus, Upload, Users } from 'lucide-react';

interface Lead {
  id: string;
  company: string;
  contact_name: string;
  contact_title: string;
  linkedin_url: string;
  email: string;
  phone: string;
  company_size: string;
  why_they_fit: string;
  priority: string;
  status: string;
  market: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  product_names?: string;
  pipeline_value?: number;
}

interface User {
  id: string;
  name: string;
  role: string;
  active: boolean;
}

const SUB_TABS = ['Pipeline', 'Leads', 'Kontakter'];

export default function CRMPage() {
  const { user: currentUser } = useUser();
  const [activeTab, setActiveTab] = useState('Pipeline');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string | null>(null); // null = alle
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads');
      if (res.ok) setLeads(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data.filter((u: User) => u.active) : []);
      }
    } catch { /* non-admins get 403, that's fine */ }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => {
    if (currentUser?.role === 'admin') fetchUsers();
  }, [currentUser, fetchUsers]);

  const handleLeadUpdate = async (id: string, changes: Partial<Lead>) => {
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeads(prev => prev.map(l => l.id === id ? updated : l));
        if (selectedLead?.id === id) setSelectedLead(updated);
      }
    } catch (e) { console.error(e); }
  };

  const handleLeadCreate = async (data: Partial<Lead>) => {
    try {
      // Auto-assign to selected pipeline user if admin has one selected
      const assignedTo = selectedPipeline ?? data.assigned_to ?? undefined;
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, assigned_to: assignedTo }),
      });
      if (res.ok) {
        const newLead = await res.json();
        setLeads(prev => [newLead, ...prev]);
        setShowCreateModal(false);
      }
    } catch (e) { console.error(e); }
  };

  // Filter leads based on selected pipeline (admin only — sellers already filtered by API)
  const visibleLeads = selectedPipeline
    ? leads.filter(l => l.assigned_to === selectedPipeline)
    : leads;

  const activeLeads = visibleLeads.filter(l => !['lost', 'deleted', 'won'].includes(l.status));
  const wonThisMonth = visibleLeads.filter(l => l.status === 'won' && l.updated_at && new Date(l.updated_at) > new Date(Date.now() - 30 * 24 * 3600000)).length;
  const bookedCount = visibleLeads.filter(l => l.status === 'booked').length;
  const pipelineValue = activeLeads.reduce((sum, l) => sum + (Number(l.pipeline_value) || 0), 0);
  const wonValue = visibleLeads.filter(l => l.status === 'won').reduce((sum, l) => sum + (Number(l.pipeline_value) || 0), 0);

  const selectedUser = selectedPipeline ? users.find(u => u.id === selectedPipeline) : null;

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1440px', margin: '0 auto' }}>

      {/* Pipeline-vælger (kun admin) */}
      {currentUser?.role === 'admin' && users.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Users size={13} style={{ color: '#667788', flexShrink: 0 }} />
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            <PipelineTab
              label="Alle"
              active={selectedPipeline === null}
              onClick={() => setSelectedPipeline(null)}
              count={leads.filter(l => !['lost', 'deleted', 'won'].includes(l.status)).length}
            />
            {users.map(u => (
              <PipelineTab
                key={u.id}
                label={u.name.split(' ')[0]}
                fullName={u.name}
                active={selectedPipeline === u.id}
                onClick={() => setSelectedPipeline(prev => prev === u.id ? null : u.id)}
                count={leads.filter(l => l.assigned_to === u.id && !['lost', 'deleted', 'won'].includes(l.status)).length}
                role={u.role}
              />
            ))}
          </div>
          {selectedUser && (
            <span style={{ fontSize: '11px', color: '#667788', marginLeft: '4px' }}>
              {selectedUser.name}s pipeline
            </span>
          )}
        </div>
      )}

      {/* Metrics */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <MetricTile label="Leads i alt" value={visibleLeads.filter(l => l.status !== 'deleted').length} />
        <MetricTile label="Aktive leads" value={activeLeads.length} />
        <MetricTile label="Møder booket" value={bookedCount} />
        <MetricTile label="Vundet (30d)" value={wonThisMonth} />
        <MetricTile label="Pipeline value" value={pipelineValue > 0 ? `${(pipelineValue / 1000).toFixed(0)}k` : '—'} suffix={pipelineValue > 0 ? 'kr/år' : ''} />
        {wonValue > 0 && <MetricTile label="Lukket ARR" value={`${(wonValue / 1000).toFixed(0)}k`} suffix="kr/år" />}
      </div>

      {/* Sub-tabs + action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '0', background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '3px' }}>
          {SUB_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '6px 16px', borderRadius: '6px', border: 'none',
              background: activeTab === tab ? '#1A2A38' : 'transparent',
              color: activeTab === tab ? '#ECF0F1' : '#667788',
              fontSize: '13px', fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {tab}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowImportModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px', padding: '8px 14px', color: '#ECF0F1', cursor: 'pointer',
            fontSize: '13px', fontWeight: 500,
          }}>
            <Upload size={14} /> Importer CSV
          </button>
          <button onClick={() => setShowCreateModal(true)} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#E84025', border: 'none', borderRadius: '6px',
            padding: '8px 16px', color: '#ECF0F1', cursor: 'pointer',
            fontSize: '13px', fontWeight: 500,
          }}>
            <Plus size={14} /> Nyt lead
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#667788' }}>Indlæser leads...</div>
      ) : (
        <>
          {activeTab === 'Pipeline' && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <KanbanBoard leads={visibleLeads as any} onUpdateLead={handleLeadUpdate} onSelectLead={(l: any) => setSelectedLead(l)} />
          )}
          {activeTab === 'Leads' && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <LeadsTable leads={visibleLeads as any} onUpdateLead={handleLeadUpdate} onSelectLead={(l: any) => setSelectedLead(l)} onCreateLead={() => setShowCreateModal(true)} />
          )}
          {activeTab === 'Kontakter' && (
            <ContactsView leads={visibleLeads} onSelectLead={setSelectedLead} />
          )}
        </>
      )}

      {selectedLead && (
        <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdate={handleLeadUpdate} />
      )}
      {showCreateModal && (
        <LeadCreateModal onClose={() => setShowCreateModal(false)} onCreate={handleLeadCreate} />
      )}
      {showImportModal && (
        <CsvImportModal
          onClose={() => setShowImportModal(false)}
          onDone={fetchLeads}
        />
      )}
    </div>
  );
}

function PipelineTab({
  label, fullName, active, onClick, count, role,
}: {
  label: string;
  fullName?: string;
  active: boolean;
  onClick: () => void;
  count: number;
  role?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={fullName}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
        background: active ? '#E84025' : 'rgba(255,255,255,0.05)',
        color: active ? '#fff' : '#667788',
        fontSize: '12px', fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
      }}
    >
      {label}
      {role === 'admin' && !active && (
        <span style={{ fontSize: '9px', color: '#E74C3C', fontWeight: 700 }}>A</span>
      )}
      <span style={{
        fontSize: '10px', fontWeight: 600,
        background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
        borderRadius: '10px', padding: '1px 5px',
        color: active ? '#fff' : '#445566',
      }}>
        {count}
      </span>
    </button>
  );
}

function ContactsView({ leads, onSelectLead }: { leads: Lead[]; onSelectLead: (l: Lead) => void }) {
  const STATUS_LABELS: Record<string, string> = {
    new: 'Ny', contacted: 'Kontaktet', replied: 'Svaret',
    interested: 'Interesseret', booked: 'Booket', won: 'Vundet', lost: 'Tabt',
  };

  const grouped = leads
    .filter(l => l.status !== 'deleted')
    .reduce((acc, lead) => {
      const key = lead.contact_name || 'Ukendt';
      if (!acc[key]) acc[key] = [];
      acc[key].push(lead);
      return acc;
    }, {} as Record<string, Lead[]>);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
      {Object.entries(grouped).map(([name, contacts]) => (
        <div key={name} style={{ background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontWeight: 600, color: '#ECF0F1', marginBottom: '2px', fontSize: '14px' }}>{name}</div>
          {contacts[0]?.contact_title && (
            <div style={{ fontSize: '11px', color: '#667788', marginBottom: '10px' }}>{contacts[0].contact_title}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {contacts.map(lead => (
              <button key={lead.id} onClick={() => onSelectLead(lead)} style={{
                background: '#1A2A38', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '6px', padding: '8px 12px', textAlign: 'left',
                cursor: 'pointer', color: '#ECF0F1', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 500 }}>{lead.company}</div>
                <div style={{ fontSize: '10px', color: '#667788' }}>{STATUS_LABELS[lead.status] || lead.status}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
