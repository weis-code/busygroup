'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  LogOut, Building2, Package, Calendar, TrendingUp,
  CheckSquare, Clock, AlertTriangle, ChevronRight, User, LayoutGrid,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CustomerData {
  id: string;
  company: string;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  market: string;
  mrr: number;
  contract_start: string | null;
  contract_end: string | null;
  health_score: number;
  segment: string | null;
  notes: string | null;
  products: Array<{ id: string; name: string; price: number; type: string; currency: string }>;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string | null;
  labels: string;
  column_id: string;
  assigned_name: string | null;
}

interface ProjectBoard {
  id: string;
  name: string;
  description: string | null;
  color: string;
  updated_at: string;
  task_count: number;
  columns: Array<{ id: string; name: string; color: string; position: number }>;
  tasks: Task[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

function daysUntil(d: string | null): number {
  if (!d) return 999;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

const PRIORITY_COLORS: Record<string, { text: string; bg: string }> = {
  critical: { text: '#E84025', bg: 'rgba(232,64,37,0.15)' },
  high:     { text: '#E74C3C', bg: 'rgba(231,76,60,0.15)' },
  medium:   { text: '#F39C12', bg: 'rgba(243,156,18,0.15)' },
  low:      { text: '#3498DB', bg: 'rgba(52,152,219,0.15)' },
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Kritisk', high: 'Høj', medium: 'Medium', low: 'Lav',
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div style={{
      background: '#111820', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: '#556677', fontWeight: 500 }}>{label}</span>
        <span style={{ color: accent || '#3A4A5A' }}>{icon}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || '#ECF0F1', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#3A4A5A', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function TaskCard({ task, columns }: { task: Task; columns: ProjectBoard['columns'] }) {
  const col = columns.find(c => c.id === task.column_id);
  const p = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const due = task.due_date ? daysUntil(task.due_date) : null;
  const overdue = due !== null && due < 0;
  const soon = due !== null && due >= 0 && due <= 3;

  return (
    <div style={{
      background: '#0F1420', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 8, padding: '12px 14px',
      borderLeft: `3px solid ${p.text}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#C8D8E8', marginBottom: 4 }}>{task.title}</div>
          {task.description && (
            <div style={{ fontSize: 12, color: '#3A4A5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task.description}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: p.bg, color: p.text, flexShrink: 0, whiteSpace: 'nowrap' }}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {col && (
          <span style={{ fontSize: 10, color: '#667788', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 4 }}>
            {col.name}
          </span>
        )}
        {task.due_date && (
          <span style={{ fontSize: 10, color: overdue ? '#E84025' : soon ? '#F39C12' : '#556677', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={10} />
            {overdue ? `Forsinket ${Math.abs(due!)}d` : due === 0 ? 'I dag' : `om ${due}d`}
          </span>
        )}
        {task.assigned_name && (
          <span style={{ fontSize: 10, color: '#445566', display: 'flex', alignItems: 'center', gap: 3 }}>
            <User size={10} />
            {task.assigned_name}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main portal page ─────────────────────────────────────────────────────────
export default function PortalPage() {
  const router = useRouter();
  const [customer, setCustomer]   = useState<CustomerData | null>(null);
  const [projects, setProjects]   = useState<ProjectBoard[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [activeProject, setActiveProject] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [meRes, projRes] = await Promise.all([
      fetch('/api/portal/me'),
      fetch('/api/portal/projects'),
    ]);

    if (meRes.status === 401) {
      router.replace('/portal/login');
      return;
    }

    if (meRes.ok)   setCustomer(await meRes.json());
    if (projRes.ok) {
      const data: ProjectBoard[] = await projRes.json();
      setProjects(data);
      if (data.length > 0) setActiveProject(data[0].id);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLogout = async () => {
    await fetch('/api/portal/logout', { method: 'POST' });
    router.replace('/portal/login');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0C0F14' }}>
        <div style={{ fontSize: 13, color: '#3A4A5A' }}>Henter data...</div>
      </div>
    );
  }

  if (!customer) {
    router.replace('/portal/login');
    return null;
  }

  const contractDays = daysUntil(customer.contract_end);
  const contractWarning = contractDays > 0 && contractDays < 60;
  const contractExpired = contractDays <= 0;

  const activeBoard = projects.find(p => p.id === activeProject);
  const allTasks = activeBoard?.tasks ?? [];
  const completedCol = activeBoard?.columns.find(c => c.name.toLowerCase().includes('færdig') || c.name.toLowerCase().includes('done'));
  const completedTasks = completedCol ? allTasks.filter(t => t.column_id === completedCol.id) : [];
  const openTasks = allTasks.filter(t => !completedCol || t.column_id !== completedCol.id);

  return (
    <div style={{ minHeight: '100vh', background: '#0C0F14' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56, background: '#090C11',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, #E84025, #C0331A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>B</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#ECF0F1' }}>{customer.company}</span>
          <span style={{ fontSize: 11, color: '#2D3748', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 5 }}>
            Kundeportal
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#AAB8C2', fontWeight: 500 }}>{customer.contact_name || customer.company}</div>
            <div style={{ fontSize: 10, color: '#3A4A5A' }}>{customer.contact_email}</div>
          </div>
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7, padding: '6px 12px', color: '#556677', fontSize: 12, cursor: 'pointer' }}
          >
            <LogOut size={13} /> Log ud
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* Welcome */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#ECF0F1' }}>
            Hej, {customer.contact_name?.split(' ')[0] || customer.company}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#445566' }}>
            Her er dit overblik hos BusyGroup
          </p>
        </div>

        {/* Contract warning */}
        {(contractWarning || contractExpired) && (
          <div style={{
            background: contractExpired ? 'rgba(232,64,37,0.1)' : 'rgba(243,156,18,0.1)',
            border: `1px solid ${contractExpired ? 'rgba(232,64,37,0.3)' : 'rgba(243,156,18,0.3)'}`,
            borderRadius: 10, padding: '12px 16px', marginBottom: 24,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AlertTriangle size={16} color={contractExpired ? '#E84025' : '#F39C12'} />
            <span style={{ fontSize: 13, color: contractExpired ? '#E84025' : '#F39C12' }}>
              {contractExpired
                ? 'Din kontrakt er udløbet — kontakt os for fornyelse'
                : `Din kontrakt udløber om ${contractDays} dage (${formatDate(customer.contract_end)})`}
            </span>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 32 }}>
          <StatCard
            icon={<TrendingUp size={16} />}
            label="Månedlig betaling"
            value={`${(customer.mrr || 0).toLocaleString('da-DK')} DKK`}
            sub={`${((customer.mrr || 0) * 12).toLocaleString('da-DK')} DKK/år`}
            accent="#2ECC71"
          />
          <StatCard
            icon={<Calendar size={16} />}
            label="Kontraktperiode"
            value={formatDate(customer.contract_start)}
            sub={customer.contract_end ? `Udløber: ${formatDate(customer.contract_end)}` : 'Ingen slutdato'}
            accent={contractExpired ? '#E84025' : contractWarning ? '#F39C12' : undefined}
          />
          <StatCard
            icon={<Package size={16} />}
            label="Aktive produkter"
            value={String(customer.products?.length || 0)}
            sub={customer.products?.map(p => p.name).join(', ') || 'Ingen produkter'}
          />
          {projects.length > 0 && (
            <StatCard
              icon={<LayoutGrid size={16} />}
              label="Aktive projekter"
              value={String(projects.length)}
              sub={`${projects.reduce((s, p) => s + (p.task_count || 0), 0)} opgaver i alt`}
              accent="#3498DB"
            />
          )}
        </div>

        {/* Two-col layout */}
        <div style={{ display: 'grid', gridTemplateColumns: projects.length > 0 ? '1fr 360px' : '1fr', gap: 24, alignItems: 'start' }}>

          {/* ── Projekter ────────────────────────────────────────────────── */}
          {projects.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <LayoutGrid size={15} color="#3498DB" />
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#AAB8C2' }}>Projekter</h2>
              </div>

              {/* Project tabs */}
              {projects.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setActiveProject(p.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        border: `1px solid ${activeProject === p.id ? p.color : 'rgba(255,255,255,0.08)'}`,
                        background: activeProject === p.id ? `${p.color}18` : 'transparent',
                        color: activeProject === p.id ? p.color : '#556677',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {activeBoard && (
                <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                  {/* Board header */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: activeBoard.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#ECF0F1' }}>{activeBoard.name}</div>
                      {activeBoard.description && (
                        <div style={{ fontSize: 12, color: '#445566', marginTop: 1 }}>{activeBoard.description}</div>
                      )}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
                      <span style={{ fontSize: 11, color: '#3498DB' }}>
                        <CheckSquare size={11} style={{ display: 'inline', marginRight: 4 }} />
                        {completedTasks.length}/{allTasks.length} færdige
                      </span>
                    </div>
                  </div>

                  {/* Columns overview */}
                  <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: `repeat(${Math.min(activeBoard.columns.length, 4)}, 1fr)`, gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {activeBoard.columns.map(col => {
                      const colTasks = allTasks.filter(t => t.column_id === col.id);
                      const isDone = col.name.toLowerCase().includes('færdig') || col.name.toLowerCase().includes('done');
                      return (
                        <div key={col.id} style={{ background: '#0C0F14', borderRadius: 8, padding: '10px 12px', borderTop: `3px solid ${col.color || '#334455'}` }}>
                          <div style={{ fontSize: 11, color: '#667788', fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.name}</div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: isDone ? '#2ECC71' : '#ECF0F1' }}>{colTasks.length}</div>
                          <div style={{ fontSize: 10, color: '#2D3748' }}>opgave{colTasks.length !== 1 ? 'r' : ''}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Open tasks */}
                  {openTasks.length > 0 && (
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: 11, color: '#445566', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                        Igangværende · {openTasks.length}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {openTasks.slice(0, 10).map(task => (
                          <TaskCard key={task.id} task={task} columns={activeBoard.columns} />
                        ))}
                        {openTasks.length > 10 && (
                          <div style={{ fontSize: 12, color: '#3A4A5A', textAlign: 'center', padding: '8px 0' }}>
                            + {openTasks.length - 10} flere opgaver
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {openTasks.length === 0 && allTasks.length > 0 && (
                    <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                      <CheckSquare size={28} style={{ color: '#2ECC71', display: 'block', margin: '0 auto 8px', opacity: 0.7 }} />
                      <div style={{ fontSize: 13, color: '#2ECC71', fontWeight: 600 }}>Alle opgaver er færdige</div>
                    </div>
                  )}

                  {allTasks.length === 0 && (
                    <div style={{ padding: '24px 20px', textAlign: 'center', fontSize: 13, color: '#3A4A5A' }}>
                      Ingen opgaver endnu
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Right column: konto-info ──────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Kontaktinfo */}
            <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={14} color="#667788" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#8899AA' }}>Kontaktinformation</span>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Firma', value: customer.company },
                  { label: 'Kontakt', value: customer.contact_name },
                  { label: 'Titel', value: customer.contact_title },
                  { label: 'Email', value: customer.contact_email },
                  { label: 'Telefon', value: customer.contact_phone },
                  { label: 'Marked', value: customer.market === 'denmark' ? '🇩🇰 Danmark' : customer.market === 'sweden' ? '🇸🇪 Sverige' : customer.market },
                ].filter(row => row.value).map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 11, color: '#3A4A5A', minWidth: 64, paddingTop: 1 }}>{label}</span>
                    <span style={{ fontSize: 12, color: '#AAB8C2', flex: 1 }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Produkter */}
            {customer.products && customer.products.length > 0 && (
              <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Package size={14} color="#667788" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#8899AA' }}>Dine produkter</span>
                </div>
                <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {customer.products.map(product => (
                    <div key={product.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#0C0F14', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2ECC71' }} />
                        <span style={{ fontSize: 13, color: '#C8D8E8', fontWeight: 500 }}>{product.name}</span>
                      </div>
                      <span style={{ fontSize: 12, color: '#2ECC71', fontWeight: 600 }}>
                        {product.price.toLocaleString('da-DK')} {product.currency}{product.type === 'mrr' ? '/md' : ''}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: '#445566' }}>Total MRR</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#2ECC71' }}>
                      {customer.mrr.toLocaleString('da-DK')} DKK/md
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Kontrakt */}
            <div style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={14} color="#667788" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#8899AA' }}>Kontrakt</span>
              </div>
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#445566' }}>Startdato</span>
                  <span style={{ fontSize: 12, color: '#AAB8C2' }}>{formatDate(customer.contract_start)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#445566' }}>Udløbsdato</span>
                  <span style={{ fontSize: 12, color: contractExpired ? '#E84025' : contractWarning ? '#F39C12' : '#AAB8C2' }}>
                    {formatDate(customer.contract_end)}
                  </span>
                </div>
                {!contractExpired && !contractWarning && contractDays < 999 && (
                  <div style={{ fontSize: 11, color: '#2ECC71', background: 'rgba(46,204,113,0.08)', borderRadius: 6, padding: '6px 10px', textAlign: 'center', marginTop: 4 }}>
                    Fornyes om {contractDays} dage
                  </div>
                )}
              </div>
            </div>

            {/* Support */}
            <div style={{ background: 'rgba(232,64,37,0.07)', border: '1px solid rgba(232,64,37,0.15)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#E84025', marginBottom: 6 }}>Brug for hjælp?</div>
              <div style={{ fontSize: 12, color: '#667788', lineHeight: 1.6 }}>
                Kontakt din account manager ved spørgsmål om din konto, kontrakt eller produkter.
              </div>
              <a
                href={`mailto:${customer.contact_email || 'support@busygroup.dk'}`}
                style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: '#E84025', textDecoration: 'none', fontWeight: 500 }}
              >
                Send email <ChevronRight size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
