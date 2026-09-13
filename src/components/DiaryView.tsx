/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, 
  Home,
  BookHeart, 
  PenTool, 
  Trash2, 
  Sparkles, 
  User, 
  Loader2, 
  Plus, 
  X, 
  CalendarDays,
  Notebook,
  Compass,
  ArrowRight,
  Palette,
  Check,
  RotateCcw,
  Pipette
} from 'lucide-react';
import { dbInstance } from '../lib/db';
import { ChatSession, DiaryEntry, ChatMessage } from '../lib/types';
import { generateCharacterDiary, generateCharacterDiaryReply, getSystemMemoryPrompt } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

export interface DiaryTheme {
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

export const DIARY_THEME_PRESETS: DiaryTheme[] = [
  {
    id: 'default_rose',
    name: '玫瑰粉',
    description: '日记本默认温柔浪漫的玫瑰粉',
    primary: '#FA4A75',
    primaryHover: '#E03660',
    primaryText: '#FFFFFF',
    headerBg: '#FFFFFF',
    headerBorder: '#FEE2E8',
    headerText: '#18181B',
    mainBg: '#FFF9FA',
    cardBg: '#FFFFFF',
    cardBorder: '#FDE8ED',
    accentText: '#FA4A75',
    accentLight: 'rgba(250, 74, 117, 0.12)'
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
    id: 'aurora_indigo',
    name: '极光青蓝',
    description: '科技感与现代活力的极光青蓝',
    primary: '#4F46E5',
    primaryHover: '#4338CA',
    primaryText: '#FFFFFF',
    headerBg: '#FFFFFF',
    headerBorder: '#F3F4F6',
    headerText: '#18181B',
    mainBg: '#F9FCFF',
    cardBg: '#FFFFFF',
    cardBorder: '#F3F4F6',
    accentText: '#4F46E5',
    accentLight: 'rgba(79, 70, 229, 0.12)'
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

function generateDiaryThemeFromHex(hex: string): DiaryTheme {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 250;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 74;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 117;

  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  const primaryText = lum > 0.65 ? '#18181B' : '#FFFFFF';

  const hr = Math.round(r + (255 - r) * 0.45);
  const hg = Math.round(g + (255 - g) * 0.45);
  const hb = Math.round(b + (255 - b) * 0.45);
  const headerBg = `rgb(${hr}, ${hg}, ${hb})`;

  const hbr = Math.round(r + (255 - r) * 0.3);
  const hbg = Math.round(g + (255 - g) * 0.3);
  const hbb = Math.round(b + (255 - b) * 0.3);
  const headerBorder = `rgb(${hbr}, ${hbg}, ${hbb})`;

  const mbr = Math.round(r + (255 - r) * 0.96);
  const mbg = Math.round(g + (255 - g) * 0.96);
  const mbb = Math.round(b + (255 - b) * 0.96);
  const mainBg = `rgb(${mbr}, ${mbg}, ${mbb})`;

  const cbr = Math.round(r + (255 - r) * 0.98);
  const cbg = Math.round(g + (255 - g) * 0.98);
  const cbb = Math.round(b + (255 - b) * 0.98);
  const cardBg = `rgb(${cbr}, ${cbg}, ${cbb})`;

  const cbor_r = Math.round(r + (255 - r) * 0.86);
  const cbor_g = Math.round(g + (255 - g) * 0.86);
  const cbor_b = Math.round(b + (255 - b) * 0.86);
  const cardBorder = `rgb(${cbor_r}, ${cbor_g}, ${cbor_b})`;

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

// Helper to format character display name
const formatDisplayName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*[\(\（].*?[\)\）]/g, '').trim();
};

// Deduplicate user diaries by content
const getUniqueDiaries = (allDiaries: DiaryEntry[]) => {
  const seen = new Set<string>();
  const unique: DiaryEntry[] = [];
  for (const entry of allDiaries) {
    const key = entry.content.trim();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(entry);
    }
  }
  return unique;
};

export default function DiaryView({ onHome }: { onHome?: () => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<ChatSession | null>(null);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  
  // Drawer states
  const [selectedDiaryForReply, setSelectedDiaryForReply] = useState<DiaryEntry | null>(null);
  const [activeReplyCharacterId, setActiveReplyCharacterId] = useState<string>('');
  
  // Delete confirmation dialog state
  const [diaryToDelete, setDiaryToDelete] = useState<DiaryEntry | null>(null);

  // Top toast notification state
  const [toast, setToast] = useState<{ id: string; message: string; type?: 'info' | 'success' } | null>(null);

  // UI and State control
  const [isLoading, setIsLoading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Form inputs
  const [titleInput, setTitleInput] = useState('');
  const [contentInput, setContentInput] = useState('');

  // Sharing states
  const [shareTarget, setShareTarget] = useState<'all' | 'specific' | 'private'>('all');
  const [selectedShareCharId, setSelectedShareCharId] = useState<string>('');

  // Theme Settings
  const [currentTheme, setCurrentTheme] = useState<DiaryTheme>(() => {
    const saved = localStorage.getItem('diary_app_theme');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.primary) return parsed;
      } catch (e) {
        console.error('Failed to parse diary theme', e);
      }
    }
    return DIARY_THEME_PRESETS[0]; // default_rose
  });

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [customHexInput, setCustomHexInput] = useState('#FA4A75');

