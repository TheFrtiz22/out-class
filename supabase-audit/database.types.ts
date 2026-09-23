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
      Application: {
        Row: {
          clubId: string
          id: string
          roundId: string
          status: Database["public"]["Enums"]["AppStatus"]
          studentId: string
          submittedAt: string | null
        }
        Insert: {
          clubId: string
          id: string
          roundId: string
          status?: Database["public"]["Enums"]["AppStatus"]
          studentId: string
          submittedAt?: string | null
        }
        Update: {
          clubId?: string
          id?: string
          roundId?: string
          status?: Database["public"]["Enums"]["AppStatus"]
          studentId?: string
          submittedAt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Application_clubId_fkey"
            columns: ["clubId"]
            isOneToOne: false
            referencedRelation: "Club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Application_roundId_fkey"
            columns: ["roundId"]
            isOneToOne: false
            referencedRelation: "PipelineRound"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Application_studentId_fkey"
            columns: ["studentId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      ApplicationAnswer: {
        Row: {
          applicationId: string
          id: string
          questionId: string
          response: string
        }
        Insert: {
          applicationId: string
          id: string
          questionId: string
          response: string
        }
        Update: {
          applicationId?: string
          id?: string
          questionId?: string
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "ApplicationAnswer_applicationId_fkey"
            columns: ["applicationId"]
            isOneToOne: false
            referencedRelation: "Application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ApplicationAnswer_questionId_fkey"
            columns: ["questionId"]
            isOneToOne: false
            referencedRelation: "ApplicationQuestion"
            referencedColumns: ["id"]
          },
        ]
      }
      ApplicationQuestion: {
        Row: {
          clubId: string
          id: string
          prompt: string
          required: boolean
          type: Database["public"]["Enums"]["QuestionType"]
          wordLimit: number | null
        }
        Insert: {
          clubId: string
          id: string
          prompt: string
          required?: boolean
          type: Database["public"]["Enums"]["QuestionType"]
          wordLimit?: number | null
        }
        Update: {
          clubId?: string
          id?: string
          prompt?: string
          required?: boolean
          type?: Database["public"]["Enums"]["QuestionType"]
          wordLimit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ApplicationQuestion_clubId_fkey"
            columns: ["clubId"]
            isOneToOne: false
            referencedRelation: "Club"
            referencedColumns: ["id"]
          },
        ]
      }
      Club: {
        Row: {
          acceptanceRate: number | null
          aumValue: number | null
          bannerUrl: string | null
          category: string
          color: string
          description: string
          id: string
          logoUrl: string | null
          name: string
          slug: string
          tagline: string
        }
        Insert: {
          acceptanceRate?: number | null
          aumValue?: number | null
          bannerUrl?: string | null
          category: string
          color: string
          description: string
          id: string
          logoUrl?: string | null
          name: string
          slug: string
          tagline: string
        }
        Update: {
          acceptanceRate?: number | null
          aumValue?: number | null
          bannerUrl?: string | null
          category?: string
          color?: string
          description?: string
          id?: string
          logoUrl?: string | null
          name?: string
          slug?: string
          tagline?: string
        }
        Relationships: []
      }
      ClubMember: {
        Row: {
          clubId: string
          id: string
          role: Database["public"]["Enums"]["ClubRole"]
          title: string | null
          userId: string
        }
        Insert: {
          clubId: string
          id: string
          role?: Database["public"]["Enums"]["ClubRole"]
          title?: string | null
          userId: string
        }
        Update: {
          clubId?: string
          id?: string
          role?: Database["public"]["Enums"]["ClubRole"]
          title?: string | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "ClubMember_clubId_fkey"
            columns: ["clubId"]
            isOneToOne: false
            referencedRelation: "Club"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ClubMember_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Evaluation: {
        Row: {
          applicationId: string
          createdAt: string
          id: string
          interviewerId: string
          notes: string | null
          round: string
          score: number
        }
        Insert: {
          applicationId: string
          createdAt?: string
          id: string
          interviewerId: string
          notes?: string | null
          round: string
          score: number
        }
        Update: {
          applicationId?: string
          createdAt?: string
          id?: string
          interviewerId?: string
          notes?: string | null
          round?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "Evaluation_applicationId_fkey"
            columns: ["applicationId"]
            isOneToOne: false
            referencedRelation: "Application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Evaluation_interviewerId_fkey"
            columns: ["interviewerId"]
            isOneToOne: false
            referencedRelation: "ClubMember"
            referencedColumns: ["id"]
          },
        ]
      }
      Event: {
        Row: {
          clubId: string
          date: string
          description: string | null
          id: string
          isPublic: boolean
          location: string
          title: string
        }
        Insert: {
          clubId: string
          date: string
          description?: string | null
          id: string
          isPublic?: boolean
          location: string
          title: string
        }
        Update: {
          clubId?: string
          date?: string
          description?: string | null
          id?: string
          isPublic?: boolean
          location?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "Event_clubId_fkey"
            columns: ["clubId"]
            isOneToOne: false
            referencedRelation: "Club"
            referencedColumns: ["id"]
          },
        ]
      }
      EventAttendance: {
        Row: {
          checkedInAt: string
          eventId: string
          id: string
          studentId: string
        }
        Insert: {
          checkedInAt?: string
          eventId: string
          id: string
          studentId: string
        }
        Update: {
          checkedInAt?: string
          eventId?: string
          id?: string
          studentId?: string
        }
        Relationships: [
          {
            foreignKeyName: "EventAttendance_eventId_fkey"
            columns: ["eventId"]
            isOneToOne: false
            referencedRelation: "Event"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "EventAttendance_studentId_fkey"
            columns: ["studentId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      Experience: {
        Row: {
          id: string
          period: string
          studentProfileId: string
          subtitle: string
          title: string
        }
        Insert: {
          id: string
          period: string
          studentProfileId: string
          subtitle: string
          title: string
        }
        Update: {
          id?: string
          period?: string
          studentProfileId?: string
          subtitle?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "Experience_studentProfileId_fkey"
            columns: ["studentProfileId"]
            isOneToOne: false
            referencedRelation: "StudentProfile"
            referencedColumns: ["id"]
          },
        ]
      }
      InterviewBooking: {
        Row: {
          applicationId: string
          id: string
          slotId: string
        }
        Insert: {
          applicationId: string
          id: string
          slotId: string
        }
        Update: {
          applicationId?: string
          id?: string
          slotId?: string
        }
        Relationships: [
          {
            foreignKeyName: "InterviewBooking_applicationId_fkey"
            columns: ["applicationId"]
            isOneToOne: false
            referencedRelation: "Application"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "InterviewBooking_slotId_fkey"
            columns: ["slotId"]
            isOneToOne: false
            referencedRelation: "InterviewSlot"
            referencedColumns: ["id"]
          },
        ]
      }
      InterviewSlot: {
        Row: {
          capacity: number
          clubId: string
          endTime: string
          id: string
          location: string
          startTime: string
        }
        Insert: {
          capacity?: number
          clubId: string
          endTime: string
          id: string
          location: string
          startTime: string
        }
        Update: {
          capacity?: number
          clubId?: string
          endTime?: string
          id?: string
          location?: string
          startTime?: string
        }
        Relationships: []
      }
      PipelineRound: {
        Row: {
          clubId: string
          id: string
          name: string
          order: number
        }
        Insert: {
          clubId: string
          id: string
          name: string
          order: number
        }
        Update: {
          clubId?: string
          id?: string
          name?: string
          order?: number
        }
        Relationships: [
          {
            foreignKeyName: "PipelineRound_clubId_fkey"
            columns: ["clubId"]
            isOneToOne: false
            referencedRelation: "Club"
            referencedColumns: ["id"]
          },
        ]
      }
      StudentProfile: {
        Row: {
          bio: string | null
          computingId: string
          firstName: string
          gpa: number | null
          gradYear: number
          headshotUrl: string | null
          id: string
          lastName: string
          linkedinUrl: string | null
          major: string
          resumeUrl: string | null
          satScore: number | null
          userId: string
        }
        Insert: {
          bio?: string | null
          computingId: string
          firstName: string
          gpa?: number | null
          gradYear: number
          headshotUrl?: string | null
          id: string
          lastName: string
          linkedinUrl?: string | null
          major: string
          resumeUrl?: string | null
          satScore?: number | null
          userId: string
        }
        Update: {
          bio?: string | null
          computingId?: string
          firstName?: string
          gpa?: number | null
          gradYear?: number
          headshotUrl?: string | null
          id?: string
          lastName?: string
          linkedinUrl?: string | null
          major?: string
          resumeUrl?: string | null
          satScore?: number | null
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "StudentProfile_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "User"
            referencedColumns: ["id"]
          },
        ]
      }
      User: {
        Row: {
          createdAt: string
          email: string
          id: string
          passwordHash: string | null
          role: Database["public"]["Enums"]["AppRole"]
        }
        Insert: {
          createdAt?: string
          email: string
          id: string
          passwordHash?: string | null
          role?: Database["public"]["Enums"]["AppRole"]
        }
        Update: {
          createdAt?: string
          email?: string
          id?: string
          passwordHash?: string | null
          role?: Database["public"]["Enums"]["AppRole"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "STUDENT" | "CLUB_ADMIN"
      app_status:
        | "DRAFTING"
        | "SUBMITTED"
        | "IN_REVIEW"
        | "INTERVIEWING"
        | "ACCEPTED"
        | "REJECTED"
        | "WAITLISTED"
      AppRole: "STUDENT" | "CLUB_ADMIN"
      AppStatus:
        | "DRAFTING"
        | "SUBMITTED"
        | "IN_REVIEW"
        | "INTERVIEWING"
        | "ACCEPTED"
        | "REJECTED"
        | "WAITLISTED"
      club_role: "PRESIDENT" | "RECRUITMENT_LEAD" | "GENERAL_MEMBER"
      ClubRole: "PRESIDENT" | "RECRUITMENT_LEAD" | "GENERAL_MEMBER"
      question_type: "ESSAY" | "FILE_UPLOAD" | "MULTIPLE_CHOICE"
      QuestionType: "ESSAY" | "FILE_UPLOAD" | "MULTIPLE_CHOICE"
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
      app_role: ["STUDENT", "CLUB_ADMIN"],
      app_status: [
        "DRAFTING",
        "SUBMITTED",
        "IN_REVIEW",
        "INTERVIEWING",
        "ACCEPTED",
        "REJECTED",
        "WAITLISTED",
      ],
      AppRole: ["STUDENT", "CLUB_ADMIN"],
      AppStatus: [
        "DRAFTING",
        "SUBMITTED",
        "IN_REVIEW",
        "INTERVIEWING",
        "ACCEPTED",
        "REJECTED",
        "WAITLISTED",
      ],
      club_role: ["PRESIDENT", "RECRUITMENT_LEAD", "GENERAL_MEMBER"],
      ClubRole: ["PRESIDENT", "RECRUITMENT_LEAD", "GENERAL_MEMBER"],
      question_type: ["ESSAY", "FILE_UPLOAD", "MULTIPLE_CHOICE"],
      QuestionType: ["ESSAY", "FILE_UPLOAD", "MULTIPLE_CHOICE"],
    },
  },
} as const
