/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  ChevronLeft, 
  ArrowLeft,
  Home,
  Sparkles, 
  RefreshCw, 
  Heart, 
  MessageSquareQuote, 
  CheckCircle2, 
  Compass, 
  Clock, 
  AlertCircle, 
  ShieldCheck,
  Calendar,
  BookMarked,
  ArrowRight,
  Edit3,
  Trash2,
  Save,
  Sliders,
  Check,
  X,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatSession, ChatMessage, CharacterMemorySummary, WorldBookEntry } from '../lib/types';
import { dbInstance } from '../lib/db';
import { generateCharacterMemoryAppSummary } from '../lib/api';

interface MemoryAppViewProps {
  onHome: () => void;
}

// Avatar renderer supporting base64/URL images, emojis, or styled fallback
const renderAvatar = (avatar: string, name: string, sizeClass = "w-10 h-10 text-base") => {
  if (avatar && (avatar.startsWith('data:') || avatar.startsWith('http'))) {
    return (
      <img src={avatar} alt={name} className={`${sizeClass} rounded-2xl object-cover border border-slate-200 shrink-0`} />
    );
  }
  const display = (avatar && avatar.length <= 4) ? avatar : '👤';
  return (
    <div className={`${sizeClass} rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0 select-none`}>
      <span>{display}</span>
    </div>
  );
};

