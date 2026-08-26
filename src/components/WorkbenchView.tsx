import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Send,
  Download,
  RefreshCw,
  Settings,
  PenTool,
  BookOpen,
  Cpu,
  Layers,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  FileText,
  Code,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  Wrench,
  HelpCircle,
  Plus,
  Trash2,
  Edit,
  Home
} from 'lucide-react';
import { dbInstance } from '../lib/db';
import { callOpenAIEndpoint, getFallbackApiKey } from '../lib/api';
import { GoogleGenAI } from '@google/genai';

interface WorkbenchMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface WorkbenchSession {
  id: string;
  title: string;
  messages: WorkbenchMessage[];
  liveOutline: string;
  createdAt: number;
}

interface WorkbenchViewProps {
  onHome?: () => void;
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

export default function WorkbenchView({ onHome }: WorkbenchViewProps = {}) {
  // 1. API Configuration States
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [temperature, setTemperature] = useState(0.8);
  const [showApiKeyPreview, setShowApiKeyPreview] = useState(false);

  // 1.5 Multi-session and Sidebar States
  const [showSidebar, setShowSidebar] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  // User Message Action States
  const [activeUserMenuId, setActiveUserMenuId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const [sessions, setSessions] = useState<WorkbenchSession[]>(() => {
    const saved = localStorage.getItem('workbench_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }

    // Migrate from older single session or initialize with a default one
    const oldHistory = localStorage.getItem('workbench_chat_history');
    const oldOutline = localStorage.getItem('workbench_live_outline') || '';
    let initialMessages: WorkbenchMessage[] = [
      {
        id: 'init_msg_1',
        role: 'assistant',
        content: '你好！我是你的工作台助手，你可以直接在这里与我交流你的世界观想法和玩法规则，我会自动提炼并【实时自动更新】在下方的大纲编辑器中！',
        timestamp: Date.now()
      }
    ];
    if (oldHistory) {
      try {
        const parsed = JSON.parse(oldHistory);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialMessages = parsed;
        }
      } catch (e) {}
    }

    return [
      {
        id: 'session_default',
        title: '默认创意会话',
        messages: initialMessages,
        liveOutline: oldOutline,
        createdAt: Date.now()
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return localStorage.getItem('workbench_active_session_id') || 'session_default';
  });

  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<string | null>(null);

  // Active Session helper
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || {
    id: 'session_default',
    title: '默认创意会话',
    messages: [],
    liveOutline: ''
  };

  // 2. Chat & Outline States synchronized to active session
  const [messages, setMessages] = useState<WorkbenchMessage[]>(activeSession.messages);
  const [liveOutline, setLiveOutline] = useState<string>(activeSession.liveOutline);

  const [isEditingOutline, setIsEditingOutline] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // 3. Layout Control States
  const [editorHeightPercent, setEditorHeightPercent] = useState<number>(45); // 0 to 100
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartHeight = useRef<number>(45);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Long press refs for message bubbles
  const bubbleLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isBubbleLongPressRef = useRef<boolean>(false);

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

  // Synchronize state when activeSessionId changes
  useEffect(() => {
    const s = sessions.find(sess => sess.id === activeSessionId);
    if (s) {
      setMessages(s.messages);
      setLiveOutline(s.liveOutline);
    }
  }, [activeSessionId]);

  // Synchronize changes to current active session in list
  useEffect(() => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages,
          liveOutline
        };
      }
      return s;
    }));
  }, [messages, liveOutline, activeSessionId]);

  // Persist sessions array and active session ID
  useEffect(() => {
    localStorage.setItem('workbench_sessions', JSON.stringify(sessions));
    localStorage.setItem('workbench_active_session_id', activeSessionId);
  }, [sessions, activeSessionId]);

  // 4. Load API configurations from both global storage and local custom profile
  useEffect(() => {
    async function initSettings() {
      // First load local overrides from localStorage if exist
      const savedCustom = localStorage.getItem('workbench_api_profile');
      if (savedCustom) {
        try {
          const parsed = JSON.parse(savedCustom);
          setApiKey(parsed.apiKey || '');
          setBaseUrl(parsed.baseUrl || 'https://api.openai.com/v1');
          setSelectedModel(parsed.selectedModel || 'gemini-2.5-flash');
          setTemperature(parsed.temperature ?? 0.8);
          return;
        } catch (e) {}
      }

      // Fallback to global db settings
      try {
        const stored = await dbInstance.getSettings();
        if (stored) {
          setApiKey(stored.apiKey || '');
          setBaseUrl(stored.baseUrl || 'https://api.openai.com/v1');
          setSelectedModel(stored.selectedModel || 'gemini-2.5-flash');
          setTemperature(stored.temperature ?? 0.8);
        }
      } catch (err) {}
    }
    initSettings();
  }, []);

  // Handle auto scrolling for chat logs
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // 5. API Custom Override Save
  const saveCustomApiSettings = () => {
    const config = {
      apiKey,
      baseUrl,
      selectedModel,
      temperature
    };
    localStorage.setItem('workbench_api_profile', JSON.stringify(config));
    setShowApiSettings(false);
    setErrorText(null);
  };

  const importGlobalApiSettings = async () => {
    try {
      const stored = await dbInstance.getSettings();
      if (stored && stored.apiKey) {
        setApiKey(stored.apiKey);
        setBaseUrl(stored.baseUrl || 'https://api.openai.com/v1');
        setSelectedModel(stored.selectedModel || 'gemini-2.5-flash');
        setTemperature(stored.temperature ?? 0.8);
        setErrorText(null);
      } else {
        setErrorText('系统设置中未检测到已配置的 API Key，请在此手动输入。');
      }
    } catch (e) {
      setErrorText('导入系统设置失败，请手动配置。');
    }
  };

  // 6. Handle LLM Chat API Request with live parsing and updating
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    setActiveUserMenuId(null);
  };

  const handleEditMessage = (msg: WorkbenchMessage) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.content);
    setActiveUserMenuId(null);
  };

  const handleDeleteMessage = (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setActiveUserMenuId(null);
  };

  const handleSaveEditedMessage = (msgId: string) => {
    if (!editingText.trim()) return;
    
    setMessages(prev => {
      const targetIndex = prev.findIndex(m => m.id === msgId);
      if (targetIndex === -1) return prev;
      
      const updatedMsg = { ...prev[targetIndex], content: editingText.trim() };
      const newMsgs = [...prev.slice(0, targetIndex), updatedMsg];
      
      setTimeout(() => generateAIResponse(newMsgs), 0);
      return newMsgs;
    });
    
    setEditingMessageId(null);
  };

  const generateAIResponse = async (updatedMsgs: WorkbenchMessage[]) => {
    setIsGenerating(true);
    setErrorText(null);

    // Build prompting structure
    const systemPrompt = `你是一个顶级TRPG游戏模组主脑、硬核剧情策划与AI文游大纲设计师。
你需要一边像亲切、严谨、具有深厚文学功底的AI文游助手一样与用户对话，一边在后台实时汇总其奇思妙想，【实时自动更新】最新的游戏大纲。

当前最新的剧本大纲内容如下（玩家可能已经做了手动修改）：
【当前大纲】：
${liveOutline || "（目前为空，等待策划）"}

【你的核心响应规范】：
1. 你的每一句回复都必须在回复末尾附带包含【最新、完整、结构化】的剧本大纲，并严格用 <script_outline>最新完整大纲</script_outline> 标签包裹起来。
2. 只要有大纲设定相关的增加、删改、优化或推演，请确保在标签包裹的大纲内容中完全更新体现。
3. 即使只是闲聊或提出建议，也请继续把最完整的大纲放在 <script_outline>...</script_outline> 标签中，这能保证下方编辑器保持同步。
4. 标签以外的内容用于与用户直接交流（通常是介绍新创意的亮点、解释修改逻辑或询问下一步的设计方向），语气专业且具有极强启发性。
5. 必须遵守：严禁在标签内输出任何杂乱文本。剧本大纲需使用干净漂亮的 Markdown 语法（包含 # 一级标题, ## 二级标题, - 列表等）。`;

    try {
      // Use configured credentials
      let responseText = '';
      if (apiKey) {
        const cleanBaseUrl = baseUrl.trim().replace(/\/$/, "");
        const targetUrl = `${cleanBaseUrl}/chat/completions`;

        const bodyData = {
          model: selectedModel,
          messages: [
            { role: 'system', content: systemPrompt },
            ...updatedMsgs.slice(-10).map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content
            }))
          ],
          temperature: temperature,
          max_tokens: 4000
        };

        const data = await callOpenAIEndpoint(targetUrl, apiKey, bodyData);
        responseText = data.choices?.[0]?.message?.content || '';
      } else {
        // Fallback: system VITE_GEMINI_API_KEY
        const fallbackApiKey = getFallbackApiKey();
        if (!fallbackApiKey) {
          throw new Error('未检测到有效的 API Key。请打开顶部的“API 快捷设置”填入密钥，或点击“导入系统 API Key”。');
        }

        const ai = new GoogleGenAI({ apiKey: fallbackApiKey });

        const historyContext = updatedMsgs.slice(-10).map(m => `${m.role === 'user' ? '玩家' : '助理'}: ${m.content}`).join('\n');
        const lastUserText = updatedMsgs.filter(m => m.role === 'user').pop()?.content || '';
        const promptWithContext = `${systemPrompt}\n\n当前聊天上下文：\n${historyContext}\n\n请针对玩家最新输入：“${lastUserText}” 给出最新回复和大纲：`;

        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: promptWithContext }] }],
          config: {
            maxOutputTokens: 4000,
            temperature: temperature
          }
        });

        responseText = res.text || '';
      }

      if (!responseText) {
        throw new Error('模型未能返回有效响应');
      }

      // Parse output: extract script_outline
      const outlineMatch = responseText.match(/<script_outline>([\s\S]*?)<\/script_outline>/i);
      let assistantBubbleText = responseText;

      if (outlineMatch) {
        const extracted = outlineMatch[1].trim();
        if (extracted) {
          setLiveOutline(extracted);
        }
        assistantBubbleText = responseText.replace(/<script_outline>([\s\S]*?)<\/script_outline>/i, "").trim();
        if (!assistantBubbleText) {
          assistantBubbleText = "已根据您的反馈更新了下方的剧本大纲！快来看看是否符合您的预期。如果需要微调，请随时告诉我。";
        }
      }

      setMessages(prev => [
        ...prev,
        {
          id: `wb_msg_reply_${Date.now()}`,
          role: 'assistant',
          content: assistantBubbleText,
          timestamp: Date.now()
        }
      ]);

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || '模型响应出错，请检查 API 配置或网络。');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async () => {
    const userText = inputText.trim();
    if (!userText || isGenerating) return;

    setErrorText(null);
    setInputText('');

    const newMsg: WorkbenchMessage = {
      id: `wb_msg_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: Date.now()
    };
    const updatedMsgs = [...messages, newMsg];
    setMessages(updatedMsgs);
    generateAIResponse(updatedMsgs);
  };

  // 7. Clear History Function
  const clearHistory = () => {
    setShowClearHistoryConfirm(true);
  };

  // 8. Custom Drag Resize Splitter Handler
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartHeight.current = editorHeightPercent;
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleDragMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaY = clientY - dragStartY.current;
      
      const containerHeight = 600; 
      const deltaPercent = (deltaY / containerHeight) * 100;
      
      let nextPercent = dragStartHeight.current - deltaPercent;
      
      if (nextPercent < 15) nextPercent = 15;
      if (nextPercent > 85) nextPercent = 85;
      
      setEditorHeightPercent(nextPercent);
    };

    const handleDragEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        document.body.style.userSelect = '';
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  // Quick preset sizes
  const setQuickHeight = (mode: 'collapse' | 'equal' | 'expand') => {
    if (mode === 'collapse') setEditorHeightPercent(15);
    else if (mode === 'equal') setEditorHeightPercent(45);
    else if (mode === 'expand') setEditorHeightPercent(80);
  };

  // 9. High-fidelity Exporter utilities
  const handleExport = (format: 'txt' | 'html' | 'docx') => {
    let title = '未命名文游剧本大纲';
    const firstLine = liveOutline.trim().split('\n')[0];
    if (firstLine.startsWith('#')) {
      title = firstLine.replace(/^#+\s*/, '').trim();
    }

    if (format === 'txt') {
      const blob = new Blob([liveOutline], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === 'html') {
      const formattedHtml = liveOutline
        .split('\n')
        .map(line => {
          const l = line.trim();
          if (l.startsWith('# ')) return `<h1 style="color:#4f46e5;font-size:24px;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin-top:24px;margin-bottom:12px;">${l.substring(2)}</h1>`;
          if (l.startsWith('## ')) return `<h2 style="color:#1e293b;font-size:18px;margin-top:20px;margin-bottom:10px;">${l.substring(3)}</h2>`;
          if (l.startsWith('### ')) return `<h3 style="color:#334155;font-size:15px;margin-top:16px;margin-bottom:8px;">${l.substring(4)}</h3>`;
          if (l.startsWith('- ') || l.startsWith('* ')) return `<li style="margin-left:20px;margin-bottom:6px;color:#475569;">${l.substring(2)}</li>`;
          if (/^\d+\.\s/.test(l)) {
            const index = l.indexOf(' ');
            return `<li style="margin-left:20px;margin-bottom:6px;color:#475569;list-style-type:decimal;">${l.substring(index+1)}</li>`;
          }
          if (!l) return '<div style="height:12px;"></div>';
          return `<p style="color:#475569;line-height:1.6;margin-bottom:8px;">${line}</p>`;
        })
        .join('\n');

      const fullHtmlTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      background-color: #f8fafc;
      color: #1e293b;
      max-width: 800px;
      margin: 40px auto;
      padding: 32px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    }
    .badge {
      display: inline-block;
      background: #e0e7ff;
      color: #4f46e5;
      font-size: 11px;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 16px;
    }
    .footer {
      text-align: center;
      margin-top: 48px;
      font-size: 11px;
      color: #94a3b8;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="badge">AI Studio 文游大纲剧本</div>
  ${formattedHtml}
  <div class="footer">本剧本由 Google AI Studio Build 创意剧本工坊实时编译输出</div>
</body>
</html>`;

      const blob = new Blob([fullHtmlTemplate], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === 'docx') {
      const formattedHtml = liveOutline
        .split('\n')
        .map(line => {
          const l = line.trim();
          if (l.startsWith('# ')) return `<h1 style="color:#4f46e5;font-size:22px;font-family:SimSun;margin-top:18px;margin-bottom:8px;">${l.substring(2)}</h1>`;
          if (l.startsWith('## ')) return `<h2 style="color:#1e293b;font-size:16px;font-family:SimSun;margin-top:14px;margin-bottom:6px;">${l.substring(3)}</h2>`;
          if (l.startsWith('### ')) return `<h3 style="color:#334155;font-size:14px;font-family:SimSun;margin-top:10px;margin-bottom:4px;">${l.substring(4)}</h3>`;
          if (l.startsWith('- ') || l.startsWith('* ')) return `<li style="margin-left:20px;color:#475569;font-family:SimSun;">${l.substring(2)}</li>`;
          if (!l) return '<p></p>';
          return `<p style="color:#475569;font-family:SimSun;line-height:1.5;">${line}</p>`;
        })
        .join('\n');

      const docHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><title>${title}</title><style>body {font-family:SimSun;}</style></head>
<body>${formattedHtml}</body></html>`;

      const blob = new Blob([docHtml], { type: 'application/msword;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleCreateSession = () => {
    const newSessionId = `session_${Date.now()}`;
    const newSession: WorkbenchSession = {
      id: newSessionId,
      title: `新会话 ${sessions.length + 1}`,
      messages: [
        {
          id: `init_msg_${Date.now()}`,
          role: 'assistant',
          content: '你好！我是你的工作台助手，你可以直接在这里与我交流你的世界观想法和玩法规则，我会自动提炼并【实时自动更新】在下方的大纲编辑器中！',
          timestamp: Date.now()
        }
      ],
      liveOutline: '',
      createdAt: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSessionId);
    setShowSidebar(false);
  };

  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) return;
    setDeleteSessionId(id);
  };

  const handleSaveSessionTitle = (id: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, title: trimmed } : s));
    }
    setEditingSessionId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50 relative font-sans select-none text-slate-800">
      
      {/* 1. Quick Config Banner Status Bar */}
      <div className="bg-[#9bc5a6] px-4 py-2.5 flex items-center justify-between shadow-sm z-20 text-white shrink-0">
        <div className="flex items-center space-x-2">
          {onHome && (
            <button
              type="button"
              onClick={onHome}
              className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 border border-white/30 flex items-center justify-center text-white transition-all cursor-pointer active:scale-95 shrink-0 mr-1"
              title="返回手机桌面"
            >
              <Home size={16} className="stroke-[2.5]" />
            </button>
          )}
          <Cpu size={14} className="animate-pulse shrink-0 mx-2" style={{ color: '#ffffff' }} />
          <span className="text-[11px] font-bold">
            工作台助手: <span className="text-white font-bold" style={{ color: '#ffffff' }}>{isGenerating ? '正在梳理设定中...' : '在线灵感源源不断'}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowApiSettings(!showApiSettings)}
          className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-black transition-colors shrink-0 ${
            showApiSettings ? 'bg-amber-400 text-slate-950' : 'bg-white/20 hover:bg-white/30 text-white'
          }`}
        >
          <Settings size={11} />
          <span>API 快捷设置</span>
        </button>
      </div>

      {/* 2. API Config Dropdown Board */}
      <AnimatePresence>
        {showApiSettings && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-[38px] inset-x-0 bg-white border-b border-gray-200 p-4 shadow-xl z-30 space-y-4 text-xs text-slate-700"
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center space-x-1.5 font-black text-slate-800">
                <Wrench size={14} className="text-[#5b7d61]" />
                <span>创作助手 API 独立配置</span>
              </div>
              <button
                type="button"
                onClick={importGlobalApiSettings}
                className="text-[10px] text-[#5b7d61] font-bold hover:underline flex items-center space-x-0.5 cursor-pointer"
                title="导入系统已经配置的 API 设置"
              >
                <span>导入系统 API Key</span>
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Endpoint */}
              <div>
                <label className="text-[10px] text-gray-500 font-bold block mb-1">接口代理端点 (Endpoint)</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-mono text-slate-700"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="text-[10px] text-gray-500 font-bold block mb-1">API 密钥 (API Key)</label>
                <div className="relative">
                  <input
                    type={showApiKeyPreview ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="输入自定义或导入的 API Key"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-3 pr-10 py-2 text-xs focus:outline-none focus:border-indigo-500 font-mono text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyPreview(!showApiKeyPreview)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showApiKeyPreview ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Models selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-bold block mb-1">大语言模型</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-indigo-500 font-sans text-slate-700 font-bold cursor-pointer"
                  >
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="deepseek-chat">DeepSeek Chat (V3)</option>
                    <option value="deepseek-reasoner">DeepSeek R1 (推理)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4o">GPT-4o (OpenAI)</option>
                    <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-gray-500 font-bold block mb-1">发散度: {temperature}</label>
                  <input
                    type="range"
                    min="0.2"
                    max="1.5"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full h-8 cursor-pointer accent-indigo-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowApiSettings(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl text-[11px] cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={saveCustomApiSettings}
                className="flex-1 py-2 text-white font-black rounded-xl text-[11px] shadow-sm cursor-pointer"
                style={{ backgroundColor: '#9bc5a6' }}
              >
                保存配置
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2.5 Unified Top Header Bar */}
      <div className="h-14 bg-white border-b border-slate-200/80 px-4 flex items-center justify-between shrink-0 shadow-xs z-20">
        {/* Left: Sidebar Toggle + Title Info */}
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-[#5b7d61] hover:bg-[#9bc5a6]/10 hover:border-[#9bc5a6]/40 transition-all flex items-center justify-center cursor-pointer shrink-0"
            title={showSidebar ? "隐藏侧栏" : "显示侧栏"}
          >
            <BookOpen size={16} />
          </button>
          
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-black text-slate-800 truncate">
              {activeSession.title}
            </h3>
            <p className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">
              设计会话中 · 独立剧本大纲
            </p>
          </div>
        </div>

        {/* Right: Quick Action to Create New Session */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={handleCreateSession}
            className="px-3 py-1.5 font-black border border-transparent rounded-full text-[10px] flex items-center space-x-1 cursor-pointer transition-colors"
            title="新建工作台设计会话"
            style={{ backgroundColor: '#9bc5a6' }}
          >
            <Plus size={11} className="stroke-[2.5]" style={{ color: '#5b7d61' }} />
            <span style={{ color: '#5b7d61' }}>新建会话</span>
          </button>
        </div>
      </div>

      {/* 3. Horizontal split: Sidebar + Main workspace */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        
        {/* Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-slate-200 bg-white h-full flex flex-col shrink-0 z-30 shadow-sm overflow-hidden"
            >
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">设计会话</span>
                <button
                  type="button"
                  onClick={handleCreateSession}
                  className="p-1 rounded-lg border border-[#9bc5a6]/40 bg-white text-[#5b7d61] hover:bg-[#9bc5a6]/20 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                  title="新建设计会话"
                >
                  <Plus size={12} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/20">
                {sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const isEditingName = editingSessionId === s.id;

                  return (
                    <div
                      key={s.id}
                      className={`group flex flex-col p-2 rounded-xl transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-[#9bc5a6]/15 border-[#9bc5a6]/50 text-[#2d4d34] font-medium shadow-xs'
                          : 'bg-white border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                      onClick={() => {
                        if (!isEditingName) {
                          setActiveSessionId(s.id);
                          setShowSidebar(false);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                          <FileText size={11} className={isActive ? 'text-[#5b7d61]' : 'text-slate-400'} />
                          {isEditingName ? (
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={() => handleSaveSessionTitle(s.id)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveSessionTitle(s.id)}
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] font-bold bg-white border border-[#9bc5a6] rounded px-1.5 py-0.5 focus:outline-none w-full text-slate-800"
                            />
                          ) : (
                            <span className="text-[10px] font-black truncate">{s.title}</span>
                          )}
                        </div>

                        {!isEditingName && (
                          <div className="opacity-0 group-hover:opacity-100 flex items-center space-x-1 shrink-0 ml-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSessionId(s.id);
                                setEditingTitle(s.title);
                              }}
                              className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                              title="重命名"
                            >
                              <Edit size={10} />
                            </button>
                            {sessions.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSession(s.id);
                                }}
                                className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-rose-500 cursor-pointer"
                                title="删除"
                              >
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-[8px] text-slate-400 font-medium mt-1 pl-4.5">
                        {s.messages.length} 条对话 · {s.liveOutline ? s.liveOutline.length : 0} 字
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Workspace Pane */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-white">
          
          {/* 3. Top Section: AI Chat Panel */}
          <div 
            className="flex-1 flex flex-col min-h-0 bg-white"
            style={{ height: `${100 - editorHeightPercent}%` }}
          >
            {/* Chat log wrapper */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/40">
              {messages.map((msg) => (
                <div key={msg.id} className="flex flex-col w-full">
                  <div
                    className={`flex items-start space-x-2.5 ${
                      msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-7.5 h-7.5 rounded-full flex items-center justify-center shrink-0 shadow-sm font-black text-xs relative overflow-hidden ${
                        msg.id === 'init_msg_1'
                          ? ''
                          : msg.role === 'user'
                          ? 'bg-amber-400 text-slate-900 border border-amber-300'
                          : 'bg-[#9bc5a6]/20 text-[#5b7d61] border border-[#9bc5a6]/40'
                      }`}
                      style={msg.id === 'init_msg_1' ? { backgroundColor: '#9bc5a6', color: '#5b7d61' } : undefined}
                    >
                      {msg.role === 'user' ? (
                        (() => {
                          const avatar = getUserAvatar();
                          return avatar !== '🤖' ? (
                            <img src={avatar} alt="Me" className="w-full h-full object-cover" />
                          ) : (
                            '我'
                          );
                        })()
                      ) : 'AI'}
                    </div>

                    {/* Bubble Body */}
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
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm whitespace-pre-line select-none cursor-pointer ${
                        msg.role === 'user' ? 'relative hover:opacity-90' : ''
                      } ${
                        msg.role === 'user'
                          ? 'bg-amber-400 text-slate-950 font-bold rounded-tr-none'
                          : 'bg-white text-slate-700 border border-gray-200/60 rounded-tl-none'
                      }`}
                    >
                      {editingMessageId === msg.id ? (
                        <div className="flex flex-col space-y-2">
                          <textarea
                            autoFocus
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            className="w-full bg-white/90 text-slate-800 rounded-lg p-2 text-xs border-none focus:ring-2 focus:ring-amber-500 min-h-[60px]"
                          />
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingMessageId(null); }}
                              className="px-2 py-1 bg-gray-200/50 rounded-md text-[10px]"
                            >
                              取消
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSaveEditedMessage(msg.id); }}
                              className="px-2 py-1 bg-amber-500 text-white rounded-md text-[10px]"
                            >
                              保存并重算
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
                      
                      {/* Time tag */}
                      <div className="text-[8px] text-right mt-1 opacity-40 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {activeUserMenuId === msg.id && !editingMessageId && (
                    <div className={`flex items-center space-x-2 mt-2 font-bold text-[10px] ${msg.role === 'user' ? 'justify-end pr-10' : 'justify-start pl-10'}`}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg.content); }}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-bold transition-all cursor-pointer shadow-xs"
                      >
                        复制
                      </button>
                      {msg.role === 'user' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditMessage(msg); }}
                          className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 text-indigo-700 font-bold transition-all cursor-pointer shadow-xs"
                        >
                          编辑并重算
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.id); }}
                        className="px-2.5 py-1 bg-red-50 border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-100 transition-all cursor-pointer shadow-xs"
                      >
                        删除
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {isGenerating && (
                <div className="flex items-start space-x-2.5 animate-pulse">
                  <div className="w-7.5 h-7.5 rounded-full bg-[#9bc5a6]/20 text-[#5b7d61] border border-[#9bc5a6]/40 flex items-center justify-center font-black text-xs">
                    AI
                  </div>
                  <div className="bg-white border border-gray-200/60 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-gray-500 space-y-1.5 shadow-sm max-w-[80%]">
                    <div className="flex items-center space-x-2">
                      <Loader2 size={13} className="animate-spin text-[#5b7d61]" />
                      <span className="font-bold text-[10px]">助手正在融合创意、重构大纲中...</span>
                    </div>
                    <div className="h-1 w-24 bg-gray-200 rounded overflow-hidden">
                      <div className="h-full bg-[#9bc5a6] w-1/2 animate-shimmer" style={{ animationDuration: '1.5s' }} />
                    </div>
                  </div>
                </div>
              )}

              {errorText && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-2xl flex items-start space-x-2 text-rose-700 text-[11px] font-medium leading-relaxed shadow-sm">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-500" />
                  <div className="flex-1">
                    <p className="font-bold">接口通信受阻：</p>
                    <p className="text-[10px] mt-0.5 opacity-90">{errorText}</p>
                  </div>
                  <button 
                    onClick={() => setErrorText(null)} 
                    className="text-[9px] font-black underline hover:text-red-900 cursor-pointer uppercase shrink-0"
                  >
                    忽略
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Chat input box */}
            <div className="p-3 border-t border-gray-100 bg-white flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={clearHistory}
                className="p-2 hover:bg-gray-100 text-gray-400 hover:text-rose-500 rounded-xl transition-colors cursor-pointer shrink-0"
                title="清空聊天记录"
              >
                <RefreshCw size={15} />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleSendMessage()}
                placeholder="告诉助理你想对剧本作何设计/修改..."
                disabled={isGenerating}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-gray-400 focus:outline-none focus:border-[#9bc5a6] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={isGenerating || !inputText.trim()}
                className="p-2 rounded-xl text-white shadow disabled:opacity-40 transition-colors cursor-pointer active:scale-95 shrink-0"
                style={{ backgroundColor: '#9bc5a6' }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>

          {/* 4. Draggable resize bar */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            className={`h-4.5 bg-gray-100 border-y border-gray-200 flex items-center justify-between px-3 cursor-row-resize z-20 hover:bg-[#9bc5a6]/10 hover:border-[#9bc5a6]/30 transition-colors select-none shrink-0 ${
              isDragging ? 'bg-[#9bc5a6]/20 border-[#9bc5a6]' : ''
            }`}
          >
            <div className="flex items-center space-x-2">
              <Layers size={11} className="text-gray-400" />
              <span className="text-[9px] font-extrabold text-gray-400 tracking-wider uppercase">上下拖拽调节分栏</span>
            </div>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickHeight('collapse');
                }}
                className="p-0.5 hover:bg-white rounded hover:text-[#5b7d61] text-gray-400 transition-colors"
                title="收起大纲"
              >
                <ChevronUp size={11} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickHeight('equal');
                }}
                className="p-0.5 hover:bg-white rounded hover:text-[#5b7d61] text-gray-400 transition-colors"
                title="居中对齐"
              >
                <Maximize2 size={10} className="stroke-[2.5]" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickHeight('expand');
                }}
                className="p-0.5 hover:bg-white rounded hover:text-[#5b7d61] text-gray-400 transition-colors"
                title="最大化大纲"
              >
                <ChevronDown size={11} />
              </button>
            </div>
          </div>

          {/* 5. Bottom Section: Live Outline Preview & Editor */}
          <div 
            className="bg-white flex flex-col min-h-0 relative shadow-inner"
            style={{ height: `${editorHeightPercent}%` }}
          >
            {/* Editor Title Panel */}
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-gray-200 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2">
                <BookOpen size={13} style={{ color: '#5b7d61' }} />
                <span className="text-[11px] font-black text-slate-800">剧本大纲编辑器</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditingOutline(!isEditingOutline)}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border shadow-xs cursor-pointer ${
                    isEditingOutline
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  <PenTool size={11} className={isEditingOutline ? 'text-emerald-600' : ''} />
                  <span>{isEditingOutline ? '保存/完成' : '编辑大纲'}</span>
                </button>
              </div>
            </div>

            {/* Text Area */}
            <textarea
              value={liveOutline}
              onChange={(e) => setLiveOutline(e.target.value)}
              readOnly={!isEditingOutline}
              placeholder={isEditingOutline ? "在此处手动输入或由 AI 助手实时生成你的剧本大纲..." : "大纲内容为空。请在上方输入你的想法和玩法规则，或点击「编辑大纲」手动编写。"}
              className={`flex-1 p-4 text-[11px] font-mono leading-relaxed transition-colors resize-none overflow-y-auto w-full select-text border-0 focus:outline-none ${
                isEditingOutline 
                  ? 'bg-[#FDFCFA] text-[#1E293B]' 
                  : 'bg-slate-50/50 text-slate-500 cursor-not-allowed select-none'
              }`}
            />

            {/* Exporter Floating Action bar */}
            <div className="p-2.5 bg-slate-50 border-t border-gray-200 flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center space-x-1.5">
                <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest pl-1">快速导出大纲:</span>
              </div>
              <div className="flex space-x-1.5">
                {/* Export HTML */}
                <button
                  type="button"
                  onClick={() => handleExport('html')}
                  className="px-2.5 py-1.5 bg-white border border-gray-200 hover:border-indigo-400 hover:text-indigo-600 text-[10px] font-bold rounded-xl flex items-center space-x-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <Code size={11} />
                  <span>HTML 网页</span>
                </button>

                {/* Export TXT */}
                <button
                  type="button"
                  onClick={() => handleExport('txt')}
                  className="px-2.5 py-1.5 bg-white border border-gray-200 hover:border-amber-400 hover:text-amber-600 text-[10px] font-bold rounded-xl flex items-center space-x-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <FileText size={11} />
                  <span>TXT 纯文本</span>
                </button>

                {/* Export DOCX (Word doc) */}
                <button
                  type="button"
                  onClick={() => handleExport('docx')}
                  className="px-3 py-1.5 text-white font-black text-[10px] rounded-xl flex items-center space-x-1 transition-all active:scale-95 cursor-pointer shadow-md"
                  style={{ backgroundColor: '#9bc5a6' }}
                >
                  <Download size={11} />
                  <span>Word 格式 (.doc)</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Clear History Confirmation Modal */}
      {showClearHistoryConfirm && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">确认清除历史对话</h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要清除当前的创作对话历史吗？（下方的剧本大纲不会被清除）</p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setShowClearHistoryConfirm(false)}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessages([
                    {
                      id: 'init_msg_1',
                      role: 'assistant',
                      content: '你好！我是你的工作台助手，你可以直接在这里与我交流你的世界观想法和玩法规则，我会自动提炼并【实时自动更新】在下方的大纲编辑器中！',
                      timestamp: Date.now()
                    }
                  ]);
                  setErrorText(null);
                  setShowClearHistoryConfirm(false);
                }}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                确认清除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Session Confirmation Modal */}
      {deleteSessionId && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除设计会话</h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要删除这个设计会话吗？（对话历史和关联大纲都将丢失）</p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteSessionId(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const updated = sessions.filter(s => s.id !== deleteSessionId);
                  setSessions(updated);
                  if (activeSessionId === deleteSessionId) {
                    setActiveSessionId(updated[0].id);
                  }
                  setDeleteSessionId(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
