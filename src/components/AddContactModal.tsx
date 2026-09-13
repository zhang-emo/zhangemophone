import React, { useState } from 'react';
import { X, Camera, Plus, Check, Maximize2 } from 'lucide-react';
import { LocalImage } from '../lib/types';
import { dbInstance } from '../lib/db';
import ImageCropModal from './ImageCropModal';

const RANDOM_PRESETS = [
  {
    nickname: '阿星',
    realName: '星野',
    gender: '男',
    relationship: '好友',
    avatar: '🚀',
    background: '一位热爱天文学与摄影的大学生，性格随和开朗，经常在夜深时分和你分享星空照片。'
  },
  {
    nickname: '舒舒',
    realName: '林舒',
    gender: '女',
    relationship: '暧昧对象',
    avatar: '🎨',
    background: '独立插画师，心思细腻温柔，说话带一点糯糯的鼻音，喜欢在雨天咖啡馆画画。'
  },
  {
    nickname: '言哥',
    realName: '顾言',
    gender: '男',
    relationship: '恋人&知己',
    avatar: '🕶️',
    background: '外表冷峻的建筑设计师，只对你展现幼稚和依赖的一面，占有欲强但极度细心。'
  },
  {
    nickname: '小葵',
    realName: '陆葵',
    gender: '女',
    relationship: '普通朋友',
    avatar: '🧁',
    background: '元气满满的甜品店主，性格活泼热情，总是乐于尝试制作各种新奇口味的蛋糕。'
  }
];

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  localSandboxImages: LocalImage[];
  onRefreshImages: () => void;
  onSave: (character: {
    nickname: string;
    realName: string;
    gender: string;
    background: string;
    userImpression: string;
    patience: number;
    relationship: string;
    avatar: string;
  }) => void;
}

