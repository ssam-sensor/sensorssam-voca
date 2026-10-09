'use client';

import React, { useState, useRef } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { parseVocaText } from '@/lib/voca-parser';
import { generateWordbookWithGemini, extractWordsFromMultimodalFile, getGeminiApiKey } from '@/lib/gemini';
import { VocaBatchItem } from '@/types/database';
import { Sparkles, FileText, Plus, Trash2, X, AlertCircle, Loader2, ArrowRight, Upload, FileCheck, Image as ImageIcon, CircleDot, CheckCircle2 } from 'lucide-react';

interface WordbookFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WordbookFormModal: React.FC<WordbookFormModalProps> = ({ isOpen, onClose }) => {
  const { addWordbookWithWords } = useVocaStore();

  const [activeTab, setActiveTab] = useState<'ocr' | 'ai' | 'batch' | 'manual'>('ocr');
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState('');

  // Multimodal File OCR Tab State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractionMode, setExtractionMode] = useState<'all' | 'marked'>('all');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Topic Tab State
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(10);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Batch Tab State
  const [batchRawText, setBatchRawText] = useState('');

  // Parsed Words Preview Table
  const [parsedWords, setParsedWords] = useState<VocaBatchItem[]>([]);

  // API Key Management State
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Reset form state to initial clean slate
  const resetForm = () => {
    setTitle('');
    setChapter('');
    setSelectedFile(null);
    setOcrError(null);
    setAiTopic('');
    setAiCount(10);
    setAiError(null);
    setBatchRawText('');
    setParsedWords([]);
    setActiveTab('ocr');
    setApiKeyInput('');
    setShowApiKeyInput(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  React.useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveApiKey = () => {
    const key = apiKeyInput.trim();
    if (!key) {
      alert('구글 Gemini API 키(AIzaSy...)를 입력해 주세요.');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('vocat_gemini_api_key', key);
    }
    setShowApiKeyInput(false);
    alert('Gemini API 키가 저장되어 즉시 연결되었습니다!');
  };

  // Handle Multimodal File OCR Extraction
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setOcrError(null);
    }
  };

  const handleOcrExtract = async () => {
    if (!selectedFile) {
      setOcrError('교재 이미지(JPG, PNG, WEBP) 또는 PDF 파일을 선택해 주세요.');
      return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      setShowApiKeyInput(true);
      setOcrError('Gemini API 키가 필요합니다. 아래 입력란에 구글 Gemini API 키를 입력해 주세요.');
      return;
    }

    setOcrError(null);
    setIsOcrLoading(true);

    try {
      // Read file as Base64 Data URL
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const resultStr = reader.result as string;
          const base64Data = resultStr.split(',')[1];
          const mimeType = selectedFile.type || 'image/png';

          const rawOcrText = await extractWordsFromMultimodalFile(base64Data, mimeType, extractionMode);
          const parsed = parseVocaText(rawOcrText);

          if (parsed.length === 0) {
            if (extractionMode === 'marked') {
              setOcrError('이미지에서 동그라미나 형광펜 표시를 찾지 못했습니다. 전체 추출로 진행하거나 표시가 선명한 사진을 올려주세요.');
            } else {
              setOcrError('파일에서 단어를 추출하지 못했습니다. 더 선명한 이미지나 문서를 첨부해 주세요.');
            }
          } else {
            setParsedWords(prev => [...prev, ...parsed]);
          }
        } catch (err: any) {
          console.error(err);
          setOcrError(err.message || '교재 분석 중 오류가 발생했습니다.');
        } finally {
          setIsOcrLoading(false);
        }
      };

