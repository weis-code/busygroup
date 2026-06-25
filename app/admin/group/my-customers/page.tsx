'use client';

import { useState, useEffect, useCallback } from 'react';

/* ── Types ──────────────────────────────────────────── */
interface Product {
  id: number;
  name: string;
  price: number;
  type: 'onetime' | 'mrr';
  active: boolean;
  customer_count: number;
}

interface Customer {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  product_id: number | null;
  product_name: string | null;
  product_type: 'onetime' | 'mrr' | null;
  amount: number | null;
  type: 'onetime' | 'mrr';
  closed_date: string | null;
  notes: string | null;
  created_at: string;
}

/* ── Helpers ─────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Product Form Modal ──────────────────────────────── */
function ProductModal({ product, onSave, onClose }: {
  product?: Product;
  onSave: (data: { name: string; price: number; type: 'onetime' | 'mrr' }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [price, setPrice] = useState(product?.price?.toString() ?? '');
  const [type, setType] = useState<'onetime' | 'mrr'>(product?.type ?? 'onetime');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), price: Number(price), type });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 28, width: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>
          {product ? 'Rediger produkt' : 'Nyt produkt'}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, display: 'block', marginBottom: 5 }}>NAVN</label>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="f.eks. BusyReminder Business"
              style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--bd2)', background: 'var(--s2)', color: 'var(--t1)', fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, display: 'block', marginBottom: 5 }}>PRIS (KR)</label>
              <input
                type="number" value={price} onChange={e => setPrice(e.target.value)} required min="0"
                placeholder="0"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--bd2)', background: 'var(--s2)', color: 'var(--t1)', fontSize: 13 }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600, display: 'block', marginBottom: 5 }}>TYPE</label>
              <select
                value={type} onChange={e => setType(e.target.value as 'onetime' | 'mrr')}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--bd2)', background: 'var(--s2)', color: 'var(--t1)', fontSize: 13 }}
              >
                <option value="onetime">Engangsbetaling</option>
                <option value="mrr">MRR (månedlig)</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t3)', fontSize: 13, cursor: 'pointer' }}>
              Annuller
            </button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', background: 'var(--bl)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Gemmer…' : 'Gem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Customer Form Modal ─────────────────────────────── */
