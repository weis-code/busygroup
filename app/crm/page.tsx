'use client';

import { useState, useEffect, useCallback } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import LeadsTable from '@/components/LeadsTable';
import LeadDrawer from '@/components/LeadDrawer';
import LeadCreateModal from '@/components/LeadCreateModal';
import CsvImportModal from '@/components/CsvImportModal';
import MetricTile from '@/components/MetricTile';
import { useUser } from '@/lib/UserContext';
import { Plus, Upload, Users, UserPlus, X, Settings2, ChevronUp, ChevronDown, Trash2, Zap, Globe, Settings, Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

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
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
  product_names?: string;
  pipeline_value?: number;
  // SE fields
  country?: string | null;
  vertical?: string | null;
  research_notes?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
}

interface Workspace {
  id: string;
  name: string;
  color: string;
}

interface PipelineStage {
  pk: string;
  id: string;
  label: string;
  position: number;
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
  const [showUserModal, setShowUserModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<'internal' | string>('internal');
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [marketFilter, setMarketFilter] = useState<'all' | 'sverige'>('all');
  const [generatingLeads, setGeneratingLeads] = useState(false);
  const [generateLog, setGenerateLog] = useState<string[]>([]);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads?workspace_id=' + activeWorkspace);
      if (res.ok) setLeads(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeWorkspace]);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      if (res.ok) setWorkspaces(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchPipelineStages = useCallback(async () => {
    try {
      const res = await fetch(`/api/pipeline-stages?workspace=${activeWorkspace}`);
      if (res.ok) setPipelineStages(await res.json());
    } catch { /* ignore */ }
  }, [activeWorkspace]);

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
    fetchPipelineStages();
  }, [fetchPipelineStages]);

  useEffect(() => {
    if (currentUser?.role === 'admin') { fetchUsers(); fetchWorkspaces(); }
  }, [currentUser, fetchUsers, fetchWorkspaces]);

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
      const workspaceId = activeWorkspace === 'internal' ? null : activeWorkspace;
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, assigned_to: assignedTo, workspace_id: workspaceId }),
      });
      if (res.ok) {
        const newLead = await res.json();
        setLeads(prev => [newLead, ...prev]);
        setShowCreateModal(false);
      }
    } catch (e) { console.error(e); }
  };

  const handleGenerateSELeads = async () => {
    if (generatingLeads) return;
    setGeneratingLeads(true);
    setGenerateLog([]);
    try {
      const workspaceId = activeWorkspace === 'internal' ? null : activeWorkspace;
      const res = await fetch('/api/agents/sweden-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
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
            setGenerateLog(prev => [...prev.slice(-8), event.message]);
            if (event.stage === 'done') {
              toast.success(event.message);
              fetchLeads();
            } else if (event.stage === 'error') {
              toast.error(event.message);
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (e) {
      toast.error('Fejl ved generering af leads');
      console.error(e);
    } finally {
      setGeneratingLeads(false);
    }
  };

  // Filter leads based on selected pipeline (admin only — sellers already filtered by API)
  const visibleLeads = (selectedPipeline
    ? leads.filter(l => l.assigned_to === selectedPipeline)
    : leads
  ).filter(l => marketFilter === 'sverige' ? (l.country === 'SE' || l.market === 'sweden') : true);

  const activeLeads = visibleLeads.filter(l => !['lost', 'deleted', 'won'].includes(l.status));
  const wonThisMonth = visibleLeads.filter(l => l.status === 'won' && l.updated_at && new Date(l.updated_at) > new Date(Date.now() - 30 * 24 * 3600000)).length;
  const bookedCount = visibleLeads.filter(l => l.status === 'booked').length;
  const pipelineValue = activeLeads.reduce((sum, l) => sum + (Number(l.pipeline_value) || 0), 0);
  const wonValue = visibleLeads.filter(l => l.status === 'won').reduce((sum, l) => sum + (Number(l.pipeline_value) || 0), 0);

  const selectedUser = selectedPipeline ? users.find(u => u.id === selectedPipeline) : null;

  return (
    <div style={{ padding: '20px 24px', maxWidth: '1440px', margin: '0 auto' }}>

      {/* Workspace bar (kun admin) */}
      {currentUser?.role === 'admin' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <WorkspaceTab
            label="Intern"
            color="#445566"
            active={activeWorkspace === 'internal'}
            onClick={() => setActiveWorkspace('internal')}
            onSettings={() => { setActiveWorkspace('internal'); setShowWorkspaceSettings(true); }}
          />
          {workspaces.map(ws => (
            <WorkspaceTab
              key={ws.id}
              label={ws.name}
              color={ws.color}
              active={activeWorkspace === ws.id}
              onClick={() => setActiveWorkspace(ws.id)}
              onSettings={() => { setActiveWorkspace(ws.id); setShowWorkspaceSettings(true); }}
              onDelete={async () => {
                if (!confirm(`Slet workspace "${ws.name}"? Leads i workspacet beholder deres data men mister tilknytningen.`)) return;
                await fetch(`/api/workspaces/${ws.id}`, { method: 'DELETE' });
                if (activeWorkspace === ws.id) setActiveWorkspace('internal');
                fetchWorkspaces();
                fetchLeads();
              }}
            />
          ))}
          <button
            onClick={() => setShowWorkspaceModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '6px', border: '1px dashed rgba(255,255,255,0.2)',
              background: 'transparent', color: '#667788', fontSize: '12px', cursor: 'pointer',
            }}
          >
            + Nyt workspace
          </button>
        </div>
      )}

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

      {/* Market filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <Globe size={12} style={{ color: '#445566', flexShrink: 0 }} />
        {([
          { key: 'all', label: 'Alle markeder' },
          { key: 'sverige', label: '🇸🇪 Sverige' },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setMarketFilter(f.key)}
            style={{
              padding: '3px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer',
              background: marketFilter === f.key ? 'rgba(252,210,0,0.15)' : 'rgba(255,255,255,0.04)',
              color: marketFilter === f.key ? '#FCD200' : '#667788',
              fontSize: '12px', fontWeight: marketFilter === f.key ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
        {marketFilter === 'sverige' && (
          <span style={{ fontSize: '11px', color: '#445566', marginLeft: '4px' }}>
            {visibleLeads.length} leads
          </span>
        )}
      </div>

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setShowWorkspaceSettings(true)}
              title={`Indstillinger for ${activeWorkspace === 'internal' ? 'Intern' : (workspaces.find(w => w.id === activeWorkspace)?.name ?? 'workspace')}`}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', padding: '6px 10px', color: '#667788', cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              <Settings size={13} /> Workspace indstillinger
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {currentUser?.role === 'admin' && (
            <button onClick={() => setShowUserModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px', padding: '8px 14px', color: '#ECF0F1', cursor: 'pointer',
              fontSize: '13px', fontWeight: 500,
            }}>
              <UserPlus size={14} /> Ny bruger
            </button>
          )}
          {currentUser?.role === 'admin' && (
            <button
              onClick={handleGenerateSELeads}
              disabled={generatingLeads}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: generatingLeads ? 'rgba(252,210,0,0.08)' : 'rgba(252,210,0,0.12)',
                border: `1px solid ${generatingLeads ? 'rgba(252,210,0,0.4)' : 'rgba(252,210,0,0.3)'}`,
                borderRadius: '6px', padding: '8px 14px',
                color: '#FCD200', cursor: generatingLeads ? 'not-allowed' : 'pointer',
                fontSize: '13px', fontWeight: 500,
              }}
            >
              <Zap size={14} style={{ animation: generatingLeads ? 'pulse 1s infinite' : 'none' }} />
              {generatingLeads ? 'Genererer...' : '🇸🇪 Generer svenske leads'}
            </button>
          )}
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

      {/* Live progress log */}
      {generatingLeads && generateLog.length > 0 && (
        <div style={{
          background: 'rgba(252,210,0,0.05)', border: '1px solid rgba(252,210,0,0.2)',
          borderRadius: '8px', padding: '10px 14px', marginBottom: '16px',
          display: 'flex', flexDirection: 'column', gap: '3px',
        }}>
          {generateLog.map((msg, i) => (
            <div key={i} style={{ fontSize: '12px', color: i === generateLog.length - 1 ? '#FCD200' : '#445566', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {i === generateLog.length - 1 && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#FCD200', animation: 'pulse 1s infinite', flexShrink: 0 }} />}
              {msg}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#667788' }}>Indlæser leads...</div>
      ) : (
        <>
          {activeTab === 'Pipeline' && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <KanbanBoard leads={visibleLeads as any} onUpdateLead={handleLeadUpdate} onSelectLead={(l: any) => setSelectedLead(l)} columns={pipelineStages} users={users} />
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
        <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} onUpdate={handleLeadUpdate} users={users} stages={pipelineStages} />
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
      {showUserModal && (
        <CreateUserModal
          onClose={() => setShowUserModal(false)}
          onCreated={() => { fetchUsers(); setShowUserModal(false); }}
        />
      )}
      {showWorkspaceModal && (
        <CreateWorkspaceModal
          onClose={() => setShowWorkspaceModal(false)}
          onCreated={(ws) => {
            fetchWorkspaces();
            setActiveWorkspace(ws.id);
            setShowWorkspaceModal(false);
          }}
        />
      )}
      {showWorkspaceSettings && (
        <WorkspaceSettingsModal
          workspace={activeWorkspace}
          workspaceMeta={activeWorkspace === 'internal' ? null : (workspaces.find(w => w.id === activeWorkspace) ?? null)}
          stages={pipelineStages}
          leads={leads}
          onClose={() => setShowWorkspaceSettings(false)}
          onChanged={() => { fetchPipelineStages(); fetchWorkspaces(); }}
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

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'seller' });
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const inp: React.CSSProperties = {
    background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7, padding: '8px 11px', color: '#ECF0F1',
    fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box',
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error('Navn, email og adgangskode er påkrævet');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Fejl ved oprettelse'); return; }
      toast.success(`${form.name} oprettet — kan nu logge ind`);
      onCreated();
    } catch {
      toast.error('Fejl ved oprettelse');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401,
        background: '#111E2A', borderRadius: 12, padding: 24, width: 420,
        border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1' }}>Opret ny bruger</div>
            <div style={{ fontSize: 11, color: '#445566', marginTop: 2 }}>Brugeren kan logge ind i dashboardet</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: '#667788', marginBottom: 5 }}>Navn</div>
            <input placeholder="Fulde navn" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#667788', marginBottom: 5 }}>Email</div>
            <input type="email" placeholder="email@firma.dk" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#667788', marginBottom: 5 }}>Adgangskode</div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Midlertidig adgangskode"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                style={{ ...inp, paddingRight: 36 }}
              />
              <button onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#445566', padding: 0 }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#667788', marginBottom: 5 }}>Rolle</div>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={{ ...inp, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
              <option value="seller">Sælger — ser kun egne leads</option>
              <option value="admin">Admin — fuld adgang</option>
            </select>
          </div>
        </div>

        <div style={{ background: 'rgba(52,152,219,0.08)', border: '1px solid rgba(52,152,219,0.15)', borderRadius: 7, padding: '10px 12px', fontSize: 12, color: '#3498DB', lineHeight: 1.5 }}>
          Brugeren logger ind på <strong style={{ color: '#5DADE2' }}>/login</strong> med email og adgangskoden du sætter her.
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: 10, color: '#ECF0F1', fontSize: 13, cursor: 'pointer' }}>
            Annuller
          </button>
          <button onClick={handleCreate} disabled={saving} style={{ flex: 2, background: '#E84025', border: 'none', borderRadius: 7, padding: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Opretter...' : 'Opret bruger'}
          </button>
        </div>
      </div>
    </>
  );
}

function WorkspaceTab({
  label, color, active, onClick, onSettings, onDelete,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  onSettings?: () => void;
  onDelete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '1px' }}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px',
          borderRadius: onSettings ? '6px 0 0 6px' : '6px',
          border: 'none', cursor: 'pointer',
          background: active ? color : 'rgba(255,255,255,0.05)',
          color: active ? '#fff' : '#667788',
          fontSize: '12px', fontWeight: active ? 600 : 400,
          transition: 'all 0.15s',
        }}
      >
        {!active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />}
        {label}
      </button>

      {/* Settings gear — always visible on active tab, shown on hover for inactive */}
      {onSettings && (active || hovered) && (
        <button
          onClick={(e) => { e.stopPropagation(); onSettings(); }}
          title="Indstillinger"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '24px', height: '100%', minHeight: '26px',
            borderRadius: '0 6px 6px 0',
            border: 'none', cursor: 'pointer',
            background: active ? `${color}cc` : 'rgba(255,255,255,0.08)',
            color: active ? 'rgba(255,255,255,0.8)' : '#556677',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = active ? color : 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#ECF0F1'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = active ? `${color}cc` : 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = active ? 'rgba(255,255,255,0.8)' : '#556677'; }}
        >
          <Settings2 size={10} />
        </button>
      )}

      {/* Delete X — on hover, for named workspaces */}
      {onDelete && hovered && !active && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute', right: onSettings ? 28 : 4, top: '50%', transform: 'translateY(-50%)',
            background: 'rgba(231,76,60,0.15)', border: 'none', cursor: 'pointer',
            color: '#E74C3C', borderRadius: '3px',
            padding: '2px 3px', display: 'flex', alignItems: 'center', lineHeight: 1,
          }}
        >
          <X size={9} />
        </button>
      )}
    </div>
  );
}

function CreateWorkspaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: (ws: Workspace) => void }) {
  const PRESET_COLORS = ['#3498DB', '#2ECC71', '#E67E22', '#9B59B6', '#E84025', '#1ABC9C'];
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3498DB');
  const [saving, setSaving] = useState(false);

  const inp: React.CSSProperties = {
    background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7, padding: '8px 11px', color: '#ECF0F1',
    fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box',
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Navn er påkrævet'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Fejl'); return; }
      toast.success(`Workspace "${name}" oprettet`);
      onCreated(data);
    } catch {
      toast.error('Fejl ved oprettelse');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401,
        background: '#111E2A', borderRadius: 12, padding: 24, width: 380,
        border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1' }}>Nyt workspace</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566' }}>
            <X size={18} />
          </button>
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#667788', marginBottom: 5 }}>Navn</div>
          <input
            placeholder="f.eks. Kunde A"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={inp}
            autoFocus
          />
        </div>

        <div>
          <div style={{ fontSize: 11, color: '#667788', marginBottom: 8 }}>Farve</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c, border: 'none',
                  cursor: 'pointer', outline: color === c ? `3px solid #fff` : 'none',
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: 10, color: '#ECF0F1', fontSize: 13, cursor: 'pointer' }}>
            Annuller
          </button>
          <button onClick={handleCreate} disabled={saving} style={{ flex: 2, background: color, border: 'none', borderRadius: 7, padding: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {saving ? 'Opretter...' : 'Opret workspace'}
          </button>
        </div>
      </div>
    </>
  );
}

