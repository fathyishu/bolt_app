import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Role = 'admin' | 'hr' | 'manager' | 'sales_executive';

export type LeadStatus =
  | 'new_lead'
  | 'follow_up'
  | 'pre_booking'
  | 'dead_lead'
  | 'bill_declined'
  | 'pending_payment'
  | 'cod_lead'
  | 'closed_lead';

export type PaymentType = 'prepaid' | 'cod';

export type EodStatus = 'pending' | 'verified' | 'rejected';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type LeaveType = 'leave' | 'wfh';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: Role;
  lifetime_pieces: number;
  monthly_pieces: number;
  current_streak: number;
  last_eod_date: string | null;
  sunday_super_streak: boolean;
  manager_daily_target: number;
  streak_frozen: boolean;
  about: string;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  title: string;
  contact_name: string;
  phone: string;
  email: string;
  status: LeadStatus;
  payment_type: PaymentType | null;
  date_of_entry: string | null;
  follow_up_date: string | null;
  date_of_closing: string | null;
  date_of_dispatch: string | null;
  date_of_delivery: string | null;
  pieces_count: number;
  next_payment_date: string | null;
  last_follow_up: string | null;
  assigned_to: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface EodReport {
  id: string;
  user_id: string;
  date: string;
  rings_prev: number;
  rings_new: number;
  accepted_calls: number;
  positive_chats: number;
  billed_clients: number;
  total_pieces: number;
  pieces_sold: number;
  closed_deals: number;
  new_leads_contacted: number;
  daily_notes: string;
  status: EodStatus;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  created_at: string;
  profile?: Profile;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigned_to: string | null;
  assign_to_team: boolean;
  created_by: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  assignee?: Profile;
}

export interface TrophyCase {
  id: string;
  user_id: string;
  month: number;
  year: number;
  pieces: number;
  rank: number | null;
  archived_at: string;
  profile?: Profile;
}

export interface PerformanceCycle {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
}

export interface CycleSnapshot {
  id: string;
  cycle_id: string;
  user_id: string;
  full_name: string;
  pieces: number;
  leads: number;
  rings: number;
  accepted_calls: number;
  positive_chats: number;
  billed_clients: number;
  closed_deals: number;
  chat_positive: number;
  commission: number;
  rank: number | null;
  created_at: string;
  cycle?: PerformanceCycle;
}

export interface ReviewSchedule {
  id: string;
  review_type: 'weekly_standup' | 'monthly_review';
  day_of_week: number | null;
  day_of_month: number | null;
  hour_utc: number;
  minute_utc: number;
  label: string;
  updated_by: string | null;
  updated_at: string;
}

export interface ClosingNewsFeed {
  id: string;
  user_id: string;
  staff_name: string;
  lead_title: string;
  pieces_count: number;
  created_at: string;
}

export interface BreakLog {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string;
  logged_by: string | null;
  created_at: string;
  profile?: Profile;
}

export interface LateCakeSlice {
  id: string;
  user_id: string;
  slices: number;
  cycle_id: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface LateCakeCycle {
  id: string;
  finalized_at: string;
  total_slices: number;
  contributions: { user_id: string; full_name: string; slices: number; share_pct: number }[];
  triggered_by: string | null;
}

export interface AttendanceLog {
  id: string;
  user_id: string;
  date: string;
  entry_time: string | null;
  logged_by: string | null;
  notes: string;
  created_at: string;
  profile?: Profile;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  type: LeaveType;
  date: string;
  reason: string;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile?: Profile;
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  month: number;
  year: number;
  leaves_remaining: number;
  wfh_remaining: number;
}

export interface MonthlyLeaveArchive {
  id: string;
  month: number;
  year: number;
  archived_by: string | null;
  archived_at: string;
  data: { user_id: string; full_name: string; leaves_remaining: number; wfh_remaining: number }[];
}

export interface LevelThreshold {
  id: string;
  level_name: string;
  min_pieces: number;
  updated_by: string | null;
  updated_at: string;
}
