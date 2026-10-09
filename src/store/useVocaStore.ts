import { create } from 'zustand';
import { Wordbook, Word, QuizResult, IncorrectNote, UserRole, SettingsConfig, VocaBatchItem, StudyLog } from '@/types/database';
import { SAMPLE_WORDBOOKS, SAMPLE_WORDS } from '@/lib/sample-data';
import { getSupabaseClient } from '@/lib/supabase';
import { maskEmail, maskName } from '@/utils/masking';

interface VocaState {
  // Auth & Profile
  accountRole: UserRole; // Official registered profile role (tutor or student)
  userRole: UserRole;    // Active view mode
  userEmail: string;
  userName: string;      // User nickname (별명)
  tutorId: string;
  studentId: string;
  linkedTutorIds: string[];
  linkedStudentIds: string[];
  availableTutors: { id: string; name: string; title: string; avatarBg: string }[];
  availableStudents: { id: string; name: string; email: string }[];
  toggleLinkedTutorId: (tutorId: string) => void;
  isVerifiedWithInviteCode: boolean;
  setUserRole: (role: UserRole) => void;
  setUserEmail: (email: string) => void;
  setUserName: (name: string) => void;
  updateProfileName: (name: string) => Promise<void>;
  verifyInviteCode: (code: string, role: UserRole, name?: string) => Promise<{ success: boolean; error?: string }>;
  signOutUser: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;

  // Settings
  settings: SettingsConfig;
  updateSettings: (newSettings: Partial<SettingsConfig>) => void;
  loadSettings: () => void;

  // Wordbooks & Words
  allWordbooks: Wordbook[];
  wordbooks: Wordbook[];
  words: Record<string, Word[]>; // wordbook_id -> Word[]
  activeWordbookId: string | null;
  setActiveWordbookId: (id: string | null) => void;
  filterWordbooksForStudent: (selectedTutorIds?: string[]) => void;

  // Data Loading & Syncing
  isLoading: boolean;
  loadInitialData: () => Promise<void>;
  addWordbookWithWords: (title: string, chapter: string, batchWords: VocaBatchItem[]) => Promise<Wordbook>;
  deleteWordbook: (wordbookId: string) => Promise<void>;
  addWord: (wordbookId: string, wordData: Omit<Word, 'id' | 'wordbook_id'>) => Promise<Word>;
  deleteWord: (wordId: string, wordbookId: string) => Promise<void>;
  updateWord: (word: Word) => Promise<void>;

  // Quiz & Incorrect Notes & Study Logs
  quizResults: QuizResult[];
  incorrectNotes: IncorrectNote[];
  studyLogs: StudyLog[];
  isStudentReportOpen: boolean;
  openStudentReport: () => void;
  closeStudentReport: () => void;
  recordQuizResult: (wordbookId: string, totalScore: number, maxScore: number, wrongWordIds: { wordId: string; wrongAnswer: string }[]) => Promise<void>;
  resolveIncorrectNote: (noteId: string) => Promise<void>;
  addStudyTime: (seconds: number) => Promise<void>;
  resetToSampleData: () => void;
}

