/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Brain, X, Zap, Calendar, Trash, Edit, Check, Clock, Plus, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { ChatSession, ChatMessage, MemoryEntry } from '../lib/types';
import { generate24HourMemorySummary } from '../lib/api';

interface LongTermMemoryModalProps {
  session: ChatSession;
  messages: ChatMessage[];
  onClose: () => void;
  onSave: (updatedSession: ChatSession) => Promise<void>;
}

export const LongTermMemoryModal: React.FC<LongTermMemoryModalProps> = ({
  session,
  messages,
  onClose,
  onSave,
}) => {
  const [enabled, setEnabled] = useState<boolean>(session.longTermMemoryEnabled ?? true);
  const [retentionDays, setRetentionDays] = useState<number>(session.memoryRetentionDays ?? 30);
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>(session.memoryEntries || []);
  const [backdropMemory, setBackdropMemory] = useState<string>(session.memory || '');

  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingEntryText, setEditingEntryText] = useState<string>('');
  
  const [showAddManual, setShowAddManual] = useState<boolean>(false);
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [manualText, setManualText] = useState<string>('');
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg(null);
    }, 3000);
  };

  // Helper to check if a memory entry timestamp is within retention period
  const isEntryValid = (timestamp: number) => {
    const cutoff = Date.now() - retentionDays * 24 * 3600 * 1000;
    return timestamp >= cutoff;
  };

  // Filter messages for the last 24 hours
  const messages24h = messages.filter(m => {
    if (m.chatId !== session.id) return false;
    if (m.isRecalled) return false;
    return m.timestamp >= Date.now() - 24 * 3600 * 1000;
  });

  // Handle Instant 24-Hour Summarization
  const handleSummarize24Hours = async () => {
    if (messages24h.length === 0) {
      showToast('最近 24 小时内暂无新的聊天记录可供总结。', 'info');
      return;
    }

    setIsSummarizing(true);
    try {
      const summaryText = await generate24HourMemorySummary(
        session.characterName,
        messages24h
      );

      const todayStr = new Date().toISOString().split('T')[0];
      const newEntry: MemoryEntry = {
        id: `mem_${Date.now()}`,
        date: todayStr,
        summary: summaryText,
        timestamp: Date.now()
      };

      // Add to memory entries
      const updatedEntries = [newEntry, ...memoryEntries];
      setMemoryEntries(updatedEntries);

      // Append summary directly to the memory backdrop textarea
      const formattedAppend = `\n📅 [${todayStr} 24h记忆总结]: ${summaryText}`;
      const updatedBackdrop = backdropMemory.trim() ? `${backdropMemory.trim()}${formattedAppend}` : `📅 [${todayStr} 24h记忆总结]: ${summaryText}`;
      setBackdropMemory(updatedBackdrop);

      showToast('已成功总结最近24小时对话并整合至内存卡片及文本框！', 'success');
    } catch (err: any) {
      console.error('Failed to summarize 24h chat:', err);
      showToast(err?.message || '总结生成失败，请检查 API Key 配置。', 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Save changes to single entry
  const handleSaveEditedEntry = (id: string) => {
    if (!editingEntryText.trim()) return;
    setMemoryEntries(prev => prev.map(e => e.id === id ? { ...e, summary: editingEntryText.trim() } : e));
    setEditingEntryId(null);
    setEditingEntryText('');
    showToast('记忆卡片已更新', 'success');
  };

  // Delete single entry
  const handleDeleteEntry = (id: string) => {
    setDeleteEntryId(id);
  };

  // Add manual entry
  const handleAddManualEntry = () => {
    if (!manualText.trim()) return;
    const dateStr = manualDate || new Date().toISOString().split('T')[0];
    const newEntry: MemoryEntry = {
      id: `mem_manual_${Date.now()}`,
      date: dateStr,
      summary: manualText.trim(),
      timestamp: Date.now()
    };
    setMemoryEntries([newEntry, ...memoryEntries]);

    // Append to backdrop memory
    const formattedAppend = `\n📅 [${dateStr} 记忆]: ${manualText.trim()}`;
    setBackdropMemory(prev => prev.trim() ? `${prev.trim()}${formattedAppend}` : `📅 [${dateStr} 记忆]: ${manualText.trim()}`);

    setManualText('');
    setShowAddManual(false);
    showToast('手动记忆卡片添加成功', 'success');
  };

  // Re-sync all valid cards into memory text box
  const handleResyncCardsToText = () => {
    const validCards = memoryEntries.filter(e => isEntryValid(e.timestamp));
    if (validCards.length === 0) {
      showToast('当前暂无有效卡片可供重构。', 'info');
      return;
    }
    let resynced = backdropMemory.split(/\n📅 \[.*?记忆.*?\]:.*/g).join('').trim();
    validCards.forEach(c => {
      resynced += `\n📅 [${c.date} 记忆卡片]: ${c.summary}`;
    });
    setBackdropMemory(resynced.trim());
    showToast('已将当前所有有效卡片追加同步至下方背景文本框！', 'success');
  };

  // Purge expired cards
  const handlePurgeExpired = () => {
    const validOnly = memoryEntries.filter(e => isEntryValid(e.timestamp));
    const removedCount = memoryEntries.length - validOnly.length;
    setMemoryEntries(validOnly);
    showToast(`已清理 ${removedCount} 条过期的记忆卡片。`, 'info');
  };

  // Submit and Save
  const handleSaveModal = async () => {
    const updatedSession: ChatSession = {
      ...session,
      longTermMemoryEnabled: enabled,
      memoryRetentionDays: retentionDays,
      memoryEntries: memoryEntries,
      memory: backdropMemory
    };

    await onSave(updatedSession);
    onClose();
  };

  const validEntries = memoryEntries.filter(e => isEntryValid(e.timestamp));
  const expiredEntries = memoryEntries.filter(e => !isEntryValid(e.timestamp));

  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[9999] animate-in fade-in duration-200 select-none">
      <div className="bg-white rounded-3xl overflow-hidden w-full max-w-lg max-h-[90vh] text-slate-800 shadow-2xl relative border border-slate-200/80 flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 p-4 sm:p-5 text-white relative shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 backdrop-blur-md">
              <Brain size={20} className="text-purple-300 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide flex items-center space-x-2">
                <span>长期记忆神经网络中心</span>
              </h3>
              <p className="text-[11px] text-purple-200/80 mt-0.5">
                角色：<span className="font-semibold text-white">{session.characterName}</span> · 独立记忆设定与自动化提炼
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-all focus:outline-none cursor-pointer p-1.5 rounded-full hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toast alert banner inside modal */}
        {toastMsg && (
          <div className={`px-4 py-2 text-xs font-medium text-center flex items-center justify-center space-x-1.5 transition-all ${
            toastMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-b border-emerald-100' :
            toastMsg.type === 'error' ? 'bg-rose-50 text-rose-700 border-b border-rose-100' :
            'bg-purple-50 text-purple-700 border-b border-purple-100'
          }`}>
            <Sparkles size={13} />
            <span>{toastMsg.text}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 leading-relaxed text-xs">
          
          {/* SECTION 1: SYSTEM CONTROLS & RETENTION */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3.5">
            {/* Toggle Switch */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">长期记忆系统开关</span>
                <span className="text-[10px] text-slate-500">开启后将智能总结对话并作为神经突触记忆注入 AI 模型</span>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  enabled ? 'bg-[#8521bf] justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform" />
              </button>
            </div>

            {/* Retention Period Selection */}
            <div className="pt-3 border-t border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700 flex items-center">
                  <Clock size={12} className="text-[#8521bf] mr-1.5" />
                  记忆保留期限设置
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  超过期限自动淡忘
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: '最近 7 天', value: 7 },
                  { label: '最近 15 天', value: 15 },
                  { label: '最近 30 天', value: 30 }
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRetentionDays(opt.value)}
                    className={`py-2 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer text-center ${
                      retentionDays === opt.value
                        ? 'bg-[#8521bf] border-[#8521bf] text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SECTION 2: INSTANT 24H SUMMARY TRIGGER */}
          <div className="bg-purple-50/50 rounded-2xl p-4 border border-purple-100/80 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center">
                  <Zap size={14} className="text-[#8521bf] mr-1.5 fill-purple-100" />
                  24 小时对话智能总结
                </h4>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  提取过去 24 小时对话中的承诺、事实与情感细节并沉淀为记忆卡片。
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100/80 text-purple-700 text-[10px] font-semibold shrink-0">
                {messages24h.length} 条新消息
              </span>
            </div>

            <button
              type="button"
              disabled={isSummarizing}
              onClick={handleSummarize24Hours}
              className={`w-full py-2.5 px-4 rounded-xl font-medium text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs ${
                isSummarizing
                  ? 'bg-purple-200 text-purple-700 cursor-not-allowed'
                  : 'bg-[#8521bf] hover:opacity-90 active:scale-[0.99] text-white'
              }`}
            >
              {isSummarizing ? (
                <>
                  <RefreshCw size={14} className="animate-spin mr-1" />
                  <span>正在提炼最近 24 小时记忆...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>立即总结最近 24 小时对话</span>
                </>
              )}
            </button>
          </div>

          {/* SECTION 3: MEMORY CARDS BY DATE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Calendar size={14} className="text-slate-600" />
                <h4 className="text-xs font-bold text-slate-900">历史记忆片段 ({memoryEntries.length})</h4>
              </div>
              
              <div className="flex items-center space-x-1.5">
                {expiredEntries.length > 0 && (
                  <button
                    type="button"
                    onClick={handlePurgeExpired}
                    className="text-[10px] text-slate-500 hover:text-rose-600 font-medium cursor-pointer transition-colors"
                  >
                    清理淡忘卡片 ({expiredEntries.length})
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowAddManual(!showAddManual)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <Plus size={11} />
                  <span>手动卡片</span>
                </button>
              </div>
            </div>

            {/* Manual add card box */}
            {showAddManual && (
              <div className="bg-white border border-purple-200 rounded-2xl p-3.5 space-y-2.5 shadow-xs animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-900">手动追加日期记忆卡片</span>
                  <input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] text-slate-800 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <textarea
                  rows={2}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="如：约定了明晚去外滩看夜景..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white resize-none"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddManual(false)}
                    className="px-2.5 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleAddManualEntry}
                    className="px-3 py-1 bg-[#8521bf] hover:opacity-90 text-white font-medium text-[10px] rounded-lg cursor-pointer shadow-xs transition-colors"
                  >
                    追加卡片
                  </button>
                </div>
              </div>
            )}

            {/* Cards List */}
            {memoryEntries.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {memoryEntries.map(entry => {
                  const isValid = isEntryValid(entry.timestamp);
                  const isEditing = editingEntryId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-2xl border transition-all space-y-2 ${
                        isValid
                          ? 'bg-white border-slate-200/90 shadow-2xs hover:border-purple-300'
                          : 'bg-slate-50/60 border-slate-200/60 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 bg-slate-100 rounded-md font-mono text-[10px] font-semibold text-slate-700">
                            📅 {entry.date}
                          </span>
                          {isValid ? (
                            <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full font-medium">
                              保留中
                            </span>
                          ) : (
                            <span className="text-[9px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-medium">
                              已淡忘 (超过 {retentionDays} 天)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          {!isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingEntryId(entry.id);
                                  setEditingEntryText(entry.summary);
                                }}
                                className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                title="编辑"
                              >
                                <Edit size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="p-1 hover:bg-rose-50 rounded-md text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="删除"
                              >
                                <Trash size={12} />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSaveEditedEntry(entry.id)}
                              className="px-2 py-0.5 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium text-[10px] flex items-center space-x-0.5 cursor-pointer shadow-xs transition-colors"
                            >
                              <Check size={11} />
                              <span>完成</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <textarea
                          rows={2}
                          value={editingEntryText}
                          onChange={(e) => setEditingEntryText(e.target.value)}
                          className="w-full p-2 bg-slate-50 border border-purple-300 rounded-xl text-xs font-sans focus:outline-none focus:bg-white resize-none"
                        />
                      ) : (
                        <p className="text-xs text-slate-700 leading-relaxed font-sans pl-0.5">
                          {entry.summary}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 space-y-1">
                <AlertCircle size={20} className="mx-auto text-slate-400" />
                <p className="text-xs font-semibold text-slate-600">暂无总结的日期记忆卡片</p>
                <p className="text-[10px] text-slate-400">点击上方“立即总结最近 24 小时对话”可自动提炼</p>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSaveModal}
            className="flex-1 h-10 rounded-xl bg-[#8521bf] hover:opacity-90 active:scale-[0.99] text-white text-xs font-medium transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-md shadow-[#8521bf]/20"
          >
            <Check size={14} />
            <span>保存</span>
          </button>
        </div>

        {/* Delete Entry Confirmation Modal */}
        {deleteEntryId && (
          <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
              <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除长期记忆卡片</h3>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要删除这条长期记忆卡片吗？删除后不可恢复。</p>
              <div className="flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteEntryId(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMemoryEntries(prev => prev.filter(e => e.id !== deleteEntryId));
                    setDeleteEntryId(null);
                    showToast('已移除该条记忆卡片', 'info');
                  }}
                  className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
