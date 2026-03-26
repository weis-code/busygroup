'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, Play, Download, Plus, Pencil, Trash2, Check, X, Users, ShieldCheck, UserCircle } from 'lucide-react';
import { useUser } from '@/lib/UserContext';

interface Agent {
  id: string;
  name: string;
  status: string;
  last_run: string;
  runs_today: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  type: 'mrr' | 'onetime';
  currency: string;
  active: number;
}

const AGENT_SCHEDULES: Record<string, string> = {
  'cso': 'Mandag 07:00',
  'se-prospecting': 'Mandag 08:00',
  'se-outreach': 'Mandag 09:00',
  'se-followup': 'Daglig 08:30',
  'se-booking': 'Daglig 09:00',
};

const API_KEYS = [
  { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', hint: 'console.anthropic.com → API Keys' },
  { key: 'SLACK_BOT_TOKEN', label: 'Slack Bot Token', hint: 'api.slack.com/apps → OAuth & Permissions' },
  { key: 'SLACK_SIGNING_SECRET', label: 'Slack Signing Secret', hint: 'api.slack.com/apps → Basic Information' },
  { key: 'PHANTOMBUSTER_API_KEY', label: 'Phantombuster API Key', hint: 'phantombuster.com → Settings → API' },
  { key: 'RESEND_API_KEY', label: 'Resend API Key', hint: 'resend.com → API Keys → Create API Key' },
  { key: 'EMAIL_FROM', label: 'Afsender email', hint: 'F.eks. BusyGroup <salg@busyconsulting.dk> — domænet skal være verificeret i Resend' },
];

const NOTIFICATIONS = [
  { id: 'new_leads', label: 'Nye leads fundet', description: 'Notificer i #agent-salg-sverige når prospecting finder leads' },
  { id: 'meetings_booked', label: 'Møder booket', description: 'Notificer i #busygroup-ledelse og #agent-salg-sverige' },
  { id: 'weekly_report', label: 'Ugentlig CSO rapport', description: 'Rapport til #busygroup-ledelse hver mandag' },
  { id: 'errors', label: 'Agent fejl', description: 'Fejlbeskeder i #agent-alerts' },
  { id: 'replies', label: 'Svar fra leads', description: 'Notificer når et lead svarer på outreach' },
];

const CURRENCIES = ['DKK', 'SEK', 'EUR', 'NOK'];

function timeAgo(dateStr: string): string {
  if (!dateStr) return 'Aldrig';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m siden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}t siden`;
  return new Date(dateStr).toLocaleDateString('da-DK');
}

function formatPrice(price: number, currency: string, type: string) {
  return `${price.toLocaleString('da-DK')} ${currency}${type === 'mrr' ? '/md' : ' engangsbetaling'}`;
}

function SecretInput({ label, hint, envKey }: { label: string; hint: string; envKey: string }) {
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    if (!value.trim()) return;
    setSaved(true);
    toast.success(`${label} gemt`);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ background: '#1A2A38', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#ECF0F1', marginBottom: '2px' }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#667788' }}>{hint}</div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={`Indsæt ${envKey}...`}
            style={{
              background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px', padding: '7px 36px 7px 12px', color: '#ECF0F1',
              fontSize: '12px', width: '100%', outline: 'none', boxSizing: 'border-box',
              fontFamily: show ? 'inherit' : 'monospace',
            }}
          />
          <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#667788', padding: '2px' }}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button onClick={handleSave} style={{ background: saved ? 'rgba(46,204,113,0.2)' : 'rgba(24,95,165,0.2)', border: `1px solid ${saved ? 'rgba(46,204,113,0.4)' : 'rgba(24,95,165,0.4)'}`, borderRadius: '6px', padding: '7px 14px', color: saved ? '#2ECC71' : '#185FA5', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {saved ? '✓ Gemt' : 'Gem'}
        </button>
      </div>
    </div>
  );
}

type ProductType = 'mrr' | 'onetime';
const emptyProduct: { name: string; description: string; price: number; type: ProductType; currency: string } = { name: '', description: '', price: 0, type: 'mrr', currency: 'DKK' };

function ProductsSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; price: number; type: ProductType; currency: string }>(emptyProduct);
  const [saving, setSaving] = useState(false);

  const inputStyle: React.CSSProperties = {
    background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '7px 10px', color: '#ECF0F1',
    fontSize: '12px', outline: 'none', boxSizing: 'border-box',
  };

  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyProduct);
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description || '', price: p.price, type: p.type, currency: p.currency });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || form.price < 0) return;
    setSaving(true);
    try {
      if (editingId) {
        const res = await fetch(`/api/products/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const updated = await res.json();
        setProducts(prev => prev.map(p => p.id === editingId ? updated : p));
        toast.success('Produkt opdateret');
      } else {
        const res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const created = await res.json();
        setProducts(prev => [...prev, created]);
        toast.success('Produkt oprettet');
      }
      setShowForm(false);
      setEditingId(null);
    } catch {
      toast.error('Fejl ved gemning');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Slet "${name}"? Dette fjerner også produktet fra alle leads.`)) return;
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success('Produkt slettet');
    } catch {
      toast.error('Fejl ved sletning');
    }
  };

  const handleToggleActive = async (p: Product) => {
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: p.active ? 0 : 1 }),
      });
      const updated = await res.json();
      setProducts(prev => prev.map(x => x.id === p.id ? updated : x));
    } catch {
      toast.error('Fejl');
    }
  };

  const mrr = products.filter(p => p.type === 'mrr' && p.active);
  const onetime = products.filter(p => p.type === 'onetime' && p.active);
  const inactive = products.filter(p => !p.active);

  return (
    <div>
      {/* Product list */}
      {products.length === 0 && !showForm && (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: '#667788', fontSize: '13px' }}>
          Ingen produkter endnu. Opret dit første produkt.
        </div>
      )}

      {/* MRR */}
      {mrr.length > 0 && (
        <div style={{ padding: '10px 20px 4px', fontSize: '10px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Månedlig betaling (MRR)
        </div>
      )}
      {mrr.map((p, i) => (
        <ProductRow key={p.id} product={p} isLast={i === mrr.length - 1 && onetime.length === 0 && inactive.length === 0} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggleActive} />
      ))}

      {/* One-time */}
      {onetime.length > 0 && (
        <div style={{ padding: '10px 20px 4px', fontSize: '10px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: mrr.length > 0 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
          Engangsbetalinger
        </div>
      )}
      {onetime.map((p, i) => (
        <ProductRow key={p.id} product={p} isLast={i === onetime.length - 1 && inactive.length === 0} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggleActive} />
      ))}

      {/* Inactive */}
      {inactive.length > 0 && (
        <div style={{ padding: '10px 20px 4px', fontSize: '10px', color: '#667788', textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          Inaktive
        </div>
      )}
      {inactive.map((p, i) => (
        <ProductRow key={p.id} product={p} isLast={i === inactive.length - 1} onEdit={openEdit} onDelete={handleDelete} onToggle={handleToggleActive} />
      ))}

      {/* Inline create/edit form */}
      {showForm && (
        <div style={{ margin: '0', borderTop: products.length > 0 ? '1px solid rgba(255,255,255,0.07)' : undefined, padding: '16px 20px', background: 'rgba(24,95,165,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#ECF0F1', marginBottom: '12px' }}>
            {editingId ? 'Rediger produkt' : 'Nyt produkt'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#667788', display: 'block', marginBottom: '4px' }}>Navn *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="AI Receptionist"
                style={{ ...inputStyle, width: '100%' }}
                autoFocus
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#667788', display: 'block', marginBottom: '4px' }}>Type *</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['mrr', 'onetime'] as ProductType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    style={{
                      flex: 1, padding: '7px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px',
                      background: form.type === t ? '#185FA5' : '#1A2A38',
                      color: form.type === t ? '#ECF0F1' : '#667788',
                      fontWeight: form.type === t ? 600 : 400,
                    }}
                  >
                    {t === 'mrr' ? 'MRR /md' : 'Engangs'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#667788', display: 'block', marginBottom: '4px' }}>Pris *</label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                placeholder="1000"
                style={{ ...inputStyle, width: '100%' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#667788', display: 'block', marginBottom: '4px' }}>Valuta</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                style={{ ...inputStyle, width: '100%' }}
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: '#667788', display: 'block', marginBottom: '4px' }}>Beskrivelse</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Kort beskrivelse af produktet..."
              style={{ ...inputStyle, width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: saving || !form.name.trim() ? 'rgba(24,95,165,0.4)' : '#185FA5',
                border: 'none', borderRadius: '6px', padding: '7px 14px',
                color: '#ECF0F1', fontSize: '12px', fontWeight: 500,
                cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              <Check size={13} /> {saving ? 'Gemmer...' : editingId ? 'Gem ændringer' : 'Opret produkt'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '7px 12px', color: '#667788', fontSize: '12px', cursor: 'pointer' }}
            >
              <X size={13} /> Annuller
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showForm && (
        <div style={{ padding: '12px 20px', borderTop: products.length > 0 ? '1px solid rgba(255,255,255,0.07)' : undefined }}>
          <button
            onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(24,95,165,0.12)', border: '1px solid rgba(24,95,165,0.25)', borderRadius: '6px', padding: '7px 14px', color: '#185FA5', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
          >
            <Plus size={13} /> Tilføj produkt
          </button>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product, isLast, onEdit, onDelete, onToggle }: {
  product: Product;
  isLast: boolean;
  onEdit: (p: Product) => void;
  onDelete: (id: string, name: string) => void;
  onToggle: (p: Product) => void;
}) {
  return (
    <div style={{
      padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: !isLast ? '1px solid rgba(255,255,255,0.04)' : 'none',
      opacity: product.active ? 1 : 0.5,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#ECF0F1' }}>{product.name}</span>
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
            background: product.type === 'mrr' ? 'rgba(24,95,165,0.2)' : 'rgba(15,110,86,0.2)',
            color: product.type === 'mrr' ? '#185FA5' : '#0F6E56',
            textTransform: 'uppercase',
          }}>
            {product.type === 'mrr' ? 'MRR' : 'Engangs'}
          </span>
        </div>
        {product.description && (
          <div style={{ fontSize: '11px', color: '#667788', marginTop: '2px' }}>{product.description}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#ECF0F1', whiteSpace: 'nowrap' }}>
          {formatPrice(product.price, product.currency, product.type)}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => onToggle(product)} title={product.active ? 'Deaktivér' : 'Aktivér'} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', color: product.active ? '#2ECC71' : '#667788', fontSize: '11px' }}>
            {product.active ? 'Aktiv' : 'Inaktiv'}
          </button>
          <button onClick={() => onEdit(product)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', color: '#667788' }}>
            <Pencil size={12} />
          </button>
          <button onClick={() => onDelete(product.id, product.name)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', color: '#667788' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'seller';
  active: number;
  created_at: string;
  last_login: string | null;
}

const emptyUserForm = { name: '', email: '', password: '', role: 'seller' as 'admin' | 'seller' };

function UsersSection() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyUserForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { user: me } = useUser();

  const inputStyle: React.CSSProperties = {
    background: '#0F1923', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '7px 10px', color: '#ECF0F1',
    fontSize: '12px', outline: 'none', boxSizing: 'border-box',
  };

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setUsers(data);
    }).catch(() => {});
  }, []);

  const handleCreateOrEdit = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    if (!editingId && !form.password.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const body: Record<string, unknown> = { name: form.name, role: form.role };
        if (form.password.trim()) body.password = form.password;
        const res = await fetch(`/api/users/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const updated = await res.json();
        if (!res.ok) { toast.error(updated.error || 'Fejl'); return; }
        setUsers(prev => prev.map(u => u.id === editingId ? { ...u, ...updated } : u));
        toast.success('Bruger opdateret');
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }),
        });
        const created = await res.json();
        if (!res.ok) { toast.error(created.error || 'Fejl'); return; }
        setUsers(prev => [...prev, created]);
        toast.success('Bruger oprettet');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyUserForm);
    } catch {
      toast.error('Netværksfejl');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u: UserRecord) => {
    if (u.id === me?.id) { toast.error('Du kan ikke deaktivere dig selv'); return; }
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: u.active ? 0 : 1 }),
    });
    const updated = await res.json();
    if (res.ok) {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, active: updated.active } : x));
      toast.success(updated.active ? 'Bruger aktiveret' : 'Bruger deaktiveret');
    } else {
      toast.error(updated.error || 'Fejl');
    }
  };

  const handleDelete = async (u: UserRecord) => {
    if (!confirm(`Slet "${u.name}"? Brugerens leads og kunder vil blive tildelt ingen.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast.success('Bruger slettet');
    } else {
      const data = await res.json();
      toast.error(data.error || 'Fejl');
    }
  };

  const openEdit = (u: UserRecord) => {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: '', role: u.role });
    setShowForm(true);
  };

  return (
    <div>
      {/* User list */}
      {users.map((u, i) => (
        <div key={u.id} style={{
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px',
          borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          opacity: u.active ? 1 : 0.5,
        }}>
          {/* Avatar */}
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
            background: u.role === 'admin' ? 'rgba(231,76,60,0.15)' : 'rgba(24,95,165,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: u.role === 'admin' ? '#E74C3C' : '#185FA5',
          }}>
            {u.role === 'admin' ? <ShieldCheck size={16} /> : <UserCircle size={16} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#ECF0F1' }}>{u.name}</span>
              {u.id === me?.id && (
                <span style={{ fontSize: '10px', color: '#667788', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px' }}>dig</span>
              )}
              <span style={{
                fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
                background: u.role === 'admin' ? 'rgba(231,76,60,0.15)' : 'rgba(24,95,165,0.15)',
                color: u.role === 'admin' ? '#E74C3C' : '#185FA5',
                textTransform: 'uppercase',
              }}>
                {u.role === 'admin' ? 'Admin' : 'Sælger'}
              </span>
              {!u.active && (
                <span style={{ fontSize: '10px', color: '#667788', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '3px' }}>Inaktiv</span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#667788', marginTop: '2px' }}>
              {u.email} · Sidst logget ind: {u.last_login ? new Date(u.last_login).toLocaleDateString('da-DK') : 'Aldrig'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            <button onClick={() => handleToggleActive(u)} title={u.active ? 'Deaktivér' : 'Aktivér'} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: u.active ? '#2ECC71' : '#667788', fontSize: '11px' }}>
              {u.active ? 'Aktiv' : 'Inaktiv'}
            </button>
            <button onClick={() => openEdit(u)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', color: '#667788' }}>
              <Pencil size={12} />
            </button>
            {u.id !== me?.id && (
              <button onClick={() => handleDelete(u)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '4px 6px', cursor: 'pointer', color: '#667788' }}>
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Create/Edit form */}
      {showForm && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '16px 20px', background: 'rgba(24,95,165,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#ECF0F1', marginBottom: '12px' }}>
            {editingId ? 'Rediger bruger' : 'Ny bruger'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#667788', display: 'block', marginBottom: '4px' }}>Navn *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Fulde navn" style={{ ...inputStyle, width: '100%' }} autoFocus />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#667788', display: 'block', marginBottom: '4px' }}>Rolle *</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['seller', 'admin'] as const).map(r => (
                  <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))} style={{ flex: 1, padding: '7px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', background: form.role === r ? (r === 'admin' ? 'rgba(231,76,60,0.2)' : '#185FA5') : '#1A2A38', color: form.role === r ? (r === 'admin' ? '#E74C3C' : '#ECF0F1') : '#667788', fontWeight: form.role === r ? 600 : 400 }}>
                    {r === 'admin' ? 'Admin' : 'Sælger'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {!editingId && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', color: '#667788', display: 'block', marginBottom: '4px' }}>Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="navn@busyconsulting.dk" style={{ ...inputStyle, width: '100%' }} />
            </div>
          )}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: '#667788', display: 'block', marginBottom: '4px' }}>
              {editingId ? 'Nyt password (lad stå tomt for at beholde)' : 'Password *'}
            </label>
            <div style={{ position: 'relative' }}>
              <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editingId ? 'Lad stå tomt for at beholde...' : 'Min. 8 tegn'} style={{ ...inputStyle, width: '100%', paddingRight: '36px' }} />
              <button onClick={() => setShowPw(s => !s)} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#667788', padding: '2px' }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleCreateOrEdit} disabled={saving || !form.name.trim()} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: saving || !form.name.trim() ? 'rgba(24,95,165,0.4)' : '#185FA5', border: 'none', borderRadius: '6px', padding: '7px 14px', color: '#ECF0F1', fontSize: '12px', fontWeight: 500, cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer' }}>
              <Check size={13} /> {saving ? 'Gemmer...' : editingId ? 'Gem ændringer' : 'Opret bruger'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyUserForm); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '7px 12px', color: '#667788', fontSize: '12px', cursor: 'pointer' }}>
              <X size={13} /> Annuller
            </button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!showForm && (
        <div style={{ padding: '12px 20px', borderTop: users.length > 0 ? '1px solid rgba(255,255,255,0.07)' : undefined }}>
          <button onClick={() => { setEditingId(null); setForm(emptyUserForm); setShowForm(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(24,95,165,0.12)', border: '1px solid rgba(24,95,165,0.25)', borderRadius: '6px', padding: '7px 14px', color: '#185FA5', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
            <Plus size={13} /> Tilføj bruger
          </button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [notifications, setNotifications] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATIONS.map(n => [n.id, true]))
  );
  const [runningAgent, setRunningAgent] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agents').then(r => r.json()).then(setAgents).catch(() => {});
  }, []);

  const handleRunAgent = async (agentId: string) => {
    if (runningAgent) return;
    setRunningAgent(agentId);
    const tid = toast.loading(`Starter ${agentId}...`);
    try {
      const res = await fetch(`/api/agents/${agentId}/run`, { method: 'POST' });
      const json = await res.json();
      toast.dismiss(tid);
      if (json.success) {
        toast.success(`Agent kørt på ${json.duration}ms`);
        const agentsRes = await fetch('/api/agents');
        setAgents(await agentsRes.json());
      } else {
        toast.error(json.message || 'Fejl');
      }
    } catch {
      toast.dismiss(tid);
      toast.error('Netværksfejl');
    } finally {
      setRunningAgent(null);
    }
  };

  const exportDB = async () => {
    try {
      const res = await fetch('/api/leads');
      const leads = await res.json();
      const headers = ['id,company,contact_name,contact_title,email,phone,status,market,priority,created_at'];
      const rows = leads.map((l: Record<string, string>) =>
        Object.values(l).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
      );
      const csv = [...headers, ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `busygroup-export-${new Date().toISOString().split('T')[0]}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Database eksporteret');
    } catch {
      toast.error('Fejl ved eksport');
    }
  };

  const sectionStyle: React.CSSProperties = {
    background: '#111E2A', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '10px', marginBottom: '16px', overflow: 'hidden',
  };
  const sectionHeaderStyle: React.CSSProperties = {
    padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
    fontSize: '13px', fontWeight: 600, color: '#ECF0F1',
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: '#ECF0F1' }}>Indstillinger</h1>

      {/* Users — admin only */}
      {user?.role === 'admin' && (
        <div style={sectionStyle}>
          <div style={{ ...sectionHeaderStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={14} />
            <span>Brugere</span>
          </div>
          <UsersSection />
        </div>
      )}

      {/* Products */}
      <div style={sectionStyle}>
        <div style={{ ...sectionHeaderStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Produkter</span>
          <span style={{ fontSize: '11px', color: '#667788', fontWeight: 400 }}>Vises som valgmuligheder i CRM lead-skufferne</span>
        </div>
        <ProductsSection />
      </div>

      {/* API Keys */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>API Nøgler</div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {API_KEYS.map(k => (
            <SecretInput key={k.key} envKey={k.key} label={k.label} hint={k.hint} />
          ))}
        </div>
      </div>

      {/* Agent Schedules */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Agent planlægning</div>
        <div style={{ padding: '0' }}>
          {agents.map((agent, i) => (
            <div key={agent.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < agents.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#ECF0F1' }}>{agent.name}</div>
                <div style={{ fontSize: '11px', color: '#667788', marginTop: '2px' }}>
                  {AGENT_SCHEDULES[agent.id] || '—'} · Sidst kørt: {timeAgo(agent.last_run)} · {agent.runs_today} gange i dag
                </div>
              </div>
              <button onClick={() => handleRunAgent(agent.id)} disabled={!!runningAgent} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: runningAgent === agent.id ? 'rgba(24,95,165,0.4)' : 'rgba(24,95,165,0.15)', border: '1px solid rgba(24,95,165,0.3)', borderRadius: '6px', padding: '6px 12px', color: '#185FA5', fontSize: '12px', cursor: runningAgent ? 'not-allowed' : 'pointer' }}>
                <Play size={11} />
                {runningAgent === agent.id ? 'Kører...' : 'Kør nu'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Slack notifikationer</div>
        <div style={{ padding: '0' }}>
          {NOTIFICATIONS.map((notif, i) => (
            <div key={notif.id} style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: i < NOTIFICATIONS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#ECF0F1' }}>{notif.label}</div>
                <div style={{ fontSize: '11px', color: '#667788', marginTop: '2px' }}>{notif.description}</div>
              </div>
              <div onClick={() => setNotifications(prev => ({ ...prev, [notif.id]: !prev[notif.id] }))} style={{ width: '40px', height: '22px', borderRadius: '11px', background: notifications[notif.id] ? '#185FA5' : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#ECF0F1', position: 'absolute', top: '3px', left: notifications[notif.id] ? '21px' : '3px', transition: 'left 0.2s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Eksport</div>
        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '13px', color: '#667788', margin: '0 0 12px' }}>Eksportér alle leads som CSV. Kompatibelt med Salesbase import-format.</p>
          <button onClick={exportDB} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(24,95,165,0.15)', border: '1px solid rgba(24,95,165,0.3)', borderRadius: '6px', padding: '9px 16px', color: '#185FA5', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
            <Download size={14} /> Download leads CSV
          </button>
        </div>
      </div>
    </div>
  );
}
