/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Trash2, 
  X, 
  Home, 
  Tag, 
  Info,
  CalendarDays,
  Sparkles,
  MapPin,
  ChevronDown,
  ChevronUp,
  Palette,
  Check,
  RotateCcw,
  Pipette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbInstance } from '../lib/db';
import { generateCharacterSchedule, getSystemMemoryPrompt } from '../lib/api';

export interface CalendarTheme {
  id: string;
  name: string;
  description: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  headerBg: string;
  headerBorder: string;
  headerText: string;
  mainBg: string;
  cardBg: string;
  cardBorder: string;
  accentText: string;
  accentLight: string;
  isCustom?: boolean;
}

export const CALENDAR_THEME_PRESETS: CalendarTheme[] = [
  {
    id: 'classic_gold',
    name: '经典暖金',
    description: '温暖明亮的经典日历金色',
    primary: '#FFCC00',
    primaryHover: '#E6B800',
    primaryText: '#18181B',
    headerBg: '#FFFFFF',
    headerBorder: '#E4E4E7',
    headerText: '#18181B',
    mainBg: '#FCFAF5',
    cardBg: '#FFFFFF',
    cardBorder: '#E4E4E7',
    accentText: '#B38F00',
    accentLight: 'rgba(255, 204, 0, 0.14)'
  },
  {
    id: 'elegant_green',
    name: '抹茶绿',
    description: '清透舒适的鼠尾草与草木绿',
    primary: '#788A66',
    primaryHover: '#667755',
    primaryText: '#FAFCF8',
    headerBg: '#BDD6B3',
    headerBorder: '#A7C49E',
    headerText: '#151810',
    mainBg: '#F4F6F1',
    cardBg: '#FAFCF8',
    cardBorder: '#D0D9C7',
    accentText: '#5C6B4D',
    accentLight: 'rgba(120, 138, 102, 0.14)'
  },
  {
    id: 'serene_blue',
    name: '雾霾蓝',
    description: '宁静沉着的雾霭海蓝',
    primary: '#4A7297',
    primaryHover: '#3C6182',
    primaryText: '#FAFBFC',
    headerBg: '#B9CDE1',
    headerBorder: '#A2BDD7',
    headerText: '#121A21',
    mainBg: '#F4F7FA',
    cardBg: '#FAFBFC',
    cardBorder: '#D2DEEB',
    accentText: '#3B5B7B',
    accentLight: 'rgba(74, 114, 151, 0.14)'
  },
  {
    id: 'sakura_pink',
    name: '落樱粉',
    description: '甜美柔和的初樱花色',
    primary: '#E17899',
    primaryHover: '#C96282',
    primaryText: '#FFFFFF',
    headerBg: '#F7CAD9',
    headerBorder: '#EBB4C7',
    headerText: '#2D141C',
    mainBg: '#FCF6F8',
    cardBg: '#FDF9FA',
    cardBorder: '#F2D0DB',
    accentText: '#B84E70',
    accentLight: 'rgba(225, 120, 153, 0.14)'
  },
  {
    id: 'lavender_purple',
    name: '浅芋紫',
    description: '梦幻轻盈的薰衣草紫',
    primary: '#8E7CC3',
    primaryHover: '#7A67AE',
    primaryText: '#FFFFFF',
    headerBg: '#D5CCE8',
    headerBorder: '#C1B6DC',
    headerText: '#1E172E',
    mainBg: '#F7F5FA',
    cardBg: '#FAF9FC',
    cardBorder: '#DDD7EC',
    accentText: '#6C59A0',
    accentLight: 'rgba(142, 124, 195, 0.14)'
  },
  {
    id: 'amber_orange',
    name: '暮秋枫',
    description: '温暖醇厚的秋日焦糖橙',
    primary: '#D97736',
    primaryHover: '#C06324',
    primaryText: '#FFFFFF',
    headerBg: '#FAD5BA',
    headerBorder: '#ECC3A2',
    headerText: '#2E180B',
    mainBg: '#FAF6F2',
    cardBg: '#FCFAF7',
    cardBorder: '#EED6C3',
    accentText: '#AA541C',
    accentLight: 'rgba(217, 119, 54, 0.14)'
  },
  {
    id: 'fresh_mint',
    name: '薄荷绿',
    description: '清新通透的晨露薄荷',
    primary: '#3EA87E',
    primaryHover: '#328F69',
    primaryText: '#FFFFFF',
    headerBg: '#BCE8D3',
    headerBorder: '#A5DDC3',
    headerText: '#0E281E',
    mainBg: '#F2F9F5',
    cardBg: '#F7FCF9',
    cardBorder: '#C8E9D9',
    accentText: '#2E805E',
    accentLight: 'rgba(62, 168, 126, 0.14)'
  },
  {
    id: 'slate_dark',
    name: '黛墨灰',
    description: '内敛高级的现代极简石墨',
    primary: '#475569',
    primaryHover: '#334155',
    primaryText: '#FFFFFF',
    headerBg: '#CBD5E1',
    headerBorder: '#94A3B8',
    headerText: '#0F172A',
    mainBg: '#F8FAFC',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    accentText: '#334155',
    accentLight: 'rgba(71, 85, 105, 0.14)'
  }
];

