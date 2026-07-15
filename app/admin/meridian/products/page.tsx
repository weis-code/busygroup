'use client';

import { useEffect, useState, useCallback } from 'react';

interface Subscription {
  id: number;
  customer_id: number;
  customer_name: string;
  price_dkk: number;
  status: string;
  started_at: string | null;
}

interface Product {
  product_name: string;
  active_count: number;
  inactive_count: number;
  mrr: number;
  first_started: string | null;
  subscriptions: Subscription[];
}

interface Customer {
  id: number;
  name: string;
  status: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat('da-DK').format(n) + ' kr.';
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active:    { bg: 'var(--gr2)', color: 'var(--gr)',  label: 'Aktiv' },
  paused:    { bg: 'var(--ye2)', color: 'var(--ye)',  label: 'Sat i bero' },
  cancelled: { bg: 'var(--s3)',  color: 'var(--t3)',  label: 'Annulleret' },
};

/* ── Add subscription modal ──────────────────────────── */
function AddSubscriptionModal({ products, customers, onClose, onSaved }: {
  products: Product[];
  customers: Customer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const existingNames = products.map(p => p.product_name);
  const [form, setForm] = useState({
    customer_id: '',
    product_name: existingNames[0] ?? '',
    product_name_custom: '',
    use_custom: false,
    price_dkk: '',
    started_at: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const productName = form.use_custom ? form.product_name_custom.trim() : form.product_name;

  async function submit() {
    if (!form.customer_id || !productName || saving) return;
    setSaving(true);
    await fetch('/api/meridian/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: Number(form.customer_id),
        product_name: productName,
        price_dkk: Number(form.price_dkk) || 0,
        started_at: form.started_at || undefined,
      }),
    });
    setSaving(false);
    onSaved();
    onClose();
  }

  const inp: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontSize: 13, padding: '8px 10px',
    background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--t1)',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 12, padding: '24px 26px', width: '100%', maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 20 }}>Tilføj abonnement</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Kunde *</div>
          <select value={form.customer_id} onChange={e => setForm(f => ({ ...f, customer_id: e.target.value }))} style={inp}>
            <option value="">Vælg kunde…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Produkt *</div>
          {!form.use_custom ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} style={{ ...inp, flex: 1 }}>
                {existingNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button onClick={() => setForm(f => ({ ...f, use_custom: true, product_name_custom: '' }))}
                style={{ fontSize: 11, padding: '8px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--t2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Nyt
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              <input autoFocus value={form.product_name_custom} onChange={e => setForm(f => ({ ...f, product_name_custom: e.target.value }))}
                placeholder="Produktnavn…" style={{ ...inp, flex: 1 }} />
              <button onClick={() => setForm(f => ({ ...f, use_custom: false }))}
                style={{ fontSize: 11, padding: '8px 10px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, color: 'var(--t2)', cursor: 'pointer' }}>
                ← Eksisterende
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Pris (kr./md.)</div>
            <input type="number" min="0" value={form.price_dkk} onChange={e => setForm(f => ({ ...f, price_dkk: e.target.value }))}
              placeholder="0" style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>Startdato</div>
            <input type="date" value={form.started_at} onChange={e => setForm(f => ({ ...f, started_at: e.target.value }))} style={inp} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void submit()} disabled={!form.customer_id || !productName || saving}
            style={{ flex: 1, background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!form.customer_id || !productName) ? 0.5 : 1 }}>
            {saving ? 'Tilføjer…' : 'Tilføj abonnement'}
          </button>
          <button onClick={onClose} style={{ background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 7, padding: '9px 14px', fontSize: 13, color: 'var(--t2)', cursor: 'pointer' }}>Annuller</button>
        </div>
      </div>
    </div>
  );
}

/* ── Edit subscription inline ────────────────────────── */
function SubRow({ sub, onUpdated }: { sub: Subscription; onUpdated: () => void }) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(String(sub.price_dkk));
  const [status, setStatus] = useState(sub.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/meridian/products/${sub.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_dkk: Number(price), status }),
    });
    setSaving(false);
    setEditing(false);
    onUpdated();
  }

  async function remove() {
    if (!confirm(`Fjern abonnement for ${sub.customer_name}?`)) return;
    await fetch(`/api/meridian/products/${sub.id}`, { method: 'DELETE' });
    onUpdated();
  }

  const st = STATUS_STYLE[sub.status] ?? STATUS_STYLE.active;

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: '1px solid var(--bd)', background: 'var(--s2)' }}>
        <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{sub.customer_name}</div>
        <input type="number" value={price} onChange={e => setPrice(e.target.value)}
          style={{ width: 90, fontSize: 12, padding: '4px 7px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--t1)' }} />
        <select value={status} onChange={e => setStatus(e.target.value)}
          style={{ fontSize: 11, padding: '4px 7px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--t1)' }}>
          <option value="active">Aktiv</option>
          <option value="paused">Sat i bero</option>
          <option value="cancelled">Annulleret</option>
        </select>
        <button onClick={() => void save()} disabled={saving}
          style={{ fontSize: 11, padding: '4px 9px', background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
          {saving ? '…' : 'Gem'}
        </button>
        <button onClick={() => setEditing(false)}
          style={{ fontSize: 11, padding: '4px 9px', background: 'var(--s3)', border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--t2)', cursor: 'pointer' }}>
          Annuller
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderTop: '1px solid var(--bd)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}>
      <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {sub.customer_name}
      </div>
      <div style={{ fontSize: 12, color: 'var(--t2)', flexShrink: 0, minWidth: 90, textAlign: 'right' }}>
        {sub.price_dkk > 0 ? fmt(sub.price_dkk) : '—'}
      </div>
      <div style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0, minWidth: 90 }}>{fmtDate(sub.started_at)}</div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
      <button onClick={() => setEditing(true)}
        style={{ fontSize: 10, padding: '2px 8px', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 5, color: 'var(--t2)', cursor: 'pointer', flexShrink: 0 }}>
        Rediger
      </button>
      <button onClick={() => void remove()}
        style={{ fontSize: 10, padding: '2px 8px', background: 'none', border: 'none', color: 'var(--re)', cursor: 'pointer', flexShrink: 0 }}>
        Fjern
      </button>
    </div>
  );
}

