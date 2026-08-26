import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  MessageSquare,
  FileText,
  Upload,
  Send,
  Loader2,
  Trash2,
  Menu,
  ChevronLeft,
  X,
  Sparkles,
  HelpCircle,
  FileCode,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Brain,
  Download,
  FileDown,
  MoreVertical,
  FolderUp
} from 'lucide-react';
import mammoth from 'mammoth';
import { dbInstance } from '../lib/db';
import { getEffectiveModel, formatGmAdventureMemoryPrompt, extractGmAdventureMemory, callOpenAIEndpoint, getFallbackApiKey, withTimeout } from '../lib/api';
import { GmAdventureMemory } from '../lib/types';
import { GoogleGenAI } from '@google/genai';
import GmMemoryModal from './GmMemoryModal';

// Types for AI Text Adventure
interface AdventureSession {
  id: string;
  title: string;
  outline: string;
  createdAt: number;
  updatedAt: number;
  fileName?: string;
  fileType?: 'docx' | 'html' | 'text' | 'manual';
}

interface AdventureMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

const getUserAvatar = (): string => {
  try {
    const saved = localStorage.getItem('wechat_user_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.avatar && parsed.avatar.trim()) {
        return parsed.avatar.trim();
      }
    }
  } catch (e) {}
  return '🤖';
};

const DEFAULT_GM_MEMORY: GmAdventureMemory = {
  worldRules: [],
  characterStates: [],
  activeQuests: [],
  majorChronicles: [],
  lastUpdatedRound: 0
};

