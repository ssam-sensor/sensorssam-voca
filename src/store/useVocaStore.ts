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
  signInWithGoogle: () => Promise<void>;

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

// Helper to check if a string is a valid UUID
const isUuid = (id?: string | null): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// User-scoped LocalStorage Key Generators to prevent demo_user & google_user cross-contamination
const getWbKey = (tutorId?: string | null) => `vocat_local_wordbooks_${tutorId || 'demo'}`;
const getWordsKey = (tutorId?: string | null) => `vocat_local_words_${tutorId || 'demo'}`;

let authListenerSubscribed = false;

// Helper to seed sample data into connected Supabase DB when DB is empty
async function seedSampleDataToSupabase(client: any, userId?: string | null) {
  try {
    const validTutorId = isUuid(userId) ? userId : null;
    for (const wb of SAMPLE_WORDBOOKS) {
      const { data: insertedWb, error: wbErr } = await client
        .from('wordbooks')
        .insert({
          ...(validTutorId ? { tutor_id: validTutorId } : {}),
          title: wb.title,
          chapter: wb.chapter
        })
        .select()
        .single();

      if (!wbErr && insertedWb) {
        const sampleWords = SAMPLE_WORDS[wb.id] || [];
        const dbWords = sampleWords.map(w => ({
          wordbook_id: insertedWb.id,
          word: w.word,
          pronunciation: w.pronunciation || null,
          pos: w.pos || null,
          meaning: w.meaning,
          example_sentence: w.example_sentence || null,
          example_translation: w.example_translation || null,
          is_idiom: Boolean(w.is_idiom),
          is_spelling_priority: Boolean(w.is_spelling_priority)
        }));
        await client.from('words').insert(dbWords);
      }
    }
  } catch (err) {
    console.warn('Failed seeding sample data to Supabase:', err);
  }
}

