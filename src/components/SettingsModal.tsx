'use client';

import React, { useState, useEffect } from 'react';
import { useVocaStore } from '@/store/useVocaStore';
import { Key, Database, RefreshCw, CheckCircle2, X, Sparkles, Server } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, resetToSampleData } = useVocaStore();

  const [supabaseUrl, setSupabaseUrl] = useState(settings.supabaseUrl);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(settings.supabaseAnonKey);
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey);

  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    setSupabaseUrl(settings.supabaseUrl);
    setSupabaseAnonKey(settings.supabaseAnonKey);
    setGeminiApiKey(settings.geminiApiKey);
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateSettings({
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      geminiApiKey: geminiApiKey.trim()
    });
    setTestStatus('설정이 성공적으로 저장되었습니다!');
    setTimeout(() => {
      setTestStatus(null);
      onClose();
    }, 1200);
  };

  const handleResetData = () => {
    if (confirm('모든 샘플 데이터 및 로컬 저장 데이터를 초기화하고 기본 단어장으로 재설정하시겠습니까?')) {
      resetToSampleData();
      setTestStatus('샘플 데이터로 재설정되었습니다.');
      setTimeout(() => setTestStatus(null), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">환경 설정 (BYO Key & DB)</h2>
              <p className="text-xs text-slate-500">Google Gemini API Key 및 Supabase DB 독립 연동</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Status Indicator */}
          {testStatus && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{testStatus}</span>
            </div>
          )}

          {/* Gemini API Key Section */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Sparkles className="w-4 h-4 text-amber-600" />
                Google Gemini API Key (AI 자동 생성, OCR & 문맥 시험용)
              </label>
              {settings.isCustomGeminiConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3" /> 연동됨
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                  미연동 (기본 템플릿 작동)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Google AI Studio에서 발급받은 API 키를 입력하면 AI 단어장 자동 생성, 교재 이미지/PDF 멀티모달 OCR 추출 및 AI 문맥 시험 기능이 활성화됩니다.
            </p>
            <div className="relative">
              <Key className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Supabase DB Section */}
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Database className="w-4 h-4 text-blue-600" />
                Supabase DB URL & Anon Key (멀티유저 DB)
              </label>
              {settings.isCustomSupabaseConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3" /> DB 연결됨
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                  로컬 오프라인 모드
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              본인의 Supabase 프로젝트 URL과 Anon Key를 입력하면 클라우드 데이터베이스와 즉시 동기화됩니다. 미입력 시 브라우저 로컬 저장소에 안전하게 보관됩니다.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Supabase URL</label>
                <input
                  type="text"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Supabase Anon Key</label>
                <input
                  type="password"
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsIn..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Data Reset Section */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleResetData}
              className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 font-semibold transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              기본 샘플 데이터로 초기화
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95"
          >
            설정 저장하기
          </button>
        </div>
      </div>
    </div>
  );
};
