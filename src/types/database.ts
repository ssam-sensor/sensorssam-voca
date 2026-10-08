export type UserRole = 'tutor' | 'student';

export interface Profile {
  id: string;
  email: string;
  name?: string | null; // 별명 / 닉네임 (e.g. "센서쌤", "박튜터")
  role: UserRole;
  gemini_api_key?: string | null;
  created_at?: string;
}

export interface TutorStudentLink {
  tutor_id: string;
  student_id: string;
  created_at?: string;
  tutor?: Profile;
  student?: Profile;
}

export interface Wordbook {
  id: string;
  tutor_id?: string | null;
  tutor_name?: string | null; // e.g. "SensorSsam", "영어 학원 튜터"
  creator_role?: UserRole;
  is_student_created?: boolean;
  title: string;       // e.g. "WordMaster 고등 COMPLETE"
  chapter: string;     // e.g. "DAY 15"
  created_at?: string;
  words_count?: number;
}

export interface Word {
  id: string;
  wordbook_id: string;
  word: string;
  pronunciation?: string | null; // e.g. "æpl" (without brackets [])
  pos?: string | null;           // e.g. "명사; 동사"
  meaning: string;               // e.g. "사과; 사과나무"
  example_sentence?: string | null;
  example_translation?: string | null;
  is_idiom: boolean;
  is_spelling_priority: boolean; // Part 1 필수 암기 대상
}

export interface QuizResult {
  id: string;
  student_id: string;
  wordbook_id: string;
  total_score: number;
  max_score: number;
  created_at: string;
  wordbook_title?: string;
  wordbook_chapter?: string;
}

export interface IncorrectNote {
  id: string;
  student_id: string;
  word_id: string;
  wrong_count: number;
  last_wrong_answer?: string | null;
  is_resolved: boolean;
  updated_at: string;
  word?: Word;
}

export interface SettingsConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiApiKey: string;
  isCustomSupabaseConnected: boolean;
  isCustomGeminiConnected: boolean;
}

export interface VocaBatchItem {
  word: string;
  pronunciation?: string;
  pos?: string;
  meaning: string;
  example_sentence?: string;
  example_translation?: string;
  is_spelling_priority?: boolean;
  is_idiom?: boolean;
}