export default function AddContactModal({
  isOpen,
  onClose,
  localSandboxImages,
  onRefreshImages,
  onSave
}: AddContactModalProps) {
  const [nickname, setNickname] = useState('');
  const [realName, setRealName] = useState('');
  const [gender, setGender] = useState('男');
  const [background, setBackground] = useState('');
  const [userImpression, setUserImpression] = useState('');
  const [patience, setPatience] = useState(80);
  const [relationship, setRelationship] = useState('普通朋友');
  const [avatar, setAvatar] = useState('');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
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

  const [cropModalSrc, setCropModalSrc] = useState<string | null>(null);

  if (!isOpen) return null;

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
    const imgName = `char_avatar_${Date.now()}.jpg`;
    await dbInstance.saveImage({
      name: imgName,
      data: croppedBase64,
      createdAt: Date.now()
    });
    onRefreshImages();
  };

  const handleRandomPreset = () => {
    const randomItem = RANDOM_PRESETS[Math.floor(Math.random() * RANDOM_PRESETS.length)];
    setNickname(randomItem.nickname);
    setRealName(randomItem.realName);
    setGender(randomItem.gender);
    setRelationship(randomItem.relationship);
    setAvatar(randomItem.avatar);
    setBackground(randomItem.background);
    setUserImpression('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      alert('请填写角色昵称！');
      return;
    }
    onSave({
      nickname: nickname.trim(),
      realName: realName.trim() || nickname.trim(),
      gender,
      background: background.trim() || '一个神秘的异地伙伴。',
      userImpression: userImpression.trim(),
      patience,
      relationship,
      avatar: avatar || '🌟'
    });
    
    // Reset form
    setNickname('');
    setRealName('');
    setGender('男');
    setBackground('');
    setUserImpression('');
    setPatience(80);
    setRelationship('普通朋友');
    setAvatar('');
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="bg-[#f0f0f0] rounded-t-[24px] max-h-[90%] flex flex-col overflow-hidden shadow-2xl relative text-gray-800">
        {/* Header */}
        <div className="p-4 px-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center space-x-2">
            <Plus className="text-gray-900" size={20} />
            <div>
              <h2 className="text-lg font-bold text-gray-900">添加新人设</h2>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase tracking-wide">ADD NEW AI CHARACTER</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          
          {/* Avatar Selector row */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
              角色头像 (Character Avatar)
            </label>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden text-2xl shadow-sm select-none shrink-0">
                {avatar ? (
                  avatar.startsWith('data:') || avatar.startsWith('http') ? (
                    <img src={avatar} alt="New Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span>{avatar}</span>
                  )
                ) : (
                  <Camera size={24} className="text-gray-400" />
                )}
              </div>
              
              <div className="flex flex-col space-y-1">
                <button
                  type="button"
                  onClick={() => setShowAvatarSelector(!showAvatarSelector)}
                  className="px-3 h-8 rounded-[8px] bg-[#f0f0f0] border border-gray-200 hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-all shadow-sm cursor-pointer"
                >
                  点击更换头像
                </button>
                <span className="text-[9px] text-gray-400 font-medium">支持本地相册上传，或从沙盒图库选取</span>
              </div>
            </div>

            {/* Expanded Avatar Gallery Selector */}
            {showAvatarSelector && (
              <div className="bg-gray-50 rounded-[12px] border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-1.5">
                  <span className="text-[10px] font-bold text-gray-600">上传或选择头像</span>
                  <button 
                    type="button"
                    onClick={() => setShowAvatarSelector(false)}
                    className="text-[9px] text-gray-400 hover:text-gray-900"
                  >
                    关闭
                  </button>
                </div>

                {/* System File Uploader */}
                <div className="flex items-center space-x-2">
                  <label className="flex-1 h-8 rounded-[8px] bg-[#f0f0f0] border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-[10px] font-bold text-gray-700 cursor-pointer shadow-sm">
                    <Camera size={12} className="mr-1.5 text-gray-500" />
                    从手机/电脑相册上传图片
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                {/* Preloaded symbol choices */}
                <div className="space-y-1">
                  <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wide">快捷设定符号：</span>
                  <div className="flex flex-wrap gap-1">
                    {['🔮', '🤖', '🦊', '🌌', '🌟', '🧁', '🕶️', '🎨', '🚀', '♟️'].map((symbol) => (
                      <button
                        key={symbol}
                        type="button"
                        onClick={() => {
                          setAvatar(symbol);
                          setShowAvatarSelector(false);
                        }}
                        className="w-8 h-8 rounded-[8px] border border-gray-200 hover:border-gray-900 bg-[#f0f0f0] hover:bg-gray-50 transition-all flex items-center justify-center text-md shrink-0 shadow-sm"
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sandboxed Images List */}
                {localSandboxImages.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wide">本地沙盒存储图：</span>
                    <div className="grid grid-cols-5 gap-1.5">
                      {localSandboxImages.map((img) => (
                        <button
                          key={img.name}
                          type="button"
                          onClick={() => {
                            setAvatar(img.data);
                            setShowAvatarSelector(false);
                          }}
                          className="w-10 h-10 rounded-[8px] overflow-hidden border border-gray-200 hover:border-gray-900 bg-[#f0f0f0] flex items-center justify-center shadow-sm shrink-0"
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

          {/* Form Fields: Two Column Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Nickname */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                昵称 * (Nickname)
              </label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder=""
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] transition-all font-sans font-semibold"
              />
            </div>

            {/* Real Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                真实姓名 (Real Name)
              </label>
              <input
                type="text"
                value={realName}
                onChange={(e) => setRealName(e.target.value)}
                placeholder=""
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] transition-all font-sans font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Gender */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                性别 (Gender)
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] transition-all font-sans font-medium"
              >
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>

            {/* Relationship */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                与用户的关系 (Relationship)
              </label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] transition-all font-sans font-medium"
              >
                <option value="普通朋友">普通朋友</option>
                <option value="好友">好友</option>
                <option value="暧昧对象">暧昧对象</option>
                <option value="恋人&知己">恋人&知己</option>
              </select>
            </div>
          </div>

          {/* Patience slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-wide">
              <span>耐心值 (Patience level)</span>
              <span className="text-gray-900 text-xs font-mono">{patience}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={patience}
              onChange={(e) => setPatience(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#3C1E1E]"
            />
          </div>

          {/* Background profile */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                身份背景设定 (Character Background Biography)
              </label>
              <button
                type="button"
                onClick={() => {
                  setBigTextModal({
                    isOpen: true,
                    title: '编辑身份背景设定',
                    field: 'background',
                    tempValue: background
                  });
                }}
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
              placeholder="请输入角色的身份背景、生活经历与性格特色...（可选）"
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-950 focus:bg-[#f0f0f0] transition-all font-sans leading-relaxed resize-none"
            />
          </div>

          {/* User Impression (对我的看法) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                对我的看法 (Opinion on Me)
              </label>
              <button
                type="button"
                onClick={() => {
                  setBigTextModal({
                    isOpen: true,
                    title: '编辑对我的看法',
                    field: 'userImpression',
                    tempValue: userImpression
                  });
                }}
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
              placeholder="填写该角色对我的看法或初步印象（例如：初次见面觉得对方靠谱、暗生情愫、或有些警惕防备等）..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-950 focus:bg-[#f0f0f0] transition-all font-sans leading-relaxed resize-none"
            />
          </div>

          {/* Buttons Footer */}
          <div className="pt-4 flex space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border border-gray-200 bg-[#f0f0f0] hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 h-12 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors cursor-pointer flex items-center justify-center shadow"
            >
              <Check size={16} className="mr-2" />
              写入核心并创建
            </button>
          </div>

        </form>

        {/* Big Text Edit Modal Overlay */}
        {bigTextModal.isOpen && (
          <div className="absolute inset-0 bg-[#f0f0f0] z-50 flex flex-col p-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 shrink-0 select-none">
              <div>
                <h3 className="text-xs font-black text-gray-900">{bigTextModal.title}</h3>
                <p className="text-[9px] text-gray-400 font-mono mt-0.5 uppercase tracking-wide">
                  {bigTextModal.field === 'background' ? 'CHARACTER BACKGROUND BIOGRAPHY' : 'OPINION ON ME'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBigTextModal(prev => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 py-3 min-h-0 flex flex-col">
              <textarea
                value={bigTextModal.tempValue}
                onChange={(e) => setBigTextModal(prev => ({ ...prev, tempValue: e.target.value }))}
                placeholder={
                  bigTextModal.field === 'background'
                    ? "在此输入详细的性格口癖、背景身份、日常经历与与我的过往互动..."
                    : "在此输入角色对我的详细看法、心理评价、信任程度或情感态度..."
                }
                className="w-full flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] leading-relaxed font-sans resize-none"
              />
            </div>
            <div className="flex space-x-2 pt-2 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setBigTextModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 h-10 rounded-xl border border-gray-200 bg-[#f0f0f0] hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (bigTextModal.field === 'background') {
                    setBackground(bigTextModal.tempValue);
                  } else {
                    setUserImpression(bigTextModal.tempValue);
                  }
                  setBigTextModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="flex-1 h-10 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shadow"
              >
                <Check size={12} className="mr-1.5" />
                完成
              </button>
            </div>
          </div>
        )}
      </div>

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
