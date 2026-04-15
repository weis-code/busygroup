'use client';

import { useState, useEffect, useCallback } from 'react';
import KanbanBoard from '@/components/KanbanBoard';
import LeadsTable from '@/components/LeadsTable';
import LeadDrawer from '@/components/LeadDrawer';
import LeadCreateModal from '@/components/LeadCreateModal';
import CsvImportModal from '@/components/CsvImportModal';
import MetricTile from '@/components/MetricTile';
import { useUser } from '@/lib/UserContext';
import { Plus, Upload, Users, UserPlus, X, Eye, EyeOff, Settings2, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
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
  const [showPipelineEditor, setShowPipelineEditor] = useState(false);

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

      {/* Workspace bar (kun admin) */}
      {currentUser?.role === 'admin' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
          {/* Intern tab */}
          <WorkspaceTab
            label="Intern"
            color="#445566"
            active={activeWorkspace === 'internal'}
            onClick={() => setActiveWorkspace('internal')}
          />
          {workspaces.map(ws => (
            <WorkspaceTab
              key={ws.id}
              label={ws.name}
              color={ws.color}
              active={activeWorkspace === ws.id}
              onClick={() => setActiveWorkspace(ws.id)}
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
          {currentUser?.role === 'admin' && activeTab === 'Pipeline' && (
            <button
              onClick={() => setShowPipelineEditor(true)}
              title="Rediger pipeline-stadier"
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px', padding: '6px 10px', color: '#667788', cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              <Settings2 size={13} /> Rediger pipeline
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
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
            <KanbanBoard leads={visibleLeads as any} onUpdateLead={handleLeadUpdate} onSelectLead={(l: any) => setSelectedLead(l)} columns={pipelineStages} />
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
      {showPipelineEditor && (
        <PipelineEditorModal
          stages={pipelineStages}
          leads={leads}
          workspace={activeWorkspace}
          onClose={() => setShowPipelineEditor(false)}
          onChanged={fetchPipelineStages}
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
  label, color, active, onClick, onDelete,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
    >
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: onDelete ? '4px 24px 4px 10px' : '4px 10px',
          borderRadius: '6px', border: 'none', cursor: 'pointer',
          background: active ? color : 'rgba(255,255,255,0.05)',
          color: active ? '#fff' : '#667788',
          fontSize: '12px', fontWeight: active ? 600 : 400,
          transition: 'all 0.15s',
        }}
      >
        {!active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />}
        {label}
      </button>
      {onDelete && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: active ? 'rgba(255,255,255,0.7)' : '#445566',
            padding: '2px', display: 'flex', alignItems: 'center', lineHeight: 1,
            fontSize: '11px',
          }}
        >
          <X size={10} />
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

function PipelineEditorModal({
  stages,
  leads,
  workspace,
  onClose,
  onChanged,
}: {
  stages: PipelineStage[];
  leads: Lead[];
  workspace: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [local, setLocal] = useState<PipelineStage[]>(() => [...stages].sort((a, b) => a.position - b.position));
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const inp: React.CSSProperties = {
    background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, padding: '6px 10px', color: '#ECF0F1',
    fontSize: 13, outline: 'none', flex: 1,
  };

  const leadCount = (stageId: string) => leads.filter(l => l.status === stageId).length;

  const renameStage = async (pk: string, label: string) => {
    setSaving(pk);
    await fetch(`/api/pipeline-stages/${pk}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    setSaving(null);
    onChanged();
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

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 401,
        background: '#111E2A', borderRadius: 12, padding: 24, width: 460,
        border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '85vh', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#ECF0F1' }}>Rediger pipeline</div>
            <div style={{ fontSize: 11, color: '#445566', marginTop: 2 }}>Omdøb, tilføj eller slet stadier</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#445566' }}>
            <X size={18} />
          </button>
        </div>

        {/* Stage list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1 }}>
          {local.map((stage, i) => {
            const cnt = leadCount(stage.id);
            return (
              <div key={stage.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#0F1923', borderRadius: 8,
                padding: '8px 10px', border: '1px solid rgba(255,255,255,0.07)',
              }}>
                {/* Up/down */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                  <button
                    onClick={() => moveStage(i, -1)}
                    disabled={i === 0}
                    style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#223344' : '#667788', padding: '1px' }}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={() => moveStage(i, 1)}
                    disabled={i === local.length - 1}
                    style={{ background: 'none', border: 'none', cursor: i === local.length - 1 ? 'default' : 'pointer', color: i === local.length - 1 ? '#223344' : '#667788', padding: '1px' }}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>

                {/* Label input */}
                <input
                  defaultValue={stage.label}
                  onBlur={e => {
                    if (e.target.value.trim() && e.target.value.trim() !== stage.label) {
                      setLocal(prev => prev.map(s => s.pk === stage.pk ? { ...s, label: e.target.value.trim() } : s));
                      renameStage(stage.pk, e.target.value.trim());
                    }
                  }}
                  style={inp}
                />

                {/* Lead count badge */}
                <span style={{
                  fontSize: 11, color: cnt > 0 ? '#ECF0F1' : '#445566',
                  background: cnt > 0 ? 'rgba(255,255,255,0.08)' : 'transparent',
                  borderRadius: 10, padding: '1px 6px', flexShrink: 0, minWidth: 20, textAlign: 'center',
                }}>
                  {cnt}
                </span>

                {/* Delete */}
                <button
                  onClick={() => deleteStage(stage.pk, stage.id)}
                  disabled={saving === stage.pk}
                  title={cnt > 0 ? `${cnt} leads — flyt dem først` : 'Slet stadie'}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: cnt > 0 ? '#334455' : '#445566',
                    flexShrink: 0, padding: '2px',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add new stage */}
        <div style={{ display: 'flex', gap: 8, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 12 }}>
          <input
            placeholder="Nyt stadie..."
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStage()}
            style={{ ...inp, background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <button
            onClick={addStage}
            disabled={!newLabel.trim() || saving === 'new'}
            style={{
              background: newLabel.trim() ? '#E84025' : 'rgba(255,255,255,0.05)',
              border: 'none', borderRadius: 6, padding: '6px 14px',
              color: '#ECF0F1', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}
          >
            {saving === 'new' ? '...' : '+ Tilføj'}
          </button>
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