export default function AiAdventureGame({
  onBackToLobby
}: {
  onBackToLobby: () => void;
}) {
  // UI States
  const [sessions, setSessions] = useState<AdventureSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdventureMessage[]>([]);
  
  // Creation States
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newOutline, setNewOutline] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<'docx' | 'html' | 'text' | 'manual'>('manual');

  // Input & Generation States
  const [inputText, setInputText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  
  // Sidebar State (For responsive mobile layout - default false as requested)
  const [showSidebar, setShowSidebar] = useState<boolean>(false);

  // User & AI message bubble menu & editing states
  const [activeUserMenuId, setActiveUserMenuId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Long press refs for message bubbles
  const bubbleLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isBubbleLongPressRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      if (bubbleLongPressTimerRef.current) {
        clearTimeout(bubbleLongPressTimerRef.current);
      }
    };
  }, []);

  const handleBubbleTouchStart = (msgId: string) => {
    isBubbleLongPressRef.current = false;
    if (bubbleLongPressTimerRef.current) clearTimeout(bubbleLongPressTimerRef.current);
    bubbleLongPressTimerRef.current = setTimeout(() => {
      isBubbleLongPressRef.current = true;
      setActiveUserMenuId(msgId);
      try { navigator.vibrate?.(30); } catch (_) {}
    }, 450);
  };

  const handleBubbleTouchEnd = () => {
    if (bubbleLongPressTimerRef.current) {
      clearTimeout(bubbleLongPressTimerRef.current);
      bubbleLongPressTimerRef.current = null;
    }
  };

  const handleBubbleClick = (msgId: string) => {
    if (isBubbleLongPressRef.current) {
      isBubbleLongPressRef.current = false;
      return;
    }
    if (activeUserMenuId === msgId) {
      setActiveUserMenuId(null);
    }
  };

  const handleBubbleContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveUserMenuId(msgId);
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  // Confirmation dialog states to replace window.confirm
  const [sessionToDeleteId, setSessionToDeleteId] = useState<string | null>(null);
  const [messageToDeleteId, setMessageToDeleteId] = useState<string | null>(null);

  // GM Memory System State
  const [gmMemory, setGmMemory] = useState<GmAdventureMemory>(DEFAULT_GM_MEMORY);
  const [showMemoryModal, setShowMemoryModal] = useState<boolean>(false);
  const [isExtractingMemory, setIsExtractingMemory] = useState<boolean>(false);
  const [isAutoExtracting, setIsAutoExtracting] = useState<boolean>(false);

  // File Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importSaveInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Active session menu dropdown state
  const [sessionMenuOpenId, setSessionMenuOpenId] = useState<string | null>(null);

  // 1. Initial Load of Saved Sessions and Messages from LocalStorage
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('ai_text_adventure_sessions');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        setSessions(parsed);
        if (parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
        } else {
          setIsCreating(true);
        }
      } else {
        setIsCreating(true);
      }
    } catch (e) {
      console.error('Failed to parse saved sessions', e);
      setIsCreating(true);
    }
  }, []);

  // 2. Load Messages and GM Memory when Active Session changes
  useEffect(() => {
    if (activeSessionId) {
      try {
        const savedMsgs = localStorage.getItem(`ai_text_adventure_messages_${activeSessionId}`);
        if (savedMsgs) {
          setMessages(JSON.parse(savedMsgs));
        } else {
          setMessages([]);
        }

        const savedMem = localStorage.getItem(`ai_text_adventure_memory_${activeSessionId}`);
        if (savedMem) {
          setGmMemory(JSON.parse(savedMem));
        } else {
          setGmMemory(DEFAULT_GM_MEMORY);
        }
        setIsCreating(false);
      } catch (e) {
        console.error('Failed to load session messages or GM memory', e);
        setMessages([]);
        setGmMemory(DEFAULT_GM_MEMORY);
      }
    } else {
      setMessages([]);
      setGmMemory(DEFAULT_GM_MEMORY);
    }
  }, [activeSessionId]);

  // 3. Scroll to Bottom when messages load or grow
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // 4. Save Session List to LocalStorage Helper
  const saveSessionsToLocal = (updatedList: AdventureSession[]) => {
    setSessions(updatedList);
    localStorage.setItem('ai_text_adventure_sessions', JSON.stringify(updatedList));
  };

  // 5. Save Messages Helper
  const saveMessagesToLocal = (sessionId: string, updatedMsgs: AdventureMessage[]) => {
    setMessages(updatedMsgs);
    localStorage.setItem(`ai_text_adventure_messages_${sessionId}`, JSON.stringify(updatedMsgs));
  };

  // 5.1 Save GM Memory Helper
  const saveMemoryToLocal = (sessionId: string, updatedMem: GmAdventureMemory) => {
    setGmMemory(updatedMem);
    localStorage.setItem(`ai_text_adventure_memory_${sessionId}`, JSON.stringify(updatedMem));
  };

  // 5.2 Manual Extract / Update GM Memory
  const handleManualExtractMemory = async (currentLocalMemory?: GmAdventureMemory): Promise<GmAdventureMemory | null> => {
    if (!activeSessionId || isExtractingMemory || isAutoExtracting || isGenerating) {
      if (isGenerating) {
        showToast('GM 正在生成剧情中，请稍候再提炼！', 'error');
      }
      return null;
    }
    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return null;

    let targetMessages = messages;
    if (targetMessages.length === 0) {
      try {
        const stored = localStorage.getItem(`ai_text_adventure_messages_${activeSessionId}`);
        if (stored) targetMessages = JSON.parse(stored);
      } catch (_) {}
    }

    if (targetMessages.length === 0) {
      showToast('当前暂无对话记录，请先与 GM 推进剧情后再提炼！', 'error');
      return null;
    }

    const baseMemory = currentLocalMemory || gmMemory;

    setIsExtractingMemory(true);
    try {
      const extracted = await extractGmAdventureMemory(currentSession.outline, targetMessages, baseMemory);
      const isIdentical = 
        JSON.stringify(extracted.worldRules) === JSON.stringify(baseMemory.worldRules) &&
        JSON.stringify(extracted.characterStates) === JSON.stringify(baseMemory.characterStates) &&
        JSON.stringify(extracted.activeQuests) === JSON.stringify(baseMemory.activeQuests) &&
        JSON.stringify(extracted.majorChronicles) === JSON.stringify(baseMemory.majorChronicles);
      saveMemoryToLocal(activeSessionId, extracted);
      if (isIdentical) {
        showToast('警告：模型是个复读机，原样返回了旧记忆，请继续推进剧情或重试！', 'error');
      } else {
        showToast('[GM 记忆库已同步最新剧情事实]');
      }
      return extracted;
    } catch (err: any) {
      console.error('Failed to extract GM memory:', err);
      showToast(`提炼失败: ${err.message || '网络连接或API响应异常'}`, 'error');
      return null;
    } finally {
      setIsExtractingMemory(false);
    }
  };

  // 6. Handle File Uploads (DOCX, HTML, TXT)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear input value immediately so re-uploading the exact same file fires onChange reliably
    e.target.value = '';
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setFileName(file.name);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (extension === 'docx') {
        setFileType('docx');
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const result = await mammoth.extractRawText({ arrayBuffer });
            const extractedText = result.value.trim();
            if (!extractedText) {
              throw new Error('未能在文档中提取到有效文本内容。');
            }
            setNewOutline(extractedText);
            // Auto generate title if blank
            if (!newTitle) {
              setNewTitle(file.name.replace(/\.[^/.]+$/, ""));
            }
          } catch (err: any) {
            setUploadError(err.message || '解析DOCX文档失败，请确保文件未损坏。');
          } finally {
            setIsUploading(false);
          }
        };
        reader.onerror = () => {
          setUploadError('读取文件出错。');
          setIsUploading(false);
        };
        reader.readAsArrayBuffer(file);

      } else if (extension === 'html' || extension === 'htm') {
        setFileType('html');
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const htmlContent = event.target?.result as string;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            const extractedText = (tempDiv.textContent || tempDiv.innerText || '').trim();
            if (!extractedText) {
              throw new Error('未能在HTML文件中提取到有效文本内容。');
            }
            setNewOutline(extractedText);
            if (!newTitle) {
              setNewTitle(file.name.replace(/\.[^/.]+$/, ""));
            }
          } catch (err: any) {
            setUploadError(err.message || '解析HTML失败。');
          } finally {
            setIsUploading(false);
          }
        };
        reader.onerror = () => {
          setUploadError('读取HTML文件出错。');
          setIsUploading(false);
        };
        reader.readAsText(file, 'utf-8');

      } else if (extension === 'txt') {
        setFileType('text');
        const reader = new FileReader();
        reader.onload = (event) => {
          const textContent = (event.target?.result as string).trim();
          if (!textContent) {
            setUploadError('TXT文件为空。');
          } else {
            setNewOutline(textContent);
            if (!newTitle) {
              setNewTitle(file.name.replace(/\.[^/.]+$/, ""));
            }
          }
          setIsUploading(false);
        };
        reader.onerror = () => {
          setUploadError('读取TXT文件出错。');
          setIsUploading(false);
        };
        reader.readAsText(file, 'utf-8');

      } else {
        setUploadError('不支持该文件格式。请上传 .docx, .html 或 .txt 文件。');
        setIsUploading(false);
      }
    } catch (err: any) {
      setUploadError(err.message || '上传处理失败');
      setIsUploading(false);
    }
  };

  // 7. Delete Session Click
  const handleDeleteSessionClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDeleteId(id);
  };

  // 7.1 Confirm Delete Session
  const confirmDeleteSession = () => {
    if (!sessionToDeleteId) return;
    const remaining = sessions.filter(s => s.id !== sessionToDeleteId);
    saveSessionsToLocal(remaining);
    localStorage.removeItem(`ai_text_adventure_messages_${sessionToDeleteId}`);
    localStorage.removeItem(`ai_text_adventure_memory_${sessionToDeleteId}`);

    if (activeSessionId === sessionToDeleteId) {
      if (remaining.length > 0) {
        setActiveSessionId(remaining[0].id);
      } else {
        setActiveSessionId(null);
        setIsCreating(true);
      }
    }
    setSessionToDeleteId(null);
  };

  // 7.1 Helper to close creation modal safely (prevent zero-session blank state)
  const handleCloseCreatingModal = () => {
    if (sessions.length > 0) {
      setIsCreating(false);
      setNewTitle('');
      setNewOutline('');
      setFileName('');
      setFileType('manual');
      setUploadError(null);
      setErrorText(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 7.2 Export Single Session Full Save (JSON)
  const handleExportSessionSave = (session: AdventureSession, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSessionMenuOpenId(null);

    try {
      let sessMessages: AdventureMessage[] = [];
      if (session.id === activeSessionId && messages.length > 0) {
        sessMessages = messages;
      } else {
        const storedMsgs = localStorage.getItem(`ai_text_adventure_messages_${session.id}`);
        sessMessages = storedMsgs ? JSON.parse(storedMsgs) : [];
      }

      let sessMemory: GmAdventureMemory = DEFAULT_GM_MEMORY;
      if (session.id === activeSessionId && gmMemory) {
        sessMemory = gmMemory;
      } else {
        const storedMem = localStorage.getItem(`ai_text_adventure_memory_${session.id}`);
        sessMemory = storedMem ? JSON.parse(storedMem) : DEFAULT_GM_MEMORY;
      }

      const savePackage = {
        type: 'AI_TEXT_ADVENTURE_SAVE',
        version: 1,
        exportedAt: Date.now(),
        session: {
          title: session.title,
          outline: session.outline,
          fileName: session.fileName,
          fileType: session.fileType
        },
        messages: sessMessages,
        gmMemory: sessMemory
      };

      const jsonStr = JSON.stringify(savePackage, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = session.title.replace(/[/\\?%*:|"<>]/g, '_') || '文游存档';
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `【文游存档】${safeTitle}_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`存档《${session.title}》已导出为 JSON！`);
    } catch (err: any) {
      console.error('Export save error:', err);
      showToast('导出存档失败：' + (err.message || '未知错误'), 'error');
    }
  };

  // 7.3 Export Single Session Story Transcript (TXT)
  const handleExportSessionStory = (session: AdventureSession, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSessionMenuOpenId(null);

    try {
      let sessMessages: AdventureMessage[] = [];
      if (session.id === activeSessionId && messages.length > 0) {
        sessMessages = messages;
      } else {
        const storedMsgs = localStorage.getItem(`ai_text_adventure_messages_${session.id}`);
        sessMessages = storedMsgs ? JSON.parse(storedMsgs) : [];
      }

      const lines: string[] = [];
      lines.push('======================================================');
      lines.push('【AI 文游故事记录】');
      lines.push(`剧本名称：${session.title}`);
      lines.push(`导出时间：${new Date().toLocaleString()}`);
      lines.push(`对话轮数：${sessMessages.length} 条记录`);
      lines.push('======================================================\n');

      lines.push('【世界观与剧本大纲】');
      lines.push(session.outline.trim() || '（无剧本大纲背景）');
      lines.push('\n======================================================');
      lines.push('【故事正文】');
      lines.push('======================================================\n');

      sessMessages.forEach((m) => {
        const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (m.role === 'assistant') {
          lines.push(`▶【GM 叙事】 (${timeStr})：\n${m.content}\n`);
        } else if (m.role === 'user') {
          lines.push(`◆【玩家决策】 (${timeStr})：\n${m.content}\n`);
        } else {
          lines.push(`※【系统信息】 (${timeStr})：\n${m.content}\n`);
        }
      });

      const fullStoryText = lines.join('\n');
      const blob = new Blob([fullStoryText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = session.title.replace(/[/\\?%*:|"<>]/g, '_') || '文游故事';
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `【故事记录】${safeTitle}_${dateStr}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`故事记录《${session.title}》已导出为 TXT！`);
    } catch (err: any) {
      console.error('Export story error:', err);
      showToast('导出故事记录失败：' + (err.message || '未知错误'), 'error');
    }
  };

  // 7.4 Import Single Session Save (JSON) as a New Independent Session
  const handleImportSaveFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (importSaveInputRef.current) {
      importSaveInputRef.current.value = '';
    }
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        const title = parsed.session?.title || parsed.title;
        const outline = parsed.session?.outline || parsed.outline;

        if (!title && !outline && (!parsed.messages || !Array.isArray(parsed.messages))) {
          showToast('导入失败：该文件不是有效的文游存档格式！', 'error');
          return;
        }

        const newId = `adv_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const importedTitle = title || file.name.replace(/\.json$/i, '').replace(/^【文游存档】/, '') || '导入的文游剧本';
        const importedOutline = outline || '';

        const newSession: AdventureSession = {
          id: newId,
          title: importedTitle,
          outline: importedOutline,
          fileName: parsed.session?.fileName || file.name,
          fileType: parsed.session?.fileType || 'manual',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        const rawMsgs = Array.isArray(parsed.messages) ? parsed.messages : [];
        const newMessages: AdventureMessage[] = rawMsgs.map((m: any, idx: number) => ({
          id: `msg_${newId}_${idx}_${Date.now()}`,
          sessionId: newId,
          role: m.role === 'user' ? 'user' : m.role === 'system' ? 'system' : 'assistant',
          content: String(m.content || ''),
          timestamp: Number(m.timestamp) || Date.now()
        }));

        const rawMem = parsed.gmMemory;
        const newMemory: GmAdventureMemory = {
          worldRules: Array.isArray(rawMem?.worldRules) ? rawMem.worldRules : [],
          characterStates: Array.isArray(rawMem?.characterStates) ? rawMem.characterStates : [],
          activeQuests: Array.isArray(rawMem?.activeQuests) ? rawMem.activeQuests : [],
          majorChronicles: Array.isArray(rawMem?.majorChronicles) ? rawMem.majorChronicles : [],
          lastUpdatedRound: Number(rawMem?.lastUpdatedRound) || 0,
          summaryIntervalRounds: Number(rawMem?.summaryIntervalRounds) || 6
        };

        saveMemoryToLocal(newId, newMemory);
        saveMessagesToLocal(newId, newMessages);
        const updatedList = [newSession, ...sessions.filter(s => s.id !== newId)];
        saveSessionsToLocal(updatedList);

        setActiveSessionId(newId);
        setMessages(newMessages);
        setGmMemory(newMemory);
        setIsCreating(false);
        setShowSidebar(false);
        showToast(`成功导入剧本《${importedTitle}》（共 ${newMessages.length} 条记录）！`);
      } catch (err: any) {
        console.error('Failed to parse save json:', err);
        showToast('导入失败：JSON 文件解析异常', 'error');
      }
    };
    reader.onerror = () => {
      showToast('读取存档文件失败', 'error');
    };
    reader.readAsText(file, 'utf-8');
  };

  // 8. Call LLM Proxy logic
  const callLlm = async (systemPrompt: string, history: AdventureMessage[], userPrompt: string): Promise<string> => {
    const settings = await dbInstance.getSettings();
    const model = getEffectiveModel(settings, 'gemini-2.5-flash');
    
    // Construct request messages
    const apiMessages = [
      { role: 'system', content: systemPrompt }
    ];

    // Append limited recent history for context
    history.slice(-20).forEach(msg => {
      apiMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    });

    apiMessages.push({
      role: 'user',
      content: userPrompt
    });

    // Check custom settings
    if (settings.apiKey) {
      const cleanBaseUrl = (settings.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/$/, "");
      const targetUrl = `${cleanBaseUrl}/chat/completions`;

      const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, {
        model,
        messages: apiMessages,
        temperature: settings.temperature ?? 0.8,
        max_tokens: 4000
      });

      return data.choices?.[0]?.message?.content || 'GM 未能回应';
    } else {
      // Fallback: system Gemini SDK or API key
      const fallbackApiKey = getFallbackApiKey();
      if (!fallbackApiKey) {
        throw new Error('未设置 API Key。请前往系统设置页中配置您的 API 密钥，以便开启文游。');
      }

      const ai = new GoogleGenAI({ apiKey: fallbackApiKey });

      // Transform messages for Gemini format with timeout protection
      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n当前对话及游玩记录：\n${history.map(m => `${m.role === 'user' ? '玩家' : 'GM'}: ${m.content}`).join('\n')}\n玩家最新操作: ${userPrompt}` }] }
          ],
          config: {
            maxOutputTokens: 4000,
            temperature: settings.temperature ?? 0.8
          }
        }),
        40000,
        'GM 响应超时，请重试或在系统设置中配置自定义代理 API。'
      );

      return response.text || 'GM 未能产生回响';
    }
  };

  // 9. Start a new text adventure
  const handleStartGame = async () => {
    const finalOutline = newOutline.trim();
    if (!finalOutline) {
      setErrorText('请提供游戏大纲（输入文字或上传大纲文档）！');
      return;
    }

    const title = newTitle.trim() || `全新冒险 - ${new Date().toLocaleDateString()}`;
    const newSession: AdventureSession = {
      id: `adventure_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      outline: finalOutline,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      fileName: fileName || undefined,
      fileType: fileType
    };

    setIsGenerating(true);
    setErrorText(null);

    // Save session temporarily to let UI render it
    const updatedSessions = [newSession, ...sessions];
    saveSessionsToLocal(updatedSessions);
    setActiveSessionId(newSession.id);
    setIsCreating(false);
    setShowSidebar(false); // 自动关闭侧栏，直接展示新游戏世界的游戏对话窗

    // Extract initial structured memory from outline
    let initialMemory = DEFAULT_GM_MEMORY;
    try {
      initialMemory = await extractGmAdventureMemory(finalOutline, [], null);
    } catch (e) {
      console.warn('Initial GM memory extraction fallback', e);
    }
    saveMemoryToLocal(newSession.id, initialMemory);

    // Retrieve and selectively mount ONLY the Intimacy Awareness Protocol and Psychological Realism Essay presets from WorldBook
    let intimacyProtocolPromptBlock = '';
    try {
      const worldBookData = await dbInstance.getWorldBookConfig();
      const presets = worldBookData?.dialoguePresetList || [];
      
      const intimacyPreset = presets.find(
        (p: any) => p.id === 'intimacy-awareness-protocol-preset' || p.title?.includes('防自动退缩协议') || p.title?.includes('Intimacy Awareness')
      );
      if (intimacyPreset && (intimacyPreset.isActive ?? true) && intimacyPreset.content?.trim()) {
        intimacyProtocolPromptBlock += `\n【情感临在与防自动退缩协议（Intimacy Awareness Protocol）】:\n${intimacyPreset.content.trim()}\n`;
      }

      const realismPreset = presets.find(
        (p: any) => p.id === 'psychological-realism-essay-preset' || p.title?.includes('亲密心理现实主义') || p.title?.includes('The Weight of Another Existence')
      );
      if (realismPreset && (realismPreset.isActive ?? true) && realismPreset.content?.trim()) {
        intimacyProtocolPromptBlock += `\n【亲密心理现实主义与非血缘羁绊文学描写规范（The Weight of Another Existence）】:\n${realismPreset.content.trim()}\n`;
      }
    } catch (e) {
      console.warn('Failed to retrieve intimacy and realism protocols for GM start:', e);
    }

    // Trigger Initial AI Prompt to start game directly with GM memory injection
    const memoryPromptBlock = formatGmAdventureMemoryPrompt(initialMemory);
    const systemPrompt = `你是一个资深的TRPG游戏主持人（DND DM / COC KP / 跑团GM）。
你的任务是根据玩家提供的大纲，带领玩家进行一次高度沉浸、节奏得当的文字冒险游戏（文游）。
请严格阅读和分析以下大纲中的世界观、人设、势力、规则和关键情节：

【玩家提供的文游大纲与世界观/规则】：
${finalOutline}
${memoryPromptBlock}${intimacyProtocolPromptBlock}
【GM核心指令】：
1. 坚决不要剧透，不要自顾自地把故事一口气讲完。
2. 每一个回合，用生动精彩、文学代入感强烈的文字描述当前的环境、NPC的行为/神态、正在发生的事情或玩家面临的境遇。
3. 【克制描写与节奏把控】：重点突出核心戏剧冲突与行动反馈，不要描写过多繁杂琐碎的细节，严禁过多重复细节描写（过多重复堆砌细节会使人阅读疲劳）。保持叙事清晰爽快、张弛有度。
4. 每一段描述的结尾，给出合理的选项，或者抛出悬念、留下行动窗口，明确等待玩家输入并做出决策。
5. 【禁止擅自代位描写】：绝对禁止提前预设并擅自描写玩家未做出的动作、未作出的决定以及玩家的主观心理活动！你只能控制NPC与环境，行动的最终决策权必须始终留给玩家。
6. 当收到玩家的行动时，根据其大纲设定合理推导其后果。
7. 【角色信息差约束（严禁NPC开天眼）】：NPC角色间必须存在真实的信息差。若某角色不在现场且玩家未主动告知，该角色绝不知晓玩家的单独行动与隐秘举动。
8. 【严禁NPC直白背诵法则】：角色不可直白地以系统化/说明书式的口吻背诵或提及世界法则与铁律。
9. 【严禁直白提及数值】：严禁输出具体数值（如生命值、好感度、伤害点数等），必须全部转化为神态、伤情、语气等细腻沉浸的文学描写。\n\n【最高优先级警告（防代写越权）】：绝对不可以代替玩家说话，绝对不可以代写玩家的心理活动（如“你心想”、“你觉得”），绝对不可以替玩家做出任何实质性动作与决定！你的描述必须在玩家将要做出行动的那一刻戛然而止，把操作权与心理体验完全留给玩家！`;

    const userPrompt = `我已经准备好了。请充当GM阅读我的游戏大纲和设定，开始我的冒险！请先向我生动细致地介绍游戏的开局背景和初始场景，并引导我进行第一个行动或选择。`;

    try {
      const initialReply = await callLlm(systemPrompt, [], userPrompt);
      const startMsg: AdventureMessage = {
        id: `msg_system_${Date.now()}`,
        sessionId: newSession.id,
        role: 'assistant',
        content: initialReply,
        timestamp: Date.now()
      };
      saveMessagesToLocal(newSession.id, [startMsg]);
    } catch (err: any) {
      console.error(err);
      setErrorText(`开启文游首回合失败: ${err.message || err}`);
      // Clean up failed session & orphaned localstorage entries
      saveSessionsToLocal(sessions);
      try {
        localStorage.removeItem(`ai_text_adventure_memory_${newSession.id}`);
        localStorage.removeItem(`ai_text_adventure_messages_${newSession.id}`);
      } catch (cleanErr) {
        console.warn('Failed to clean up aborted session keys', cleanErr);
      }
      setActiveSessionId(sessions.length > 0 ? sessions[0].id : null);
      if (sessions.length === 0) setIsCreating(true);
    } finally {
      setIsGenerating(false);
      // Clean state
      setNewTitle('');
      setNewOutline('');
      setFileName('');
      setFileType('manual');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 10. Send Player action during game
  const handleSendPlayerAction = async () => {
    const text = inputText.trim();
    if (!text || isGenerating || !activeSessionId) return;

    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;

    setInputText('');
    setErrorText(null);

    // Append Player Action message
    const playerMsg: AdventureMessage = {
      id: `msg_user_${Date.now()}`,
      sessionId: activeSessionId,
      role: 'user',
      content: text,
      timestamp: Date.now()
    };

    const newMsgs = [...messages, playerMsg];
    saveMessagesToLocal(activeSessionId, newMsgs);

    setIsGenerating(true);

    // Retrieve and selectively mount ONLY the Intimacy Awareness Protocol and Psychological Realism Essay presets from WorldBook
    let intimacyProtocolPromptBlock = '';
    try {
      const worldBookData = await dbInstance.getWorldBookConfig();
      const presets = worldBookData?.dialoguePresetList || [];

      const intimacyPreset = presets.find(
        (p: any) => p.id === 'intimacy-awareness-protocol-preset' || p.title?.includes('防自动退缩协议') || p.title?.includes('Intimacy Awareness')
      );
      if (intimacyPreset && (intimacyPreset.isActive ?? true) && intimacyPreset.content?.trim()) {
        intimacyProtocolPromptBlock += `\n【情感临在与防自动退缩协议（Intimacy Awareness Protocol）】:\n${intimacyPreset.content.trim()}\n`;
      }

      const realismPreset = presets.find(
        (p: any) => p.id === 'psychological-realism-essay-preset' || p.title?.includes('亲密心理现实主义') || p.title?.includes('The Weight of Another Existence')
      );
      if (realismPreset && (realismPreset.isActive ?? true) && realismPreset.content?.trim()) {
        intimacyProtocolPromptBlock += `\n【亲密心理现实主义与非血缘羁绊文学描写规范（The Weight of Another Existence）】:\n${realismPreset.content.trim()}\n`;
      }
    } catch (e) {
      console.warn('Failed to retrieve intimacy and realism protocols for GM turn:', e);
    }

    const memoryPromptBlock = formatGmAdventureMemoryPrompt(gmMemory);
    const systemPrompt = `你是一个资深的TRPG游戏主持人（GM）。
你正在根据下面的大纲，扮演世界和引导当前玩家游玩。
大纲设定：
${currentSession.outline}
${memoryPromptBlock}${intimacyProtocolPromptBlock}
核心行动规范：
1. 详细且充满代入感地扩充与填充玩家输入行动的反馈与剧情展开。
2. 【克制描写与节奏把控】：重点突出核心事件、NPC交互与局势变化，不要描写过多繁杂琐碎的细节，严禁过多重复细节描写（过多重复堆砌细节会使人阅读疲劳）。保持叙事清晰爽快、张弛有度。
3. 切勿一次性跨越太多时间和情节，让玩家有充分的交互空间。
4. 每一回合，叙述后都需要留下问题或等待玩家动作，将主动权还给玩家。
5. 【禁止擅自代位描写】：绝对禁止提前预设并擅自描写玩家未做出的动作、未作出的决定以及玩家的主观心理活动！你只能控制世界与NPC，玩家的行为必须由玩家亲自输入。
6. 【角色信息差约束（严禁NPC开天眼）】：NPC角色间必须存在真实的信息差。若某角色不在现场且玩家未主动告知，该角色绝不知晓玩家的单独行动与隐秘举动。
7. 【严禁NPC直白背诵法则】：角色不可直白地以系统化/说明书式的口吻背诵或提及世界法则与铁律。
8. 【严禁直白提及数值】：严禁输出具体数值（如生命值、好感度、伤害点数等），必须全部转化为神态、伤情、语气等细腻沉浸的文学描写。\n\n【最高优先级警告（防代写越权）】：绝对不可以代替玩家说话，绝对不可以代写玩家的心理活动（如“你心想”、“你觉得”），绝对不可以替玩家做出任何实质性动作与决定！你的描述必须在玩家将要做出行动的那一刻戛然而止，把操作权与心理体验完全留给玩家！`;

    try {
      const reply = await callLlm(systemPrompt, messages, text);
      const aiMsg: AdventureMessage = {
        id: `msg_assistant_${Date.now()}`,
        sessionId: activeSessionId,
        role: 'assistant',
        content: reply,
        timestamp: Date.now()
      };
      
      const finalMsgs = [...newMsgs, aiMsg];
      saveMessagesToLocal(activeSessionId, finalMsgs);
      
      // Update session order & timestamp
      const updatedSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, updatedAt: Date.now() };
        }
        return s;
      });
      // Bring active session to top safely without non-null assertions
      const activeSess = updatedSessions.find(s => s.id === activeSessionId);
      const sorted = activeSess
        ? [activeSess, ...updatedSessions.filter(s => s.id !== activeSessionId)]
        : updatedSessions;
      saveSessionsToLocal(sorted);

      // Node-based explicit auto-summarization based on user preference (defaults to 6 rounds)
      const playerTurnCount = finalMsgs.filter(m => m.role === 'user').length;
      // Sanitize lastSummaryRound to prevent old history.length bug from blocking triggers
      const rawLastSummaryRound = Number(gmMemory.lastUpdatedRound) || 0;
      const lastSummaryRound = rawLastSummaryRound > playerTurnCount ? 0 : rawLastSummaryRound;
      const intervalRounds = Number(gmMemory.summaryIntervalRounds) || 6;

      if (
        !showMemoryModal &&
        !isExtractingMemory &&
        !isAutoExtracting &&
        (playerTurnCount >= lastSummaryRound + intervalRounds || (lastSummaryRound === 0 && playerTurnCount >= intervalRounds))
      ) {
        setIsAutoExtracting(true);
        extractGmAdventureMemory(currentSession.outline, finalMsgs, gmMemory)
          .then((extracted) => {
            const isIdentical = 
              JSON.stringify(extracted.worldRules) === JSON.stringify(gmMemory.worldRules) &&
              JSON.stringify(extracted.characterStates) === JSON.stringify(gmMemory.characterStates) &&
              JSON.stringify(extracted.activeQuests) === JSON.stringify(gmMemory.activeQuests) &&
              JSON.stringify(extracted.majorChronicles) === JSON.stringify(gmMemory.majorChronicles);
              
            saveMemoryToLocal(activeSessionId, extracted);
            if (!isIdentical) {
              showToast('[GM 记忆库已同步最新剧情事实]');
            } else {
              console.log('Auto extract returned identical memory, waiting for next interval.');
            }
          })
          .catch((err) => {
            console.error('Auto GM memory extraction failed:', err);
          })
          .finally(() => {
            setIsAutoExtracting(false);
          });
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(`GM 失联中: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 10.5 Delete a single player action bubble Click
  const handleDeleteMessageClick = (msgId: string) => {
    setMessageToDeleteId(msgId);
  };

  // 10.5.1 Confirm Delete Message
  const confirmDeleteMessage = () => {
    if (!messageToDeleteId || !activeSessionId) return;
    const filtered = messages.filter(m => m.id !== messageToDeleteId);
    saveMessagesToLocal(activeSessionId, filtered);
    setMessageToDeleteId(null);
  };

  // 10.6 Edit a player action and force GM to regenerate subsequent reply
  const handleUpdateAndRegenerate = async (msgId: string) => {
    if (!activeSessionId || isGenerating) return;
    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;

    const idx = messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;

    const editedContent = editingText.trim();
    if (!editedContent) return;

    setIsGenerating(true);
    setErrorText(null);
    setEditingMessageId(null);

    // Get previous messages up to this message
    const historyBefore = messages.slice(0, idx);

    // Create the updated message
    const updatedPlayerMsg: AdventureMessage = {
      ...messages[idx],
      content: editedContent,
      timestamp: Date.now()
    };

    const updatedHistory = [...historyBefore, updatedPlayerMsg];
    saveMessagesToLocal(activeSessionId, updatedHistory);

    // 5. Retrieve intimacy and realism protocols from WorldBook
    let intimacyProtocolPromptBlock = '';
    try {
      const worldBookData = await dbInstance.getWorldBookConfig();
      const presets = worldBookData?.dialoguePresetList || [];
      const intimacyPreset = presets.find(
        (p: any) => p.id === 'intimacy-awareness-protocol-preset' || p.title?.includes('防自动退缩协议') || p.title?.includes('Intimacy Awareness')
      );
      if (intimacyPreset && (intimacyPreset.isActive ?? true) && intimacyPreset.content?.trim()) {
        intimacyProtocolPromptBlock = `\n\n=== 【世界设定集特选核心协议：亲密感防退缩与心理写实铁律】 ===\n${intimacyPreset.content.trim()}\n【特别指令】：本协议具有极高优先级。在涉及角色互动、心理博弈、情感推拉与亲密互动时，必须严格执行上述原则，绝不擅自违背！\n`;
      }
    } catch (e) {
      console.warn('Failed to retrieve intimacy protocols for GM regeneration:', e);
    }

    const memoryPromptBlock = formatGmAdventureMemoryPrompt(gmMemory);
    const systemPrompt = `你是一个资深的TRPG游戏主持人（GM）。
你正在根据下面的大纲，扮演世界和引导当前玩家游玩。
大纲设定：
${currentSession.outline}
${memoryPromptBlock}${intimacyProtocolPromptBlock}
核心行动规范：
1. 详细且充满代入感地扩充与填充玩家输入行动的反馈与剧情展开。
2. 【克制描写与节奏把控】：重点突出核心事件、NPC交互与局势变化，不要描写过多繁杂琐碎的细节，严禁过多重复细节描写（过多重复堆砌细节会使人阅读疲劳）。保持叙事清晰爽快、张弛有度。
3. 切勿一次性跨越太多时间和情节，让玩家有充分的交互空间。
4. 每一回合，叙述后都需要留下问题或等待玩家动作，将主动权还给玩家。
5. 【禁止擅自代位描写】：绝对禁止提前预设并擅自描写玩家未做出的动作、未作出的决定以及玩家的主观心理活动！你只能控制世界与NPC，玩家的行为必须由玩家亲自输入。
6. 【角色信息差约束（严禁NPC开天眼）】：NPC角色间必须存在真实的信息差。若某角色不在现场且玩家未主动告知，该角色绝不知晓玩家的单独行动与隐秘举动。
7. 【严禁NPC直白背诵法则】：角色不可直白地以系统化/说明书式的口吻背诵或提及世界法则与铁律。
8. 【严禁直白提及数值】：严禁输出具体数值（如生命值、好感度、伤害点数等），必须全部转化为神态、伤情、语气等细腻沉浸的文学描写。\n\n【最高优先级警告（防代写越权）】：绝对不可以代替玩家说话，绝对不可以代写玩家的心理活动（如“你心想”、“你觉得”），绝对不可以替玩家做出任何实质性动作与决定！你的描述必须在玩家将要做出行动的那一刻戛然而止，把操作权与心理体验完全留给玩家！`;

    try {
      const reply = await callLlm(systemPrompt, historyBefore, editedContent);
      const aiMsg: AdventureMessage = {
        id: `msg_assistant_${Date.now()}`,
        sessionId: activeSessionId,
        role: 'assistant',
        content: reply,
        timestamp: Date.now()
      };
      
      const finalMsgs = [...updatedHistory, aiMsg];
      saveMessagesToLocal(activeSessionId, finalMsgs);
      
      // Update session order & timestamp (move active session to top)
      const updatedSessions = sessions.map(s => {
        if (s.id === activeSessionId) {
          return { ...s, updatedAt: Date.now() };
        }
        return s;
      });
      const activeSess = updatedSessions.find(s => s.id === activeSessionId);
      const sorted = activeSess
        ? [activeSess, ...updatedSessions.filter(s => s.id !== activeSessionId)]
        : updatedSessions;
      saveSessionsToLocal(sorted);

      // Node-based auto-summarization check on regenerate
      const playerTurnCount = finalMsgs.filter(m => m.role === 'user').length;
      const rawLastSummaryRound = Number(gmMemory.lastUpdatedRound) || 0;
      const lastSummaryRound = rawLastSummaryRound > playerTurnCount ? 0 : rawLastSummaryRound;
      const intervalRounds = Number(gmMemory.summaryIntervalRounds) || 6;

      if (
        !showMemoryModal &&
        !isExtractingMemory &&
        !isAutoExtracting &&
        (playerTurnCount >= lastSummaryRound + intervalRounds || (lastSummaryRound === 0 && playerTurnCount >= intervalRounds))
      ) {
        setIsAutoExtracting(true);
        extractGmAdventureMemory(currentSession.outline, finalMsgs, gmMemory)
          .then((extracted) => {
            const isIdentical = 
              JSON.stringify(extracted.worldRules) === JSON.stringify(gmMemory.worldRules) &&
              JSON.stringify(extracted.characterStates) === JSON.stringify(gmMemory.characterStates) &&
              JSON.stringify(extracted.activeQuests) === JSON.stringify(gmMemory.activeQuests) &&
              JSON.stringify(extracted.majorChronicles) === JSON.stringify(gmMemory.majorChronicles);
              
            saveMemoryToLocal(activeSessionId, extracted);
            if (!isIdentical) {
              showToast('[GM 记忆库已同步最新剧情事实]');
            }
          })
          .catch((err) => {
            console.error('Auto GM memory extraction failed on regenerate:', err);
          })
          .finally(() => {
            setIsAutoExtracting(false);
          });
      }
    } catch (err: any) {
      console.error(err);
      setErrorText(`GM 重写剧本失败: ${err.message || err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 11. Quick action suggestions for player (Prompt hints)
  const getQuickActionHint = async () => {
    if (!activeSessionId || isGenerating) return;
    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;

    setIsGenerating(true);
    setErrorText(null);

    const systemPrompt = `你是一个文字冒险游戏的助手。请阅读以下的游戏大纲和当前冒险的对话记录，为玩家生成 3 个符合当下场景、高代入感、符合规则的“下一步行动/台词推荐选项”。每一条选项请写得充满角色态度或战术考量。
大纲：
${currentSession.outline}

请只返回一个简单的、干净的 JSON 格式数组，不需要任何解释文字或 markdown：
[
  "选项1：尝试利用随身铁锁撬开这扇布满苔藓的牢门...",
  "选项2：向眼前的古怪学者行个礼，询问他对这个‘异界之卵’有什么看法...",
  "选项3：谨慎地拔出佩剑，贴着湿滑的岩壁缓慢向亮光处挪步..."
]`;

    try {
      const response = await callLlm(systemPrompt, messages, "请帮我为当前场景设计 3 个极具操作感、符合剧情的下一步决策选项。");
      let cleanText = response.replace(/<(?:thought|think|thinking)>[\s\S]*?<\/(?:thought|think|thinking)>/gi, '').trim();
      cleanText = cleanText.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
      
      let parsed: any = null;
      try {
        parsed = JSON.parse(cleanText);
      } catch {
        const firstBracket = cleanText.indexOf('[');
        const lastBracket = cleanText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket > firstBracket) {
          try {
            parsed = JSON.parse(cleanText.substring(firstBracket, lastBracket + 1));
          } catch (_) {}
        }
      }

      if (Array.isArray(parsed) && parsed.length > 0) {
        // Display suggestions in chat or append as helper options
        setInputText(String(parsed[0])); // Autofill the first one
      } else {
        const lines = cleanText.split('\n')
          .map(l => l.replace(/^[-*•\d+.\s、()（）"']+|["',]+$/g, '').trim())
          .filter(l => l.length > 3 && !l.startsWith('[') && !l.startsWith('{'));
        if (lines.length > 0) {
          setInputText(lines[0]);
        }
      }
    } catch (e) {
      console.error(e);
      setErrorText('获取下一步提示失败，请自行决定你的行动。');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 flex bg-slate-50 relative overflow-hidden font-sans h-full">
      {/* 2. MAIN WORKSPACE / GAME ZONE */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 relative min-w-0">
        
        {/* Unified Top Header Bar (h-16 px-4 standard) */}
        <div className="h-16 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between shrink-0 shadow-xs z-30">
          {/* Left: Back Button + Title Info */}
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBackToLobby}
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all flex items-center justify-center cursor-pointer shrink-0"
              title="返回游戏中心"
            >
              <ChevronLeft size={16} className="stroke-[2.5]" />
            </button>
            
            <div className="min-w-0 flex-1">
              {activeSessionId ? (
                <>
                  <h3 className="text-xs font-black text-slate-800 truncate">
                    {sessions.find(s => s.id === activeSessionId)?.title}
                  </h3>
                  <p className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">
                    AI 智能充当 GM 中 · {sessions.find(s => s.id === activeSessionId)?.fileName || '自定义手动设定大纲'}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-xs font-black text-slate-800 truncate">
                    AI 剧本工坊
                  </h3>
                  <p className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">
                    请选择一个存档或新建剧本开始游戏
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Right: GM Memory + Suggestion Button + Sidebar Toggle Button */}
          <div className="flex items-center space-x-2 shrink-0 ml-3">
            {activeSessionId && (
              <>
                <button
                  type="button"
                  onClick={() => setShowMemoryModal(true)}
                  className="h-8 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black transition-all flex items-center space-x-1.5 cursor-pointer shadow-xs"
                  title="查看/编辑 GM 记忆库 (防遗忘/防前后矛盾)"
                >
                  <Brain size={12} className="text-amber-400 stroke-[2.5]" />
                  <span>GM记忆</span>
                  {(gmMemory.worldRules?.length || 0) +
                    (gmMemory.characterStates?.length || 0) +
                    (gmMemory.activeQuests?.length || 0) +
                    (gmMemory.majorChronicles?.length || 0) > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-400 text-slate-950">
                      {(gmMemory.worldRules?.length || 0) +
                        (gmMemory.characterStates?.length || 0) +
                        (gmMemory.activeQuests?.length || 0) +
                        (gmMemory.majorChronicles?.length || 0)}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={getQuickActionHint}
                  disabled={isGenerating}
                  className="h-8 px-3 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-black border border-indigo-200/60 rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                  title="向 GM 请求决策灵感"
                >
                  <HelpCircle size={12} />
                  <span>行动灵感</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowSidebar(!showSidebar)}
              className="h-8 w-8 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm transition-all cursor-pointer flex items-center justify-center"
              title={showSidebar ? "隐藏侧栏" : "显示侧栏"}
            >
              <Menu size={15} />
            </button>
          </div>
        </div>

        {activeSessionId ? (
          /* 2.2 ACTIVE ADVENTURE CHAT VIEW */
          <div className="flex-1 flex flex-col min-h-0 min-w-0">

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="animate-spin text-indigo-500 w-5 h-5" />
                  <p className="text-xs font-semibold text-slate-500">正在生成初始场景...</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className="flex flex-col space-y-1"
                    >
                      <div
                        className={`flex items-start space-x-2.5 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
                      >
                        {/* Icon badge for sender */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-xs overflow-hidden ${
                          isUser
                            ? 'bg-amber-100 border-amber-200 text-amber-700'
                            : 'bg-indigo-100 border-indigo-200 text-indigo-700'
                        }`}>
                          {isUser ? (
                            (() => {
                              const avatar = getUserAvatar();
                              return avatar !== '🤖' ? (
                                <img src={avatar} alt="Me" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-xs font-black">我</span>
                              );
                            })()
                          ) : (
                            <span className="text-xs font-black">GM</span>
                          )}
                        </div>

                        <div
                          onTouchStart={() => handleBubbleTouchStart(msg.id)}
                          onTouchEnd={handleBubbleTouchEnd}
                          onTouchCancel={handleBubbleTouchEnd}
                          onTouchMove={handleBubbleTouchEnd}
                          onMouseDown={() => handleBubbleTouchStart(msg.id)}
                          onMouseUp={handleBubbleTouchEnd}
                          onMouseLeave={handleBubbleTouchEnd}
                          onContextMenu={(e) => handleBubbleContextMenu(e, msg.id)}
                          onClick={() => handleBubbleClick(msg.id)}
                          className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs transition-all select-none ${
                            isUser
                              ? 'bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 cursor-pointer'
                              : 'bg-white text-slate-700 border border-slate-200/80 leading-relaxed font-medium whitespace-pre-wrap cursor-pointer'
                          }`}
                        >
                          {/* Name tag */}
                          <span className={`text-[9px] font-black uppercase tracking-wider block mb-1 ${
                            isUser ? 'text-amber-900/80' : 'text-indigo-500'
                          }`}>
                            {isUser ? '玩家行动 (长按展开菜单)' : 'GM主持回响 (长按展开菜单)'}
                          </span>
                          
                          {editingMessageId === msg.id ? (
                            <div className="w-full space-y-2 mt-1" onClick={(e) => e.stopPropagation()}>
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                rows={3}
                                className="w-full bg-white text-slate-800 border border-amber-300 rounded-xl p-2 focus:outline-none text-xs leading-relaxed font-medium"
                              />
                              <div className="flex items-center space-x-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setEditingMessageId(null)}
                                  className="px-2 py-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer font-bold"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateAndRegenerate(msg.id)}
                                  disabled={isGenerating || !editingText.trim()}
                                  className="px-2 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg cursor-pointer font-bold flex items-center space-x-1"
                                >
                                  <span>保存并重算</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>

                      {activeUserMenuId === msg.id && editingMessageId !== msg.id && (
                        <div className={`flex items-center space-x-2 mt-1 text-[10px] ${isUser ? 'justify-end pr-10' : 'justify-start pl-10'}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (navigator.clipboard && navigator.clipboard.writeText) {
                                navigator.clipboard.writeText(msg.content)
                                  .then(() => showToast('内容已成功复制！'))
                                  .catch(() => showToast('复制失败，请手动选择复制。', 'error'));
                              } else {
                                const textArea = document.createElement("textarea");
                                textArea.value = msg.content;
                                textArea.style.position = "fixed";
                                document.body.appendChild(textArea);
                                textArea.select();
                                try {
                                  document.execCommand('copy');
                                  showToast('内容已成功复制！');
                                } catch (err) {
                                  showToast('复制失败，请手动选择复制。', 'error');
                                }
                                document.body.removeChild(textArea);
                              }
                              setActiveUserMenuId(null);
                            }}
                            className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer shadow-xs"
                          >
                            复制
                          </button>
                          {isUser && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMessageId(msg.id);
                                setEditingText(msg.content);
                                setActiveUserMenuId(null);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-indigo-700 font-bold transition-all cursor-pointer shadow-xs"
                            >
                              编辑并重算
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMessageClick(msg.id);
                              setActiveUserMenuId(null);
                            }}
                            className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-all cursor-pointer shadow-xs"
                          >
                            删除
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Loading status */}
              {isGenerating && (
                <div className="flex items-start space-x-2.5 animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl px-3.5 py-3 text-xs text-slate-400 italic">
                    GM 正在深思熟虑，构思精彩剧情中...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Action Panel */}
            <div className="p-3 bg-white border-t border-slate-200/80 flex flex-col space-y-2 shrink-0">
              {errorText && (
                <div className="text-[10px] text-red-500 font-semibold flex items-center space-x-1 px-1">
                  <AlertCircle size={11} className="shrink-0" />
                  <span>{errorText}</span>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendPlayerAction();
                    }
                  }}
                  placeholder=""
                  disabled={isGenerating}
                  rows={2}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl pl-[6px] pr-3.5 pt-[7px] pb-[8px] text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all disabled:opacity-60 font-medium resize-none"
                />
                <button
                  type="button"
                  onClick={handleSendPlayerAction}
                  disabled={isGenerating || !inputText.trim()}
                  className="p-[14px] rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all active:scale-95 disabled:opacity-40 disabled:scale-100 cursor-pointer shadow-xs"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty Placeholder State */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4 pt-16">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 text-indigo-500 flex items-center justify-center shadow-sm">
              <Sparkles size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-800">开始你的第一局 AI 文字冒险</h3>
              <p className="text-xs text-slate-500 max-w-xs">
                点击右上角的加号，或者点击下方按钮构建剧本，让 AI 充当您的专属 GM
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setNewTitle('');
                setNewOutline('');
                setFileName('');
                setFileType('manual');
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 transition-all cursor-pointer"
            >
              构建全新文游
            </button>
          </div>
        )}
      </div>

      {/* 2.1 CREATING NEW GAME MODAL */}
      <AnimatePresence>
        {isCreating && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseCreatingModal}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 20, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-100 shadow-2xl p-6 relative flex flex-col space-y-4 z-50 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button (Only show if there are existing sessions to go back to) */}
              {sessions.length > 0 && (
                <button
                  type="button"
                  onClick={handleCloseCreatingModal}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}

              <div className="text-center space-y-1.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-400 text-white flex items-center justify-center mx-auto shadow-md">
                  <Sparkles size={24} className="animate-pulse" />
                </div>
                <h2 className="text-base font-black text-slate-800">构建新的 AI 文游</h2>
                <p className="text-[11px] text-slate-500">上传您喜欢的世界观、跑团模组、游戏大纲或直接输入，AI 将扮演完美 GM 为您提供无限精彩对话</p>
              </div>

              <div className="space-y-4">
                {/* Title input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-500 block uppercase tracking-wider">冒险剧本标题</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="给这局冒险起个拉风的名字吧（不填则自动生成）"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                  />
                </div>

                {/* Upload zone */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-500 block uppercase tracking-wider">
                    导入大纲文档 (.docx / .html / .txt)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".docx,.html,.htm,.txt"
                    className="hidden"
                  />
                  
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      isUploading
                        ? 'bg-slate-50 border-indigo-300'
                        : fileName
                        ? 'bg-emerald-50/40 border-emerald-300 hover:bg-emerald-50/80'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50 hover:border-indigo-400'
                    }`}
                  >
                    {isUploading ? (
                      <div className="space-y-1">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mx-auto" />
                        <p className="text-[11px] text-slate-500 font-medium">正在深度提取文档文本...</p>
                      </div>
                    ) : fileName ? (
                      <div className="space-y-1">
                        {fileType === 'docx' ? (
                          <FileText className="w-6 h-6 text-emerald-500 mx-auto" />
                        ) : (
                          <FileCode className="w-6 h-6 text-teal-500 mx-auto" />
                        )}
                        <p className="text-xs font-bold text-emerald-800 truncate px-2">{fileName}</p>
                        <p className="text-[10px] text-emerald-600">提取解析成功！你可以继续在下方修改大纲文本</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                        <p className="text-xs font-semibold text-slate-600">点击上传大纲大作</p>
                        <p className="text-[10px] text-slate-400">支持 电脑端的 Word文档、网页源码、纯文本</p>
                      </div>
                    )}
                  </div>

                  {uploadError && (
                    <p className="text-[10px] text-red-500 font-semibold flex items-center space-x-1 mt-1">
                      <AlertCircle size={10} />
                      <span>{uploadError}</span>
                    </p>
                  )}
                </div>

                {/* Outline Manual Text Area */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black text-slate-500 block uppercase tracking-wider">
                      大纲详情 (可以直接输入或粘贴大纲)
                    </label>
                    {newOutline && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewOutline('');
                          setFileName('');
                          setFileType('manual');
                        }}
                        className="text-[10px] text-red-500 hover:underline"
                      >
                        清空大纲
                      </button>
                    )}
                  </div>
                  <textarea
                    value={newOutline}
                    onChange={(e) => setNewOutline(e.target.value)}
                    placeholder=""
                    rows={5}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none font-medium leading-relaxed"
                  />
                </div>

                {errorText && (
                  <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold flex items-start space-x-1.5">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{errorText}</span>
                  </div>
                )}

                {/* Start game button */}
                <button
                  type="button"
                  onClick={handleStartGame}
                  disabled={isGenerating}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs shadow-md shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>正在阅读大纲并构思开局背景...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight size={14} className="stroke-[2.5]" />
                      <span>立即载入，开始游玩</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Session Delete Confirmation Dialog */}
      <AnimatePresence>
        {sessionToDeleteId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSessionToDeleteId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-white rounded-2xl p-5 max-w-sm w-full border border-slate-100 shadow-2xl relative z-10 space-y-4"
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800">确认删除该存档吗？</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    此操作将彻底删除该文游存档和所有对话记录，且数据无法恢复。
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 justify-end text-[11px]">
                <button
                  type="button"
                  onClick={() => setSessionToDeleteId(null)}
                  className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg cursor-pointer font-bold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteSession}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer font-bold"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Message Delete Confirmation Dialog */}
      <AnimatePresence>
        {messageToDeleteId && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMessageToDeleteId(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-white rounded-2xl p-5 max-w-sm w-full border border-slate-100 shadow-2xl relative z-10 space-y-4"
            >
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 shrink-0">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800">确认删除这条玩家行动气泡吗？</h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    仅删除这一条玩家行动气泡，该操作不可撤销。
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 justify-end text-[11px]">
                <button
                  type="button"
                  onClick={() => setMessageToDeleteId(null)}
                  className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg cursor-pointer font-bold"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteMessage}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg cursor-pointer font-bold"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. SESSION SIDEBAR (Multiple adventure sessions manager) on the right */}
      <AnimatePresence>
        {showSidebar && (
          <>
            {/* Background Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowSidebar(false);
                setSessionMenuOpenId(null);
              }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
            />

            {/* Hidden Input for Save File (JSON) Import */}
            <input
              type="file"
              ref={importSaveInputRef}
              accept=".json"
              onChange={handleImportSaveFile}
              className="hidden"
            />

            {/* Sliding Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={() => setSessionMenuOpenId(null)}
              className="absolute right-0 top-0 h-full w-[80vw] max-w-[300px] sm:w-[288px] bg-white border-l border-slate-200 flex flex-col shrink-0 z-50 overflow-hidden shadow-2xl"
            >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700 tracking-wider flex items-center space-x-2">
                <BookOpen size={16} className="text-indigo-500" />
                <span>我的文游存档</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    importSaveInputRef.current?.click();
                  }}
                  className="h-8 px-2.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer flex items-center space-x-1.5 text-xs font-medium"
                  title="导入文游存档 (JSON)"
                >
                  <Upload size={13} />
                  <span>导入</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsCreating(true);
                    setActiveSessionId(null);
                    setNewTitle('');
                    setNewOutline('');
                    setFileName('');
                    setFileType('manual');
                  }}
                  className="h-8 w-8 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer flex items-center justify-center shadow-xs"
                  title="新建文游剧本"
                >
                  <Plus size={16} className="stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 relative">
              {sessions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[11px] text-slate-400">暂无活动存档</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">点击右上角加号开启吧！</p>
                </div>
              ) : (
                sessions.map(s => {
                  const isActive = s.id === activeSessionId && !isCreating;
                  const isMenuOpen = sessionMenuOpenId === s.id;
                  return (
                    <div
                      key={s.id}
                      className="relative"
                    >
                      <div
                        onClick={() => {
                          setActiveSessionId(s.id);
                          setIsCreating(false);
                          setShowSidebar(false); // 自动关闭侧栏，跳转展示对应的游戏对话窗
                          setSessionMenuOpenId(null);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all ${
                          isActive
                            ? 'bg-indigo-50 border border-indigo-100 text-indigo-950 font-semibold'
                            : 'hover:bg-slate-50 border border-transparent text-slate-600'
                        }`}
                      >
                        <div className="min-w-0 flex-1 flex items-center space-x-2">
                          <MessageSquare size={14} className={isActive ? 'text-indigo-500' : 'text-slate-400'} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs truncate font-medium leading-tight">{s.title}</p>
                            <p className="text-[9px] text-slate-400 truncate mt-0.5">
                              {new Date(s.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* More Action Menu Trigger */}
                        <div className="relative shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSessionMenuOpenId(isMenuOpen ? null : s.id);
                            }}
                            className={`p-1 rounded-md transition-all cursor-pointer ${
                              isMenuOpen
                                ? 'bg-slate-200 text-slate-700 opacity-100'
                                : 'opacity-0 group-hover:opacity-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700'
                            }`}
                            title="剧本操作选项"
                          >
                            <MoreVertical size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Dropdown Menu for Current Session */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-10 z-50 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
                        >
                          <button
                            type="button"
                            onClick={(e) => handleExportSessionSave(s, e)}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 hover:text-indigo-600 flex items-center space-x-2 transition-colors cursor-pointer"
                          >
                            <FileDown size={14} className="text-indigo-500" />
                            <span>导出完整存档 (JSON)</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleExportSessionStory(s, e)}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 hover:text-emerald-600 flex items-center space-x-2 transition-colors cursor-pointer"
                          >
                            <FileText size={14} className="text-emerald-500" />
                            <span>导出故事记录 (TXT)</span>
                          </button>
                          <div className="h-px bg-slate-100 my-1" />
                          <button
                            type="button"
                            onClick={(e) => {
                              setSessionMenuOpenId(null);
                              handleDeleteSessionClick(s.id, e);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 flex items-center space-x-2 transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} />
                            <span>删除文游剧本</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer Info */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center leading-relaxed">
              数据已在本地自动静默归档
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* GM Memory Modal */}
      {activeSessionId && (
        <GmMemoryModal
          isOpen={showMemoryModal}
          onClose={() => setShowMemoryModal(false)}
          memory={gmMemory}
          onSave={(updated) => {
            saveMemoryToLocal(activeSessionId, updated);
            showToast('GM 记忆库已成功保存！');
          }}
          onAutoExtract={handleManualExtractMemory}
          isExtracting={isExtractingMemory}
          sessionTitle={sessions.find(s => s.id === activeSessionId)?.title || ''}
        />
      )}

      {/* Toast Alert popup */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center space-x-2 text-white border ${
              toast.type === 'error'
                ? 'bg-red-600 border-red-500'
                : 'bg-slate-900 border-slate-800'
            }`}
          >
            <Sparkles size={14} className={toast.type === 'error' ? 'text-white' : 'text-amber-400'} />
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
