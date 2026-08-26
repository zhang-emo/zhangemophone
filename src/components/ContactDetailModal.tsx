import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Trash, Activity, Edit, Edit3, Trash2, Check, Camera, Heart, Compass, Send, ChevronRight, ChevronLeft, Maximize2, MessageSquareQuote } from 'lucide-react';
import { ChatSession, LocalImage, MomentPost, MomentComment, DEFAULT_NARRATION_RULE } from '../lib/types';
import { dbInstance } from '../lib/db';
import { cleanBackgroundText } from '../lib/api';
import ImageCropModal from './ImageCropModal';

const formatDisplayName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*[\(\（].*?[\)\）]/g, '').trim();
};

const safeFormatDate = (ts: any): string => {
  if (!ts) return '刚刚';
  if (typeof ts === 'string') {
    if (ts === '置顶' || ts.includes('前') || ts.includes('月') || ts.includes('刚刚') || ts.includes('-') || ts.includes('/')) {
      return ts;
    }
  }
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts) || '刚刚';
  return d.toLocaleDateString();
};

const safeFormatDateTime = (ts: any): string => {
  if (!ts) return '刚刚';
  if (typeof ts === 'string') {
    if (ts === '置顶' || ts.includes('前') || ts.includes('月') || ts.includes('刚刚')) {
      return ts;
    }
  }
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts) || '刚刚';
  return d.toLocaleString();
};

interface ContactDetailModalProps {
  contact: ChatSession | null;
  initialEditing?: boolean;
  initialShowMomentsPage?: boolean;
  onClose: () => void;
  onSendMessage: () => void;
  onDelete: () => void;
  onEdit: (id: string, updatedFields: {
    nickname: string;
    realName: string;
    gender: string;
    patience: number;
    relationship: string;
    background: string;
    userImpression: string;
    avatar: string;
    narrationModeEnabled?: boolean;
    narrationRuleText?: string;
    onlineProactiveEnabled?: boolean;
    onlineIdleMinutes?: number;
    backgroundProactiveEnabled?: boolean;
    backgroundActiveTimeStart?: string;
    backgroundActiveTimeEnd?: string;
    backgroundFrequency?: 'high' | 'medium' | 'low';
  }) => void;
  localSandboxImages: LocalImage[];
  onRefreshImages: () => void;
  moments?: MomentPost[];
  onLikeMoment?: (id: string) => void;
  onDeleteMoment?: (id: string) => void;
  onAddComment?: (momentId: string, text: string, replyTo?: string) => void;
  onEditComment?: (momentId: string, commentId: string, newText: string) => void;
  onDeleteComment?: (momentId: string, commentId: string) => void;
  onSelectCharacterByName?: (characterName: string) => void;
}

