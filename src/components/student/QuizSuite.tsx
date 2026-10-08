'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Word, Wordbook } from '@/types/database';
import { useVocaStore } from '@/store/useVocaStore';
import { speakText } from '@/lib/audio';
import { Sparkles, Volume2, Award, ArrowRight, RotateCw, X, ChevronRight } from 'lucide-react';

interface QuizSuiteProps {
  wordbook: Wordbook;
  words: Word[];
  onFinish: () => void;
}

interface QuizQuestionItem {
  word: Word;
  type: 'spelling' | 'meaning';
}

export const QuizSuite: React.FC<QuizSuiteProps> = ({ wordbook, words, onFinish }) => {
  const { recordQuizResult } = useVocaStore();

  const [stage, setStage] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [currentStep, setCurrentStep] = useState(0);

  // User input states
  const [userInputSpelling, setUserInputSpelling] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // Scoring states
  const [score, setScore] = useState(0);
  const [wrongList, setWrongList] = useState<{ wordId: string; wrongAnswer: string }[]>([]);

  // Calculate Part 1 (Spelling, ~40%) and Part 2 (Meaning, ~60%) question distribution for ALL words
  const totalCount = words.length;
  const part1Count = Math.min(totalCount, Math.max(0, Math.round(totalCount * 0.4)));
  const part2Count = totalCount - part1Count;

  // Sort words putting is_spelling_priority = true first
  const sortedWords = [...words].sort((a, b) => {
    if (a.is_spelling_priority === b.is_spelling_priority) return 0;
    return a.is_spelling_priority ? -1 : 1;
  });

  const part1Words = sortedWords.slice(0, part1Count);
  const part2Words = sortedWords.slice(part1Count);

  // Build full question sequence covering 100% of chapter words
  const quizQuestions: QuizQuestionItem[] = [
    ...part1Words.map(w => ({ word: w, type: 'spelling' as const })),
    ...part2Words.map(w => ({ word: w, type: 'meaning' as const }))
  ];

  const currentQuestion = quizQuestions[currentStep] || quizQuestions[0];
  const targetWord = currentQuestion?.word;

  // Build 4 multiple choice options for Part 2
  const buildOptionsForMeaning = (target: Word) => {
    const meanings = words.map(w => w.meaning);
    const distractors = meanings.filter(m => m !== target.meaning);
    const shuffled = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [target.meaning, ...shuffled].sort(() => 0.5 - Math.random());
    return { options, answerIndex: options.indexOf(target.meaning) };
  };

  const currentOptions = targetWord ? buildOptionsForMeaning(targetWord) : { options: [], answerIndex: 0 };

  const handleStartQuiz = () => {
    setStage('quiz');
    setCurrentStep(0);
    setScore(0);
    setWrongList([]);
    setUserInputSpelling('');
    setSelectedOption(null);
  };

  // Exit / Abort Quiz with Confirm Modal
  const handleAbortQuiz = () => {
    if (confirm("시험을 중단하고 홈 화면으로 이동하시겠습니까? 진행 중인 시험 결과는 저장되지 않습니다.")) {
      onFinish();
    }
  };

  const handleAnswerSubmit = (givenAnswer: string, isCorrect: boolean) => {
    if (isCorrect) {
      setScore(prev => prev + 1);
    } else {
      setWrongList(prev => [...prev, { wordId: targetWord.id, wrongAnswer: givenAnswer }]);
    }

    // Move to next question or complete
    if (currentStep < quizQuestions.length - 1) {
      setCurrentStep(prev => prev + 1);
      setUserInputSpelling('');
      setSelectedOption(null);
    } else {
      // Quiz Finished!
      const finalScore = isCorrect ? score + 1 : score;
      recordQuizResult(
        wordbook.id,
        finalScore,
        quizQuestions.length,
        isCorrect ? wrongList : [...wrongList, { wordId: targetWord.id, wrongAnswer: givenAnswer }]
      );
      setStage('result');
      
      // Trigger confetti celebration!
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  };

  if (stage === 'intro') {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-6 shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
          <Sparkles className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-800">
            {wordbook.title} ({wordbook.chapter})
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            등록된 전체 {totalCount}개 단어 맞춤 테스트를 시작합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1">
            <span className="text-[10px] font-extrabold text-amber-700 uppercase">Part 1 (스펠링 직쓰기)</span>
            <h4 className="text-sm font-bold text-slate-800">뜻 제시 → 영어 단어 쓰기</h4>
            <p className="text-xs text-slate-600">스펠링 필수 암기 단어 ({part1Count}문항 / ~40%)</p>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase">Part 2 (의미 선택)</span>
            <h4 className="text-sm font-bold text-slate-800">영어 제시 → 한글 뜻 선택</h4>
            <p className="text-xs text-slate-600">다의어 & 까다로운 단어 ({part2Count}문항 / ~60%)</p>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-center gap-4">
          <button
            onClick={onFinish}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleStartQuiz}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all active:scale-95"
          >
            <span>전체 {totalCount}문항 테스트 시작하기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'result') {
    const scorePct = Math.round((score / quizQuestions.length) * 100);

    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-6 shadow-xl animate-in zoom-in-95 duration-300">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-amber-400 to-blue-600 p-1 flex items-center justify-center shadow-md">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-amber-500">
            <Award className="w-10 h-10" />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-extrabold text-slate-800">테스트 완료!</h2>
          <p className="text-xs text-slate-500 font-medium">
            {wordbook.title} - {wordbook.chapter} (총 {quizQuestions.length}문항 완료)
          </p>
        </div>

        {/* Score Summary Card */}
        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="text-4xl font-extrabold text-blue-600">
            {score} <span className="text-lg text-slate-500 font-normal">/ {quizQuestions.length}</span>
          </div>
          <div className="text-sm font-bold text-slate-700">
            정답률: <span className="text-blue-600">{scorePct}%</span>
          </div>

          {wrongList.length > 0 && (
            <p className="text-xs text-rose-600 pt-2 border-t border-slate-200 font-medium">
              틀린 단어 {wrongList.length}개가 <strong>오답 노트</strong>에 자동으로 저장되었습니다.
            </p>
          )}
        </div>

        <div className="pt-4 flex items-center justify-center gap-3">
          <button
            onClick={handleStartQuiz}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            <RotateCw className="w-4 h-4" /> 다시 풀기
          </button>
          <button
            onClick={onFinish}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <span>학습으로 돌아가기</span>
          </button>
        </div>
      </div>
    );
  }

  // QUIZ SCREEN
  const isSpellingPart = currentQuestion?.type === 'spelling';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Top Header: Progress & Abort Exit Button */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-slate-800">
            {wordbook.title} ({wordbook.chapter})
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-mono font-bold">
            문제 {currentStep + 1} / {quizQuestions.length}
          </span>
        </div>

        <button
          onClick={handleAbortQuiz}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="시험 중단 및 홈으로 나가기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Clean Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
          <span>
            {isSpellingPart ? `Part 1: 스펠링 직쓰기 (${currentStep + 1}/${part1Count})` : `Part 2: 4지선다 뜻 선택 (${currentStep + 1 - part1Count}/${part2Count})`}
          </span>
          <span className="font-mono text-blue-600 font-extrabold">
            {Math.round(((currentStep + 1) / quizQuestions.length) * 100)}% 진행중
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300 rounded-full"
            style={{ width: `${((currentStep + 1) / quizQuestions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 space-y-6 shadow-xl">
        
        {/* Question Header */}
        <div className="flex items-center justify-between">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            isSpellingPart ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            {isSpellingPart ? 'Part 1: 스펠링 직접 쓰기' : 'Part 2: 한글 뜻 선택'}
          </span>

          <button
            onClick={() => speakText(targetWord.word)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-blue-600 text-xs font-bold transition-colors"
          >
            <Volume2 className="w-4 h-4" /> 발음 듣기
          </button>
        </div>

        {/* Question Prompt */}
        {isSpellingPart ? (
          // Part 1: Spelling input (Korean meaning -> Type English word)
          <div className="space-y-6 text-center py-4">
            <h3 className="text-3xl font-extrabold text-slate-800">
              {targetWord.meaning}
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const isCorrect = userInputSpelling.trim().toLowerCase() === targetWord.word.trim().toLowerCase();
                handleAnswerSubmit(userInputSpelling, isCorrect);
              }}
              className="space-y-4 pt-2"
            >
              <input
                type="text"
                autoFocus
                value={userInputSpelling}
                onChange={(e) => setUserInputSpelling(e.target.value)}
                placeholder="정확한 스펠링을 입력하세요"
                className="w-full h-14 px-5 rounded-xl bg-white border-2 border-slate-300 text-center font-bold text-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 placeholder-slate-400"
              />

              <button
                type="submit"
                disabled={!userInputSpelling.trim()}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm shadow-sm transition-all active:scale-95"
              >
                정답 제출하기
              </button>
            </form>
          </div>
        ) : (
          // Part 2: 4-Choice Meaning Selection (English word -> Select Korean meaning)
          <div className="space-y-6 py-2">
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-800">
                {targetWord.word}
              </h2>
              {targetWord.pronunciation && (
                <p className="text-slate-500 font-mono text-base">
                  [{targetWord.pronunciation}]
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {currentOptions.options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedOption(idx);
                    const isCorrect = idx === currentOptions.answerIndex;
                    setTimeout(() => handleAnswerSubmit(option, isCorrect), 300);
                  }}
                  className={`p-4 rounded-2xl border text-left text-sm font-bold transition-all flex items-center justify-between ${
                    selectedOption === idx
                      ? idx === currentOptions.answerIndex
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-rose-50 border-rose-500 text-rose-800'
                      : 'bg-white border-slate-200 hover:border-blue-400 text-slate-800 shadow-xs'
                  }`}
                >
                  <span>{idx + 1}. {option}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
