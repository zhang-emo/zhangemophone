/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ArrowLeft,
  Home,
  Search, 
  Globe, 
  ShoppingBag, 
  Wallet, 
  FileText, 
  ClipboardList, 
  UserCheck, 
  Trash2, 
  Lock, 
  Clock, 
  AlarmClock, 
  HeartPulse, 
  MapPin, 
  Gamepad2, 
  ShieldAlert, 
  Sparkles, 
  RotateCw, 
  CheckCircle2, 
  ChevronRight, 
  LockKeyhole, 
  Bookmark, 
  Utensils, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Copy, 
  Shield, 
  Eye, 
  EyeOff, 
  Bell, 
  Moon, 
  Activity, 
  Navigation, 
  Trophy, 
  PhoneOff, 
  MessageSquareOff, 
  ExternalLink, 
  Zap, 
  Users, 
  KeyRound, 
  SlidersHorizontal,
  RefreshCw,
  Video,
  Music,
  AlertTriangle,
  AlertCircle,
  WifiOff,
  X,
  Key,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbInstance } from '../lib/db';
import { ChatSession } from '../lib/types';
import { getEffectiveModel, callOpenAIEndpoint, getFallbackApiKey } from '../lib/api';
import { GoogleGenAI } from '@google/genai';
import { jsonrepair } from 'jsonrepair';

interface PhoneInspectorViewProps {
  onBack: () => void;
}

// Interface for simulated character phone data
export interface CharacterPhoneData {
  characterId: string;
  characterName: string;
  avatar: string;
  phoneModel: string;
  batteryLevel: number;

  // 1. Browser
  searchHistory: { id: string; query: string; detailContent: string; durationOrAction: string; time: string; category?: string }[];
  bookmarks: { id: string; title: string; source: string; durationOrAction: string; time: string; url?: string; icon?: string }[];

  // 2. Shopping / Delivery
  shoppingOrders: { id: string; title: string; price: string; status: string; date: string; tag: string }[];

  // 3. Wallet & Bills
  walletBills: { id: string; title: string; amount: string; type: 'expense' | 'income'; category: string; date: string }[];

  // 4. Memos & Drafts
  memos: { id: string; title: string; content: string; updatedAt: string; isDraft?: boolean }[];

  // 5. Clipboard History
  clipboardRecords: { id: string; content: string; copiedAt: string; sourceApp: string }[];

  // 6. Alt Accounts
  altAccounts: { id: string; platform: string; handle: string; bio: string; postsCount: number; secretNote: string }[];

  // 7. Recently Deleted Photos
  recentlyDeletedPhotos: { id: string; title: string; deletedDaysAgo: number; note: string }[];

  // 8. Hidden Album & Vault
  hiddenVault: { isLocked: boolean; passcode: string; items: { id: string; name: string; type: 'photo' | 'doc' | 'video'; secretDesc: string; date: string }[] };

  // 9. Screen Time
  screenTime: { totalMinutes: number; topApps: { name: string; minutes: number; category: string }[]; unlockCount: number };

  // 10. Alarms
  alarms: { id: string; time: string; label: string; isEnabled: boolean; repeat: string }[];

  // 11. Health & Sleep
  healthData: { sleepDuration: string; sleepQuality: string; avgHeartRate: number; stepsToday: number; deepSleepPercentage: string };

  // 12. Map Navigation
  mapSearches: { id: string; destination: string; address: string; time: string; isFavorite?: boolean }[];

  // 13. Game Center
  gameCenter: {
    games: { id: string; name: string; playTime: string; lastPlayedAt?: string; details: string; }[];
  };

  // 14. Spam Guard
  blockedInterceptions: { id: string; sender: string; type: 'call' | 'sms'; content: string; time: string }[];

  // 15. Short Videos
  shortVideos: {
    history: { id: string; title: string; author: string; duration: string; watchedAt: string; category: string }[];
    favorites: { id: string; title: string; author: string; likesCount: string; savedAt: string; note?: string }[];
  };

  // 16. Music Playback History
  musicHistory: {
    recentlyPlayed: { id: string; title: string; artist: string; album: string; playedAt: string; playCount: number; isLiked?: boolean }[];
    favoritePlaylists: { id: string; name: string; trackCount: number; coverColor: string; description: string }[];
  };
}

// Preset datasets for default system characters
const PRESET_DEFAULT_PHONE: CharacterPhoneData = {
  characterId: 'system_default',
  characterName: '未知角色',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
  phoneModel: 'iPhone 15 Pro',
  batteryLevel: 85,

  searchHistory: [],
  bookmarks: [],
  shoppingOrders: [],
  walletBills: [],
  memos: [],
  clipboardRecords: [],
  altAccounts: [],
  recentlyDeletedPhotos: [],
  
  hiddenVault: { 
    isLocked: true, 
    passcode: '1234', 
    items: [] 
  },

  screenTime: { 
    totalMinutes: 0, 
    topApps: [], 
    unlockCount: 0 
  },

  alarms: [],

  healthData: {
    sleepDuration: '',
    sleepQuality: '', 
    avgHeartRate: 0, 
    stepsToday: 0, 
    deepSleepPercentage: ''
  },

  mapSearches: [],

  gameCenter: {
    games: []
  },

  blockedInterceptions: [],

  shortVideos: {
    history: [],
    favorites: []
  },

  musicHistory: {
    recentlyPlayed: [],
    favoritePlaylists: []
  }
};

// Helper to format character display name
const formatDisplayName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*[\(\（].*?[\)\）]/g, '').trim();
};

const generateCharacterPhoneData = (session: ChatSession): CharacterPhoneData => {
  const name = formatDisplayName(session.characterName) || '未知角色';
  
  return {
    characterId: session.id,
    characterName: name,
    avatar: session.characterAvatar || '',
    phoneModel: `${name}的专属手机 (星空银)`,
    batteryLevel: 92,

    searchHistory: [],
    bookmarks: [],
    shoppingOrders: [],
    walletBills: [],
    memos: [],
    clipboardRecords: [],
    altAccounts: [],
    recentlyDeletedPhotos: [],
    
    hiddenVault: { 
      isLocked: true, 
      passcode: '1234', 
      items: [] 
    },
    
    screenTime: { 
      totalMinutes: 0, 
      topApps: [], 
      unlockCount: 0 
    },

    alarms: [],
    
    healthData: {
      sleepDuration: '',
      sleepQuality: '', 
      avgHeartRate: 0, 
      stepsToday: 0, 
      deepSleepPercentage: ''
    },

    shortVideos: { history: [], favorites: [] },
    musicHistory: { recentlyPlayed: [], favoritePlaylists: [] },
    mapSearches: [],
    gameCenter: { games: [] },
    blockedInterceptions: []
  };
};

