'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface LeadData {
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
}

export default function LeadCreateModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (data: Partial<LeadData>) => Promise<void>;
}) {
  const [data, setData] = useState<Partial<LeadData>>({ priority: 'medium', status: 'new', market: 'sweden' });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof LeadData, val: string) => setData(p => ({ ...p, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.company?.trim()) return;
    setSaving(true);
    try { await onCreate(data); } finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    background: '#1A2A38', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px', padding: '8px 12px', color: '#ECF0F1',
    fontSize: '13px', width: '100%', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: '#667788', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: '5px', display: 'block',
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 301, width: '560px', maxHeight: '90vh', overflow: 'hidden',
        background: '#111E2A', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#ECF0F1' }}>Opret nyt lead</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#667788', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Firma *</label>
              <input required value={data.company || ''} onChange={e => set('company', e.target.value)} style={inputStyle} placeholder="Firma AB" />
            </div>
            <div>
              <label style={labelStyle}>Marked</label>
              <select value={data.market || 'sweden'} onChange={e => set('market', e.target.value)} style={inputStyle}>
                <option value="sweden">🇸🇪 Sverige</option>
                <option value="denmark">🇩🇰 Danmark</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Kontaktperson</label>
              <input value={data.contact_name || ''} onChange={e => set('contact_name', e.target.value)} style={inputStyle} placeholder="Fulde navn" />
            </div>
            <div>
              <label style={labelStyle}>Titel</label>
              <input value={data.contact_title || ''} onChange={e => set('contact_title', e.target.value)} style={inputStyle} placeholder="Klinikchef" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>LinkedIn URL</label>
            <input type="url" value={data.linkedin_url || ''} onChange={e => set('linkedin_url', e.target.value)} style={inputStyle} placeholder="https://linkedin.com/in/..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={data.email || ''} onChange={e => set('email', e.target.value)} style={inputStyle} placeholder="navn@firma.se" />
            </div>
            <div>
              <label style={labelStyle}>Telefon</label>
              <input value={data.phone || ''} onChange={e => set('phone', e.target.value)} style={inputStyle} placeholder="+46 70 xxx xx xx" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Firmastørrelse</label>
              <input value={data.company_size || ''} onChange={e => set('company_size', e.target.value)} style={inputStyle} placeholder="5-10 ansatte" />
            </div>
            <div>
              <label style={labelStyle}>Prioritet</label>
              <select value={data.priority || 'medium'} onChange={e => set('priority', e.target.value)} style={inputStyle}>
                <option value="high">● Høj</option>
                <option value="medium">○ Middel</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Hvorfor de passer</label>
            <textarea value={data.why_they_fit || ''} onChange={e => set('why_they_fit', e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Beskriv hvorfor dette lead er relevant for BusyConsulting..." />
          </div>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button type="submit" disabled={saving} style={{
              flex: 1, background: saving ? 'rgba(24,95,165,0.5)' : '#185FA5', border: 'none',
              borderRadius: '6px', padding: '10px', color: '#ECF0F1',
              fontSize: '13px', fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer',
            }}>
              {saving ? 'Opretter...' : 'Opret lead'}
            </button>
            <button type="button" onClick={onClose} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px', padding: '10px 20px', color: '#667788',
              fontSize: '13px', cursor: 'pointer',
            }}>
              Annuller
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