/* ── Product card ────────────────────────────────────── */
function ProductCard({ product, onUpdated }: { product: Product; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const activeSubs = product.subscriptions.filter(s => s.status === 'active');
  const inactiveSubs = product.subscriptions.filter(s => s.status !== 'active');

  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(v => !v)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{product.product_name}</div>
          {product.first_started && (
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>Siden {fmtDate(product.first_started)}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>MRR</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gr)' }}>{fmt(product.mrr)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Aktive</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--bl)' }}>{product.active_count}</div>
          </div>
          {product.inactive_count > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Inaktive</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--t3)' }}>{product.inactive_count}</div>
            </div>
          )}
        </div>
        <span style={{ color: 'var(--t3)', fontSize: 12, transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>▾</span>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid var(--bd)' }}>
          {product.subscriptions.length === 0 ? (
            <div style={{ padding: '16px', fontSize: 12, color: 'var(--t3)', textAlign: 'center' }}>Ingen abonnementer</div>
          ) : (
            <>
              <div style={{ display: 'flex', padding: '6px 14px', background: 'var(--s2)' }}>
                <div style={{ flex: 1, fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Kunde</div>
                <div style={{ width: 90, fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Pris/md.</div>
                <div style={{ width: 90, fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 10 }}>Start</div>
                <div style={{ width: 74, fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginLeft: 10 }}>Status</div>
                <div style={{ width: 110 }} />
              </div>
              {activeSubs.map(s => <SubRow key={s.id} sub={s} onUpdated={onUpdated} />)}
              {inactiveSubs.map(s => <SubRow key={s.id} sub={s} onUpdated={onUpdated} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Main page ───────────────────────────────────────── */
export default function MeridianProductsPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showAdd, setShowAdd]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [prod, cust] = await Promise.all([
        fetch('/api/meridian/products').then(async r => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({})) as Record<string, string>;
            throw new Error(`HTTP ${r.status} — ${body?.detail ?? body?.error ?? 'ukendt fejl'}`);
          }
          return r.json() as Promise<Product[]>;
        }),
        fetch('/api/customers?companySlug=meridian').then(r => r.json() as Promise<Customer[]>),
      ]);
      setProducts(prod);
      setCustomers(Array.isArray(cust) ? cust.filter((c: Customer) => c.status === 'active') : []);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalMrr = products.reduce((s, p) => s + p.mrr, 0);
  const totalActive = products.reduce((s, p) => s + p.active_count, 0);

  if (loading) return (
    <div style={{ padding: '28px 32px', color: 'var(--t3)', fontSize: 13 }}>Indlæser…</div>
  );

  if (error) return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ color: 'var(--re)', fontSize: 13, fontWeight: 600 }}>Kunne ikke indlæse produkter</div>
      <div style={{ marginTop: 8, color: 'var(--t3)', fontSize: 11, fontFamily: 'monospace', background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 6, padding: '8px 12px', maxWidth: 640, wordBreak: 'break-all' }}>{error}</div>
    </div>
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>Produktkatalog</h1>
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Meridian Consulting · {products.length} produkter · {totalActive} aktive abonnementer</div>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Tilføj abonnement
        </button>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total MRR',         value: fmt(totalMrr),       accent: 'var(--gr)' },
          { label: 'Aktive abonnementer', value: String(totalActive), accent: 'var(--bl)' },
          { label: 'Produkter',          value: String(products.length), accent: 'var(--pu)' },
        ].map(k => (
          <div key={k.label} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.accent, opacity: 0.7, borderRadius: '10px 10px 0 0' }} />
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.accent }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Product list */}
      {products.length === 0 ? (
        <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 10, padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>Ingen produkter endnu</div>
          <button onClick={() => setShowAdd(true)}
            style={{ background: 'var(--bl)', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + Tilføj det første abonnement
          </button>
        </div>
      ) : (
        products.map(p => <ProductCard key={p.product_name} product={p} onUpdated={() => void load()} />)
      )}

      {showAdd && (
        <AddSubscriptionModal
          products={products}
          customers={customers}
          onClose={() => setShowAdd(false)}
          onSaved={() => void load()}
        />
      )}
    </div>
  );
}
