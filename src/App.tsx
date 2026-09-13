/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import PhoneFrame from './components/PhoneFrame';
import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';
import CalendarView from './components/CalendarView';
import ForumView from './components/ForumView';
import WorldBookView from './components/WorldBookView';
import DiaryView from './components/DiaryView';
import RelationshipNetworkView from './components/RelationshipNetworkView';
import PhoneInspectorView from './components/PhoneInspectorView';
import FanficApp from './components/FanficApp';
import MemoryAppView from './components/MemoryAppView';
import GameCenterView from './components/GameCenterView';
import DesktopGridView from './components/DesktopGridView';
import {
  MessageCircle,
  PenTool,
  Settings,
  Phone,
  Compass,
  Image as ImageIcon,
  Camera,
  Sun,
  CloudSun,
  Moon,
  Volume2,
  CloudRain,
  FolderOpen,
  Search,
  Heart,
  Music,
  Share2,
  Calendar,
  Sparkles,
  Bot,
  Upload,
  Trash2,
  Users,
  MessageSquare,
  BookOpen,
  BookHeart,
  HeartHandshake,
  ScanSearch,
  Brain,
  Check,
  Gamepad2,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbInstance } from './lib/db';
import { THEME_PRESETS, getPresetById, DEFAULT_PRESET_ID } from './lib/themePresets';
import { ErrorBoundary } from './components/ErrorBoundary';

const WEATHER_TIPS = [
  "22°C 多云转晴 / 气候极为舒适",
  "24°C 清晨和风 / 适宜在窗前读书",
  "21°C 微风徐徐 / 脑力状态极好",
  "23°C 阳光温和 / 适宜出门喝杯拿铁"
];

