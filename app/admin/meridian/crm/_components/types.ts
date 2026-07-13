export interface Stage {
  id: number; name: string; color: string; probability: number;
  position: number; is_won: boolean; is_lost: boolean;
}

export interface Lead {
  id: number; owner_id: string; company_name: string; contact_name: string | null;
  contact_title: string | null; email: string | null; phone: string | null;
  linkedin: string | null; website: string | null; country: string;
  industry: string | null; stage_id: number | null; stage_name: string | null;
  stage_color: string | null; is_won: boolean; is_lost: boolean;
  products: string[]; deal_value_dkk: number; deal_type: string;
  expected_close_date: string | null; probability: number;
  won_at: string | null; lost_at: string | null; lost_reason: string | null;
  notes: string | null; created_at: string; updated_at: string;
  activity_count: number; next_action_label: string | null; next_action_date: string | null;
}

export interface Activity {
  id: number; owner_id: string; lead_id: number; type: string; direction: string;
  title: string | null; body: string | null; outcome: string | null;
  next_action: string | null; next_action_date: string | null;
  occurred_at: string; created_at: string;
  company_name?: string;
}

export const TYPE_META: Record<string, { icon: string; label: string }> = {
  call:      { icon: '📞', label: 'Opkald' },
  email:     { icon: '📧', label: 'Email' },
  meeting:   { icon: '🤝', label: 'Møde' },
  demo:      { icon: '💻', label: 'Demo' },
  proposal:  { icon: '📄', label: 'Tilbud' },
  follow_up: { icon: '🔔', label: 'Opfølgning' },
  linkedin:  { icon: '🔗', label: 'LinkedIn' },
  note:      { icon: '📝', label: 'Note' },
};

export const INDUSTRIES = [
  'Tandlæge','Fysioterapeut','VVS','Elektriker','Byggeri',
  'Advokat','Revisor','Klinik','SaaS','Andet',
];

export const MERIDIAN_PRODUCTS = [
  'AI Receptionist','Quorex','BusyReminder','Hjemmeside',
];

export function fmt(n: number) {
  return new Intl.NumberFormat('da-DK').format(Math.round(n)) + ' kr.';
}

export function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

export function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().slice(0, 10);
}

export function daysInStage(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86400000);
}
