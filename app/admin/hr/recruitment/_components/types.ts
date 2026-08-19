export interface Candidate {
  id: number;
  full_name: string; email: string | null; phone: string | null; linkedin: string | null;
  applying_for: string; company_id: number | null; company_name: string | null; company_color: string | null;
  source: string | null; salary_expectation: string | null; location: string | null;
  stage: string; applied_at: string | null;
  interview_date: string | null; interview_format: string | null; interview_notes: string | null;
  start_date: string | null; notes: string | null; rejection_reason: string | null;
  hired_at: string | null; stopped_at: string | null;
  assigned_to: string | null; assigned_to_name: string | null;
  comment_count: number; days_in_stage: number;
  checklist_total: number; checklist_done: number; checklist_overdue: boolean | null;
  created_at: string; updated_at: string;
}

export interface CandidateDetail extends Candidate {
  comments: Comment[];
  checklist: ChecklistItem[];
  stage_history: StageHistoryEntry[];
}

export interface Comment {
  id: number; candidate_id: number; author_id: string; author_name: string;
  body: string; created_at: string; updated_at: string;
}

export interface ChecklistItem {
  id: number; candidate_id: number; template_item_id: number | null;
  title: string; is_completed: boolean; completed_at: string | null;
  completed_by: string | null; completed_by_name?: string | null;
  due_date: string | null; position: number;
}

export interface StageHistoryEntry {
  id: number; from_stage: string | null; to_stage: string;
  changed_by: string | null; changed_by_name: string | null; changed_at: string;
}

export interface Company { id: number; name: string; slug: string; color: string }

export interface UserOption { id: string; name: string; role: string }

export interface ChecklistTemplate {
  id: number; name: string; company_id: number | null; company_name: string | null;
  created_by: string; created_at: string; item_count: number;
}

export interface ChecklistTemplateItem {
  id: number; template_id: number; title: string; description: string | null;
  position: number; days_before_start: number; created_at: string;
}