export const useVocaStore = create<VocaState>((set, get) => ({
  userRole: 'student',
  userEmail: '',
  tutorId: '',
  studentId: '',
  linkedTutorIds: [],
  linkedStudentIds: [],
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
          const userId = userData.user.id;
          set({ tutorId: userId, studentId: userId, userEmail: userData.user.email || '' });
          await client.from('profiles').upsert({
            id: userId,
            email: userData.user.email || '',
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
      userEmail: '',
      tutorId: '',
      studentId: '',
      linkedTutorIds: [],
      linkedStudentIds: [],
      wordbooks: [],
      words: {},
      activeWordbookId: null
    });
  },

  signInWithGoogle: async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
          }
        });
      } catch (err) {
        console.error('Google OAuth sign-in error:', err);
      }
    }
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
    get().loadInitialData();
  },

  loadSettings: () => {
    if (typeof window === 'undefined') return;
    const localUrl = localStorage.getItem('vocat_supabase_url') || '';
    const localKey = localStorage.getItem('vocat_supabase_anon_key') || '';
    const localGemini = localStorage.getItem('vocat_gemini_api_key') || '';

    const supabaseUrl = localUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = localKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const geminiApiKey = localGemini || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

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
      if (!authListenerSubscribed) {
        authListenerSubscribed = true;
        client.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            const userId = session.user.id;
            set({
              userEmail: session.user.email || '',
              tutorId: userId,
              studentId: userId,
              isVerifiedWithInviteCode: true
            });
            if (typeof window !== 'undefined') {
              localStorage.setItem('vocat_invite_verified', 'true');
            }
            try {
              await client.from('profiles').upsert({
                id: userId,
                email: session.user.email || '',
                role: get().userRole,
                is_verified: true,
                created_at: new Date().toISOString()
              });
            } catch (e) {
              console.warn('Profile sync error:', e);
            }
          }
        });
      }

      try {
        const { data: authData } = await client.auth.getUser();
        let isNewProfileCreated = false;

        if (authData?.user) {
          const userId = authData.user.id;
          set({
            userEmail: authData.user.email || '',
            tutorId: userId,
            studentId: userId,
            isVerifiedWithInviteCode: true
          });

          const { data: profile } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (!profile) {
            isNewProfileCreated = true;
            await client.from('profiles').upsert({
              id: userId,
              email: authData.user.email || '',
              role: get().userRole,
              is_verified: true,
              created_at: new Date().toISOString()
            });
          } else {
            if (profile.role) set({ userRole: profile.role });
            if (profile.is_verified) {
              set({ isVerifiedWithInviteCode: true });
              if (typeof window !== 'undefined') localStorage.setItem('vocat_invite_verified', 'true');
            }
          }

          // Query wordbooks ONLY for this authenticated user!
          const { data: wbData, error: wbErr } = await client
            .from('wordbooks')
            .select('*')
            .eq('tutor_id', userId)
            .order('created_at', { ascending: false });

          if (!wbErr && wbData) {
            let activeWbs: Wordbook[] = wbData || [];

            // NO AUTOMATIC SAMPLE DATA SEEDING! If activeWbs is empty, keep it empty.

            const wordsMap: Record<string, Word[]> = {};
            for (const wb of activeWbs) {
              const { data: wData } = await client.from('words').select('*').eq('wordbook_id', wb.id);
              wordsMap[wb.id] = wData || [];
            }

            const { data: qrData } = await client.from('quiz_results').select('*').order('created_at', { ascending: false });
            const { data: incData } = await client.from('incorrect_notes').select('*, word:words(*)');

            set({
              wordbooks: activeWbs,
              words: wordsMap,
              quizResults: qrData || [],
              incorrectNotes: incData || [],
              activeWordbookId: activeWbs[0]?.id || null,
              isLoading: false
            });

            const wbKey = getWbKey(userId);
            const wordsKey = getWordsKey(userId);
            if (typeof window !== 'undefined') {
              localStorage.setItem(wbKey, JSON.stringify(activeWbs));
              localStorage.setItem(wordsKey, JSON.stringify(wordsMap));
            }
            return;
          }
        }
      } catch (err) {
        console.warn('Supabase auth check error:', err);
      }
    }

    // Unauthenticated or unverified visitors: NO DEMO WORD DATA!
    set({
      wordbooks: [],
      words: {},
      activeWordbookId: null,
      isLoading: false
    });
  },

  addWordbookWithWords: async (title, chapter, batchWords) => {
    const client = getSupabaseClient();
    const currentTutorId = get().tutorId;
    const dbTutorId = isUuid(currentTutorId) ? currentTutorId : null;

    if (client) {
      try {
        const { data: insertedWb, error: wbErr } = await client
          .from('wordbooks')
          .insert({
            ...(dbTutorId ? { tutor_id: dbTutorId } : {}),
            title,
            chapter
          })
          .select()
          .single();

        if (wbErr) {
          console.error('Supabase wordbook insert error:', wbErr);
        }

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

          const { data: insertedWords, error: wordsErr } = await client
            .from('words')
            .insert(dbWords)
            .select();

          if (wordsErr) {
            console.error('Supabase words insert error:', wordsErr);
          }

          const newWbObj: Wordbook = {
            ...insertedWb,
            tutor_name: 'SensorSsam (대표 튜터)',
            words_count: (insertedWords || []).length
          };

          const updatedWbs = [newWbObj, ...get().wordbooks];
          const updatedWords = { ...get().words, [insertedWb.id]: insertedWords || [] };

          set({ wordbooks: updatedWbs, words: updatedWords, activeWordbookId: insertedWb.id });

          if (typeof window !== 'undefined') {
            const currentTId = get().tutorId;
            localStorage.setItem(getWbKey(currentTId), JSON.stringify(updatedWbs));
            localStorage.setItem(getWordsKey(currentTId), JSON.stringify(updatedWords));
          }

          return newWbObj;
        }
      } catch (err) {
        console.warn('Failed inserting to Supabase, falling back to local state:', err);
      }
    }

    // Local Fallback
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

    const updatedWbs = [newWb, ...get().wordbooks];
    const updatedWords = { ...get().words, [newWbId]: newWords };
    set({ wordbooks: updatedWbs, words: updatedWords, activeWordbookId: newWbId });

    if (typeof window !== 'undefined') {
      const currentTId = get().tutorId;
      localStorage.setItem(getWbKey(currentTId), JSON.stringify(updatedWbs));
      localStorage.setItem(getWordsKey(currentTId), JSON.stringify(updatedWords));
    }

    return newWb;
  },

  deleteWordbook: async (wordbookId) => {
    const client = getSupabaseClient();
    const targetWb = get().wordbooks.find(wb => wb.id === wordbookId);
    const currentTutorId = get().tutorId;

    if (client) {
      try {
        if (isUuid(wordbookId)) {
          // Delete associated words FIRST to avoid foreign key constraint failure
          await client.from('words').delete().eq('wordbook_id', wordbookId);
          const { error } = await client.from('wordbooks').delete().eq('id', wordbookId);
          if (error) console.error('Supabase delete wordbook error:', error);
        } else if (targetWb) {
          // If wordbook has non-UUID ID (e.g. sample data 'wb-wm-day15'), find matching Supabase rows and delete words & wordbook
          let wbQuery = client.from('wordbooks').select('id').eq('title', targetWb.title).eq('chapter', targetWb.chapter);
          if (isUuid(currentTutorId)) {
            wbQuery = wbQuery.eq('tutor_id', currentTutorId);
          }
          const { data: matchingWbs } = await wbQuery;
          if (matchingWbs && matchingWbs.length > 0) {
            for (const m of matchingWbs) {
              await client.from('words').delete().eq('wordbook_id', m.id);
              await client.from('wordbooks').delete().eq('id', m.id);
            }
          }
        }
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
      localStorage.setItem(getWbKey(currentTutorId), JSON.stringify(updatedWbs));
      localStorage.setItem(getWordsKey(currentTutorId), JSON.stringify(updatedWords));
    }
  },

  addWord: async (wordbookId, wordData) => {
    const newWord: Word = {
      id: `w-${Date.now()}`,
      wordbook_id: wordbookId,
      ...wordData
    };

    const client = getSupabaseClient();
    if (client && isUuid(wordbookId)) {
      try {
        const { data, error } = await client.from('words').insert({
          wordbook_id: wordbookId,
          ...wordData
        }).select().single();
        if (error) console.error('Supabase add word error:', error);
        if (!error && data) {
          const currentList = get().words[wordbookId] || [];
          const updatedMap = { ...get().words, [wordbookId]: [...currentList, data] };
          set({ words: updatedMap });
          if (typeof window !== 'undefined') {
            localStorage.setItem(getWordsKey(get().tutorId), JSON.stringify(updatedMap));
          }
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
      localStorage.setItem(getWordsKey(get().tutorId), JSON.stringify(updatedMap));
    }
    return newWord;
  },

  deleteWord: async (wordId, wordbookId) => {
    const client = getSupabaseClient();
    if (client && isUuid(wordId)) {
      try {
        const { error } = await client.from('words').delete().eq('id', wordId);
        if (error) console.error('Supabase delete word error:', error);
      } catch (err) {
        console.warn('Error deleting word:', err);
      }
    }

    const currentList = get().words[wordbookId] || [];
    const updatedList = currentList.filter(w => w.id !== wordId);
    const updatedMap = { ...get().words, [wordbookId]: updatedList };
    set({ words: updatedMap });

    if (typeof window !== 'undefined') {
      localStorage.setItem(getWordsKey(get().tutorId), JSON.stringify(updatedMap));
    }
  },

  updateWord: async (word) => {
    const client = getSupabaseClient();
    if (client && isUuid(word.id)) {
      try {
        const { error } = await client.from('words').update({
          word: word.word,
          pronunciation: word.pronunciation,
          pos: word.pos,
          meaning: word.meaning,
          example_sentence: word.example_sentence,
          example_translation: word.example_translation,
          is_idiom: word.is_idiom,
          is_spelling_priority: word.is_spelling_priority
        }).eq('id', word.id);
        if (error) console.error('Supabase update word error:', error);
      } catch (err) {
        console.warn('Error updating word:', err);
      }
    }

    const currentList = get().words[word.wordbook_id] || [];
    const updatedList = currentList.map(w => w.id === word.id ? word : w);
    const updatedMap = { ...get().words, [word.wordbook_id]: updatedList };
    set({ words: updatedMap });

    if (typeof window !== 'undefined') {
      localStorage.setItem(getWordsKey(get().tutorId), JSON.stringify(updatedMap));
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
    const dbStudentId = isUuid(get().studentId) ? get().studentId : null;
    const dbWordbookId = isUuid(wordbookId) ? wordbookId : null;

    if (client && dbWordbookId) {
      try {
        const { error: qrErr } = await client.from('quiz_results').insert({
          ...(dbStudentId ? { student_id: dbStudentId } : {}),
          wordbook_id: dbWordbookId,
          total_score: totalScore,
          max_score: maxScore
        });

        if (qrErr) console.error('Supabase recordQuizResult error:', qrErr);

        for (const item of wrongWordIds) {
          if (!isUuid(item.wordId)) continue;
          const existing = get().incorrectNotes.find(n => n.word_id === item.wordId);
          if (existing && isUuid(existing.id)) {
            await client.from('incorrect_notes').update({
              wrong_count: existing.wrong_count,
              last_wrong_answer: item.wrongAnswer,
              is_resolved: false,
              updated_at: new Date().toISOString()
            }).eq('id', existing.id);
          } else {
            await client.from('incorrect_notes').insert({
              ...(dbStudentId ? { student_id: dbStudentId } : {}),
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
    if (client && isUuid(noteId)) {
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

  resetToSampleData: async () => {
    const currentTId = get().tutorId;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(getWbKey(currentTId));
      localStorage.removeItem(getWordsKey(currentTId));
      localStorage.removeItem('vocat_local_quiz_results');
      localStorage.removeItem('vocat_local_incorrect');
    }

    const client = getSupabaseClient();
    const isUserAuth = isUuid(currentTId);

    if (client) {
      await seedSampleDataToSupabase(client, isUserAuth ? currentTId : null);
    }

    await get().loadInitialData();
  }
}));
