/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  X, 
  Check, 
  Sparkles, 
  AlertCircle, 
  BookOpen, 
  Trash2, 
  Sliders,
  Eye,
  AlignLeft,
  History,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { ChatSession, ChatMessage } from '../lib/types';
import { dbInstance } from '../lib/db';

interface OfflineScenarioModalProps {
  session: ChatSession;
  onClose: () => void;
  onSave: (updatedSession: ChatSession) => Promise<void>;
  onReloadMessages: () => Promise<void>;
}

export const OfflineScenarioModal: React.FC<OfflineScenarioModalProps> = ({
  session,
  onClose,
  onSave,
  onReloadMessages
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'records'>('config');
  const [enabled, setEnabled] = useState<boolean>(session.offlineCustomEnabled ?? false);
  const [scenarioSetting, setScenarioSetting] = useState<string>(
    session.offlineScenarioSetting || session.offlineScenarioDesc || ''
  );
  const [additionalPrompt, setAdditionalPrompt] = useState<string>(
    session.offlineAdditionalPrompt || session.offlineBehaviorPrompt || ''
  );
  const [perspective, setPerspective] = useState<'second' | 'first' | 'third'>(
    session.offlinePerspective || 'second'
  );
  const [lengthPreference, setLengthPreference] = useState<'rich' | 'concise'>(
    session.offlineLengthPreference || 'rich'
  );
  const [memorySummaryCount, setMemorySummaryCount] = useState<number>(
    session.offlineMemorySummaryCount ?? 5
  );

  // Accordion collapsed state for parameters
  const [expandPerspective, setExpandPerspective] = useState(false);
  const [expandLength, setExpandLength] = useState(false);
  const [expandMemory, setExpandMemory] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Offline Interaction Records
  const [offlineRecords, setOfflineRecords] = useState<ChatMessage[]>([]);
  const [isDeletingRecords, setIsDeletingRecords] = useState(false);

  const offlineChatId = `${session.id}_offline_custom`;

  const loadOfflineRecords = async () => {
    try {
      const records = await dbInstance.getMessages(offlineChatId);
      setOfflineRecords(records);
    } catch (e) {
      console.error('Failed to load offline records:', e);
    }
  };

  useEffect(() => {
    loadOfflineRecords();
  }, [session.id]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSave = async () => {
    const updatedSession: ChatSession = {
      ...session,
      offlineCustomEnabled: enabled,
      offlineScenarioSetting: scenarioSetting.trim(),
      offlineAdditionalPrompt: additionalPrompt.trim(),
      offlinePerspective: perspective,
      offlineLengthPreference: lengthPreference,
      offlineMemorySummaryCount: memorySummaryCount,
      // Keep legacy fields updated for backward compatibility
      offlineScenarioDesc: scenarioSetting.trim(),
      offlineBehaviorPrompt: additionalPrompt.trim()
    };

    await onSave(updatedSession);
    await onReloadMessages();
    onClose();
  };

  const handleReset = () => {
    setEnabled(false);
    setScenarioSetting('');
    setAdditionalPrompt('');
    setPerspective('second');
    setLengthPreference('rich');
    setMemorySummaryCount(5);
    showToast('已清空当前配置所有内容');
  };

  const handleClearOfflineRecords = async () => {
    try {
      await dbInstance.clearSessionMessages(offlineChatId);
      await loadOfflineRecords();
      await onReloadMessages();
      setIsDeletingRecords(false);
      showToast('已成功清空“线下模式记录”');
    } catch (e) {
      console.error('Clear offline records error:', e);
      alert('清空记录失败');
    }
  };

  const getPerspectiveLabel = (val: 'second' | 'first' | 'third') => {
    switch (val) {
      case 'first': return '第一人称（我）';
      case 'third': return '第三人称（姓名）';
      default: return '第二人称（你）';
    }
  };

  const getLengthLabel = (val: 'rich' | 'concise') => {
    return val === 'concise' ? '相对精简响应' : '文本饱满细腻';
  };

  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-3 sm:p-4 z-[9999] animate-in fade-in duration-200 select-none">
      <div className="bg-white rounded-3xl overflow-hidden w-full max-w-lg max-h-[90vh] text-gray-800 shadow-2xl relative border border-gray-100 flex flex-col">
        
        {/* Header */}
        <div className="bg-white border-b border-gray-100 p-4 sm:p-5 text-gray-900 relative shrink-0">
          <div className="flex items-center justify-between pr-8">
            <h3 className="text-sm font-black tracking-wide flex items-center space-x-2 text-gray-900">
              <span>线下剧情配置与模式记录</span>
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${
                enabled 
                  ? 'bg-[#9eccab]/20 border-[#9eccab]/50 text-[#365b40]' 
                  : 'bg-gray-100 border-gray-200 text-gray-600'
              }`}>
                {enabled ? '自定义线下模式' : '常规相处模式'}
              </span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-all focus:outline-none cursor-pointer p-1 rounded-full hover:bg-gray-100"
          >
            <X size={18} />
          </button>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setActiveTab('config')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'config'
                  ? 'bg-[#9eccab]/20 text-[#365b40] border border-[#9eccab]/50 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Compass size={13} />
              <span>剧情配置</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'records'
                  ? 'bg-[#9eccab]/20 text-[#365b40] border border-[#9eccab]/50 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <BookOpen size={13} />
              <span>线下模式记录 ({offlineRecords.length})</span>
            </button>
          </div>
        </div>

        {/* Toast Banner */}
        {toastMsg && (
          <div className="bg-[#9eccab]/20 text-[#2e4f38] px-4 py-2 text-xs font-bold text-center border-b border-[#9eccab]/40 flex items-center justify-center space-x-1 animate-in fade-in duration-150">
            <Sparkles size={13} className="text-[#365b40]" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 leading-relaxed text-xs">
          
          {activeTab === 'config' ? (
            <>
              {/* Toggle Switch */}
              <div className="bg-[#9eccab]/15 rounded-2xl p-4 border border-[#9eccab]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-[#284631] block">启用自定义线下剧情</span>
                    <span className="text-[10px] text-[#365b40]/80 block mt-0.5">
                      开启后，线下互动将基于下方设置的场景与表现参数独立运行
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                      enabled ? 'bg-[#9eccab] justify-end' : 'bg-gray-300 justify-start'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                  </button>
                </div>
              </div>

              {/* Form Options */}
              <div className={`space-y-4 transition-all ${enabled ? 'opacity-100' : 'opacity-60 pointer-events-none'}`}>
                
                {/* 1. 情景设定 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-900 block">
                    情景设定
                  </label>
                  <textarea
                    rows={4}
                    value={scenarioSetting}
                    onChange={(e) => setScenarioSetting(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#9eccab] resize-none leading-relaxed font-sans"
                  />
                </div>

                {/* 2. 专属追加提示词 */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-gray-900 block">
                    专属追加提示词
                  </label>
                  <textarea
                    rows={3}
                    value={additionalPrompt}
                    onChange={(e) => setAdditionalPrompt(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#9eccab] resize-none leading-relaxed font-sans"
                  />
                </div>

                {/* 3. 表现参数设定 */}
                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200 space-y-3">
                  <div className="flex items-center space-x-1.5 pb-2 border-b border-gray-200/80 text-gray-900 font-black text-xs">
                    <Sliders size={14} className="text-[#365b40]" />
                    <span>表现参数设定</span>
                  </div>

                  {/* AI人称视角 */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandPerspective(!expandPerspective)}
                      className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Eye size={13} className="text-[#365b40]" />
                        <span className="font-bold text-gray-800 text-xs">AI人称视角</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#365b40] bg-[#9eccab]/20 px-2.5 py-0.5 rounded-full border border-[#9eccab]/40">
                          {getPerspectiveLabel(perspective)}
                        </span>
                        {expandPerspective ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandPerspective && (
                      <div className="p-3 pt-1 border-t border-gray-100 bg-gray-50/50">
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPerspective('second')}
                            className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              perspective === 'second'
                                ? 'bg-[#9eccab] text-white border-[#9eccab] shadow-sm'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            第二人称（你）
                          </button>
                          <button
                            type="button"
                            onClick={() => setPerspective('first')}
                            className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              perspective === 'first'
                                ? 'bg-[#9eccab] text-white border-[#9eccab] shadow-sm'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            第一人称（我）
                          </button>
                          <button
                            type="button"
                            onClick={() => setPerspective('third')}
                            className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              perspective === 'third'
                                ? 'bg-[#9eccab] text-white border-[#9eccab] shadow-sm'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            第三人称（姓名）
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 描写长度倾向 */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandLength(!expandLength)}
                      className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <AlignLeft size={13} className="text-[#365b40]" />
                        <span className="font-bold text-gray-800 text-xs">描写长度倾向</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#365b40] bg-[#9eccab]/20 px-2.5 py-0.5 rounded-full border border-[#9eccab]/40">
                          {getLengthLabel(lengthPreference)}
                        </span>
                        {expandLength ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandLength && (
                      <div className="p-3 pt-1 border-t border-gray-100 bg-gray-50/50">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setLengthPreference('rich')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              lengthPreference === 'rich'
                                ? 'bg-[#9eccab] text-white border-[#9eccab] shadow-sm'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            文本饱满细腻
                          </button>
                          <button
                            type="button"
                            onClick={() => setLengthPreference('concise')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              lengthPreference === 'concise'
                                ? 'bg-[#9eccab] text-white border-[#9eccab] shadow-sm'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            相对精简响应
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 记忆总结条数 */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandMemory(!expandMemory)}
                      className="w-full p-3 flex items-center justify-between text-left cursor-pointer hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <History size={13} className="text-[#365b40]" />
                        <span className="font-bold text-gray-800 text-xs">记忆总结条数</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#365b40] font-mono bg-[#9eccab]/20 px-2.5 py-0.5 rounded-full border border-[#9eccab]/40">
                          {memorySummaryCount} 条
                        </span>
                        {expandMemory ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </button>
                    {expandMemory && (
                      <div className="p-3 pt-1 border-t border-gray-100 bg-gray-50/50">
                        <div className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-gray-200">
                          <input
                            type="range"
                            min={1}
                            max={30}
                            step={1}
                            value={memorySummaryCount}
                            onChange={(e) => setMemorySummaryCount(Number(e.target.value))}
                            className="flex-1 accent-[#9eccab] cursor-pointer"
                          />
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={memorySummaryCount}
                            onChange={(e) => setMemorySummaryCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                            className="w-14 px-2 py-1 text-center bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold text-gray-900 focus:outline-none focus:border-[#9eccab]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            </>
          ) : (
            /* Tab 2: Offline Interaction Records */
            <div className="space-y-4">
              <div className="p-3 bg-[#9eccab]/15 rounded-2xl border border-[#9eccab]/40 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#284631]">独立的【线下模式记录】</h4>
                  <p className="text-[10px] text-[#365b40]/80 mt-0.5">
                    仅存储用户与角色在“自定义线下剧情”模式下的聊天对话。
                  </p>
                </div>
                {offlineRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsDeletingRecords(true)}
                    className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[10px] font-bold border border-red-200 transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    <span>清空记录</span>
                  </button>
                )}
              </div>

              {/* Confirm deletion banner */}
              {isDeletingRecords && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-2xl space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-red-900">
                    <AlertCircle size={14} className="text-red-600" />
                    <span>确定要清空“{session.characterName}”的所有独立线下模式记录吗？</span>
                  </div>
                  <p className="text-[10px] text-red-700">此操作不可撤销，已存储的线下对话记录将被永久抹除。</p>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsDeletingRecords(false)}
                      className="px-3 py-1 bg-white border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleClearOfflineRecords}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg text-[10px] font-bold cursor-pointer hover:bg-red-700"
                    >
                      确认永久清空
                    </button>
                  </div>
                </div>
              )}

              {/* List of Offline Records */}
              {offlineRecords.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 space-y-2">
                  <BookOpen size={28} className="mx-auto text-gray-300" />
                  <p className="text-xs font-bold text-gray-500">暂无任何独立线下模式记录</p>
                  <p className="text-[10px] text-gray-400">
                    开启“启用自定义线下剧情”并发送消息后，对话记录将自动独立保存于此处。
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {offlineRecords.map((msg) => (
                    <div
                      key={msg.id}
                      className={`p-2.5 rounded-2xl border text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#9eccab]/20 border-[#9eccab]/40 text-[#284631] ml-4'
                          : msg.role === 'system'
                          ? 'bg-gray-100 border-gray-200 text-gray-600 text-center text-[10px]'
                          : 'bg-white border-gray-200 text-gray-800 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[9px] font-mono text-gray-400 mb-1">
                        <span className="font-bold text-gray-600">
                          {msg.role === 'user' ? '用户' : msg.senderName || session.characterName}
                        </span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex space-x-2.5 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors cursor-pointer flex items-center justify-center space-x-1"
          >
            <RotateCcw size={13} className="text-gray-500" />
            <span>重置剧情</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 h-10 rounded-xl bg-[#9eccab] hover:opacity-90 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow-md shadow-[#9eccab]/30"
          >
            <Check size={14} />
            <span>应用配置</span>
          </button>
        </div>

      </div>
    </div>
  );
};