export default function App() {
  const [activeScreen, setActiveScreen] = useState<'home' | 'chat' | 'settings' | 'calendar' | 'forum' | 'worldbook' | 'diary' | 'relationship' | 'inspector' | 'memory' | 'fanfic' | 'games'>('home');
  const [presetId, setPresetId] = useState<string>(() => {
    return localStorage.getItem('desktop_preset_id') || DEFAULT_PRESET_ID;
  });
  const [presetFilter, setPresetFilter] = useState<'all' | 'light' | 'dark'>('all');
  
  const [customWallpaper, setCustomWallpaper] = useState<string | null>(() => {
    return localStorage.getItem('desktop_custom_wallpaper') || null;
  });
  const [wallpaperMode, setWallpaperMode] = useState<'preset' | 'custom'>(() => {
    return (localStorage.getItem('desktop_wallpaper_mode') as 'preset' | 'custom') || 'preset';
  });
  const [iconStyle, setIconStyle] = useState<'default' | 'transparent_white' | 'transparent_black'>(() => {
    return (localStorage.getItem('desktop_icon_style') as 'default' | 'transparent_white' | 'transparent_black') || 'default';
  });
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showWallpaperDeleteConfirm, setShowWallpaperDeleteConfirm] = useState(false);

  const currentPreset = getPresetById(presetId);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeWeatherIndex, setActiveWeatherIndex] = useState(0);
  
  // Custom interactive easter egg screens inside desktop
  const [showBrowser, setShowBrowser] = useState(false);
  const [showCameraMode, setShowCameraMode] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Dynamic chat unread badge count (persisted via localStorage)
  const [chatUnreadCount, setChatUnreadCount] = useState<number>(() => {
    const saved = localStorage.getItem('chat_unread_count');
    return saved !== null ? Number(saved) : 0;
  });

  const handleOpenChat = () => {
    setActiveScreen('chat');
    setChatUnreadCount(0);
    localStorage.setItem('chat_unread_count', '0');
  };

  // Update dynamic clock every second for precision display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Swap some weather tips slowly
    const weatherTimer = setInterval(() => {
      setActiveWeatherIndex(prev => (prev + 1) % WEATHER_TIPS.length);
    }, 10000);

    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
    };
  }, []);

  const formatDayOfWeek = (date: Date) => {
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return days[date.getDay()];
  };

  const formatMonthDate = (date: Date) => {
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // Mock Camera shutter effect
  const handleCapturePhoto = () => {
    const canvasId = Math.floor(Math.random() * 8) + 1;
    // Generate lovely colorful gradient simulated camera frame snapshot
    const gradientImg = `https://images.unsplash.com/photo-${1600000000000 + canvasId*10000}?w=400&auto=format&fit=crop&q=60`;
    setCapturedPhoto(gradientImg);
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setCustomWallpaper(base64);
        setWallpaperMode('custom');
        localStorage.setItem('desktop_custom_wallpaper', base64);
        localStorage.setItem('desktop_wallpaper_mode', 'custom');
      }
    };
    reader.readAsDataURL(file);
  };

  // Dynamic icon styling helpers
  const getIconContainerClasses = (defaultBgClass: string, defaultBorderClass?: string, defaultShadowClass?: string) => {
    if (iconStyle === 'transparent_white' || iconStyle === 'transparent_black') {
      return 'bg-transparent border-transparent shadow-none';
    }
    return `${defaultBgClass} ${defaultBorderClass || ''} ${defaultShadowClass || ''}`;
  };

  const getIconSvgColor = (defaultColorClass: string) => {
    if (iconStyle === 'transparent_white') {
      return 'text-white stroke-[2.2]';
    }
    if (iconStyle === 'transparent_black') {
      return 'text-black stroke-[2.2]';
    }
    return defaultColorClass;
  };

  const dynamicAppLabelColor = (() => {
    if (iconStyle === 'transparent_white') {
      return 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] font-semibold';
    }
    if (iconStyle === 'transparent_black') {
      return 'text-black drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)] font-semibold';
    }
    return currentPreset.appLabelColor;
  })();

  return (
    <PhoneFrame 
      isHomeScreen={activeScreen === 'home'} 
      isLightMode={currentPreset.isLight}
      onHome={() => {
        setActiveScreen('home');
        // close any overlay modals on physical home key tap
        setShowBrowser(false);
        setShowCameraMode(false);
        setShowWallpaperPicker(false);
      }}
    >
      <div 
        className={`flex-1 flex flex-col overflow-hidden relative transition-all duration-700 ${
          activeScreen === 'home' 
            ? (wallpaperMode === 'custom' && customWallpaper ? 'bg-cover bg-center' : currentPreset.wallpaperClass) 
            : 'bg-[#F9FCFF]'
        }`}
        style={activeScreen === 'home' && wallpaperMode === 'custom' && customWallpaper ? {
          backgroundImage: `url(${customWallpaper})`
        } : undefined}
      >
        
        <AnimatePresence mode="wait">
          
          {/* --- VIEW 1: HOME SCREEN DESKTOP --- */}
          {activeScreen === 'home' && (
            <motion.div 
              key="desktop"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex-1 flex flex-col justify-between p-2 relative select-none overflow-hidden"
            >
              {/* 4x7 Desktop Area with Long-press drag-and-drop */}
              <div className="flex-1 w-full flex flex-col overflow-hidden min-h-0">
                <DesktopGridView
                  currentPreset={currentPreset}
                  iconStyle={iconStyle}
                  dynamicAppLabelColor={dynamicAppLabelColor}
                  getIconContainerClasses={getIconContainerClasses}
                  getIconSvgColor={getIconSvgColor}
                  currentTime={currentTime}
                  chatUnreadCount={chatUnreadCount}
                  onOpenApp={(screen) => {
                    if (screen === 'chat') {
                      handleOpenChat();
                    } else {
                      setActiveScreen(screen);
                    }
                  }}
                  formatMonthDate={formatMonthDate}
                  formatDayOfWeek={formatDayOfWeek}
                />
              </div>

              {/* Bottom Hot Dock bar (Independent from 4x7 grid) */}
              <div className="shrink-0 pt-1 pb-1 px-2">
                <div className="p-2.5 flex items-center justify-around gap-3">
                  
                  {/* Dock item 1: Browser */}
                  <button 
                    type="button"
                    onClick={() => setShowBrowser(true)}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[20px] ${getIconContainerClasses(currentPreset.dockBrowserBg)} flex items-center justify-center ${getIconSvgColor(currentPreset.dockBrowserIcon || 'text-white')} ${iconStyle === 'default' ? 'shadow-md shadow-black/10' : ''} transition-transform focus:outline-none hover:scale-105 active:scale-95 cursor-pointer`}
                    title="浏览器"
                  >
                    <Compass size={26} className="stroke-[2.2]" />
                  </button>

                  {/* Dock item 2: Wallpaper & Theme Preset Switcher */}
                  <button 
                    type="button"
                    onClick={() => setShowWallpaperPicker(true)}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[20px] ${getIconContainerClasses(currentPreset.dockWallpaperBg)} flex items-center justify-center ${getIconSvgColor(currentPreset.dockWallpaperIcon || 'text-white')} ${iconStyle === 'default' ? 'shadow-md shadow-black/10' : ''} transition-transform focus:outline-none hover:scale-105 active:scale-95 cursor-pointer`}
                    title="切换桌面主题与外观"
                  >
                    <Sparkles size={26} className="stroke-[2.2]" />
                  </button>

                  {/* Dock item 3: System Settings */}
                  <button 
                    type="button"
                    onClick={() => setActiveScreen('settings')}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[20px] ${getIconContainerClasses(currentPreset.dockSettingsBg)} flex items-center justify-center ${getIconSvgColor(currentPreset.dockSettingsIcon)} ${iconStyle === 'default' ? 'shadow-md shadow-black/10' : ''} transition-transform focus:outline-none hover:scale-105 active:scale-95 cursor-pointer`}
                    title="系统设置"
                  >
                    <Settings size={26} className="stroke-[2.2]" />
                  </button>

                  {/* Dock item 4: Retro Camera */}
                  <button 
                    type="button"
                    onClick={() => setShowCameraMode(true)}
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-[20px] ${getIconContainerClasses(currentPreset.dockCameraBg)} flex items-center justify-center ${getIconSvgColor(currentPreset.dockCameraIcon || 'text-white')} ${iconStyle === 'default' ? 'shadow-md shadow-black/10' : ''} transition-transform focus:outline-none hover:scale-105 active:scale-95 cursor-pointer`}
                    title="模拟相机"
                  >
                    <Camera size={26} className="stroke-[2.2]" />
                  </button>

                </div>
              </div>

              {/* --- PORTABLE MODAL: PHONE DIALER MODAL REMOVED --- */}

              {/* --- PORTABLE MODAL: DIMENSIONAL BROWSER DIALOG --- */}
              <AnimatePresence>
                {showBrowser && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-x-2 top-2 bottom-2 bg-white rounded-3xl shrink-0 z-30 font-sans shadow-2xl flex flex-col justify-between overflow-hidden text-gray-800"
                  >
                    {/* Header Bar */}
                    <div className="h-12 bg-gray-100 border-b border-gray-200 px-4 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-400 block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 block" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-400 block" />
                        <div className="ml-2 font-mono text-[10px] bg-white border border-gray-200 px-3 py-0.5 rounded-full text-gray-500 truncate max-w-[170px]" title="https://ai.portal.net">
                          https://ai.portal.net
                        </div>
                      </div>
                      <button 
                        onClick={() => setShowBrowser(false)}
                        className="text-[10px] font-black text-gray-500 hover:text-black py-1 px-2.5 rounded bg-gray-200"
                      >
                        退出
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                      <div className="space-y-1">
                        <span className="text-[9px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded-md uppercase font-mono">PREVIEW SOURCE</span>
                        <h3 className="text-xs font-black text-gray-900 block mt-1">快捷导航 / 系统使用精选指南</h3>
                        <p className="text-[10px] text-gray-500">欢迎访问快捷导航！这里列出了可以帮助您配置或体验 AI 好友的项目说明：</p>
                      </div>

                      <div className="space-y-2">
                        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/40 text-xs">
                          <span className="font-extrabold text-amber-900 flex items-center space-x-1.5">
                            <Users size={13} className="text-amber-700" />
                            <span>开启多人群聊</span>
                          </span>
                          <p className="text-[10px] text-amber-800 leading-relaxed mt-0.5">
                            点击主界面的“+群聊”可以邀请多位成员入群，进行多方会谈，互相进行有趣的日常互动调侃！
                          </p>
                        </div>

                        <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-700">
                          <span className="font-extrabold text-gray-900 flex items-center space-x-1.5">
                            <Shield size={13} className="text-indigo-600" />
                            <span>首选 API Key 安全机制</span>
                          </span>
                          <p className="text-[10px] text-gray-500 leading-relaxed mt-0.5">
                            进入 <strong>[系统设置]</strong> 可提供您自己的 OpenAI / DeepSeek / Claude 模型 Key 开启真实的聊天脑神经回答！
                          </p>
                        </div>
                      </div>

                      <div className="bg-sky-50 text-center py-4 rounded-xl border border-sky-100 p-2 text-[10px]">
                        <span className="font-black text-sky-800 flex items-center justify-center space-x-1.5">
                          <Sparkles size={13} className="text-sky-600" />
                          <span>AI Studio 已深度保障系统运转</span>
                        </span>
                        <p className="text-sky-600 mt-1">
                          本地模拟 SQLite (IndexedDB) 存储机制自动全天候运转，保障聊天和沙盒无损。
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 border-t border-gray-100 text-center text-[9px] font-mono text-gray-400">
                      VIRTUAL BROWSER ENGINE v1.1
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* --- PORTABLE MODAL: CAMERA SIMULATOR --- */}
              <AnimatePresence>
                {showCameraMode && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute inset-0 bg-black z-30 font-sans p-6 text-white flex flex-col justify-between rounded-[32px]"
                  >
                    <div className="flex justify-between items-center text-xs p-2">
                      <span className="font-mono text-amber-400 font-extrabold">RETRO FOCUS MODE</span>
                      <button 
                        onClick={() => { setShowCameraMode(false); setCapturedPhoto(null); }}
                        className="p-1 px-3 bg-white/20 rounded-md font-mono"
                      >
                        CLOSE
                      </button>
                    </div>

                    {/* Shutter Viewport */}
                    <div className="w-full aspect-square bg-slate-900 rounded-3xl overflow-hidden border border-white/10 flex items-center justify-center relative">
                      {capturedPhoto ? (
                        <img src={capturedPhoto} alt="Mock Shutter" className="w-full h-full object-cover animate-fade-in" />
                      ) : (
                        <div className="text-center space-y-2 flex flex-col items-center justify-center">
                          <Camera className="w-10 h-10 text-white/40 animate-pulse" />
                          <span className="text-[10px] font-mono text-gray-400">镜头未开启 / 点击快门捕捉测试插画</span>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 text-[8px] font-mono bg-black/60 p-1 rounded">ISO 800 - 1/125s</div>
                    </div>

                    {/* Actions and trigger btn */}
                    <div className="space-y-3 text-center pb-6">
                      <div className="flex justify-center items-center space-x-6">
                        <button 
                          onClick={() => setCapturedPhoto(null)} 
                          className="text-xs text-gray-400 font-semibold cursor-pointer active:scale-90"
                        >
                          重置镜头
                        </button>
                        
                        {/* Huge round Shutter Button */}
                        <button 
                          onClick={handleCapturePhoto}
                          className="w-16 h-16 bg-white hover:bg-gray-100 active:scale-90 rounded-full border-4 border-gray-400/50 flex items-center justify-center transition-all cursor-pointer shadow-lg"
                        >
                          <span className="w-12 h-12 bg-white rounded-full block border" />
                        </button>

                        <button 
                          onClick={async () => {
                            if (!capturedPhoto) {
                              alert('请先拍照生成图片素材！');
                              return;
                            }
                            alert('正在把当前拍摄的照片插画自动输出并备份到本地 IndexedDB 图片沙箱 `/images` 文件夹中！');
                            
                            try {
                              const imgUuid = `shutter_capture_${Date.now()}.png`;
                              const imgObj = {
                                name: imgUuid,
                                data: capturedPhoto,
                                createdAt: Date.now()
                              };
                              // Save straight to indexedDB folder sandbox via dbInstance
                              await dbInstance.saveImage(imgObj);
                            } catch (e) {}

                            setShowCameraMode(false);
                            setActiveScreen('settings');
                          }}
                          disabled={!capturedPhoto}
                          className="text-xs text-emerald-400 font-bold disabled:opacity-30 cursor-pointer active:scale-95"
                        >
                          保存图至相册
                        </button>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        提示：点击中间按钮即可借助 Unsplash 自动捕获美丽的照片。
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* --- PORTABLE MODAL: THEME PRESETS & WALLPAPER PICKER DIALOG --- */}
              <AnimatePresence>
                {showWallpaperPicker && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-x-2 top-2 bottom-2 bg-white rounded-3xl shrink-0 z-30 font-sans shadow-2xl flex flex-col justify-between overflow-hidden text-gray-800"
                  >
                    {/* Header Bar */}
                    <div className="h-12 bg-gray-100 border-b border-gray-200 px-4 flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <Sparkles size={16} className="text-purple-600" />
                        <span className="text-xs font-black text-gray-900">桌面主题预设中心</span>
                      </div>
                      <button 
                        onClick={() => setShowWallpaperPicker(false)}
                        className="text-[10px] font-black text-gray-500 hover:text-black py-1 px-2.5 rounded bg-gray-200 cursor-pointer"
                      >
                        关闭
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                      
                      {/* Icon Style Segmented Selector */}
                      <div className="space-y-2 pb-3 border-b border-gray-100">
                        <div className="flex justify-between items-center px-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">图标风格外观</span>
                          <span className="text-[10px] text-purple-600 font-bold">独立切换桌面与Dock图案</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {/* Option 1: 默认彩色 */}
                          <button
                            type="button"
                            onClick={() => {
                              setIconStyle('default');
                              localStorage.setItem('desktop_icon_style', 'default');
                            }}
                            className={`p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center space-y-1.5 cursor-pointer relative ${
                              iconStyle === 'default'
                                ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-100 shadow-sm'
                                : 'border-gray-200/80 bg-gray-50/60 hover:bg-gray-100/80'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-rose-400 to-indigo-500 flex items-center justify-center shadow-xs">
                              <Sparkles size={18} className="text-white" />
                            </div>
                            <div className="text-center">
                              <span className="text-[11px] font-black text-gray-900 block">默认彩色</span>
                              <span className="text-[9px] text-gray-400 block mt-0.5">跟随预设主题</span>
                            </div>
                            {iconStyle === 'default' && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                                <Check size={10} className="stroke-[3]" />
                              </div>
                            )}
                          </button>

                          {/* Option 2: 极简纯白透明 */}
                          <button
                            type="button"
                            onClick={() => {
                              setIconStyle('transparent_white');
                              localStorage.setItem('desktop_icon_style', 'transparent_white');
                            }}
                            className={`p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center space-y-1.5 cursor-pointer relative ${
                              iconStyle === 'transparent_white'
                                ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-100 shadow-sm'
                                : 'border-gray-200/80 bg-gray-50/60 hover:bg-gray-100/80'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-xs">
                              <MessageCircle size={18} className="text-white stroke-[2.2]" />
                            </div>
                            <div className="text-center">
                              <span className="text-[11px] font-black text-gray-900 block">极简纯白透明</span>
                              <span className="text-[9px] text-gray-400 block mt-0.5">100% 透明无底</span>
                            </div>
                            {iconStyle === 'transparent_white' && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                                <Check size={10} className="stroke-[3]" />
                              </div>
                            )}
                          </button>

                          {/* Option 3: 极简纯黑透明 */}
                          <button
                            type="button"
                            onClick={() => {
                              setIconStyle('transparent_black');
                              localStorage.setItem('desktop_icon_style', 'transparent_black');
                            }}
                            className={`p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center space-y-1.5 cursor-pointer relative ${
                              iconStyle === 'transparent_black'
                                ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-100 shadow-sm'
                                : 'border-gray-200/80 bg-gray-50/60 hover:bg-gray-100/80'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-xl bg-gray-100 border border-gray-300 flex items-center justify-center shadow-xs">
                              <MessageCircle size={18} className="text-black stroke-[2.2]" />
                            </div>
                            <div className="text-center">
                              <span className="text-[11px] font-black text-gray-900 block">极简纯黑透明</span>
                              <span className="text-[9px] text-gray-400 block mt-0.5">100% 透明无底</span>
                            </div>
                            {iconStyle === 'transparent_black' && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                                <Check size={10} className="stroke-[3]" />
                              </div>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Category Filter Tabs: 全部 / 浅色预设 / 深色预设 */}
                      <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl text-[11px] font-bold text-gray-600">
                        <button
                          type="button"
                          onClick={() => setPresetFilter('all')}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                            presetFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'hover:text-gray-900'
                          }`}
                        >
                          全部预设
                        </button>
                        <button
                          type="button"
                          onClick={() => setPresetFilter('light')}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                            presetFilter === 'light' ? 'bg-white text-amber-600 shadow-sm' : 'hover:text-amber-600'
                          }`}
                        >
                          <Sun size={12} />
                          <span>浅色风格</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPresetFilter('dark')}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                            presetFilter === 'dark' ? 'bg-white text-indigo-600 shadow-sm' : 'hover:text-indigo-600'
                          }`}
                        >
                          <Moon size={12} />
                          <span>深色风格</span>
                        </button>
                      </div>

                      {/* Presets List Grid */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-0.5">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">选择桌面风格预设</span>
                          <span className="text-[10px] text-purple-600 font-bold">全套应用图标与挂件配套</span>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5">
                          {THEME_PRESETS
                            .filter(p => presetFilter === 'all' || p.category === presetFilter)
                            .map((p) => {
                              const isSelected = wallpaperMode === 'preset' && presetId === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setPresetId(p.id);
                                    setWallpaperMode('preset');
                                    localStorage.setItem('desktop_preset_id', p.id);
                                    localStorage.setItem('desktop_wallpaper_mode', 'preset');
                                  }}
                                  className={`p-3 rounded-2xl relative overflow-hidden transition-all duration-200 border-2 flex items-center justify-between text-left cursor-pointer ${
                                    isSelected
                                      ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-100 shadow-md'
                                      : 'border-gray-200/80 bg-gray-50/60 hover:bg-gray-100/80'
                                  }`}
                                >
                                  <div className="flex items-center space-x-3 min-w-0">
                                    {/* Swatch preview */}
                                    <div 
                                      className="w-12 h-12 rounded-xl shadow-inner shrink-0 border border-black/10 flex items-center justify-center relative overflow-hidden"
                                      style={{ background: p.previewBg }}
                                    >
                                      {/* Mini App icon badge inside preview swatch */}
                                      <div className={`w-5 h-5 rounded-lg ${p.appIcons.chat.bg} ${p.appIcons.chat.border || ''} flex items-center justify-center shadow-xs`}>
                                        <MessageCircle size={10} className={p.appIcons.chat.iconColor} />
                                      </div>
                                    </div>

                                    <div className="min-w-0">
                                      <div className="flex items-center space-x-1.5">
                                        <span className="text-xs font-extrabold text-gray-900">{p.name}</span>
                                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                                          p.isLight 
                                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                            : 'bg-indigo-900 text-indigo-100'
                                        }`}>
                                          {p.isLight ? '浅色' : '深色'}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-gray-500 truncate mt-0.5">{p.description}</p>
                                    </div>
                                  </div>

                                  {/* Active check indicator */}
                                  {isSelected && (
                                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm ml-2">
                                      <Check size={12} className="stroke-[3]" />
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                        </div>
                      </div>

                      {/* Custom User Wallpaper Upload */}
                      <div className="space-y-3 pt-2 border-t border-gray-100">
                        <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">自定义本地图片壁纸</span>
                        
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-4 bg-gray-50 hover:bg-gray-100/60 transition-colors relative group">
                          {customWallpaper ? (
                            <div className="w-full flex flex-col items-center space-y-3">
                              <div className="w-24 h-36 rounded-lg overflow-hidden border border-gray-200 shadow-sm relative group-hover:shadow-md transition-shadow">
                                <img src={customWallpaper} alt="Custom Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowWallpaperDeleteConfirm(true);
                                    }}
                                    className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow flex items-center justify-center cursor-pointer"
                                    title="清除自定义壁纸"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2 w-full">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWallpaperMode('custom');
                                    localStorage.setItem('desktop_wallpaper_mode', 'custom');
                                  }}
                                  className={`py-1.5 px-3 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                    wallpaperMode === 'custom'
                                      ? 'bg-purple-600 text-white shadow'
                                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {wallpaperMode === 'custom' ? '已启用自定义壁纸' : '使用此自定义壁纸'}
                                </button>
                                <label className="py-1.5 px-3 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-[10px] font-bold text-gray-600 text-center cursor-pointer flex items-center justify-center">
                                  <Upload size={10} className="mr-1" />
                                  重新选择本机图片
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={handleWallpaperUpload} 
                                  />
                                </label>
                              </div>
                            </div>
                          ) : (
                            <label className="w-full flex flex-col items-center justify-center py-4 cursor-pointer">
                              <ImageIcon size={28} className="text-gray-400 mb-2 group-hover:text-purple-500 transition-colors" />
                              <span className="text-[11px] font-bold text-gray-700">选择本机图片</span>
                              <span className="text-[9px] text-gray-400 mt-0.5">支持 PNG, JPG, GIF 等格式</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleWallpaperUpload} 
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 border-t border-gray-100 text-center text-[9px] font-mono text-gray-400">
                      THEME PRESET ENGINE v2.0
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}

          {/* --- VIEW 2: STANDALONE CHATVIEW APPLICATION --- */}
          {activeScreen === 'chat' && (
            <motion.div 
              key="chatApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <ErrorBoundary fallbackTitle="消息与通讯录应用加载异常">
                <ChatView onHome={() => setActiveScreen('home')} />
              </ErrorBoundary>
            </motion.div>
          )}

          {/* --- VIEW 3: STANDALONE SETTINGS APPLICATION --- */}
          {activeScreen === 'settings' && (
            <motion.div 
              key="settingsApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <SettingsView onHome={() => setActiveScreen('home')} />
            </motion.div>
          )}

          {/* --- VIEW 4: STANDALONE CALENDAR APPLICATION --- */}
          {activeScreen === 'calendar' && (
            <motion.div 
              key="calendarApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <CalendarView onHome={() => setActiveScreen('home')} />
            </motion.div>
          )}

          {/* --- VIEW 5: STANDALONE FORUM APPLICATION --- */}
          {activeScreen === 'forum' && (
            <motion.div 
              key="forumApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <ForumView onHome={() => setActiveScreen('home')} />
            </motion.div>
          )}

          {/* --- VIEW 6: STANDALONE WORLDBOOK APPLICATION --- */}
          {activeScreen === 'worldbook' && (
            <motion.div 
              key="worldBookApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <WorldBookView onHome={() => setActiveScreen('home')} />
            </motion.div>
          )}

          {/* --- VIEW 7: STANDALONE DIARY APPLICATION --- */}
          {activeScreen === 'diary' && (
            <motion.div 
              key="diaryApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <DiaryView onHome={() => setActiveScreen('home')} />
            </motion.div>
          )}

          {/* --- VIEW 8: STANDALONE RELATIONSHIP NETWORK APPLICATION --- */}
          {activeScreen === 'relationship' && (
            <motion.div 
              key="relationshipApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <RelationshipNetworkView onBack={() => setActiveScreen('home')} />
            </motion.div>
          )}

          {/* --- VIEW 9: STANDALONE PHONE INSPECTOR APPLICATION --- */}
          {activeScreen === 'inspector' && (
            <motion.div 
              key="inspectorApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <PhoneInspectorView onBack={() => setActiveScreen('home')} />
            </motion.div>
          )}


          {/* --- VIEW 11: STANDALONE FANFIC APPLICATION --- */}
          {activeScreen === 'fanfic' && (
            <motion.div 
              key="fanficApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <FanficApp onHome={() => setActiveScreen('home')} />
            </motion.div>
          )}
          {/* --- VIEW 10: STANDALONE MEMORY APPLICATION --- */}
          {activeScreen === 'memory' && (
            <motion.div 
              key="memoryApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <MemoryAppView onHome={() => setActiveScreen('home')} />
            </motion.div>
          )}

          {/* --- VIEW 12: STANDALONE GAME CENTER APPLICATION --- */}
          {activeScreen === 'games' && (
            <motion.div 
              key="gamesApp"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <GameCenterView onHome={() => setActiveScreen('home')} />
            </motion.div>
          )}

        </AnimatePresence>

      </div>

      {/* Delete Wallpaper Confirmation Modal */}
      {showWallpaperDeleteConfirm && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">确认清除自定义壁纸</h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要删除自定义壁纸并恢复默认壁纸吗？</p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setShowWallpaperDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomWallpaper(null);
                  setWallpaperMode('preset');
                  localStorage.removeItem('desktop_custom_wallpaper');
                  localStorage.setItem('desktop_wallpaper_mode', 'preset');
                  setShowWallpaperDeleteConfirm(false);
                }}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}
