import React, { useState, useRef } from 'react';
import { X, Users, Plus, Check, Upload, RefreshCw } from 'lucide-react';
import { ChatSession } from '../lib/types';

const formatDisplayName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*[\(\（].*?[\)\）]/g, '').trim();
};

interface GroupChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  onSave: (group: {
    title: string;
    avatar: string;
    participants: string[];
    worldBook: string;
  }) => void;
}

export default function GroupChatModal({
  isOpen,
  onClose,
  sessions,
  onSave
}: GroupChatModalProps) {
  const [title, setTitle] = useState('');
  const [avatar, setAvatar] = useState('__stacked__');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [worldBook, setWorldBook] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const candidateCharacters = sessions.filter(s => !s.isGroup);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('请上传小于 2MB 的图片！');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[GroupChatModal] handleSubmit clicked.');
    console.log('[GroupChatModal] Group title:', title);
    console.log('[GroupChatModal] Selected participants:', selectedParticipants);
    console.log('[GroupChatModal] World book context:', worldBook);

    if (!title.trim()) {
      console.warn('[GroupChatModal] Submit blocked: Title is empty.');
      alert('请填写一个有趣的群聊名称！');
      return;
    }
    if (selectedParticipants.length < 2) {
      console.warn('[GroupChatModal] Submit blocked: Selected participants count < 2.', selectedParticipants.length);
      alert('请至少选择两位 AI 成员拉起群聊进行有趣的联动讨论！');
      return;
    }

    onSave({
      title: title.trim(),
      avatar,
      participants: selectedParticipants,
      worldBook: worldBook.trim()
    });

    // Reset Form
    setTitle('');
    setAvatar('__stacked__');
    setSelectedParticipants([]);
    setWorldBook('');
    onClose();
  };

  const toggleParticipant = (cid: string) => {
    if (selectedParticipants.includes(cid)) {
      setSelectedParticipants(prev => prev.filter(p => p !== cid));
    } else {
      setSelectedParticipants(prev => [...prev, cid]);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 z-40 bg-black/60 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="bg-[#f0f0f0] rounded-t-[24px] max-h-[85%] flex flex-col overflow-hidden shadow-2xl relative text-gray-800">
        
        {/* Header */}
        <div className="p-4 px-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2">
            <Users className="text-gray-900" size={16} />
            <div>
              <h3 className="text-xs font-black text-gray-900">发起群聊</h3>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">LAUNCH GROUP CHATROOM</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          
          {/* Group Title */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
              群名称
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=""
              className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-950 focus:bg-[#f0f0f0] transition-all font-sans font-semibold"
            />
          </div>

          {/* Group Avatar Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
              群头像
            </label>
            <div className="flex items-center space-x-4">
              {/* Preview */}
              <div className="w-14 h-14 rounded-[16px] bg-slate-100 border border-slate-200/60 flex items-center justify-center text-2xl shadow-sm shrink-0 select-none overflow-hidden relative">
                {avatar === '__stacked__' ? (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div className="absolute top-1 left-1 w-8 h-8 rounded-full bg-amber-200 border border-white flex items-center justify-center text-xs font-bold text-amber-800 shadow">
                      👤
                    </div>
                    <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-indigo-200 border border-white flex items-center justify-center text-xs font-bold text-indigo-800 shadow">
                      🤖
                    </div>
                  </div>
                ) : (
                  <img src={avatar} alt="Group Avatar" className="w-full h-full object-cover" />
                )}
              </div>

              {/* Upload control buttons */}
              <div className="flex flex-col space-y-1.5">
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 text-[10px] font-bold text-gray-700 transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    <Upload size={10} />
                    <span>上传群头像</span>
                  </button>

                  {avatar !== '__stacked__' && (
                    <button
                      type="button"
                      onClick={() => setAvatar('__stacked__')}
                      className="h-8 px-3 rounded-lg border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-[10px] font-bold text-rose-600 transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <RefreshCw size={10} />
                      <span>恢复默认头像</span>
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-gray-400">支持上传本地 JPG / PNG 图片作为专属群头像</p>
              </div>
            </div>
          </div>

          {/* Member Selection list */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
              邀请成员 * (Select Participants)
            </label>
            
            {candidateCharacters.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {candidateCharacters.map((charSession) => {
                  const cid = charSession.id.replace('session_', '');
                  const isChecked = selectedParticipants.includes(cid);
                  
                  return (
                    <button
                      key={charSession.id}
                      type="button"
                      onClick={() => toggleParticipant(cid)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all hover:bg-gray-50 ${
                        isChecked ? 'border-amber-400 bg-amber-50/20' : 'border-gray-100'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 border flex items-center justify-center text-md select-none shrink-0 shadow-sm overflow-hidden">
                          {charSession.characterAvatar && (charSession.characterAvatar.startsWith('data:') || charSession.characterAvatar.startsWith('http')) ? (
                            <img src={charSession.characterAvatar} alt="Avatar" className="w-full h-full object-cover" />
                          ) : (
                            <span>{charSession.characterAvatar || '❤️'}</span>
                          )}
                        </div>
                        <div className="leading-none text-left">
                          <span className="text-xs font-bold text-gray-900 block">{formatDisplayName(charSession.characterName)}</span>
                          <span className="text-[9px] text-gray-400 font-semibold block mt-1">{charSession.relationship || '单聊AI伴侣'}</span>
                        </div>
                      </div>
                      
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                        isChecked ? 'bg-[#3C1E1E] border-[#3C1E1E] text-[#FEE500]' : 'border-gray-300 bg-[#f0f0f0]'
                      }`}>
                        {isChecked && <span className="text-[9px] font-bold">✔</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 italic">暂无可选择的单聊联系人设定</p>
            )}

            {/* Hint alert when candidate characters are insufficient */}
            {candidateCharacters.length < 2 && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-700 leading-relaxed font-sans mt-2">
                ⚠️ <strong className="font-bold">人数不足提示：</strong>
                当前通讯录中可用的单聊联系人少于 2 位（目前只有 {candidateCharacters.length} 位）。请先返回<strong className="font-bold">“通讯录”</strong>页面，点击右上角的<strong className="font-bold">“+”</strong>号添加更多角色设定，再回到这里发起多人群聊哦！
              </div>
            )}
          </div>

          {/* World settings background */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
              群背景设定 (Special World Context)
            </label>
            <textarea
              rows={2}
              value={worldBook}
              onChange={(e) => setWorldBook(e.target.value)}
              placeholder="群聊特殊发生场景背景设定 (留空则默认继承通用设定)..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-950 focus:bg-[#f0f0f0] transition-all font-sans leading-relaxed"
            />
          </div>

          {/* Buttons Footer */}
          <div className="pt-2 flex space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-gray-200 bg-[#f0f0f0] hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 h-10 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shadow"
            >
              <Check size={12} className="mr-1.5" />
              确认拉人群聊
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
