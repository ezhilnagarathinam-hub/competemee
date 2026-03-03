export interface Admin {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
}

export interface Competition {
  id: string;
  name: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  primary_color: string;
  secondary_color: string;
  is_active: boolean;
  show_results: boolean;
  show_leaderboard: boolean;
  show_detailed_results: boolean;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  competition_id: string;
  question_number: number;
  question_text: string;
  image_url: string | null;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  marks: number;
  explanation: string | null;
  created_at: string;
}

export interface Student {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  address: string | null;
  username: string;
  password: string;
  student_number: number;
  created_at: string;
  updated_at: string;
}

export interface StudentCompetition {
  id: string;
  student_id: string;
  competition_id: string;
  has_started: boolean;
  has_submitted: boolean;
  started_at: string | null;
  submitted_at: string | null;
  total_marks: number;
  is_locked: boolean;
}

export interface StudentAnswer {
  id: string;
  student_id: string;
  question_id: string;
  competition_id: string;
  selected_answer: 'A' | 'B' | 'C' | 'D' | null;
  is_marked_for_review: boolean;
  is_correct: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  student_id: string;
  student_name: string;
  total_marks: number;
  rank: number;
}