      reader.onerror = () => {
        setOcrError('파일을 읽는 도중 오류가 발생했습니다.');
        setIsOcrLoading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err: any) {
      setOcrError(err.message || '파일 처리 오류가 발생했습니다.');
      setIsOcrLoading(false);
    }
  };

  // Handle AI Topic Generation
  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      setAiError('주제 또는 원문 텍스트를 입력해주세요.');
      return;
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      alert('Gemini API 키가 설정되지 않았습니다. .env.local 환경 변수 설정을 확인해 주세요.');
      return;
    }

    setAiError(null);
    setIsAiLoading(true);

    try {
      const result = await generateWordbookWithGemini(aiTopic, aiCount);
      if (!title) setTitle(result.title);
      if (!chapter) setChapter(result.chapter);
      setParsedWords(prev => [...prev, ...result.words]);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'AI 단어장 생성 중 오류가 발생했습니다.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle Batch Text Parsing
  const handleBatchParse = () => {
    const items = parseVocaText(batchRawText);
    setParsedWords(prev => [...prev, ...items]);
  };

  // Manual Add Row
  const handleAddManualRow = () => {
    setParsedWords(prev => [
      ...prev,
      {
        word: '',
        pronunciation: '',
        pos: '명사',
        meaning: '',
        example_sentence: '',
        example_translation: '',
        is_spelling_priority: true,
        is_idiom: false
      }
    ]);
  };

  const handleUpdateParsedWord = (index: number, field: keyof VocaBatchItem, value: any) => {
    setParsedWords(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveParsedWord = (index: number) => {
    setParsedWords(prev => prev.filter((_, i) => i !== index));
  };

  // Final Save
  const handleSave = async () => {
    if (!title.trim() || !chapter.trim()) {
      alert('단어장 제목과 챕터(Day)를 입력해주세요.');
      return;
    }

    const validWords = parsedWords.filter(w => w.word.trim().length > 0 && w.meaning.trim().length > 0);

    if (validWords.length === 0) {
      alert('최소 1개 이상의 단어와 뜻을 입력해주세요.');
      return;
    }

    await addWordbookWithWords(title.trim(), chapter.trim(), validWords);
    handleClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden text-slate-800 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-slate-50/80">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-800">새 단어장 챕터 등록</h2>
            <p className="text-[11px] sm:text-xs text-slate-500">교재 이미지/PDF 업로드, AI 생성, 붙여넣기 지원</p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Chapter Inputs */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-white space-y-3.5 sm:space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                단어장 제목 <span className="text-blue-600">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder='예: SensorSsam Voca 고등 COMPLETE'
                className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 placeholder-slate-400 font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                챕터 / 회차 (Day) <span className="text-blue-600">*</span>
              </label>
              <input
                type="text"
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                placeholder='예: DAY 15, DAY 16'
                className="w-full px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 placeholder-slate-400 font-medium"
              />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 pt-1.5 gap-1 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab('ocr')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-colors shrink-0 ${
                activeTab === 'ocr'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/60 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 shrink-0" />
              <span>교재 이미지/PDF 업로드</span>
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-colors shrink-0 ${
                activeTab === 'ai'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/60 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
              <span>AI 주제별 생성</span>
            </button>

            <button
              onClick={() => setActiveTab('batch')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-colors shrink-0 ${
                activeTab === 'batch'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/60 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>붙여넣기</span>
            </button>

            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-colors shrink-0 ${
                activeTab === 'manual'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/60 rounded-t-xl'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>직접 입력</span>
            </button>
          </div>
        </div>

        {/* Tab Content Area */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1 bg-slate-50/40">

          {/* TAB 1: Multimodal Book Image/PDF Upload OCR */}
          {activeTab === 'ocr' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-950 space-y-1">
                <p className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Gemini 3.8 Flash 멀티모달 OCR 교재 자동 추출
                </p>
                <p className="text-slate-600 leading-relaxed">
                  영어 교재 페이지 촬영 사진(JPG, PNG, WEBP)이나 교재 PDF 문서를 올려주시면 AI가 단어, 발음기호, 품사, 한글 뜻을 자동으로 파싱합니다.
                </p>
              </div>

              {ocrError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{ocrError}</span>
                </div>
              )}

              {(!getGeminiApiKey() || showApiKeyInput) && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      Gemini API 키 연결 설정
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-blue-600 hover:underline"
                    >
                      무료 API 키 발급받기 (Google AI Studio) &rarr;
                    </a>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium leading-relaxed">
                    교재 분석 및 단어 추출을 위해 구글 Gemini API 키(<code>AIzaSy...</code>)가 필요합니다.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="password"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder="구글 Gemini API 키 입력 (AIzaSy...)"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-white border border-amber-300 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={handleSaveApiKey}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all shrink-0"
                    >
                      API 키 저장
                    </button>
                  </div>
                </div>
              )}

              {/* Drag & Drop File Selector */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/30 transition-all text-center cursor-pointer space-y-3 group"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                />

                <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>

                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500 font-mono">
                      크기: {formatFileSize(selectedFile.size)} | 유형: {selectedFile.type || 'Document'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-800">
                      교재 사진(JPG, PNG, WEBP) 또는 PDF 파일을 선택/드래그하세요
                    </p>
                    <p className="text-xs text-slate-400">클릭하여 파일 탐색기 열기</p>
                  </div>
                )}
              </div>

              {/* Extraction Scope Options (Radio Toggle) */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <label className="text-xs font-bold text-slate-800 block">추출 범위 선택</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label
                    onClick={() => setExtractionMode('all')}
                    className={`p-3 rounded-xl border font-bold cursor-pointer transition-all flex items-center gap-2.5 ${
                      extractionMode === 'all'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="extMode"
                      checked={extractionMode === 'all'}
                      onChange={() => setExtractionMode('all')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p>전체 단어 추출 (기본값)</p>
                      <p className="text-[11px] font-normal text-slate-500">페이지 내 모든 표제어 및 단어 추출</p>
                    </div>
                  </label>

                  <label
                    onClick={() => setExtractionMode('marked')}
                    className={`p-3 rounded-xl border font-bold cursor-pointer transition-all flex items-center gap-2.5 ${
                      extractionMode === 'marked'
                        ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="extMode"
                      checked={extractionMode === 'marked'}
                      onChange={() => setExtractionMode('marked')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <p className="text-amber-900 flex items-center gap-1">
                        <CircleDot className="w-3.5 h-3.5 text-amber-600" />
                        체크된 단어만 추출 (동그라미/형광펜)
                      </p>
                      <p className="text-[11px] font-normal text-slate-500">손글씨 동그라미 또는 밑줄 표시 단어만 선별</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleOcrExtract}
                  disabled={isOcrLoading || !selectedFile}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
                >
                  {isOcrLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI가 교재 파일에서 단어를 추출하고 있습니다...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>교재에서 단어 자동 추출하기</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: AI Topic Generation */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-950">Gemini AI 주제별 단어장 즉시 생성</p>
                  <p className="mt-1 text-slate-600">
                    주제(예: &quot;수능 필수 숙어 20개&quot;, &quot;비즈니스 메일 어휘&quot;)를 입력하거나 영어 독해 지문을 붙여넣으시면 발음기호, 품사, 한국어 뜻, 예문, 예문 해석까지 일괄 생성합니다.
                  </p>
                </div>
              </div>

              {aiError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    학습 주제 또는 영어 본문 지문
                  </label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="예: 수능 고득점 어휘, IT 개발자 필수 영단어, 2026학년도 수능 독해 24번 지문"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 placeholder-slate-400 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">생성 단어 수</label>
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 font-medium"
                  >
                    <option value={5}>5개</option>
                    <option value={10}>10개 (추천)</option>
                    <option value={15}>15개</option>
                    <option value={20}>20개</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleAiGenerate}
                  disabled={isAiLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm disabled:opacity-40 transition-all"
                >
                  {isAiLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gemini AI 생성 중...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>AI 단어장 자동 생성하기</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Batch Paste */}
          {activeTab === 'batch' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-800">VocaT / CSV 데이터 포맷 붙여넣기</p>
                <p className="text-slate-500">
                  엑셀에서 복사한 탭(Tab) 데이터 또는 <code className="text-blue-700 font-bold bg-blue-50 px-1 py-0.5 rounded">단어, 발음기호, 품사, 뜻</code> 텍스트를 붙여넣은 뒤 파싱 버튼을 누르세요.
                </p>
              </div>

              <div>
                <textarea
                  rows={5}
                  value={batchRawText}
                  onChange={(e) => setBatchRawText(e.target.value)}
                  placeholder={`Word, Pronunciation, POS, Meaning\npersevere, pə̀ːrsəvíər, 동사, 인내하다; 끈기있게 계속하다\nvulnerable, vʌ́lnərəbl, 형용사, 취약한; 상처받기 쉬운`}
                  className="w-full p-3.5 rounded-xl bg-white border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleBatchParse}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>텍스트 파싱 및 목록 추가</span>
                </button>
              </div>
            </div>
          )}

          {/* Parsed Words Editable Table */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <span>등록 대상 단어 목록</span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold">
                  총 {parsedWords.length}개
                </span>
              </h3>
              <button
                onClick={handleAddManualRow}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold"
              >
                <Plus className="w-3.5 h-3.5" /> 단어 1개 추가
              </button>
            </div>

            {parsedWords.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white border border-dashed border-slate-300 text-slate-500 text-xs">
                아직 등록된 단어가 없습니다. 위 상단 탭에서 교재 파일 업로드, AI 생성 또는 붙여넣기를 실행해주세요.
              </div>
            ) : (
              <div className="space-y-3">
                {parsedWords.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5 relative group hover:border-slate-300 transition-colors"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                      <div className="sm:col-span-3">
                        <label className="text-[10px] font-bold text-slate-500 mb-0.5 block">단어</label>
                        <input
                          type="text"
                          value={item.word}
                          onChange={(e) => handleUpdateParsedWord(idx, 'word', e.target.value)}
                          placeholder="word"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 mb-0.5 block">발음기호 ([]제외)</label>
                        <input
                          type="text"
                          value={item.pronunciation || ''}
                          onChange={(e) => handleUpdateParsedWord(idx, 'pronunciation', e.target.value)}
                          placeholder="æpl"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 mb-0.5 block">품사</label>
                        <input
                          type="text"
                          value={item.pos || ''}
                          onChange={(e) => handleUpdateParsedWord(idx, 'pos', e.target.value)}
                          placeholder="명사; 동사"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800"
                        />
                      </div>
                      <div className="sm:col-span-5 pr-8">
                        <label className="text-[10px] font-bold text-slate-500 mb-0.5 block">뜻 (;구분)</label>
                        <input
                          type="text"
                          value={item.meaning}
                          onChange={(e) => handleUpdateParsedWord(idx, 'meaning', e.target.value)}
                          placeholder="사과; 사과나무"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <input
                        type="text"
                        value={item.example_sentence || ''}
                        onChange={(e) => handleUpdateParsedWord(idx, 'example_sentence', e.target.value)}
                        placeholder="예문 (English sentence)"
                        className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 placeholder-slate-400"
                      />
                      <input
                        type="text"
                        value={item.example_translation || ''}
                        onChange={(e) => handleUpdateParsedWord(idx, 'example_translation', e.target.value)}
                        placeholder="예문 해석 (Korean translation)"
                        className="w-full px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 placeholder-slate-400"
                      />
                    </div>

                    <div className="flex items-center gap-4 text-[11px] pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.is_spelling_priority || false}
                          onChange={(e) => handleUpdateParsedWord(idx, 'is_spelling_priority', e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-slate-50"
                        />
                        <span className="text-amber-800 font-bold">Part 1 스펠링 필수 암기</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.is_idiom || false}
                          onChange={(e) => handleUpdateParsedWord(idx, 'is_idiom', e.target.checked)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-slate-50"
                        />
                        <span className="text-purple-800 font-bold">숙어 (Idiom)</span>
                      </label>
                    </div>

                    <button
                      onClick={() => handleRemoveParsedWord(idx)}
                      className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                      title="단어 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <span className="text-xs text-slate-600">
            등록 준비 완료: <strong className="text-blue-700 font-bold">{parsedWords.length}개</strong> 단어
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all active:scale-95"
            >
              <span>단어장 최종 저장하기</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