export default function MemoryAppView({ onHome }: MemoryAppViewProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Editable memory fields state
  const [editRelationshipView, setEditRelationshipView] = useState<string>('');
  const [editInnerThoughts, setEditInnerThoughts] = useState<string>('');
  const [editWordsToUser, setEditWordsToUser] = useState<string>('');
  const [editImportantMemories, setEditImportantMemories] = useState<string>('');
  const [editChatImpressions, setEditChatImpressions] = useState<string>('');

  // Editing historical memory entry state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryText, setEditingEntryText] = useState<string>('');

  // Large Detail Modal state for historical memory entry
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<{ id: string; date: string; summary: string; timestamp: number } | null>(null);
  const [modalEditText, setModalEditText] = useState<string>('');
  const [syncType, setSyncType] = useState<'dynamic' | 'static'>('dynamic');
  const [isSyncingToWb, setIsSyncingToWb] = useState<boolean>(false);

  // Memory parameter settings state per character
  const [autoSummaryThreshold, setAutoSummaryThreshold] = useState<number>(50);
  const [summaryMsgCount, setSummaryMsgCount] = useState<number>(100);
  const [retentionDays, setRetentionDays] = useState<number>(15);
  const [deleteMemoryEntryId, setDeleteMemoryEntryId] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load active character sessions
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const allSessions = await dbInstance.getAllSessions();
        const active = allSessions.filter(s => !s.isGroup && !s.isContactDeleted);
        setSessions(active);
      } catch (err) {
        console.error('Failed to load sessions in MemoryAppView:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Reload messages and sync memory editing states when selected character changes
  useEffect(() => {
    if (!selectedCharId) return;
    const current = sessions.find(s => s.id === selectedCharId);
    if (current) {
      const mem = current.memoryAppSummary;
      setEditRelationshipView(mem?.relationshipView || '');
      setEditInnerThoughts(mem?.innerThoughts || '');
      setEditWordsToUser(mem?.wordsToUser || '');
      setEditImportantMemories((mem?.importantMemories || []).join('\n'));
      setEditChatImpressions(mem?.chatImpressions || '');

      setAutoSummaryThreshold(current.autoSummaryMsgThreshold ?? 50);
      setSummaryMsgCount(current.summaryMsgCount ?? 100);
      setRetentionDays(current.memoryRetentionDays ?? 15);
    }

    const fetchCharMessages = async () => {
      try {
        const msgs = await dbInstance.getMessages(selectedCharId);
        setMessages(msgs || []);
      } catch (e) {
        console.error('Failed to load messages for character:', e);
      }
    };
    fetchCharMessages();
  }, [selectedCharId, sessions]);

  const currentSession = sessions.find(s => s.id === selectedCharId);

  // Trigger AI summary generation
  const handleGenerateMemory = async (sessionToUse?: ChatSession) => {
    const targetSession = sessionToUse || currentSession;
    if (!targetSession) return;

    setIsSummarizing(true);
    try {
      const summary = await generateCharacterMemoryAppSummary(targetSession, messages);
      
      const updatedSession: ChatSession = {
        ...targetSession,
        memoryAppSummary: summary
      };

      await dbInstance.saveSession(updatedSession);

      // Update local state
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
      setEditRelationshipView(summary.relationshipView || '');
      setEditInnerThoughts(summary.innerThoughts || '');
      setEditWordsToUser(summary.wordsToUser || '');
      setEditImportantMemories((summary.importantMemories || []).join('\n'));
      setEditChatImpressions(summary.chatImpressions || '');

      showToast(`已成功让【${targetSession.characterName}】自动归纳并保存最新记忆`, 'success');
    } catch (err: any) {
      console.error('Failed to generate memory app summary:', err);
      showToast(err?.message || '整理记忆失败，请检查网络设置', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Save edited character memory
  const handleSyncEntryToWorldBook = async (entry: { id: string; date: string; summary: string; timestamp: number }) => {
    if (!currentSession) return;
    setIsSyncingToWb(true);
    try {
      const charRealName = currentSession.realName || '';
      const charName = currentSession.characterName.split('的')[0].split('（')[0].split('(')[0].trim();
      const primaryName = charRealName || charName;
      const summaryText = modalEditText.trim() || entry.summary;

      // AI/Auto-extract smart keywords
      const candidateKeywords = [primaryName, charName, '记忆', '约定'];
      const matches = summaryText.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
      const filteredMatches = matches.filter(m => !['总结', '记录', '人类', '用户', '角色', '可以', '这个', '我们', '自己'].includes(m));
      const uniqueKeywords = Array.from(new Set([...candidateKeywords, ...filteredMatches.slice(0, 3)])).filter(Boolean);
      const keywordsStr = uniqueKeywords.join(', ');

      const wbConfig = await dbInstance.getWorldBookConfig();
      if (!wbConfig.folders) wbConfig.folders = [];

      let charFolder = wbConfig.folders.find(
        f => f.characterId === currentSession.id || f.name === `${primaryName} 的记忆` || f.name === primaryName
      );

      if (!charFolder) {
        charFolder = {
          id: 'folder_char_' + Date.now(),
          name: `${primaryName} 的记忆`,
          isActive: true,
          characterId: currentSession.id,
          characterName: primaryName,
          createdAt: Date.now()
        };
        wbConfig.folders = [charFolder, ...wbConfig.folders];
      }

      const newWbEntry: WorldBookEntry = {
        id: 'wb_mem_' + Date.now(),
        title: `【记忆片段】${primaryName} (${entry.date})`,
        keywords: keywordsStr,
        content: summaryText,
        isActive: true,
        characterId: currentSession.id,
        characterName: primaryName,
        folderId: charFolder.id,
        entryType: syncType
      };

      wbConfig.entries = [newWbEntry, ...(wbConfig.entries || [])];
      await dbInstance.saveWorldBookConfig(wbConfig);

      const typeLabel = syncType === 'static' ? '常驻背景' : '关键词触发';
      showToast(`🎉 已成功同步至世界书【${charFolder.name}】（${typeLabel}）！`, 'success');
      setSelectedDetailEntry(null);
    } catch (err) {
      console.error('Failed to sync memory to world book:', err);
      showToast('同步至世界书失败，请重试', 'error');
    } finally {
      setIsSyncingToWb(false);
    }
  };

  // Save modal edited entry text only (without syncing to WorldBook)
  const handleSaveModalEntry = async () => {
    if (!currentSession || !selectedDetailEntry) return;
    try {
      const textToSave = modalEditText.trim();
      if (!textToSave) {
        showToast('记忆内容不能为空', 'error');
        return;
      }
      const updatedEntries = (currentSession.memoryEntries || []).map(m => {
        if (m.id === selectedDetailEntry.id) {
          return { ...m, summary: textToSave };
        }
        return m;
      });

      const updatedSession: ChatSession = {
        ...currentSession,
        memoryEntries: updatedEntries
      };

      await dbInstance.saveSession(updatedSession);
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
      setSelectedDetailEntry(null);
      showToast('记忆片段已保存', 'success');
    } catch (e) {
      console.error('Failed to save memory entry:', e);
      showToast('保存记忆片段失败，请重试', 'error');
    }
  };

  // Save edited character memory
  const handleSaveMemory = async () => {
    if (!currentSession) return;
    try {
      const importantArray = editImportantMemories
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const updatedSummary: CharacterMemorySummary = {
        characterId: currentSession.id,
        relationshipView: editRelationshipView,
        innerThoughts: editInnerThoughts,
        wordsToUser: editWordsToUser,
        importantMemories: importantArray,
        chatImpressions: editChatImpressions,
        lastUpdated: Date.now()
      };

      const updatedSession: ChatSession = {
        ...currentSession,
        memoryAppSummary: updatedSummary,
        autoSummaryMsgThreshold: autoSummaryThreshold,
        summaryMsgCount: summaryMsgCount,
        memoryRetentionDays: retentionDays
      };

      await dbInstance.saveSession(updatedSession);
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
      setIsEditing(false);
      showToast(`【${currentSession.characterName}】的记忆与配置已保存`, 'success');
    } catch (e) {
      console.error('Failed to save memory:', e);
      showToast('保存记忆失败，请重试', 'error');
    }
  };

  // Quick save parameter settings
  const handleSaveSettingsOnly = async (thresh: number, windowSize: number, days: number) => {
    if (!currentSession) return;
    try {
      const updatedSession: ChatSession = {
        ...currentSession,
        autoSummaryMsgThreshold: thresh,
        summaryMsgCount: windowSize,
        memoryRetentionDays: days
      };
      await dbInstance.saveSession(updatedSession);
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
      showToast('记忆配置参数已更新', 'info');
    } catch (e) {
      console.error('Failed to save memory settings:', e);
    }
  };

  // Edit / Delete single historical memory card entry
  const handleSaveEntryEdit = async (entryId: string) => {
    if (!currentSession) return;
    const newText = editingEntryText.trim();
    if (!newText) return;

    const updatedEntries = (currentSession.memoryEntries || []).map(e => 
      e.id === entryId ? { ...e, summary: newText } : e
    );

    const updatedSession: ChatSession = {
      ...currentSession,
      memoryEntries: updatedEntries
    };

    try {
      await dbInstance.saveSession(updatedSession);
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
      setEditingEntryId(null);
      showToast('已保存对该历史记忆片段的修改', 'success');
    } catch (e) {
      console.error('Failed to update memory entry:', e);
      showToast('保存修改失败', 'error');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!currentSession) return;
    setDeleteMemoryEntryId(entryId);
  };

  const confirmDeleteEntry = async () => {
    if (!currentSession || !deleteMemoryEntryId) return;
    const entryId = deleteMemoryEntryId;
    const updatedEntries = (currentSession.memoryEntries || []).filter(e => e.id !== entryId);

    const updatedSession: ChatSession = {
      ...currentSession,
      memoryEntries: updatedEntries
    };

    try {
      await dbInstance.saveSession(updatedSession);
      setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
      showToast('已删除该条历史记忆片段', 'info');
    } catch (e) {
      console.error('Failed to delete memory entry:', e);
      showToast('删除失败', 'error');
    } finally {
      setDeleteMemoryEntryId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6 space-y-3 font-sans">
        <div className="w-9 h-9 border-3 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin" />
        <span className="text-xs text-slate-500 font-bold tracking-wider">正在调取记忆数据...</span>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: CHARACTER SELECTION LIST VIEW (同桌面其他APP一律先选角色)
  // =========================================================================
  if (!selectedCharId) {
    return (
      <div className="flex-1 bg-slate-50 text-slate-900 flex flex-col overflow-hidden font-sans select-none relative">
        
        {/* TOP HEADER BAR */}
        <div className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 flex items-center justify-between shrink-0 z-10 shadow-xs">
          <div className="flex items-center space-x-3">
            <button
              onClick={onHome}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shrink-0"
              title="返回桌面"
            >
              <Home size={16} className="stroke-[2.5]" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-xs shrink-0">
                <Brain size={16} className="text-white stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 leading-none">记忆总结</h2>
                <p className="text-[10px] font-sans text-slate-400 uppercase mt-1">Memory &amp; Persona Profiles</p>
              </div>
            </div>
          </div>
        </div>

        {/* CHARACTER LIST CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-500 px-1 flex items-center justify-between">
              <span>选择 AI 角色查看与编辑记忆 ({sessions.length})</span>
            </div>

            {sessions.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2 shadow-xs">
                <Brain size={40} className="text-slate-400 mx-auto" />
                <p className="text-xs text-slate-600 font-bold">暂无接入的 AI 角色</p>
                <p className="text-[11px] text-slate-400">请先在通讯录或聊天中添加角色</p>
                <button
                  onClick={onHome}
                  className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  返回桌面
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {sessions.map(session => {
                  const hasMem = session.memoryAppSummary && (
                    session.memoryAppSummary.relationshipView ||
                    session.memoryAppSummary.innerThoughts ||
                    session.memoryAppSummary.wordsToUser ||
                    session.memoryAppSummary.chatImpressions
                  );
                  const days = session.memoryRetentionDays ?? 15;

                  return (
                    <div
                      key={session.id}
                      onClick={() => setSelectedCharId(session.id)}
                      className="p-4 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-indigo-400/60 rounded-2xl flex items-center justify-between cursor-pointer transition-all duration-200 shadow-xs hover:shadow-md group"
                    >
                      <div className="flex items-center space-x-3.5 min-w-0">
                        {renderAvatar(session.characterAvatar, session.characterName, "w-12 h-12 text-xl")}
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                              {session.characterName}
                            </h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold shrink-0">
                              保留 {days} 天
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {hasMem ? session.memoryAppSummary?.relationshipView : (session.memory || '点击进入管理角色 5 维长期记忆')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 text-xs font-bold text-indigo-600 pl-3 shrink-0">
                        <span>管理记忆</span>
                        <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    );
  }

  // =========================================================================
  // VIEW 2: SELECTED CHARACTER MEMORY DETAILS & EDITING VIEW (LIGHT THEME)
  // =========================================================================
  const memorySummary = currentSession?.memoryAppSummary;
  const currRetentionDays = retentionDays;
  const lastUpdated = memorySummary?.lastUpdated || Date.now();

  const ageMs = Date.now() - lastUpdated;
  const ageDays = ageMs / (1000 * 3600 * 24);
  const remainingDays = Math.max(0, Math.ceil(currRetentionDays - ageDays));
  const fadeRatio = Math.min(1, ageDays / currRetentionDays);

  let fadeStatus: 'fresh' | 'fading' | 'expired' = 'fresh';
  if (fadeRatio > 1) {
    fadeStatus = 'expired';
  } else if (fadeRatio >= 0.5) {
    fadeStatus = 'fading';
  }

  const cardOpacity = fadeStatus === 'expired' ? 0.6 : fadeStatus === 'fading' ? 0.88 : 1.0;

  const hasAnyMemory = !!(
    memorySummary &&
    (memorySummary.relationshipView ||
      memorySummary.innerThoughts ||
      memorySummary.wordsToUser ||
      (memorySummary.importantMemories && memorySummary.importantMemories.length > 0) ||
      memorySummary.chatImpressions)
  );

  return (
    <div className="flex-1 bg-slate-50 text-slate-900 flex flex-col overflow-hidden font-sans select-none relative">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`absolute top-14 left-4 right-4 z-50 p-3 rounded-2xl shadow-lg border text-xs font-bold flex items-center justify-between ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : toast.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}
          >
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- TOP HEADER BAR --- */}
      <div className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 flex items-center justify-between shrink-0 z-10 shadow-xs">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSelectedCharId(null);
              setIsEditing(false);
            }}
            className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shrink-0"
            title="返回角色列表"
          >
            <ArrowLeft size={16} className="stroke-[2.5]" />
          </button>
          <div className="flex items-center space-x-2">
            {renderAvatar(currentSession?.characterAvatar || '', currentSession?.characterName || '', "w-7 h-7 text-xs")}
            <h1 className="text-sm font-black text-slate-900 tracking-tight">
              {currentSession?.characterName} 的记忆
            </h1>
          </div>
        </div>

        {/* TOP CONTROLS: ORGANIZE */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleGenerateMemory()}
            disabled={isSummarizing}
            className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="让AI角色重新整理归纳记忆"
          >
            <RefreshCw size={13} className={isSummarizing ? 'animate-spin' : ''} />
            <span>{isSummarizing ? '整理中...' : '整理'}</span>
          </button>
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* MEMORY CONFIGURATION & PARAMETERS CARD */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Sliders size={16} />
              </div>
              <h3 className="text-xs font-black text-slate-900">记忆积累与周期设置</h3>
            </div>
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
            >
              {showSettingsDrawer ? '收起配置' : '调整参数'}
            </button>
          </div>

          {/* Retention Activity Status */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>
                {fadeStatus === 'fresh' && (
                  <span className="text-emerald-600 flex items-center space-x-1">
                    <ShieldCheck size={14} />
                    <span>记忆结构清晰</span>
                  </span>
                )}
                {fadeStatus === 'fading' && (
                  <span className="text-amber-600 flex items-center space-x-1">
                    <AlertCircle size={14} />
                    <span>记忆渐忘中 (剩 {remainingDays} 天)</span>
                  </span>
                )}
                {fadeStatus === 'expired' && (
                  <span className="text-rose-600 flex items-center space-x-1">
                    <Clock size={14} />
                    <span>记忆已淡出</span>
                  </span>
                )}
              </span>

              <span className="text-slate-400 font-mono text-[11px]">
                保留: {currRetentionDays} 天 / 活性 {Math.max(0, Math.round((1 - fadeRatio) * 100))}%
              </span>
            </div>

            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  fadeStatus === 'fresh'
                    ? 'bg-gradient-to-r from-emerald-500 to-indigo-500'
                    : fadeStatus === 'fading'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.max(5, Math.round((1 - fadeRatio) * 100))}%` }}
              />
            </div>
          </div>

          {/* PARAMETER SETTINGS DRAWER */}
          {showSettingsDrawer && (
            <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-200">
              
              {/* 1. 自动整理门槛 (条消息后自动整理) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>自动整理触发门槛</span>
                  <span className="text-indigo-600 font-mono">{autoSummaryThreshold} 条消息</span>
                </div>
                <p className="text-[11px] text-slate-400">积累多少条新对话后AI自动梳理保存记忆（默认50条）</p>
                <div className="flex items-center space-x-2 pt-1">
                  {[20, 50, 100, 200].map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        setAutoSummaryThreshold(val);
                        handleSaveSettingsOnly(val, summaryMsgCount, retentionDays);
                      }}
                      className={`flex-1 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        autoSummaryThreshold === val
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {val}条
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. 单次总结提取消息量 (提取最新多少条) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>单次总结提取消息量</span>
                  <span className="text-indigo-600 font-mono">{summaryMsgCount} 条消息</span>
                </div>
                <p className="text-[11px] text-slate-400">总结提取最新多少条对话作为记忆分析范围（默认100条）</p>
                <div className="flex items-center space-x-2 pt-1">
                  {[30, 50, 100, 200].map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        setSummaryMsgCount(val);
                        handleSaveSettingsOnly(autoSummaryThreshold, val, retentionDays);
                      }}
                      className={`flex-1 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        summaryMsgCount === val
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {val}条
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. 保留天数 (记忆在多少天内有效) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>记忆保留天数</span>
                  <span className="text-indigo-600 font-mono">{retentionDays} 天</span>
                </div>
                <p className="text-[11px] text-slate-400">记忆在多少天内保持有效，超过天数后将渐渐淡忘（默认15天）</p>
                <div className="flex items-center space-x-2 pt-1">
                  {[7, 15, 30, 60].map(val => (
                    <button
                      key={val}
                      onClick={() => {
                        setRetentionDays(val);
                        handleSaveSettingsOnly(autoSummaryThreshold, summaryMsgCount, val);
                      }}
                      className={`flex-1 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        retentionDays === val
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {val}天
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* EDIT / VIEW MODE INDICATOR */}
        {isEditing && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 flex items-center justify-between text-xs text-indigo-900 shadow-xs">
            <span className="font-bold flex items-center space-x-1.5">
              <Edit3 size={15} className="text-indigo-600" />
              <span>当前处于记忆编辑模式，完成编辑后请点击下方保存按钮</span>
            </span>
          </div>
        )}

        {/* 5 ITEMIZATION CATEGORIES OF AI CHARACTER MEMORY */}
        <div 
          className="space-y-3.5 transition-opacity duration-500"
          style={{ opacity: cardOpacity }}
        >
          {fadeStatus === 'expired' && !isEditing && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-center justify-between text-xs text-rose-800">
              <span className="font-bold flex items-center space-x-1.5">
                <AlertCircle size={15} className="text-rose-600" />
                <span>角色记忆已过到期限，点击刷新可唤醒记忆。</span>
              </span>
              <button
                onClick={() => handleGenerateMemory()}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-xs cursor-pointer"
              >
                刷新唤醒
              </button>
            </div>
          )}

          {/* ITEM 1: 看待我们的关系 */}
          <div className="bg-rose-50/60 border border-rose-200/70 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                  <Heart size={16} />
                </div>
                <h4 className="text-xs font-black text-rose-950">
                  看待我们的关系
                </h4>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-7 h-7 rounded-xl bg-rose-100/80 hover:bg-rose-200 text-rose-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                  title="编辑此类目记忆"
                >
                  <Edit3 size={13} />
                </button>
              )}
            </div>

            {isEditing ? (
              <textarea
                value={editRelationshipView}
                onChange={(e) => setEditRelationshipView(e.target.value)}
                placeholder="在此手动编辑角色看待你们关系的内存认知..."
                rows={3}
                className="w-full text-xs text-slate-800 p-3 bg-white rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400 font-sans"
              />
            ) : (
              <p className="text-xs text-slate-800 leading-relaxed bg-white/80 p-3 rounded-xl border border-rose-100 min-h-[44px]">
                {editRelationshipView || <span className="text-slate-400 italic">保持空白 (可点击右侧图标编辑或点击上方“整理”让AI归纳)</span>}
              </p>
            )}
          </div>

          {/* ITEM 2: 最新内心想法 */}
          <div className="bg-purple-50/60 border border-purple-200/70 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <Sparkles size={16} />
                </div>
                <h4 className="text-xs font-black text-purple-950">
                  最新内心想法
                </h4>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-7 h-7 rounded-xl bg-purple-100/80 hover:bg-purple-200 text-purple-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                  title="编辑此类目记忆"
                >
                  <Edit3 size={13} />
                </button>
              )}
            </div>

            {isEditing ? (
              <textarea
                value={editInnerThoughts}
                onChange={(e) => setEditInnerThoughts(e.target.value)}
                placeholder="在此手动编辑角色最新内心小秘密想法..."
                rows={3}
                className="w-full text-xs text-slate-800 p-3 bg-white rounded-xl border border-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-400 font-sans"
              />
            ) : (
              <p className="text-xs text-slate-800 leading-relaxed bg-white/80 p-3 rounded-xl border border-purple-100 min-h-[44px]">
                {editInnerThoughts || <span className="text-slate-400 italic">保持空白 (可点击右侧图标编辑或点击上方“整理”让AI归纳)</span>}
              </p>
            )}
          </div>

          {/* ITEM 3: 想对我（用户）说的话 */}
          <div className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <MessageSquareQuote size={16} />
                </div>
                <h4 className="text-xs font-black text-amber-950">
                  想对我说的话
                </h4>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-7 h-7 rounded-xl bg-amber-100/80 hover:bg-amber-200 text-amber-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                  title="编辑此类目记忆"
                >
                  <Edit3 size={13} />
                </button>
              )}
            </div>

            {isEditing ? (
              <textarea
                value={editWordsToUser}
                onChange={(e) => setEditWordsToUser(e.target.value)}
                placeholder="在此手动编辑角色想对你说的心里话..."
                rows={3}
                className="w-full text-xs text-slate-800 p-3 bg-white rounded-xl border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 font-sans"
              />
            ) : (
              <p className="text-xs text-amber-950 leading-relaxed bg-white/80 p-3 rounded-xl border border-amber-100 min-h-[44px]">
                {editWordsToUser ? `“${editWordsToUser}”` : <span className="text-slate-400 italic font-normal">保持空白 (可点击右侧图标编辑或点击上方“整理”让AI归纳)</span>}
              </p>
            )}
          </div>

          {/* ITEM 4: 被记住的重要事情 */}
          <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 size={16} />
                </div>
                <h4 className="text-xs font-black text-emerald-950">
                  被记住的重要事情
                </h4>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-7 h-7 rounded-xl bg-emerald-100/80 hover:bg-emerald-200 text-emerald-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                  title="编辑此类目记忆"
                >
                  <Edit3 size={13} />
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400">请按行输入要让角色记住的重点细节或约定（每行一条）</p>
                <textarea
                  value={editImportantMemories}
                  onChange={(e) => setEditImportantMemories(e.target.value)}
                  placeholder="约定好下周末一起去图书馆&#10;记得用户对海鲜过敏&#10;喜欢听轻音乐"
                  rows={4}
                  className="w-full text-xs text-slate-800 p-3 bg-white rounded-xl border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-sans"
                />
              </div>
            ) : (
              <div className="space-y-1.5 min-h-[44px]">
                {editImportantMemories && editImportantMemories.trim().length > 0 ? (
                  editImportantMemories
                    .split('\n')
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start space-x-2 bg-white/80 p-2.5 rounded-xl border border-emerald-100 text-xs text-slate-800"
                      >
                        <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{item}</span>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-slate-400 italic p-2 bg-white/80 rounded-xl border border-emerald-100">
                    保持空白 (可点击右侧图标编辑或点击上方“整理”让AI归纳)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ITEM 5: 对和我聊天的看法 */}
          <div className="bg-sky-50/60 border border-sky-200/70 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                  <Compass size={16} />
                </div>
                <h4 className="text-xs font-black text-sky-950">
                  对和我聊天的看法
                </h4>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-7 h-7 rounded-xl bg-sky-100/80 hover:bg-sky-200 text-sky-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                  title="编辑此类目记忆"
                >
                  <Edit3 size={13} />
                </button>
              )}
            </div>

            {isEditing ? (
              <textarea
                value={editChatImpressions}
                onChange={(e) => setEditChatImpressions(e.target.value)}
                placeholder="在此手动编辑角色对与你聊天的直接看点..."
                rows={3}
                className="w-full text-xs text-slate-800 p-3 bg-white rounded-xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400 font-sans"
              />
            ) : (
              <p className="text-xs text-slate-800 leading-relaxed bg-white/80 p-3 rounded-xl border border-sky-100 min-h-[44px]">
                {editChatImpressions || <span className="text-slate-400 italic">保持空白 (可点击右侧图标编辑或点击上方“整理”让AI归纳)</span>}
              </p>
            )}
          </div>

        </div>

        {/* SAVE BUTTON AT BOTTOM FOR EDITING */}
        {isEditing && (
          <div className="pt-2">
            <button
              onClick={handleSaveMemory}
              className="w-full h-11 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Save size={16} />
              <span>保存</span>
            </button>
          </div>
        )}

        {/* HISTORICAL MEMORY CARDS */}
        {currentSession?.memoryEntries && currentSession.memoryEntries.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-slate-500 flex items-center space-x-1 px-1">
              <BookMarked size={14} className="text-indigo-600" />
              <span>历史记忆片段 ({currentSession.memoryEntries.length})</span>
            </div>

            <div className="space-y-2">
              {currentSession.memoryEntries.map(entry => {
                const entryAgeMs = Date.now() - entry.timestamp;
                const entryAgeDays = entryAgeMs / (1000 * 3600 * 24);
                const isValid = entryAgeDays <= currRetentionDays;
                const cardRemDays = Math.max(0, Math.ceil(currRetentionDays - entryAgeDays));
                const isEditingThis = editingEntryId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className={`p-3 rounded-xl border transition-all ${
                      isValid
                        ? 'bg-white border-slate-200 text-slate-800 shadow-xs'
                        : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                      <span className="text-indigo-600 flex items-center space-x-1">
                        <Calendar size={12} />
                        <span>[{entry.date}] 24h总结</span>
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className={isValid ? 'text-emerald-600' : 'text-slate-400'}>
                          {isValid ? `剩 ${cardRemDays} 天` : '已淡忘'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEntry(entry.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                          title="删除记忆片段"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {isEditingThis ? (
                      <div className="space-y-2 pt-1">
                        <textarea
                          value={editingEntryText}
                          onChange={(e) => setEditingEntryText(e.target.value)}
                          rows={3}
                          className="w-full text-xs text-slate-800 p-2.5 bg-slate-50 border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans leading-relaxed"
                          placeholder="编辑该条记忆片段内容..."
                        />
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => setEditingEntryId(null)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEntryEdit(entry.id)}
                            disabled={!editingEntryText.trim()}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md transition-colors cursor-pointer shadow-xs"
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 pt-0.5">
                        <p
                          onClick={() => {
                            setSelectedDetailEntry(entry);
                            setModalEditText(entry.summary);
                          }}
                          className="text-xs leading-relaxed cursor-pointer hover:text-indigo-900 transition-colors line-clamp-3"
                          title="点击展开大弹窗进行编辑或同步"
                        >
                          {entry.summary}
                        </p>
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDetailEntry(entry);
                              setModalEditText(entry.summary);
                            }}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md transition-colors"
                          >
                            <FileText size={11} />
                            <span>展开编辑</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* LARGE DETAIL MODAL FOR MEMORY ENTRY & SYNC TO WORLD BOOK */}
      <AnimatePresence>
        {selectedDetailEntry && currentSession && (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <div className="flex items-center space-x-3">
                  {renderAvatar(currentSession.characterAvatar || '', currentSession.characterName, "w-10 h-10 text-base")}
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 flex items-center space-x-1.5">
                      <span>{currentSession.characterName}</span>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-bold border border-indigo-100">
                        记忆详情大卡片
                      </span>
                    </h3>
                    <div className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                      <Calendar size={11} />
                      <span>归纳节点日期: {selectedDetailEntry.date}</span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetailEntry(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content Body */}
              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                  <div className="text-[11px] font-bold text-indigo-900 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Brain size={14} className="text-indigo-600" />
                      <span>记忆摘要</span>
                    </span>
                    <span className="text-[10px] text-indigo-600 font-mono">
                      {new Date(selectedDetailEntry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <textarea
                    value={modalEditText}
                    onChange={(e) => setModalEditText(e.target.value)}
                    rows={5}
                    className="w-full text-xs text-slate-800 leading-relaxed font-sans bg-white p-3.5 rounded-xl border border-indigo-200/80 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 shadow-xs resize-y min-h-[110px]"
                    placeholder="可直接在此编辑修改此条历史记忆摘要内容..."
                  />
                </div>

                {/* Sync Target Selection */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                  <div className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                    <span className="flex items-center space-x-1">
                      <Sparkles size={14} className="text-amber-600" />
                      <span>同步至世界书的注入类型</span>
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSyncType('dynamic')}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        syncType === 'dynamic'
                          ? 'bg-[#FEE500] text-[#3C1E1E] border-[#FEE500] shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>🔑 关键词触发</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSyncType('static')}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        syncType === 'static'
                          ? 'bg-[#FEE500] text-[#3C1E1E] border-[#FEE500] shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>📌 常驻背景</span>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    {syncType === 'dynamic' 
                      ? 'AI会自动提取关键词，对话中出现对应关键词时才动态载入此记忆。' 
                      : '无需触发词，此记忆将作为常驻背景直接注入 AI 脑海。'}
                  </p>
                </div>

                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 text-[11px] text-amber-900 space-y-1.5">
                  <div className="font-bold flex items-center space-x-1.5 text-amber-800">
                    <Sparkles size={14} className="text-amber-600" />
                    <span>同步至世界书联动说明</span>
                  </div>
                  <p className="text-amber-800/90 leading-relaxed">
                    点击【同步至世界书】，系统将自动存入世界书的【{currentSession.characterName}】专属文件夹中。若只需更新记忆文本，直接点击【保存】即可。
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveModalEntry}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <Save size={13} />
                  <span>保存</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncEntryToWorldBook(selectedDetailEntry)}
                  disabled={isSyncingToWb}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  <BookMarked size={14} />
                  <span>{isSyncingToWb ? '同步中...' : '同步至世界书'}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteMemoryEntryId && (
          <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200"
            >
              <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除历史记忆片段</h3>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要删除这条历史记忆片段吗？删除后不可恢复。</p>
              <div className="flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteMemoryEntryId(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteEntry}
                  className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
