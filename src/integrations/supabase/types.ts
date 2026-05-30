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
      auth_events: {
        Row: {
          created_at: string
          event: string
          id: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: number
          user_id?: string | null
        }
        Relationships: []
      }
      banner_slides: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      blogs: {
        Row: {
          body: string
          created_at: string
          excerpt: string | null
          hero_emoji: string | null
          hero_image_url: string | null
          id: string
          slug: string
          source: string | null
          title: string
          topic: string
          view_count: number
        }
        Insert: {
          body: string
          created_at?: string
          excerpt?: string | null
          hero_emoji?: string | null
          hero_image_url?: string | null
          id?: string
          slug: string
          source?: string | null
          title: string
          topic: string
          view_count?: number
        }
        Update: {
          body?: string
          created_at?: string
          excerpt?: string | null
          hero_emoji?: string | null
          hero_image_url?: string | null
          id?: string
          slug?: string
          source?: string | null
          title?: string
          topic?: string
          view_count?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          scope: string
          scope_ref: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          scope?: string
          scope_ref?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          scope?: string
          scope_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_redemptions: {
        Row: {
          coupon_id: string
          id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number | null
          type: string
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          type?: string
          used_count?: number
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          type?: string
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      courses: {
        Row: {
          code: string
          created_at: string
          department_id: string
          id: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id: string
          id?: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          metadata: Json | null
          reason: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reason: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          faculty_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          faculty_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          faculty_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_thread_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          thread_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "dm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_thread_reads: {
        Row: {
          last_read_at: string
          thread_id: string
          user_id: string
        }
        Insert: {
          last_read_at?: string
          thread_id: string
          user_id: string
        }
        Update: {
          last_read_at?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: []
      }
      dm_threads: {
        Row: {
          created_at: string
          id: string
          is_group: boolean
          last_message_at: string
          name: string | null
          owner_id: string | null
          photo_url: string | null
          user_a: string | null
          user_b: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          owner_id?: string | null
          photo_url?: string | null
          user_a?: string | null
          user_b?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          owner_id?: string | null
          photo_url?: string | null
          user_a?: string | null
          user_b?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_threads_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_threads_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faculties: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      library_book_purchases: {
        Row: {
          book_id: string
          created_at: string
          id: string
          price_paid: number
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          price_paid: number
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          price_paid?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_book_purchases_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          category: string
          cover_url: string | null
          created_at: string
          description: string | null
          first_publish_year: number | null
          id: string
          is_featured: boolean
          openlibrary_key: string
          price_credits: number
          read_url: string | null
          source_url: string | null
          title: string
        }
        Insert: {
          author?: string | null
          category: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          first_publish_year?: number | null
          id?: string
          is_featured?: boolean
          openlibrary_key: string
          price_credits?: number
          read_url?: string | null
          source_url?: string | null
          title: string
        }
        Update: {
          author?: string | null
          category?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          first_publish_year?: number | null
          id?: string
          is_featured?: boolean
          openlibrary_key?: string
          price_credits?: number
          read_url?: string | null
          source_url?: string | null
          title?: string
        }
        Relationships: []
      }
      library_course_progress: {
        Row: {
          course_id: string
          id: string
          last_opened_at: string
          progress_pct: number
          user_id: string
        }
        Insert: {
          course_id: string
          id?: string
          last_opened_at?: string
          progress_pct?: number
          user_id: string
        }
        Update: {
          course_id?: string
          id?: string
          last_opened_at?: string
          progress_pct?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_course_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "library_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      library_courses: {
        Row: {
          author: string | null
          can_embed: boolean
          cover_url: string | null
          created_at: string
          description: string | null
          download_url: string | null
          external_id: string
          id: string
          is_course: boolean
          level: string | null
          read_url: string
          source: string
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          can_embed?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          download_url?: string | null
          external_id: string
          id?: string
          is_course?: boolean
          level?: string | null
          read_url: string
          source: string
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          can_embed?: boolean
          cover_url?: string | null
          created_at?: string
          description?: string | null
          download_url?: string | null
          external_id?: string
          id?: string
          is_course?: boolean
          level?: string | null
          read_url?: string
          source?: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          category: string
          contact: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_ai_generated: boolean
          is_sold: boolean
          listing_kind: string
          location: string | null
          photos: string[]
          price: number
          seller_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          contact: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          is_sold?: boolean
          listing_kind?: string
          location?: string | null
          photos?: string[]
          price?: number
          seller_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          contact?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_ai_generated?: boolean
          is_sold?: boolean
          listing_kind?: string
          location?: string | null
          photos?: string[]
          price?: number
          seller_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_views: {
        Row: {
          created_at: string
          id: string
          note_id: string
          viewer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          viewer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          viewer_id?: string
        }
        Relationships: []
      }
      ocr_corrections: {
        Row: {
          corrected_text: string
          created_at: string
          id: string
          image_hash: string | null
          note: string | null
          original_text: string
          user_id: string | null
        }
        Insert: {
          corrected_text: string
          created_at?: string
          id?: string
          image_hash?: string | null
          note?: string | null
          original_text: string
          user_id?: string | null
        }
        Update: {
          corrected_text?: string
          created_at?: string
          id?: string
          image_hash?: string | null
          note?: string | null
          original_text?: string
          user_id?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: number
          path: string
          referrer: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          path: string
          referrer?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          path?: string
          referrer?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      post_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          like_count: number
          parent_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          like_count?: number
          parent_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          like_count?: number
          parent_id?: string | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reposts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reposts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string | null
          comment_count: number
          course_id: string | null
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          image_url: string | null
          like_count: number
          link_url: string | null
          media_type: string | null
          media_url: string | null
          post_type: Database["public"]["Enums"]["post_type"]
          repost_count: number
          title: string
          view_count: number
        }
        Insert: {
          author_id: string
          body?: string | null
          comment_count?: number
          course_id?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          like_count?: number
          link_url?: string | null
          media_type?: string | null
          media_url?: string | null
          post_type?: Database["public"]["Enums"]["post_type"]
          repost_count?: number
          title: string
          view_count?: number
        }
        Update: {
          author_id?: string
          body?: string | null
          comment_count?: number
          course_id?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          like_count?: number
          link_url?: string | null
          media_type?: string | null
          media_url?: string | null
          post_type?: Database["public"]["Enums"]["post_type"]
          repost_count?: number
          title?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_level: string | null
          approved_post_count: number
          avatar_key: string
          bio: string | null
          cover_url: string | null
          created_at: string
          credits: number
          department_id: string | null
          display_name: string
          email: string | null
          id: string
          is_verified: boolean
          last_seen_at: string
          rank_step: number
          rank_tier: Database["public"]["Enums"]["rank_tier"]
          referral_code: string | null
          seen_welcome: boolean
          show_online: boolean
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          academic_level?: string | null
          approved_post_count?: number
          avatar_key?: string
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          credits?: number
          department_id?: string | null
          display_name: string
          email?: string | null
          id: string
          is_verified?: boolean
          last_seen_at?: string
          rank_step?: number
          rank_tier?: Database["public"]["Enums"]["rank_tier"]
          referral_code?: string | null
          seen_welcome?: boolean
          show_online?: boolean
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          academic_level?: string | null
          approved_post_count?: number
          avatar_key?: string
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          credits?: number
          department_id?: string | null
          display_name?: string
          email?: string | null
          id?: string
          is_verified?: boolean
          last_seen_at?: string
          rank_step?: number
          rank_tier?: Database["public"]["Enums"]["rank_tier"]
          referral_code?: string | null
          seen_welcome?: boolean
          show_online?: boolean
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          quiz_id: string
          score: number
          total: number
          user_id: string
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          quiz_id: string
          score: number
          total: number
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          quiz_id?: string
          score?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_index: number
          explanation: string | null
          id: string
          options: Json
          position: number
          prompt: string
          quiz_id: string
        }
        Insert: {
          correct_index: number
          explanation?: string | null
          id?: string
          options: Json
          position?: number
          prompt: string
          quiz_id: string
        }
        Update: {
          correct_index?: number
          explanation?: string | null
          id?: string
          options?: Json
          position?: number
          prompt?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          course_id: string | null
          created_at: string
          created_by: string | null
          id: string
          post_id: string | null
          title: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          post_id?: string | null
          title: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          post_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          code: string
          created_at: string
          credited: boolean
          id: string
          invitee_id: string
          inviter_id: string
        }
        Insert: {
          code: string
          created_at?: string
          credited?: boolean
          id?: string
          invitee_id: string
          inviter_id: string
        }
        Update: {
          code?: string
          created_at?: string
          credited?: boolean
          id?: string
          invitee_id?: string
          inviter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          subtitle: string | null
          thumb_url: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          subtitle?: string | null
          thumb_url?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          subtitle?: string | null
          thumb_url?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      student_verifications: {
        Row: {
          created_at: string
          id: string
          jamb_reg_number: string
          response: Json | null
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          jamb_reg_number: string
          response?: Json | null
          user_id: string
          verified: boolean
        }
        Update: {
          created_at?: string
          id?: string
          jamb_reg_number?: string
          response?: Json | null
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      study_notes: {
        Row: {
          body: string
          course_id: string | null
          created_at: string
          department_id: string | null
          id: string
          page_count: number | null
          source_file_url: string | null
          title: string
          updated_at: string
          uploader_id: string
        }
        Insert: {
          body: string
          course_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          page_count?: number | null
          source_file_url?: string | null
          title: string
          updated_at?: string
          uploader_id: string
        }
        Update: {
          body?: string
          course_id?: string | null
          created_at?: string
          department_id?: string | null
          id?: string
          page_count?: number | null
          source_file_url?: string | null
          title?: string
          updated_at?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_notes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_notes_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_purchases: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          price_paid: number
          qr_token: string
          ticket_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          price_paid: number
          qr_token: string
          ticket_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          price_paid?: number
          qr_token?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_purchases_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_purchases_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          buyer_id: string | null
          contact: string | null
          created_at: string
          description: string | null
          id: string
          is_sold: boolean
          pay_mode: string
          photo_url: string
          price: number
          qr_token: string | null
          sold_at: string | null
          title: string
          uploader_id: string
        }
        Insert: {
          buyer_id?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_sold?: boolean
          pay_mode?: string
          photo_url: string
          price?: number
          qr_token?: string | null
          sold_at?: string | null
          title: string
          uploader_id: string
        }
        Update: {
          buyer_id?: string | null
          contact?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_sold?: boolean
          pay_mode?: string
          photo_url?: string
          price?: number
          qr_token?: string | null
          sold_at?: string | null
          title?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_failure_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          tool_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          tool_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          tool_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_rank: {
        Args: {
          _step: number
          _tier: Database["public"]["Enums"]["rank_tier"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_user_status: {
        Args: {
          _status: Database["public"]["Enums"]["user_status"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_set_verified: {
        Args: { _user_id: string; _verified: boolean }
        Returns: undefined
      }
      buy_ticket: { Args: { _ticket_id: string }; Returns: Json }
      claim_admin_coupon: { Args: { _coupon: string }; Returns: Json }
      earn_credits: {
        Args: {
          _amount: number
          _metadata?: Json
          _reason: string
          _user_id: string
        }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_thread_member: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      is_thread_owner: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      purchase_library_book: { Args: { _book_id: string }; Returns: Json }
      redeem_coupon: { Args: { _code: string }; Returns: Json }
      redeem_referral: { Args: { _code: string }; Returns: Json }
      spend_credits: {
        Args: { _amount: number; _metadata?: Json; _reason: string }
        Returns: number
      }
      verify_ticket: { Args: { _qr_token: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
      post_type:
        | "past_question"
        | "assignment"
        | "note"
        | "novel"
        | "news"
        | "request"
        | "general"
      rank_tier: "normal" | "active" | "legend" | "pro" | "sure_plug"
      user_status: "active" | "blocked" | "deactivated"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
      post_type: [
        "past_question",
        "assignment",
        "note",
        "novel",
        "news",
        "request",
        "general",
      ],
      rank_tier: ["normal", "active", "legend", "pro", "sure_plug"],
      user_status: ["active", "blocked", "deactivated"],
    },
  },
} as const
