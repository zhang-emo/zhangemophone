/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { MessageSquareQuote, X, Check, Sparkles, RotateCcw, AlertCircle } from 'lucide-react';
import { ChatSession, DEFAULT_NARRATION_RULE } from '../lib/types';

interface NarrationModeModalProps {
  session: ChatSession;
  onClose: () => void;
  onSave: (updatedSession: ChatSession) => Promise<void>;
}

export const NarrationModeModal: React.FC<NarrationModeModalProps> = ({
  session,
  onClose,
  onSave,
}) => {
  const [enabled, setEnabled] = useState<boolean>(session.narrationModeEnabled ?? false);
  const [ruleText, setRuleText] = useState<string>(session.narrationRuleText || DEFAULT_NARRATION_RULE);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSave = async () => {
    const updatedSession: ChatSession = {
      ...session,
      narrationModeEnabled: enabled,
      narrationRuleText: ruleText.trim() || DEFAULT_NARRATION_RULE,
    };

    await onSave(updatedSession);
    onClose();
  };

  const handleResetDefault = () => {
    setRuleText(DEFAULT_NARRATION_RULE);
    showToast('已重置为默认标准旁白规则');
  };

  return (
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-[9999] animate-in fade-in duration-200 select-none">
      <div className="bg-white rounded-3xl overflow-hidden w-full max-w-lg max-h-[90vh] text-slate-800 shadow-2xl relative border border-slate-200/80 flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600/90 via-amber-600 to-amber-700/90 p-4 sm:p-5 text-white relative shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 backdrop-blur-md">
              <MessageSquareQuote size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-wide flex items-center space-x-2 text-white">
                <span>角色旁白与动作模式设置</span>
              </h3>
              <p className="text-[11px] text-amber-100/80 mt-0.5">
                目标角色：<span className="font-semibold text-white">{session.characterName}</span> · 控制回复中括号动作与环境描写
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-all focus:outline-none cursor-pointer p-1.5 rounded-full hover:bg-white/15"
          >
            <X size={18} />
          </button>
        </div>

        {/* Toast Banner */}
        {toastMsg && (
          <div className="bg-amber-50 text-amber-800 px-4 py-2 text-xs font-medium text-center border-b border-amber-100/80 flex items-center justify-center space-x-1.5 animate-in fade-in duration-150">
            <Sparkles size={13} className="text-amber-600" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 leading-relaxed text-xs">
          
          {/* Section 1: Toggle Switch */}
          <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900 block">启用旁白与环境描写模式</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  开启后，AI 将在回复中使用括号（）描写动作、心理及场景细节。
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                  enabled ? 'bg-[#ed853c] justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform" />
              </button>
            </div>

            {!enabled && (
              <div className="p-3 bg-amber-50/60 rounded-xl text-[11px] text-amber-900/90 font-normal flex items-start space-x-2 border border-amber-200/50">
                <AlertCircle size={14} className="text-amber-600/90 shrink-0 mt-0.5" />
                <span>旁白模式关闭时，AI 被强制要求仅输出对话台词，不会使用括号包含任何动作或心理描写。</span>
              </div>
            )}
          </div>

          {/* Section 2: Rule Text Editor */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 block">
                自定义旁白输出规则 (Prompt)
              </label>

              <button
                type="button"
                onClick={handleResetDefault}
                className="text-[10px] text-amber-800/90 hover:text-amber-900 font-medium flex items-center space-x-1 cursor-pointer bg-amber-50/60 hover:bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200/60 transition-colors"
              >
                <RotateCcw size={10} />
                <span>恢复默认规则</span>
              </button>
            </div>

            <textarea
              rows={5}
              value={ruleText}
              onChange={(e) => setRuleText(e.target.value)}
              placeholder="请输入自定义旁白规则指令..."
              className="w-full p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:border-amber-600/80 focus:bg-white resize-none leading-relaxed font-sans transition-all"
            />
            <p className="text-[10px] text-slate-400">
              提示：该规则将在角色生成回复时直接作为后置格式指导注入给 AI 模型。
            </p>
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
            className="flex-1 h-10 rounded-xl bg-[#ed853c] hover:opacity-90 active:scale-[0.99] text-white text-xs font-medium transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-md shadow-[#ed853c]/20"
          >
            <Check size={14} />
            <span>保存</span>
          </button>
        </div>

      </div>
    </div>
  );
};
