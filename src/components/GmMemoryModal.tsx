import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Shield,
  Users,
  Target,
  Scroll,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  Sliders
} from 'lucide-react';
import { GmAdventureMemory } from '../lib/types';

interface GmMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  memory: GmAdventureMemory;
  onSave: (updated: GmAdventureMemory) => void;
  onAutoExtract: (currentLocalMemory?: GmAdventureMemory) => Promise<GmAdventureMemory | null | void>;
  isExtracting: boolean;
  sessionTitle: string;
}

type TabType = 'worldRules' | 'characterStates' | 'activeQuests' | 'majorChronicles';

export default function GmMemoryModal({
  isOpen,
  onClose,
  memory,
  onSave,
  onAutoExtract,
  isExtracting,
  sessionTitle
}: GmMemoryModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('worldRules');
  const [localMemory, setLocalMemory] = useState<GmAdventureMemory>(memory);
  const [newItemText, setNewItemText] = useState<string>('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalMemory(memory);
      setNewItemText('');
      setEditingIndex(null);
      setItemToDeleteIndex(null);
    }
  }, [isOpen]); // Fix: Only reset states when the modal opens, not on every memory prop change

  const handleExtractClick = async () => {
    if (isExtracting) return;
    try {
      const result = await onAutoExtract(localMemory);
      if (result) {
        setLocalMemory(result);
      }
    } catch (e) {
      console.error('Extract click error:', e);
    }
  };

  if (!isOpen) return null;

  const currentList = localMemory[activeTab] || [];

  const handleAddItem = () => {
    let text = newItemText.trim();
    if (!text) return;
    if (!text.startsWith('🔒')) {
      text = `🔒 ${text}`;
    }
    const updated = {
      ...localMemory,
      [activeTab]: [...(localMemory[activeTab] || []), text]
    };
    setLocalMemory(updated);
    setNewItemText('');
  };

  const confirmDeleteItem = () => {
    if (itemToDeleteIndex === null) return;
    const updatedList = currentList.filter((_, idx) => idx !== itemToDeleteIndex);
    const updated = {
      ...localMemory,
      [activeTab]: updatedList
    };
    setLocalMemory(updated);
    if (editingIndex === itemToDeleteIndex) {
      setEditingIndex(null);
    }
    setItemToDeleteIndex(null);
  };

  const handleStartEdit = (index: number, text: string) => {
    setEditingIndex(index);
    setEditingText(text);
  };

  const handleSaveEdit = (index: number) => {
    let text = editingText.trim();
    if (!text) return;
    if (!text.startsWith('🔒')) {
      text = `🔒 ${text}`;
    }
    const updatedList = [...currentList];
    updatedList[index] = text;
    const updated = {
      ...localMemory,
      [activeTab]: updatedList
    };
    setLocalMemory(updated);
    setEditingIndex(null);
  };

  const handleSaveAll = () => {
    // Merge latest memory prop with localMemory to guarantee no locked items or background additions are lost
    const mergeArrays = (localArr: string[] = [], parentArr: string[] = []): string[] => {
      const merged = [...localArr];
      for (const parentItem of parentArr) {
        if (!parentItem) continue;
        const isLocked = parentItem.startsWith('🔒') || parentItem.includes('🔒');
        if (isLocked && !merged.includes(parentItem)) {
          merged.push(parentItem);
        }
      }
      return merged;
    };

    const finalMergedMemory: GmAdventureMemory = {
      ...memory,
      ...localMemory,
      worldRules: mergeArrays(localMemory.worldRules, memory.worldRules),
      characterStates: mergeArrays(localMemory.characterStates, memory.characterStates),
      activeQuests: mergeArrays(localMemory.activeQuests, memory.activeQuests),
      majorChronicles: mergeArrays(localMemory.majorChronicles, memory.majorChronicles),
    };

    onSave(finalMergedMemory);
    onClose();
  };

  const tabsConfig = [
    {
      key: 'worldRules' as TabType,
      label: '世界法则与铁律',
      icon: Shield,
      desc: '不可打破的物理/魔法规则与世界禁忌（建议 5~8 条，保持精炼）',
      color: 'text-amber-500',
      badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
      suggestedTags: []
    },
    {
      key: 'characterStates' as TabType,
      label: '角色与NPC状态',
      icon: Users,
      desc: '主角状态及关键NPC存活/好感/伤情/位置（建议 8~12 条）',
      color: 'text-emerald-500',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      suggestedTags: ['[主角]', '[NPC:']
    },
    {
      key: 'activeQuests' as TabType,
      label: '主线与未决任务',
      icon: Target,
      desc: '进行中主线/支线/玩家自立动机/悬念线索（重点加权，建议 10~15 条）',
      color: 'text-sky-500',
      badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
      suggestedTags: ['[主线-进行中]', '[支线-进行中]', '[玩家动机]', '[关键线索]']
    },
    {
      key: 'majorChronicles' as TabType,
      label: '重大编年史',
      icon: Scroll,
      desc: '已发生的重大历史事件与不可逆既定事实（建议 10~15 条）',
      color: 'text-purple-500',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      suggestedTags: ['[大事件]']
    }
  ];

  const totalCount =
    (localMemory.worldRules?.length || 0) +
    (localMemory.characterStates?.length || 0) +
    (localMemory.activeQuests?.length || 0) +
    (localMemory.majorChronicles?.length || 0);

  const itemToDeleteText =
    itemToDeleteIndex !== null ? currentList[itemToDeleteIndex] : null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col h-full max-h-[96%] sm:max-h-[90%] overflow-hidden relative"
      >
        {/* Header (Unified height h-14 equivalent feel with nice padding) */}
        <div className="h-14 px-4 sm:px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
              <Brain size={16} className="stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black text-slate-800 truncate">GM 核心记忆库</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                  前置强约束 · 共 {totalCount} 条
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Banner Alert Explanation */}
        <div className="px-4 sm:px-6 py-2 bg-amber-50/80 border-b border-amber-100/80 flex items-center space-x-2 text-amber-800 text-[11px] font-medium shrink-0">
          <AlertCircle size={14} className="shrink-0 text-amber-600" />
          <span className="leading-snug">
            记忆库条目将在每回合作为最高优先级事实注入 GM，严格防止遗忘或剧情前后矛盾。
          </span>
        </div>

        {/* Interval Frequency Settings Bar - Horizontal above category selection */}
        <div className="px-4 sm:px-6 py-2 bg-slate-50/90 border-b border-slate-200/70 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 shrink-0">
            <Sliders size={13} className="text-indigo-600 shrink-0" />
            <label htmlFor="gm-summary-interval-select" className="text-xs font-bold text-slate-700 cursor-pointer whitespace-nowrap">
              自动提炼记忆频次
            </label>
          </div>
          <div className="flex-1 max-w-sm">
            <select
              id="gm-summary-interval-select"
              value={localMemory.summaryIntervalRounds || 6}
              onChange={(e) => setLocalMemory(prev => ({ ...prev, summaryIntervalRounds: Number(e.target.value) }))}
              className="w-full h-8 px-3 py-1 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all cursor-pointer shadow-xs"
            >
              <option value={8}>经济模式（8轮、适合长篇游玩）</option>
              <option value={6}>均衡模式（6轮、推荐默认模式）</option>
              <option value={4}>密集模式（4轮、适合剧情极密集反转）</option>
            </select>
          </div>
        </div>

        {/* 4 Category Tabs */}
        <div className="px-3 sm:px-6 pt-3 pb-2 border-b border-slate-100 bg-white grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const count = localMemory[tab.key]?.length || 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key);
                  setNewItemText('');
                  setEditingIndex(null);
                  setItemToDeleteIndex(null);
                }}
                className={`p-2 sm:p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <Icon size={14} className={isActive ? 'text-amber-400' : tab.color} />
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.2 rounded-full border ${
                      isActive
                        ? 'bg-slate-800 text-amber-300 border-slate-700'
                        : tab.badgeBg
                    }`}
                  >
                    {count}
                  </span>
                </div>
                <span className="text-[11px] sm:text-xs font-bold truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Description & Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4 bg-slate-50/40 min-h-0">
          {/* Active Tab Subtitle Guide */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold">
              {tabsConfig.find(t => t.key === activeTab)?.desc}
            </span>
            <span className="text-[11px] text-slate-400">
              当前分类条目 ({currentList.length})
            </span>
          </div>

          {/* Items Container */}
          <div className="space-y-2.5 min-h-[120px]">
            {currentList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                <Brain size={28} className="text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-500">暂无此项设定记录</p>
                <p className="text-[11px] text-slate-400">
                  可在下方添加或点击底部「一键提炼记忆」自动从剧情中梳理
                </p>
              </div>
            ) : (
              currentList.map((item, idx) => (
                <div
                  key={idx}
                  className="group bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-3.5 shadow-xs hover:border-indigo-200 transition-all flex items-start space-x-2.5 sm:space-x-3"
                >
                  <span className="w-5 h-5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 border border-slate-200">
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    {editingIndex === idx ? (
                      <div className="space-y-2">
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={2}
                          className="w-full text-xs bg-slate-50 border border-indigo-300 rounded-xl p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 leading-relaxed font-medium"
                        />
                        <div className="flex items-center space-x-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setEditingIndex(null)}
                            className="px-2.5 py-1 text-[10px] rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-colors cursor-pointer"
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(idx)}
                            disabled={!editingText.trim()}
                            className="px-2.5 py-1 text-[10px] rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Check size={11} />
                            <span>完成</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                        {item}
                      </p>
                    )}
                  </div>

                  {editingIndex !== idx && (
                    <div className="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(idx, item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="编辑条目"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDeleteIndex(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                        title="删除条目"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add New Item Input */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-2">
            {/* Quick Tag Chips */}
            {tabsConfig.find(t => t.key === activeTab)?.suggestedTags && tabsConfig.find(t => t.key === activeTab)!.suggestedTags.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[10px] font-bold text-slate-400 shrink-0">快捷前缀:</span>
                {tabsConfig.find(t => t.key === activeTab)!.suggestedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (!newItemText.includes(tag)) {
                        setNewItemText(prev => `${tag} ${prev}`.trim());
                      }
                    }}
                    className="h-6 px-2 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 text-[10px] font-bold text-slate-600 transition-colors cursor-pointer shrink-0"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddItem();
                  }
                }}
                placeholder={
                  activeTab === 'activeQuests'
                    ? '如：[主线-进行中] 调查城西密道 / [玩家动机] 寻找铁匠铺'
                    : activeTab === 'characterStates'
                    ? '如：[主角] 状态良好，持有生锈铁剑 / [NPC:阿尔沃] 铁匠，友善'
                    : `添加新的${tabsConfig.find(t => t.key === activeTab)?.label}条目...`
                }
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 text-slate-800"
              />
              <button
                type="button"
                onClick={handleAddItem}
                disabled={!newItemText.trim()}
                className="h-8 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <Plus size={14} className="stroke-[2.5]" />
                <span>添加</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleExtractClick}
            disabled={isExtracting}
            className="h-8 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-800 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-xs"
            title="分析最新大纲与剧情对话，自动归纳提取核心设定记忆"
          >
            {isExtracting ? (
              <>
                <Loader2 size={14} className="animate-spin text-amber-600" />
                <span className="hidden sm:inline">正在智能提炼中...</span>
                <span className="sm:hidden">提炼中...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-amber-500" />
                <span>一键提炼记忆</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="h-8 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <Check size={14} className="stroke-[2.5]" />
              <span>保存</span>
            </button>
          </div>
        </div>

        {/* Item Delete Confirmation Dialog */}
        <AnimatePresence>
          {itemToDeleteIndex !== null && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 space-y-4 text-center"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto border border-red-100">
                  <Trash2 size={22} className="stroke-[2]" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-black text-slate-800">
                    确认删除此条记忆设定？
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-left line-clamp-3">
                    "{itemToDeleteText}"
                  </p>
                  <p className="text-[11px] text-red-500 font-semibold pt-1">
                    删除后该条目将不再注入 GM 的前置规则约束中。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setItemToDeleteIndex(null)}
                    className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteItem}
                    className="h-9 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    确认删除
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
