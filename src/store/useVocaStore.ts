import { create } from 'zustand';
import { Wordbook, Word, QuizResult, IncorrectNote, UserRole, SettingsConfig, VocaBatchItem } from '@/types/database';
import { SAMPLE_WORDBOOKS, SAMPLE_WORDS } from '@/lib/sample-data';
import { getSupabaseClient } from '@/lib/supabase';

interface VocaState {
  // Auth & Profile
  userRole: UserRole;
  userEmail: string;
  tutorId: string;
  studentId: string;
  linkedTutorIds: string[];
  linkedStudentIds: string[];
  isVerifiedWithInviteCode: boolean;
  setUserRole: (role: UserRole) => void;
  setUserEmail: (email: string) => void;
  verifyInviteCode: (code: string, role: UserRole) => Promise<{ success: boolean; error?: string }>;
  signOutUser: () => Promise<void>;

  // Settings
  settings: SettingsConfig;
  updateSettings: (newSettings: Partial<SettingsConfig>) => void;
  loadSettings: () => void;

  // Wordbooks & Words
  wordbooks: Wordbook[];
  words: Record<string, Word[]>; // wordbook_id -> Word[]
  activeWordbookId: string | null;
  setActiveWordbookId: (id: string | null) => void;

  // Data Loading & Syncing
  isLoading: boolean;
  loadInitialData: () => Promise<void>;
  addWordbookWithWords: (title: string, chapter: string, batchWords: VocaBatchItem[]) => Promise<Wordbook>;
  deleteWordbook: (wordbookId: string) => Promise<void>;
  addWord: (wordbookId: string, wordData: Omit<Word, 'id' | 'wordbook_id'>) => Promise<Word>;
  deleteWord: (wordId: string, wordbookId: string) => Promise<void>;
  updateWord: (word: Word) => Promise<void>;

  // Quiz & Incorrect Notes
  quizResults: QuizResult[];
  incorrectNotes: IncorrectNote[];
  recordQuizResult: (wordbookId: string, totalScore: number, maxScore: number, wrongWordIds: { wordId: string; wrongAnswer: string }[]) => Promise<void>;
  resolveIncorrectNote: (noteId: string) => Promise<void>;
  resetToSampleData: () => void;
}