  const handleSelectPresetTheme = (theme: DiaryTheme) => {
    setCurrentTheme(theme);
    localStorage.setItem('diary_app_theme', JSON.stringify(theme));
  };

  const handleApplyCustomColor = (hex: string) => {
    const theme = generateDiaryThemeFromHex(hex);
    setCurrentTheme(theme);
    localStorage.setItem('diary_app_theme', JSON.stringify(theme));
  };

  const headerButtonBg = useMemo(
    () => adjustHsbColor(currentTheme.headerBg, 0, -6, 3),
    [currentTheme.headerBg]
  );

  // Ref to always track the latest selectedCharacter in background callbacks safely
  const selectedCharacterRef = useRef<ChatSession | null>(null);
  useEffect(() => {
    selectedCharacterRef.current = selectedCharacter;
  }, [selectedCharacter]);

  // Auto clear toast after delay
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  // Load active character sessions on mount
  const [allDiariesForCount, setAllDiariesForCount] = useState<DiaryEntry[]>([]);

  const loadAllDiariesForCount = async () => {
    try {
      const list = await dbInstance.getAllDiaries();
      setAllDiariesForCount(list || []);
    } catch (err) {
      console.error('Failed to load all diaries for count:', err);
    }
  };

  useEffect(() => {
    async function loadCharacters() {
      try {
        const allSessions = await dbInstance.getAllSessions();
        // Filter out group chats, hidden and deleted contacts
        const activeContacts = allSessions.filter(
          (s) => s.isGroup !== true && s.isChatHidden !== true && s.isContactDeleted !== true
        );
        setSessions(activeContacts);
        if (activeContacts.length > 0) {
          setSelectedShareCharId(activeContacts[0].id);
        }
      } catch (err) {
        console.error('Failed to load character list:', err);
      }
    }
    loadCharacters();
    loadAllDiariesForCount();
  }, []);

  // Helper to open the write form with appropriate preselection
  const handleOpenWriteForm = () => {
    if (selectedCharacter) {
      if (selectedCharacter.id === 'private') {
        setShareTarget('private');
      } else {
        setShareTarget('specific');
        setSelectedShareCharId(selectedCharacter.id);
      }
    } else {
      setShareTarget('all');
      if (sessions.length > 0) {
        setSelectedShareCharId(sessions[0].id);
      }
    }
    setIsWriting(true);
  };

  // Load diaries when selected character changes
  useEffect(() => {
    if (selectedCharacter) {
      loadDiaries(selectedCharacter.id);
    } else {
      setDiaries([]);
      loadAllDiariesForCount();
    }
  }, [selectedCharacter]);

  const loadDiaries = async (characterId: string) => {
    try {
      let list;
      if (characterId === 'private') {
        list = await dbInstance.getAllDiaries(); // empty/undefined gets all diaries!
      } else {
        list = await dbInstance.getAllDiaries(characterId);
      }
      setDiaries(list);
    } catch (err) {
      console.error('Failed to load diaries:', err);
    }
  };

