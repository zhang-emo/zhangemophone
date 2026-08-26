/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BellRing, X, Check, Sparkles, Clock, Zap, Moon, AlertCircle, Calendar } from 'lucide-react';
import { ChatSession } from '../lib/types';

interface ProactiveMessagingModalProps {
  session: ChatSession;
  onClose: () => void;
  onSave: (updatedSession: ChatSession) => Promise<void>;
}

export const ProactiveMessagingModal: React.FC<ProactiveMessagingModalProps> = ({
  session,
  onClose,
  onSave,
}) => {
  // Online Proactive State
  const [onlineEnabled, setOnlineEnabled] = useState<boolean>(
    session.onlineProactiveEnabled ?? false
  );
  const [onlineIdleMinutes, setOnlineIdleMinutes] = useState<number>(
    session.onlineIdleMinutes ?? 10
  );

  // Background Proactive State
  const [backgroundEnabled, setBackgroundEnabled] = useState<boolean>(
    session.backgroundProactiveEnabled ?? false
  );
  const [activeStart, setActiveStart] = useState<string>(
    session.backgroundActiveTimeStart || '08:00'
  );
  const [activeEnd, setActiveEnd] = useState<string>(
    session.backgroundActiveTimeEnd || '22:00'
  );
  const [frequency, setFrequency] = useState<'high' | 'medium' | 'low'>(
    session.backgroundFrequency || 'medium'
  );

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSave = async () => {
    const updatedSession: ChatSession = {
      ...session,
      onlineProactiveEnabled: onlineEnabled,
      onlineIdleMinutes: Math.max(1, onlineIdleMinutes),
      backgroundProactiveEnabled: backgroundEnabled,
      backgroundActiveTimeStart: activeStart,
      backgroundActiveTimeEnd: activeEnd,
      backgroundFrequency: frequency,
    };

    await onSave(updatedSession);
    onClose();
  };

  const idleOptions = [5, 10, 15, 30];

  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[9999] animate-in fade-in duration-200 select-none">
      <div className="bg-white rounded-3xl overflow-hidden w-full max-w-lg max-h-[92vh] text-slate-800 shadow-2xl relative border border-slate-200/80 flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 p-4 sm:p-5 text-white relative shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0 backdrop-blur-md">
              <BellRing size={20} className="text-purple-200" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide flex items-center space-x-2">
                <span>AI 主动消息与呼叫设置</span>
              </h3>
              <p className="text-[11px] text-purple-200/80 mt-0.5">
                目标角色：<span className="font-semibold text-white">{session.characterName}</span> · 配置在线与后台主动发消息规则
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

        {/* Toast Notification */}
        {toastMsg && (
          <div className="bg-purple-50 text-purple-900 px-4 py-2 text-xs font-medium text-center border-b border-purple-100 flex items-center justify-center space-x-1.5 animate-in fade-in duration-150">
            <Sparkles size={13} className="text-purple-600" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 leading-relaxed text-xs">
          
          {/* Section 1: 在线主动发消息 (Online Idle Proactive) */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200/60 flex items-center justify-center text-purple-600 shrink-0">
                  <Zap size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">在线主动发消息</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOnlineEnabled(!onlineEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  onlineEnabled ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform" />
              </button>
            </div>

            {onlineEnabled ? (
              <div className="space-y-3 pt-3 border-t border-slate-200/70">
                <label className="text-[11px] font-semibold text-slate-700 flex items-center justify-between">
                  <span>不说话停顿等待时长：</span>
                  <span className="text-purple-700 font-bold">{onlineIdleMinutes} 分钟</span>
                </label>

                <div className="grid grid-cols-4 gap-2">
                  {idleOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setOnlineIdleMinutes(opt)}
                      className={`py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                        onlineIdleMinutes === opt
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      {opt} 分钟
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <span className="text-[10px] text-slate-500 font-medium">自定义时长：</span>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={onlineIdleMinutes}
                    onChange={(e) => setOnlineIdleMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 text-center focus:outline-none focus:border-purple-500"
                  />
                  <span className="text-[10px] text-slate-500">分钟</span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl text-[11px] text-slate-500 font-normal flex items-center space-x-2 border border-slate-200/60">
                <AlertCircle size={14} className="shrink-0 text-slate-400" />
                <span>在线主动发消息已关闭</span>
              </div>
            )}
          </div>

          {/* Section 2: 后台挂机主动呼叫 (Background AFK Call) */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200/60 flex items-center justify-center text-purple-600 shrink-0">
                  <Moon size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-900 block">后台挂机主动呼叫</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setBackgroundEnabled(!backgroundEnabled)}
                className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  backgroundEnabled ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform" />
              </button>
            </div>

            {backgroundEnabled ? (
              <div className="space-y-4 pt-3 border-t border-slate-200/70">
                
                {/* Active Time Range */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Clock size={13} className="text-purple-600" />
                    <span>活动时间段范围：</span>
                  </label>

                  <div className="flex items-center space-x-2 bg-white p-2.5 rounded-xl border border-slate-200/90">
                    <input
                      type="time"
                      value={activeStart}
                      onChange={(e) => setActiveStart(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-xs font-medium text-slate-400">至</span>
                    <input
                      type="time"
                      value={activeEnd}
                      onChange={(e) => setActiveEnd(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Proactive Frequency */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1.5">
                    <Calendar size={13} className="text-purple-600" />
                    <span>主动发送频率：</span>
                  </label>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFrequency('high')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        frequency === 'high'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      <span className="text-xs font-bold block">高频</span>
                      <span className={`text-[10px] block mt-0.5 ${frequency === 'high' ? 'text-purple-100' : 'text-slate-400'}`}>
                        15 - 30 分钟
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFrequency('medium')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        frequency === 'medium'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      <span className="text-xs font-bold block">中频</span>
                      <span className={`text-[10px] block mt-0.5 ${frequency === 'medium' ? 'text-purple-100' : 'text-slate-400'}`}>
                        1 - 3 小时
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFrequency('low')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        frequency === 'low'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80'
                      }`}
                    >
                      <span className="text-xs font-bold block">低频</span>
                      <span className={`text-[10px] block mt-0.5 ${frequency === 'low' ? 'text-purple-100' : 'text-slate-400'}`}>
                        6 - 12 小时
                      </span>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl text-[11px] text-slate-500 font-normal flex items-center space-x-2 border border-slate-200/60">
                <AlertCircle size={14} className="shrink-0 text-slate-400" />
                <span>后台挂机主动呼叫已关闭</span>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50/80 border-t border-slate-100 flex space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 h-10 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white text-xs font-medium transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-md shadow-purple-600/20"
          >
            <Check size={14} />
            <span>保存</span>
          </button>
        </div>

      </div>
    </div>
  );
};