export default function ContactDetailModal({
  contact,
  initialEditing = false,
  initialShowMomentsPage = false,
  onClose,
  onSendMessage,
  onDelete,
  onEdit,
  localSandboxImages,
  onRefreshImages,
  moments = [],
  onLikeMoment,
  onDeleteMoment,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onSelectCharacterByName
}: ContactDetailModalProps) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [deleteMemoryEntryId, setDeleteMemoryEntryId] = useState<string | null>(null);

  // Form states
  const [nickname, setNickname] = useState('');
  const [realName, setRealName] = useState('');
  const [gender, setGender] = useState('男');
  const [relationship, setRelationship] = useState('普通朋友');
  const [patience, setPatience] = useState(80);
  const [background, setBackground] = useState('');
  const [userImpression, setUserImpression] = useState('');
  const [avatar, setAvatar] = useState('');
  const [narrationModeEnabled, setNarrationModeEnabled] = useState<boolean>(true);
  const [narrationRuleText, setNarrationRuleText] = useState<string>(DEFAULT_NARRATION_RULE);

  // Proactive Messaging States
  const [onlineProactiveEnabled, setOnlineProactiveEnabled] = useState<boolean>(false);
  const [onlineIdleMinutes, setOnlineIdleMinutes] = useState<number>(10);
  const [backgroundProactiveEnabled, setBackgroundProactiveEnabled] = useState<boolean>(false);
  const [backgroundActiveTimeStart, setBackgroundActiveTimeStart] = useState<string>('08:00');
  const [backgroundActiveTimeEnd, setBackgroundActiveTimeEnd] = useState<string>('22:00');
  const [backgroundFrequency, setBackgroundFrequency] = useState<'high' | 'medium' | 'low'>('medium');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFullMomentsPage, setShowFullMomentsPage] = useState(initialShowMomentsPage);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Historical memory entries editing state
  const [editingMemoryEntryId, setEditingMemoryEntryId] = useState<string | null>(null);
  const [editingMemoryEntryText, setEditingMemoryEntryText] = useState<string>('');

  // Comments action states
  const [selectedCommentTarget, setSelectedCommentTarget] = useState<{
    momentId: string;
    comment: MomentComment;
  } | null>(null);
  const [editingCommentTarget, setEditingCommentTarget] = useState<{
    momentId: string;
    commentId: string;
    text: string;
  } | null>(null);
  const [replyToMap, setReplyToMap] = useState<{ [momentId: string]: string | undefined }>({});

  // Big Text Editor Modal state
  const [bigTextModal, setBigTextModal] = useState<{
    isOpen: boolean;
    title: string;
    field: 'background' | 'userImpression';
    tempValue: string;
  }>({
    isOpen: false,
    title: '',
    field: 'background',
    tempValue: ''
  });

  // Sync state with contact on open/change
  useEffect(() => {
    if (contact) {
      setNickname(contact.characterName || '');
      setRealName(contact.realName || contact.characterName || '');
      setGender(contact.gender === '男' || contact.gender === '女' ? contact.gender : '男');
      setRelationship(
        contact.relationship === '普通朋友' || 
        contact.relationship === '好友' || 
        contact.relationship === '暧昧对象' || 
        contact.relationship === '恋人&知己' 
          ? contact.relationship 
          : '普通朋友'
      );
      setPatience(contact.patience || 80);
      const rawBg = cleanBackgroundText(contact.memory || '');
      setBackground(rawBg);
      
      let rawImpression = contact.userImpression || '';
      if (!rawImpression && contact.memory && contact.memory.includes('你对用户的看法与态度是：')) {
        const impMatch = contact.memory.match(/你对用户的看法与态度是：\s*([\s\S]*?)(?=\x20*。(?:你的耐心值|你与用户的关系|请始终)|$)/);
        if (impMatch && impMatch[1]) {
          rawImpression = impMatch[1].trim();
        }
      }
      setUserImpression(rawImpression);
      setAvatar(contact.characterAvatar || '👤');
      setNarrationModeEnabled(contact.narrationModeEnabled ?? true);
      setNarrationRuleText(contact.narrationRuleText || DEFAULT_NARRATION_RULE);
      setOnlineProactiveEnabled(contact.onlineProactiveEnabled ?? false);
      setOnlineIdleMinutes(contact.onlineIdleMinutes ?? 10);
      setBackgroundProactiveEnabled(contact.backgroundProactiveEnabled ?? false);
      setBackgroundActiveTimeStart(contact.backgroundActiveTimeStart || '08:00');
      setBackgroundActiveTimeEnd(contact.backgroundActiveTimeEnd || '22:00');
      setBackgroundFrequency(contact.backgroundFrequency || 'medium');
      setIsEditing(initialEditing);
      setShowAvatarSelector(false);
      setShowDeleteConfirm(false);
      setShowFullMomentsPage(!!initialShowMomentsPage);
      setPreviewImage(null);
    }
  }, [contact, initialEditing, initialShowMomentsPage]);

  // Comments state for character moments
  const [activeCommentInputId, setActiveCommentInputId] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<{ [key: string]: string }>({});
  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null);

  if (!contact) return null;

  // Filter moments published by this character
  const characterMoments = (moments || []).filter((m) => {
    if (!contact || !m) return false;
    const charName = contact.characterName || '';
    const rName = contact.realName || '';
    const mCharName = m.characterName || '';
    return (
      (charName && mCharName === charName) ||
      (rName && mCharName === rName) ||
      (charName && mCharName && (mCharName.includes(charName) || charName.includes(mCharName)))
    );
  });

  const handleSendCommentSubmit = (momentId: string) => {
    const text = commentInputs[momentId];
    if (text && text.trim() && onAddComment) {
      onAddComment(momentId, text.trim(), replyToMap[momentId]);
      setCommentInputs((prev) => ({ ...prev, [momentId]: '' }));
      setReplyToMap((prev) => ({ ...prev, [momentId]: undefined }));
      setActiveCommentInputId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawBase64 = event.target?.result as string;
      if (rawBase64) {
        setCropModalSrc(rawBase64);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCroppedAvatarComplete = async (croppedBase64: string) => {
    setAvatar(croppedBase64);
    const imgName = `char_avatar_edit_${Date.now()}.jpg`;
    await dbInstance.saveImage({
      name: imgName,
      data: croppedBase64,
      createdAt: Date.now()
    });
    if (onRefreshImages) {
      onRefreshImages();
    }
  };

  const handleSave = () => {
    if (!nickname.trim()) {
      alert('请填写角色昵称！');
      return;
    }
    onEdit(contact.id, {
      nickname: nickname.trim(),
      realName: realName.trim() || nickname.trim(),
      gender,
      patience,
      relationship,
      background: background.trim(),
      userImpression: userImpression.trim(),
      avatar,
      narrationModeEnabled,
      narrationRuleText: narrationRuleText.trim() || DEFAULT_NARRATION_RULE,
      onlineProactiveEnabled,
      onlineIdleMinutes: Math.max(1, onlineIdleMinutes),
      backgroundProactiveEnabled,
      backgroundActiveTimeStart,
      backgroundActiveTimeEnd,
      backgroundFrequency
    });
    onClose();
  };

  const handleSaveMemoryEntry = async (entryId: string) => {
    if (!contact) return;
    const newText = editingMemoryEntryText.trim();
    if (!newText) return;

    const updatedEntries = (contact.memoryEntries || []).map(e => 
      e.id === entryId ? { ...e, summary: newText } : e
    );

    const updatedSession: ChatSession = {
      ...contact,
      memoryEntries: updatedEntries
    };

    try {
      await dbInstance.saveSession(updatedSession);
      contact.memoryEntries = updatedEntries;
      setEditingMemoryEntryId(null);
    } catch (err) {
      console.error('Failed to update memory entry in contact modal:', err);
    }
  };

  const handleDeleteMemoryEntry = (entryId: string) => {
    setDeleteMemoryEntryId(entryId);
  };

  const confirmDeleteMemoryEntry = async () => {
    if (!contact || !deleteMemoryEntryId) return;
    const entryId = deleteMemoryEntryId;
    const updatedEntries = (contact.memoryEntries || []).filter(e => e.id !== entryId);

    const updatedSession: ChatSession = {
      ...contact,
      memoryEntries: updatedEntries
    };

    try {
      await dbInstance.saveSession(updatedSession);
      contact.memoryEntries = updatedEntries;
    } catch (err) {
      console.error('Failed to delete memory entry in contact modal:', err);
    } finally {
      setDeleteMemoryEntryId(null);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-[#f0f0f0] flex flex-col w-full h-full text-gray-800 overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="h-14 px-4 bg-[#f0f0f0] border-b border-gray-100 flex items-center justify-between shrink-0 select-none">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center space-x-1 text-gray-700 hover:text-gray-950 font-bold text-xs py-1.5 px-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ChevronLeft size={18} />
          <span>返回</span>
        </button>

        <h2 className="text-sm font-black text-gray-900 tracking-tight">
          {isEditing ? '编辑角色设定' : formatDisplayName(contact.characterName)}
        </h2>

        <div className="w-16 flex justify-end">
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs font-bold text-gray-700 hover:text-gray-950 px-2.5 py-1 flex items-center space-x-1 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Edit size={12} />
              <span>编辑</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Feature Page Body */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#f0f0f0]">
        {isEditing ? (
          /* --- EDIT MODE VIEW --- */
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full">
            <div className="flex items-center space-x-2 border-b border-gray-100 pb-2 select-none">
              <Edit size={16} className="text-gray-900" />
              <div>
                <h3 className="text-xs font-black text-gray-900">编辑角色设定</h3>
                <p className="text-[9px] text-gray-400 font-mono mt-0.5 uppercase tracking-wide">EDIT CHARACTER SETUP</p>
              </div>
            </div>

            {/* Avatar Row */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
                角色头像
              </label>
              <div className="flex items-center space-x-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden text-2xl shadow-sm select-none shrink-0">
                  {avatar ? (
                    avatar.startsWith('data:') || avatar.startsWith('http') ? (
                      <img src={avatar} alt="Avatar Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span>{avatar}</span>
                    )
                  ) : (
                    <Camera size={20} className="text-gray-400" />
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                  className="px-2.5 h-7 rounded-[6px] bg-[#f0f0f0] border border-gray-200 hover:bg-gray-50 text-[10px] font-bold text-gray-700 transition-all shadow-sm cursor-pointer"
                >
                  更换头像
                </button>
              </div>

              {/* Avatar Picker Panel */}
              {showAvatarSelector && (
                <div className="bg-gray-50 rounded-[12px] border border-gray-200 p-3 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                    <span className="text-[9px] font-bold text-gray-500">上传或选择头像</span>
                    <button 
                      type="button"
                      onClick={() => setShowAvatarSelector(false)}
                      className="text-[9px] text-gray-400 hover:text-gray-900"
                    >
                      收起
                    </button>
                  </div>

                  <label className="w-full h-7 rounded-[6px] bg-[#f0f0f0] border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-[9px] font-bold text-gray-700 cursor-pointer shadow-sm">
                    <Camera size={10} className="mr-1 text-gray-500" />
                    本地相册上传图片
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>

                  <div className="space-y-1">
                    <span className="text-[8px] text-gray-400 font-bold block uppercase">快捷设定符号：</span>
                    <div className="flex flex-wrap gap-1">
                      {['🔮', '🤖', '🦊', '🌌', '🌟', '🧁', '🕶️', '🎨', '🚀', '♟️'].map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          onClick={() => {
                            setAvatar(symbol);
                            setShowAvatarSelector(false);
                          }}
                          className="w-7 h-7 rounded-[6px] border border-gray-200 hover:border-gray-900 bg-[#f0f0f0] hover:bg-gray-50 flex items-center justify-center text-sm shrink-0 shadow-sm"
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(localSandboxImages || []).length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[8px] text-gray-400 font-bold block uppercase">本地沙盒存储图：</span>
                      <div className="grid grid-cols-5 gap-1">
                        {(localSandboxImages || []).slice(0, 10).map((img) => (
                          <button
                            key={img.name}
                            type="button"
                            onClick={() => {
                              setAvatar(img.data);
                              setShowAvatarSelector(false);
                            }}
                            className="w-8 h-8 rounded-[6px] overflow-hidden border border-gray-200 hover:border-gray-900 bg-[#f0f0f0] flex items-center justify-center shadow-sm shrink-0"
                          >
                            <img src={img.data} alt="thumb" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Inputs Group */}
            <div className="space-y-3">
              {/* Nickname */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 block">昵称 (Nickname) *</label>
                <input
                  type="text"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] transition-all font-sans font-semibold"
                />
              </div>

              {/* Real Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 block">真实姓名 (Real Name)</label>
                <input
                  type="text"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  className="w-full h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] transition-all font-sans font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Gender */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 block">性别 (Gender)</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-gray-900 font-sans font-medium"
                  >
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>

                {/* Relationship */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-500 block">关系 (Relationship)</label>
                  <select
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-gray-900 font-sans font-medium"
                  >
                    <option value="普通朋友">普通朋友</option>
                    <option value="好友">好友</option>
                    <option value="暧昧对象">暧昧对象</option>
                    <option value="恋人&知己">恋人&知己</option>
                  </select>
                </div>
              </div>

              {/* Patience level */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                  <span>耐心值</span>
                  <span className="text-gray-900 font-mono">{patience}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={patience}
                  onChange={(e) => setPatience(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#3C1E1E]"
                />
              </div>

              {/* Character Background with Big Text Modal Option */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-500 block">性格及身份背景设定（记忆与背景设定）</label>
                  <button
                    type="button"
                    onClick={() =>
                      setBigTextModal({
                        isOpen: true,
                        title: '编辑性格及身份背景设定',
                        field: 'background',
                        tempValue: background
                      })
                    }
                    className="text-[10px] font-bold text-gray-700 hover:text-gray-950 flex items-center space-x-1 cursor-pointer"
                  >
                    <Maximize2 size={11} />
                    <span>大文本框</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  placeholder="请输入性格口癖、背景身份与日常经历..."
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] leading-relaxed font-sans"
                />
              </div>



              {/* Date memory cards display */}
              {contact.memoryEntries && contact.memoryEntries.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-bold text-gray-500">
                    <span>历史记忆片段 ({contact.memoryEntries.length})</span>
                    <span className="text-[9px] text-purple-700 font-mono">保留: 最近{contact.memoryRetentionDays || 30}天</span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {contact.memoryEntries.map(entry => {
                      const isValid = !contact.memoryRetentionDays || (Date.now() - entry.timestamp <= (contact.memoryRetentionDays || 30) * 86400000);
                      const isEditingThis = editingMemoryEntryId === entry.id;

                      return (
                        <div key={entry.id} className={`p-2 rounded-xl border text-[11px] transition-all ${isValid ? 'bg-purple-50/50 border-purple-200 text-purple-950' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                          <div className="flex items-center justify-between font-mono font-bold text-[9px] mb-1">
                            <span>📅 {entry.date}</span>
                            <div className="flex items-center space-x-1.5">
                              <span>{isValid ? '🟢 有效保留' : '⚪ 已淡忘'}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingMemoryEntryId(entry.id);
                                  setEditingMemoryEntryText(entry.summary);
                                }}
                                className="p-0.5 text-gray-400 hover:text-purple-700 hover:bg-purple-100 rounded cursor-pointer transition-colors"
                                title="编辑记忆"
                              >
                                <Edit3 size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMemoryEntry(entry.id);
                                }}
                                className="p-0.5 text-gray-400 hover:text-rose-600 hover:bg-rose-100 rounded cursor-pointer transition-colors"
                                title="删除记忆"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>

                          {isEditingThis ? (
                            <div className="space-y-1.5 pt-0.5">
                              <textarea
                                value={editingMemoryEntryText}
                                onChange={(e) => setEditingMemoryEntryText(e.target.value)}
                                rows={2}
                                className="w-full text-[11px] p-2 bg-[#f0f0f0] border border-purple-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500 font-sans leading-relaxed text-gray-900"
                                placeholder="修改记忆内容..."
                              />
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingMemoryEntryId(null)}
                                  className="px-2 py-0.5 text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveMemoryEntry(entry.id)}
                                  disabled={!editingMemoryEntryText.trim()}
                                  className="px-2 py-0.5 text-[10px] font-bold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 rounded transition-colors cursor-pointer"
                                >
                                  保存
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p
                              onClick={() => {
                                setEditingMemoryEntryId(entry.id);
                                setEditingMemoryEntryText(entry.summary);
                              }}
                              className="leading-snug cursor-pointer hover:text-purple-800 transition-colors"
                              title="点击编辑该记忆片段"
                            >
                              {entry.summary}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* View of User (对我的看法) with Big Text Modal Option */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-500 block">对我的看法（角色对用户）</label>
                  <button
                    type="button"
                    onClick={() =>
                      setBigTextModal({
                        isOpen: true,
                        title: '编辑对我的看法（角色对用户）',
                        field: 'userImpression',
                        tempValue: userImpression
                      })
                    }
                    className="text-[10px] font-bold text-gray-700 hover:text-gray-950 flex items-center space-x-1 cursor-pointer"
                  >
                    <Maximize2 size={11} />
                    <span>大文本框</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={userImpression}
                  onChange={(e) => setUserImpression(e.target.value)}
                  placeholder="填写该角色对你的看法或印象（例如：认为你非常温柔贴心，有时会爱开玩笑等）..."
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] leading-relaxed font-sans"
                />
              </div>
            </div>

            {/* Actions for editing */}
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (initialEditing) {
                    onClose();
                  } else {
                    setIsEditing(false);
                  }
                }}
                className="flex-1 h-9 rounded-lg border border-gray-200 bg-[#f0f0f0] hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 h-9 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shadow"
              >
                <Check size={12} className="mr-1" />
                保存设定
              </button>
            </div>

            {/* Delete Contact Button placed directly below Save button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full h-9 rounded-lg border border-rose-100 hover:border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-xs font-bold text-rose-600 transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Trash size={12} className="text-rose-600" />
                <span>删除联系人</span>
              </button>
            </div>
          </div>
        ) : (
          /* --- DISPLAY MODE VIEW (Clean layout with moments preview only) --- */
          <div className="flex-1 flex flex-col justify-between p-4 overflow-y-auto space-y-4">
            <div className="space-y-4">
              {/* Avatar and primary title */}
              <div className="flex flex-col items-center text-center space-y-2 pt-2">
                <div className="w-20 h-20 rounded-full bg-slate-100 border border-slate-200 shadow-md flex items-center justify-center overflow-hidden text-3xl select-none">
                  {contact.characterAvatar && (contact.characterAvatar.startsWith('data:') || contact.characterAvatar.startsWith('http')) ? (
                    <img src={contact.characterAvatar} alt={contact.characterName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{contact.characterAvatar || '👤'}</span>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900">{formatDisplayName(contact.characterName)}</h3>
                  <span className="inline-block px-2.5 py-0.5 bg-gray-100 rounded-full text-[9px] font-bold text-gray-500 uppercase tracking-wide mt-1">
                    {relationship}
                  </span>
                </div>
              </div>

              {/* Dynamic Moments Preview Section */}
              <div className="bg-gray-50/90 rounded-[20px] p-4 border border-gray-100 space-y-3">
                <div className="flex items-center justify-between select-none">
                  <span className="text-xs font-bold text-gray-900 flex items-center">
                    <Compass size={14} className="mr-1.5 text-gray-700" />
                    个人动态 ({characterMoments.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFullMomentsPage(true)}
                    className="text-[11px] font-bold text-gray-600 hover:text-gray-950 flex items-center space-x-0.5 cursor-pointer hover:bg-gray-200/60 px-2 py-1 rounded-lg transition-all"
                  >
                    <span>查看全部</span>
                    <ChevronRight size={13} />
                  </button>
                </div>

                {characterMoments.length > 0 ? (
                  <div className="space-y-2">
                    {characterMoments.slice(0, 2).map((m) => (
                      <div 
                        key={m.id} 
                        onClick={() => setShowFullMomentsPage(true)}
                        className="bg-[#f0f0f0] rounded-xl p-3 border border-gray-200/70 shadow-2xs space-y-2 cursor-pointer hover:border-gray-300 transition-all"
                      >
                        <p className="text-xs text-gray-800 leading-relaxed font-medium line-clamp-3">
                          {m.content}
                        </p>
                        {m.imageName && (
                          <div className="rounded-lg overflow-hidden max-h-28 border border-gray-100 bg-gray-50">
                            {(() => {
                              const imgObj = (localSandboxImages || []).find((img) => img && img.name === m.imageName);
                              if (imgObj) {
                                return <img src={imgObj.data} alt="thumb" className="w-full h-full object-cover" />;
                              }
                              return null;
                            })()}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono pt-1 border-t border-gray-100">
                          <span>{safeFormatDate(m.timestamp)}</span>
                          <span>{m.likes || 0} 赞 · {m.comments?.length || 0} 评论</span>
                        </div>
                      </div>
                    ))}
                    {characterMoments.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setShowFullMomentsPage(true)}
                        className="w-full py-2 text-[11px] font-bold text-gray-500 hover:text-gray-900 bg-[#f0f0f0]/80 hover:bg-[#f0f0f0] rounded-xl border border-gray-200/60 text-center transition-all cursor-pointer shadow-2xs"
                      >
                        查看剩余 {characterMoments.length - 2} 条动态 &rarr;
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-gray-400 font-medium">暂无个人动态</div>
                )}
              </div>
            </div>

            {/* Bottom Send Message Button */}
            <div className="pt-2 shrink-0">
              <button
                type="button"
                onClick={onSendMessage}
                className="w-full h-11 rounded-xl bg-gray-950 hover:bg-gray-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow"
              >
                <MessageSquare size={16} />
                <span>发消息</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* STANDALONE FULL-SCREEN PERSONAL MOMENTS PAGE */}
      {showFullMomentsPage && (
        <div className="absolute inset-0 bg-slate-50 z-50 flex flex-col w-full h-full text-gray-800 overflow-hidden font-sans animate-in slide-in-from-right duration-200">
          {/* Header */}
          <header className="h-14 px-4 bg-[#f0f0f0] border-b border-gray-100 flex items-center justify-between shrink-0 select-none shadow-2xs">
            <button
              type="button"
              onClick={() => {
                if (initialShowMomentsPage) {
                  onClose();
                } else {
                  setShowFullMomentsPage(false);
                }
              }}
              className="flex items-center space-x-1 text-gray-700 hover:text-gray-950 font-bold text-xs py-1.5 px-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <ChevronLeft size={18} />
              <span>返回</span>
            </button>

            <h2 className="text-xs font-black text-gray-900 tracking-tight flex items-center">
              <Compass size={14} className="mr-1.5 text-gray-700" />
              {formatDisplayName(contact.characterName)} 的个人动态
            </h2>

            <div className="w-16 flex justify-end">
              <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {characterMoments.length} 条
              </span>
            </div>
          </header>

          {/* Scrollable Moments List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-lg mx-auto w-full">
            {/* Header Hero Card */}
            <div className="bg-[#f0f0f0] rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center space-x-3 select-none">
              <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden text-2xl shrink-0">
                {contact.characterAvatar && (contact.characterAvatar.startsWith('data:') || contact.characterAvatar.startsWith('http')) ? (
                  <img src={contact.characterAvatar} alt={contact.characterName} className="w-full h-full object-cover" />
                ) : (
                  <span>{contact.characterAvatar || '👤'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-black text-gray-900 truncate">{formatDisplayName(contact.characterName)}</h3>
                  <span className="px-2 py-0.5 bg-gray-100 rounded-full text-[9px] font-bold text-gray-500 shrink-0">
                    {relationship}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">TA 的日常随记与动态日志</p>
              </div>
            </div>

            {/* Posts Stream */}
            {characterMoments.length > 0 ? (
              <div className="space-y-4">
                {characterMoments.map((m) => {
                  const imgObj = m.imageName ? (localSandboxImages || []).find((img) => img && img.name === m.imageName) : null;
                  const isCommentActive = activeCommentInputId === m.id;

                  return (
                    <div key={m.id} className="bg-[#f0f0f0] rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                      {/* Author Header */}
                      <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden text-xs shrink-0">
                            {contact.characterAvatar && (contact.characterAvatar.startsWith('data:') || contact.characterAvatar.startsWith('http')) ? (
                              <img src={contact.characterAvatar} alt={contact.characterName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{contact.characterAvatar || '👤'}</span>
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-900">{formatDisplayName(contact.characterName)}</div>
                            <div className="text-[9px] text-gray-400 font-mono">{safeFormatDateTime(m.timestamp)}</div>
                          </div>
                        </div>

                        {onDeleteMoment && (
                          <button
                            type="button"
                            onClick={() => onDeleteMoment(m.id)}
                            className="text-gray-300 hover:text-rose-500 p-1 rounded-md transition-colors cursor-pointer"
                            title="删除动态"
                          >
                            <Trash size={13} />
                          </button>
                        )}
                      </div>

                      {/* Content */}
                      <p className="text-xs text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">
                        {m.content}
                      </p>

                      {/* Image Attachment */}
                      {imgObj && (
                        <div 
                          onClick={() => setPreviewImage(imgObj.data)}
                          className="rounded-xl overflow-hidden max-h-60 border border-gray-100 bg-gray-50 cursor-pointer hover:opacity-95 transition-opacity"
                        >
                          <img src={imgObj.data} alt="Moment attachment" className="w-full h-full object-cover" />
                        </div>
                      )}

                      {/* Actions Bar */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
                        <button
                          type="button"
                          onClick={() => onLikeMoment?.(m.id)}
                          className="flex items-center space-x-1.5 hover:text-rose-500 font-bold transition-colors cursor-pointer"
                        >
                          <Heart size={14} className={m.likes > 0 ? 'text-rose-500 fill-rose-500' : ''} />
                          <span>{m.likes || 0} 赞</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveCommentInputId(isCommentActive ? null : m.id)}
                          className="flex items-center space-x-1.5 hover:text-gray-900 font-bold transition-colors cursor-pointer"
                        >
                          <MessageSquare size={14} />
                          <span>{m.comments?.length || 0} 评论</span>
                        </button>
                      </div>

                      {/* Comments Section */}
                      {((m.comments && m.comments.length > 0) || isCommentActive) && (
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100/80 space-y-2 text-xs">
                          {m.comments && m.comments.length > 0 && (
                            <div className="space-y-1.5">
                              {m.comments.map((c, idx) => (
                                <div 
                                  key={c.id || idx} 
                                  onClick={() => setSelectedCommentTarget({ momentId: m.id, comment: c })}
                                  className="text-[11px] leading-snug p-1 rounded hover:bg-gray-200/60 transition-colors flex items-center justify-between group cursor-pointer"
                                >
                                  <div className="flex-1 min-w-0">
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectCharacterByName?.(c.senderName);
                                      }}
                                      className="font-bold text-gray-900 cursor-pointer hover:underline hover:text-blue-600"
                                    >
                                      {formatDisplayName(c.senderName)}
                                    </span>
                                    {c.replyTo ? (
                                      <>
                                        <span className="text-gray-400 mx-1">回复</span>
                                        <span 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onSelectCharacterByName?.(c.replyTo!);
                                          }}
                                          className="font-bold text-gray-900 cursor-pointer hover:underline hover:text-blue-600"
                                        >
                                          {formatDisplayName(c.replyTo)}
                                        </span>
                                      </>
                                    ) : null}
                                    <span className="text-gray-800 ml-1">
                                      ：{c.content}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {isCommentActive && (
                            <div className="space-y-1 pt-1 border-t border-gray-200/60">
                              {replyToMap[m.id] && (
                                <div className="flex items-center justify-between bg-blue-50/80 px-2 py-1 rounded-lg text-[10px] text-blue-700 font-bold">
                                  <span>回复 @{formatDisplayName(replyToMap[m.id] || '')}</span>
                                  <button
                                    type="button"
                                    onClick={() => setReplyToMap((prev) => ({ ...prev, [m.id]: undefined }))}
                                    className="text-blue-500 hover:text-blue-900 font-bold px-1 rounded cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                              <div className="flex items-center space-x-1.5">
                                <input
                                  type="text"
                                  value={commentInputs[m.id] || ''}
                                  onChange={(e) => setCommentInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSendCommentSubmit(m.id);
                                  }}
                                  placeholder={replyToMap[m.id] ? `回复 @${formatDisplayName(replyToMap[m.id] || '')}...` : "发表评论..."}
                                  className="flex-1 h-7 px-2.5 bg-[#f0f0f0] border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-gray-900"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSendCommentSubmit(m.id)}
                                  className="h-7 px-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
                                >
                                  <Send size={11} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-[#f0f0f0] rounded-2xl p-8 border border-gray-100 text-center space-y-2 shadow-sm">
                <Compass size={28} className="mx-auto text-gray-300" />
                <div className="text-xs font-bold text-gray-700">暂无发布的个人动态</div>
                <div className="text-[10px] text-gray-400">该角色还没有在朋友圈或个人空间发布过动态碎碎念</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX PREVIEW OVERLAY */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-4 cursor-pointer animate-in fade-in duration-150"
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#f0f0f0]/20 hover:bg-[#f0f0f0]/30 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
          <img src={previewImage} alt="Full view" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {/* BIG TEXT EDIT MODAL OVERLAY */}
      {bigTextModal.isOpen && (
        <div className="absolute inset-0 bg-[#f0f0f0] z-50 flex flex-col p-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0 select-none">
            <h3 className="text-xs font-black text-gray-900">{bigTextModal.title}</h3>
            <button
              type="button"
              onClick={() => setBigTextModal((prev) => ({ ...prev, isOpen: false }))}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 py-3 min-h-0 flex flex-col">
            <textarea
              value={bigTextModal.tempValue}
              onChange={(e) => setBigTextModal((prev) => ({ ...prev, tempValue: e.target.value }))}
              placeholder="在此输入详细的文本设定内容..."
              className="w-full flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] leading-relaxed font-sans resize-none"
            />
          </div>
          <div className="flex space-x-2 pt-2 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={() => setBigTextModal((prev) => ({ ...prev, isOpen: false }))}
              className="flex-1 h-9 rounded-lg border border-gray-200 bg-[#f0f0f0] hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (bigTextModal.field === 'background') {
                  setBackground(bigTextModal.tempValue);
                } else if (bigTextModal.field === 'userImpression') {
                  setUserImpression(bigTextModal.tempValue);
                }
                setBigTextModal((prev) => ({ ...prev, isOpen: false }));
              }}
              className="flex-1 h-9 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shadow"
            >
              <Check size={12} className="mr-1" />
              完成
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-[#f0f0f0] z-50 flex flex-col justify-center items-center p-6 text-center space-y-4 animate-in fade-in duration-200">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-1 select-none">
            <Trash size={20} />
          </div>
          <h4 className="text-sm font-bold text-gray-900 font-sans">确认删除联系人？</h4>
          <p className="text-[11px] text-gray-500 leading-relaxed max-w-[240px] font-sans">
            此操作将彻底抹除角色 <span className="font-bold text-gray-950">“{formatDisplayName(contact.characterName)}”</span> 的全部记忆与消息数据，且不可撤销！
          </p>
          <div className="flex w-full space-x-2 pt-2 max-w-xs">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 h-9 rounded-lg border border-gray-200 bg-[#f0f0f0] hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-all cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex-1 h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center shadow-md shadow-rose-100"
            >
              彻底删除
            </button>
          </div>
        </div>
      )}

      {/* COMMENT ACTION POPOVER MODAL */}
      {selectedCommentTarget && (
        <div 
          onClick={() => setSelectedCommentTarget(null)}
          className="absolute inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-150 select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#f0f0f0] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100 animate-in slide-in-from-bottom duration-200"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
              <h3 className="text-xs font-bold text-gray-900 flex items-center">
                <MessageSquare size={14} className="mr-1.5 text-gray-700" />
                评论操作
              </h3>
              <button 
                type="button"
                onClick={() => setSelectedCommentTarget(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 border border-gray-150/80 max-h-24 overflow-y-auto leading-relaxed">
              <span className="font-bold text-gray-900">{formatDisplayName(selectedCommentTarget.comment.senderName)}: </span>
              <span className="text-gray-800">{selectedCommentTarget.comment.content}</span>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const { momentId, comment } = selectedCommentTarget;
                  setReplyToMap(prev => ({ ...prev, [momentId]: comment.senderName }));
                  setActiveCommentInputId(momentId);
                  setSelectedCommentTarget(null);
                }}
                className="w-full py-2.5 px-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-800 flex items-center justify-between transition-colors cursor-pointer border border-gray-200/60"
              >
                <div className="flex items-center space-x-2">
                  <MessageSquare size={14} className="text-blue-500" />
                  <span>回复评论</span>
                </div>
                <ChevronRight size={14} className="text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const { momentId, comment } = selectedCommentTarget;
                  setEditingCommentTarget({ momentId, commentId: comment.id, text: comment.content });
                  setSelectedCommentTarget(null);
                }}
                className="w-full py-2.5 px-3 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-800 flex items-center justify-between transition-colors cursor-pointer border border-gray-200/60"
              >
                <div className="flex items-center space-x-2">
                  <Edit size={14} className="text-amber-500" />
                  <span>编辑评论</span>
                </div>
                <ChevronRight size={14} className="text-gray-400" />
              </button>

              <button
                type="button"
                onClick={() => {
                  const { momentId, comment } = selectedCommentTarget;
                  onDeleteComment?.(momentId, comment.id);
                  setSelectedCommentTarget(null);
                }}
                className="w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 rounded-xl text-xs font-bold text-rose-600 flex items-center justify-between transition-colors cursor-pointer border border-rose-200/60"
              >
                <div className="flex items-center space-x-2">
                  <Trash size={14} className="text-rose-500" />
                  <span>删除评论</span>
                </div>
                <ChevronRight size={14} className="text-rose-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT COMMENT MODAL */}
      {editingCommentTarget && (
        <div 
          onClick={() => setEditingCommentTarget(null)}
          className="absolute inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-[#f0f0f0] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-gray-100"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
              <h3 className="text-xs font-bold text-gray-900 flex items-center">
                <Edit size={14} className="mr-1.5 text-amber-500" />
                编辑评论
              </h3>
              <button 
                type="button"
                onClick={() => setEditingCommentTarget(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <textarea
              value={editingCommentTarget.text}
              onChange={(e) => setEditingCommentTarget(prev => prev ? { ...prev, text: e.target.value } : null)}
              rows={3}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 font-sans leading-relaxed resize-none"
              placeholder="编辑评论内容..."
            />

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingCommentTarget(null)}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingCommentTarget.text.trim()) {
                    onEditComment?.(editingCommentTarget.momentId, editingCommentTarget.commentId, editingCommentTarget.text.trim());
                    setEditingCommentTarget(null);
                  }
                }}
                className="px-3.5 py-1.5 bg-gray-900 hover:bg-gray-800 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Memory Entry Confirmation Modal */}
      {deleteMemoryEntryId && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除长期记忆片段</h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要删除这条长期记忆片段吗？</p>
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
                onClick={confirmDeleteMemoryEntry}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1:1 Image Cropper Modal */}
      <ImageCropModal
        isOpen={Boolean(cropModalSrc)}
        imageSrc={cropModalSrc || ''}
        onClose={() => setCropModalSrc(null)}
        onCropComplete={handleCroppedAvatarComplete}
        title="裁剪角色头像 (1:1 正方形)"
      />
    </div>
  );
}