  // User writes a diary and character responds automatically
  const handleSaveUserDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contentInput.trim()) return;

    const diaryTitle = contentInput.trim().split('\n')[0].slice(0, 25) || '随笔';
    const originalContent = contentInput.trim();

    try {
      if (shareTarget === 'private') {
        // Save private diary entry
        const userEntry: DiaryEntry = {
          id: `diary_${Date.now()}`,
          characterId: 'private',
          authorName: '我',
          authorAvatar: 'user',
          authorType: 'user',
          title: diaryTitle,
          content: originalContent,
          timestamp: Date.now()
        };
        await dbInstance.saveDiary(userEntry);
        
        // Return to "My Diary" instantly
        setSelectedCharacter({
          id: 'private',
          characterName: '我的日记',
          characterAvatar: '📓',
          memory: '',
          relationship: '记录点滴与AI回信',
          createdAt: Date.now()
        } as any);
        setIsWriting(false);
        setContentInput('');
        setTitleInput('');
        await loadDiaries('private');
        await loadAllDiariesForCount();
      } 
      else if (shareTarget === 'specific') {
        const targetId = selectedShareCharId || (selectedCharacter ? selectedCharacter.id : '');
        const targetSession = sessions.find(s => s.id === targetId);
        if (!targetSession) {
          throw new Error('未找到指定的目标角色');
        }

        const diaryId = `diary_${Date.now()}`;
        // Create user diary entry without reply initially
        const userEntry: DiaryEntry = {
          id: diaryId,
          characterId: targetSession.id,
          authorName: '我',
          authorAvatar: 'user',
          authorType: 'user',
          title: diaryTitle,
          content: originalContent,
          timestamp: Date.now()
        };
        await dbInstance.saveDiary(userEntry);

        // Return to "My Diary" instantly
        setSelectedCharacter({
          id: 'private',
          characterName: '我的日记',
          characterAvatar: '📓',
          memory: '',
          relationship: '记录点滴与AI回信',
          createdAt: Date.now()
        } as any);
        setIsWriting(false);
        setContentInput('');
        setTitleInput('');
        await loadDiaries('private');
        await loadAllDiariesForCount();

        // Generate AI reply in background
        (async () => {
          try {
            const reply = await generateCharacterDiaryReply(
              targetSession.characterName,
              getSystemMemoryPrompt(targetSession),
              targetSession.relationship || '好朋友',
              diaryTitle,
              originalContent
            );

            const updatedEntry: DiaryEntry = {
              ...userEntry,
              replyTitle: reply.title,
              replyContent: reply.content,
              replyTimestamp: Date.now()
            };
            await dbInstance.saveDiary(updatedEntry);

            // Reload diaries list in whichever view the user currently is
            const activeId = selectedCharacterRef.current ? selectedCharacterRef.current.id : 'private';
            await loadDiaries(activeId);
            await loadAllDiariesForCount();

            // Get total reply count for the character
            const currentDiaries = await dbInstance.getAllDiaries();
            const charDiaries = currentDiaries.filter(d => d.characterId === targetSession.id);
            const replyCount = charDiaries.filter(d => d.replyContent && d.replyContent.trim() !== '').length;

            // Pop top notification toast
            setToast({
              id: `toast_${Date.now()}`,
              message: `收到了${replyCount}封回信`,
              type: 'success'
            });
          } catch (charErr) {
            console.error(`Failed to generate background reply for ${targetSession.characterName}:`, charErr);
          }
        })();
      } 
      else if (shareTarget === 'all') {
        if (sessions.length === 0) {
          throw new Error('没有活跃的角色可供分享');
        }

        const baseTimestamp = Date.now();
        // Save user diary entry for all active characters without replies initially
        for (const targetSession of sessions) {
          const userEntry: DiaryEntry = {
            id: `diary_${baseTimestamp}_${targetSession.id}`,
            characterId: targetSession.id,
            authorName: '我',
            authorAvatar: 'user',
            authorType: 'user',
            title: diaryTitle,
            content: originalContent,
            timestamp: baseTimestamp
          };
          await dbInstance.saveDiary(userEntry);
        }

        // Return to "My Diary" instantly
        setSelectedCharacter({
          id: 'private',
          characterName: '我的日记',
          characterAvatar: '📓',
          memory: '',
          relationship: '记录点滴与AI回信',
          createdAt: Date.now()
        } as any);
        setIsWriting(false);
        setContentInput('');
        setTitleInput('');
        await loadDiaries('private');
        await loadAllDiariesForCount();

        // Generate AI replies in background for each character asynchronously
        (async () => {
          for (const targetSession of sessions) {
            try {
              const reply = await generateCharacterDiaryReply(
                targetSession.characterName,
                getSystemMemoryPrompt(targetSession),
                targetSession.relationship || '好朋友',
                diaryTitle,
                originalContent
              );

              const updatedEntry: DiaryEntry = {
                id: `diary_${baseTimestamp}_${targetSession.id}`,
                characterId: targetSession.id,
                authorName: '我',
                authorAvatar: 'user',
                authorType: 'user',
                title: diaryTitle,
                content: originalContent,
                timestamp: baseTimestamp,
                replyTitle: reply.title,
                replyContent: reply.content,
                replyTimestamp: Date.now()
              };
              await dbInstance.saveDiary(updatedEntry);

              // Reload diaries list in whichever view the user currently is
              const activeId = selectedCharacterRef.current ? selectedCharacterRef.current.id : 'private';
              await loadDiaries(activeId);
              await loadAllDiariesForCount();

              // Get total reply count for the character
              const currentDiaries = await dbInstance.getAllDiaries();
              const charDiaries = currentDiaries.filter(d => d.characterId === targetSession.id);
              const replyCount = charDiaries.filter(d => d.replyContent && d.replyContent.trim() !== '').length;

              // Pop top notification toast for each character as they reply
              setToast({
                id: `toast_${Date.now()}_${targetSession.id}`,
                message: `收到了${replyCount}封回信`,
                type: 'success'
              });
            } catch (charErr) {
              console.error(`Failed to generate background reply for ${targetSession.characterName}:`, charErr);
            }
          }
        })();
      }
    } catch (err: any) {
      console.error('Failed to save diary:', err);
      alert(err.message || '日记保存出现了一些小意外，请重试。');
    }
  };

  // Request the character to write an independent daily diary based on memory
  const handleTriggerCharacterDiary = async () => {
    if (!selectedCharacter) return;

    setIsLoading(true);
    setStatusMessage(`${formatDisplayName(selectedCharacter.characterName)} 正在写日记`);

    try {
      // 1. Fetch recent chat history messages to let character recall details
      const chatHistory = await dbInstance.getMessages(selectedCharacter.id);
      
      // 2. Call API to generate character's independent diary
      const aiDiary = await generateCharacterDiary(
        selectedCharacter.characterName,
        getSystemMemoryPrompt(selectedCharacter),
        selectedCharacter.relationship || '好朋友',
        chatHistory
      );

      // 3. Build AI diary entry
      const aiEntry: DiaryEntry = {
        id: `diary_${Date.now()}`,
        characterId: selectedCharacter.id,
        authorName: selectedCharacter.characterName,
        authorAvatar: selectedCharacter.characterAvatar,
        authorType: 'character',
        title: aiDiary.title,
        content: aiDiary.content,
        timestamp: Date.now()
      };

      // 4. Save to database
      await dbInstance.saveDiary(aiEntry);

      // 5. Refresh
      await loadDiaries(selectedCharacter.id);
      await loadAllDiariesForCount();
    } catch (err) {
      console.error('Failed to trigger character diary:', err);
      alert('生成日记遇到了一点障碍，请在设置中查看 API Key 配置是否正常。');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  // Click delete button to show confirmation dialog
  const handleDeleteDiary = (entry: DiaryEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setDiaryToDelete(entry);
  };

  // Confirm delete handler
  const handleConfirmDeleteDiary = async () => {
    if (!diaryToDelete) return;
    try {
      if (selectedCharacter && selectedCharacter.id === 'private') {
        // Find all diaries that share this content and delete them
        const toDelete = diaries.filter(d => d.content.trim() === diaryToDelete.content.trim());
        for (const item of toDelete) {
          await dbInstance.deleteDiary(item.id);
        }
      } else {
        await dbInstance.deleteDiary(diaryToDelete.id);
      }
      
      if (selectedCharacter) {
        await loadDiaries(selectedCharacter.id);
      }
      await loadAllDiariesForCount();
    } catch (err) {
      console.error('Failed to delete diary:', err);
    } finally {
      setDiaryToDelete(null);
    }
  };

  // Format date helper
  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Helper to open drawer and set preselected reply character
  const handleOpenDrawer = (entry: DiaryEntry) => {
    setSelectedDiaryForReply(entry);
    if (entry.characterId && entry.characterId !== 'private') {
      setActiveReplyCharacterId(entry.characterId);
    } else if (sessions.length > 0) {
      setActiveReplyCharacterId(sessions[0].id);
    }
  };

  // Find a specific character's reply entry for a given diary
  const findReplyEntry = (diary: DiaryEntry, targetCharId: string) => {
    if (diary.characterId === targetCharId) {
      return diary;
    }
    return diaries.find(
      (d) => d.content.trim() === diary.content.trim() && d.characterId === targetCharId
    );
  };

  return (
    <div 
      className="flex-1 flex flex-col h-full select-none overflow-hidden relative font-sans transition-colors duration-200"
      style={{ backgroundColor: currentTheme.mainBg }}
    >
      
      {/* TOP TOAST NOTIFICATION */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className="bg-white border border-slate-200/80 rounded-xl shadow-xl p-3.5 flex items-center justify-between gap-3 bg-white/95 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 animate-pulse"
                  style={{
                    backgroundColor: currentTheme.accentLight,
                    borderColor: currentTheme.primary,
                    color: currentTheme.primary
                  }}
                >
                  <Sparkles size={16} />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800 leading-none">
                    新回信提醒
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium leading-normal mt-1">
                    {toast.message}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 1. TOP MAIN HEADER - strictly h-16 (64px) with px-4 (16px) */}
      <div 
        className="h-16 border-b px-4 flex items-center justify-between shadow-2xs shrink-0 z-10 transition-colors duration-200"
        style={{
          backgroundColor: currentTheme.headerBg,
          borderBottomColor: currentTheme.headerBorder,
          color: currentTheme.headerText
        }}
      >
        <div className="flex items-center gap-3">
          {selectedCharacter ? (
            <button
              type="button"
              onClick={() => setSelectedCharacter(null)}
              className="w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs hover:opacity-90"
              style={{
                backgroundColor: headerButtonBg,
                borderColor: currentTheme.headerBorder,
                color: currentTheme.headerText
              }}
              title="返回角色列表"
            >
              <ArrowLeft size={16} className="stroke-[2.5]" />
            </button>
          ) : (
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
          <div className="flex flex-col">
            <h2 className="text-base font-black tracking-tight leading-none" style={{ color: currentTheme.headerText }}>
              {selectedCharacter 
                ? (selectedCharacter.id === 'private' ? '我的日记' : `${formatDisplayName(selectedCharacter.characterName)} 的日记`) 
                : '日记本'}
            </h2>
            <span className="text-[9px] font-semibold tracking-wider uppercase mt-1 leading-none" style={{ color: currentTheme.accentText }}>
              {selectedCharacter ? (selectedCharacter.id === 'private' ? 'MY DIARY' : 'DIARY RECORDBOOK') : 'SELECT CHARACTER'}
            </span>
          </div>
        </div>

        {/* Right buttons group: Theme Palette button + Action buttons, all 8-multiple aligned */}
        <div className="flex items-center gap-2">
          {/* Theme Palette Button */}
          <button
            type="button"
            onClick={() => setShowThemeModal(true)}
            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs hover:opacity-90"
            style={{
              backgroundColor: headerButtonBg,
              borderColor: currentTheme.headerBorder,
              color: currentTheme.headerText
            }}
            title="切换日记本主题"
          >
            <Palette size={16} className="stroke-[2.5]" />
          </button>

          {!selectedCharacter && !isWriting && (
            <button
              type="button"
              onClick={handleOpenWriteForm}
              disabled={isLoading}
              className="w-8 h-8 rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center border shrink-0"
              style={{ 
                backgroundColor: currentTheme.primary,
                borderColor: currentTheme.primaryHover,
                color: currentTheme.primaryText
              }}
              title="写日记"
            >
              <PenTool size={14} className="stroke-[2.5]" />
            </button>
          )}
          {selectedCharacter && !isWriting && (
            <>
              {selectedCharacter.id !== 'private' && (
                <button
                  type="button"
                  onClick={handleTriggerCharacterDiary}
                  disabled={isLoading}
                  className="h-8 px-3 rounded-lg text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 border"
                  style={{ 
                    backgroundColor: currentTheme.primary,
                    borderColor: currentTheme.primaryHover,
                    color: currentTheme.primaryText
                  }}
                  title="让角色根据今天的记忆生成一篇日记"
                >
                  <span>查看日记</span>
                </button>
              )}
              {selectedCharacter.id === 'private' && (
                <button
                  type="button"
                  onClick={handleOpenWriteForm}
                  disabled={isLoading}
                  className="h-8 px-3 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 border"
                  style={{ 
                    backgroundColor: currentTheme.primary,
                    borderColor: currentTheme.primaryHover,
                    color: currentTheme.primaryText
                  }}
                >
                  <PenTool size={12} className="stroke-[2.5]" />
                  <span>写日记</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2. LOADING STATE OVERLAY */}
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-8 text-center"
          >
            <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-center shadow-md mb-6 animate-bounce">
              <Notebook size={28} className="text-amber-800" />
            </div>
            <Loader2 className="animate-spin text-slate-700 mb-4" size={28} />
            <p className="text-sm font-semibold text-slate-800 tracking-tight leading-relaxed max-w-xs">
              {statusMessage || '正在处理日记中，请稍候...'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. CORE VIEWS PORT */}
      <div className="flex-1 overflow-y-auto relative p-6">
        
        {/* VIEW A: CHARACTER SELECTION SCREEN */}
        {!selectedCharacter && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="space-y-3">
              {/* Virtual My Diaries item (Pinned to top) */}
              <button
                onClick={() => setSelectedCharacter({
                  id: 'private',
                  characterName: '我的日记',
                  characterAvatar: '📓',
                  memory: '',
                  relationship: '记录点滴与AI回信',
                  createdAt: Date.now()
                } as any)}
                className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center justify-between gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer group active:translate-y-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shadow-inner border border-slate-200 shrink-0 overflow-hidden">
                    <span className="text-xl">📓</span>
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-800 transition-colors">
                      我的日记
                    </h3>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      <span className="text-[9px] text-slate-400">
                        查看全部日记及回信
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </button>

              {sessions.map((char) => {
                const cleanName = formatDisplayName(char.characterName);
                const charDiaries = allDiariesForCount.filter(d => d.characterId === char.id);
                const diaryCount = charDiaries.length;
                const replyCount = charDiaries.filter(d => d.replyContent && d.replyContent.trim() !== '').length;

                return (
                  <button
                    key={char.id}
                    onClick={() => setSelectedCharacter(char)}
                    className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl p-3 shadow-sm flex items-center justify-between gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer group active:translate-y-0"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar container */}
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shadow-inner border border-slate-200 shrink-0 overflow-hidden">
                        {char.characterAvatar && (char.characterAvatar.startsWith('data:') || char.characterAvatar.startsWith('http')) ? (
                          <img src={char.characterAvatar} alt={cleanName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl">{char.characterAvatar || '🔮'}</span>
                        )}
                      </div>
                      {/* Details */}
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-amber-800 transition-colors">
                          {cleanName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                          <span className="text-[9px] text-slate-400">
                            共 {diaryCount} 篇记录；收到了 {replyCount} 封回信
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-slate-400 group-hover:text-amber-800 transition-colors" />
                  </button>
                );
              })}
            </div>

            {sessions.length === 0 && (
              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 text-center text-slate-400 space-y-1 shadow-sm">
                <p className="text-xs font-semibold text-amber-900/90">暂无活跃的 AI 联系人</p>
                <p className="text-[10px] text-amber-800/70 leading-relaxed">
                  你可以前去“聊天室”创建与角色的对话激活他们。现在你可以先记录我的日记哦！
                </p>
              </div>
            )}
          </div>
        )}

        {/* VIEW B: PERSONAL DIARY WORKING SPACE (TIMELINE) */}
        {selectedCharacter && !isWriting && (
          <div className="max-w-2xl mx-auto space-y-6">
            
            {/* Diaries List timeline */}
            {(() => {
              const displayedDiaries = selectedCharacter.id === 'private'
                ? getUniqueDiaries(diaries.filter((d) => d.authorType === 'user'))
                : diaries;
              return displayedDiaries.length > 0 ? (
                <div className="relative border-l-2 border-slate-200/80 pl-5 space-y-6 ml-2.5">
                  {displayedDiaries.map((entry) => {
                    const isUser = entry.authorType === 'user';
                    const cleanCharName = formatDisplayName(selectedCharacter.characterName);
                    
                    // In "我的日记", check if the diary was private.
                    // A diary is private if all its corresponding entries in `diaries` have `characterId === 'private'`
                    // or if there are no other entries with characterId !== 'private'.
                    const associatedEntries = diaries.filter(
                      (d) => d.content.trim() === entry.content.trim()
                    );
                    const isPrivate = !associatedEntries.some(
                      (d) => d.characterId && d.characterId !== 'private'
                    );

                    return (
                      <div key={entry.id} className="relative group">
                        
                        {/* Bullet on timeline */}
                        <div className={`absolute -left-[27px] top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-white flex items-center justify-center transition-transform group-hover:scale-110 ${
                          isUser ? 'border-indigo-500' : 'border-amber-500'
                        }`} />

                        {/* Diary card wrapper */}
                        <div className="space-y-3">
                          
                          {/* Header metadata */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                                isUser 
                                  ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' 
                                  : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {isUser ? '我的日记' : `${cleanCharName} 的日记`}
                              </span>
                              <span className="text-[9px] text-slate-400 font-semibold font-mono">
                                {formatDate(entry.timestamp)}
                              </span>
                            </div>
                            
                            {/* Delete action */}
                            <button
                              onClick={(e) => handleDeleteDiary(entry, e)}
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                              title="删除此日记"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>

                          {/* Core Content Card */}
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm transition-all hover:shadow-md space-y-3">
                            <div className="space-y-2">
                              {entry.title && (
                                <h3 className="text-sm font-bold text-slate-900 leading-snug">
                                  {entry.title}
                                </h3>
                              )}
                              <p className="text-xs text-slate-600/95 leading-relaxed whitespace-pre-wrap font-sans font-normal">
                                {entry.content}
                              </p>
                            </div>

                            {/* View Reply button (Only in "我的日记" view, and only if it's not private) */}
                            {selectedCharacter.id === 'private' && !isPrivate && (
                              <div className="pt-2 border-t border-slate-100 flex justify-end">
                                <button
                                  onClick={() => handleOpenDrawer(entry)}
                                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                >
                                  <Sparkles size={11} className="text-indigo-600 animate-pulse" />
                                  <span>查看回信</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Associated AI Reply / Linked Diary Card (If any - ONLY in character-specific 1-on-1 view) */}
                          {selectedCharacter.id !== 'private' && isUser && entry.replyContent && (
                            <div className="relative pl-5">
                              {/* Connector line for associated reply */}
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-200" />
                              
                              <div className="space-y-1.5 mt-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                    {cleanCharName} 的回信/关联日记
                                  </span>
                                  <span className="text-[9px] text-slate-400 font-semibold font-mono">
                                    {formatDate(entry.replyTimestamp || entry.timestamp)}
                                  </span>
                                </div>
                                <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-4 shadow-inner space-y-2">
                                  <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1">
                                    <Sparkles size={12} className="text-amber-700" />
                                    <span>{entry.replyTitle}</span>
                                  </h4>
                                  <p className="text-xs text-amber-900/90 leading-relaxed whitespace-pre-wrap font-sans font-normal">
                                    {entry.replyContent}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 max-w-md mx-auto space-y-3">
                  <div className="w-12 h-12 bg-slate-100/60 rounded-full flex items-center justify-center mx-auto text-slate-400">
                    <Notebook size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-800">这里还是一片空白</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* VIEW C: WRITE DIARY FORM */}
        {isWriting && (
          <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <PenTool className="text-indigo-500" size={16} />
                <h2 className="text-sm font-bold text-slate-900">写日记</h2>
              </div>
              <button
                onClick={() => setIsWriting(false)}
                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveUserDiary} className="space-y-4">
              {/* SHARING TARGET SELECTION */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">分享范围</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShareTarget('all')}
                    className={`flex-1 py-1.5 rounded-lg border text-center text-xs font-semibold transition-all cursor-pointer ${
                      shareTarget === 'all'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    所有人
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShareTarget('specific');
                      if (sessions.length > 0 && !selectedShareCharId) {
                        setSelectedShareCharId(sessions[0].id);
                      }
                    }}
                    className={`flex-1 py-1.5 rounded-lg border text-center text-xs font-semibold transition-all cursor-pointer ${
                      shareTarget === 'specific'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    特定谁
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareTarget('private')}
                    className={`flex-1 py-1.5 rounded-lg border text-center text-xs font-semibold transition-all cursor-pointer ${
                      shareTarget === 'private'
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    私密
                  </button>
                </div>
              </div>

              {/* SPECIFIC CHARACTER SELECTOR */}
              {shareTarget === 'specific' && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">选择接收角色</label>
                  <select
                    value={selectedShareCharId}
                    onChange={(e) => setSelectedShareCharId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800 font-medium"
                  >
                    {sessions.map((char) => (
                      <option key={char.id} value={char.id}>
                        {formatDisplayName(char.characterName)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <textarea
                  required
                  rows={8}
                  placeholder=""
                  value={contentInput}
                  onChange={(e) => setContentInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-900 font-medium leading-relaxed resize-none"
                />
              </div>

              {shareTarget !== 'private' ? (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-[10px] leading-relaxed text-indigo-900/85">
                  <p className="font-bold flex items-center gap-1 mb-0.5 text-indigo-950">
                    <Sparkles size={11} className="text-indigo-600 animate-pulse" />
                    <span>角色回信机制说明</span>
                  </p>
                  你可以选择是否让他们查看你的日记，他们会回信的。
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] leading-relaxed text-slate-500">
                  <p className="font-bold flex items-center gap-1 mb-0.5 text-slate-700">
                    <span>🔒 私密日志</span>
                  </p>
                  仅自己可见
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsWriting(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-all cursor-pointer active:scale-95"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shadow-xs active:scale-95 border"
                  style={{
                    backgroundColor: currentTheme.primary,
                    color: currentTheme.primaryText,
                    borderColor: currentTheme.primaryHover
                  }}
                >
                  保存
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* DRAWER PANEL FOR CHARACTER REPLIES */}
      <AnimatePresence>
        {selectedDiaryForReply && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDiaryForReply(null)}
              className="absolute inset-0 bg-slate-900/30 z-40 cursor-pointer"
            />
            
            {/* Slide-in drawer container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="absolute right-0 top-0 bottom-0 w-[420px] max-w-[95%] bg-white border-l border-slate-200/80 shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer Title Bar */}
              <div className="h-14 border-b border-slate-200/80 px-4 flex items-center justify-between bg-slate-50 shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500 animate-pulse shrink-0" />
                  <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                    角色回信面板
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDiaryForReply(null)}
                  className="p-1.5 hover:bg-slate-200/60 rounded-md text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Horizontal Character Switcher Bar */}
              {sessions.length > 0 && (
                <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex gap-2 overflow-x-auto scrollbar-none shrink-0 items-center">
                  {sessions.map((char) => {
                    const isSelected = activeReplyCharacterId === char.id;
                    const cleanName = formatDisplayName(char.characterName);
                    return (
                      <button
                        key={char.id}
                        onClick={() => setActiveReplyCharacterId(char.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center border border-slate-200 overflow-hidden shrink-0">
                          {char.characterAvatar && (char.characterAvatar.startsWith('data:') || char.characterAvatar.startsWith('http')) ? (
                            <img src={char.characterAvatar} alt={cleanName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs">{char.characterAvatar || '🔮'}</span>
                          )}
                        </div>
                        <span>{cleanName}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Drawer Content Area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* User's Original Diary Snippet */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 space-y-1">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                    我的日记回顾
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans font-normal whitespace-pre-wrap">
                    {selectedDiaryForReply.content}
                  </p>
                </div>

                {/* Character Reply Section */}
                {(() => {
                  const replyEntry = findReplyEntry(selectedDiaryForReply, activeReplyCharacterId);
                  const activeChar = sessions.find((s) => s.id === activeReplyCharacterId);
                  const cleanCharName = activeChar ? formatDisplayName(activeChar.characterName) : '';

                  if (replyEntry && replyEntry.replyContent) {
                    return (
                      <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                            {cleanCharName} 的回信
                          </span>
                          <span className="text-[9px] text-slate-400 font-semibold font-mono">
                            {formatDate(replyEntry.replyTimestamp || replyEntry.timestamp)}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1">
                          <Sparkles size={12} className="text-amber-700" />
                          <span>{replyEntry.replyTitle || '隔空精神共鸣'}</span>
                        </h4>
                        <p className="text-xs text-amber-900/90 leading-relaxed whitespace-pre-wrap font-sans font-normal">
                          {replyEntry.replyContent}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="h-48 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                      <Sparkles size={20} className="text-slate-300" />
                      <p className="text-xs font-semibold text-slate-600">该角色未参与此篇日记</p>
                      <p className="text-[10px] text-slate-400/80 leading-relaxed max-w-xs">
                        此篇日记写入时没有分享给该角色，或回信尚未生成。
                      </p>
                    </div>
                  );
                })()}
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* CUSTOM DIARY DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {diaryToDelete && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setDiaryToDelete(null)}
              className="absolute inset-0 bg-slate-900/40 cursor-pointer"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="relative bg-white w-full max-w-sm rounded-xl border border-slate-200/80 shadow-2xl p-5 space-y-4 z-10"
            >
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                  <Trash2 size={18} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xs font-bold text-slate-900">确认删除日记</h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    确定要删除这篇日记吗？此操作将永久移除，不可撤销。
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setDiaryToDelete(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmDeleteDiary}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer active:scale-95"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. FOOTER CREDITS */}
      <div 
        className="h-10 border-t px-4 flex items-center justify-center text-[10px] font-mono shrink-0 transition-colors"
        style={{
          backgroundColor: currentTheme.cardBg,
          borderColor: currentTheme.cardBorder,
          color: currentTheme.accentText
        }}
      >
        JOURNAL SYSTEM ENGINE v2.0
      </div>

      {/* --- PANEL MODAL: DIARY THEME PICKER MODAL --- */}
      <AnimatePresence>
        {showThemeModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowThemeModal(false)}
              className="absolute inset-0 bg-black z-45"
            />

            <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col justify-end max-h-[85%]">
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                className="bg-white border-t border-zinc-200 rounded-t-[32px] p-6 space-y-5 max-h-[85vh] overflow-y-auto shadow-2xl"
              >
                {/* Modal Header */}
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
                      <h3 className="text-sm font-black text-zinc-900 leading-none">日记本主题配色</h3>
                      <p className="text-[10px] font-sans text-zinc-400 uppercase mt-1">JOURNAL THEME PALETTE</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleSelectPresetTheme(DIARY_THEME_PRESETS[0])}
                      className="h-8 px-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
                      title="恢复默认玫瑰粉"
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

                {/* Theme Presets */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 block uppercase font-sans tracking-wider">预设主题风格</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {DIARY_THEME_PRESETS.map((preset) => {
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

                {/* Custom Color Picker */}
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
                      {/* Color picker circle */}
                      <div 
                        className="relative w-10 h-10 rounded-lg overflow-hidden border border-zinc-300 shadow-2xs shrink-0 cursor-pointer"
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
                          className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-lg text-xs font-mono font-bold text-zinc-800 focus:outline-none focus:border-zinc-400"
                        />
                      </div>

                      {/* Apply button */}
                      <button
                        type="button"
                        onClick={() => handleApplyCustomColor(customHexInput)}
                        className="h-10 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold active:scale-95 transition-all cursor-pointer shadow-xs shrink-0"
                      >
                        应用
                      </button>
                    </div>

                    {/* Quick Swatches */}
                    <div className="flex items-center space-x-2 pt-1 overflow-x-auto pb-1 [scrollbar-width:none]">
                      {['#FA4A75', '#4A7297', '#788A66', '#D97706', '#E17899', '#8E7CC3', '#4F46E5', '#D97736', '#475569', '#009688', '#0EA5E9', '#84CC16'].map((colorHex) => (
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

                {/* Confirm Button */}
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
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
