'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, TrendingUp, Users, DollarSign, X, BarChart2, Monitor, Target } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/UserContext';

interface SalesClient {
  id: string;
  name: string;
  description: string | null;
  type: 'sales' | 'booking';
  color: string;
  created_at: string;
  deal_count: number;
  total_revenue: number;
  month_revenue: number;
}

interface SellerUser { id: string; name: string; }

interface Goal {
  id: string;
  user_id: string;
  user_name: string;
  period: string;
  revenue_goal: number;
  deals_goal: number;
}

const CLIENT_COLORS = ['#3498DB','#E84025','#2ECC71','#9B59B6','#E67E22','#1ABC9C','#E91E63','#F39C12'];

function formatDKK(n: number) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(n);
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return 'I dag';
  if (d === 1) return 'I går';
  if (d < 30) return `${d}d siden`;
  return new Date(iso).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

const inputStyle: React.CSSProperties = {
  background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 7, padding: '8px 11px', color: '#1E293B',
  fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box',
};

export default function SalgPage() {
  const router = useRouter();
  const { user } = useUser();
  const isAdmin = user?.role === 'admin';
  const [clients, setClients] = useState<SalesClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'sales' as 'sales' | 'booking', color: '#3498DB' });

  // Goals (admin only)
  const [showGoals, setShowGoals] = useState(false);
  const [sellers, setSellers] = useState<SellerUser[]>([]);
  const [goalPeriod, setGoalPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [savingGoal, setSavingGoal] = useState<string | null>(null);
  const [goalForms, setGoalForms] = useState<Record<string, { revenue_goal: string; deals_goal: string }>>({});

  useEffect(() => {
    fetch('/api/salg/clients')
      .then(r => r.json())
      .then(d => { setClients(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadGoals = useCallback(() => {
    if (!isAdmin) return;
    Promise.all([
      fetch('/api/users').then(r => r.ok ? r.json() : []),
      fetch(`/api/salg/goals?period=${goalPeriod}`).then(r => r.ok ? r.json() : []),
    ]).then(([u, g]) => {
      setSellers(Array.isArray(u) ? u : []);
      const forms: Record<string, { revenue_goal: string; deals_goal: string }> = {};
      (Array.isArray(u) ? u : []).forEach((seller: SellerUser) => {
        const existing = (Array.isArray(g) ? g : []).find((gx: Goal) => gx.user_id === seller.id);
        forms[seller.id] = {
          revenue_goal: existing ? String(existing.revenue_goal) : '',
          deals_goal:   existing ? String(existing.deals_goal) : '',
        };
      });
      setGoalForms(forms);
    });
  }, [goalPeriod, isAdmin]);

  useEffect(() => { if (showGoals) loadGoals(); }, [showGoals, loadGoals]);

  const saveGoal = async (userId: string) => {
    setSavingGoal(userId);
    try {
      const f = goalForms[userId] || { revenue_goal: '0', deals_goal: '0' };
      await fetch('/api/salg/goals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, period: goalPeriod, revenue_goal: Number(f.revenue_goal) || 0, deals_goal: Number(f.deals_goal) || 0 }),
      });
      toast.success('Mål gemt');
    } catch { toast.error('Noget gik galt'); }
    finally { setSavingGoal(null); }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Navn er påkrævet'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/salg/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const client = await res.json();
      setClients(prev => [{ ...client, deal_count: 0, total_revenue: 0, month_revenue: 0 }, ...prev]);
      setShowCreate(false);
      setForm({ name: '', description: '', type: 'sales', color: '#3498DB' });
      toast.success('Klient oprettet');
    } catch {
      toast.error('Noget gik galt');
    } finally {
      setSaving(false);
    }
  };

  const totalRevenue   = clients.reduce((s, c) => s + Number(c.total_revenue), 0);
  const monthRevenue   = clients.reduce((s, c) => s + Number(c.month_revenue), 0);
  const totalDeals     = clients.reduce((s, c) => s + Number(c.deal_count), 0);

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', background: '#F1F5F9' }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1E293B' }}>Eksternt Salg</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94A3B8' }}>Administrer klienter og registrér lukkede salg</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => router.push('/salg/dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#1E293B', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            <Monitor size={15} /> Dashboard
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowGoals(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#F8FAFC', color: '#475569', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <Target size={15} /> Sæt mål
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#E84025', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              <Plus size={15} /> Ny klient
            </button>
          )}
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Klienter',            value: clients.length,                              icon: Users,       color: '#3498DB' },
          { label: 'Lukkede salg i alt',  value: totalDeals,                                  icon: TrendingUp,  color: '#2ECC71' },
          { label: 'Omsætning denne md.', value: isAdmin ? formatDKK(monthRevenue) : '—',     icon: BarChart2,   color: '#E84025' },
          { label: 'Total omsætning',     value: isAdmin ? formatDKK(totalRevenue) : '—',     icon: DollarSign,  color: '#9B59B6' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#FFFFFF', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <stat.icon size={18} color={stat.color} />
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1E293B', lineHeight: 1.2 }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Client grid ───────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8', fontSize: 13 }}>Indlæser...</div>
      ) : clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <TrendingUp size={48} color="#CBD5E1" />
          <div style={{ color: '#94A3B8', marginTop: 16, fontSize: 15, fontWeight: 600 }}>Ingen klienter endnu</div>
          <div style={{ color: '#CBD5E1', fontSize: 13, marginTop: 6 }}>Opret din første klient for at komme i gang</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {clients.map(client => (
            <div
              key={client.id}
              onClick={() => router.push(`/salg/${client.id}`)}
              style={{ background: '#FFFFFF', borderRadius: 12, border: '1px solid rgba(0,0,0,0.07)', padding: 20, cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
            >
              {/* Client header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: client.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                  {client.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 5, background: client.type === 'booking' ? 'rgba(52,152,219,0.12)' : 'rgba(46,204,113,0.12)', color: client.type === 'booking' ? '#3498DB' : '#27AE60' }}>
                    {client.type === 'booking' ? 'Mødebooking' : 'Salg'}
                  </span>
                </div>
              </div>

              {client.description && (
                <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 14px', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {client.description}
                </p>
              )}

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1E293B' }}>{Number(client.deal_count)}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>Lukkede salg</div>
                </div>
                <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E293B' }}>{isAdmin ? formatDKK(Number(client.month_revenue)) : '—'}</div>
                  <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>Denne måned</div>
                </div>
              </div>

              <div style={{ marginTop: 12, fontSize: 11, color: '#CBD5E1' }}>Oprettet {timeAgo(client.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Opret klient modal ────────────────────────────────────────────── */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 28, width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Ny salgsklient</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 5, fontWeight: 500 }}>Klientnavn *</div>
                <input style={inputStyle} placeholder="f.eks. Acme A/S" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 5, fontWeight: 500 }}>Beskrivelse</div>
                <input style={inputStyle} placeholder="Kort beskrivelse af samarbejdet" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 5, fontWeight: 500 }}>Type</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['sales', 'booking'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(p => ({ ...p, type: t }))}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: `1.5px solid ${form.type === t ? '#E84025' : 'rgba(0,0,0,0.1)'}`, background: form.type === t ? 'rgba(232,64,37,0.06)' : '#F8FAFC', color: form.type === t ? '#E84025' : '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      {t === 'sales' ? 'Salg' : 'Mødebooking'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: '#64748B', marginBottom: 8, fontWeight: 500 }}>Farve</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {CLIENT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(p => ({ ...p, color: c }))}
                      style={{ width: 28, height: 28, borderRadius: 7, background: c, border: form.color === c ? '2.5px solid #1E293B' : '2.5px solid transparent', cursor: 'pointer', padding: 0 }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setShowCreate(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)', background: '#F8FAFC', color: '#475569', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Annullér
              </button>
              <button onClick={handleCreate} disabled={saving || !form.name.trim()} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: form.name.trim() && !saving ? '#E84025' : '#F1F5F9', color: form.name.trim() && !saving ? '#fff' : '#94A3B8', fontSize: 13, fontWeight: 600, cursor: form.name.trim() && !saving ? 'pointer' : 'not-allowed' }}>
                {saving ? 'Opretter...' : 'Opret klient'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sæt mål modal (admin) ─────────────────────────────────────────── */}
      {showGoals && isAdmin && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowGoals(false); }}
        >
          <div style={{ background: '#FFFFFF', borderRadius: 14, padding: 28, width: 520, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1E293B' }}>Sæt sælgermål</h3>
              <button onClick={() => setShowGoals(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 5, fontWeight: 500 }}>Periode</div>
              <input
                style={{ ...inputStyle, width: 180 }}
                type="month"
                value={goalPeriod}
                onChange={e => setGoalPeriod(e.target.value)}
              />
            </div>

            {sellers.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Ingen sælgere fundet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sellers.map(seller => {
                  const f = goalForms[seller.id] || { revenue_goal: '', deals_goal: '' };
                  return (
                    <div key={seller.id} style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', marginBottom: 10 }}>{seller.name}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4, fontWeight: 500 }}>Omsætningsmål (DKK)</div>
                          <input
                            style={inputStyle}
                            type="number"
                            placeholder="0"
                            value={f.revenue_goal}
                            onChange={e => setGoalForms(prev => ({ ...prev, [seller.id]: { ...prev[seller.id], revenue_goal: e.target.value } }))}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4, fontWeight: 500 }}>Salgs-mål (antal)</div>
                          <input
                            style={inputStyle}
                            type="number"
                            placeholder="0"
                            value={f.deals_goal}
                            onChange={e => setGoalForms(prev => ({ ...prev, [seller.id]: { ...prev[seller.id], deals_goal: e.target.value } }))}
                          />
                        </div>
                        <button
                          onClick={() => saveGoal(seller.id)}
                          disabled={savingGoal === seller.id}
                          style={{ padding: '8px 14px', borderRadius: 7, border: 'none', background: '#E84025', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {savingGoal === seller.id ? '...' : 'Gem'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