function WorkspaceSettingsModal({
  workspace,
  workspaceMeta,
  stages,
  leads,
  onClose,
  onChanged,
}: {
  workspace: string;
  workspaceMeta: Workspace | null; // null = internal workspace
  stages: PipelineStage[];
  leads: Lead[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const isInternal = workspace === 'internal';
  const PRESET_COLORS = ['#3498DB', '#2ECC71', '#E67E22', '#9B59B6', '#E84025', '#1ABC9C', '#E74C3C', '#F39C12'];

  // Workspace meta state
  const [wsName, setWsName] = useState(workspaceMeta?.name ?? 'Intern');
  const [wsColor, setWsColor] = useState(workspaceMeta?.color ?? '#445566');
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaSaved, setMetaSaved] = useState(false);

  // Pipeline stage state
  const [local, setLocal] = useState<PipelineStage[]>(() => [...stages].sort((a, b) => a.position - b.position));
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  // Track which stages have unsaved renames
  const [pendingLabels, setPendingLabels] = useState<Record<string, string>>({});

  const inp: React.CSSProperties = {
    background: '#0C1820', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7, padding: '7px 11px', color: '#ECF0F1',
    fontSize: 13, outline: 'none', flex: 1,
  };

  const leadCount = (stageId: string) => leads.filter(l => l.status === stageId).length;

  const saveWorkspaceMeta = async () => {
    if (isInternal || !workspaceMeta) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wsName, color: wsColor }),
      });
      if (res.ok) {
        setMetaSaved(true);
        setTimeout(() => setMetaSaved(false), 2000);
        onChanged();
        toast.success('Workspace gemt');
      } else {
        toast.error('Fejl ved gemning');
      }
    } finally {
      setSavingMeta(false);
    }
  };

  const renameStage = async (pk: string, label: string) => {
    if (!label.trim()) return;
    setSaving(pk);
    const res = await fetch(`/api/pipeline-stages/${pk}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim() }),
    });
    if (res.ok) {
      setLocal(prev => prev.map(s => s.pk === pk ? { ...s, label: label.trim() } : s));
      setPendingLabels(prev => { const n = { ...prev }; delete n[pk]; return n; });
      onChanged();
      toast.success('Stadie gemt');
    } else {
      toast.error('Fejl ved omdøb');
    }
    setSaving(null);
  };

  const moveStage = async (index: number, dir: -1 | 1) => {
    const newLocal = [...local];
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= newLocal.length) return;
    [newLocal[index], newLocal[swapIdx]] = [newLocal[swapIdx], newLocal[index]];
    const updated = newLocal.map((s, i) => ({ ...s, position: i }));
    setLocal(updated);
    await Promise.all(updated.map(s =>
      fetch(`/api/pipeline-stages/${s.pk}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: s.position }),
      })
    ));
    onChanged();
  };

  const deleteStage = async (pk: string, stageId: string) => {
    const cnt = leadCount(stageId);
    if (cnt > 0) {
      toast.error(`Kan ikke slette — ${cnt} lead(s) er i dette stadie. Flyt dem først.`);
      return;
    }
    if (!confirm('Slet dette stadie?')) return;
    setSaving(pk);
    const res = await fetch(`/api/pipeline-stages/${pk}`, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error || 'Fejl ved sletning');
    } else {
      setLocal(prev => prev.filter(s => s.pk !== pk));
      onChanged();
    }
    setSaving(null);
  };

  const addStage = async () => {
    if (!newLabel.trim()) return;
    setSaving('new');
    const res = await fetch('/api/pipeline-stages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newLabel.trim(), workspace }),
    });
    if (res.ok) {
      const s = await res.json();
      setLocal(prev => [...prev, s]);
      setNewLabel('');
      onChanged();
      toast.success(`Stadie "${s.label}" tilføjet`);
    } else {
      toast.error('Fejl ved oprettelse');
    }
    setSaving(null);
  };

  const accentColor = workspaceMeta?.color ?? '#445566';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 400 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401,
        background: '#111E2A', borderRadius: 14, width: 500,
        border: `1px solid ${accentColor}40`,
        display: 'flex', flexDirection: 'column',
        maxHeight: '88vh', overflow: 'hidden',
        boxShadow: `0 0 40px ${accentColor}20, 0 20px 60px rgba(0,0,0,0.5)`,
      }}>
        {/* Header strip */}
        <div style={{
          background: `linear-gradient(135deg, ${accentColor}22, transparent)`,
          borderBottom: `1px solid ${accentColor}30`,
          padding: '18px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1' }}>
                {isInternal ? 'Intern workspace' : wsName}
              </div>
              <div style={{ fontSize: 11, color: '#445566', marginTop: 1 }}>
                Workspace indstillinger &amp; pipeline
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566', padding: '2px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>

          {/* ── Workspace navn + farve (kun for navngivne workspaces) ── */}
          {!isInternal && workspaceMeta && (
            <div style={{
              background: '#0C1820', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.07)',
              padding: '16px', marginBottom: '20px',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#667788', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                Workspace info
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: 11, color: '#556677', marginBottom: 5 }}>Navn</div>
                <input
                  value={wsName}
                  onChange={e => setWsName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveWorkspaceMeta()}
                  style={inp}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: 11, color: '#556677', marginBottom: 7 }}>Farve</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setWsColor(c)}
                      style={{
                        width: 26, height: 26, borderRadius: '50%', background: c,
                        border: wsColor === c ? '3px solid #ECF0F1' : '3px solid transparent',
                        cursor: 'pointer', outline: 'none', transition: 'border 0.15s',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {wsColor === c && <Check size={12} color="#fff" strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={saveWorkspaceMeta}
                disabled={savingMeta}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: metaSaved ? 'rgba(46,204,113,0.15)' : wsColor,
                  border: 'none', borderRadius: 7, padding: '8px 16px',
                  color: metaSaved ? '#2ECC71' : '#fff', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {metaSaved ? <><Check size={12} /> Gemt</> : savingMeta ? 'Gemmer...' : 'Gem ændringer'}
              </button>
            </div>
          )}

          {/* ── Pipeline stadier ── */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#667788', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
              Pipeline stadier
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: '12px' }}>
              {local.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#445566', fontSize: '12px', background: '#0C1820', borderRadius: 8 }}>
                  Ingen stadier endnu — tilføj et nedenfor
                </div>
              )}
              {local.map((stage, i) => {
                const cnt = leadCount(stage.id);
                const pending = pendingLabels[stage.pk];
                const currentLabel = pending !== undefined ? pending : stage.label;
                const isDirty = pending !== undefined && pending !== stage.label;

                return (
                  <div key={stage.pk} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#0C1820', borderRadius: 8,
                    padding: '8px 10px', border: `1px solid ${isDirty ? `${accentColor}50` : 'rgba(255,255,255,0.07)'}`,
                    transition: 'border-color 0.15s',
                  }}>
                    {/* Position */}
                    <span style={{ fontSize: 10, color: '#334455', width: 16, textAlign: 'center', flexShrink: 0, fontFamily: 'monospace' }}>
                      {i + 1}
                    </span>

                    {/* Up/down */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0 }}>
                      <button onClick={() => moveStage(i, -1)} disabled={i === 0}
                        style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#1E3044' : '#556677', padding: '1px', lineHeight: 1 }}>
                        <ChevronUp size={12} />
                      </button>
                      <button onClick={() => moveStage(i, 1)} disabled={i === local.length - 1}
                        style={{ background: 'none', border: 'none', cursor: i === local.length - 1 ? 'default' : 'pointer', color: i === local.length - 1 ? '#1E3044' : '#556677', padding: '1px', lineHeight: 1 }}>
                        <ChevronDown size={12} />
                      </button>
                    </div>

                    {/* Label — controlled input with explicit save */}
                    <input
                      value={currentLabel}
                      onChange={e => setPendingLabels(prev => ({ ...prev, [stage.pk]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') renameStage(stage.pk, currentLabel); if (e.key === 'Escape') setPendingLabels(prev => { const n = { ...prev }; delete n[stage.pk]; return n; }); }}
                      style={{ ...inp, flex: 1 }}
                    />

                    {/* Save button — shows only when there's a pending rename */}
                    {isDirty && (
                      <button
                        onClick={() => renameStage(stage.pk, currentLabel)}
                        disabled={saving === stage.pk}
                        style={{
                          background: accentColor, border: 'none', borderRadius: 6,
                          padding: '5px 10px', color: '#fff', fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        {saving === stage.pk ? '...' : 'Gem'}
                      </button>
                    )}

                    {/* Lead count */}
                    <span style={{
                      fontSize: 11, color: cnt > 0 ? '#AAB8C8' : '#334455',
                      background: cnt > 0 ? 'rgba(255,255,255,0.07)' : 'transparent',
                      borderRadius: 10, padding: '1px 6px', flexShrink: 0, minWidth: 20, textAlign: 'center',
                    }}>
                      {cnt}
                    </span>

                    {/* Delete */}
                    <button
                      onClick={() => deleteStage(stage.pk, stage.id)}
                      disabled={saving === stage.pk}
                      title={cnt > 0 ? `${cnt} leads — flyt dem først` : 'Slet stadie'}
                      style={{ background: 'none', border: 'none', cursor: cnt > 0 ? 'not-allowed' : 'pointer', color: cnt > 0 ? '#1E3044' : '#445566', flexShrink: 0, padding: '3px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add new stage */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Tilføj nyt stadie..."
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addStage()}
                style={{ ...inp, background: '#0C1820' }}
              />
              <button
                onClick={addStage}
                disabled={!newLabel.trim() || saving === 'new'}
                style={{
                  background: newLabel.trim() ? accentColor : 'rgba(255,255,255,0.05)',
                  border: 'none', borderRadius: 7, padding: '7px 14px',
                  color: newLabel.trim() ? '#fff' : '#445566',
                  fontSize: 13, fontWeight: 600, cursor: newLabel.trim() ? 'pointer' : 'default',
                  flexShrink: 0, transition: 'all 0.15s',
                }}
              >
                {saving === 'new' ? '...' : '+ Tilføj'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
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