const globalCacheMap: Record<string, CharacterPhoneData> = {};

export default function PhoneInspectorView({ onBack }: PhoneInspectorViewProps) {
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [phoneData, setPhoneData] = useState<CharacterPhoneData>(PRESET_DEFAULT_PHONE);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  
  const [apiErrorModal, setApiErrorModal] = useState<{title: string, message: string, type: 'no_key' | 'network_error'} | null>(null);
  const [unlockedVault, setUnlockedVault] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  useEffect(() => {
    dbInstance.getAllSessions().then(s => setSessions(s || []));
  }, []);

  const saveToCache = (id: string, data: CharacterPhoneData) => {
    globalCacheMap[id] = data;
  };

  // AI Dynamic generate custom character phone secrets using Gemini and cache result for a specific App
  const generateAndCacheAppPhoneData = async (charId: string, targetApp: string) => {
    setIsGeneratingAI(true);
    setApiErrorModal(null);
    
    let baseData: CharacterPhoneData = { ...phoneData };
    const currentSession = sessions.find(s => s.id === charId);
    
    try {
      const settings = await dbInstance.getSettings();
      const userApiKey = settings?.apiKey;
      const fallbackApiKey = getFallbackApiKey();

      if (!userApiKey && !fallbackApiKey) {
        setApiErrorModal({
          title: '未配置 API Key',
          message: '未检测到 API Key，无法生成最新隐私数据。可在【系统设置】中填入 API Key 后重试。',
          type: 'no_key'
        });
        return;
      }

      if (!currentSession) return;

      const charName = currentSession.characterName || '未知角色';
      const systemPrompt = currentSession.memory || '无特殊系统提示词';
      const memory = currentSession.memory || '性格独特，充满个性';

      // Fetch recent messages for richer context
      let chatHistoryText = '暂无历史对话';
      try {
        const msgs = await dbInstance.getMessages(charId);
        if (msgs && msgs.length > 0) {
          const recent = msgs.slice(-12);
          chatHistoryText = recent.map(m => `${m.role === 'user' ? '用户' : charName}: ${m.content}`).join('\n');
        }
      } catch (e) {
        console.error('Failed to get chat messages for phone generator:', e);
      }

      let appInstruction = '';
      let jsonFormat = '';

      switch (targetApp) {
        case 'browser':
          appInstruction = '生成【浏览器】的搜索历史记录 (searchHistory，5条) 和 收藏书签 (bookmarks，4条)。';
          jsonFormat = `{\n  "searchHistory": [{"id": "1", "query": "搜索内容", "detailContent": "详情", "durationOrAction": "心理描写", "time": "10:15", "category": "分类"}],\n  "bookmarks": [{"id": "1", "title": "标题", "source": "来源", "durationOrAction": "心理描写", "time": "08-03"}]\n}`;
          break;
        case 'short_video':
          appInstruction = '生成【短视频】的观看历史 (history，4条) 和 收藏视频 (favorites，2条)。';
          jsonFormat = `{\n  "shortVideos": {\n    "history": [{"id": "1", "title": "标题", "author": "@作者", "duration": "02:15", "watchedAt": "10:30", "category": "分类"}],\n    "favorites": [{"id": "1", "title": "标题", "author": "@作者", "likesCount": "3.5万", "savedAt": "08-03", "note": "备注"}]\n  }\n}`;
          break;
        case 'music_player':
          appInstruction = '生成【音乐】的最近播放 (recentlyPlayed，4条) 和 收藏歌单 (favoritePlaylists，1条)。';
          jsonFormat = `{\n  "musicHistory": {\n    "recentlyPlayed": [{"id": "1", "title": "歌名", "artist": "歌手", "album": "专辑", "playedAt": "09:40", "playCount": 42, "isLiked": true}],\n    "favoritePlaylists": [{"id": "1", "name": "歌单名", "trackCount": 20, "coverColor": "bg-indigo-600", "description": "描述"}]\n  }\n}`;
          break;
        case 'shopping':
          appInstruction = '生成【外卖购物】的订单记录 (shoppingOrders，3条)。';
          jsonFormat = `{ "shoppingOrders": [{"id": "1", "title": "物品名", "price": "¥99.00", "status": "已签收", "date": "08-03", "tag": "分类"}] }`;
          break;
        case 'wallet':
          appInstruction = '生成【账单钱包】的消费账单 (walletBills，3条)。';
          jsonFormat = `{ "walletBills": [{"id": "1", "title": "说明", "amount": "-¥45.00", "type": "expense", "category": "分类", "date": "08-04"}] }`;
          break;
        case 'memos':
          appInstruction = '生成【备忘草稿】的记录 (memos，至少3条)。内容需随机混合以下两种：1.“未发送草稿”：写给用户（即正在查看手机的用户）的未发送心里话或草稿；2.“日常备忘”：非常简短干练的待办清单（如购物、取件等），不要记流水账或长篇日记。';
          jsonFormat = `{ "memos": [{"id": "1", "title": "标题", "content": "内容", "updatedAt": "08-04", "isDraft": true}] }`;
          break;
        case 'clipboard':
          appInstruction = '生成【剪贴板】的历史记录 (clipboardRecords，2条)。注意：来源App名称必须使用中文（如：微信、淘宝、小红书等）。';
          jsonFormat = `{ "clipboardRecords": [{"id": "1", "content": "复制的文字", "copiedAt": "09:20", "sourceApp": "应用来源"}] }`;
          break;
        case 'alt_account':
          appInstruction = '生成【社交马甲】的小号记录 (altAccounts，1条)。';
          jsonFormat = `{ "altAccounts": [{"id": "1", "platform": "平台", "handle": "@ID", "bio": "签名", "postsCount": 18, "secretNote": "秘密"}] }`;
          break;
        case 'trash':
          appInstruction = '生成【相册回收站】的最近删除照片 (recentlyDeletedPhotos，固定4条)。注意：下方备注文本（note）长度需保持在50字左右，不需要输出照片大概色调。';
          jsonFormat = `{ "recentlyDeletedPhotos": [{"id": "1", "title": "标题", "deletedDaysAgo": 3, "note": "备注内容(约50字)"}] }`;
          break;
        case 'vault':
          appInstruction = '生成【隐藏保险箱】的私密文件 (hiddenVault)。注意：内容备注文本（secretDesc）长度需保持在50字左右。';
          jsonFormat = `{ "hiddenVault": { "passcode": "8888", "items": [{"id": "1", "name": "文件名", "type": "doc", "secretDesc": "秘密描述", "date": "2026-08-01"}] } }`;
          break;
        case 'screentime':
          appInstruction = '生成【屏幕时间】的统计数据 (screenTime)。注意：TopApps列表中的应用名称必须使用中文（如：抖音、微信、王者荣耀等）。';
          jsonFormat = `{ "screenTime": { "totalMinutes": 320, "topApps": [{"name": "App名", "minutes": 120, "category": "分类"}], "unlockCount": 45 } }`;
          break;
        case 'alarms':
          appInstruction = '生成【闹钟】的响铃设置 (alarms，2条)。';
          jsonFormat = `{ "alarms": [{"id": "1", "time": "07:30", "label": "标签", "isEnabled": true, "repeat": "每天"}] }`;
          break;
        case 'health':
          appInstruction = '生成【健康睡眠】的数据 (healthData)。';
          jsonFormat = `{ "healthData": { "sleepDuration": "7小时", "sleepQuality": "良好", "avgHeartRate": 72, "stepsToday": 5000, "deepSleepPercentage": "25%" } }`;
          break;
        case 'map':
          appInstruction = '生成【地图导航】的搜索记录 (mapSearches，至少4条)。';
          jsonFormat = `{ "mapSearches": [{"id": "1", "destination": "目的地", "address": "地址", "time": "08-03", "isFavorite": true}] }`;
          break;
        case 'game':
          appInstruction = '生成【Steam游戏动态】的记录 (gameCenter，5条近期上线记录)。可以包含重复游戏的多次上线记录，游戏名必须使用中文。内容需包含单次上线游玩时长(如"2.5小时"，可包含挂机或仅浏览商店)、本次上线距离现在的时间(lastPlayedAt，如"10小时前")。⚠️核心要求：请将【游戏情况】和【社交情况】融合成一段综合描述，放在【details】字段中。要求：如果有组队游玩，必须使用现实中的人名/昵称（首选调用该角色原作设定中的其他相关人物名），【绝对禁止】出现与同事/同行一起游玩的情况，也【绝对不能】是和当前用户一起游玩，只能是单人、挂机或和原作其他人/朋友路人组队（与朋友组队概率较高）。';
          jsonFormat = `{ "gameCenter": { "games": [{"id": "1", "name": "游戏名", "playTime": "本次游玩时长", "lastPlayedAt": "距离现在的时间", "details": "关于游戏情况和社交情况的综合纯文本描述"}] } }`;
          break;
        case 'spam':
          appInstruction = '生成【骚扰拦截】的记录 (blockedInterceptions，至少6条)。';
          jsonFormat = `{ "blockedInterceptions": [{"id": "1", "sender": "号码", "type": "call", "content": "拦截原因", "time": "08-04"}] }`;
          break;
        default:
          setIsGeneratingAI(false);
          return;
      }

      const prompt = `你正在扮演AI角色【${charName}】。
角色系统设定：
${systemPrompt}

角色长期记忆：
${memory}

近期对话记录：
${chatHistoryText}

【任务要求】：
请根据上述背景，为【${charName}】的手机生成特定App的隐私数据。
当前任务：${appInstruction}
**核心硬性指标**：内容必须100%严格贴合该角色的独特性格、背景及与用户的回忆！严禁泛泛而谈的模板化数据。绝对禁止在生成的数据中出现任何有关“章鱼猫”、“章导”、“独立开发者”等系统默认元素。

【极其重要】：你必须只返回一段严格合法的纯 JSON 文本，绝对不能包含任何 Markdown 标记（例如 markdown 代码块）或其他任何解释性文字。JSON 的 key 必须带有双引号，内部字符串如果包含引号必须正确转义。
必须完全匹配以下格式：
${jsonFormat}`;

      let text = '';
      if (userApiKey) {
        const cleanBaseUrl = (settings.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/$/, "");
        const targetUrl = `${cleanBaseUrl}/chat/completions`;
        const bodyData = {
          model: getEffectiveModel(settings, 'gpt-4o'),
          messages: [{ role: 'user', content: prompt }],
          temperature: settings.temperature ?? 0.75,
          max_tokens: 3000
        };

        const data = await callOpenAIEndpoint(targetUrl, userApiKey, bodyData);
        text = data.choices?.[0]?.message?.content || '';
      } else if (fallbackApiKey) {
        const ai = new GoogleGenAI({ apiKey: fallbackApiKey });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });
        text = response.text || '';
      }

      if (!text || !text.trim()) {
        throw new Error('模型未返回有效内容，请检查 API 配置或重试。');
      }

      let cleanJson = text.replace(/```json|```/g, '').trim();
      const jsonMatch = cleanJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanJson = jsonMatch[0];
      }
      
      let parsed;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (err) {
        // attempt to fix common JSON issues using jsonrepair
        try {
          const repaired = jsonrepair(cleanJson);
          parsed = JSON.parse(repaired);
        } catch (err2: any) {
          console.warn('JSON Parse failed, trying to sanitize text:', cleanJson);
          throw new Error('AI 返回的 JSON 格式有误: ' + (err2?.message || String(err2)));
        }
      }

      if (parsed) {
        if (targetApp === 'browser' && parsed.searchHistory && parsed.bookmarks) {
          baseData.searchHistory = parsed.searchHistory;
          baseData.bookmarks = parsed.bookmarks;
        } else if (targetApp === 'short_video' && parsed.shortVideos) {
          baseData.shortVideos = parsed.shortVideos;
        } else if (targetApp === 'music_player' && parsed.musicHistory) {
          baseData.musicHistory = parsed.musicHistory;
        } else if (targetApp === 'shopping' && parsed.shoppingOrders) {
          baseData.shoppingOrders = parsed.shoppingOrders;
        } else if (targetApp === 'wallet' && parsed.walletBills) {
          baseData.walletBills = parsed.walletBills;
        } else if (targetApp === 'memos' && parsed.memos) {
          baseData.memos = parsed.memos;
        } else if (targetApp === 'clipboard' && parsed.clipboardRecords) {
          baseData.clipboardRecords = parsed.clipboardRecords;
        } else if (targetApp === 'alt_account' && parsed.altAccounts) {
          baseData.altAccounts = parsed.altAccounts;
        } else if (targetApp === 'trash' && parsed.recentlyDeletedPhotos) {
          baseData.recentlyDeletedPhotos = parsed.recentlyDeletedPhotos;
        } else if (targetApp === 'vault' && parsed.hiddenVault) {
          baseData.hiddenVault = { ...baseData.hiddenVault, ...parsed.hiddenVault };
        } else if (targetApp === 'screentime' && parsed.screenTime) {
          baseData.screenTime = parsed.screenTime;
        } else if (targetApp === 'alarms' && parsed.alarms) {
          baseData.alarms = parsed.alarms;
        } else if (targetApp === 'health' && parsed.healthData) {
          baseData.healthData = parsed.healthData;
        } else if (targetApp === 'map' && parsed.mapSearches) {
          baseData.mapSearches = parsed.mapSearches;
        } else if (targetApp === 'game' && parsed.gameCenter) {
          baseData.gameCenter = parsed.gameCenter;
        } else if (targetApp === 'spam' && parsed.blockedInterceptions) {
          baseData.blockedInterceptions = parsed.blockedInterceptions;
        }
      }

      setPhoneData(baseData);
      saveToCache(charId, baseData);
    } catch (e: any) {
      console.error('AI generate app phone data error:', e);
      const errMsg = e?.message || String(e) || '未知网络或接口错误';
      const isPermissionDenied = errMsg.includes('PERMISSION_DENIED') || errMsg.includes('403') || e?.status === 403;
      setApiErrorModal({
        title: isPermissionDenied ? 'API Key 权限无效 (403)' : '数据生成异常',
        message: isPermissionDenied
          ? '当前使用的 API Key 无权调用模型或已被禁用，生成操作已取消。请在【系统设置】中检查 API Key 与 Base URL。'
          : `请求发生了错误：${errMsg}`,
        type: 'network_error'
      });
    } finally {
      await new Promise(r => setTimeout(r, 600));
      setIsGeneratingAI(false);
    }
  };

  // Handle character selection: if cached use cache, otherwise initialize default
  const handleSelectCharacter = async (charId: string) => {
    setSelectedCharacterId(charId);
    setActiveApp(null);
    setUnlockedVault(false);
    setPasscodeInput('');
    setPasscodeError(false);

    const found = sessions.find(s => s.id === charId);

    if (globalCacheMap[charId]) {
      const cached = globalCacheMap[charId];
      if (found) {
        cached.avatar = found.characterAvatar || cached.avatar;
        cached.characterName = formatDisplayName(found.characterName) || cached.characterName;
      }
      setPhoneData(cached);
    } else {
      const defaultData = found ? generateCharacterPhoneData(found) : PRESET_DEFAULT_PHONE;
      setPhoneData(defaultData);
      saveToCache(charId, defaultData);
    }
  };

  // Password verify for Hidden Vault
  const handleVerifyPasscode = () => {
    if (passcodeInput === phoneData.hiddenVault.passcode || passcodeInput === '1024' || passcodeInput === '8888') {
      setUnlockedVault(true);
      setPasscodeError(false);
    } else {
      setPasscodeError(true);
      setTimeout(() => setPasscodeError(false), 1500);
    }
  };

  const characterApps = [
    { id: 'browser', name: '浏览器', icon: Globe, color: 'bg-sky-500' },
    { id: 'short_video', name: '短视频', icon: Video, color: 'bg-pink-500' },
    { id: 'music_player', name: '音乐', icon: Music, color: 'bg-emerald-600' },
    { id: 'shopping', name: '外卖购物', icon: ShoppingBag, color: 'bg-orange-500' },
    { id: 'wallet', name: '账单钱包', icon: Wallet, color: 'bg-emerald-500' },
    { id: 'memos', name: '备忘草稿', icon: FileText, color: 'bg-amber-500' },
    { id: 'clipboard', name: '剪贴板', icon: ClipboardList, color: 'bg-indigo-500' },
    { id: 'alt_account', name: '社交马甲', icon: UserCheck, color: 'bg-purple-500' },
    { id: 'trash', name: '相册回收站', icon: Trash2, color: 'bg-rose-500' },
    { id: 'vault', name: '隐藏保险箱', icon: Lock, color: 'bg-zinc-800' },
    { id: 'screentime', name: '屏幕时间', icon: Clock, color: 'bg-blue-600' },
    { id: 'alarms', name: '闹钟', icon: AlarmClock, color: 'bg-yellow-500' },
    { id: 'health', name: '健康睡眠', icon: HeartPulse, color: 'bg-red-500' },
    { id: 'map', name: '地图导航', icon: MapPin, color: 'bg-teal-500' },
    { id: 'game', name: '游戏与社交', icon: Gamepad2, color: 'bg-violet-600' },
    { id: 'spam', name: '骚扰拦截', icon: ShieldAlert, color: 'bg-slate-700' },
  ];

  // All available target characters for character selection list
  const allCharacters = sessions.filter(s => !s.isGroup && !s.isContactDeleted && !s.characterName.includes('/')).map(s => ({
    id: s.id,
    name: formatDisplayName(s.characterName),
    avatar: s.characterAvatar,
    desc: s.memory ? s.memory.slice(0, 32) + '...' : '与你建立联系的专属AI角色',
    tag: 'AI角色',
    color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
  }));

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 relative font-sans overflow-hidden select-none">
      
      {/* Bypassing Security Verification Loading Overlay */}
      {isGeneratingAI && (
        <div className="absolute inset-0 bg-slate-950/90 z-50 flex flex-col items-center justify-center p-6 space-y-4 text-center backdrop-blur-md">
          <div className="relative">
            <div className="w-16 h-16 rounded-3xl bg-indigo-600/20 border-2 border-indigo-500/50 flex items-center justify-center text-indigo-400 shadow-xl">
              <ShieldAlert size={32} className="animate-pulse text-amber-400" />
            </div>
            <RefreshCw size={20} className="animate-spin text-indigo-400 absolute -bottom-1 -right-1" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white tracking-wide">正在绕过安全验证...</h3>
            <p className="text-[11px] text-slate-400 font-mono">抓取并同步角色隐私数据中</p>
          </div>
        </div>
      )}

      {/* --- SCENARIO 1: CHARACTER SELECTION LIST VIEW --- */}
      {!selectedCharacterId ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Header */}
          <div className={`h-16 px-4 border-b flex items-center justify-between shrink-0 ${['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
            <button
              type="button"
              onClick={onBack}
              className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0 ${
                ['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') 
                  ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/60' 
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/60'
              }`}
              title="返回手机桌面"
            >
              <Home size={16} className="stroke-[2.5]" />
            </button>

            <div className="flex items-center">
              <h2 className="text-lg font-bold tracking-tight text-white">查手机</h2>
            </div>

            <div className="w-8" />
          </div>

          {/* Selection List Content */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') ? 'bg-slate-50 text-slate-800' : ''}`}>
            <div className="space-y-3">
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 px-1 flex items-center justify-between">
                <span>设备链接列表 ({allCharacters.length})</span>
                <span className="text-emerald-400 font-bold">已同步隐私视角</span>
              </div>

              {allCharacters.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/50 rounded-2xl border border-slate-800 space-y-2">
                  <p className="text-xs text-slate-400 font-bold">暂无接入的 AI 角色设备</p>
                  <p className="text-[11px] text-slate-500">请先在消息列表添加并开始与 AI 角色对话</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {allCharacters.map((char) => {
                    const isImg = char.avatar && (
                      char.avatar.startsWith('data:') || 
                      char.avatar.startsWith('http') || 
                      char.avatar.startsWith('blob:') || 
                      char.avatar.startsWith('/')
                    );

                    return (
                      <div
                        key={char.id}
                        onClick={() => handleSelectCharacter(char.id)}
                        className="p-3.5 bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl flex items-center space-x-3.5 cursor-pointer transition-all duration-200 group active:scale-[0.99] shadow-lg"
                      >
                        <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-400/30 overflow-hidden flex items-center justify-center text-white text-base font-black group-hover:scale-105 transition-transform shrink-0 shadow-2xs">
                          {isImg ? (
                            <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-black text-indigo-300 select-none">
                              {char.avatar && char.avatar.length <= 4 ? char.avatar : (char.name ? char.name.slice(0, 1) : '👤')}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors truncate">
                            {char.name}
                          </h3>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {char.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* --- SCENARIO 2: SELECTED CHARACTER SIMULATED PHONE DESKTOP --- */
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Navigation Bar */}
            <div className="h-16 px-4 py-2 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md flex items-center justify-between z-20 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedCharacterId(null);
                  setActiveApp(null);
                }}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0 ${
                  ['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') 
                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/60' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/60'
                }`}
                title="返回"
              >
                <ArrowLeft size={16} className="stroke-[2.5]" />
              </button>

              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-indigo-600/20 border border-indigo-400/30 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {phoneData.avatar && (
                    phoneData.avatar.startsWith('data:') || 
                    phoneData.avatar.startsWith('http') || 
                    phoneData.avatar.startsWith('blob:') || 
                    phoneData.avatar.startsWith('/')
                  ) ? (
                    <img src={phoneData.avatar} alt={phoneData.characterName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-black text-indigo-300 select-none">
                      {phoneData.avatar && phoneData.avatar.length <= 4 ? phoneData.avatar : (phoneData.characterName ? phoneData.characterName.slice(0, 1) : '👤')}
                    </span>
                  )}
                </div>
                <span className="text-sm font-black tracking-tight text-white truncate">
                  {phoneData.characterName} 的手机
                </span>
              </div>

              <div className="w-8" />
            </div>

            {/* SIMULATED CHARACTER DESKTOP VIEWPORT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
              
              {/* CHARACTER DESKTOP APPS GRID (Multiples of 8: gap-4 = 16px, p-2 = 8px) */}
              <div className="grid grid-cols-4 gap-4 p-2">
                {characterApps.map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setActiveApp(app.id)}
                      className="flex flex-col items-center space-y-2 group focus:outline-none cursor-pointer"
                    >
                      <div className={`w-14 h-14 ${app.color} rounded-2xl flex items-center justify-center shadow-lg relative transition-all duration-300 group-hover:scale-105 active:scale-95 group-hover:shadow-indigo-500/20`}>
                        <Icon size={24} className="text-white stroke-[2.2]" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors truncate max-w-[64px]">
                        {app.name}
                      </span>
                    </button>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        {/* --- SUB-APP MODAL MODES --- */}
        <AnimatePresence>
          {activeApp && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className={`absolute inset-0 z-30 flex flex-col font-sans overflow-hidden ${['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') ? 'bg-slate-50' : 'bg-slate-950'}`}
            >
              {/* App Header (Multiples of 8: h-16 = 64px, px-4 = 16px) */}
              <div className={`h-16 px-4 border-b flex items-center justify-between shrink-0 ${['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
                <button
                  type="button"
                  onClick={() => setActiveApp(null)}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all active:scale-95 shrink-0 ${
                    ['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') 
                      ? 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/60' 
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700/60'
                  }`}
                  title="返回手机应用列表"
                >
                  <ArrowLeft size={16} className="stroke-[2.5]" />
                </button>

                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-black ${['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') ? 'text-slate-800' : 'text-white'}`}>
                    {phoneData.characterName} 的 {characterApps.find(a => a.id === activeApp)?.name}
                  </span>
                </div>

                {/* AI App Data Refresh Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCharacterId && activeApp) {
                      generateAndCacheAppPhoneData(selectedCharacterId, activeApp);
                    }
                  }}
                  disabled={isGeneratingAI}
                  className="w-8 h-8 rounded-lg bg-[#7066f0] text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-50 hover:bg-[#7066f0]/90"
                  title={`刷新 ${characterApps.find(a => a.id === activeApp)?.name || 'App'} 数据`}
                >
                  <RefreshCw size={16} className={isGeneratingAI ? 'animate-spin text-amber-300' : 'text-white'} />
                </button>
              </div>

            {/* App Detail Content Area */}
            <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') ? 'bg-slate-50 text-slate-800' : ''}`}>
              
              {/* 1. BROWSER MODE */}
              {activeApp === 'browser' && (
                <div className="space-y-6">
                  {/* Search Queries */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-sky-600 flex items-center space-x-1">
                        <Globe size={14} />
                        <span>最近搜索记录 (5条) Search History</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">按时间倒序</span>
                    </div>

                    <div className="space-y-2.5">
                      {phoneData.searchHistory.map((s) => (
                        <div key={s.id} className="p-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col space-y-1.5 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2 min-w-0">
                              <Search size={14} className="text-sky-600 shrink-0 mt-0.5" />
                              <span className="text-xs font-bold text-slate-800 leading-tight break-words">{s.query}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">{s.time}</span>
                          </div>

                          {s.detailContent && (
                            <p className="text-[11px] text-slate-500 pl-5 leading-relaxed">
                              {s.detailContent}
                            </p>
                          )}

                          {s.durationOrAction && (
                            <p className="text-[11px] text-sky-600/90 pl-5 leading-relaxed">
                              {s.durationOrAction}
                            </p>
                          )}
                          {s.category && (
                            <div className="pl-5 pt-0.5">
                              <span className="text-[10px] text-slate-500 bg-slate-100/60 px-1.5 py-0.5 rounded">
                                {s.category}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bookmarks */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-600 flex items-center space-x-1">
                        <Bookmark size={14} />
                        <span>收藏夹与书签 (4条) Bookmarks</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">精选收藏</span>
                    </div>

                    <div className="space-y-2.5">
                      {phoneData.bookmarks.map((b) => (
                        <div key={b.id} className="p-3.5 bg-white border border-slate-200 shadow-sm rounded-2xl flex flex-col space-y-1.5 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center space-x-2 min-w-0">
                              <Bookmark size={14} className="text-amber-600 shrink-0 mt-0.5" />
                              <span className="text-xs font-bold text-slate-800 leading-tight break-words">{b.title}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">{b.time}</span>
                          </div>

                          {b.source && (
                            <p className="text-[11px] text-slate-500 pl-5 leading-relaxed">
                              来源：{b.source}
                            </p>
                          )}

                          {b.durationOrAction && (
                            <p className="text-[11px] text-amber-600/90 pl-5 leading-relaxed">
                              {b.durationOrAction}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* SHORT VIDEO MODE */}
              {activeApp === 'short_video' && (
                <div className="space-y-6">
                  {/* Short Video History */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-pink-400 flex items-center space-x-1">
                        <Video size={14} />
                        <span>短视频浏览历史 Video History</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">固定 4 条 · 刷过的视频</span>
                    </div>

                    {/* 双列视图模拟视频平台 (2-column video feed layout) */}
                    <div className="grid grid-cols-2 gap-3">
                      {phoneData.shortVideos.history.slice(0, 4).map((v, idx) => {
                        const coverGradients = [
                          'from-purple-900/90 via-slate-900 to-pink-950/90',
                          'from-indigo-900/90 via-slate-900 to-sky-950/90',
                          'from-rose-900/90 via-slate-900 to-amber-950/90',
                          'from-teal-900/90 via-slate-900 to-emerald-950/90'
                        ];
                        const bgGradient = coverGradients[idx % coverGradients.length];

                        return (
                          <div 
                            key={v.id || idx} 
                            className="bg-slate-900/90 border border-slate-800/80 rounded-2xl overflow-hidden flex flex-col hover:border-pink-500/50 transition-all group shadow-md"
                          >
                            {/* Video Cover Thumbnail Box */}
                            <div className={`aspect-[4/5] bg-gradient-to-br ${bgGradient} relative p-2.5 flex flex-col justify-between overflow-hidden select-none`}>
                              {/* Background ambient blur */}
                              <div className="absolute -right-6 -top-6 w-20 h-20 bg-pink-500/10 rounded-full blur-xl group-hover:bg-pink-500/25 transition-all" />
                              
                              {/* Top Bar: Tag & Duration */}
                              <div className="flex items-center justify-between z-10">
                                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-pink-300 border border-white/10 tracking-wider">
                                  {v.category || '推荐'}
                                </span>
                                <span className="text-[9px] font-mono text-slate-200 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-xs">
                                  {v.duration || '01:30'}
                                </span>
                              </div>

                              {/* Center Play Button Overlay */}
                              <div className="absolute inset-0 flex items-center justify-center opacity-85 group-hover:scale-110 transition-transform pointer-events-none">
                                <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg">
                                  <Play size={15} className="text-pink-400 fill-pink-400/80 ml-0.5" />
                                </div>
                              </div>

                              {/* Bottom Overlay: Author Handle */}
                              <div className="z-10 flex items-center space-x-1.5">
                                <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-pink-500 to-purple-500 flex items-center justify-center text-[8px] font-extrabold text-white shrink-0 shadow-xs">
                                  {v.author?.charAt(1) || '博'}
                                </div>
                                <span className="text-[10px] text-slate-200 font-medium truncate drop-shadow-xs">
                                  {v.author}
                                </span>
                              </div>
                            </div>

                            {/* Video Bottom Info Footer: Title & Grey Timestamp Below */}
                            <div className="p-3 space-y-2 flex-1 flex flex-col justify-between bg-slate-900">
                              {/* 视频标题 */}
                              <h4 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug group-hover:text-pink-300 transition-colors">
                                {v.title}
                              </h4>

                              {/* 标题下方用灰字标注时间 */}
                              <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between">
                                <span className="text-[10px] text-slate-400 font-mono flex items-center space-x-1">
                                  <Clock size={10} className="text-slate-500 shrink-0" />
                                  <span>{v.watchedAt}</span>
                                </span>
                                <span className="text-[9px] text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded">
                                  历史
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Short Video Favorites */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-amber-400 flex items-center space-x-1">
                      <Bookmark size={14} />
                      <span>精选收藏短视频 Favorites</span>
                    </span>

                    <div className="space-y-2">
                      {phoneData.shortVideos.favorites.map((f) => (
                        <div key={f.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-white">{f.title}</span>
                            <span className="text-amber-400 text-[10px] font-mono">获赞 {f.likesCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>作者：{f.author}</span>
                            <span className="font-mono">{f.savedAt} 收藏</span>
                          </div>
                          {f.note && (
                            <div className="text-xs text-amber-300/90 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                              备注：{f.note}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* MUSIC PLAYER MODE */}
              {activeApp === 'music_player' && (
                <div className="space-y-6">
                  {/* Recently Played */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                        <Music size={14} />
                        <span>最近播放歌曲 Music History</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">已听曲目</span>
                    </div>

                    <div className="space-y-2">
                      {phoneData.musicHistory.recentlyPlayed.map((m) => (
                        <div key={m.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                          <div className="space-y-1 min-w-0 flex-1 pr-2">
                            <div className="text-xs font-bold text-white flex items-center space-x-2">
                              <span className="truncate">{m.title}</span>
                              {m.isLiked && (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[9px] font-bold border border-rose-500/30 shrink-0">
                                  红心
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {m.artist} • 《{m.album}》
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-mono font-bold text-emerald-400">{m.playCount} 次播放</div>
                            <div className="text-[10px] font-mono text-slate-500">{m.playedAt}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Favorite Playlists */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-indigo-400 flex items-center space-x-1">
                      <Bookmark size={14} />
                      <span>收藏与创建歌单 Playlists</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {phoneData.musicHistory.favoritePlaylists.map((p) => (
                        <div key={p.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 rounded-xl ${p.coverColor} text-white font-black flex items-center justify-center shrink-0 border border-white/20 shadow`}>
                              <Music size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white truncate">{p.name}</div>
                              <div className="text-[10px] text-slate-400">{p.trackCount} 首单曲</div>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-400 bg-slate-950 p-2 rounded-lg border border-slate-800">
                            {p.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 2. SHOPPING / DELIVERY MODE */}
              {activeApp === 'shopping' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-orange-600 flex items-center space-x-1">
                      <ShoppingBag size={14} />
                      <span>购物与外卖订单记录</span>
                    </span>
                    <span className="text-[10px] text-slate-500">{phoneData.shoppingOrders.length} 笔订单</span>
                  </div>

                  <div className="space-y-3">
                    {phoneData.shoppingOrders.map((o) => (
                      <div key={o.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-800">{o.title}</span>
                          <span className="text-emerald-600 font-mono">{o.price}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-300">{o.tag}</span>
                          <span>状态：{o.status} ({o.date})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. WALLET MODE */}
              {activeApp === 'wallet' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600 flex items-center space-x-1">
                      <Wallet size={14} />
                      <span>收支流水与账单</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {phoneData.walletBills.map((w) => (
                      <div key={w.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-800">{w.title}</div>
                          <div className="text-[10px] text-slate-500">{w.category} • {w.date}</div>
                        </div>
                        <span className={`text-xs font-bold font-mono ${w.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {w.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. MEMOS & DRAFTS MODE */}
              {activeApp === 'memos' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-amber-600 flex items-center space-x-1">
                    <FileText size={14} />
                    <span>备忘录与未发送草稿</span>
                  </span>

                  <div className="space-y-3">
                    {phoneData.memos.map((m) => (
                      <div key={m.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-800">{m.title}</h4>
                          {m.isDraft && (
                            <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-600 text-[10px] font-bold border border-rose-500/30">
                              未发送草稿
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm/80">
                          {m.content}
                        </p>
                        <div className="text-[10px] text-slate-500 text-right font-mono">{m.updatedAt}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. CLIPBOARD MODE */}
              {activeApp === 'clipboard' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-indigo-600 flex items-center space-x-1">
                    <ClipboardList size={14} />
                    <span>剪贴板历史记录</span>
                  </span>

                  <div className="space-y-2">
                    {phoneData.clipboardRecords.map((c) => (
                      <div key={c.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>来源：{c.sourceApp}</span>
                          <span className="font-mono">{c.copiedAt}</span>
                        </div>
                        <div className="text-xs font-mono bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm text-indigo-600 select-all">
                          {c.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. ALT ACCOUNT MODE */}
              {activeApp === 'alt_account' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-purple-400 flex items-center space-x-1">
                    <UserCheck size={14} />
                    <span>社交小号与马甲</span>
                  </span>

                  <div className="space-y-3">
                    {phoneData.altAccounts.map((a) => (
                      <div key={a.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center font-bold text-purple-300">
                            {a.handle.slice(1, 2)}
                          </div>
                          <div>
                            <div className={`text-xs font-black ${['browser', 'shopping', 'wallet', 'memos', 'clipboard', 'screentime', 'alarms', 'health', 'map'].includes(activeApp || '') ? 'text-slate-800' : 'text-white'}`}>{a.platform}</div>
                            <div className="text-[10px] text-purple-400 font-mono">{a.handle}</div>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-950 rounded-lg text-xs text-slate-300 border border-slate-800 space-y-1">
                          <div className="text-[10px] text-slate-500 font-bold">简介 Bio:</div>
                          <div>{a.bio}</div>
                          <div className="text-[10px] text-amber-400/80 pt-1 border-t border-slate-800 mt-2">
                            备注: {a.secretNote}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. RECENTLY DELETED PHOTOS */}
              {activeApp === 'trash' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-rose-400 flex items-center space-x-1">
                    <Trash2 size={14} />
                    <span>相册最近删除 (30天内)</span>
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    {phoneData.recentlyDeletedPhotos.map((p) => (
                      <div key={p.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                        <div className="h-24 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-white text-xs font-bold text-center p-2">
                          {p.title}
                        </div>
                        <div className="text-[10px] text-slate-400">{p.note}</div>
                        <div className="text-[9px] text-rose-400 font-mono">还剩 {30 - p.deletedDaysAgo} 天彻底清除</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 8. HIDDEN VAULT MODE */}
              {activeApp === 'vault' && (
                <div className="space-y-4">
                  {!unlockedVault ? (
                    <div className="p-8 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-4 max-w-sm mx-auto my-8">
                      <div className="w-16 h-16 rounded-3xl bg-zinc-800 text-amber-400 flex items-center justify-center mx-auto border border-amber-400/30 shadow-xl">
                        <Lock size={32} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white">私密保险箱 Hidden Vault</h3>
                        <p className="text-xs text-slate-400 mt-1">请输入该角色的加密访问口令 (提示：系统默认 1024 或 8888)</p>
                      </div>

                      <div className="space-y-3">
                        <input
                          type="password"
                          value={passcodeInput}
                          onChange={(e) => setPasscodeInput(e.target.value)}
                          placeholder="输入密码..."
                          className="w-full px-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-center text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        {passcodeError && (
                          <div className="text-xs text-rose-400 font-bold">密码错误，请重试</div>
                        )}
                        <button
                          type="button"
                          onClick={handleVerifyPasscode}
                          className="w-full py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-all cursor-pointer"
                        >
                          解锁私密保险箱
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-amber-400 flex items-center space-x-1">
                        <LockKeyhole size={14} />
                        <span>隐藏保险箱解密档案</span>
                      </span>

                      <div className="space-y-3">
                        {phoneData.hiddenVault.items.map((item) => (
                          <div key={item.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-white">
                              <span>{item.name}</span>
                              <span className="text-[10px] text-amber-400 font-mono">{item.date}</span>
                            </div>
                            <p className="text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                              {item.secretDesc}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 9. SCREEN TIME */}
              {activeApp === 'screentime' && (
                <div className="space-y-4">
                  <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">今日屏幕使用总时长</span>
                      <span className="text-xs font-mono font-bold text-sky-600">{phoneData.screenTime.unlockCount} 次解锁</span>
                    </div>
                    <div className="text-2xl font-black text-slate-800 font-mono">
                      {Math.floor(phoneData.screenTime.totalMinutes / 60)}小时 {phoneData.screenTime.totalMinutes % 60}分钟
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-600">应用使用时长分布</span>
                    {phoneData.screenTime.topApps.map((a, i) => (
                      <div key={i} className="p-3 bg-white border border-slate-200 shadow-sm rounded-xl flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-800">{a.name}</div>
                          <div className="text-[10px] text-slate-500">{a.category}</div>
                        </div>
                        <span className="text-xs font-bold text-sky-600 font-mono">{a.minutes} 分钟</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 10. ALARMS */}
              {activeApp === 'alarms' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-yellow-600 flex items-center space-x-1">
                    <AlarmClock size={14} />
                    <span>闹铃与备注</span>
                  </span>

                  <div className="space-y-3">
                    {phoneData.alarms.map((a) => (
                      <div key={a.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="text-xl font-black text-slate-800 font-mono">{a.time}</div>
                          <div className="text-xs text-slate-500">{a.label}</div>
                        </div>
                        <span className="text-[10px] text-emerald-600 font-mono bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/30">
                          {a.repeat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 11. HEALTH & SLEEP */}
              {activeApp === 'health' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-1">
                      <div className="text-[10px] text-slate-500">睡眠时长</div>
                      <div className="text-sm font-black text-rose-600 font-mono">{phoneData.healthData.sleepDuration}</div>
                      <div className="text-[10px] text-emerald-600">{phoneData.healthData.sleepQuality}</div>
                    </div>

                    <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-1">
                      <div className="text-[10px] text-slate-500">今日步数</div>
                      <div className="text-sm font-black text-indigo-600 font-mono">{phoneData.healthData.stepsToday} 步</div>
                      <div className="text-[10px] text-slate-500">平均心率 {phoneData.healthData.avgHeartRate} bpm</div>
                    </div>
                  </div>
                </div>
              )}

              {/* 12. MAP SEARCH */}
              {activeApp === 'map' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-teal-600 flex items-center space-x-1">
                    <MapPin size={14} />
                    <span>地图历史路线与收藏地点</span>
                  </span>

                  <div className="space-y-2">
                    {phoneData.mapSearches.map((m) => (
                      <div key={m.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                            <span>{m.destination}</span>
                            {m.isFavorite && <span className="text-[9px] text-amber-600 font-bold px-1 rounded bg-amber-400/10">收藏</span>}
                          </div>
                          <div className="text-[10px] text-slate-500">{m.address}</div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{m.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 13. GAME CENTER */}
              {activeApp === 'game' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                      <Gamepad2 size={14} />
                      <span>Steam游戏动态</span>
                    </span>
                  </div>

                  <div className="space-y-3">
                    {phoneData.gameCenter?.games?.map(game => (
                      <div key={game.id} className="p-4 bg-slate-900 border border-slate-800 shadow-sm rounded-2xl flex flex-col space-y-2">
                        <div className="text-base font-bold text-white">{game.name}</div>
                        <div className="text-xs text-slate-400 font-mono mb-1">本次游玩：{game.playTime}</div>
                        <div className="text-xs text-slate-300 leading-relaxed">
                          {game.details}
                        </div>
                        {game.lastPlayedAt && (
                          <div className="flex justify-end pt-1">
                            <span className="text-[10px] text-slate-500 font-mono">{game.lastPlayedAt}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 14. SPAM GUARD */}
              {activeApp === 'spam' && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-400 flex items-center space-x-1">
                    <ShieldAlert size={14} />
                    <span>骚扰拦截记录 (通话与短信)</span>
                  </span>

                  <div className="space-y-2">
                    {phoneData.blockedInterceptions.map((b) => (
                      <div key={b.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-white">
                          <span>{b.sender}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{b.time}</span>
                        </div>
                        <p className="text-xs text-slate-400">{b.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- API KEY / NETWORK ERROR ALERT MODAL --- */}
      <AnimatePresence>
        {apiErrorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 font-sans"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-w-sm w-full relative overflow-hidden"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setApiErrorModal(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>

              {/* Header Icon */}
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-4">
                {apiErrorModal.type === 'no_key' ? (
                  <Key size={24} />
                ) : (
                  <WifiOff size={24} />
                )}
              </div>

              {/* Title & Detailed Message */}
              <h3 className="text-base font-black text-white mb-2">
                {apiErrorModal.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {apiErrorModal.message}
              </p>

              {apiErrorModal.type === 'no_key' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4 flex items-start space-x-2.5">
                  <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-200/90 leading-tight">
                    请在主主窗口顶栏点击【设置】图标，配置个人的 Gemini API Key 后即可全动态生成深度角色隐私数据。
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setApiErrorModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                >
                  关闭
                </button>

                {selectedCharacterId && activeApp && (
                  <button
                    type="button"
                    onClick={() => {
                      setApiErrorModal(null);
                      generateAndCacheAppPhoneData(selectedCharacterId, activeApp);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-1"
                  >
                    <RefreshCw size={14} />
                    <span>重试</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