export const useVocaStore = create<VocaState>((set, get) => ({
  userRole: 'student', // default student view, easily toggleable to 'tutor'
  userEmail: 'demo_user@sensorssam.com',
  tutorId: 'tutor-demo-1',
  studentId: 'student-demo-1',
  linkedTutorIds: ['tutor-demo-1', 'tutor-demo-2'],
  linkedStudentIds: ['student-demo-1', 'student-demo-2'],
  isVerifiedWithInviteCode: false,

  setUserRole: (role) => {
    set({ userRole: role });
    if (typeof window !== 'undefined') localStorage.setItem('vocat_user_role', role);
  },
  setUserEmail: (email) => set({ userEmail: email }),

  verifyInviteCode: async (code: string, role: UserRole) => {
    const expectedCode = (process.env.NEXT_PUBLIC_INVITE_CODE || 'SSAM2026').trim();
    const givenCode = (code || '').trim();

    if (!givenCode || givenCode.toUpperCase() !== expectedCode.toUpperCase()) {
      return {
        success: false,
        error: '올바른 초대 코드가 아닙니다. 센서쌤에게 가입 코드를 확인하세요.'
      };
    }

    // Persist verification status & chosen role
    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_invite_verified', 'true');
      localStorage.setItem('vocat_user_role', role);
    }

    // Upsert user profile to Supabase if client is active
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: userData } = await client.auth.getUser();
        if (userData?.user) {
          await client.from('profiles').upsert({
            id: userData.user.id,
            email: userData.user.email || 'demo_user@sensorssam.com',
            role,
            is_verified: true,
            created_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('Supabase profile upsert error:', err);
      }
    }

    set({ isVerifiedWithInviteCode: true, userRole: role });
    return { success: true };
  },

  signOutUser: async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vocat_invite_verified');
      localStorage.removeItem('vocat_user_role');
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Supabase signout error:', err);
      }
    }

    set({
      isVerifiedWithInviteCode: false,
      userRole: 'student',
      userEmail: 'guest@sensorssam.com'
    });
  },

  settings: {
    supabaseUrl: '',
    supabaseAnonKey: '',
    geminiApiKey: '',
    isCustomSupabaseConnected: false,
    isCustomGeminiConnected: false
  },

  updateSettings: (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    set({ settings: updated });
    if (typeof window !== 'undefined') {
      if (newSettings.supabaseUrl !== undefined) localStorage.setItem('vocat_supabase_url', newSettings.supabaseUrl);
      if (newSettings.supabaseAnonKey !== undefined) localStorage.setItem('vocat_supabase_anon_key', newSettings.supabaseAnonKey);
      if (newSettings.geminiApiKey !== undefined) localStorage.setItem('vocat_gemini_api_key', newSettings.geminiApiKey);
    }
    // Reload initial data with new settings
    get().loadInitialData();
  },

  loadSettings: () => {
    if (typeof window === 'undefined') return;
    const supabaseUrl = localStorage.getItem('vocat_supabase_url') || '';
    const supabaseAnonKey = localStorage.getItem('vocat_supabase_anon_key') || '';
    const geminiApiKey = localStorage.getItem('vocat_gemini_api_key') || '';

    set({
      settings: {
        supabaseUrl,
        supabaseAnonKey,
        geminiApiKey,
        isCustomSupabaseConnected: Boolean(supabaseUrl && supabaseAnonKey),
        isCustomGeminiConnected: Boolean(geminiApiKey)
      }
    });
  },

  wordbooks: [],
  words: {},
  activeWordbookId: null,
  setActiveWordbookId: (id) => set({ activeWordbookId: id }),

  isLoading: false,

  quizResults: [],
  incorrectNotes: [],

  loadInitialData: async () => {
    set({ isLoading: true });
    get().loadSettings();

    // Load verification state & saved user role
    if (typeof window !== 'undefined') {
      const isVerified = localStorage.getItem('vocat_invite_verified') === 'true';
      const storedRole = localStorage.getItem('vocat_user_role') as UserRole;
      set({
        isVerifiedWithInviteCode: isVerified,
        userRole: storedRole || get().userRole
      });
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        // Query N:M tutor_students table for linked tutors/students
        const { data: linkData } = await client.from('tutor_students').select('*');
        const linkedTutors = linkData
          ? linkData.filter(l => l.student_id === get().studentId).map(l => l.tutor_id)
          : [get().tutorId];

        // Fetch wordbooks created by ANY of the linked tutors (N:M mapping)
        const { data: wbData, error: wbErr } = await client
          .from('wordbooks')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!wbErr && wbData && wbData.length > 0) {
          const wordsMap: Record<string, Word[]> = {};
          
          for (const wb of wbData) {
            const { data: wData } = await client.from('words').select('*').eq('wordbook_id', wb.id);
            wordsMap[wb.id] = wData || [];
          }

          // Fetch quiz results & incorrect notes
          const { data: qrData } = await client.from('quiz_results').select('*').order('created_at', { ascending: false });
          const { data: incData } = await client.from('incorrect_notes').select('*, word:words(*)');

          set({
            wordbooks: wbData,
            words: wordsMap,
            quizResults: qrData || [],
            incorrectNotes: incData || [],
            activeWordbookId: wbData[0]?.id || null,
            linkedTutorIds: linkedTutors,
            isLoading: false
          });
          return;
        }
      } catch (err) {
        console.warn('Supabase fetch error, falling back to local state:', err);
      }
    }

    // Local Storage / Sample Data Fallback
    if (typeof window !== 'undefined') {
      const storedWb = localStorage.getItem('vocat_local_wordbooks');
      const storedWords = localStorage.getItem('vocat_local_words');
      const storedQuiz = localStorage.getItem('vocat_local_quiz_results');
      const storedInc = localStorage.getItem('vocat_local_incorrect');

      if (storedWb && storedWords) {
        const wbList: Wordbook[] = JSON.parse(storedWb);
        const wordsObj: Record<string, Word[]> = JSON.parse(storedWords);
        set({
          wordbooks: wbList,
          words: wordsObj,
          quizResults: storedQuiz ? JSON.parse(storedQuiz) : [],
          incorrectNotes: storedInc ? JSON.parse(storedInc) : [],
          activeWordbookId: wbList[0]?.id || null,
          isLoading: false
        });
        return;
      }
    }

    // Default sample data initialization (N:M tutors attached)
    set({
      wordbooks: SAMPLE_WORDBOOKS,
      words: SAMPLE_WORDS,
      activeWordbookId: SAMPLE_WORDBOOKS[0].id,
      quizResults: [
        {
          id: 'qr-sample-1',
          student_id: get().studentId,
          wordbook_id: 'wb-wm-day15',
          total_score: 8,
          max_score: 10,
          created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
          wordbook_title: 'WordMaster 고등 COMPLETE',
          wordbook_chapter: 'DAY 15'
        }
      ],
      incorrectNotes: [
        {
          id: 'inc-sample-1',
          student_id: get().studentId,
          word_id: 'w-15-4',
          wrong_count: 2,
          last_wrong_answer: '대충 조사하다',
          is_resolved: false,
          updated_at: new Date().toISOString(),
          word: SAMPLE_WORDS['wb-wm-day15'][3] // scrutinize
        },
        {
          id: 'inc-sample-2',
          student_id: get().studentId,
          word_id: 'w-15-7',
          wrong_count: 1,
          last_wrong_answer: '거친',
          is_resolved: false,
          updated_at: new Date().toISOString(),
          word: SAMPLE_WORDS['wb-wm-day15'][6] // resilient
        }
      ],
      isLoading: false
    });

    // Save initial sample data to local storage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_local_wordbooks', JSON.stringify(SAMPLE_WORDBOOKS));
      localStorage.setItem('vocat_local_words', JSON.stringify(SAMPLE_WORDS));
    }
  },

  addWordbookWithWords: async (title, chapter, batchWords) => {
    const newWbId = `wb-${Date.now()}`;
    const newWb: Wordbook = {
      id: newWbId,
      tutor_id: get().tutorId,
      tutor_name: 'SensorSsam (대표 튜터)',
      title,
      chapter,
      created_at: new Date().toISOString(),
      words_count: batchWords.length
    };

    const newWords: Word[] = batchWords.map((item, idx) => ({
      id: `w-${newWbId}-${idx}`,
      wordbook_id: newWbId,
      word: item.word,
      pronunciation: item.pronunciation || null,
      pos: item.pos || null,
      meaning: item.meaning,
      example_sentence: item.example_sentence || null,
      example_translation: item.example_translation || null,
      is_idiom: Boolean(item.is_idiom),
      is_spelling_priority: Boolean(item.is_spelling_priority)
    }));

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: insertedWb, error: wbErr } = await client
          .from('wordbooks')
          .insert({ tutor_id: get().tutorId, title, chapter })
          .select()
          .single();

        if (!wbErr && insertedWb) {
          const dbWords = batchWords.map(item => ({
            wordbook_id: insertedWb.id,
            word: item.word,
            pronunciation: item.pronunciation || null,
            pos: item.pos || null,
            meaning: item.meaning,
            example_sentence: item.example_sentence || null,
            example_translation: item.example_translation || null,
            is_idiom: Boolean(item.is_idiom),
            is_spelling_priority: Boolean(item.is_spelling_priority)
          }));

          const { data: insertedWords } = await client.from('words').insert(dbWords).select();

          const updatedWbs = [{ ...insertedWb, tutor_name: 'SensorSsam (대표 튜터)' }, ...get().wordbooks];
          const updatedWords = { ...get().words, [insertedWb.id]: insertedWords || [] };

          set({ wordbooks: updatedWbs, words: updatedWords, activeWordbookId: insertedWb.id });
          return insertedWb;
        }
      } catch (err) {
        console.warn('Failed inserting to Supabase, using local:', err);
      }
    }

    // Local Fallback
    const updatedWbs = [newWb, ...get().wordbooks];
    const updatedWords = { ...get().words, [newWbId]: newWords };
    set({ wordbooks: updatedWbs, words: updatedWords, activeWordbookId: newWbId });

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_local_wordbooks', JSON.stringify(updatedWbs));
      localStorage.setItem('vocat_local_words', JSON.stringify(updatedWords));
    }

    return newWb;
  },

  deleteWordbook: async (wordbookId) => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('wordbooks').delete().eq('id', wordbookId);
      } catch (err) {
        console.warn('Error deleting from Supabase:', err);
      }
    }

    const updatedWbs = get().wordbooks.filter(wb => wb.id !== wordbookId);
    const updatedWords = { ...get().words };
    delete updatedWords[wordbookId];

    const nextActive = updatedWbs.length > 0 ? updatedWbs[0].id : null;
    set({ wordbooks: updatedWbs, words: updatedWords, activeWordbookId: nextActive });

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_local_wordbooks', JSON.stringify(updatedWbs));
      localStorage.setItem('vocat_local_words', JSON.stringify(updatedWords));
    }
  },

  addWord: async (wordbookId, wordData) => {
    const newWord: Word = {
      id: `w-${Date.now()}`,
      wordbook_id: wordbookId,
      ...wordData
    };

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from('words').insert({
          wordbook_id: wordbookId,
          ...wordData
        }).select().single();
        if (!error && data) {
          const currentList = get().words[wordbookId] || [];
          const updatedMap = { ...get().words, [wordbookId]: [...currentList, data] };
          set({ words: updatedMap });
          return data;
        }
      } catch (err) {
        console.warn('Failed adding word to Supabase:', err);
      }
    }

    const currentList = get().words[wordbookId] || [];
    const updatedMap = { ...get().words, [wordbookId]: [...currentList, newWord] };
    set({ words: updatedMap });

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_local_words', JSON.stringify(updatedMap));
    }
    return newWord;
  },

  deleteWord: async (wordId, wordbookId) => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('words').delete().eq('id', wordId);
      } catch (err) {
        console.warn('Error deleting word:', err);
      }
    }

    const currentList = get().words[wordbookId] || [];
    const updatedList = currentList.filter(w => w.id !== wordId);
    const updatedMap = { ...get().words, [wordbookId]: updatedList };
    set({ words: updatedMap });

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_local_words', JSON.stringify(updatedMap));
    }
  },

  updateWord: async (word) => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('words').update(word).eq('id', word.id);
      } catch (err) {
        console.warn('Error updating word:', err);
      }
    }

    const currentList = get().words[word.wordbook_id] || [];
    const updatedList = currentList.map(w => w.id === word.id ? word : w);
    const updatedMap = { ...get().words, [word.wordbook_id]: updatedList };
    set({ words: updatedMap });

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_local_words', JSON.stringify(updatedMap));
    }
  },

  recordQuizResult: async (wordbookId, totalScore, maxScore, wrongWordIds) => {
    const wb = get().wordbooks.find(w => w.id === wordbookId);
    const newResult: QuizResult = {
      id: `qr-${Date.now()}`,
      student_id: get().studentId,
      wordbook_id: wordbookId,
      total_score: totalScore,
      max_score: maxScore,
      created_at: new Date().toISOString(),
      wordbook_title: wb?.title,
      wordbook_chapter: wb?.chapter
    };

    // Update quiz results
    const updatedResults = [newResult, ...get().quizResults];

    // Update / create incorrect notes
    const currentNotes = [...get().incorrectNotes];
    const allWords = Object.values(get().words).flat();

    for (const item of wrongWordIds) {
      const existingIdx = currentNotes.findIndex(n => n.word_id === item.wordId && n.student_id === get().studentId);
      const targetWord = allWords.find(w => w.id === item.wordId);

      if (existingIdx >= 0) {
        currentNotes[existingIdx] = {
          ...currentNotes[existingIdx],
          wrong_count: currentNotes[existingIdx].wrong_count + 1,
          last_wrong_answer: item.wrongAnswer,
          is_resolved: false,
          updated_at: new Date().toISOString()
        };
      } else {
        currentNotes.push({
          id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          student_id: get().studentId,
          word_id: item.wordId,
          wrong_count: 1,
          last_wrong_answer: item.wrongAnswer,
          is_resolved: false,
          updated_at: new Date().toISOString(),
          word: targetWord
        });
      }
    }

    set({ quizResults: updatedResults, incorrectNotes: currentNotes });

    const client = getSupabaseClient();
    if (client) {
      try {
        await client.from('quiz_results').insert({
          student_id: get().studentId,
          wordbook_id: wordbookId,
          total_score: totalScore,
          max_score: maxScore
        });

        for (const item of wrongWordIds) {
          const existing = get().incorrectNotes.find(n => n.word_id === item.wordId);
          if (existing && existing.id.length > 20) { // Database UUID
            await client.from('incorrect_notes').update({
              wrong_count: existing.wrong_count,
              last_wrong_answer: item.wrongAnswer,
              is_resolved: false,
              updated_at: new Date().toISOString()
            }).eq('id', existing.id);
          } else {
            await client.from('incorrect_notes').insert({
              student_id: get().studentId,
              word_id: item.wordId,
              wrong_count: 1,
              last_wrong_answer: item.wrongAnswer,
              is_resolved: false
            });
          }
        }
      } catch (err) {
        console.warn('Failed recording quiz result to Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_local_quiz_results', JSON.stringify(updatedResults));
      localStorage.setItem('vocat_local_incorrect', JSON.stringify(currentNotes));
    }
  },

  resolveIncorrectNote: async (noteId) => {
    const updatedNotes = get().incorrectNotes.map(n => n.id === noteId ? { ...n, is_resolved: true } : n);
    set({ incorrectNotes: updatedNotes });

    const client = getSupabaseClient();
    if (client && noteId.length > 20) {
      try {
        await client.from('incorrect_notes').update({ is_resolved: true }).eq('id', noteId);
      } catch (err) {
        console.warn('Error resolving note in Supabase:', err);
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_local_incorrect', JSON.stringify(updatedNotes));
    }
  },

  resetToSampleData: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vocat_local_wordbooks');
      localStorage.removeItem('vocat_local_words');
      localStorage.removeItem('vocat_local_quiz_results');
      localStorage.removeItem('vocat_local_incorrect');
    }
    get().loadInitialData();
  }
}));