// Helper to check if a string is a valid UUID
const isUuid = (id?: string | null): boolean => {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// Helper to get or generate a valid user UUID
const getOrCreateUserId = (): string => {
  if (typeof window !== 'undefined') {
    let saved = localStorage.getItem('vocat_user_id');
    if (saved && isUuid(saved)) return saved;
    const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : '10000000-1000-4000-8000-100000000000';
    localStorage.setItem('vocat_user_id', newId);
    return newId;
  }
  return '10000000-1000-4000-8000-100000000000';
};

// User-scoped LocalStorage Key Generators to prevent demo_user & google_user cross-contamination
const getWbKey = (tutorId?: string | null) => `vocat_local_wordbooks_${tutorId || 'demo'}`;
const getWordsKey = (tutorId?: string | null) => `vocat_local_words_${tutorId || 'demo'}`;

let authListenerSubscribed = false;

export const useVocaStore = create<VocaState>((set, get) => ({
  accountRole: 'student',
  userRole: 'student',
  userEmail: '',
  userName: '',
  tutorId: '',
  studentId: '',
  availableTutors: [],
  availableStudents: [],
  linkedTutorIds: [],
  linkedStudentIds: [],
  isVerifiedWithInviteCode: false,

  toggleLinkedTutorId: async (tutorId: string) => {
    const current = get().linkedTutorIds;
    const exists = current.includes(tutorId);
    const updated = exists ? current.filter(id => id !== tutorId) : [...current, tutorId];
    set({ linkedTutorIds: updated });

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_linked_tutor_ids', JSON.stringify(updated));
    }

    const client = getSupabaseClient();
    const studentId = get().studentId;

    if (client && isUuid(studentId) && isUuid(tutorId)) {
      try {
        if (!exists) {
          // Add row to tutor_students table in Supabase DB
          await client.from('tutor_students').upsert({
            tutor_id: tutorId,
            student_id: studentId,
            created_at: new Date().toISOString()
          }, { onConflict: 'tutor_id,student_id' });
          console.log(`DB tutor_students link added: student=${studentId}, tutor=${tutorId}`);
        } else {
          // Delete row from tutor_students table in Supabase DB
          await client.from('tutor_students')
            .delete()
            .eq('tutor_id', tutorId)
            .eq('student_id', studentId);
          console.log(`DB tutor_students link removed: student=${studentId}, tutor=${tutorId}`);
        }
      } catch (err) {
        console.warn('Error updating tutor_students DB link:', err);
      }
    }

    // Instantly re-filter wordbooks for student view!
    get().filterWordbooksForStudent(updated);
  },

  allWordbooks: [],
  wordbooks: [],

  filterWordbooksForStudent: (selectedTutorIds?: string[]) => {
    const selectedTutors = selectedTutorIds || get().linkedTutorIds;
    const allWbs = get().allWordbooks;
    const userId = get().studentId;
    const localStudentWbIds: string[] = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('vocat_student_wb_ids') || '[]')
      : [];

    let filtered = allWbs;
    if (get().userRole === 'student') {
      filtered = allWbs.filter(wb => {
        const isStudentCreated = Boolean(
          wb.is_student_created ||
          wb.creator_role === 'student' ||
          localStudentWbIds.includes(wb.id) ||
          (wb.tutor_name && (wb.tutor_name.includes('학생') || wb.tutor_name.includes('개인'))) ||
          (userId && wb.tutor_id === userId)
        );

        if (isStudentCreated) return true;
        if (wb.tutor_id && selectedTutors.includes(wb.tutor_id)) return true;
        if (wb.tutor_name && selectedTutors.some(tId => (wb.tutor_name || '').toLowerCase().includes(tId.toLowerCase()))) return true;
        if (selectedTutors.includes('tutor-sensorssam') && (!wb.tutor_id || wb.tutor_name?.includes('SensorSsam'))) return true;
        return false;
      });
    }

    set({
      wordbooks: filtered,
      activeWordbookId: filtered[0]?.id || null
    });
  },

  setUserRole: (role) => {
    set({ userRole: role });
    if (typeof window !== 'undefined') localStorage.setItem('vocat_user_role', role);
    get().filterWordbooksForStudent();
  },
  setUserEmail: (email) => set({ userEmail: email }),
  setUserName: (name) => set({ userName: name }),

  updateProfileName: async (name: string) => {
    const nickname = (name || '').trim();
    if (!nickname) return;

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_user_name', nickname);
    }
    set({ userName: nickname });

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: authData } = await client.auth.getUser();
        let userId = authData?.user?.id || get().tutorId || get().studentId;

        if (!userId || !isUuid(userId)) {
          userId = getOrCreateUserId();
          set({ tutorId: userId, studentId: userId });
        }

        const userEmail = authData?.user?.email || get().userEmail || '';
        const role = get().accountRole || get().userRole || 'student';

        const { error } = await client.from('profiles').upsert({
          id: userId,
          email: userEmail,
          name: nickname,
          role: role,
          is_verified: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (error) {
          console.warn('Upsert profile name failed, attempting update:', error);
          await client.from('profiles').update({ name: nickname }).eq('id', userId);
        } else {
          console.log('Saved nickname to DB profiles table successfully:', nickname);
        }
      } catch (err) {
        console.warn('Profile name update error:', err);
      }
    }

    // Refresh initial data so available tutors list and displays update immediately
    await get().loadInitialData();
  },

  verifyInviteCode: async (code: string, role: UserRole, name?: string) => {
    const expectedCode = (process.env.NEXT_PUBLIC_INVITE_CODE || 'SSAM2026').trim();
    const givenCode = (code || '').trim();
    const nickname = (name || '').trim();

    if (!givenCode || givenCode.toUpperCase() !== expectedCode.toUpperCase()) {
      return {
        success: false,
        error: '올바른 초대 코드가 아닙니다. 센서쌤에게 가입 코드를 확인하세요.'
      };
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_invite_verified', 'true');
      localStorage.setItem('vocat_user_role', role);
      localStorage.setItem('vocat_account_role', role);
      if (nickname) localStorage.setItem('vocat_user_name', nickname);
    }
    set({ accountRole: role, userRole: role });

    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: userData } = await client.auth.getUser();
        if (userData?.user) {
          const userId = userData.user.id;
          const userEmail = userData.user.email || '';
          const defaultName = userEmail ? userEmail.split('@')[0] : '유저';
          const finalName = nickname || defaultName;

          set({ tutorId: userId, studentId: userId, userEmail, userName: finalName, accountRole: role, userRole: role });
          
          await client.from('profiles').upsert({
            id: userId,
            email: userEmail,
            name: finalName,
            role,
            is_verified: true,
            created_at: new Date().toISOString()
          }, { onConflict: 'id' });
        }
      } catch (err) {
        console.warn('Supabase profile check/insert error:', err);
      }
    }

    set({ isVerifiedWithInviteCode: true });
    return { success: true };
  },

  signOutUser: async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vocat_invite_verified');
      localStorage.removeItem('vocat_user_role');
      localStorage.removeItem('vocat_account_role');
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

  words: {},
  activeWordbookId: null,
  setActiveWordbookId: (id) => set({ activeWordbookId: id }),

  isLoading: false,

  quizResults: [],
  incorrectNotes: [],
  isStudentReportOpen: false,
  openStudentReport: () => set({ isStudentReportOpen: true }),
  closeStudentReport: () => set({ isStudentReportOpen: false }),

  loadInitialData: async () => {
    set({ isLoading: true });
    get().loadSettings();

    // Load verification state & saved user role & saved name
    if (typeof window !== 'undefined') {
      const isVerified = localStorage.getItem('vocat_invite_verified') === 'true';
      const storedAccountRole = localStorage.getItem('vocat_account_role') as UserRole;
      const storedUserRole = localStorage.getItem('vocat_user_role') as UserRole;
      const storedName = localStorage.getItem('vocat_user_name') || '';
      const initialRole = storedAccountRole || storedUserRole || get().accountRole || 'student';
      set({
        isVerifiedWithInviteCode: isVerified,
        accountRole: initialRole,
        userRole: storedUserRole || initialRole,
        userName: storedName || get().userName
      });
    }

    const client = getSupabaseClient();
    if (client) {
      if (!authListenerSubscribed) {
        authListenerSubscribed = true;
        client.auth.onAuthStateChange(async (event, session) => {
          if (session?.user) {
            const userId = session.user.id;
            const userEmail = session.user.email || '';
            const defaultName = userEmail ? userEmail.split('@')[0] : `user-${userId.slice(0, 5)}`;
            set({
              userEmail,
              tutorId: userId,
              studentId: userId,
            });
            try {
              let { data: profile } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
              const storedAccountRole = (typeof window !== 'undefined'
                ? (localStorage.getItem('vocat_account_role') || localStorage.getItem('vocat_user_role'))
                : null) as UserRole | null;

              const activeName = profile?.name || (typeof window !== 'undefined' ? localStorage.getItem('vocat_user_name') : null) || defaultName;
              const activeRole = profile?.role || storedAccountRole || get().accountRole || 'student';
              
              set({
                accountRole: activeRole,
                userRole: activeRole,
                userName: activeName,
                isVerifiedWithInviteCode: true
              });
              if (typeof window !== 'undefined') {
                localStorage.setItem('vocat_invite_verified', 'true');
                localStorage.setItem('vocat_user_name', activeName);
                localStorage.setItem('vocat_account_role', activeRole);
                localStorage.setItem('vocat_user_role', activeRole);
              }

              if (!profile || profile.role !== activeRole || !profile.name) {
                await client.from('profiles').upsert({
                  id: userId,
                  email: userEmail,
                  name: activeName,
                  role: activeRole,
                  is_verified: true,
                  created_at: new Date().toISOString()
                }, { onConflict: 'id' });
              }
            } catch (e) {
              console.warn('Profile sync error:', e);
            }
          }
        });
      }

      try {
        const { data: authData } = await client.auth.getUser();
        let userId = '';

        if (authData?.user) {
          userId = authData.user.id;
          const userEmail = authData.user.email || '';
          const defaultName = userEmail ? userEmail.split('@')[0] : `user-${userId.slice(0, 5)}`;
          set({
            userEmail,
            tutorId: userId,
            studentId: userId,
          });

          let { data: profile } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

          const storedAccountRole = (typeof window !== 'undefined'
            ? (localStorage.getItem('vocat_account_role') || localStorage.getItem('vocat_user_role'))
            : null) as UserRole | null;

          const activeName = profile?.name || (typeof window !== 'undefined' ? localStorage.getItem('vocat_user_name') : null) || defaultName;
          const activeRole = profile?.role || storedAccountRole || get().accountRole || 'student';

          set({
            accountRole: activeRole,
            userRole: activeRole,
            userName: activeName,
            isVerifiedWithInviteCode: true
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem('vocat_invite_verified', 'true');
            localStorage.setItem('vocat_user_name', activeName);
            localStorage.setItem('vocat_account_role', activeRole);
            localStorage.setItem('vocat_user_role', activeRole);
          }

          if (!profile || profile.role !== activeRole || !profile.name) {
            await client.from('profiles').upsert({
              id: userId,
              email: userEmail,
              name: activeName,
              role: activeRole,
              is_verified: true,
              created_at: new Date().toISOString()
            }, { onConflict: 'id' });
          }
        } else {
          // Unauthenticated visitor: DO NOT LOAD PRIVATE WORDBOOKS!
          set({
            userEmail: '',
            tutorId: '',
            studentId: '',
            allWordbooks: [],
            wordbooks: [],
            words: {},
            activeWordbookId: null,
            isLoading: false
          });
          return;
        }

        // 0. Clean up legacy dummy tutors from DB tables
        try {
          await client
            .from('wordbooks')
            .update({ tutor_name: 'SensorSsam (대표 튜터)' })
            .or('tutor_name.ilike.%이튜터%,tutor_name.ilike.%박튜터%,tutor_name.ilike.%최튜터%,tutor_name.ilike.%tutor-lee%,tutor_name.ilike.%tutor-park%,tutor_name.ilike.%tutor-choi%');

          await client
            .from('profiles')
            .delete()
            .or('id.ilike.%tutor-lee%,id.ilike.%tutor-park%,id.ilike.%tutor-choi%,email.ilike.%tutor-lee%,email.ilike.%tutor-park%,email.ilike.%tutor-choi%');
        } catch (cleanupErr) {
          console.warn('DB cleanup warning:', cleanupErr);
        }

        // 1. Fetch registered tutors from profiles table (excluding legacy dummy tutors)
        try {
          const { data: tutorProfiles } = await client
            .from('profiles')
            .select('*')
            .eq('role', 'tutor');

          const realTutors = (tutorProfiles || []).filter(p => {
            const str = ((p.email || '') + ' ' + (p.name || '') + ' ' + (p.id || '')).toLowerCase();
            return !str.includes('이튜터') && !str.includes('박튜터') && !str.includes('최튜터') &&
                   !str.includes('tutor-lee') && !str.includes('tutor-park') && !str.includes('tutor-choi');
          });

          if (realTutors.length > 0) {
            const mappedTutors = realTutors.map(p => {
              let displayName = '';
              const nameStr = (p.name || '').trim();
              if (nameStr) {
                displayName = nameStr.endsWith('튜터') ? nameStr : `${nameStr} 튜터`;
              } else if (p.email) {
                const prefix = p.email.split('@')[0];
                displayName = `${prefix} 튜터`;
              } else {
                displayName = `${p.id.slice(0, 6)} 튜터`;
              }

              return {
                id: p.id,
                name: displayName,
                title: '',
                avatarBg: 'bg-indigo-600'
              };
            });
            set({ availableTutors: mappedTutors });

            const validTutorIds = mappedTutors.map(t => t.id);

            // Fetch student's actual linked tutors from DB tutor_students table!
            let dbLinkedTutorIds: string[] = [];
            if (userId && isUuid(userId)) {
              try {
                const { data: dbLinks } = await client
                  .from('tutor_students')
                  .select('tutor_id')
                  .eq('student_id', userId);
                if (dbLinks && dbLinks.length > 0) {
                  dbLinkedTutorIds = dbLinks.map((l: any) => l.tutor_id).filter((id: string) => validTutorIds.includes(id));
                }
              } catch (dbErr) {
                console.warn('Failed querying tutor_students from DB:', dbErr);
              }
            }

            // If DB links exist, use them. Otherwise check localStorage. For brand new students, default is [] (EMPTY ARRAY)!
            const savedLocal = typeof window !== 'undefined' ? localStorage.getItem('vocat_linked_tutor_ids') : null;
            let activeLinkedIds: string[] = [];

            if (dbLinkedTutorIds.length > 0) {
              activeLinkedIds = dbLinkedTutorIds;
            } else if (savedLocal !== null) {
              try {
                const parsed = JSON.parse(savedLocal);
                activeLinkedIds = Array.isArray(parsed) ? parsed.filter(id => validTutorIds.includes(id)) : [];
              } catch (e) {
                activeLinkedIds = [];
              }
            } else {
              // Brand new student: NO TUTORS LINKED BY DEFAULT!
              activeLinkedIds = [];
            }

            set({ linkedTutorIds: activeLinkedIds });
          } else {
            set({ availableTutors: [], linkedTutorIds: [] });
          }
        } catch (e) {
          console.warn('Failed fetching registered tutor profiles:', e);
          set({ availableTutors: [], linkedTutorIds: [] });
        }

        // 1.5 Fetch registered student profiles from profiles table
        try {
          const { data: studentProfiles } = await client
            .from('profiles')
            .select('*')
            .or('role.eq.student,role.is.null');

          const mappedStudents = (studentProfiles || []).map(p => {
            const nameStr = (p.name || '').trim();
            const emailStr = (p.email || '').trim();
            const displayName = nameStr || (emailStr ? emailStr.split('@')[0] : `학생 (${p.id.slice(0, 6)})`);
            return {
              id: p.id,
              name: displayName,
              email: emailStr
            };
          });

          set({ availableStudents: mappedStudents });
        } catch (e) {
          console.warn('Failed fetching registered student profiles:', e);
          set({ availableStudents: [] });
        }

        // 1.8 Fetch study_logs and auto-mark attendance for today
        try {
          const { data: logsData } = await client
            .from('study_logs')
            .select('*')
            .order('study_date', { ascending: false });

          if (logsData) {
            set({ studyLogs: logsData });
          }
        } catch (e) {
          console.warn('Failed fetching study_logs:', e);
        }

        // Auto-mark attendance row for today if student enters app
        const currentStudentId = get().studentId;
        const todayStr = new Date().toISOString().split('T')[0];
        if (currentStudentId) {
          const hasTodayLog = get().studyLogs.some(l => l.student_id === currentStudentId && l.study_date === todayStr);
          if (!hasTodayLog) {
            get().addStudyTime(0); // 0 seconds to mark attendance row in DB
          }
        }

        // 2. Query ALL wordbooks in Supabase & sanitize legacy tutor names
        const { data: wbData, error: wbErr } = await client
          .from('wordbooks')
          .select('*')
          .order('created_at', { ascending: false });

        if (!wbErr && wbData) {
          const localStudentWbIds: string[] = typeof window !== 'undefined'
            ? JSON.parse(localStorage.getItem('vocat_student_wb_ids') || '[]')
            : [];

          // Fetch all profiles map to resolve creator roles and tutor names accurately
          const { data: allProfilesData } = await client.from('profiles').select('*');
          const profilesMap: Record<string, any> = {};
          (allProfilesData || []).forEach(p => {
            profilesMap[p.id] = p;
          });

          let rawWbs: Wordbook[] = (wbData || []).map(wb => {
            const creatorProfile = wb.tutor_id ? profilesMap[wb.tutor_id] : null;

            const isStudentCreated = Boolean(
              wb.is_student_created ||
              wb.creator_role === 'student' ||
              (creatorProfile && creatorProfile.role === 'student') ||
              localStudentWbIds.includes(wb.id) ||
              (wb.tutor_name && (wb.tutor_name.includes('학생') || wb.tutor_name.includes('개인'))) ||
              (userId && wb.tutor_id === userId && get().accountRole === 'student')
            );

            let tName = wb.tutor_name || '';
            const isLegacyDummy = !tName || tName.includes('이튜터') || tName.includes('박튜터') || tName.includes('최튜터') ||
              tName.includes('tutor-lee') || tName.includes('tutor-park') || tName.includes('tutor-choi');

            if (isStudentCreated) {
              tName = '학생 (개인 단어장)';
            } else if (creatorProfile && creatorProfile.role === 'tutor') {
              const pName = (creatorProfile.name || '').trim();
              if (pName) {
                tName = pName.endsWith('튜터') ? pName : `${pName} 튜터`;
              } else if (creatorProfile.email) {
                tName = `${creatorProfile.email.split('@')[0]} 튜터`;
              } else {
                tName = 'SensorSsam (대표 튜터)';
              }
            } else if (isLegacyDummy) {
              tName = 'SensorSsam (대표 튜터)';
            }

            return {
              ...wb,
              tutor_name: tName,
              is_student_created: isStudentCreated,
              creator_role: isStudentCreated ? 'student' : (wb.creator_role || 'tutor')
            };
          });

          set({ allWordbooks: rawWbs });

          let activeWbs = rawWbs;
          if (get().userRole === 'student') {
            const selectedTutors = get().linkedTutorIds;
            activeWbs = rawWbs.filter(wb => {
              const isStudentCreated = Boolean(
                wb.is_student_created ||
                wb.creator_role === 'student' ||
                localStudentWbIds.includes(wb.id) ||
                (wb.tutor_name && (wb.tutor_name.includes('학생') || wb.tutor_name.includes('개인'))) ||
                (userId && wb.tutor_id === userId)
              );

              if (isStudentCreated) return true;
              if (wb.tutor_id && selectedTutors.includes(wb.tutor_id)) return true;
              if (wb.tutor_name && selectedTutors.some(tId => (wb.tutor_name || '').toLowerCase().includes(tId.toLowerCase()))) return true;
              if (selectedTutors.includes('tutor-sensorssam') && (!wb.tutor_id || wb.tutor_name?.includes('SensorSsam'))) return true;
              return false;
            });
          }

          const wordsMap: Record<string, Word[]> = {};
          for (const wb of rawWbs) {
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

          if (userId) {
            const wbKey = getWbKey(userId);
            const wordsKey = getWordsKey(userId);
            if (typeof window !== 'undefined') {
              localStorage.setItem(wbKey, JSON.stringify(activeWbs));
              localStorage.setItem(wordsKey, JSON.stringify(wordsMap));
            }
          }
          return;
        }
      } catch (err) {
        console.warn('Supabase initial load error:', err);
      }
    }

    set({
      wordbooks: [],
      words: {},
      activeWordbookId: null,
      isLoading: false
    });

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
    const isStudent = get().userRole === 'student';
    const currentUserName = get().userName;
    const formattedTutorName = currentUserName
      ? (currentUserName.endsWith('튜터') ? currentUserName : `${currentUserName} 튜터`)
      : (get().userEmail ? `${get().userEmail.split('@')[0]} 튜터` : '튜터');
    const tutorName = isStudent ? '학생 (개인 단어장)' : formattedTutorName;

    let activeUserId = get().tutorId || get().studentId;
    let userEmail = get().userEmail;

    if (client) {
      try {
        const { data: authData } = await client.auth.getUser();
        if (authData?.user) {
          activeUserId = authData.user.id;
          userEmail = authData.user.email || userEmail;
          set({ tutorId: activeUserId, studentId: activeUserId, userEmail });
        }
      } catch (e) {
        console.warn('Auth check error in addWordbookWithWords:', e);
      }

      if (!activeUserId || !isUuid(activeUserId)) {
        activeUserId = getOrCreateUserId();
        set({ tutorId: activeUserId, studentId: activeUserId });
      }

      const dbUserId = isUuid(activeUserId) ? activeUserId : null;

      try {
        // STEP 1: Ensure student/tutor profile exists in DB to satisfy foreign key constraint!
        if (dbUserId) {
          const currentRole = get().accountRole || get().userRole || (isStudent ? 'student' : 'tutor');
          const currentName = get().userName || (isStudent ? '학생' : 'SensorSsam 튜터');
          const currentEmail = userEmail || get().userEmail || `user-${dbUserId.slice(0, 5)}@vocat.com`;

          try {
            await client.from('profiles').upsert({
              id: dbUserId,
              email: currentEmail,
              name: currentName,
              role: currentRole,
              is_verified: true,
              created_at: new Date().toISOString()
            }, { onConflict: 'id' });
          } catch (profErr) {
            console.warn('Profile prep upsert warning:', profErr);
          }
        }

        // STEP 2: Insert Wordbook into Supabase DB table with 3-tier resilient fallback
        const insertWbData: any = {
          title,
          chapter,
          tutor_name: tutorName
        };
        if (dbUserId) {
          insertWbData.tutor_id = dbUserId;
        }

        let insertedWb: any = null;
        let wbErr: any = null;

        // Attempt 1: Full payload
        const res1 = await client
          .from('wordbooks')
          .insert(insertWbData)
          .select()
          .single();

        insertedWb = res1.data;
        wbErr = res1.error;

        // Attempt 2: If tutor_name column is missing in DB schema, delete tutor_name & retry
        if (wbErr && (wbErr.message?.includes('tutor_name') || wbErr.code === 'PGRST204')) {
          console.warn('Retrying wordbooks insert without tutor_name column...');
          delete insertWbData.tutor_name;
          const res2 = await client
            .from('wordbooks')
            .insert(insertWbData)
            .select()
            .single();
          insertedWb = res2.data;
          wbErr = res2.error;
        }

        // Attempt 3: If tutor_id foreign key fails, delete tutor_id & retry
        if (wbErr && (wbErr.code === '23503' || wbErr.message?.includes('foreign key') || wbErr.message?.includes('fkey'))) {
          console.warn('Retrying wordbooks insert without tutor_id foreign key...');
          delete insertWbData.tutor_id;
          const res3 = await client
            .from('wordbooks')
            .insert(insertWbData)
            .select()
            .single();
          insertedWb = res3.data;
          wbErr = res3.error;
        }

        if (wbErr) {
          console.error('Supabase wordbook insert error after fallbacks:', wbErr);
        }

        if (!wbErr && insertedWb) {
          // STEP 3: Insert Words into Supabase DB table
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

          console.log('Saved wordbook to Supabase DB successfully:', insertedWb.id);

          const newWbObj: Wordbook = {
            ...insertedWb,
            tutor_id: dbUserId || insertedWb.tutor_id,
            tutor_name: tutorName,
            creator_role: get().userRole,
            is_student_created: isStudent,
            words_count: (insertedWords || []).length
          };

          if (isStudent && typeof window !== 'undefined' && insertedWb?.id) {
            try {
              const existing = JSON.parse(localStorage.getItem('vocat_student_wb_ids') || '[]');
              if (!existing.includes(insertedWb.id)) {
                existing.push(insertedWb.id);
                localStorage.setItem('vocat_student_wb_ids', JSON.stringify(existing));
              }
            } catch (e) {
              console.warn('Error updating vocat_student_wb_ids:', e);
            }
          }

          const updatedAllWbs = [newWbObj, ...get().allWordbooks];
          const updatedWordsMap = { ...get().words, [insertedWb.id]: insertedWords || dbWords || [] };
          set({ allWordbooks: updatedAllWbs, words: updatedWordsMap, activeWordbookId: insertedWb.id });

          // Instantly re-filter active student/tutor wordbooks
          get().filterWordbooksForStudent();

          if (typeof window !== 'undefined') {
            const currentTId = get().tutorId;
            localStorage.setItem(getWbKey(currentTId), JSON.stringify(get().wordbooks));
            localStorage.setItem(getWordsKey(currentTId), JSON.stringify(updatedWordsMap));
          }

          return newWbObj;
        } else if (wbErr) {
          alert(`단어장 저장 중 DB 오류가 발생했습니다: ${wbErr.message || '데이터베이스 저장 실패'}`);
        }
      } catch (err) {
        console.error('Failed inserting to Supabase:', err);
      }
    }

    // Local Fallback
    const newWbId = `wb-${Date.now()}`;
    const newWb: Wordbook = {
      id: newWbId,
      tutor_id: get().tutorId,
      tutor_name: tutorName,
      creator_role: get().userRole,
      is_student_created: isStudent,
      title,
      chapter,
      created_at: new Date().toISOString(),
      words_count: batchWords.length
    };

    if (isStudent && typeof window !== 'undefined' && newWbId) {
      try {
        const existing = JSON.parse(localStorage.getItem('vocat_student_wb_ids') || '[]');
        if (!existing.includes(newWbId)) {
          existing.push(newWbId);
          localStorage.setItem('vocat_student_wb_ids', JSON.stringify(existing));
        }
      } catch (e) {
        console.warn('Error updating vocat_student_wb_ids:', e);
      }
    }

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

    const updatedAllWbs = [newWb, ...get().allWordbooks];
    const updatedWbs = [newWb, ...get().wordbooks];
    const updatedWords = { ...get().words, [newWbId]: newWords };
    set({ allWordbooks: updatedAllWbs, wordbooks: updatedWbs, words: updatedWords, activeWordbookId: newWbId });

    if (typeof window !== 'undefined') {
      const currentTId = get().tutorId;
      localStorage.setItem(getWbKey(currentTId), JSON.stringify(updatedWbs));
      localStorage.setItem(getWordsKey(currentTId), JSON.stringify(updatedWords));
    }

    return newWb;
  },

  deleteWordbook: async (wordbookId) => {
    const targetWb = get().wordbooks.find(wb => wb.id === wordbookId);
    const isStudent = get().userRole === 'student';

    if (isStudent && targetWb && !targetWb.is_student_created && targetWb.tutor_id !== get().studentId) {
      alert('튜터가 배정한 단어장은 학생이 삭제할 수 없습니다. 학생 본인이 직접 생성한 개인 단어장만 삭제할 수 있습니다.');
      return;
    }

    const client = getSupabaseClient();
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

  studyLogs: [],

  addStudyTime: async (seconds: number) => {
    if (seconds < 0) return;
    const studentId = get().studentId;
    if (!studentId) return;
    const today = new Date().toISOString().split('T')[0];

    const currentLogs = [...get().studyLogs];
    const existingIdx = currentLogs.findIndex(l => l.student_id === studentId && l.study_date === today);

    let updatedDuration = seconds;
    if (existingIdx >= 0) {
      updatedDuration = (currentLogs[existingIdx].duration_seconds || 0) + seconds;
      currentLogs[existingIdx] = {
        ...currentLogs[existingIdx],
        duration_seconds: updatedDuration
      };
    } else {
      currentLogs.push({
        id: `sl-${Date.now()}`,
        student_id: studentId,
        study_date: today,
        duration_seconds: updatedDuration,
        created_at: new Date().toISOString()
      });
    }

    set({ studyLogs: currentLogs });
    if (typeof window !== 'undefined') {
      localStorage.setItem(`vocat_study_logs_${studentId}`, JSON.stringify(currentLogs));
    }

    const client = getSupabaseClient();
    if (client && isUuid(studentId)) {
      try {
        await client.from('study_logs').upsert({
          student_id: studentId,
          study_date: today,
          duration_seconds: updatedDuration
        }, { onConflict: 'student_id,study_date' });
      } catch (err) {
        console.warn('Supabase addStudyTime error:', err);
      }
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
    set({
      wordbooks: SAMPLE_WORDBOOKS,
      words: SAMPLE_WORDS,
      activeWordbookId: SAMPLE_WORDBOOKS[0]?.id || null
    });
  }
}));
