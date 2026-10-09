-- SensorSsam Voca Database Schema & RLS Setup for Supabase
-- N:M (Many-to-Many) Tutor-Student Mapping Structure

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. 프로필 테이블 (구글 로그인 연동 및 역할 구분, 초대 코드 인증)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  name text, -- 별명 / 닉네임 (e.g. "센서쌤", "길동튜터")
  role text check (role in ('tutor', 'student')) default 'student',
  is_verified boolean default false, -- 가입용 초대 코드(비밀 패스코드) 인증 여부
  gemini_api_key text, -- 암호화 저장 또는 로컬 관리
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 기존 profiles 테이블이 다른 앱에서 이미 생성되어 있더라도 안전하게 필요한 컬럼 추가
alter table profiles add column if not exists name text;
alter table profiles add column if not exists role text default 'student';
alter table profiles add column if not exists is_verified boolean default false;
alter table profiles add column if not exists gemini_api_key text;

-- 2. 튜터-학생 N:M (다대다) 매핑 연결 테이블
create table if not exists tutor_students (
  tutor_id uuid references profiles(id) on delete cascade,
  student_id uuid references profiles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  primary key (tutor_id, student_id)
);

-- 3. 단어장 챕터 테이블
create table if not exists wordbooks (
  id uuid default gen_random_uuid() primary key,
  tutor_id uuid references profiles(id) on delete cascade,
  tutor_name text,
  creator_role text default 'tutor',
  is_student_created boolean default false,
  title text not null, -- 예: "WordMaster 고등 COMPLETE", "자이스토리 1회"
  chapter text not null, -- 예: "DAY 15", "DAY 16"
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table wordbooks add column if not exists tutor_name text;
alter table wordbooks add column if not exists creator_role text default 'tutor';
alter table wordbooks add column if not exists is_student_created boolean default false;

-- 4. 단어 데이터 테이블
create table if not exists words (
  id uuid default gen_random_uuid() primary key,
  wordbook_id uuid references wordbooks(id) on delete cascade,
  word text not null,
  pronunciation text, -- 대괄호 [] 없는 발음기호
  pos text, -- 품사 (명사; 동사 등 복수 시 세미콜론 구분)
  meaning text not null, -- 뜻 (복수 시 세미콜론 구분)
  example_sentence text,
  example_translation text,
  is_idiom boolean default false,
  is_spelling_priority boolean default false -- Part 1(스펠링 필수 암기) 대상 여부
);

-- 5. 시험 및 오답 관리 테이블
create table if not exists quiz_results (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references profiles(id) on delete cascade,
  wordbook_id uuid references wordbooks(id) on delete cascade,
  total_score int not null,
  max_score int not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists incorrect_notes (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references profiles(id) on delete cascade,
  word_id uuid references words(id) on delete cascade,
  wrong_count int default 1,
  last_wrong_answer text,
  is_resolved boolean default false,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Row Level Security (RLS) Policies
alter table profiles enable row level security;
alter table tutor_students enable row level security;
alter table wordbooks enable row level security;
alter table words enable row level security;
alter table quiz_results enable row level security;
alter table incorrect_notes enable row level security;

-- Permissive policies for authenticated and anon users (allowing BYO DB & dynamic access)
create policy "Public profile access" on profiles for select using (true);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

create policy "Public tutor_students select" on tutor_students for select using (true);
create policy "Tutors can manage tutor_students" on tutor_students for all using (true);

create policy "Public wordbooks select" on wordbooks for select using (true);
create policy "Tutors can manage wordbooks" on wordbooks for all using (true);

create policy "Public words select" on words for select using (true);
create policy "Tutors can manage words" on words for all using (true);

create policy "Public quiz results" on quiz_results for all using (true);
create policy "Public incorrect notes" on incorrect_notes for all using (true);
