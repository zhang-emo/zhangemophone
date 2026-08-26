/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  Menu,
  Send, 
  Loader2, 
  X,
  Copy,
  Edit3,
  Trash2
} from 'lucide-react';
import { ChatSession, ChatMessage, MemoryEntry } from '../lib/types';
import { dbInstance } from '../lib/db';
import { generateAiReply, getSystemMemoryPrompt, generate24HourMemorySummary } from '../lib/api';
import { OfflineScenarioModal } from './OfflineScenarioModal';

interface OfflineChatWindowProps {
  session: ChatSession;
  onClose: () => void;
  onSaveSession: (updatedSession: ChatSession) => Promise<void>;
  onReloadMainMessages: () => Promise<void>;
}

export const OfflineChatWindow: React.FC<OfflineChatWindowProps> = ({
  session,
  onClose,
  onSaveSession,
  onReloadMainMessages
}) => {
  const [currentSession, setCurrentSession] = useState<ChatSession>(session);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [isSummarizingOnExit, setIsSummarizingOnExit] = useState(false);

  // Message interactive menu & edit modal states
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [editMsgContent, setEditMsgContent] = useState('');
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasNewMessagesRef = useRef(false);

  // Helper to get User Real Name
  const getUserRealName = (): string => {
    try {
      const saved = localStorage.getItem('wechat_user_profile');
      if (saved) {
        const p = JSON.parse(saved);
        if (p && p.realName && p.realName.trim() && p.realName !== '未填写' && p.realName !== '你') {
          return p.realName.trim();
        }
        if (p && p.userId && p.userId.trim() && p.userId !== 'User_Real') {
          return p.userId.trim();
        }
      }
    } catch (e) {}
    return '用户';
  };

  const characterRealName = currentSession.realName?.trim() || currentSession.characterName;
  const userRealName = getUserRealName();

  const isCustomOffline = Boolean(
    currentSession.offlineCustomEnabled &&
    (currentSession.offlineScenarioSetting?.trim() ||
     currentSession.offlineScenarioDesc?.trim() ||
     currentSession.offlineAdditionalPrompt?.trim() ||
     currentSession.offlineBehaviorPrompt?.trim())
  );
  const targetChatId = `${currentSession.id}_offline_custom`;

  const loadMessages = async () => {
    try {
      const list = await dbInstance.getMessages(targetChatId);
      setMessages(list);
    } catch (err) {
      console.error('Failed to load offline messages:', err);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [targetChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiReplying]);

  const handleExit = async () => {
    if (hasNewMessagesRef.current) {
      setIsSummarizingOnExit(true);
      try {
        const currentMsgs = await dbInstance.getMessages(targetChatId);
        if (currentMsgs && currentMsgs.length > 0) {
          const recentMsgs = currentMsgs.slice(-15);
          const summaryText = await generate24HourMemorySummary(
            characterRealName,
            recentMsgs
          );

          if (summaryText) {
            const todayStr = new Date().toISOString().split('T')[0];
            const newEntry: MemoryEntry = {
              id: `mem_offline_${Date.now()}`,
              date: todayStr,
              summary: `[线下模式] ${summaryText}`,
              timestamp: Date.now()
            };

            const updatedEntries = [newEntry, ...(currentSession.memoryEntries || [])];
            const formattedAppend = `\n📅 [${todayStr} 线下模式总结]: ${summaryText}`;
            const updatedBackdrop = currentSession.memory?.trim() 
              ? `${currentSession.memory.trim()}${formattedAppend}` 
              : `📅 [${todayStr} 线下模式总结]: ${summaryText}`;

            const updatedSession: ChatSession = {
              ...currentSession,
              memoryEntries: updatedEntries,
              memory: updatedBackdrop
            };

            await onSaveSession(updatedSession);
          }
        }
      } catch (err) {
        console.error('Auto memory summary on exit failed:', err);
      } finally {
        setIsSummarizingOnExit(false);
      }
    }
    onClose();
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || isAiReplying) return;

    hasNewMessagesRef.current = true;
    const contentToSave = newMessage.trim();

    const userMsgId = `offline_u_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      chatId: targetChatId,
      role: 'user',
      content: contentToSave,
      timestamp: Date.now()
    };

    setNewMessage('');
    setErrorMessage(null);

    // Append user message locally & save
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    await dbInstance.saveMessage(userMsg);

    // Trigger AI response
    setIsAiReplying(true);
    try {
      const replyText = await generateAiReply(
        targetChatId,
        contentToSave,
        updatedMsgs,
        getSystemMemoryPrompt(currentSession),
        currentSession.worldBook,
        undefined, // imageUrl
        undefined, // availableStickers
        {
          longTermMemoryEnabled: currentSession.longTermMemoryEnabled,
          memoryRetentionDays: currentSession.memoryRetentionDays,
          memoryEntries: currentSession.memoryEntries
        },
        {
          narrationModeEnabled: currentSession.narrationModeEnabled,
          narrationRuleText: currentSession.narrationRuleText
        },
        {
          offlineCustomEnabled: true,
          offlineScenarioSetting: currentSession.offlineScenarioSetting,
          offlineAdditionalPrompt: currentSession.offlineAdditionalPrompt,
          offlinePerspective: currentSession.offlinePerspective,
          offlineLengthPreference: currentSession.offlineLengthPreference,
          offlineMemorySummaryCount: currentSession.offlineMemorySummaryCount,
          offlineScenarioTitle: currentSession.offlineScenarioTitle,
          offlineScenarioDesc: currentSession.offlineScenarioDesc,
          offlineBehaviorPrompt: currentSession.offlineBehaviorPrompt,
          offlineCharacterRealName: characterRealName,
          offlineUserRealName: userRealName
        }
      );

      // Single bubble for offline otome prose reply
      const aiMsg: ChatMessage = {
        id: `offline_ai_${Date.now()}`,
        chatId: targetChatId,
        role: 'assistant',
        content: replyText || '...',
        senderName: characterRealName,
        senderAvatar: currentSession.characterAvatar,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(aiMsg);

      await loadMessages();
      await onReloadMainMessages();
    } catch (err: any) {
      console.warn('Offline AI Reply Error:', err.message || err);
      setErrorMessage(err.message || '生成回复失败，请检查网络或 API Key 设置');
    } finally {
      setIsAiReplying(false);
    }
  };

  // Message actions: Copy, Edit, Delete
  const handleCopyMessage = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedMsgId(msg.id);
    setActiveMenuMsgId(null);
    setTimeout(() => setCopiedMsgId(null), 1500);
  };

  const handleStartEditMessage = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setEditMsgContent(msg.content);
    setActiveMenuMsgId(null);
  };

  const handleSaveEditMessage = async () => {
    if (!editingMsg) return;
    const newText = editMsgContent.trim();
    if (!newText) return;

    const updated: ChatMessage = {
      ...editingMsg,
      content: newText
    };

    try {
      await dbInstance.saveMessage(updated);
      setMessages(prev => prev.map(m => m.id === editingMsg.id ? updated : m));
      setEditingMsg(null);
    } catch (err) {
      console.error('Failed to update edited message:', err);
    }
  };

  const handleDeleteMessage = (msgId: string) => {
    setActiveMenuMsgId(null);
    setDeleteMsgId(msgId);
  };

  const confirmDeleteMessage = async () => {
    if (!deleteMsgId) return;
    const msgId = deleteMsgId;
    try {
      await dbInstance.deleteMessage(msgId);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err) {
      console.error('Failed to delete offline message:', err);
    } finally {
      setDeleteMsgId(null);
    }
  };

  const handleTouchStart = (msgId: string) => {
    longPressTimerRef.current = setTimeout(() => {
      setActiveMenuMsgId(msgId);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div 
      className="absolute inset-0 z-50 bg-gray-50 text-gray-900 flex flex-col animate-in fade-in zoom-in-95 duration-200 select-none"
      onClick={() => setActiveMenuMsgId(null)}
    >
      
      {/* Summarizing memory on exit overlay */}
      {isSummarizingOnExit && (
        <div className="absolute inset-0 z-[100] bg-black/70 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 text-white animate-in fade-in duration-200">
          <Loader2 size={28} className="animate-spin text-[#9eccab]" />
          <span className="text-xs font-bold tracking-wide">正在自动总结本次线下模式记忆...</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="h-16 px-4 bg-[#f0f0f0] border-b flex items-center justify-between border-gray-200/90 shadow-xs shrink-0 text-gray-900">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleExit}
            disabled={isSummarizingOnExit}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200/80 border border-gray-200 flex items-center justify-center text-gray-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            title="退出线下模式"
          >
            <ChevronLeft size={20} className="stroke-[2.5px]" />
          </button>
          
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-black text-gray-900 tracking-wide">
                {characterRealName} · 线下模式
              </h3>
              {isCustomOffline && (
                <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border bg-[#9eccab]/20 border-[#9eccab]/50 text-[#365b40]">
                  独立记录
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Button: Edit Scenario */}
        <button
          type="button"
          onClick={() => setShowConfigModal(true)}
          className="w-9 h-9 rounded-xl bg-[#9eccab]/15 hover:bg-[#9eccab]/25 border border-[#9eccab]/40 text-[#365b40] flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
          title="剧情配置"
        >
          <Menu size={18} className="text-[#365b40]" />
        </button>
      </div>

      {/* Main Messages Card Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-gray-50/70">
        {messages.length === 0 ? null : (
          messages.map((msg) => (
            <div
              key={msg.id}
              onTouchStart={() => handleTouchStart(msg.id)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(msg.id)}
              onMouseUp={handleTouchEnd}
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuMsgId(prev => prev === msg.id ? null : msg.id);
              }}
              className={`w-full bg-[#f0f0f0] rounded-2xl p-4 sm:p-5 border shadow-xs transition-all space-y-2.5 relative cursor-pointer ${
                msg.role === 'user'
                  ? 'border-amber-200/80 bg-amber-50/20'
                  : 'border-gray-200/90 bg-[#f0f0f0]'
              }`}
            >
              {/* Floating Copy Confirmation Tag */}
              {copiedMsgId === msg.id && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-lg z-30 animate-in fade-in">
                  已复制到剪贴板
                </div>
              )}

              {/* Long Press Action Popover Menu */}
              {activeMenuMsgId === msg.id && (
                <div 
                  className="absolute -top-11 right-3 z-30 bg-gray-900 text-white text-[11px] font-bold rounded-xl shadow-xl px-1.5 py-1 flex items-center space-x-1 border border-gray-700 animate-in fade-in zoom-in-95 duration-150"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleCopyMessage(msg)}
                    className="flex items-center space-x-1 hover:bg-gray-800 px-2.5 py-1 rounded-lg transition-all text-gray-200 hover:text-white cursor-pointer"
                  >
                    <Copy size={13} />
                    <span>复制</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEditMessage(msg)}
                    className="flex items-center space-x-1 hover:bg-gray-800 px-2.5 py-1 rounded-lg transition-all text-amber-300 hover:text-amber-200 cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>编辑</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="flex items-center space-x-1 hover:bg-gray-800 px-2.5 py-1 rounded-lg transition-all text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>删除</span>
                  </button>
                </div>
              )}

              {/* Card Header Tag & Timestamp */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="flex items-center space-x-2">
                  {msg.role !== 'user' ? (
                    <>
                      <img
                        src={msg.senderAvatar || currentSession.characterAvatar}
                        alt={characterRealName}
                        className="w-6 h-6 rounded-full object-cover border border-[#9eccab]"
                      />
                      <span className="text-xs font-black text-gray-900">
                        {characterRealName}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center text-[10px] font-black shrink-0">
                        {userRealName.slice(0, 1)}
                      </div>
                      <span className="text-xs font-black text-gray-900">{userRealName}</span>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Card Body Text */}
              <div className="text-xs sm:text-sm text-gray-800 leading-relaxed font-sans whitespace-pre-wrap tracking-wide pt-0.5">
                {msg.content}
              </div>
            </div>
          ))
        )}

        {/* AI Replying Indicator Card */}
        {isAiReplying && (
          <div className="w-full bg-[#f0f0f0] border border-[#9eccab]/60 rounded-2xl p-4 flex items-center space-x-3 text-[#365b40] text-xs font-bold shadow-xs animate-pulse">
            <Loader2 size={16} className="animate-spin text-[#9eccab] shrink-0" />
            <span>{characterRealName} 正在回应...</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 text-center font-bold">
            {errorMessage}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Message Input Bar */}
      <div className="px-4 py-3 min-h-[64px] bg-[#f0f0f0] border-t border-gray-200 flex items-center space-x-2 shrink-0 shadow-lg shadow-gray-100">
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder=""
            disabled={isAiReplying}
            className="flex-1 h-11 px-4 bg-gray-100/80 focus:bg-[#f0f0f0] border border-gray-200 focus:border-[#9eccab] rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none transition-all font-sans"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || isAiReplying}
            className="h-11 w-11 rounded-xl bg-[#9eccab] hover:opacity-90 disabled:opacity-40 text-white font-bold flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-sm"
          >
            <Send size={16} className="-ml-0.5 mt-0.5" />
          </button>
        </form>
      </div>

      {/* Edit Message Modal */}
      {editingMsg && (
        <div 
          className="absolute inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#f0f0f0] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-sm font-black text-gray-900">编辑消息内容</h4>
              <button
                type="button"
                onClick={() => setEditingMsg(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              value={editMsgContent}
              onChange={(e) => setEditMsgContent(e.target.value)}
              rows={6}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#9eccab] focus:bg-[#f0f0f0] transition-all leading-relaxed"
              placeholder="修改消息内容..."
            />

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingMsg(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEditMessage}
                disabled={!editMsgContent.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#365b40] hover:bg-[#2c4b34] disabled:opacity-50 transition-all cursor-pointer shadow-sm"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Confirmation Modal */}
      {deleteMsgId && (
        <div className="absolute inset-0 z-[110] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除消息</h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要删除这条消息吗？该操作不可撤销。</p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteMsgId(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDeleteMessage}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Scenario Editor Modal (Launched from top-right) */}
      {showConfigModal && (
        <OfflineScenarioModal
          session={currentSession}
          onClose={() => setShowConfigModal(false)}
          onSave={async (updatedSession) => {
            await onSaveSession(updatedSession);
            setCurrentSession(updatedSession);
            await loadMessages();
          }}
          onReloadMessages={loadMessages}
        />
      )}

    </div>
  );
};
