import React, { useState, useEffect } from 'react';
import { User, Calendar, Award, Sparkles, Camera, Check, Edit, Palette, RotateCcw, ChevronLeft, ChevronRight, Wallet, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, XCircle, Maximize2, X } from 'lucide-react';
import { LocalImage } from '../lib/types';
import { dbInstance } from '../lib/db';
import ImageCropModal from './ImageCropModal';
import { 
  ChatTheme, 
  CHAT_THEME_PRESETS, 
  generateChatThemeFromHex, 
  generateChatCssFromTheme 
} from '../lib/chatThemePresets';

export const THEME_PRESETS = {
  warm: generateChatCssFromTheme(CHAT_THEME_PRESETS[0]),
  blue: generateChatCssFromTheme(CHAT_THEME_PRESETS[1]),
  green: generateChatCssFromTheme(CHAT_THEME_PRESETS[2]),
};

interface UserProfile {
  avatar: string;
  userId: string;
  realName: string;
  gender: string;
  birthday: string;
  mbti: string;
  background: string;
}

interface UserProfilePanelProps {
  localSandboxImages: LocalImage[];
  onRefreshImages: () => void;
}

export default function UserProfilePanel({ localSandboxImages, onRefreshImages }: UserProfilePanelProps) {
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('wechat_user_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migrations
        if (!parsed.realName) parsed.realName = '未填写';
        if (parsed.gender !== '男' && parsed.gender !== '女' && parsed.gender !== '保密') {
          parsed.gender = '保密';
        }
        return parsed;
      } catch (e) {}
    }
    return {
      avatar: '',
      userId: 'User_Real',
      realName: '你',
      gender: '保密',
      birthday: '2000-01-01',
      mbti: 'INTJ',
      background: '一位生活在地球上，喜欢通过手机与天南海北的朋友们聊天的普通人。'
    };
  });

  const [activeSubPage, setActiveSubPage] = useState<'main' | 'profile' | 'wallet' | 'theme'>('main');
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile>({ ...profile });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isBigTextOpen, setIsBigTextOpen] = useState(false);
  const [bigTextTemp, setBigTextTemp] = useState('');

  const [transfers, setTransfers] = useState<any[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);

  const loadTransfers = async () => {
    setIsLoadingWallet(true);
    try {
      const allSessions = await dbInstance.getAllSessions();
      const allTransfers: any[] = [];
      const transferRegex = /\[💸\s*转账:\s*([^|]+?)\s*\|\s*备注:\s*([^|]+?)\s*\|\s*状态:\s*([^|\]]+?)\]/;

      for (const session of allSessions) {
        const msgs = await dbInstance.getMessages(session.id);
        const sessionTransfers = msgs
          .filter((m) => m.role === 'assistant' && m.content.includes('[💸 转账:'))
          .map((m) => {
            const match = m.content.match(transferRegex);
            if (!match) return null;
            return {
              id: m.id,
              chatId: session.id,
              characterName: m.senderName || session.characterName,
              characterAvatar: m.senderAvatar || session.characterAvatar,
              amount: parseFloat(match[1].trim()) || 0,
              note: match[2].trim(),
              status: match[3].trim(),
              timestamp: m.timestamp,
              message: m,
            };
          })
          .filter(Boolean);
        
        allTransfers.push(...sessionTransfers);
      }

      allTransfers.sort((a, b) => b.timestamp - a.timestamp);

      const balance = allTransfers
        .filter((t) => t.status === '已领取')
        .reduce((sum, t) => sum + t.amount, 0);

      setTransfers(allTransfers);
      setTotalBalance(balance);
    } catch (err) {
      console.error('Error loading wallet transfers:', err);
    } finally {
      setIsLoadingWallet(false);
    }
  };

  const handleCollectTransferInWallet = async (transfer: any) => {
    const { message, amount, note, chatId } = transfer;
    const amountStr = amount.toFixed(2);
    
    const updatedContent = `[💸 转账: ${amountStr} | 备注: ${note} | 状态: 已领取]`;
    const updatedMsg = {
      ...message,
      content: updatedContent,
    };

    try {
      await dbInstance.saveMessage(updatedMsg);
      
      const sysMsg = {
        id: `sys_collected_${Date.now()}`,
        chatId: chatId,
        role: 'system' as const,
        content: `你已成功领取了 ¥${amountStr} 的转账。`,
        timestamp: Date.now(),
      };
      await dbInstance.saveMessage(sysMsg);

      const session = await dbInstance.getAllSessions().then(list => list.find(s => s.id === chatId));
      if (session && !session.isGroup && message.role === 'user') {
        const aiThanksMsg = {
          id: `ai_thanks_${Date.now()}`,
          chatId: chatId,
          role: 'assistant' as const,
          content: `谢谢老板领了红包！😘 以后要经常给我发福利哦~`,
          timestamp: Date.now() + 100,
        };
        await dbInstance.saveMessage(aiThanksMsg);
      }

      await loadTransfers();
      window.dispatchEvent(new Event('wallet-updated'));
    } catch (err) {
      console.error(err);
      alert('领取转账失败');
    }
  };

  const handleReturnTransferInWallet = async (transfer: any) => {
    const { message, amount, note, chatId } = transfer;
    const amountStr = amount.toFixed(2);
    
    const updatedContent = `[💸 转账: ${amountStr} | 备注: ${note} | 状态: 已退回]`;
    const updatedMsg = {
      ...message,
      content: updatedContent,
    };

    try {
      await dbInstance.saveMessage(updatedMsg);
      
      const sysMsg = {
        id: `sys_returned_${Date.now()}`,
        chatId: chatId,
        role: 'system' as const,
        content: `你已退回了 ¥${amountStr} 的转账。`,
        timestamp: Date.now(),
      };
      await dbInstance.saveMessage(sysMsg);

      await loadTransfers();
      window.dispatchEvent(new Event('wallet-updated'));
    } catch (err) {
      console.error(err);
      alert('退回转账失败');
    }
  };

  useEffect(() => {
    loadTransfers();
    
    const handleWalletUpdateEvent = () => {
      loadTransfers();
    };
    window.addEventListener('wallet-updated', handleWalletUpdateEvent);
    return () => {
      window.removeEventListener('wallet-updated', handleWalletUpdateEvent);
    };
  }, []);

  useEffect(() => {
    if (activeSubPage === 'wallet') {
      loadTransfers();
    }
  }, [activeSubPage]);

  const [currentTheme, setCurrentTheme] = useState<ChatTheme>(() => {
    try {
      const savedTheme = localStorage.getItem('wechat_app_theme');
      if (savedTheme) return JSON.parse(savedTheme);
      const savedPreset = localStorage.getItem('wechat_custom_theme_preset');
      if (savedPreset === 'blue') return CHAT_THEME_PRESETS[1];
      if (savedPreset === 'green') return CHAT_THEME_PRESETS[2];
    } catch (e) {}
    return CHAT_THEME_PRESETS[0];
  });

  const [customHexInput, setCustomHexInput] = useState(() => currentTheme.primary);

  const handleSelectPresetTheme = (preset: ChatTheme) => {
    setCurrentTheme(preset);
    setCustomHexInput(preset.primary);
    localStorage.setItem('wechat_app_theme', JSON.stringify(preset));
    localStorage.setItem('wechat_custom_theme_preset', preset.id);
    localStorage.setItem('wechat_custom_theme_css', generateChatCssFromTheme(preset));
    window.dispatchEvent(new Event('theme-changed'));
  };

  const handleApplyCustomColor = (hex: string) => {
    let formattedHex = hex.trim();
    if (!formattedHex.startsWith('#')) formattedHex = '#' + formattedHex;
    if (!/^#([0-9A-F]{3}){1,2}$/i.test(formattedHex)) return;

    const generated = generateChatThemeFromHex(formattedHex);
    setCurrentTheme(generated);
    localStorage.setItem('wechat_app_theme', JSON.stringify(generated));
    localStorage.setItem('wechat_custom_theme_preset', 'custom');
    localStorage.setItem('wechat_custom_theme_css', generateChatCssFromTheme(generated));
    window.dispatchEvent(new Event('theme-changed'));
  };

  useEffect(() => {
    localStorage.setItem('wechat_user_profile', JSON.stringify(profile));
  }, [profile]);

  const handleSave = () => {
    setProfile(editedProfile);
    localStorage.setItem('wechat_user_profile', JSON.stringify(editedProfile));
    window.dispatchEvent(new Event('user-profile-updated'));
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedProfile({ ...profile });
    setIsEditing(false);
  };

  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null);

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
    setEditedProfile(prev => ({ ...prev, avatar: croppedBase64 }));
    setProfile(prev => {
      const updated = { ...prev, avatar: croppedBase64 };
      localStorage.setItem('wechat_user_profile', JSON.stringify(updated));
      window.dispatchEvent(new Event('user-profile-updated'));
      return updated;
    });

    // Save to sandbox images as well
    const imgName = `user_avatar_${Date.now()}.jpg`;
    await dbInstance.saveImage({
      name: imgName,
      data: croppedBase64,
      createdAt: Date.now()
    });
    onRefreshImages();
  };

  return (
    <div className="relative flex-1 overflow-y-auto bg-gray-50 p-4 space-y-4">
      {/* 1. MAIN PERSONAL CENTER VIEW */}
      {activeSubPage === 'main' && (
        <div className="space-y-4">
          {/* Top Profile Summary Card */}
          <div 
            onClick={() => setActiveSubPage('profile')}
            className="bg-white rounded-[16px] border border-gray-100 shadow-sm p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 transition-all profile-card select-none"
            style={{ backgroundColor: 'var(--theme-card-bg, #ffffff)', borderColor: 'var(--theme-card-border, #f3f4f6)' }}
          >
            <div className="flex items-center space-x-4 min-w-0">
              <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-white shadow overflow-hidden flex items-center justify-center text-2xl shrink-0">
                {profile.avatar ? (
                  <img src={profile.avatar} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-gray-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-gray-900 truncate" style={{ color: 'var(--theme-text-color, #111827)' }}>{profile.userId}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{profile.mbti} • {profile.gender}</p>
                <p className="text-[11px] text-gray-400 mt-1 truncate">{profile.background}</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400 shrink-0 ml-2" />
          </div>

          {/* Feature Navigation List */}
          <div className="bg-white rounded-[16px] border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-100 profile-card" style={{ backgroundColor: 'var(--theme-card-bg, #ffffff)', borderColor: 'var(--theme-card-border, #f3f4f6)' }}>
            {/* 个人资料 */}
            <button
              type="button"
              onClick={() => setActiveSubPage('profile')}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors text-left font-sans select-none focus:outline-none cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
                <span className="text-xs font-bold text-gray-900" style={{ color: 'var(--theme-text-color, #111827)' }}>个人资料</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-400">{profile.realName !== '未填写' ? profile.realName : ''}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </button>

            {/* 我的钱包 */}
            <button
              type="button"
              onClick={() => {
                loadTransfers();
                setActiveSubPage('wallet');
              }}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors text-left font-sans select-none focus:outline-none cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Wallet size={16} />
                </div>
                <span className="text-xs font-bold text-gray-900" style={{ color: 'var(--theme-text-color, #111827)' }}>我的钱包</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs font-bold text-amber-600">余额 ¥{totalBalance.toFixed(2)}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </button>

            {/* 主题 */}
            <button
              type="button"
              onClick={() => setActiveSubPage('theme')}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/60 transition-colors text-left font-sans select-none focus:outline-none cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Palette size={16} />
                </div>
                <span className="text-xs font-bold text-gray-900" style={{ color: 'var(--theme-text-color, #111827)' }}>主题</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-400">
                  {currentTheme.name}
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* 2. PROFILE DETAILS SUB-PAGE */}
      {activeSubPage === 'profile' && (
        <div className="space-y-4">
          {/* Navigation Bar */}
          <div className="flex items-center space-x-2 pb-2 border-b border-gray-100">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setActiveSubPage('main');
              }}
              className="p-1.5 rounded-full hover:bg-gray-200/60 transition-colors text-gray-700 cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-sm font-bold text-gray-900" style={{ color: 'var(--theme-text-color, #111827)' }}>个人资料</h3>
          </div>

          {/* Profile Card */}
          <div className="bg-white rounded-[16px] border border-gray-100 shadow-sm p-6 flex flex-col items-center space-y-4 profile-card" style={{ backgroundColor: 'var(--theme-card-bg, #ffffff)', borderColor: 'var(--theme-card-border, #f3f4f6)' }}>
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-white shadow-md overflow-hidden flex items-center justify-center text-4xl select-none">
                {profile.avatar ? (
                  <img src={profile.avatar} alt="User Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-gray-400" />
                )}
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-all shadow cursor-pointer border-2 border-white"
                >
                  <Camera size={14} />
                </button>
              )}
            </div>

            {/* Avatar Pickers */}
            {isEditing && showAvatarPicker && (
              <div className="bg-gray-50 rounded-[12px] border border-gray-200 p-4 w-full space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-gray-700">更新个人头像</span>
                  <button 
                    type="button"
                    onClick={() => setShowAvatarPicker(false)}
                    className="text-[10px] text-gray-400 hover:text-gray-900"
                  >
                    收起
                  </button>
                </div>
                
                <div className="flex items-center space-x-2">
                  <label className="flex-1 h-8 rounded-[8px] bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-[11px] font-bold text-gray-700 cursor-pointer transition-all shadow-sm">
                    <Camera size={12} className="mr-1.5 text-gray-500" />
                    选择本地照片上传
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                {localSandboxImages.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wide">本地沙盒图库：</span>
                    <div className="grid grid-cols-5 gap-2">
                      {localSandboxImages.slice(0, 10).map((img) => (
                        <button
                          key={img.name}
                          type="button"
                          onClick={() => {
                            setEditedProfile(prev => ({ ...prev, avatar: img.data }));
                            setShowAvatarPicker(false);
                          }}
                          className="w-10 h-10 rounded-[8px] overflow-hidden border border-gray-200 hover:border-gray-900 transition-all flex items-center justify-center bg-white shadow-sm shrink-0"
                        >
                          <img src={img.data} alt="picker thumbnail" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Profile fields */}
            <div className="w-full divide-y divide-gray-100 border-t border-gray-100 pt-2" style={{ borderColor: 'var(--theme-card-border, #f3f4f6)' }}>
              {/* User ID */}
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">用户 ID</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editedProfile.userId} 
                    onChange={(e) => setEditedProfile(prev => ({ ...prev, userId: e.target.value }))}
                    className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-gray-900 w-48 text-right"
                  />
                ) : (
                  <span className="text-xs font-semibold text-gray-500">{profile.userId}</span>
                )}
              </div>

              {/* Real Name */}
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">真实姓名</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editedProfile.realName} 
                    onChange={(e) => setEditedProfile(prev => ({ ...prev, realName: e.target.value }))}
                    className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-gray-900 w-48 text-right"
                  />
                ) : (
                  <span className="text-xs font-semibold text-gray-500">{profile.realName}</span>
                )}
              </div>

              {/* Gender */}
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">性别</span>
                {isEditing ? (
                  <select
                    value={editedProfile.gender}
                    onChange={(e) => setEditedProfile(prev => ({ ...prev, gender: e.target.value }))}
                    className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-gray-900 w-48 text-right appearance-none"
                  >
                    <option value="男">男</option>
                    <option value="女">女</option>
                    <option value="保密">保密</option>
                  </select>
                ) : (
                  <span className="text-xs font-semibold text-gray-500">{profile.gender}</span>
                )}
              </div>

              {/* Birthday */}
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">生日</span>
                {isEditing ? (
                  <input 
                    type="date" 
                    value={editedProfile.birthday} 
                    onChange={(e) => setEditedProfile(prev => ({ ...prev, birthday: e.target.value }))}
                    className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-gray-900 w-48 text-right"
                  />
                ) : (
                  <span className="text-xs font-semibold text-gray-500">{profile.birthday}</span>
                )}
              </div>

              {/* MBTI */}
              <div className="py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">MBTI 人格</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editedProfile.mbti} 
                    onChange={(e) => setEditedProfile(prev => ({ ...prev, mbti: e.target.value.toUpperCase() }))}
                    placeholder="e.g., INTJ"
                    className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-[8px] text-xs font-semibold focus:outline-none focus:border-gray-900 w-48 text-right uppercase"
                  />
                ) : (
                  <span className="text-xs font-semibold text-gray-500 uppercase">{profile.mbti}</span>
                )}
              </div>

              {/* Background Profile */}
              <div className="py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 block">个人背景设定</span>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => {
                        setBigTextTemp(editedProfile.background);
                        setIsBigTextOpen(true);
                      }}
                      className="text-[10px] font-bold text-gray-700 hover:text-gray-950 flex items-center space-x-1 cursor-pointer"
                    >
                      <Maximize2 size={11} />
                      <span>大文本框</span>
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <textarea 
                    rows={3}
                    value={editedProfile.background} 
                    onChange={(e) => setEditedProfile(prev => ({ ...prev, background: e.target.value }))}
                    className="p-3 bg-gray-50 border border-gray-200 rounded-[12px] text-xs font-medium focus:outline-none focus:border-gray-900 w-full leading-relaxed"
                  />
                ) : (
                  <p className="text-xs text-gray-500 leading-relaxed font-medium bg-gray-50 p-3 rounded-[12px] border border-gray-100">
                    {profile.background}
                  </p>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="w-full pt-2">
              {isEditing ? (
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex-1 h-9 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shadow"
                  >
                    <Check size={12} className="mr-1.5" />
                    保存
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full h-9 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shadow"
                >
                  <Edit size={12} className="mr-1.5" />
                  编辑个人资料
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. MY WALLET SUB-PAGE */}
      {activeSubPage === 'wallet' && (
        <div className="space-y-4">
          {/* Navigation Bar */}
          <div className="flex items-center space-x-2 pb-2 border-b border-gray-100">
            <button
              type="button"
              onClick={() => setActiveSubPage('main')}
              className="p-1.5 rounded-full hover:bg-gray-200/60 transition-colors text-gray-700 cursor-pointer"
            >
              <ChevronLeft size={20} />
            </button>
            <h3 className="text-sm font-bold text-gray-900" style={{ color: 'var(--theme-text-color, #111827)' }}>我的钱包</h3>
          </div>

          {/* Balance Overview Card */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 rounded-2xl p-5 border border-amber-100 flex flex-col justify-between relative overflow-hidden shadow-sm">
            <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10 pointer-events-none select-none text-amber-500">
              <Wallet size={120} />
            </div>
            <div className="space-y-1 select-none">
              <span className="text-[10px] text-amber-800 font-extrabold uppercase tracking-wider block">总余额</span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xs font-black text-amber-800">¥</span>
                <span className="text-3xl font-black text-amber-900 tracking-tight">{totalBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Transfer Records */}
          <div className="bg-white rounded-[16px] border border-gray-100 shadow-sm p-4 space-y-3 profile-card" style={{ backgroundColor: 'var(--theme-card-bg, #ffffff)', borderColor: 'var(--theme-card-border, #f3f4f6)' }}>
            <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider block select-none">转账记录</span>
            
            {isLoadingWallet ? (
              <div className="py-8 text-center text-xs text-gray-400 font-medium animate-pulse select-none">
                正在扫描所有聊天会话...
              </div>
            ) : transfers.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400 font-medium bg-gray-50 rounded-xl border border-dashed border-gray-150 select-none">
                钱包空空如也，快去和角色聊天领取红包吧
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {transfers.map((t) => {
                  const dateStr = new Date(t.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div 
                      key={t.id} 
                      className="bg-white hover:bg-gray-50 border border-gray-100/80 rounded-xl p-3 flex items-start justify-between transition-colors shadow-sm relative group"
                      style={{ backgroundColor: 'var(--theme-card-bg, #ffffff)', borderColor: 'var(--theme-card-border, #f3f4f6)' }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="w-9 h-9 rounded-xl overflow-hidden bg-amber-100 border border-amber-200/50 flex items-center justify-center shrink-0 shadow-inner">
                          {t.characterAvatar && (t.characterAvatar.startsWith('data:') || t.characterAvatar.startsWith('http')) ? (
                            <img src={t.characterAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <span className="text-sm select-none">{t.characterAvatar || '🔮'}</span>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-extrabold text-gray-900" style={{ color: 'var(--theme-text-color, #111827)' }}>{t.characterName}</span>
                            <span className="text-[9px] text-gray-400 font-medium">{dateStr}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 font-medium leading-relaxed bg-gray-50/50 px-2 py-0.5 rounded-[6px] border border-gray-100 max-w-[180px] truncate" title={t.note}>
                            {t.note || '转账'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-between self-stretch">
                        <span className="text-xs font-black text-gray-900" style={{ color: 'var(--theme-text-color, #111827)' }}>
                          ¥{t.amount.toFixed(2)}
                        </span>

                        <div className="flex items-center space-x-1.5 mt-2">
                          {t.status === '待领取' ? (
                            <div className="flex space-x-1">
                              <button
                                type="button"
                                onClick={() => handleReturnTransferInWallet(t)}
                                className="h-5 px-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 rounded-[6px] text-[10px] font-bold transition-colors cursor-pointer select-none"
                              >
                                退回
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCollectTransferInWallet(t)}
                                className="h-5 px-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[6px] text-[10px] font-bold transition-colors cursor-pointer shadow-sm select-none"
                              >
                                领取
                              </button>
                            </div>
                          ) : t.status === '已领取' ? (
                            <span className="text-[9px] font-bold text-emerald-600 flex items-center bg-emerald-50 px-1.5 py-0.5 rounded-[4px] border border-emerald-100 select-none">
                              <CheckCircle2 size={9} className="mr-0.5" /> 已领取
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-gray-400 flex items-center bg-gray-50 px-1.5 py-0.5 rounded-[4px] border border-gray-150 select-none">
                              <XCircle size={9} className="mr-0.5" /> 已退回
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. THEME SETTINGS SUB-PAGE */}
      {activeSubPage === 'theme' && (
        <div className="space-y-4">
          {/* Navigation Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveSubPage('main')}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors text-gray-700 cursor-pointer"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-7 h-7 rounded-lg flex items-center justify-center border shadow-2xs"
                  style={{
                    backgroundColor: currentTheme.accentLight,
                    borderColor: currentTheme.primary,
                    color: currentTheme.primary
                  }}
                >
                  <Palette size={14} className="stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-900 leading-none">聊天主题配色</h3>
                  <p className="text-[9px] font-sans text-gray-400 uppercase mt-0.5">CHAT THEME PALETTE</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSelectPresetTheme(CHAT_THEME_PRESETS[0])}
              className="h-8 px-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
              title="恢复默认主题"
            >
              <RotateCcw size={12} />
              <span>恢复默认</span>
            </button>
          </div>

          {/* Theme Content Container */}
          <div className="space-y-4">
            {/* Presets List */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 block uppercase font-sans tracking-wider">
                预设主题风格
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {CHAT_THEME_PRESETS.map((preset) => {
                  const isSelected = currentTheme.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPresetTheme(preset)}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer select-none active:scale-[0.98] ${
                        isSelected
                          ? 'ring-2 shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-gray-50/60 hover:bg-gray-50'
                      }`}
                      style={isSelected ? {
                        borderColor: preset.primary,
                        backgroundColor: preset.accentLight,
                        outlineColor: preset.primary
                      } : undefined}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        {/* Color swatch dots */}
                        <div className="flex -space-x-1.5 shrink-0">
                          <span 
                            className="w-5 h-5 rounded-full border border-white shadow-2xs inline-block z-1" 
                            style={{ backgroundColor: preset.primary }} 
                          />
                          <span 
                            className="w-5 h-5 rounded-full border border-white shadow-2xs inline-block" 
                            style={{ backgroundColor: preset.headerBg }} 
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{preset.name}</p>
                          <p className="text-[9px] text-gray-400 truncate">{preset.description}</p>
                        </div>
                      </div>

                      {isSelected && (
                        <div 
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 ml-1 shadow-2xs"
                          style={{ backgroundColor: preset.primary }}
                        >
                          <Check size={12} className="stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Picker */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Palette size={12} className="text-gray-400" />
                  <label className="text-[10px] font-bold text-gray-400 uppercase font-sans tracking-wider">
                    自定义任意主色调
                  </label>
                </div>
                {currentTheme.isCustom && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                    自定义已生效
                  </span>
                )}
              </div>

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div className="flex items-center space-x-3">
                  {/* Color picker circle */}
                  <div 
                    className="relative w-10 h-10 rounded-lg overflow-hidden border border-gray-300 shadow-2xs shrink-0 cursor-pointer"
                    style={{ backgroundColor: customHexInput }}
                  >
                    <input
                      type="color"
                      value={customHexInput}
                      onChange={(e) => {
                        setCustomHexInput(e.target.value);
                        handleApplyCustomColor(e.target.value);
                      }}
                      className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer opacity-0"
                      title="点击打开取色板"
                    />
                  </div>

                  {/* Hex text input */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={customHexInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomHexInput(val);
                        if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
                          handleApplyCustomColor(val);
                        }
                      }}
                      placeholder="#RRGGBB"
                      className="w-full h-10 px-3 bg-white border border-gray-200 rounded-lg text-xs font-mono font-bold text-gray-800 focus:outline-none focus:border-gray-400"
                    />
                  </div>

                  {/* Apply button */}
                  <button
                    type="button"
                    onClick={() => handleApplyCustomColor(customHexInput)}
                    className="h-10 px-4 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-xs shrink-0"
                  >
                    应用
                  </button>
                </div>

                {/* Quick Swatches */}
                <div className="flex items-center space-x-2 pt-1 overflow-x-auto pb-1 [scrollbar-width:none]">
                  {['#FEE500', '#5980A6', '#788A66', '#E17899', '#8E7CC3', '#D97736', '#4F46E5', '#475569', '#3EA87E', '#009688', '#0EA5E9', '#EC4899'].map((colorHex) => (
                    <button
                      key={colorHex}
                      type="button"
                      onClick={() => {
                        setCustomHexInput(colorHex);
                        handleApplyCustomColor(colorHex);
                      }}
                      className="w-6 h-6 rounded-full border border-white shadow-2xs shrink-0 transition-transform active:scale-90 hover:scale-110 cursor-pointer"
                      style={{ backgroundColor: colorHex }}
                      title={colorHex}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Finish/Back button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setActiveSubPage('main')}
                className="w-full h-10 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold flex items-center justify-center space-x-1.5 transition-all active:scale-[0.99] cursor-pointer shadow-md shadow-gray-200"
              >
                <Check size={14} className="stroke-[3]" />
                <span>完成设置</span>
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
        title="裁剪个人资料头像 (1:1 正方形)"
      />

      {/* Big Text Edit Modal Overlay */}
      {isBigTextOpen && (
        <div className="absolute inset-0 bg-white z-[100] flex flex-col p-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0 select-none">
            <div>
              <h3 className="text-xs font-black text-gray-900">编辑个人背景设定</h3>
              <p className="text-[9px] text-gray-400 font-mono mt-0.5 uppercase tracking-wide">USER BACKGROUND SETTING</p>
            </div>
            <button
              type="button"
              onClick={() => setIsBigTextOpen(false)}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 py-3 min-h-0 flex flex-col">
            <textarea
              value={bigTextTemp}
              onChange={(e) => setBigTextTemp(e.target.value)}
              placeholder="在此输入你的个人身份、生活背景与设定细节..."
              className="w-full flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-white leading-relaxed font-sans resize-none"
            />
          </div>
          <div className="flex space-x-2 pt-2 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={() => setIsBigTextOpen(false)}
              className="flex-1 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                setEditedProfile(prev => ({ ...prev, background: bigTextTemp }));
                setIsBigTextOpen(false);
              }}
              className="flex-1 h-10 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shadow"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