// Helper to adjust color in HSB space (H delta, S delta %, B delta %)
function adjustHsbColor(color: string, deltaH: number = 0, deltaS: number = -6, deltaB: number = 3): string {
  if (!color || typeof color !== 'string') return 'rgb(255, 255, 255)';
  let r = 255, g = 255, b = 255;
  if (color.startsWith('#')) {
    const hex = color.replace('#', '').trim();
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16) || 255;
      g = parseInt(hex[1] + hex[1], 16) || 255;
      b = parseInt(hex[2] + hex[2], 16) || 255;
    } else {
      r = parseInt(hex.substring(0, 2), 16) || 255;
      g = parseInt(hex.substring(2, 4), 16) || 255;
      b = parseInt(hex.substring(4, 6), 16) || 255;
    }
  } else {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) {
      r = parseInt(match[1], 10) || 255;
      g = parseInt(match[2], 10) || 255;
      b = parseInt(match[3], 10) || 255;
    }
  }

  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / delta) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / delta + 2;
    } else {
      h = (rNorm - gNorm) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;

  const newH = (h + deltaH + 360) % 360;
  const newS = Math.max(0, Math.min(100, s + deltaS)) / 100;
  const newB = Math.max(0, Math.min(100, v + deltaB)) / 100;

  const c = newB * newS;
  const x = c * (1 - Math.abs(((newH / 60) % 2) - 1));
  const m = newB - c;

  let r1 = 0, g1 = 0, b1 = 0;
  if (newH >= 0 && newH < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (newH >= 60 && newH < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (newH >= 120 && newH < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (newH >= 180 && newH < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (newH >= 240 && newH < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }

  return `rgb(${Math.round((r1 + m) * 255)}, ${Math.round((g1 + m) * 255)}, ${Math.round((b1 + m) * 255)})`;
}

// Helper to calculate custom theme from hex color
function generateCustomThemeFromHex(hex: string): CalendarTheme {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 120;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 138;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 102;

  // Calculate luminance for text contrast on primary
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  const primaryText = lum > 0.65 ? '#18181B' : '#FFFFFF';

  // Lighter header tint
  const hr = Math.round(r + (255 - r) * 0.45);
  const hg = Math.round(g + (255 - g) * 0.45);
  const hb = Math.round(b + (255 - b) * 0.45);
  const headerBg = `rgb(${hr}, ${hg}, ${hb})`;

  // Header border
  const hbr = Math.round(r + (255 - r) * 0.3);
  const hbg = Math.round(g + (255 - g) * 0.3);
  const hbb = Math.round(b + (255 - b) * 0.3);
  const headerBorder = `rgb(${hbr}, ${hbg}, ${hbb})`;

  // Background tint
  const mbr = Math.round(r + (255 - r) * 0.94);
  const mbg = Math.round(g + (255 - g) * 0.94);
  const mbb = Math.round(b + (255 - b) * 0.94);
  const mainBg = `rgb(${mbr}, ${mbg}, ${mbb})`;

  // Card surface
  const cbr = Math.round(r + (255 - r) * 0.98);
  const cbg = Math.round(g + (255 - g) * 0.98);
  const cbb = Math.round(b + (255 - b) * 0.98);
  const cardBg = `rgb(${cbr}, ${cbg}, ${cbb})`;

  // Card border
  const cbor_r = Math.round(r + (255 - r) * 0.8);
  const cbor_g = Math.round(g + (255 - g) * 0.8);
  const cbor_b = Math.round(b + (255 - b) * 0.8);
  const cardBorder = `rgb(${cbor_r}, ${cbor_g}, ${cbor_b})`;

  // Hover
  const hvr_r = Math.max(0, Math.round(r * 0.88));
  const hvr_g = Math.max(0, Math.round(g * 0.88));
  const hvr_b = Math.max(0, Math.round(b * 0.88));
  const primaryHover = `rgb(${hvr_r}, ${hvr_g}, ${hvr_b})`;

  return {
    id: `custom_${cleanHex}`,
    name: '自定义专属色',
    description: `Hex: #${cleanHex.toUpperCase()}`,
    primary: `#${cleanHex}`,
    primaryHover,
    primaryText,
    headerBg,
    headerBorder,
    headerText: '#18181B',
    mainBg,
    cardBg,
    cardBorder,
    accentText: `#${cleanHex}`,
    accentLight: `rgba(${r}, ${g}, ${b}, 0.14)`,
    isCustom: true
  };
}

interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  time: string; // e.g. "14:30"
  date: string; // e.g. "2026-07-03"
  category: 'work' | 'birthday' | 'life' | 'anniversary';
  location?: string;
  characterId?: string;
  characterMood?: string;
}

const CATEGORY_COLORS = {
  work: {
    bg: 'bg-indigo-50/70 border-indigo-100',
    border: 'border-indigo-150',
    text: 'text-indigo-600',
    dot: 'bg-indigo-500',
    label: '工作事务'
  },
  birthday: {
    bg: 'bg-[#FFCC00]/10 border-[#FFCC00]/20',
    border: 'border-[#FFCC00]/40',
    text: 'text-[#B38F00]',
    dot: 'bg-[#FFCC00]',
    label: '生日'
  },
  life: {
    bg: 'bg-emerald-50/70 border-emerald-100',
    border: 'border-emerald-150',
    text: 'text-emerald-600',
    dot: 'bg-emerald-500',
    label: '日常生活'
  },
  anniversary: {
    bg: 'bg-rose-50/70 border-rose-100',
    border: 'border-rose-150',
    text: 'text-rose-600',
    dot: 'bg-rose-500',
    label: '纪念日'
  }
};

const getTodayDateString = (offsetDays = 0) => {
  const d = new Date();
  if (offsetDays !== 0) {
    d.setDate(d.getDate() + offsetDays);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${r}`;
};

const formatDisplayName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*[\(\（].*?[\)\）]/g, '').trim();
};

const INITIAL_EVENTS: CalendarEvent[] = [];

export default function CalendarView({ onHome }: { onHome?: () => void }) {
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('calendar_events');
    return saved ? JSON.parse(saved) : INITIAL_EVENTS;
  });

  const [characters, setCharacters] = useState<Array<{ id: string; name: string; avatar: string; memory: string }>>([]);

  const [generatingCharId, setGeneratingCharId] = useState<string | null>(null);
  const [charactersCollapsed, setCharactersCollapsed] = useState(false);

  useEffect(() => {
    async function loadCustomCharacters() {
      try {
        const sessions = await dbInstance.getAllSessions();
        const customChars = sessions
          .filter(s => !s.isGroup && !s.isContactDeleted && !['session_octocat_author'].includes(s.id))
          .map(s => ({
            id: s.id.replace('session_', ''),
            name: formatDisplayName(s.characterName),
            avatar: s.characterAvatar,
            memory: getSystemMemoryPrompt(s)
          }));
        
        setCharacters(customChars);
      } catch (e) {
        console.error('Failed to load custom characters in calendar', e);
      }
    }
    loadCustomCharacters();
  }, []);

  const isEventCompleted = (event: CalendarEvent) => {
    // Current local actual time
    const now = new Date();
    
    // event.date is "YYYY-MM-DD", event.time is "HH:MM"
    const [y, m, d] = event.date.split('-').map(Number);
    const [hour, min] = event.time.split(':').map(Number);
    
    const eventDateTime = new Date(y, m - 1, d, hour, min, 0);
    
    // Compare
    return now > eventDateTime;
  };

  const handleGenerateSchedule = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    setGeneratingCharId(charId);

    try {
      let generatedEvents: Array<any> = [];
      const settings = await dbInstance.getSettings();
      
      if (settings.apiKey) {
        try {
          const apiResponse = await generateCharacterSchedule(char.name, char.memory, selectedDateStr);
          if (apiResponse && apiResponse.length > 0) {
            generatedEvents = apiResponse;
          }
        } catch (apiError) {
          console.warn('API generation failed, falling back to offline preset', apiError);
        }
      }

      if (generatedEvents.length === 0) {
        if (charId === 'octocat_author') {
          generatedEvents = [
            {
              time: '09:00',
              title: '晨间代码重构与日常 Debug',
              description: '开始新一天的系统优化，处理昨日积攒的反馈，让系统运行更加流畅。💻',
              category: 'work',
              characterMood: '💻 专注、高效'
            },
            {
              time: '12:30',
              title: '异地街角拉面店午餐',
              description: '去楼下相熟的拉面馆吃一碗热腾腾的叉烧拉面，顺便用手机拍张照。🍜',
              category: 'life',
              characterMood: '🍜 饱腹、惬意'
            },
            {
              time: '15:00',
              title: '手机通知框架性能调优',
              description: '优化本地 IndexedDB 存储性能，精简代码，确保手机省电省流量。',
              category: 'work',
              characterMood: '⚙️ 挑战、沉浸'
            },
            {
              time: '20:00',
              title: '下班后的城市散步与吹风',
              description: '在异地的公园散散步，看看城市晚霞与夜景，呼吸新鲜空气，顺便给好朋友发个微信。🍁',
              category: 'life',
              characterMood: '🍃 轻松、思念'
            }
          ];
        } else {
          generatedEvents = [
            {
              time: '09:30',
              title: `开启新的一天：${char.name} 的早茶时间`,
              description: `给自己泡一杯温热的饮品，开始规划今天的工作和学习生活。*微笑着眨眼*`,
              category: 'life',
              characterMood: '☀️ 积极、期待'
            },
            {
              time: '14:00',
              title: `专注的任务执行与处理`,
              description: `集中精力解决手头最重要的工作和问题，展示完美的专业风采。`,
              category: 'work',
              characterMood: '💪 沉着、自信'
            },
            {
              time: '18:30',
              title: `散步与夕阳捕捉`,
              description: `沿着公园漫步，呼吸新鲜空气，用手机记录下美丽的晚霞。`,
              category: 'life',
              characterMood: '🍁 惬意、放松'
            },
            {
              time: '21:30',
              title: `深夜复盘与阅读疗愈`,
              description: `翻阅一两本喜欢的小说或进行冥想，给今天画上完美的句号。`,
              category: 'life',
              characterMood: '🌙 恬静、释然'
            }
          ];
        }
      }

      const newCalendarEvents: CalendarEvent[] = generatedEvents.map((evt, idx) => ({
        id: `${charId}_event_${Date.now()}_${idx}`,
        title: evt.title,
        description: evt.description,
        time: evt.time,
        date: selectedDateStr,
        category: evt.category || 'life',
        location: charId === 'octocat_author' ? '独立工作室' : '离线处所',
        characterId: charId,
        characterMood: evt.characterMood
      }));

      setEvents(prev => {
        const filtered = prev.filter(e => !(e.characterId === charId && e.date === selectedDateStr));
        return [...filtered, ...newCalendarEvents];
      });

    } catch (err) {
      console.error('Error generating schedule', err);
    } finally {
      setGeneratingCharId(null);
    }
  };

  const [currentTheme, setCurrentTheme] = useState<CalendarTheme>(() => {
    const saved = localStorage.getItem('calendar_app_theme');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.primary) return parsed;
      } catch (e) {
        console.error('Failed to parse calendar theme', e);
      }
    }
    return CALENDAR_THEME_PRESETS[0]; // classic_gold
  });

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [customHexInput, setCustomHexInput] = useState('#788A66');

  const handleSelectPresetTheme = (theme: CalendarTheme) => {
    setCurrentTheme(theme);
    localStorage.setItem('calendar_app_theme', JSON.stringify(theme));
  };

  const handleApplyCustomColor = (hex: string) => {
    const theme = generateCustomThemeFromHex(hex);
    setCurrentTheme(theme);
    localStorage.setItem('calendar_app_theme', JSON.stringify(theme));
  };

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTime, setNewTime] = useState('12:00');
  const [newCategory, setNewCategory] = useState<'work' | 'birthday' | 'life' | 'anniversary'>('anniversary');
  const [newLocation, setNewLocation] = useState('');
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('calendar_events', JSON.stringify(events));
  }, [events]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (y: number, m: number) => {
    // 0 is Sunday, 1 is Monday, etc.
    const day = new Date(y, m, 1).getDay();
    // Shift so 0 is Monday, 6 is Sunday for standard calendar
    return day === 0 ? 6 : day - 1;
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  // Generate calendar cells (including leading/trailing padding days from prev/next month)
  const daysArray: { date: Date; isCurrentMonth: boolean }[] = [];

  // Previous month padding days
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysArray.push({
      date: new Date(year, month - 1, prevMonthDays - i),
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    daysArray.push({
      date: new Date(year, month, i),
      isCurrentMonth: true
    });
  }

  // Next month padding days to complete a 6-row grid (42 cells)
  const totalCells = 42;
  const nextMonthPadding = totalCells - daysArray.length;
  for (let i = 1; i <= nextMonthPadding; i++) {
    daysArray.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false
    });
  }

  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const selectedDateStr = formatDateString(selectedDate);
  const selectedDayEvents = events.filter(e => e.date === selectedDateStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newEvent: CalendarEvent = {
      id: `event_${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim(),
      time: newTime || '12:00',
      date: selectedDateStr,
      category: newCategory,
      location: newLocation.trim() || undefined
    };

    setEvents(prev => [...prev, newEvent]);
    setNewTitle('');
    setNewDescription('');
    setNewTime('12:00');
    setNewCategory('anniversary');
    setNewLocation('');
    setShowAddModal(false);
  };

  const handleDeleteEvent = (id: string) => {
    setDeleteEventId(id);
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const getEventsForDayString = (dateStr: string) => {
    return events.filter(e => e.date === dateStr);
  };

  const headerButtonBg = useMemo(
    () => adjustHsbColor(currentTheme.headerBg, 0, -6, 3),
    [currentTheme.headerBg]
  );

  return (
    <div 
      className="flex-1 flex flex-col overflow-hidden relative text-zinc-800 transition-colors duration-200"
      style={{ backgroundColor: currentTheme.mainBg }}
    >
      {/* Header Bar - strictly 8x grid (h-16 = 64px, px-4 = 16px) */}
      <header 
        className="h-16 px-4 border-b flex items-center justify-between shrink-0 z-10 shadow-xs transition-colors duration-200"
        style={{
          backgroundColor: currentTheme.headerBg,
          borderBottomColor: currentTheme.headerBorder,
          color: currentTheme.headerText
        }}
      >
        <div className="flex items-center space-x-3">
          {onHome && (
            <button
              type="button"
              onClick={onHome}
              className="w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs hover:opacity-90"
              style={{
                backgroundColor: headerButtonBg,
                borderColor: currentTheme.headerBorder,
                color: currentTheme.headerText
              }}
              title="返回手机桌面"
            >
              <Home size={16} className="stroke-[2.5]" />
            </button>
          )}
          <div>
            <h2 className="text-base font-black leading-none" style={{ color: currentTheme.headerText }}>日历</h2>
            <p className="text-[10px] font-sans uppercase mt-1 opacity-70" style={{ color: currentTheme.headerText }}>Calendar &amp; Tasks</p>
          </div>
        </div>

        {/* Right action bar: Theme button (Palette SVG icon) */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowThemeModal(true)}
            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs hover:opacity-90"
            style={{
              backgroundColor: headerButtonBg,
              borderColor: currentTheme.headerBorder,
              color: currentTheme.headerText
            }}
            title="日历主题配色"
          >
            <Palette size={16} className="stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* Main Content Area - Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        
        {/* Calendar Card Widget */}
        <div 
          className="p-4 border rounded-2xl shadow-xs flex flex-col space-y-4 transition-colors duration-200"
          style={{
            backgroundColor: currentTheme.cardBg,
            borderColor: currentTheme.cardBorder
          }}
        >
          
          {/* Month selector navigation row */}
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold font-sans text-zinc-800">
              {year}年 {month + 1}月
            </h2>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-lg bg-black/5 hover:bg-black/10 active:scale-95 flex items-center justify-center transition-all border border-black/5 cursor-pointer text-zinc-700"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg bg-black/5 hover:bg-black/10 active:scale-95 flex items-center justify-center transition-all border border-black/5 cursor-pointer text-zinc-700"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Weekdays row */}
          <div className="grid grid-cols-7 gap-2 text-center">
            {['一', '二', '三', '四', '五', '六', '日'].map((day, idx) => (
              <span key={idx} className="text-[10px] font-bold text-zinc-400 font-sans uppercase">
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid - 42 cells strictly formatted */}
          <div className="grid grid-cols-7 gap-2">
            {daysArray.map((cell, idx) => {
              const dayEvents = getEventsForDayString(formatDateString(cell.date));
              const isSelected = isSameDay(cell.date, selectedDate);
              const isToday = isSameDay(cell.date, new Date()); // Today's date sync with system
              
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDate(cell.date)}
                  className={`h-10 rounded-lg flex flex-col items-center justify-between py-1 relative transition-all cursor-pointer ${
                    !cell.isCurrentMonth ? 'opacity-30 text-zinc-400' : 'opacity-100'
                  } ${
                    isSelected 
                      ? 'font-extrabold shadow-md scale-105 border' 
                      : isToday
                        ? 'font-bold border'
                        : 'bg-zinc-50/80 hover:bg-zinc-100/90 text-zinc-800 border border-zinc-200/40'
                  }`}
                  style={
                    isSelected
                      ? {
                          backgroundColor: currentTheme.primary,
                          color: currentTheme.primaryText,
                          borderColor: currentTheme.primaryHover
                        }
                      : isToday
                        ? {
                            backgroundColor: currentTheme.accentLight,
                            color: currentTheme.accentText,
                            borderColor: currentTheme.primary
                          }
                        : undefined
                  }
                >
                  <span className="text-[11px] font-sans leading-none pt-0.5">
                    {cell.date.getDate()}
                  </span>
                  
                  {/* Event indicator dots */}
                  <div className="flex justify-center space-x-2 h-2 w-full items-center">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span 
                        key={e.id} 
                        className={`w-2 h-2 rounded-full ${CATEGORY_COLORS[e.category].dot}`} 
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

        </div>

        {/* Character Daily Schedule Generator - Bento Style */}
        <div 
          className="p-4 border rounded-2xl shadow-xs flex flex-col space-y-3 transition-colors duration-200"
          style={{
            backgroundColor: currentTheme.cardBg,
            borderColor: currentTheme.cardBorder
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles size={14} style={{ color: currentTheme.primary }} />
              <h3 className="text-xs font-black text-zinc-850">查看行程</h3>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[9px] bg-zinc-100 text-zinc-400 font-mono px-2 py-0.5 rounded-full uppercase">Character Sync</span>
              <button
                type="button"
                onClick={() => setCharactersCollapsed(!charactersCollapsed)}
                className="p-1 hover:bg-zinc-100 rounded-md text-zinc-500 transition-colors flex items-center justify-center cursor-pointer"
                title={charactersCollapsed ? "展开角色列表" : "收起角色列表"}
              >
                {charactersCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
          </div>
          
          <AnimatePresence initial={false}>
            {!charactersCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {characters.map((char) => {
                    const isGenerating = generatingCharId === char.id;
                    
                    // Count how many events this character has today
                    const todayCharEvents = events.filter(e => e.characterId === char.id && e.date === selectedDateStr);
                    
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => !isGenerating && handleGenerateSchedule(char.id)}
                        disabled={isGenerating}
                        className={`p-3 rounded-xl border text-left flex items-center space-x-3 transition-all cursor-pointer select-none active:scale-[0.98] ${
                          todayCharEvents.length > 0 
                            ? '' 
                            : 'border-zinc-200 bg-white hover:bg-zinc-50'
                        }`}
                        style={todayCharEvents.length > 0 ? {
                          backgroundColor: currentTheme.accentLight,
                          borderColor: currentTheme.primary
                        } : undefined}
                      >
                        {/* Character Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg relative shrink-0 overflow-hidden ${
                          isGenerating ? 'animate-spin border-2 border-dashed border-zinc-400' : 'bg-zinc-100 border border-zinc-200 shadow-2xs'
                        }`}>
                          {isGenerating ? (
                            '⏳'
                          ) : char.avatar && (char.avatar.startsWith('data:') || char.avatar.startsWith('http') || char.avatar.startsWith('blob:') || char.avatar.startsWith('/')) ? (
                            <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-base font-bold text-zinc-700 select-none">
                              {char.avatar && char.avatar.length <= 4 ? char.avatar : (char.name ? char.name.slice(0, 1) : '👤')}
                            </span>
                          )}
                        </div>
                        
                        {/* Character Details */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-zinc-850 truncate">{char.name}</p>
                          {isGenerating ? (
                            <p className="text-[9px] font-medium animate-pulse mt-0.5" style={{ color: currentTheme.accentText }}>计算行程中...</p>
                          ) : todayCharEvents.length > 0 ? (
                            <p className="text-[9px] text-emerald-600 font-medium flex items-center mt-0.5">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1" />
                              已同步 {todayCharEvents.length} 个行程
                            </p>
                          ) : (
                            <p className="text-[9px] text-zinc-400 mt-0.5">暂无今日日程</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Selected date header and event controller */}
        <div 
          className="flex items-center justify-between border-l-4 pl-4 py-2"
          style={{ borderLeftColor: currentTheme.primary }}
        >
          <div>
            <h3 className="text-xs font-black text-zinc-800">
              {selectedDate.getFullYear()}年{selectedDate.getMonth() + 1}月{selectedDate.getDate()}日 日程表
            </h3>
            <p className="text-[10px] text-zinc-450 font-sans mt-1">
              {selectedDayEvents.length} 个日程安排
            </p>
          </div>
          
          {/* Add schedule button */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="w-10 h-10 rounded-lg active:scale-90 flex items-center justify-center shadow transition-all border cursor-pointer"
            style={{
              backgroundColor: currentTheme.primary,
              color: currentTheme.primaryText,
              borderColor: currentTheme.primaryHover
            }}
            title="添加新日程"
          >
            <Plus size={16} className="stroke-[2.5]" />
          </button>
        </div>

        {/* Events listing */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {selectedDayEvents.length > 0 ? (
              selectedDayEvents.map((event) => {
                const colorConfig = CATEGORY_COLORS[event.category];
                const completed = isEventCompleted(event);
                const charDetails = event.characterId ? characters.find(c => c.id === event.characterId) : null;
                
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`p-4 rounded-2xl border ${
                      completed ? 'border-zinc-200 bg-zinc-50/50' : colorConfig.bg
                    } flex flex-col space-y-4 shadow-sm bg-white relative overflow-hidden`}
                  >
                    {/* Semi-transparent completed stamp in background */}
                    {completed && (
                      <div className="absolute top-2 right-2 rotate-12 text-[10px] border border-zinc-300 text-zinc-400 rounded px-1.5 py-0.5 select-none font-bold bg-white/80 pointer-events-none uppercase">
                        CLOSED
                      </div>
                    )}

                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-bold px-3 py-1 rounded-lg border ${
                            completed ? 'border-zinc-300 text-zinc-400 bg-zinc-100' : `${colorConfig.border} ${colorConfig.text} bg-zinc-50`
                          }`}>
                            {colorConfig.label}
                          </span>
                          
                          {/* Character Avatar badge if applicable */}
                          {charDetails && (
                            <span className="text-[10px] bg-zinc-100/80 border border-zinc-200 text-zinc-700 px-2 py-0.5 rounded-lg flex items-center space-x-1">
                              <span className="text-sm leading-none">{charDetails.avatar}</span>
                              <span className="font-semibold text-[9px] text-zinc-600">{charDetails.name.split(' ')[0]}</span>
                            </span>
                          )}

                          {/* Character Mood if applicable */}
                          {event.characterMood && (
                            <span className="text-[9px] bg-amber-50/80 border border-amber-200/60 text-amber-700 px-2 py-0.5 rounded-lg font-medium flex items-center">
                              {event.characterMood}
                            </span>
                          )}

                          <span className={`text-[11px] font-sans flex items-center ${
                            completed ? 'text-zinc-400' : 'text-zinc-500'
                          }`}>
                            <Clock size={10} className="mr-1.5" />
                            {event.time}
                          </span>
                        </div>
                        
                        <h4 className={`text-xs font-black block pt-2 ${
                          completed ? 'line-through text-zinc-400 decoration-zinc-400/80' : 'text-zinc-800'
                        }`}>
                          {event.title}
                        </h4>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(event.id)}
                        className="p-2 bg-zinc-50 hover:bg-rose-50 text-zinc-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer border border-zinc-200 hover:border-rose-100 active:scale-90 shrink-0"
                        title="删除日程"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {event.description && (
                      <p className={`text-[11px] leading-relaxed font-sans p-4 rounded-lg border ${
                        completed 
                          ? 'bg-zinc-50/30 border-zinc-150 text-zinc-400 line-through decoration-zinc-350/50' 
                          : 'bg-zinc-50/70 border-zinc-150/60 text-zinc-650'
                      }`}>
                        {event.description}
                      </p>
                    )}

                    {event.location && (
                      <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-sans">
                        <MapPin size={10} className="text-zinc-400" />
                        <span className={completed ? 'line-through text-zinc-400' : ''}>{event.location}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 bg-white border border-zinc-200/60 rounded-2xl"
              >
                <CalendarDays size={32} className="mx-auto text-zinc-300 mb-2" />
                <p className="text-[11px] text-zinc-400">此日暂无安排</p>
                <p className="text-[9px] text-zinc-300 font-sans mt-1">NO EVENTS SCHEDULED</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Theme Picker Modal */}
      <AnimatePresence>
        {showThemeModal && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs z-40 flex flex-col justify-end">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
              className="bg-white border-t border-zinc-200 rounded-t-[32px] p-6 space-y-6 max-h-[85%] overflow-y-auto shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex justify-between items-center pb-2 border-b border-zinc-100">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center border shadow-2xs"
                    style={{
                      backgroundColor: currentTheme.accentLight,
                      borderColor: currentTheme.primary,
                      color: currentTheme.primary
                    }}
                  >
                    <Palette size={16} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 leading-none">日历主题配色</h3>
                    <p className="text-[10px] font-sans text-zinc-400 uppercase mt-1">Calendar Theme Palette</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPresetTheme(CALENDAR_THEME_PRESETS[0])}
                    className="h-8 px-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
                    title="恢复默认暖金主题"
                  >
                    <RotateCcw size={12} />
                    <span>默认</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowThemeModal(false)}
                    className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center transition-all border border-zinc-200 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Theme Presets List */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 block uppercase font-sans tracking-wider">预设主题风格</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {CALENDAR_THEME_PRESETS.map((preset) => {
                    const isSelected = currentTheme.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetTheme(preset)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer select-none active:scale-[0.98] ${
                          isSelected
                            ? 'ring-2 shadow-xs'
                            : 'border-zinc-200 hover:border-zinc-300 bg-zinc-50/60 hover:bg-zinc-50'
                        }`}
                        style={isSelected ? {
                          borderColor: preset.primary,
                          backgroundColor: preset.accentLight,
                          outlineColor: preset.primary
                        } : undefined}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          {/* Color swatch */}
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
                            <p className="text-xs font-bold text-zinc-800 truncate">{preset.name}</p>
                            <p className="text-[9px] text-zinc-400 truncate">{preset.description}</p>
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

              {/* Custom Color Picker Section */}
              <div className="space-y-3 pt-2 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Pipette size={12} className="text-zinc-400" />
                    <label className="text-[10px] font-bold text-zinc-400 uppercase font-sans tracking-wider">自定义任意主色调</label>
                  </div>
                  {currentTheme.isCustom && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                      自定义已生效
                    </span>
                  )}
                </div>

                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3">
                  <div className="flex items-center space-x-3">
                    {/* Native color picker box */}
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-300 shadow-2xs shrink-0 cursor-pointer">
                      <input
                        type="color"
                        value={customHexInput}
                        onChange={(e) => {
                          setCustomHexInput(e.target.value);
                          handleApplyCustomColor(e.target.value);
                        }}
                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer opacity-100"
                        title="点击选择颜色"
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
                        className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-bold text-zinc-800 focus:outline-none focus:border-zinc-400"
                      />
                    </div>

                    {/* Apply Button */}
                    <button
                      type="button"
                      onClick={() => handleApplyCustomColor(customHexInput)}
                      className="h-10 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-xs shrink-0"
                    >
                      应用
                    </button>
                  </div>

                  {/* Quick Color Swatches */}
                  <div className="flex items-center space-x-2 pt-1 overflow-x-auto pb-1">
                    {['#FF5722', '#009688', '#3F51B5', '#E91E63', '#673AB7', '#00BCD4', '#8BC34A', '#795548', '#607D8B', '#FF7043'].map((colorHex) => (
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

              {/* Confirm Done Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowThemeModal(false)}
                  className="w-full h-10 rounded-lg font-bold shadow-xs transition-all border cursor-pointer active:scale-95 flex items-center justify-center space-x-2"
                  style={{
                    backgroundColor: currentTheme.primary,
                    color: currentTheme.primaryText,
                    borderColor: currentTheme.primaryHover
                  }}
                >
                  <Check size={16} className="stroke-[2.5]" />
                  <span>完成设置</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Add Event Modal Dialog */}
      <AnimatePresence>
        {showAddModal && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col justify-end">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white border-t border-zinc-200 rounded-t-[32px] p-8 space-y-6 max-h-[85%] overflow-y-auto shadow-2xl"
            >
              {/* Modal header */}
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 rounded-lg bg-[#FFCC00]/20 text-[#B38F00] flex items-center justify-center border border-[#FFCC00]/30">
                    <Plus size={14} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-zinc-800">添加新日程</h3>
                    <p className="text-[9px] font-sans text-zinc-400 uppercase mt-2">Create New Event</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center transition-all border border-zinc-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Add form */}
              <form onSubmit={handleAddEvent} className="space-y-4">
                
                {/* Title */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 block uppercase font-sans">日程标题</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full h-10 px-4 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:border-[#FFCC00] focus:bg-white transition-all"
                  />
                </div>

                {/* Date display & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 block uppercase font-sans">执行日期</label>
                    <div className="w-full h-10 px-4 bg-zinc-100 border border-zinc-200 rounded-lg text-xs text-zinc-550 flex items-center font-sans">
                      {selectedDateStr}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 block uppercase font-sans">具体时间</label>
                    <input
                      type="time"
                      required
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      className="w-full h-10 px-4 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:border-[#FFCC00] focus:bg-white transition-all font-sans"
                    />
                  </div>
                </div>

                {/* Category selectors */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 block uppercase font-sans mb-2">事件类型</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(CATEGORY_COLORS) as Array<'work' | 'birthday' | 'life' | 'anniversary'>).map((cat) => {
                      const active = newCategory === cat;
                      const config = CATEGORY_COLORS[cat];
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setNewCategory(cat)}
                          className={`p-4 rounded-lg border flex items-center justify-between transition-all text-xs font-semibold cursor-pointer ${
                            active 
                              ? `${config.bg} ${config.border} ${config.text} scale-[1.02] ring-2 ring-[#FFCC00]/30` 
                              : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          <span>{config.label}</span>
                          <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 block uppercase font-sans">执行地点 (选填)</label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full h-10 px-4 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-800 focus:outline-none focus:border-[#FFCC00] focus:bg-white transition-all"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 block uppercase font-sans">详细说明 (选填)</label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="记录具体的日程安排详情..."
                    className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#FFCC00] focus:bg-white transition-all resize-none font-sans"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-4 flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 h-10 rounded-lg bg-zinc-100 text-zinc-700 font-bold hover:bg-zinc-200 active:scale-95 transition-all border border-zinc-200 cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-10 rounded-lg bg-[#FFCC00] hover:bg-[#E6B800] active:scale-95 text-zinc-900 font-bold shadow-md shadow-[#FFCC00]/20 transition-all border border-[#E6B800]/40 cursor-pointer"
                  >
                    创建日程
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteEventId && (
          <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200"
            >
              <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除日程</h3>
              <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要删除这条日程吗？删除后不可恢复。</p>
              <div className="flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteEventId(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEvents(prev => prev.filter(e => e.id !== deleteEventId));
                    setDeleteEventId(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