function CustomerModal({ customer, products, onSave, onClose }: {
  customer?: Customer;
  products: Product[];
  onSave: (data: Partial<Customer>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(customer?.name ?? '');
  const [company, setCompany] = useState(customer?.company ?? '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [productId, setProductId] = useState<string>(customer?.product_id?.toString() ?? '');
  const [amount, setAmount] = useState(customer?.amount?.toString() ?? '');
  const [type, setType] = useState<'onetime' | 'mrr'>(customer?.type ?? 'onetime');
  const [closedDate, setClosedDate] = useState(customer?.closed_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [saving, setSaving] = useState(false);

  function onProductChange(pid: string) {
    setProductId(pid);
    if (pid) {
      const p = products.find(x => x.id === Number(pid));
      if (p) {
        setType(p.type);
        setAmount(p.price.toString());
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        product_id: productId ? Number(productId) : null,
        amount: amount ? Number(amount) : null,
        type,
        closed_date: closedDate || null,
        notes: notes.trim() || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid var(--bd2)', background: 'var(--s2)', color: 'var(--t1)', fontSize: 13 };
  const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--t3)', fontWeight: 600, display: 'block', marginBottom: 5 };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 28, width: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>
          {customer ? 'Rediger kunde' : 'Ny kunde'}
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>NAVN *</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Kontaktperson" style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>VIRKSOMHED</label>
              <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Firmanavn" style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@firma.dk" style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>TELEFON</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+45 12 34 56 78" style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>PRODUKT</label>
            <select value={productId} onChange={e => onProductChange(e.target.value)} style={inp}>
              <option value="">— Vælg produkt —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type === 'mrr' ? `${fmt(p.price)} kr/md` : `${fmt(p.price)} kr`})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>BELØB (KR)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" min="0" style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>TYPE</label>
              <select value={type} onChange={e => setType(e.target.value as 'onetime' | 'mrr')} style={inp}>
                <option value="onetime">Engangsbetaling</option>
                <option value="mrr">MRR (månedlig)</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>LUKKET DATO</label>
              <input type="date" value={closedDate} onChange={e => setClosedDate(e.target.value)} style={inp} />
            </div>
          </div>
          <div>
            <label style={lbl}>NOTER</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Valgfrie noter…"
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t3)', fontSize: 13, cursor: 'pointer' }}>
              Annuller
            </button>
            <button type="submit" disabled={saving} style={{ flex: 2, padding: '9px 0', borderRadius: 7, border: 'none', background: 'var(--gr)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Gemmer…' : 'Gem kunde'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────── */
export default function MyCustomersPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | undefined>();

  const [showProducts, setShowProducts] = useState(false);

  const load = useCallback(async () => {
    try {
      await fetch('/api/group/my-customers/migrate', { method: 'POST' });
      const [pRes, cRes] = await Promise.all([
        fetch('/api/group/my-products'),
        fetch('/api/group/my-customers'),
      ]);
      const [p, c] = await Promise.all([pRes.json(), cRes.json()]);
      setProducts(Array.isArray(p) ? p : []);
      setCustomers(Array.isArray(c) ? c : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Stats */
  const totalMrr = customers.filter(c => c.type === 'mrr').reduce((s, c) => s + (c.amount ?? 0), 0);
  const totalOnce = customers.filter(c => c.type === 'onetime').reduce((s, c) => s + (c.amount ?? 0), 0);

  /* Product handlers */
  async function saveProduct(data: { name: string; price: number; type: 'onetime' | 'mrr' }) {
    if (editProduct) {
      await fetch(`/api/group/my-products/${editProduct.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } else {
      await fetch('/api/group/my-products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    }
    await load();
  }

  async function deleteProduct(id: number) {
    if (!confirm('Slet produkt?')) return;
    await fetch(`/api/group/my-products/${id}`, { method: 'DELETE' });
    await load();
  }

  /* Customer handlers */
  async function saveCustomer(data: Partial<Customer>) {
    if (editCustomer) {
      await fetch(`/api/group/my-customers/${editCustomer.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } else {
      await fetch('/api/group/my-customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    }
    await load();
  }

  async function deleteCustomer(id: number) {
    if (!confirm('Slet kunde?')) return;
    await fetch(`/api/group/my-customers/${id}`, { method: 'DELETE' });
    await load();
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--t3)', fontSize: 13 }}>
        Indlæser…
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--t1)', margin: 0, letterSpacing: '-0.02em' }}>Mine Kunder</h1>
          <p style={{ fontSize: 13, color: 'var(--t3)', margin: '4px 0 0' }}>Kunder du personligt har lukket</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowProducts(v => !v)}
            style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid var(--bd)', background: showProducts ? 'var(--s2)' : 'transparent', color: 'var(--t2)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            Produkter {products.length > 0 && `(${products.length})`}
          </button>
          <button
            onClick={() => { setEditCustomer(undefined); setShowCustomerModal(true); }}
            style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: 'var(--gr)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Ny kunde
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'MRR', value: totalMrr > 0 ? `${fmt(totalMrr)} kr/md` : '—', sub: `${customers.filter(c => c.type === 'mrr').length} kunder`, color: 'var(--gr)' },
          { label: 'Engangsbetalinger', value: totalOnce > 0 ? `${fmt(totalOnce)} kr` : '—', sub: `${customers.filter(c => c.type === 'onetime').length} kunder`, color: 'var(--bl)' },
          { label: 'Kunder i alt', value: customers.length.toString(), sub: 'lukkede aftaler', color: 'var(--pu)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '18px 20px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Products panel */}
      {showProducts && (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '18px 20px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Dine produkter</div>
            <button
              onClick={() => { setEditProduct(undefined); setShowProductModal(true); }}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t2)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
            >
              + Nyt produkt
            </button>
          </div>
          {products.length === 0 ? (
            <div style={{ color: 'var(--t3)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>Ingen produkter endnu — opret dit første</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
              {products.map(p => (
                <div key={p.id} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{p.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => { setEditProduct(p); setShowProductModal(true); }} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}>✎</button>
                      <button onClick={() => deleteProduct(p.id)} style={{ background: 'none', border: 'none', color: 'var(--re)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}>✕</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: p.type === 'mrr' ? 'var(--gr)' : 'var(--bl)' }}>
                    {fmt(p.price)} kr{p.type === 'mrr' ? '/md' : ''}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: p.type === 'mrr' ? 'var(--gr2)' : 'var(--bl2)', color: p.type === 'mrr' ? 'var(--gr)' : 'var(--bl)', fontWeight: 600 }}>
                      {p.type === 'mrr' ? 'MRR' : 'Engangsbetaling'}
                    </span>
                    {p.customer_count > 0 && (
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>{p.customer_count} kunder</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Customer list */}
      {customers.length === 0 ? (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤝</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', marginBottom: 6 }}>Ingen kunder endnu</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 20 }}>Tilføj din første lukkede kunde</div>
          <button
            onClick={() => { setEditCustomer(undefined); setShowCustomerModal(true); }}
            style={{ padding: '9px 20px', borderRadius: 7, border: 'none', background: 'var(--gr)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + Tilføj kunde
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customers.map(c => (
            <CustomerRow key={c.id} customer={c}
              onEdit={() => { setEditCustomer(c); setShowCustomerModal(true); }}
              onDelete={() => deleteCustomer(c.id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showProductModal && (
        <ProductModal
          product={editProduct}
          onSave={saveProduct}
          onClose={() => { setShowProductModal(false); setEditProduct(undefined); }}
        />
      )}
      {showCustomerModal && (
        <CustomerModal
          customer={editCustomer}
          products={products}
          onSave={saveCustomer}
          onClose={() => { setShowCustomerModal(false); setEditCustomer(undefined); }}
        />
      )}
    </div>
  );
}

/* ── Customer Row ────────────────────────────────────── */
function CustomerRow({ customer: c, onEdit, onDelete }: { customer: Customer; onEdit: () => void; onDelete: () => void }) {
  const [hover, setHover] = useState(false);

  const effectiveAmount = c.amount;
  const isMrr = c.type === 'mrr';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? 'var(--s2)' : 'var(--s1)',
        border: '1px solid var(--bd)',
        borderRadius: 10,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onClick={onEdit}
    >
      {/* Avatar */}
      <div style={{
        width: 38, height: 38, borderRadius: 9, flexShrink: 0,
        background: isMrr ? 'var(--gr2)' : 'var(--bl2)',
        border: `1.5px solid ${isMrr ? 'rgba(45,212,160,0.3)' : 'rgba(79,142,247,0.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: isMrr ? 'var(--gr)' : 'var(--bl)',
      }}>
        {(c.company || c.name).slice(0, 2).toUpperCase()}
      </div>

      {/* Name + company */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {c.company ?? c.name}
        </div>
        {c.company && (
          <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 1 }}>{c.name}</div>
        )}
      </div>

      {/* Product badge */}
      {c.product_name && (
        <div style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'var(--pu2)', color: 'var(--pu)', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {c.product_name}
        </div>
      )}

      {/* Amount */}
      {effectiveAmount != null && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: isMrr ? 'var(--gr)' : 'var(--bl)' }}>
            {fmt(effectiveAmount)} kr{isMrr ? '/md' : ''}
          </div>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>
            {isMrr ? 'MRR' : 'Engangsbetaling'}
          </div>
        </div>
      )}

      {/* Date */}
      {c.closed_date && (
        <div style={{ fontSize: 11, color: 'var(--t3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {fmtDate(c.closed_date)}
        </div>
      )}

      {/* Delete on hover */}
      {hover && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'var(--re2)', border: 'none', borderRadius: 6, padding: '5px 8px', color: 'var(--re)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
        >
          Slet
        </button>
      )}
    </div>
  );
}
