export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string
          password_hash: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          name: string
          password_hash: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          password_hash?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      competition_result_summaries: {
        Row: {
          attempted_questions: number
          competition_id: string
          correct_answers: number
          correct_marks: number
          created_at: string
          id: string
          is_finalized: boolean
          is_topper: boolean
          last_activity_at: string | null
          max_marks: number
          negative_marks: number
          percentage: number
          rank: number | null
          started_at: string | null
          student_competition_id: string | null
          student_id: string
          submitted_at: string | null
          total_marks: number
          updated_at: string
          wrong_answers: number
        }
        Insert: {
          attempted_questions?: number
          competition_id: string
          correct_answers?: number
          correct_marks?: number
          created_at?: string
          id?: string
          is_finalized?: boolean
          is_topper?: boolean
          last_activity_at?: string | null
          max_marks?: number
          negative_marks?: number
          percentage?: number
          rank?: number | null
          started_at?: string | null
          student_competition_id?: string | null
          student_id: string
          submitted_at?: string | null
          total_marks?: number
          updated_at?: string
          wrong_answers?: number
        }
        Update: {
          attempted_questions?: number
          competition_id?: string
          correct_answers?: number
          correct_marks?: number
          created_at?: string
          id?: string
          is_finalized?: boolean
          is_topper?: boolean
          last_activity_at?: string | null
          max_marks?: number
          negative_marks?: number
          percentage?: number
          rank?: number | null
          started_at?: string | null
          student_competition_id?: string | null
          student_id?: string
          submitted_at?: string | null
          total_marks?: number
          updated_at?: string
          wrong_answers?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_result_summaries_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_result_summaries_student_competition_id_fkey"
            columns: ["student_competition_id"]
            isOneToOne: false
            referencedRelation: "student_competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_result_summaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          duration_minutes: number
          end_date: string | null
          end_time: string
          id: string
          is_active: boolean | null
          max_attempts: number
          name: string
          primary_color: string | null
          secondary_color: string | null
          show_detailed_results: boolean | null
          show_leaderboard: boolean | null
          show_results: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          duration_minutes?: number
          end_date?: string | null
          end_time: string
          id?: string
          is_active?: boolean | null
          max_attempts?: number
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          show_detailed_results?: boolean | null
          show_leaderboard?: boolean | null
          show_results?: boolean | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          duration_minutes?: number
          end_date?: string | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          max_attempts?: number
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          show_detailed_results?: boolean | null
          show_leaderboard?: boolean | null
          show_results?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          competition_id: string
          correct_answer: string
          created_at: string | null
          explanation: string | null
          explanation_secondary: string | null
          id: string
          image_url: string | null
          marks: number | null
          option_a: string
          option_a_secondary: string | null
          option_b: string
          option_b_secondary: string | null
          option_c: string
          option_c_secondary: string | null
          option_d: string
          option_d_secondary: string | null
          question_number: number
          question_text: string
          question_text_secondary: string | null
          secondary_language: string | null
        }
        Insert: {
          competition_id: string
          correct_answer: string
          created_at?: string | null
          explanation?: string | null
          explanation_secondary?: string | null
          id?: string
          image_url?: string | null
          marks?: number | null
          option_a: string
          option_a_secondary?: string | null
          option_b: string
          option_b_secondary?: string | null
          option_c: string
          option_c_secondary?: string | null
          option_d: string
          option_d_secondary?: string | null
          question_number: number
          question_text: string
          question_text_secondary?: string | null
          secondary_language?: string | null
        }
        Update: {
          competition_id?: string
          correct_answer?: string
          created_at?: string | null
          explanation?: string | null
          explanation_secondary?: string | null
          id?: string
          image_url?: string | null
          marks?: number | null
          option_a?: string
          option_a_secondary?: string | null
          option_b?: string
          option_b_secondary?: string | null
          option_c?: string
          option_c_secondary?: string | null
          option_d?: string
          option_d_secondary?: string | null
          question_number?: number
          question_text?: string
          question_text_secondary?: string | null
          secondary_language?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_answers: {
        Row: {
          competition_id: string
          created_at: string | null
          id: string
          is_correct: boolean | null
          is_marked_for_review: boolean | null
          question_id: string
          selected_answer: string | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          competition_id: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          is_marked_for_review?: boolean | null
          question_id: string
          selected_answer?: string | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          competition_id?: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          is_marked_for_review?: boolean | null
          question_id?: string
          selected_answer?: string | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_answers_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_answers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_competitions: {
        Row: {
          attempts_allowed: number | null
          attempts_used: number
          competition_id: string
          current_question: number | null
          has_started: boolean | null
          has_submitted: boolean | null
          id: string
          is_locked: boolean | null
          last_seen: string | null
          started_at: string | null
          student_id: string
          submitted_at: string | null
          total_marks: number | null
        }
        Insert: {
          attempts_allowed?: number | null
          attempts_used?: number
          competition_id: string
          current_question?: number | null
          has_started?: boolean | null
          has_submitted?: boolean | null
          id?: string
          is_locked?: boolean | null
          last_seen?: string | null
          started_at?: string | null
          student_id: string
          submitted_at?: string | null
          total_marks?: number | null
        }
        Update: {
          attempts_allowed?: number | null
          attempts_used?: number
          competition_id?: string
          current_question?: number | null
          has_started?: boolean | null
          has_submitted?: boolean | null
          id?: string
          is_locked?: boolean | null
          last_seen?: string | null
          started_at?: string | null
          student_id?: string
          submitted_at?: string | null
          total_marks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "student_competitions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_competitions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_signup_requests: {
        Row: {
          created_at: string
          exam: string
          id: string
          name: string
          note: string | null
          phone: string
          reviewed_at: string | null
          status: string
          student_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam: string
          id?: string
          name: string
          note?: string | null
          phone: string
          reviewed_at?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string
          reviewed_at?: string | null
          status?: string
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_signup_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          batch: string | null
          category: string
          created_at: string | null
          email: string | null
          exam: string | null
          id: string
          is_active: boolean
          name: string
          password: string
          phone: string
          student_number: number
          updated_at: string | null
          username: string
        }
        Insert: {
          address?: string | null
          batch?: string | null
          category?: string
          created_at?: string | null
          email?: string | null
          exam?: string | null
          id?: string
          is_active?: boolean
          name: string
          password: string
          phone: string
          student_number: number
          updated_at?: string | null
          username: string
        }
        Update: {
          address?: string | null
          batch?: string | null
          category?: string
          created_at?: string | null
          email?: string | null
          exam?: string | null
          id?: string
          is_active?: boolean
          name?: string
          password?: string
          phone?: string
          student_number?: number
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          id: string
          message: string
          status: string
          student_name: string
          student_number: string | null
          student_uuid: string | null
          test_id: string | null
          test_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          status?: string
          student_name: string
          student_number?: string | null
          student_uuid?: string | null
          test_id?: string | null
          test_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          status?: string
          student_name?: string
          student_number?: string | null
          student_uuid?: string | null
          test_id?: string | null
          test_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      competition_result_reports: {
        Row: {
          attempted_questions: number | null
          competition_id: string | null
          competition_name: string | null
          correct_answers: number | null
          correct_marks: number | null
          is_finalized: boolean | null
          is_topper: boolean | null
          last_activity_at: string | null
          max_marks: number | null
          negative_marks: number | null
          percentage: number | null
          rank: number | null
          started_at: string | null
          student_id: string | null
          student_name: string | null
          submitted_at: string | null
          total_marks: number | null
          updated_at: string | null
          wrong_answers: number | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_result_summaries_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_result_summaries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_student_marks: {
        Args: { p_competition_id: string; p_student_id: string }
        Returns: number
      }
      competition_window: {
        Args: { p_competition_id: string }
        Returns: {
          duration_minutes: number
          window_end: string
          window_start: string
        }[]
      }
      recompute_competition_rankings: {
        Args: { p_competition_id: string }
        Returns: undefined
      }
      refresh_competition_result_summary: {
        Args: { p_competition_id: string; p_student_id: string }
        Returns: undefined
      }
      server_now: { Args: never; Returns: string }
      start_new_attempt: {
        Args: { p_competition_id: string; p_student_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "student"],
    },
  },
} as const
