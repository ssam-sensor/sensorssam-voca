'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Word, Wordbook } from '@/types/database';
import { useVocaStore } from '@/store/useVocaStore';
import { speakText } from '@/lib/audio';
import { gradeStudentAnswerWithGemini } from '@/lib/gemini';
import { Sparkles, Volume2, Award, ArrowRight, RotateCw, X, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface QuizSuiteProps {
  wordbook: Wordbook;
  words: Word[];
  onFinish: () => void;
  mode?: 'standard' | 'ai';
}

interface QuizQuestionItem {
  word: Word;
  type: 'spelling' | 'meaning' | 'ai_meaning';
}

export const QuizSuite: React.FC<QuizSuiteProps> = ({ wordbook, words, onFinish, mode = 'standard' }) => {
  const { recordQuizResult } = useVocaStore();

  const [stage, setStage] = useState<'intro' | 'quiz' | 'result'>('intro');
  const [currentStep, setCurrentStep] = useState(0);

  // User input states
  const [userInputSpelling, setUserInputSpelling] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  // AI Mode States
  const [aiMeaningInput, setAiMeaningInput] = useState('');
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [aiEvalResult, setAiEvalResult] = useState<{ isCorrect: boolean; score: number; feedback: string } | null>(null);

  // Scoring states
  const [score, setScore] = useState(0);
  const [wrongList, setWrongList] = useState<{ wordId: string; wrongAnswer: string }[]>([]);

  // Selection Logic:
  // Standard mode: 100% of chapter words
  // AI mode: Top 1/3 difficult words (is_spelling_priority -> is_idiom -> length)
  const totalCount = words.length;

  const buildQuestions = (): QuizQuestionItem[] => {
    if (mode === 'ai') {
      const targetCount = Math.max(1, Math.round(totalCount / 3));
      const sortedByDifficulty = [...words].sort((a, b) => {
        if (a.is_spelling_priority !== b.is_spelling_priority) {
          return a.is_spelling_priority ? -1 : 1;
        }
        if (a.is_idiom !== b.is_idiom) {
          return a.is_idiom ? -1 : 1;
        }
        return b.word.length - a.word.length;
      });

      const selectedAiWords = sortedByDifficulty.slice(0, targetCount);
      return selectedAiWords.map(w => ({ word: w, type: 'ai_meaning' as const }));
    }

    // Standard mode: Part 1 (~40% spelling) & Part 2 (~60% meaning)
    const part1Count = Math.min(totalCount, Math.max(0, Math.round(totalCount * 0.4)));
    const sortedWords = [...words].sort((a, b) => {
      if (a.is_spelling_priority === b.is_spelling_priority) return 0;
      return a.is_spelling_priority ? -1 : 1;
    });

    const part1Words = sortedWords.slice(0, part1Count);
    const part2Words = sortedWords.slice(part1Count);

    return [
      ...part1Words.map(w => ({ word: w, type: 'spelling' as const })),
      ...part2Words.map(w => ({ word: w, type: 'meaning' as const }))
    ];
  };

  const quizQuestions: QuizQuestionItem[] = buildQuestions();
  const currentQuestion = quizQuestions[currentStep] || quizQuestions[0];
  const targetWord = currentQuestion?.word;

  // Build 4 multiple choice options for Standard Part 2
  const buildOptionsForMeaning = (target: Word) => {
    const meanings = words.map(w => w.meaning);
    const distractors = meanings.filter(m => m !== target.meaning);
    const shuffled = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [target.meaning, ...shuffled].sort(() => 0.5 - Math.random());
    return { options, answerIndex: options.indexOf(target.meaning) };
  };

  const currentOptions = targetWord && mode === 'standard' ? buildOptionsForMeaning(targetWord) : { options: [], answerIndex: 0 };

  const handleStartQuiz = () => {
    setStage('quiz');
    setCurrentStep(0);
    setScore(0);
    setWrongList([]);
    setUserInputSpelling('');
    setSelectedOption(null);
    setAiMeaningInput('');
    setAiEvalResult(null);
  };

  const handleAbortQuiz = () => {
    if (confirm("시험을 중단하고 홈 화면으로 이동하시겠습니까? 진행 중인 시험 결과는 저장되지 않습니다.")) {
      onFinish();
    }
  };

  // Submit & Grade AI Test Question
  const handleAiGradeSubmit = async () => {
    if (!aiMeaningInput.trim() || isAiGrading || !targetWord) return;

    setIsAiGrading(true);
    try {
      const evalRes = await gradeStudentAnswerWithGemini(
        targetWord.word,
        targetWord.meaning,
        targetWord.pos || '',
        aiMeaningInput.trim()
      );

      setAiEvalResult(evalRes);
      if (evalRes.isCorrect) {
        setScore(prev => prev + 1);
      } else {
        setWrongList(prev => [...prev, { wordId: targetWord.id, wrongAnswer: aiMeaningInput.trim() }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiGrading(false);
    }
  };

  const handleNextQuestion = (latestWrongList = wrongList, latestScore = score) => {
    if (currentStep < quizQuestions.length - 1) {
      setCurrentStep(prev => prev + 1);
      setUserInputSpelling('');
      setSelectedOption(null);
      setAiMeaningInput('');
      setAiEvalResult(null);
    } else {
      // Quiz Completed!
      recordQuizResult(
        wordbook.id,
        latestScore,
        quizQuestions.length,
        latestWrongList
      );
      setStage('result');
      
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  };

  const handleStandardAnswerSubmit = (givenAnswer: string, isCorrect: boolean) => {
    const updatedScore = isCorrect ? score + 1 : score;
    const updatedWrongList = isCorrect ? wrongList : [...wrongList, { wordId: targetWord.id, wrongAnswer: givenAnswer }];

    if (isCorrect) setScore(updatedScore);
    else setWrongList(updatedWrongList);

    handleNextQuestion(updatedWrongList, updatedScore);
  };

  // 1. INTRO SCREEN
  if (stage === 'intro') {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-6 shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 p-0.5 shadow-md flex items-center justify-center text-white">
          <Sparkles className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-800">
            {wordbook.title} ({wordbook.chapter})
          </h2>
          <p className="text-xs font-bold text-blue-600">
            {mode === 'ai' ? '✦ Gemini AI 고난도 어휘 1/3 맞춤 채점 테스트' : `등록된 전체 ${totalCount}개 단어 테스트`}
          </p>
        </div>

        {mode === 'ai' ? (
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-200 text-left space-y-3">
            <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-sm">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>AI 평가 안내 (전체 {totalCount}개 중 엄선 1/3 : 총 {quizQuestions.length}문항)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              1. 해당 챕터에서 가장 <strong>어렵거나 주요 암기 표제어 1/3</strong>을 선별했습니다.<br />
              2. 화면의 영단어를 보고 <strong>한글 뜻을 직접 입력</strong>해 보세요.<br />
              3. <strong>Gemini AI가 유의어 및 동의어까지 정밀 평가</strong>하고 실시간 피드백을 제공합니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-1">
              <span className="text-[10px] font-extrabold text-amber-700 uppercase">Part 1 (스펠링 직쓰기)</span>
              <h4 className="text-sm font-bold text-slate-800">뜻 제시 → 영어 단어 쓰기</h4>
              <p className="text-xs text-slate-600">스펠링 필수 암기 단어 (~40%)</p>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1">
              <span className="text-[10px] font-extrabold text-blue-700 uppercase">Part 2 (의미 선택)</span>
              <h4 className="text-sm font-bold text-slate-800">영어 제시 → 한글 뜻 선택</h4>
              <p className="text-xs text-slate-600">다의어 & 까다로운 단어 (~60%)</p>
            </div>
          </div>
        )}

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
            <span>{mode === 'ai' ? `AI 고난도 ${quizQuestions.length}문항 시작하기` : `전체 ${totalCount}문항 테스트 시작`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // 2. RESULT SCREEN
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
          <h2 className="text-2xl font-extrabold text-slate-800">
            {mode === 'ai' ? 'AI 고난도 평가 완료!' : '테스트 완료!'}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {wordbook.title} - {wordbook.chapter} (총 {quizQuestions.length}문항 완료)
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="text-4xl font-extrabold text-blue-600">
            {score} <span className="text-lg text-slate-500 font-normal">/ {quizQuestions.length}</span>
          </div>
          <div className="text-sm font-bold text-slate-700">
            정답률: <span className="text-blue-600">{scorePct}%</span>
          </div>

          {wrongList.length > 0 && (
            <p className="text-xs text-rose-600 pt-2 border-t border-slate-200 font-medium">
              틀린 단어 {wrongList.length}개가 <strong>오답 노트</strong>에 자동 등록되었습니다.
            </p>
          )}
        </div>

        <div className="pt-4 flex items-center justify-center gap-3">
          <button
            onClick={handleStartQuiz}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
          >
            <RotateCw className="w-4 h-4" /> 다시 치르기
          </button>
          <button
            onClick={onFinish}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <span>학습 홈으로 돌아가기</span>
          </button>
        </div>
      </div>
    );
  }

  // 3. QUIZ QUESTION SCREEN
  return (
    <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
      
      {/* Top Header: Progress & Abort Exit Button */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-hidden">
          <span className="font-bold text-xs sm:text-sm text-slate-800 truncate">
            {wordbook.title} ({wordbook.chapter})
          </span>
          <span className="px-2 py-0.5 sm:px-2.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] sm:text-xs font-mono font-bold shrink-0">
            {currentStep + 1} / {quizQuestions.length}
          </span>
        </div>

        <button
          onClick={handleAbortQuiz}
          className="p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          title="시험 중단 및 홈으로 나가기"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-600 font-semibold">
          <span>
            {mode === 'ai' ? `AI 고난도 1/3 평가 (${currentStep + 1}/${quizQuestions.length})` : `문항 ${currentStep + 1}/${quizQuestions.length}`}
          </span>
          <span className="font-mono text-blue-600 font-extrabold">
            {Math.round(((currentStep + 1) / quizQuestions.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-2 sm:h-2.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300 rounded-full"
            style={{ width: `${((currentStep + 1) / quizQuestions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-4 sm:space-y-6 shadow-lg">
        
        {/* MODE A: AI MEANING INPUT & REALTIME AI GRADING */}
        {mode === 'ai' ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Gemini AI 유의어 실시간 채점
              </span>

              <button
                onClick={() => speakText(targetWord.word)}
                className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-blue-600 text-xs font-bold transition-colors border border-slate-200"
              >
                <Volume2 className="w-4 h-4" /> 발음
              </button>
            </div>

            <div className="text-center space-y-2 py-2">
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 break-words">
                {targetWord.word}
              </h2>
              {targetWord.pronunciation && (
                <p className="text-slate-500 font-mono text-sm sm:text-base">
                  [{targetWord.pronunciation}]
                </p>
              )}
              {targetWord.pos && (
                <span className="inline-block px-3 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                  품사: {targetWord.pos}
                </span>
              )}
            </div>

            {/* Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!aiEvalResult && aiMeaningInput.trim()) {
                  handleAiGradeSubmit();
                }
              }}
              className="space-y-3 pt-2"
            >
              <label className="text-xs font-bold text-slate-700 block text-left">
                한글 뜻을 직접 입력하세요 (동의어/유의어 인정)
              </label>
              <input
                type="text"
                autoFocus
                disabled={Boolean(aiEvalResult) || isAiGrading}
                value={aiMeaningInput}
                onChange={(e) => setAiMeaningInput(e.target.value)}
                placeholder="예: 취약한, 상처받기 쉬운"
                className="w-full h-12 sm:h-14 px-4 rounded-xl bg-white border-2 border-slate-300 font-bold text-base sm:text-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 placeholder-slate-400 disabled:bg-slate-50"
              />

              {!aiEvalResult && (
                <button
                  type="submit"
                  disabled={!aiMeaningInput.trim() || isAiGrading}
                  className="w-full py-3 sm:py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {isAiGrading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gemini AI가 유의어를 분석 및 채점 중입니다...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>AI 채점 제출하기</span>
                    </>
                  )}
                </button>
              )}
            </form>

            {/* AI Grading Result Banner */}
            {aiEvalResult && (
              <div className={`p-4 sm:p-5 rounded-2xl border space-y-3 animate-in fade-in zoom-in-95 duration-200 ${
                aiEvalResult.isCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-extrabold text-sm sm:text-base">
                    {aiEvalResult.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span>AI 채점: 정답입니다! ({aiEvalResult.score}점)</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>AI 채점: 오답입니다 ({aiEvalResult.score}점)</span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed font-medium">
                  {aiEvalResult.feedback}
                </p>

                <div className="pt-2 border-t border-slate-200/60 text-xs font-semibold flex items-center justify-between">
                  <span className="text-slate-600">교재 수록 정답: <strong className="text-slate-900 font-bold">{targetWord.meaning}</strong></span>
                  <button
                    onClick={() => handleNextQuestion()}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
                  >
                    <span>{currentStep < quizQuestions.length - 1 ? '다음 단어' : '결과 보기'}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* MODE B: STANDARD 2-PART QUIZ */
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold border ${
                currentQuestion?.type === 'spelling' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200'
              }`}>
                {currentQuestion?.type === 'spelling' ? 'Part 1: 스펠링 직접 쓰기' : 'Part 2: 한글 뜻 선택'}
              </span>

              <button
                onClick={() => speakText(targetWord.word)}
                className="flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-blue-600 text-xs font-bold transition-colors border border-slate-200"
              >
                <Volume2 className="w-4 h-4" /> 발음
              </button>
            </div>

            {currentQuestion?.type === 'spelling' ? (
              <div className="space-y-4 sm:space-y-6 text-center py-2 sm:py-4">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-800 leading-snug break-words">
                  {targetWord.meaning}
                </h3>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const isCorrect = userInputSpelling.trim().toLowerCase() === targetWord.word.trim().toLowerCase();
                    handleStandardAnswerSubmit(userInputSpelling, isCorrect);
                  }}
                  className="space-y-3 sm:space-y-4 pt-1"
                >
                  <input
                    type="text"
                    autoFocus
                    value={userInputSpelling}
                    onChange={(e) => setUserInputSpelling(e.target.value)}
                    placeholder="정확한 스펠링 입력"
                    className="w-full h-12 sm:h-14 px-4 rounded-xl bg-white border-2 border-slate-300 text-center font-bold text-lg sm:text-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 placeholder-slate-400"
                  />

                  <button
                    type="submit"
                    disabled={!userInputSpelling.trim()}
                    className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95"
                  >
                    정답 제출하기
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6 py-1">
                <div className="text-center space-y-1 sm:space-y-2">
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-800 break-words">
                    {targetWord.word}
                  </h2>
                  {targetWord.pronunciation && (
                    <p className="text-slate-500 font-mono text-sm sm:text-base">
                      [{targetWord.pronunciation}]
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
                  {currentOptions.options.map((option, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedOption(idx);
                        const isCorrect = idx === currentOptions.answerIndex;
                        setTimeout(() => handleStandardAnswerSubmit(option, isCorrect), 300);
                      }}
                      className={`p-3.5 sm:p-4 rounded-2xl border text-left text-xs sm:text-sm font-bold transition-all flex items-center justify-between min-h-[48px] ${
                        selectedOption === idx
                          ? idx === currentOptions.answerIndex
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                            : 'bg-rose-50 border-rose-500 text-rose-800'
                          : 'bg-white border-slate-200 hover:border-blue-400 text-slate-800 shadow-xs'
                      }`}
                    >
                      <span className="leading-snug">{idx + 1}. {option}</span>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

