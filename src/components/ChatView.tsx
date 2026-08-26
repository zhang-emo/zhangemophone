import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Search, 
  Calendar, 
  RefreshCw, 
  Smile, 
  ChevronDown, 
  Paperclip,
  Heart,
  MessageSquare,
  User,
  Bot,
  Plus,
  Compass,
  X,
  FileText,
  Clock,
  Sparkles,
  Loader2,
  Home,
  ArrowLeft,
  ChevronLeft,
  Users,
  Trash,
  Menu,
  Check,
  UserPlus,
  Copy,
  CornerUpLeft,
  Undo2,
  Camera,
  CheckSquare,
  Trash2,
  Square,
  LogOut,
  UserMinus,
  Phone,
  Image,
  Coins,
  Brain,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Maximize2,
  Minimize2,
  PhoneOff,
  Edit,
  Edit3,
  ChevronRight,
  MessageSquareQuote,
  BellRing,
  Shirt
} from 'lucide-react';
import { dbInstance } from '../lib/db';
import { ChatSession, ChatMessage, MomentPost, MomentComment, LocalImage } from '../lib/types';
import { generateAiReply, generateGroupMemberReply, generateAiMomentComment, generateAiCommentReply, getSystemMemoryPrompt, cleanBackgroundText, generateCharacterMemoryAppSummary, callOpenAIEndpoint } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';

// Modular child components
import UserProfilePanel, { THEME_PRESETS } from './UserProfilePanel';
import { 
  ChatTheme, 
  CHAT_THEME_PRESETS, 
  generateChatCssFromTheme, 
  generateChatThemeFromHex 
} from '../lib/chatThemePresets';
import AddContactModal from './AddContactModal';
import ContactDetailModal from './ContactDetailModal';
import { ErrorBoundary } from './ErrorBoundary';
import GroupChatModal from './GroupChatModal';
import PublishMomentModal from './PublishMomentModal';
import { LongTermMemoryModal } from './LongTermMemoryModal';
import { NarrationModeModal } from './NarrationModeModal';
import { ProactiveMessagingModal } from './ProactiveMessagingModal';
import { OfflineScenarioModal } from './OfflineScenarioModal';
import ImagePickerModal from './ImagePickerModal';
import { OfflineChatWindow } from './OfflineChatWindow';

// Preset default simulated characters
const PRESET_CHARACTERS: any[] = [];

// Preset random Moments (朋友圈 posts) to seed the database
const PRESET_MOMENTS: any[] = [];

// Helper to format character and sender display name to strip parentheses containing real name
const formatDisplayName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*[\(\（].*?[\)\）]/g, '').trim();
};

const fuzzyMatch = (text: string, query: string): boolean => {
  const cleanText = text.toLowerCase();
  const cleanQuery = query.toLowerCase().trim();
  if (!cleanQuery) return true;
  
  // 1. Try multi-term search (split by spaces)
  const terms = cleanQuery.split(/\s+/);
  const allTermsMatch = terms.every(term => cleanText.includes(term));
  if (allTermsMatch) return true;
  
  // 2. Sequence/subsequence match (character by character in order)
  let queryIdx = 0;
  for (let i = 0; i < cleanText.length; i++) {
    if (cleanText[i] === cleanQuery[queryIdx]) {
      queryIdx++;
      if (queryIdx === cleanQuery.length) return true;
    }
  }
  
  return false;
};

export default function ChatView({ onHome }: { onHome?: () => void }) {
  // WeChat main Navigation tab state
  const [currentTab, setCurrentTab] = useState<'chats' | 'contacts' | 'moments' | 'me'>('chats');

  const [customThemeCss, setCustomThemeCss] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('wechat_app_theme');
      if (savedTheme) {
        return generateChatCssFromTheme(JSON.parse(savedTheme));
      }
    } catch (e) {}
    const preset = localStorage.getItem('wechat_custom_theme_preset') as string | null;
    if (preset === 'blue') return generateChatCssFromTheme(CHAT_THEME_PRESETS[1]);
    if (preset === 'green') return generateChatCssFromTheme(CHAT_THEME_PRESETS[2]);
    return localStorage.getItem('wechat_custom_theme_css') || generateChatCssFromTheme(CHAT_THEME_PRESETS[0]);
  });

  // --- STATES FOR EXTRA FUNCTION PANEL ---
  const [showExtraPanel, setShowExtraPanel] = useState(false);
  const [callState, setCallState] = useState<'idle' | 'dialing' | 'connected'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isCallSpeakerOn, setIsCallSpeakerOn] = useState(true);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransferMsg, setSelectedTransferMsg] = useState<ChatMessage | null>(null);
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [showNarrationModal, setShowNarrationModal] = useState(false);
  const [showProactiveModal, setShowProactiveModal] = useState(false);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [showOfflineChatWindow, setShowOfflineChatWindow] = useState(false);
  const lastUserActionRef = useRef<number>(Date.now());

  // Helper to resolve active chatId for online chat mode
  const getActiveChatId = (session: ChatSession | null) => {
    if (!session) return '';
    return session.id;
  };
  const [customMemoryText, setCustomMemoryText] = useState('');
  const [floatingPos, setFloatingPos] = useState({ x: 20, y: 120 });

  useEffect(() => {
    const handleThemeChange = () => {
      try {
        const savedTheme = localStorage.getItem('wechat_app_theme');
        if (savedTheme) {
          setCustomThemeCss(generateChatCssFromTheme(JSON.parse(savedTheme)));
          return;
        }
      } catch (e) {}
      const savedCss = localStorage.getItem('wechat_custom_theme_css');
      if (savedCss) {
        setCustomThemeCss(savedCss);
      } else {
        setCustomThemeCss(generateChatCssFromTheme(CHAT_THEME_PRESETS[0]));
      }
    };
    window.addEventListener('theme-changed', handleThemeChange);
    return () => {
      window.removeEventListener('theme-changed', handleThemeChange);
    };
  }, []);

  // --- VOICE CALL TIMER & DIAL TRANSITION EFFECTS ---
  useEffect(() => {
    let dialTimeout: any = null;
    if (callState === 'dialing') {
      dialTimeout = setTimeout(() => {
        setCallState('connected');
        setCallDuration(0);
      }, 2500);
    }
    return () => {
      if (dialTimeout) clearTimeout(dialTimeout);
    };
  }, [callState]);

  useEffect(() => {
    let interval: any = null;
    if (callState === 'connected') {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Modern PointerEvents drag handlers for floating voice call window
  const [isDraggingCall, setIsDraggingCall] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 20, y: 120 });
  const longPressTimerRef = useRef<any>(null);
  const canDragRef = useRef(false);
  const hasMovedRef = useRef(false);
  const pressStartTimeRef = useRef(0);

  const handleCallPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only drag with left click / primary touch
    
    // Reset drag and long press tracking flags
    canDragRef.current = false;
    hasMovedRef.current = false;
    setIsLongPressed(false);
    pressStartTimeRef.current = Date.now();

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...floatingPos };

    // Set 1-second long press timer
    longPressTimerRef.current = setTimeout(() => {
      canDragRef.current = true;
      setIsLongPressed(true);
    }, 1000);

    setIsDraggingCall(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCallPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCall) return;

    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const distance = Math.hypot(dx, dy);

    // Cancel long press timer if the pointer moves too much (>8px) before the 1s threshold
    if (!canDragRef.current && distance > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Dragging is only allowed once the 1s long-press is established
    if (canDragRef.current) {
      const parent = e.currentTarget.parentElement;
      const parentWidth = parent ? parent.clientWidth : 360;
      const parentHeight = parent ? parent.clientHeight : 720;
      const newX = Math.max(10, Math.min(parentWidth - 120, posStartRef.current.x + dx));
      const newY = Math.max(10, Math.min(parentHeight - 160, posStartRef.current.y + dy));
      setFloatingPos({ x: newX, y: newY });
      if (distance > 3) {
        hasMovedRef.current = true;
      }
    }
  };

  const handleCallPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDraggingCall(false);
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const elapsed = Date.now() - pressStartTimeRef.current;
    
    // If released before long-press or didn't drag -> it's a click to maximize!
    if (!canDragRef.current || !hasMovedRef.current) {
      if (elapsed < 1000) {
        setIsCallMinimized(false);
      }
    }

    setIsLongPressed(false);
    canDragRef.current = false;
  };

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [lastMessages, setLastMessages] = useState<Record<string, string>>({});

  // Dynamic user avatar sync state
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('wechat_user_profile');
      if (saved) {
        const p = JSON.parse(saved);
        if (p && p.avatar) return p.avatar;
      }
    } catch (e) {}
    return '🤖';
  });

  useEffect(() => {
    const syncUserProfile = () => {
      try {
        const saved = localStorage.getItem('wechat_user_profile');
        if (saved) {
          const p = JSON.parse(saved);
          if (p && p.avatar) {
            setCurrentUserAvatar(p.avatar);
          }
        }
      } catch (e) {}
    };

    window.addEventListener('user-profile-updated', syncUserProfile);
    window.addEventListener('storage', syncUserProfile);
    return () => {
      window.removeEventListener('user-profile-updated', syncUserProfile);
      window.removeEventListener('storage', syncUserProfile);
    };
  }, []);
  
  // Interactive search & date picker
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const wardrobeInputRef = useRef<HTMLInputElement | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Helper to compress uploaded images to prevent bloated storage
  const compressImage = async (file: File, maxDim = 1200, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } else {
            resolve(e.target?.result as string || '');
          }
        };
        img.onerror = () => resolve(e.target?.result as string || '');
        img.src = e.target?.result as string || '';
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Handle uploading character daily outfit photos to wardrobe
  const handleUploadWardrobePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeSession) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedDataUrl = await compressImage(file, 1200, 0.85);
        if (compressedDataUrl) newPhotos.push(compressedDataUrl);
      }

      const currentWardrobe = activeSession.wardrobe || [];
      const updatedWardrobe = [...currentWardrobe, ...newPhotos];
      const updatedSession: ChatSession = {
        ...activeSession,
        wardrobe: updatedWardrobe,
        updatedAt: Date.now()
      };

      await dbInstance.saveSession(updatedSession);
      setActiveSession(updatedSession);
      setSessions((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
    } catch (err) {
      console.error(err);
      alert('上传穿搭照片失败');
    }
    e.target.value = '';
  };

  // Handle deleting an outfit photo from wardrobe
  const handleDeleteWardrobePhoto = async (index: number) => {
    if (!activeSession) return;
    const currentWardrobe = activeSession.wardrobe || [];
    const updatedWardrobe = currentWardrobe.filter((_, i) => i !== index);
    const updatedSession: ChatSession = {
      ...activeSession,
      wardrobe: updatedWardrobe,
      updatedAt: Date.now()
    };

    try {
      await dbInstance.saveSession(updatedSession);
      setActiveSession(updatedSession);
      setSessions((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
    } catch (err) {
      console.error(err);
      alert('删除穿搭照片失败');
    }
  };

  // Toggle AI time perception setting
  const handleToggleTimePerception = async () => {
    if (!activeSession) return;
    const current = activeSession.timePerceptionEnabled !== false;
    const updatedSession: ChatSession = {
      ...activeSession,
      timePerceptionEnabled: !current,
      updatedAt: Date.now()
    };
    try {
      await dbInstance.saveSession(updatedSession);
      setActiveSession(updatedSession);
      setSessions((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
    } catch (err) {
      console.error(err);
      alert('更新时间感知设置失败');
    }
  };

  // Handle "看看穿搭" button click
  const handleShowOutfit = async () => {
    if (!activeSession || isAiReplying) return;
    const wardrobe = activeSession.wardrobe || [];
    if (wardrobe.length === 0) {
      alert('该角色专属衣柜暂无穿搭照片，请点击右上角「聊天设置」，在「今日穿搭」中上传衣服照片吧！');
      setShowSettingsMenu(true);
      return;
    }

    const pickedOutfit = wardrobe[Math.floor(Math.random() * wardrobe.length)];
    const userMsgId = `user_msg_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      chatId: activeSession.id,
      role: 'user',
      content: '今天穿的什么？发来看看~',
      timestamp: Date.now()
    };

    try {
      await dbInstance.saveMessage(userMsg);
      const updatedSession = {
        ...activeSession,
        isChatHidden: false,
        updatedAt: Date.now()
      };
      await dbInstance.saveSession(updatedSession);
      setMessages((prev) => [...prev, userMsg]);
      setIsAiReplying(true);
      setTypingCharacter({
        name: activeSession.characterName,
        avatar: activeSession.characterAvatar
      });

      const userStickers = localSandboxImages
        .filter((img) => img.name.startsWith('sticker_'))
        .map((img) => img.name);

      const replyText = await generateAiReply(
        activeSession.id,
        userMsg.content,
        [...messages, userMsg],
        getSystemMemoryPrompt(activeSession),
        activeSession.worldBook,
        undefined,
        userStickers,
        {
          longTermMemoryEnabled: activeSession.longTermMemoryEnabled,
          memoryRetentionDays: activeSession.memoryRetentionDays,
          memoryEntries: activeSession.memoryEntries,
          memoryAppSummary: activeSession.memoryAppSummary
        },
        {
          narrationModeEnabled: activeSession.narrationModeEnabled,
          narrationRuleText: activeSession.narrationRuleText
        },
        {
          offlineCustomEnabled: activeSession.offlineCustomEnabled,
          offlineScenarioTitle: activeSession.offlineScenarioTitle,
          offlineScenarioDesc: activeSession.offlineScenarioDesc,
          offlineBehaviorPrompt: activeSession.offlineBehaviorPrompt,
          offlineCharacterRealName: activeSession.realName || activeSession.characterName,
          offlineUserRealName: getUserRealName()
        },
        {
          timePerceptionEnabled: activeSession.timePerceptionEnabled !== false,
          outfitImageUrl: pickedOutfit
        }
      );

      let finalReply = replyText;
      if (!finalReply.includes('[👗 穿搭:') && !finalReply.includes('[👗 今日穿搭:')) {
        finalReply = `[👗 穿搭: ${pickedOutfit}]\n${finalReply}`;
      }

      // Separate outfit tag from text to ensure they are sent in distinct bubbles
      const outfitMatch = finalReply.match(/\[👗\s*(?:穿搭|今日穿搭):\s*[\s\S]+?\]/);
      let textParts: string[] = [];

      if (outfitMatch) {
        const outfitTag = outfitMatch[0];
        const textWithoutOutfit = finalReply.replace(outfitTag, '').trim();
        const otherParts = textWithoutOutfit
          .split(/\r?\n/)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0);

        // Put outfit image bubble first, followed by character's persona comments
        textParts = [outfitTag, ...otherParts];
      } else {
        const isOfflineTheatre = activeSession.id.endsWith('_offline_custom');
        textParts = isOfflineTheatre
          ? [finalReply]
          : finalReply
              .split(/\r?\n/)
              .map((p: string) => p.trim())
              .filter((p: string) => p.length > 0);
      }

      if (textParts.length === 0) {
        textParts.push(finalReply || '...');
      }

      for (let k = 0; k < textParts.length; k++) {
        const assistantMessage: ChatMessage = {
          id: `ai_msg_${Date.now()}_${k}`,
          chatId: activeSession.id,
          role: 'assistant',
          content: textParts[k],
          timestamp: Date.now() + k
        };

        await dbInstance.saveMessage(assistantMessage);
        setMessages((prev) => [...prev, assistantMessage]);

        if (k < textParts.length - 1) {
          await new Promise((r) => setTimeout(r, 450));
        }
      }
    } catch (err: any) {
      console.error(err);
      const fallbackImgMsg: ChatMessage = {
        id: `ai_msg_${Date.now()}_img`,
        chatId: activeSession.id,
        role: 'assistant',
        content: `[👗 穿搭: ${pickedOutfit}]`,
        timestamp: Date.now()
      };
      const fallbackTxtMsg: ChatMessage = {
        id: `ai_msg_${Date.now()}_txt`,
        chatId: activeSession.id,
        role: 'assistant',
        content: '好看吗？',
        timestamp: Date.now() + 1
      };
      await dbInstance.saveMessage(fallbackImgMsg);
      await dbInstance.saveMessage(fallbackTxtMsg);
      setMessages((prev) => [...prev, fallbackImgMsg, fallbackTxtMsg]);
    } finally {
      setIsAiReplying(false);
      setTypingCharacter(null);
      await reloadSessionsAndLastMsgs();
    }
  };

  const handleGroupAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSession) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const updatedSession = { ...activeSession, characterAvatar: dataUrl };
      setActiveSession(updatedSession);
      setSessions((prev) => prev.map((s) => (s.id === updatedSession.id ? updatedSession : s)));
      await dbInstance.saveSession(updatedSession);
    };
    reader.readAsDataURL(file);
  };
  
  // Sandbox Images attachment list
  const [localSandboxImages, setLocalSandboxImages] = useState<LocalImage[]>([]);
  const [showAttachmentDropdown, setShowAttachmentDropdown] = useState(false);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);

  // Moments panel states
  const [moments, setMoments] = useState<MomentPost[]>([]);
  const [isRefreshingMoments, setIsRefreshingMoments] = useState(false);
  const [isMomentStoryGenerating, setIsMomentStoryGenerating] = useState(false);
  const [showPublishMomentModal, setShowPublishMomentModal] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [activeCommentInputId, setActiveCommentInputId] = useState<string | null>(null);
  const isCheckingMomentsRef = useRef(false);

  // AI replying state
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Configuration settings drawer
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [activeMemoryInput, setActiveMemoryInput] = useState('');
  const [activeWorldBookInput, setActiveWorldBookInput] = useState('');

  // Group chat creation and speaking modes
  const [speakerMode, setSpeakerMode] = useState<string>('loop');
  const [typingCharacter, setTypingCharacter] = useState<{ name: string; avatar: string } | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);

  // --- STATE FOR @ MENTIONS POPUP ---
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1);

  // --- STATE FOR INVITING MEMBERS TO EXISTING GROUP CHAT ---
  const [showInviteMembersModal, setShowInviteMembersModal] = useState(false);
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);

  // New Custom Contacts setup modal & detailed popup
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [selectedContactDetail, setSelectedContactDetail] = useState<ChatSession | null>(null);
  const [isEditingSelectedContact, setIsEditingSelectedContact] = useState(false);
  const [initialShowMomentsPage, setInitialShowMomentsPage] = useState<boolean>(false);

  // Comment action popover and editing states for main feed
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

  // --- STATE FOR CHAT IMAGE PICKER & FREE CROPPER ---
  const [pendingChatPickerImages, setPendingChatPickerImages] = useState<string[]>([]);
  const [isChatPickerOpen, setIsChatPickerOpen] = useState<boolean>(false);

  // --- STATE FOR STICKER PANEL (表情包面板) ---
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [stickerPanelTab, setStickerPanelTab] = useState<'emoji' | 'custom'>('emoji');
  const [isStickerRecognitionEnabled, setIsStickerRecognitionEnabled] = useState(true);
  const stickerInputRef = useRef<HTMLInputElement>(null);

  // Custom confirmation modal state for sandboxed iframe
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Message Context Menu & Interaction States
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [activeDeleteStickerName, setActiveDeleteStickerName] = useState<string | null>(null);
  const [replyTargetMessage, setReplyTargetMessage] = useState<ChatMessage | null>(null);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([]);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingChatMessage, setEditingChatMessage] = useState<ChatMessage | null>(null);
  const [editChatMessageText, setEditChatMessageText] = useState('');

  // Long press refs for stickers
  const longPressStickerTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isStickerLongPressRef = useRef<boolean>(false);

  // Long press refs for chat bubbles
  const bubbleLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isBubbleLongPressRef = useRef<boolean>(false);

  // QQ style Contacts sub-tab selection state
  const [contactsSubTab, setContactsSubTab] = useState<'friends' | 'groups'>('friends');

  // Helper to open / unhide a chat session and load it
  const handleSelectSession = async (session: ChatSession) => {
    if (session.isChatHidden) {
      const updated = { ...session, isChatHidden: false };
      try {
        await dbInstance.saveSession(updated);
        await reloadSessionsAndLastMsgs();
        setActiveSession(updated);
      } catch (err) {
        console.error(err);
        setActiveSession(session);
      }
    } else {
      setActiveSession(session);
    }
  };

  // Helper to clear all messages for a session/chat room
  const handleClearAllMessages = async (chatId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '清除所有消息',
      description: '⚠️ 确认要清除此聊天窗口的所有历史消息吗？清除后所有聊天消息将无法恢复。',
      onConfirm: async () => {
        try {
          await dbInstance.clearSessionMessages(chatId);
          if (activeSession?.id === chatId) {
            setMessages([]);
          }
          await reloadSessionsAndLastMsgs();
          setConfirmModal(null);
        } catch (err) {
          console.error(err);
          alert('清除消息失败。');
        }
      }
    });
  };

  // Helper to disband group chat completely
  const handleDisbandGroupChat = (chatId: string, titleOrName: string) => {
    setConfirmModal({
      isOpen: true,
      title: '解散群聊',
      description: `⚠️ 确认要解散并删除群聊 “${titleOrName}” 吗？所有的群消息将被清空，且不可恢复。`,
      onConfirm: async () => {
        try {
          await dbInstance.deleteSession(chatId);
          if (activeSession?.id === chatId) {
            setActiveSession(null);
          }
          await reloadSessionsAndLastMsgs();
          setConfirmModal(null);
          setShowSettingsMenu(false);
        } catch (err) {
          console.error(err);
          alert('解散群聊失败。');
        }
      }
    });
  };

  // Helper to delete contact completely
  const handleDeleteContact = (chatId: string, titleOrName: string) => {
    setConfirmModal({
      isOpen: true,
      title: '删除联系人',
      description: `⚠️ 确认要删除联系人 “${titleOrName}” 吗？删除后此联系人及所有聊天记录将被永久抹除。`,
      onConfirm: async () => {
        try {
          await dbInstance.deleteSession(chatId);
          if (activeSession?.id === chatId) {
            setActiveSession(null);
          }
          await reloadSessionsAndLastMsgs();
          setConfirmModal(null);
          setShowSettingsMenu(false);
        } catch (err) {
          console.error(err);
          alert('删除联系人失败。');
        }
      }
    });
  };

  // Refs
  const messageEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const getParticipantDetails = (participantId: string) => {
    const rawId = participantId.replace('session_', '');
    const found = sessions.find((s) => s.id === `session_${rawId}` || s.id === participantId);
    if (found) {
      return {
        id: rawId,
        name: found.characterName,
        avatar: found.characterAvatar,
        memory: found.memory,
        worldBook: found.worldBook,
        narrationModeEnabled: found.narrationModeEnabled,
        narrationRuleText: found.narrationRuleText
      };
    }
    const preset = PRESET_CHARACTERS.find((p) => p.id === rawId);
    if (preset) {
      return {
        id: rawId,
        name: preset.characterName,
        avatar: preset.characterAvatar,
        memory: preset.memory,
        worldBook: preset.worldBook,
        narrationModeEnabled: preset.narrationModeEnabled,
        narrationRuleText: preset.narrationRuleText
      };
    }
    return {
      id: rawId,
      name: '神秘好友',
      avatar: '🤖',
      memory: '他是群里的特邀人工智能伙伴。',
      worldBook: '',
      narrationModeEnabled: true,
      narrationRuleText: ''
    };
  };

  // Safe load of chats and seed if database is empty
  const reloadSessionsAndLastMsgs = async () => {
    try {
      let loadedSessions = await dbInstance.getAllSessions();
      
      // Seed preset characters if empty and we actually have presets
      if (loadedSessions.length === 0 && PRESET_CHARACTERS.length > 0) {
        const promises = PRESET_CHARACTERS.map(async (char, idx) => {
          const sid = `session_${char.id}`;
          const newSession: ChatSession = {
            id: sid,
            title: char.title,
            characterName: char.characterName,
            characterAvatar: char.characterAvatar,
            memory: char.memory,
            worldBook: char.worldBook,
            createdAt: Date.now() - idx * 100000,
            updatedAt: Date.now() - idx * 100000
          };
          await dbInstance.saveSession(newSession);

          const firstMsg: ChatMessage = {
            id: `seed_msg_${sid}`,
            chatId: sid,
            role: 'assistant',
            content: char.welcomeMessage,
            timestamp: Date.now() - idx * 100000 + 50
          };
          await dbInstance.saveMessage(firstMsg);
          return newSession;
        });

        await Promise.all(promises);
        
        loadedSessions = await dbInstance.getAllSessions();
      }

      setSessions(loadedSessions);

      // Build mapping of last message snippet for preview
      const lastMsgMap: Record<string, string> = {};
      for (const s of loadedSessions) {
        const targetCid = getActiveChatId(s);
        let msgs = await dbInstance.getMessages(targetCid);
        if (msgs.length === 0 && targetCid !== s.id) {
          msgs = await dbInstance.getMessages(s.id);
        }
        if (msgs.length > 0) {
          const lastMsg = msgs[msgs.length - 1];
          let displayTxt = lastMsg.content;
          if (displayTxt.includes('[💸 转账:')) {
            const match = displayTxt.match(/\[💸 转账: (.+?) \|/);
            displayTxt = match ? `[转账] ¥${match[1]}` : '[转账]';
          } else if (displayTxt.includes('[📎 附图:')) {
            displayTxt = '[图片]';
          }
          lastMsgMap[s.id] = displayTxt;
        } else {
          lastMsgMap[s.id] = '';
        }
      }
      setLastMessages(lastMsgMap);

    } catch (err) {
      console.error("Initiating chats failed:", err);
    }
  };

  // Initial Seed and Load
  useEffect(() => {
    async function init() {
      // 1. ACTIVE CLEANUP of old Muzi and Neo presets from previous sessions and moments
      try {
        const existingSessions = await dbInstance.getAllSessions();
        const sessionsToDelete = existingSessions.filter(
          s => s.id === 'session_muzi_botanist' || s.id === 'session_neo_barista' || s.id === 'session_group_all'
        );
        for (const s of sessionsToDelete) {
          await dbInstance.deleteSession(s.id);
          await dbInstance.clearSessionMessages(s.id);
        }

        const existingMoments = await dbInstance.getAllMoments();
        const momentsToDelete = existingMoments.filter(
          m => m.id === 'moment_2' || m.id === 'moment_3' ||
               m.characterName === 'Muzi (木子)' || m.characterName === 'Neo (尼奥)' ||
               m.characterName === 'Muzi' || m.characterName === 'Neo' ||
               m.id.includes('muzi') || m.id.includes('neo')
        );
        for (const m of momentsToDelete) {
          await dbInstance.deleteMoment(m.id);
        }
      } catch (err) {
        console.error("Cleanup of old Muzi/Neo presets failed:", err);
      }

      // 2. Load sessions
      await reloadSessionsAndLastMsgs();

      // Seed moments
      const storedMoments = await dbInstance.getAllMoments();
      if (storedMoments.length === 0 && PRESET_MOMENTS.length > 0) {
        for (const mom of PRESET_MOMENTS) {
          await dbInstance.saveMoment(mom);
        }
        const list = await dbInstance.getAllMoments();
        setMoments(list);
      } else {
        setMoments(storedMoments);
      }

      // Load attachment list
      const sandboxImages = await dbInstance.getAllImages();
      setLocalSandboxImages(sandboxImages);
    }
    init();
  }, []);

  // Update messages log when active chat switches
  useEffect(() => {
    if (activeSession) {
      lastUserActionRef.current = Date.now();
      const targetCid = getActiveChatId(activeSession);
      dbInstance.getMessages(targetCid).then(async (list) => {
        let finalMsgs = list;
        // Fallback: If targetCid is an offline scenario sub-chat with no messages yet, check main session ID
        if (finalMsgs.length === 0 && targetCid !== activeSession.id) {
          const mainMsgs = await dbInstance.getMessages(activeSession.id);
          if (mainMsgs.length > 0) {
            finalMsgs = mainMsgs;
          }
        }
        setMessages(finalMsgs);
        setErrorMessage(null);
        setActiveMemoryInput(activeSession.memory);
        setActiveWorldBookInput(activeSession.worldBook);
        setAttachedImageName(null);
        setSearchQuery('');
        setSearchResults([]);
        setShowSearch(false);
        setActiveSearchIndex(-1);
      });
    }
  }, [activeSession]);

  // Online Proactive Messaging Idle Timer
  useEffect(() => {
    if (!activeSession || !activeSession.onlineProactiveEnabled || isAiReplying) {
      return;
    }

    const timerId = setInterval(async () => {
      if (!activeSession || !activeSession.onlineProactiveEnabled || isAiReplying) return;

      const idleMins = activeSession.onlineIdleMinutes || 10;
      const idleMsThreshold = idleMins * 60 * 1000;
      const elapsed = Date.now() - lastUserActionRef.current;

      if (elapsed >= idleMsThreshold) {
        // Reset timestamp so it won't repeatedly trigger every interval cycle
        lastUserActionRef.current = Date.now();

        setIsAiReplying(true);
        setTypingCharacter({
          name: activeSession.characterName,
          avatar: activeSession.characterAvatar || ''
        });
        try {
          const currentHistory = await dbInstance.getMessages(activeSession.id);
          const prompt = `[系统指令：用户在聊天界面内已停留/不说话超过了 ${idleMins} 分钟。请作为 ${activeSession.characterName}，结合上下文与你们的关系设定，主动向用户打招呼、关心问候或自然引入一个新的有趣话题。]`;

          const userStickers = localSandboxImages
            .filter((img) => img.name.startsWith('sticker_'))
            .map((img) => `/images/${img.name}`);

          const replyText = await generateAiReply(
            activeSession.id,
            prompt,
            currentHistory,
            getSystemMemoryPrompt(activeSession),
            activeSession.worldBook,
            undefined,
            userStickers,
            {
              longTermMemoryEnabled: activeSession.longTermMemoryEnabled,
              memoryRetentionDays: activeSession.memoryRetentionDays,
              memoryEntries: activeSession.memoryEntries
            },
            {
              narrationModeEnabled: activeSession.narrationModeEnabled,
              narrationRuleText: activeSession.narrationRuleText
            }
          );

          if (replyText) {
            const aiMsg: ChatMessage = {
              id: `ai_online_proactive_${Date.now()}`,
              chatId: activeSession.id,
              role: 'assistant',
              content: replyText,
              timestamp: Date.now()
            };
            await dbInstance.saveMessage(aiMsg);
            setMessages((prev) => [...prev, aiMsg]);
            await reloadSessionsAndLastMsgs();
          }
        } catch (err) {
          console.warn('Online proactive message generation error:', err.message || err);
        } finally {
          setIsAiReplying(false);
          setTypingCharacter(null);
        }
      }
    }, 10000); // Check idle status every 10 seconds

    return () => clearInterval(timerId);
  }, [activeSession, isAiReplying, localSandboxImages]);

  // Background AFK Proactive Call Timer
  useEffect(() => {
    const bgTimerId = setInterval(async () => {
      const bgSessions = sessions.filter((s) => s.backgroundProactiveEnabled);
      if (bgSessions.length === 0) return;

      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      for (const s of bgSessions) {
        const start = s.backgroundActiveTimeStart || '08:00';
        const end = s.backgroundActiveTimeEnd || '22:00';

        // Range check
        const isInRange = currentHHMM >= start && currentHHMM <= end;
        if (!isInRange) continue;

        const key = `bg_proactive_last_${s.id}`;
        const lastTime = parseInt(localStorage.getItem(key) || '0', 10);

        let freqMs = 60 * 60 * 1000; // default medium: 1 hour
        if (s.backgroundFrequency === 'high') freqMs = 20 * 60 * 1000; // high: ~20 mins
        else if (s.backgroundFrequency === 'low') freqMs = 6 * 60 * 60 * 1000; // low: 6 hours

        if (Date.now() - lastTime >= freqMs) {
          localStorage.setItem(key, Date.now().toString());

          try {
            const currentHistory = await dbInstance.getMessages(s.id);
            const prompt = `[系统指令：后台挂机主动呼叫。当前时间是 ${currentHHMM}。用户目前处于离线挂机状态。请作为 ${s.characterName}，根据你的性格、关系态度及当前时刻，在后台主动给用户发一条温馨留言、分享日常或推送关心推文。]`;

            const userStickers = localSandboxImages
              .filter((img) => img.name.startsWith('sticker_'))
              .map((img) => `/images/${img.name}`);

            const replyText = await generateAiReply(
              s.id,
              prompt,
              currentHistory,
              getSystemMemoryPrompt(s),
              s.worldBook,
              undefined,
              userStickers,
              {
                longTermMemoryEnabled: s.longTermMemoryEnabled,
                memoryRetentionDays: s.memoryRetentionDays,
                memoryEntries: s.memoryEntries
              },
              {
                narrationModeEnabled: s.narrationModeEnabled,
                narrationRuleText: s.narrationRuleText
              }
            );

            if (replyText) {
              const bgMsg: ChatMessage = {
                id: `ai_bg_proactive_${Date.now()}`,
                chatId: s.id,
                role: 'assistant',
                content: replyText,
                timestamp: Date.now()
              };
              await dbInstance.saveMessage(bgMsg);

              if (activeSession && activeSession.id === s.id) {
                setMessages((prev) => [...prev, bgMsg]);
              }
              await reloadSessionsAndLastMsgs();
            }
          } catch (e) {
            console.warn('Background proactive call generation error:', e.message || e);
          }
        }
      }
    }, 20000); // Check background timer every 20 seconds

    return () => clearInterval(bgTimerId);
  }, [sessions, activeSession, localSandboxImages]);

  // Listen to wallet changes to sync active session messages
  useEffect(() => {
    const handleWalletUpdated = () => {
      if (activeSession) {
        dbInstance.getMessages(activeSession.id).then((list) => {
          setMessages(list);
        });
      }
    };
    window.addEventListener('wallet-updated', handleWalletUpdated);
    return () => {
      window.removeEventListener('wallet-updated', handleWalletUpdated);
    };
  }, [activeSession]);

  // Scroll viewport down on message logs growth
  useEffect(() => {
    setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 120);
  }, [messages, isAiReplying]);

  const handleRefreshImages = async () => {
    const list = await dbInstance.getAllImages();
    setLocalSandboxImages(list);
  };

  // Handles adding newly defined AI Character Custom Contact
  const handleAddCharacterSave = async (char: {
    nickname: string;
    realName: string;
    gender: string;
    background: string;
    userImpression?: string;
    patience: number;
    relationship: string;
    avatar: string;
  }) => {
    const sid = `session_custom_${Date.now()}`;
    const titleStr = `${char.relationship} - ${char.realName}`;
    const worldPrompt = `身处于温馨真实的日常现实场景中。你与用户的关系是 ${char.relationship}。`;
    
    const newSession: ChatSession = {
      id: sid,
      title: titleStr,
      characterName: char.nickname,
      characterAvatar: char.avatar,
      memory: char.background.trim(),
      worldBook: worldPrompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      realName: char.realName,
      gender: char.gender,
      patience: char.patience,
      relationship: char.relationship,
      userImpression: char.userImpression?.trim() || ''
    };

    try {
      await dbInstance.saveSession(newSession);
      
      await reloadSessionsAndLastMsgs();
      setShowAddContactModal(false);
      setActiveSession(newSession);
    } catch (e) {
      alert('保存角色设定遭遇本地 IndexedDB 异常。');
    }
  };

  // Handle Creating Multi-member AI Group chat
  const handleGroupChatSave = async (group: {
    title: string;
    avatar: string;
    participants: string[];
    worldBook: string;
  }) => {
    console.log('[ChatView] handleGroupChatSave triggered. Input group data:', group);
    const gid = `session_group_${Date.now()}`;
    const groupTitleStr = `${group.title}`;
    
    // Resolve participant information with safe fallbacks and diagnostic logs
    const resolvedParticipants = group.participants.map(id => {
      const details = getParticipantDetails(id);
      console.log(`[ChatView] Resolved participant detail for id="${id}":`, details);
      return details;
    });

    const customMem = `这是一个由: ${resolvedParticipants.map(det => det.name).join('、')} 组成的日常联动群聊。`;

    const newGroupSession: ChatSession = {
      id: gid,
      title: groupTitleStr,
      characterName: resolvedParticipants.map(det => det.name.split(' ')[0]).join('/'),
      characterAvatar: group.avatar,
      isGroup: true,
      participants: group.participants,
      memory: customMem,
      worldBook: group.worldBook || '身处于温暖舒心的异地日常交流空间中。',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    console.log('[ChatView] Constructing new group session object:', newGroupSession);

    try {
      // Step 1: Save group session to database
      console.log('[ChatView] Step 1: Saving group session to IndexedDB...');
      await dbInstance.saveSession(newGroupSession);
      console.log('[ChatView] Step 1 Success: Group session successfully persisted.');

      // Step 2: Create and save system welcome message
      const welcomeNotif: ChatMessage = {
        id: `sys_notif_${Date.now()}`,
        chatId: gid,
        role: 'system',
        content: `[群聊 "${group.title}" 创建成功！已邀请: ${resolvedParticipants.map(det => formatDisplayName(det.name)).join(', ')} 入群。]`,
        timestamp: Date.now()
      };
      console.log('[ChatView] Step 2: Saving system welcome notification:', welcomeNotif);
      await dbInstance.saveMessage(welcomeNotif);
      console.log('[ChatView] Step 2 Success: Welcome message persisted.');

      // Step 3: Refresh list of chats and sync UI state
      console.log('[ChatView] Step 3: Reloading all chat sessions and updating list...');
      await reloadSessionsAndLastMsgs();
      console.log('[ChatView] Step 3 Success: Sessions and last messages map fully refreshed.');

      // Step 5: Switch active view to the new chatroom
      console.log('[ChatView] Step 5: Switching active session to the newly created group chat:', newGroupSession);
      setActiveSession(newGroupSession);
      setSpeakerMode('loop');
      setShowCreateGroupModal(false);
      setCurrentTab('chats');
      console.log('[ChatView] Group chat initiation completely finished and UI synchronized.');
    } catch (e) {
      console.error('[ChatView] Critical Error during handleGroupChatSave:', e);
      alert('创建群聊遭遇异常，请查看开发者控制台获取更多详细日志。');
    }
  };

  // Handle typing inside message input to detect @ mentions
  const handleInputChange = (val: string) => {
    setNewMessage(val);
    if (!activeSession || !activeSession.isGroup) {
      setShowMentionPopup(false);
      return;
    }
    
    const lastAtIdx = val.lastIndexOf('@');
    if (lastAtIdx !== -1) {
      const afterAt = val.slice(lastAtIdx + 1);
      // If there is no space after the last '@', we show mention popup
      if (!afterAt.includes(' ')) {
        setShowMentionPopup(true);
        setMentionSearchQuery(afterAt);
        setMentionIndex(lastAtIdx);
      } else {
        setShowMentionPopup(false);
      }
    } else {
      setShowMentionPopup(false);
    }
  };

  // Replace text when selecting group member from @ popup
  const handleSelectMention = (name: string) => {
    if (mentionIndex !== -1) {
      const beforeAt = newMessage.slice(0, mentionIndex);
      const afterAt = newMessage.slice(mentionIndex + mentionSearchQuery.length + 1);
      const cleanName = formatDisplayName(name);
      setNewMessage(`${beforeAt}@${cleanName} ${afterAt}`);
    }
    setShowMentionPopup(false);
  };

  // Handle inviting new members to an existing group chat
  const handleInviteMembers = async (selectedIds: string[]) => {
    if (!activeSession) return;
    console.log('[ChatView] handleInviteMembers triggered. Selected IDs to invite:', selectedIds);
    
    // 1. Rebuild the list of participants (keep existing, add new ones)
    const newParticipantsRaw = [...(activeSession.participants || [])];
    selectedIds.forEach(id => {
      const rawId = id.replace('session_', '');
      if (!newParticipantsRaw.includes(rawId)) {
        newParticipantsRaw.push(rawId);
      }
    });

    // 2. Resolve participant details for all of them
    const allResolved = newParticipantsRaw.map(id => getParticipantDetails(id));
    const newlyAdded = selectedIds.map(id => getParticipantDetails(id));

    const customMem = `这是一个由: ${allResolved.map(det => det.name).join('、')} 组成的日常联动群聊。`;

    const updatedSession: ChatSession = {
      ...activeSession,
      participants: newParticipantsRaw,
      characterName: allResolved.map(det => det.name.split(' ')[0]).join('/'),
      memory: customMem,
      updatedAt: Date.now()
    };

    try {
      console.log('[ChatView] Saving updated group session to IndexedDB...', updatedSession);
      await dbInstance.saveSession(updatedSession);

      // Step 2: Save system notification
      const inviteeNames = newlyAdded.map(det => formatDisplayName(det.name)).join('、');
      const welcomeNotif: ChatMessage = {
        id: `sys_notif_invite_${Date.now()}`,
        chatId: activeSession.id,
        role: 'system',
        content: `[已成功邀请: ${inviteeNames} 加入群聊。]`,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(welcomeNotif);

      // Step 3: Refresh list of chats and sync UI state
      await reloadSessionsAndLastMsgs();
      setActiveSession(updatedSession);
      setShowInviteMembersModal(false);
      
      // Update local messages state immediately so user sees the welcome messages
      const updatedMessages = await dbInstance.getMessages(activeSession.id);
      setMessages(updatedMessages);

      console.log('[ChatView] Group chat invitation successfully processed and synced.');
    } catch (e) {
      console.error('[ChatView] Error inviting members:', e);
      alert('添加成员遭遇异常。');
    }
  };

  // Message interactions helpers
  const handleCopyMessage = (msg: ChatMessage) => {
    let cleanContent = msg.content;
    const regex = /\[📎 附图: \/images\/(.+?)\]/;
    cleanContent = cleanContent.replace(regex, '').trim();
    
    navigator.clipboard.writeText(cleanContent);
    setCopiedMessageId(msg.id);
    setActiveMenuMessageId(null);
    setTimeout(() => {
      setCopiedMessageId(null);
    }, 1500);
  };

  const handleReplyMessage = (msg: ChatMessage) => {
    setReplyTargetMessage(msg);
    setActiveMenuMessageId(null);
  };

  const handleRecallMessage = async (msg: ChatMessage) => {
    setActiveMenuMessageId(null);
    const updatedMsg: ChatMessage = {
      ...msg,
      isRecalled: true,
    };
    try {
      await dbInstance.saveMessage(updatedMsg);
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? updatedMsg : m)));
      await reloadSessionsAndLastMsgs();
    } catch (err) {
      console.error('Failed to recall message:', err);
    }
  };

  const handleDeleteMessage = async (msg: ChatMessage) => {
    setActiveMenuMessageId(null);
    setConfirmModal({
      isOpen: true,
      title: '删除消息',
      description: '⚠️ 确认要删除这条消息吗？该操作不可撤销。',
      onConfirm: async () => {
        try {
          await dbInstance.deleteMessage(msg.id);
          setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          await reloadSessionsAndLastMsgs();
          setConfirmModal(null);
        } catch (err) {
          console.error('Failed to delete message:', err);
        }
      }
    });
  };

  const getUserRealName = (): string => {
    try {
      const saved = localStorage.getItem('wechat_user_profile');
      if (saved) {
        const p = JSON.parse(saved);
        if (p && p.realName && p.realName.trim() && p.realName !== '未填写' && p.realName !== '你') {
          return p.realName.trim();
        }
        if (p && p.userId && p.userId.trim() && p.userId !== 'User_Real') {
          return p.userId.trim();
        }
      }
    } catch (e) {}
    return '用户';
  };

  const handleStartEditMessage = (msg: ChatMessage) => {
    setActiveMenuMessageId(null);
    setEditingChatMessage(msg);
    setEditChatMessageText(msg.content);
  };

  const handleSaveEditMessage = async () => {
    if (!editingChatMessage) return;
    const newText = editChatMessageText.trim();
    if (!newText) return;

    const updatedMsg: ChatMessage = {
      ...editingChatMessage,
      content: newText
    };

    try {
      await dbInstance.saveMessage(updatedMsg);
      setMessages((prev) => prev.map((m) => (m.id === editingChatMessage.id ? updatedMsg : m)));
      setEditingChatMessage(null);
      await reloadSessionsAndLastMsgs();
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const toggleMessageSelection = (msgId: string) => {
    setSelectedMessageIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

  const handleMultiDelete = async () => {
    if (selectedMessageIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: '确认删除选中消息',
      description: `确定要删除这 ${selectedMessageIds.length} 条消息吗？该操作不可撤销。`,
      onConfirm: async () => {
        try {
          await dbInstance.deleteMessages(selectedMessageIds);
          setMessages((prev) => prev.filter((m) => !selectedMessageIds.includes(m.id)));
          setIsMultiSelectMode(false);
          setSelectedMessageIds([]);
          setConfirmModal(null);
          await reloadSessionsAndLastMsgs();
        } catch (err) {
          console.error('Failed to batch delete messages:', err);
        }
      }
    });
  };

  const handleMultiCopy = () => {
    if (selectedMessageIds.length === 0) return;
    
    const sortedSelected = messages.filter((m) => selectedMessageIds.includes(m.id));
    
    const blockText = sortedSelected
      .map((m) => {
        const isUser = m.role === 'user';
        const sender = isUser ? '我' : (m.senderName || activeSession?.characterName || 'AI');
        const timeStr = new Date(m.timestamp).toLocaleString();
        let cleanText = m.content;
        const regex = /\[📎 附图: \/images\/(.+?)\]/;
        cleanText = cleanText.replace(regex, '').trim();
        return `[${timeStr}] ${sender}: ${cleanText}`;
      })
      .join('\n');

    navigator.clipboard.writeText(blockText);
    alert(`已合并复制这 ${selectedMessageIds.length} 条消息到剪贴板！`);
    setIsMultiSelectMode(false);
    setSelectedMessageIds([]);
  };

  // Long press event handlers for Stickers
  const handleStickerTouchStart = (imgName: string) => {
    isStickerLongPressRef.current = false;
    if (longPressStickerTimerRef.current) clearTimeout(longPressStickerTimerRef.current);
    longPressStickerTimerRef.current = setTimeout(() => {
      isStickerLongPressRef.current = true;
      setActiveDeleteStickerName(imgName);
      try { navigator.vibrate?.(30); } catch (_) {}
    }, 450);
  };

  const handleStickerTouchEnd = () => {
    if (longPressStickerTimerRef.current) {
      clearTimeout(longPressStickerTimerRef.current);
      longPressStickerTimerRef.current = null;
    }
  };

  const handleStickerClick = (imgName: string) => {
    if (isStickerLongPressRef.current) {
      isStickerLongPressRef.current = false;
      return;
    }
    if (activeDeleteStickerName === imgName) {
      setActiveDeleteStickerName(null);
      return;
    }
    handleSendSticker(imgName);
  };

  const handleStickerContextMenu = (e: React.MouseEvent, imgName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDeleteStickerName(imgName);
  };

  // Long press event handlers for Chat Bubbles
  const handleBubbleTouchStart = (msg: ChatMessage) => {
    isBubbleLongPressRef.current = false;
    if (bubbleLongPressTimerRef.current) clearTimeout(bubbleLongPressTimerRef.current);
    bubbleLongPressTimerRef.current = setTimeout(() => {
      isBubbleLongPressRef.current = true;
      setActiveMenuMessageId(msg.id);
      try { navigator.vibrate?.(30); } catch (_) {}
    }, 450);
  };

  const handleBubbleTouchEnd = () => {
    if (bubbleLongPressTimerRef.current) {
      clearTimeout(bubbleLongPressTimerRef.current);
      bubbleLongPressTimerRef.current = null;
    }
  };

  const handleBubbleClick = (msg: ChatMessage, e: React.MouseEvent) => {
    if (isMultiSelectMode) {
      e.stopPropagation();
      toggleMessageSelection(msg.id);
      return;
    }
    
    if (isBubbleLongPressRef.current) {
      e.stopPropagation();
      isBubbleLongPressRef.current = false;
      return;
    }

    e.stopPropagation();
    if (activeMenuMessageId === msg.id) {
      setActiveMenuMessageId(null);
    }
  };

  const handleBubbleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuMessageId(msg.id);
  };

  // --- CHAT AI TRIGGER AND HELPER HANDLERS ---
  const triggerAiResponseForLatestMessages = async (latestUserMessage: ChatMessage, contentToSave: string) => {
    if (!activeSession) return;
    const targetChatId = getActiveChatId(activeSession);
    
    // Check if user message is a transfer
    const isUserTransfer = contentToSave.includes('[💸 转账:');
    if (isUserTransfer) {
      const transferRegex = /\[💸 转账: (.+?) \| 备注: (.+?) \| 状态: 待领取\]/;
      const match = contentToSave.match(transferRegex);
      if (match) {
        const amountStr = match[1];
        const noteStr = match[2];
        
        setTimeout(async () => {
          const currentMsgs = await dbInstance.getMessages(targetChatId);
          const transferMsg = currentMsgs.find(m => m.content.includes('[💸 转账:') && m.content.includes('状态: 待领取'));
          if (transferMsg) {
            const updatedContent = `[💸 转账: ${amountStr} | 备注: ${noteStr} | 状态: 已领取]`;
            const updatedMsg = { ...transferMsg, content: updatedContent };
            await dbInstance.saveMessage(updatedMsg);
            setMessages(prev => prev.map(m => m.id === transferMsg.id ? updatedMsg : m));

            const claimerName = activeSession.isGroup ? '群成员' : activeSession.characterName;
            const sysMsg: ChatMessage = {
              id: `sys_claim_${Date.now()}`,
              chatId: targetChatId,
              role: 'system',
              content: `"${claimerName}" 已领取了你的转账。`,
              timestamp: Date.now()
            };
            await dbInstance.saveMessage(sysMsg);
            setMessages(prev => [...prev, sysMsg]);
          }
        }, 1500);
      }
    }

    try {
      if (activeSession.isGroup) {
        const activeParticipants = activeSession.participants || [];
        let queue: string[] = [];
        
        if (speakerMode === 'loop') {
          queue = [...activeParticipants];
        } else if (speakerMode === 'random') {
          const count = Math.ceil(activeParticipants.length / 3);
          const shuffled = [...activeParticipants].sort(() => 0.5 - Math.random());
          queue = shuffled.slice(0, count);
        } else {
          queue = [speakerMode];
        }

        for (let i = 0; i < queue.length; i++) {
          const charId = queue[i];
          const charDetails = getParticipantDetails(charId);
          
          setTypingCharacter({
            name: charDetails.name,
            avatar: charDetails.avatar
          });

          const currentHistory = await dbInstance.getMessages(targetChatId);
          const allGroupAis = activeParticipants.map(id => {
            const detail = getParticipantDetails(id);
            return { id: detail.id, name: detail.name, avatar: detail.avatar };
          });

          const userStickers = localSandboxImages
            .filter(img => img.name.startsWith('sticker_'))
            .map(img => img.name);

          // Customize reply context if it's a transfer
          let finalWorldBook = charDetails.worldBook || activeSession.worldBook;
          if (isUserTransfer) {
            finalWorldBook += ` \n[系统提示: 你刚刚领取了对方发来的巨额转账红包，请在接下来的发言中向对方表示极大的感谢。]`;
          }

          const replyText = await generateGroupMemberReply(
            targetChatId,
            charDetails.id,
            charDetails.name,
            getSystemMemoryPrompt(charDetails),
            finalWorldBook,
            currentHistory,
            allGroupAis,
            undefined,
            userStickers,
            {
              narrationModeEnabled: charDetails.narrationModeEnabled ?? activeSession.narrationModeEnabled,
              narrationRuleText: charDetails.narrationRuleText || activeSession.narrationRuleText
            }
          );

          const textParts = replyText
            .split(/\r?\n/)
            .map((p: string) => p.trim())
            .filter((p: string) => p.length > 0);

          if (textParts.length === 0) {
            textParts.push(replyText || '...');
          }

          for (let k = 0; k < textParts.length; k++) {
            const assistantMessage: ChatMessage = {
              id: `ai_msg_g_${Date.now()}_${i}_${k}`,
              chatId: targetChatId,
              role: 'assistant',
              senderName: charDetails.name,
              senderAvatar: charDetails.avatar,
              content: textParts[k],
              timestamp: Date.now() + k
            };

            await dbInstance.saveMessage(assistantMessage);
            setMessages((prev) => [...prev, assistantMessage]);

            if (k < textParts.length - 1) {
              await new Promise((r) => setTimeout(r, 450));
            }
          }

          if (i < queue.length - 1) {
            setTypingCharacter(null);
            await new Promise((r) => setTimeout(r, 650));
          }
        }
      } else {
        // SINGLE CHAT AI REPLY
        setIsAiReplying(true);
        setTypingCharacter({
          name: activeSession.characterName,
          avatar: activeSession.characterAvatar
        });

        const userStickers = localSandboxImages
          .filter(img => img.name.startsWith('sticker_'))
          .map(img => img.name);

        let finalWorldBook = activeSession.worldBook;
        if (isUserTransfer) {
          finalWorldBook += ` \n[系统提示: 你刚刚领取了对方发来的巨额转账红包，请在接下来的发言中向对方表示极大的感谢。]`;
        }

        const isOutfitQuery = /(今天|今日|发张|发个|看看|你现在的?)(穿搭|穿什么|衣服|穿的什么|ootd|着装|打扮)/i.test(contentToSave) || /^(穿搭|ootd)$/i.test(contentToSave.trim());
        let outfitToAttach: string | undefined = undefined;
        if (isOutfitQuery && activeSession.wardrobe && activeSession.wardrobe.length > 0) {
          outfitToAttach = activeSession.wardrobe[Math.floor(Math.random() * activeSession.wardrobe.length)];
        }

        let replyText = await generateAiReply(
          targetChatId,
          contentToSave,
          await dbInstance.getMessages(targetChatId),
          getSystemMemoryPrompt(activeSession),
          finalWorldBook,
          undefined,
          userStickers,
          {
            longTermMemoryEnabled: activeSession.longTermMemoryEnabled,
            memoryRetentionDays: activeSession.memoryRetentionDays,
            memoryEntries: activeSession.memoryEntries
          },
          {
            narrationModeEnabled: activeSession.narrationModeEnabled,
            narrationRuleText: activeSession.narrationRuleText
          },
          {
            offlineCustomEnabled: activeSession.offlineCustomEnabled,
            offlineScenarioTitle: activeSession.offlineScenarioTitle,
            offlineScenarioDesc: activeSession.offlineScenarioDesc,
            offlineBehaviorPrompt: activeSession.offlineBehaviorPrompt,
            offlineCharacterRealName: activeSession.realName || activeSession.characterName,
            offlineUserRealName: getUserRealName()
          },
          {
            timePerceptionEnabled: activeSession.timePerceptionEnabled !== false,
            outfitImageUrl: outfitToAttach
          }
        );

        if (outfitToAttach && !replyText.includes('[👗 穿搭:') && !replyText.includes('[👗 今日穿搭:')) {
          replyText = `[👗 穿搭: ${outfitToAttach}]\n${replyText}`;
        }

        // Separate outfit tag from text to ensure they are sent in distinct bubbles
        const outfitMatch = replyText.match(/\[👗\s*(?:穿搭|今日穿搭):\s*[\s\S]+?\]/);
        let textParts: string[] = [];

        if (outfitMatch) {
          const outfitTag = outfitMatch[0];
          const textWithoutOutfit = replyText.replace(outfitTag, '').trim();
          const otherParts = textWithoutOutfit
            .split(/\r?\n/)
            .map((p: string) => p.trim())
            .filter((p: string) => p.length > 0);

          // Outfit image bubble first, followed by character's persona comments
          textParts = [outfitTag, ...otherParts];
        } else {
          const isOfflineTheatre = targetChatId.endsWith('_offline_custom');
          textParts = isOfflineTheatre
            ? [replyText]
            : replyText
                .split(/\r?\n/)
                .map((p: string) => p.trim())
                .filter((p: string) => p.length > 0);
        }

        if (textParts.length === 0) {
          textParts.push(replyText || '...');
        }

        for (let k = 0; k < textParts.length; k++) {
          const assistantMessage: ChatMessage = {
            id: `ai_msg_${Date.now()}_${k}`,
            chatId: targetChatId,
            role: 'assistant',
            content: textParts[k],
            timestamp: Date.now() + k
          };

          await dbInstance.saveMessage(assistantMessage);
          setMessages((prev) => [...prev, assistantMessage]);

          if (k < textParts.length - 1) {
            await new Promise((r) => setTimeout(r, 450));
          }
        }
      }

      await reloadSessionsAndLastMsgs();

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '大模型神经回路失联，请核查系统设置中的API设置。');
    } finally {
      setIsAiReplying(false);
      setTypingCharacter(null);
    }
  };

  // Handle direct local photo selection -> Opens ImagePickerModal
  const handleDirectImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeSession) return;

    const loaders = Array.from(files).map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string || '');
        reader.readAsDataURL(file);
      });
    });

    Promise.all(loaders).then(base64s => {
      const valid = base64s.filter(Boolean);
      if (valid.length > 0) {
        setPendingChatPickerImages(valid);
        setIsChatPickerOpen(true);
      }
    });
    e.target.value = '';
  };

  // Bulk send photos from ImagePickerModal
  const handleChatPickerSend = async (selectedBase64List: string[]) => {
    if (!activeSession || selectedBase64List.length === 0) return;

    try {
      const newMessages: ChatMessage[] = [];
      let lastSavedMessage: ChatMessage | null = null;
      let combinedContentToSave = '';

      for (let i = 0; i < selectedBase64List.length; i++) {
        const base64Data = selectedBase64List[i];
        const imgName = `local_photo_${Date.now()}_${i}.png`;
        const newPhoto: LocalImage = {
          name: imgName,
          data: base64Data,
          createdAt: Date.now() + i
        };

        await dbInstance.saveImage(newPhoto);
        setLocalSandboxImages((prev) => [...prev, newPhoto]);

        const userMessageId = `user_msg_${Date.now()}_${i}`;
        const contentToSave = `[📎 附图: /images/${imgName}]`;
        combinedContentToSave += (combinedContentToSave ? '\n' : '') + contentToSave;

        const userMessage: ChatMessage = {
          id: userMessageId,
          chatId: activeSession.id,
          role: 'user',
          content: contentToSave,
          timestamp: Date.now() + i
        };

        await dbInstance.saveMessage(userMessage);
        newMessages.push(userMessage);
        lastSavedMessage = userMessage;
      }

      const updatedSession = {
        ...activeSession,
        isChatHidden: false,
        updatedAt: Date.now()
      };
      await dbInstance.saveSession(updatedSession);

      setMessages((prev) => [...prev, ...newMessages]);
      setShowExtraPanel(false);

      if (lastSavedMessage) {
        await triggerAiResponseForLatestMessages(lastSavedMessage, combinedContentToSave);
      }
    } catch (err) {
      console.error(err);
      alert('批量发送照片失败');
    }
  };

  // Handle simulation money transfer submit
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('请输入有效的正数金额！');
      return;
    }

    const noteText = transferNote.trim() || '转账';
    const transferMsgContent = `[💸 转账: ${amount.toFixed(2)} | 备注: ${noteText} | 状态: 待领取]`;

    const userMessageId = `user_msg_${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      chatId: activeSession.id,
      role: 'user',
      content: transferMsgContent,
      timestamp: Date.now()
    };

    try {
      await dbInstance.saveMessage(userMessage);

      const updatedSession = {
        ...activeSession,
        isChatHidden: false,
        updatedAt: Date.now()
      };
      await dbInstance.saveSession(updatedSession);

      setMessages((prev) => [...prev, userMessage]);
      setShowTransferModal(false);
      setTransferAmount('');
      setShowExtraPanel(false);

      // Trigger AI reply
      await triggerAiResponseForLatestMessages(userMessage, transferMsgContent);
    } catch (err) {
      console.error(err);
      alert('发起转账失败');
    }
  };

  // Handle claiming a transfer when clicked
  const handleCollectTransfer = async (msg: ChatMessage) => {
    if (!activeSession) return;
    const transferRegex = /\[💸\s*转账:\s*([^|]+?)\s*\|\s*备注:\s*([^|]+?)\s*\|\s*状态:\s*([^|\]]+?)\]/;
    const match = msg.content.match(transferRegex);
    if (!match) return;

    const amountStr = match[1].trim();
    const noteStr = match[2].trim();
    const currentStatus = match[3].trim();

    if (currentStatus !== '待领取') {
      alert('此转账已被处理。');
      return;
    }

    const updatedContent = `[💸 转账: ${amountStr} | 备注: ${noteStr} | 状态: 已领取]`;
    const updatedMsg: ChatMessage = {
      ...msg,
      content: updatedContent
    };

    try {
      await dbInstance.saveMessage(updatedMsg);
      // Update local state
      setMessages((prev) => prev.map((m) => m.id === msg.id ? updatedMsg : m));

      // Append system message
      const sysMsg: ChatMessage = {
        id: `sys_collected_${Date.now()}`,
        chatId: activeSession.id,
        role: 'system',
        content: `你已成功领取了 ¥${amountStr} 的转账。`,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(sysMsg);
      setMessages((prev) => [...prev, sysMsg]);

      window.dispatchEvent(new Event('wallet-updated'));

      // If user received transfer sent by user (msg.role === 'user'), AI acknowledges
      if (!activeSession.isGroup && msg.role === 'user') {
        setTimeout(async () => {
          setIsAiReplying(true);
          const aiThanksMsg: ChatMessage = {
            id: `ai_thanks_${Date.now()}`,
            chatId: activeSession.id,
            role: 'assistant',
            content: `谢谢老板领了红包！😘 以后要经常给我发福利哦~`,
            timestamp: Date.now()
          };
          await dbInstance.saveMessage(aiThanksMsg);
          setMessages((prev) => [...prev, aiThanksMsg]);
          setIsAiReplying(false);
        }, 1200);
      }
    } catch (err) {
      console.error(err);
      alert('领取转账失败');
    }
  };

  // Handle returning a transfer
  const handleReturnTransfer = async (msg: ChatMessage) => {
    if (!activeSession) return;
    const transferRegex = /\[💸\s*转账:\s*([^|]+?)\s*\|\s*备注:\s*([^|]+?)\s*\|\s*状态:\s*([^|\]]+?)\]/;
    const match = msg.content.match(transferRegex);
    if (!match) return;

    const amountStr = match[1].trim();
    const noteStr = match[2].trim();
    const currentStatus = match[3].trim();

    if (currentStatus !== '待领取') {
      alert('此转账已被处理。');
      return;
    }

    const updatedContent = `[💸 转账: ${amountStr} | 备注: ${noteStr} | 状态: 已退回]`;
    const updatedMsg: ChatMessage = {
      ...msg,
      content: updatedContent
    };

    try {
      await dbInstance.saveMessage(updatedMsg);
      // Update local state
      setMessages((prev) => prev.map((m) => m.id === msg.id ? updatedMsg : m));

      // Append system message
      const sysMsg: ChatMessage = {
        id: `sys_returned_${Date.now()}`,
        chatId: activeSession.id,
        role: 'system',
        content: `你已退回了 ¥${amountStr} 的转账。`,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(sysMsg);
      setMessages((prev) => [...prev, sysMsg]);

      window.dispatchEvent(new Event('wallet-updated'));
    } catch (err) {
      console.error(err);
      alert('退回转账失败');
    }
  };

  // Handle long term memory update submit
  const handleSaveLongTermMemorySession = async (updatedSession: ChatSession) => {
    try {
      await dbInstance.saveSession(updatedSession);
      setActiveSession(updatedSession);
      await reloadSessionsAndLastMsgs();
      setShowMemoryModal(false);

      const sysNotif: ChatMessage = {
        id: `sys_mem_update_${Date.now()}`,
        chatId: updatedSession.id,
        role: 'system',
        content: `[长期记忆系统已切换配置：针对 ${updatedSession.characterName} 的记忆规则与深度学习思考已成功同步。]`,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(sysNotif);
      setMessages((prev) => [...prev, sysNotif]);
    } catch (err) {
      console.error(err);
      alert('保存长期记忆失败');
    }
  };

  // Handle narration mode update submit
  const handleSaveNarrationModeSession = async (updatedSession: ChatSession) => {
    try {
      await dbInstance.saveSession(updatedSession);
      setActiveSession(updatedSession);
      await reloadSessionsAndLastMsgs();
      setShowNarrationModal(false);

      const statusStr = Boolean(updatedSession.narrationModeEnabled) ? '已开启' : '已关闭';
      const sysNotif: ChatMessage = {
        id: `sys_narr_update_${Date.now()}`,
        chatId: updatedSession.id,
        role: 'system',
        content: `[旁白模式：${statusStr}]`,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(sysNotif);
      setMessages((prev) => [...prev, sysNotif]);
    } catch (err) {
      console.error(err);
      alert('保存旁白模式配置失败');
    }
  };

  // Handle proactive messaging update submit
  const handleSaveProactiveSession = async (updatedSession: ChatSession) => {
    try {
      await dbInstance.saveSession(updatedSession);
      setActiveSession(updatedSession);
      await reloadSessionsAndLastMsgs();
      setShowProactiveModal(false);

      const onlineStr = updatedSession.onlineProactiveEnabled ? `开启(${updatedSession.onlineIdleMinutes || 10}分钟停顿触发)` : '关闭';
      const bgStr = updatedSession.backgroundProactiveEnabled 
        ? `开启(${updatedSession.backgroundActiveTimeStart}~${updatedSession.backgroundActiveTimeEnd}，${updatedSession.backgroundFrequency === 'high' ? '高频' : updatedSession.backgroundFrequency === 'low' ? '低频' : '中频'})` 
        : '关闭';

      const sysNotif: ChatMessage = {
        id: `sys_proactive_update_${Date.now()}`,
        chatId: updatedSession.id,
        role: 'system',
        content: `[AI 主动呼叫配置更新: 在线主动问候[${onlineStr}]，后台挂机呼叫[${bgStr}]。]`,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(sysNotif);
      setMessages((prev) => [...prev, sysNotif]);
    } catch (err) {
      console.error(err);
      alert('保存主动呼叫配置失败');
    }
  };

  const handleMemorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    const updated = {
      ...activeSession,
      memory: customMemoryText
    };

    try {
      await dbInstance.saveSession(updated);
      setActiveSession(updated);
      await reloadSessionsAndLastMsgs();
      setShowMemoryModal(false);

      const sysNotif: ChatMessage = {
        id: `sys_mem_update_${Date.now()}`,
        chatId: activeSession.id,
        role: 'system',
        content: `[长期记忆已同步：已将新神经网络突触权重写入核心，该角色的长期记忆已永久更新。]`,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(sysNotif);
      setMessages((prev) => [...prev, sysNotif]);
    } catch (err) {
      console.error(err);
      alert('保存长期记忆失败');
    }
  };

  // Handle active user messaging
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSession) return;

    const trimmedMsg = newMessage.trim();
    if (!trimmedMsg && !attachedImageName) return;

    let contentToSave = trimmedMsg;
    if (attachedImageName) {
      contentToSave = `[📎 附图: /images/${attachedImageName}]\n${trimmedMsg}`.trim();
    }

    const targetChatId = getActiveChatId(activeSession);
    const userMessageId = `user_msg_${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      chatId: targetChatId,
      role: 'user',
      content: contentToSave,
      timestamp: Date.now(),
      ...(replyTargetMessage ? {
        replyToId: replyTargetMessage.id,
        replyToContent: replyTargetMessage.content,
        replyToSender: replyTargetMessage.role === 'user' ? '我' : (replyTargetMessage.senderName || activeSession.characterName || 'AI')
      } : {})
    };

    try {
      await dbInstance.saveMessage(userMessage);
      
      const updatedSession = {
        ...activeSession,
        isChatHidden: false,
        updatedAt: Date.now()
      };
      await dbInstance.saveSession(updatedSession);

      setMessages((prev) => [...prev, userMessage]);
      setNewMessage('');
      setAttachedImageName(null);
      setErrorMessage(null);
      setReplyTargetMessage(null);

      await triggerAiResponseForLatestMessages(userMessage, contentToSave);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '大模型神经回路失联，请核查系统设置中的API设置。');
    } finally {
      setIsAiReplying(false);
      setTypingCharacter(null);
    }
  };

  // --- HANDLERS FOR STICKER PANEL ---
  const handleStickerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64Data = event.target?.result as string;
            if (base64Data) {
              const stickerName = `sticker_${Date.now()}_${i}_${file.name}`;
              const newSticker: LocalImage = {
                name: stickerName,
                data: base64Data,
                createdAt: Date.now() + i
              };
              await dbInstance.saveImage(newSticker);
            }
            resolve();
          };
          reader.readAsDataURL(file);
        });
      }
      const list = await dbInstance.getAllImages();
      setLocalSandboxImages(list);
    } catch (err) {
      console.error(err);
      alert('批量导入表情包失败');
    }
    e.target.value = '';
  };

  const handleDeleteSticker = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    try {
      await dbInstance.deleteImage(name);
      const list = await dbInstance.getAllImages();
      setLocalSandboxImages(list);
      setActiveDeleteStickerName(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendSticker = async (stickerName: string) => {
    if (!activeSession || isAiReplying) return;

    const userMessage: ChatMessage = {
      id: `user_msg_${Date.now()}`,
      chatId: activeSession.id,
      role: 'user',
      content: `[📎 附图: /images/${stickerName}]`,
      timestamp: Date.now(),
    };

    try {
      await dbInstance.saveMessage(userMessage);
      
      const updatedSession = {
        ...activeSession,
        isChatHidden: false,
        updatedAt: Date.now()
      };
      await dbInstance.saveSession(updatedSession);

      setMessages((prev) => [...prev, userMessage]);
      setShowStickerPanel(false);

      // Resolve sticker base64 image data if sticker recognition is enabled
      let stickerUrl: string | undefined = undefined;
      if (isStickerRecognitionEnabled) {
        const found = localSandboxImages.find(img => img.name === stickerName);
        if (found) {
          stickerUrl = found.data;
        } else {
          const dbImages = await dbInstance.getAllImages();
          const dbImg = dbImages.find(img => img.name === stickerName);
          if (dbImg) {
            stickerUrl = dbImg.data;
          }
        }
      }

      if (activeSession.isGroup) {
        // AI GROUP SPEAKER ROUND ROBIN OR SPECIFIC
        const activeParticipants = activeSession.participants || [];
        let queue: string[] = [];
        
        if (speakerMode === 'loop') {
          queue = [...activeParticipants];
        } else if (speakerMode === 'random') {
          const count = Math.ceil(activeParticipants.length / 3);
          const shuffled = [...activeParticipants].sort(() => 0.5 - Math.random());
          queue = shuffled.slice(0, count);
        } else {
          queue = [speakerMode];
        }

        for (let i = 0; i < queue.length; i++) {
          const charId = queue[i];
          const charDetails = getParticipantDetails(charId);
          
          setTypingCharacter({
            name: charDetails.name,
            avatar: charDetails.avatar
          });

          const currentHistory = await dbInstance.getMessages(activeSession.id);
          const allGroupAis = activeParticipants.map(id => {
            const detail = getParticipantDetails(id);
            return { id: detail.id, name: detail.name, avatar: detail.avatar };
          });

          const userStickers = localSandboxImages
            .filter(img => img.name.startsWith('sticker_'))
            .map(img => img.name);

          const replyText = await generateGroupMemberReply(
            activeSession.id,
            charDetails.id,
            charDetails.name,
            getSystemMemoryPrompt(charDetails),
            charDetails.worldBook || activeSession.worldBook,
            currentHistory,
            allGroupAis,
            stickerUrl,
            userStickers,
            {
              narrationModeEnabled: charDetails.narrationModeEnabled ?? activeSession.narrationModeEnabled,
              narrationRuleText: charDetails.narrationRuleText || activeSession.narrationRuleText
            }
          );

          const textParts = replyText
            .split(/\r?\n/)
            .map((p: string) => p.trim())
            .filter((p: string) => p.length > 0);

          if (textParts.length === 0) {
            textParts.push(replyText || '...');
          }

          for (let k = 0; k < textParts.length; k++) {
            const assistantMessage: ChatMessage = {
              id: `ai_msg_g_${Date.now()}_${i}_${k}`,
              chatId: activeSession.id,
              role: 'assistant',
              senderName: charDetails.name,
              senderAvatar: charDetails.avatar,
              content: textParts[k],
              timestamp: Date.now() + k
            };

            await dbInstance.saveMessage(assistantMessage);
            setMessages((prev) => [...prev, assistantMessage]);

            if (k < textParts.length - 1) {
              await new Promise((r) => setTimeout(r, 450));
            }
          }

          if (i < queue.length - 1) {
            setTypingCharacter(null);
            await new Promise((r) => setTimeout(r, 650));
          }
        }
      } else {
        // SINGLE CHAT AI REPLY
        setIsAiReplying(true);
        setTypingCharacter({
          name: activeSession.characterName,
          avatar: activeSession.characterAvatar
        });

        const userStickers = localSandboxImages
          .filter(img => img.name.startsWith('sticker_'))
          .map(img => img.name);

        const replyText = await generateAiReply(
          activeSession.id,
          `[📎 附图: /images/${stickerName}]`,
          messages,
          getSystemMemoryPrompt(activeSession),
          activeSession.worldBook,
          stickerUrl,
          userStickers,
          {
            longTermMemoryEnabled: activeSession.longTermMemoryEnabled,
            memoryRetentionDays: activeSession.memoryRetentionDays,
            memoryEntries: activeSession.memoryEntries,
            memoryAppSummary: activeSession.memoryAppSummary
          },
          {
            narrationModeEnabled: activeSession.narrationModeEnabled,
            narrationRuleText: activeSession.narrationRuleText
          }
        );

        const textParts = replyText
          .split(/\r?\n/)
          .map((p: string) => p.trim())
          .filter((p: string) => p.length > 0);

        if (textParts.length === 0) {
          textParts.push(replyText || '...');
        }

        for (let k = 0; k < textParts.length; k++) {
          const assistantMessage: ChatMessage = {
            id: `ai_msg_${Date.now()}_${k}`,
            chatId: activeSession.id,
            role: 'assistant',
            content: textParts[k],
            timestamp: Date.now() + k
          };

          await dbInstance.saveMessage(assistantMessage);
          setMessages((prev) => [...prev, assistantMessage]);

          if (k < textParts.length - 1) {
            await new Promise((r) => setTimeout(r, 450));
          }
        }
      }

      await reloadSessionsAndLastMsgs();

      // Background check for character memory auto-summary threshold
      if (!activeSession.isGroup) {
        const threshold = activeSession.autoSummaryMsgThreshold ?? 50;
        const currentMsgCount = messages.length + 1;
        const lastAutoCount = activeSession.lastAutoSummaryMsgCount ?? 0;
        
        if (currentMsgCount - lastAutoCount >= threshold) {
          setTimeout(async () => {
            try {
              const allMsgs = await dbInstance.getMessages(activeSession.id);
              const newSummary = await generateCharacterMemoryAppSummary(activeSession, allMsgs);
              const updatedSess: ChatSession = {
                ...activeSession,
                memoryAppSummary: newSummary,
                lastAutoSummaryMsgCount: currentMsgCount
              };
              await dbInstance.saveSession(updatedSess);
            } catch (e) {
              console.warn('Background auto summary failed silently:', e);
            }
          }, 1000);
        }
      }

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || '大模型神经回路失联，请核查系统设置中的API设置。');
    } finally {
      setIsAiReplying(false);
      setTypingCharacter(null);
    }
  };

  // Searching history
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      setActiveSearchIndex(-1);
      return;
    }

    const match = messages.filter((m) => 
      fuzzyMatch(m.content, q)
    );
    setSearchResults(match);
    if (match.length > 0) {
      setActiveSearchIndex(0);
      focusMessageInViewport(match[0].id);
    } else {
      setActiveSearchIndex(-1);
    }
  };

  const traverseSearchResults = (direction: 'next' | 'prev') => {
    if (searchResults.length === 0) return;
    let nextIdx = activeSearchIndex;
    if (direction === 'next') {
      nextIdx = (activeSearchIndex + 1) % searchResults.length;
    } else {
      nextIdx = (activeSearchIndex - 1 + searchResults.length) % searchResults.length;
    }
    setActiveSearchIndex(nextIdx);
    focusMessageInViewport(searchResults[nextIdx].id);
  };

  const focusMessageInViewport = (id: string) => {
    const targetElement = document.getElementById(`msg-${id}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetElement.classList.add('bg-amber-100/70', 'transition-all');
      setTimeout(() => {
        targetElement.classList.remove('bg-amber-100/70');
      }, 1500);
    }
  };

  const handleCalendarJump = (dateString: string) => {
    if (!dateString) return;
    const jumpDate = new Date(dateString);
    const startOfDay = new Date(jumpDate.getFullYear(), jumpDate.getMonth(), jumpDate.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const matchedMessages = messages.filter(
      (m) => m.timestamp >= startOfDay && m.timestamp < endOfDay
    );

    if (matchedMessages.length > 0) {
      const sorted = matchedMessages.sort((a, b) => a.timestamp - b.timestamp);
      focusMessageInViewport(sorted[0].id);
    } else {
      alert(`📅 ${dateString} 当天未查询到对话历史。`);
    }
  };

  // Update Brain Rules Custom Config Drawer
  const handleSavePromptsConfig = async () => {
    if (!activeSession) return;
    const updated = {
      ...activeSession,
      memory: activeMemoryInput,
      worldBook: activeWorldBookInput
    };

    try {
      await dbInstance.saveSession(updated);
      setActiveSession(updated);
      await reloadSessionsAndLastMsgs();
      setShowConfigDrawer(false);

      const notification: ChatMessage = {
        id: `sys_config_notif_${Date.now()}`,
        chatId: activeSession.id,
        role: 'system',
        content: `[系统通知: 已重置此角色的世界设定和背景脑记忆规则，接下来的对话将按照新神经网络推演进行。]`,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(notification);
      setMessages((prev) => [...prev, notification]);
    } catch (e) {
      alert('保存规则失败');
    }
  };

  // Simulates mutual comments and replies among characters on a specific moment post
  const simulateMutualInteractions = async (momentId: string, ownerCharName: string) => {
    const ownerChar = sessions.find(s => s.characterName === ownerCharName && !s.isGroup);
    const otherChars = sessions.filter(s => s.characterName !== ownerCharName && !s.isGroup);
    if (otherChars.length === 0) return;

    // Pick 1 to 2 random characters to comment
    const numComments = Math.floor(Math.random() * 2) + 1; // 1 or 2 comments
    const selectedCommenters = [...otherChars].sort(() => 0.5 - Math.random()).slice(0, numComments);

    for (let i = 0; i < selectedCommenters.length; i++) {
      const commenter = selectedCommenters[i];
      // Delay for each comment to look natural
      const commentDelay = (i + 1) * 3000 + Math.random() * 2000;

      setTimeout(async () => {
        try {
          const latestMoments = await dbInstance.getAllMoments();
          const targetMom = latestMoments.find(m => m.id === momentId);
          if (!targetMom) return;

          // Generate AI comment based on commenter's persona
          const aiCommentText = await generateAiMomentComment(
            commenter.characterName,
            getSystemMemoryPrompt(commenter),
            commenter.relationship || '普通朋友',
            targetMom.content,
            (targetMom.comments || []).map(c => `${c.senderName}: ${c.content}`).join('\n'),
            targetMom.characterName
          );

          const commenterCommentId = `ai_comm_${Date.now()}_${commenter.id}`;
          const newComment = {
            id: commenterCommentId,
            senderName: commenter.characterName,
            senderAvatar: commenter.characterAvatar,
            content: aiCommentText,
            timestamp: Date.now()
          };

          const updatedComments = targetMom.comments ? [...targetMom.comments, newComment] : [newComment];
          const updatedMom = {
            ...targetMom,
            comments: updatedComments,
            commentsCount: updatedComments.length
          };

          await dbInstance.saveMoment(updatedMom);
          setMoments(prev => prev.map(m => m.id === momentId ? updatedMom : m));

          // Now, owner of the post or another character has a chance to reply to this comment!
          const replyChar = ownerChar || (Math.random() < 0.5 ? otherChars.find(c => c.characterName !== commenter.characterName) : null);
          if (replyChar && Math.random() < 0.80) {
            const replyDelay = 3000 + Math.random() * 3000;
            setTimeout(async () => {
              try {
                const latestMoments2 = await dbInstance.getAllMoments();
                const targetMom2 = latestMoments2.find(m => m.id === momentId);
                if (!targetMom2) return;

                const replyText = await generateAiCommentReply(
                  replyChar.characterName,
                  getSystemMemoryPrompt(replyChar),
                  replyChar.relationship || '普通朋友',
                  targetMom2.content,
                  aiCommentText,
                  commenter.characterName,
                  false
                );

                const ownerReply = {
                  id: `ai_reply_${Date.now()}_${replyChar.id}`,
                  senderName: replyChar.characterName,
                  senderAvatar: replyChar.characterAvatar,
                  content: replyText,
                  timestamp: Date.now(),
                  replyTo: commenter.characterName
                };

                const updatedComments2 = targetMom2.comments ? [...targetMom2.comments, ownerReply] : [ownerReply];
                const updatedMom2 = {
                  ...targetMom2,
                  comments: updatedComments2,
                  commentsCount: updatedComments2.length
                };

                await dbInstance.saveMoment(updatedMom2);
                setMoments(prev => prev.map(m => m.id === momentId ? updatedMom2 : m));
              } catch (err) {
                console.warn('AI reply failed:', err.message || err);
              }
            }, replyDelay);
          }

        } catch (err) {
          console.warn('AI commenter failed to comment:', err.message || err);
        }
      }, commentDelay);
    }
  };

  // Generate moment post for a specific character
  const generateSpecificCharacterMoment = async (char: ChatSession) => {
    if (char.isGroup) return; // Prevent group chats from publishing moments
    const settings = await dbInstance.getSettings();
    if (!settings.apiKey) {
      throw new Error('未检测到 API Key，请先在设置中配置。');
    }

    const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
    const targetUrl = `${cleanBaseUrl}/chat/completions`;

    const promptSystem = `你必须扮演名叫 ${char.characterName} 的人工智能伴侣。请以第一人称撰写一条极富个人鲜明性格特征的日常生活朋友圈动态。`;
    const promptBody = `要求：
1. 请完全贴合你的性格与背景说出这段朋友圈碎碎念：
- 性格：${getSystemMemoryPrompt(char)}
- 场景背景：${char.worldBook}
2. 内容在 100 字以内，自然幽默，真实生活化（绝对禁止出现多次元、跨时空、宇宙融合等架空科幻题材，必须是百分之百的地球写实日常）。
3. 请只输出朋友圈文章文本，禁止包含说明或包装引号。`;

    const bodyData = {
      model: settings.selectedModel || 'gpt-4o',
      messages: [
        { role: 'system', content: promptSystem },
        { role: 'user', content: promptBody }
      ],
      temperature: 0.85,
      max_tokens: 384
    };

    const resJson = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
    const articleText = resJson.choices?.[0]?.message?.content?.trim() || '';

    if (!articleText) {
      throw new Error('生成的动态内容为空');
    }

    const currentImages = await dbInstance.getAllImages();
    const shouldAttachImage = Math.random() < 0.3;
    const attachedImage = (shouldAttachImage && currentImages.length > 0) 
      ? currentImages[Math.floor(Math.random() * currentImages.length)].name 
      : undefined;

    const newMoment: MomentPost = {
      id: `moment_auto_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${char.id}`,
      characterName: char.characterName,
      characterAvatar: char.characterAvatar,
      content: articleText,
      imageName: attachedImage,
      timestamp: Date.now(),
      likes: Math.floor(Math.random() * 5) + 1,
      commentsCount: 0,
      comments: []
    };

    await dbInstance.saveMoment(newMoment);
    const list = await dbInstance.getAllMoments();
    setMoments(list);

    // Trigger character comments & mutual interactions
    simulateMutualInteractions(newMoment.id, char.characterName);
  };

  // Check and run background simulation for character updates (8-24 hours range)
  const checkAndSimulateCharacterMoments = async () => {
    if (sessions.length === 0) return;
    if (isCheckingMomentsRef.current) return;
    isCheckingMomentsRef.current = true;

    try {
      const contacts = sessions.filter(s => !s.isGroup);
      if (contacts.length === 0) return;

      for (const char of contacts) {
        const keyLast = `last_moment_time_${char.characterName}`;
        const keyInterval = `next_moment_interval_${char.characterName}`;

        let lastPostTime = Number(localStorage.getItem(keyLast) || '0');
        let nextInterval = Number(localStorage.getItem(keyInterval) || '0');

        // Initialize if not set
        if (lastPostTime === 0) {
          // Set to a past time so some characters have posted and some are ready to post soon
          const hoursAgo = 4 + Math.random() * 16;
          lastPostTime = Date.now() - hoursAgo * 3600000;
          localStorage.setItem(keyLast, lastPostTime.toString());
        }

        if (nextInterval === 0) {
          // Random interval between 8 and 24 hours
          nextInterval = (8 + Math.random() * 16) * 3600000;
          localStorage.setItem(keyInterval, nextInterval.toString());
        }

        const elapsed = Date.now() - lastPostTime;
        if (elapsed >= nextInterval) {
          console.log(`[Timer] Auto-generating moment for ${char.characterName}`);
          
          await generateSpecificCharacterMoment(char);

          // Update tracking
          localStorage.setItem(keyLast, Date.now().toString());
          const newRandInterval = (8 + Math.random() * 16) * 3600000;
          localStorage.setItem(keyInterval, newRandInterval.toString());
        }
      }
    } catch (err) {
      console.warn('Error during background moments check:', err.message || err);
    } finally {
      isCheckingMomentsRef.current = false;
    }
  };

  // Fetch Moments posts Timeline Sync (Binds AI automatic moment writing to refresh button - generates 3 posts)
  const handleFreshTimelineSync = async () => {
    setIsRefreshingMoments(true);
    try {
      const settings = await dbInstance.getSettings();
      if (!settings.apiKey) {
        alert('⚠️ 未检测到 API Key，请先在【设置】中配置 API Key 后再刷动态。');
        return;
      }

      const individualSessions = sessions.filter(s => !s.isGroup);
      if (individualSessions.length > 0) {
        const chosenChars: ChatSession[] = [];
        const pool = [...individualSessions];
        for (let i = 0; i < Math.min(3, individualSessions.length); i++) {
          const randIdx = Math.floor(Math.random() * pool.length);
          chosenChars.push(pool[randIdx]);
          pool.splice(randIdx, 1);
        }

        // Generate moments
        await Promise.all(chosenChars.map(char => generateSpecificCharacterMoment(char)));
      }
      const list = await dbInstance.getAllMoments();
      setMoments(list);
    } catch (e: any) {
      console.error(e);
      alert(`刷新动态失败：${e.message || '网络请求错误'}`);
    } finally {
      setTimeout(() => setIsRefreshingMoments(false), 500);
    }
  };

  // Background check for character automated moments (8~24 hours randomized interval check every 30s)
  useEffect(() => {
    if (sessions.length === 0) return;

    // Run first check immediately
    checkAndSimulateCharacterMoments();

    const interval = setInterval(() => {
      checkAndSimulateCharacterMoments();
    }, 30000);

    return () => clearInterval(interval);
  }, [sessions]);

  const handleLikeMoment = async (id: string) => {
    const found = moments.find((m) => m.id === id);
    if (!found) return;

    const isCurrentlyLiked = found.likedByMe === true;
    const updated = {
      ...found,
      likedByMe: !isCurrentlyLiked,
      likes: isCurrentlyLiked ? Math.max(0, found.likes - 1) : found.likes + 1
    };

    try {
      await dbInstance.saveMoment(updated);
      setMoments((prev) => 
        prev.map((m) => m.id === id ? updated : m)
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMoment = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: '删除动态',
      description: '⚠️ 确认要彻底删除这条动态吗？删除后数据将被抹除且不可撤销。',
      onConfirm: async () => {
        try {
          await dbInstance.deleteMoment(id);
          setMoments((prev) => prev.filter((m) => m.id !== id));
          setConfirmModal(null);
        } catch (e) {
          console.error(e);
          alert('删除动态失败。');
        }
      }
    });
  };

  const handleDeleteChatSession = (sessionId: string, titleOrName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmMsg = `确认要从消息列表中移除与 “${titleOrName}” 的聊天窗口吗？此操作不会删除角色设定或聊天记录，仅从列表中隐藏。`;
    
    setConfirmModal({
      isOpen: true,
      title: '删除聊天窗口',
      description: confirmMsg,
      onConfirm: async () => {
        try {
          const existing = sessions.find((s) => s.id === sessionId);
          if (existing) {
            const updated = { ...existing, isChatHidden: true };
            await dbInstance.saveSession(updated);
          }
          if (activeSession?.id === sessionId) {
            setActiveSession(null);
          }
          await reloadSessionsAndLastMsgs();
          setConfirmModal(null);
        } catch (err) {
          console.error(err);
          alert('删除聊天窗失败。');
        }
      }
    });
  };

  const handlePublishUserMoment = async (content: string, imageName?: string) => {
    const savedProfileStr = localStorage.getItem('wechat_user_profile');
    let uName = '时空行者';
    let uAvatar = '🤖';
    if (savedProfileStr) {
      try {
        const parsed = JSON.parse(savedProfileStr);
        if (parsed.userId && parsed.userId !== 'User_Real') uName = parsed.userId;
        else if (parsed.realName) uName = parsed.realName;
        if (parsed.avatar) uAvatar = parsed.avatar;
      } catch (e) {}
    }

    const newMoment: MomentPost = {
      id: `user_moment_${Date.now()}`,
      characterName: uName,
      characterAvatar: uAvatar,
      content,
      imageName,
      timestamp: Date.now(),
      likes: 0,
      commentsCount: 0,
      likedByMe: false,
      comments: []
    };

    try {
      await dbInstance.saveMoment(newMoment);
      const list = await dbInstance.getAllMoments();
      setMoments(list);
      setShowPublishMomentModal(false);

      // Trigger automatic multi-character comments and interactive replies!
      simulateMutualInteractions(newMoment.id, uName);
    } catch (e) {
      console.error(e);
      alert('发布动态失败，存储错误。');
    }
  };

  const handleOpenCharacterMoments = (rawName: string) => {
    if (!rawName) return;
    const cleanName = formatDisplayName(rawName);

    // Find matching character in chat sessions
    const matched = sessions.find((s) => {
      if (s.isGroup) return false;
      const sCleanName = formatDisplayName(s.characterName);
      const sRealName = formatDisplayName(s.realName || '');
      return sCleanName === cleanName || sRealName === cleanName || s.characterName === rawName || s.realName === rawName;
    });

    if (matched) {
      setSelectedContactDetail(matched);
      setIsEditingSelectedContact(false);
      setInitialShowMomentsPage(true);
    } else {
      // Check if user profile name
      const savedProfileStr = localStorage.getItem('wechat_user_profile');
      let uName = '时空行者';
      let uAvatar = '🤖';
      if (savedProfileStr) {
        try {
          const parsed = JSON.parse(savedProfileStr);
          if (parsed.userId && parsed.userId !== 'User_Real') uName = parsed.userId;
        else if (parsed.realName) uName = parsed.realName;
          if (parsed.avatar) uAvatar = parsed.avatar;
        } catch (e) {}
      }

      if (cleanName === formatDisplayName(uName) || cleanName === '我' || cleanName === '时空行者') {
        const userSession: ChatSession = {
          id: 'session_user_profile',
          title: uName,
          characterName: uName,
          characterAvatar: uAvatar,
          memory: '这是你的个人账号',
          worldBook: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          relationship: '我自己',
        };
        setSelectedContactDetail(userSession);
        setIsEditingSelectedContact(false);
        setInitialShowMomentsPage(true);
      } else {
        // Construct temp session for this character
        const tempSession: ChatSession = {
          id: `temp_session_${Date.now()}`,
          title: cleanName,
          characterName: rawName,
          characterAvatar: '👤',
          memory: '',
          worldBook: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          relationship: '普通朋友'
        };
        setSelectedContactDetail(tempSession);
        setIsEditingSelectedContact(false);
        setInitialShowMomentsPage(true);
      }
    }
  };

  const handleEditComment = async (momentId: string, commentId: string, newText: string) => {
    if (!newText.trim()) return;
    const found = moments.find(m => m.id === momentId);
    if (!found || !found.comments) return;

    const updatedComments = found.comments.map(c => 
      c.id === commentId ? { ...c, content: newText.trim() } : c
    );
    const updatedMom = {
      ...found,
      comments: updatedComments
    };

    try {
      await dbInstance.saveMoment(updatedMom);
      setMoments(prev => prev.map(m => m.id === momentId ? updatedMom : m));
    } catch (err) {
      console.error('Failed to edit comment:', err);
    }
  };

  const handleDeleteComment = async (momentId: string, commentId: string) => {
    setConfirmModal({
      isOpen: true,
      title: '删除评论',
      description: '⚠️ 确认要删除这条评论吗？该操作不可撤销。',
      onConfirm: async () => {
        const found = moments.find(m => m.id === momentId);
        if (!found || !found.comments) {
          setConfirmModal(null);
          return;
        }

        const updatedComments = found.comments.filter(c => c.id !== commentId);
        const updatedMom = {
          ...found,
          comments: updatedComments,
          commentsCount: updatedComments.length
        };

        try {
          await dbInstance.saveMoment(updatedMom);
          setMoments(prev => prev.map(m => m.id === momentId ? updatedMom : m));
          setConfirmModal(null);
        } catch (err) {
          console.error('Failed to delete comment:', err);
        }
      }
    });
  };

  const handleAddComment = async (momentId: string, text: string, replyTo?: string) => {
    if (!text.trim()) return;

    const savedProfileStr = localStorage.getItem('wechat_user_profile');
    let uName = '时空行者';
    let uAvatar = '🤖';
    if (savedProfileStr) {
      try {
        const parsed = JSON.parse(savedProfileStr);
        if (parsed.userId && parsed.userId !== 'User_Real') uName = parsed.userId;
        else if (parsed.realName) uName = parsed.realName;
        if (parsed.avatar) uAvatar = parsed.avatar;
      } catch (e) {}
    }

    const found = moments.find(m => m.id === momentId);
    if (!found) return;

    const userCommentId = `user_comment_${Date.now()}`;
    const targetReplyTo = replyTo || replyToMap[momentId] || undefined;
    const userComment: MomentComment = {
      id: userCommentId,
      senderName: uName,
      senderAvatar: uAvatar,
      content: text.trim(),
      timestamp: Date.now(),
      replyTo: targetReplyTo
    };

    const updatedComments = found.comments ? [...found.comments, userComment] : [userComment];
    const updatedMom = {
      ...found,
      comments: updatedComments,
      commentsCount: updatedComments.length
    };

    try {
      await dbInstance.saveMoment(updatedMom);
      setMoments(prev => prev.map(m => m.id === momentId ? updatedMom : m));
      setCommentInputs(prev => ({ ...prev, [momentId]: '' }));
      setReplyToMap(prev => ({ ...prev, [momentId]: undefined }));

      const isCharacterMoment = sessions.some(s => s.characterName === found.characterName && !s.isGroup);
      const ownerCharacter = sessions.find(s => s.characterName === found.characterName && !s.isGroup);

      let responder = ownerCharacter;
      let chance = 0.70;

      if (!isCharacterMoment) {
        const contacts = sessions.filter(s => !s.isGroup);
        if (contacts.length > 0) {
          responder = contacts[Math.floor(Math.random() * contacts.length)];
          chance = 0.50;
        }
      }

      if (responder && Math.random() < chance) {
        const activeResponder = responder;
        const delay = 1500 + Math.random() * 1500;
        setTimeout(async () => {
          try {
            const replyText = await generateAiCommentReply(
              activeResponder.characterName,
              getSystemMemoryPrompt(activeResponder),
              activeResponder.relationship || '普通朋友',
              found.content,
              text.trim(),
              getUserRealName(),
              true
            );

            const currentMoments = await dbInstance.getAllMoments();
            const latestMom = currentMoments.find(m => m.id === momentId);
            if (latestMom) {
              const latestComments = latestMom.comments || [];
              latestComments.push({
                id: `ai_comment_reply_${Date.now()}`,
                senderName: activeResponder.characterName,
                senderAvatar: activeResponder.characterAvatar,
                content: replyText,
                timestamp: Date.now(),
                replyTo: uName
              });
              const refreshedMom = {
                ...latestMom,
                comments: latestComments,
                commentsCount: latestComments.length
              };
              await dbInstance.saveMoment(refreshedMom);
              const finalMoments = await dbInstance.getAllMoments();
              setMoments(finalMoments);
            }
          } catch (err) {
            console.warn('AI failed to reply to user comment:', err.message || err);
          }
        }, delay);
      }

    } catch (e) {
      console.error(e);
      alert('评论失败');
    }
  };

  const handleAttachImage = (imgName: string) => {
    setAttachedImageName(imgName);
    setShowAttachmentDropdown(false);
  };

  const formatMessageTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessagesWithDividers = () => {
    let lastDateStr = '';
    const elements: React.ReactNode[] = [];

    messages.forEach((msg) => {
      const msgDateStr = new Date(msg.timestamp).toLocaleDateString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });

      if (msgDateStr !== lastDateStr) {
        lastDateStr = msgDateStr;
        elements.push(
          <div key={`date-divider-${msg.id}`} className="flex justify-center my-4 select-none">
            <span className="px-3.5 py-1 bg-black/15 text-white text-[10px] font-bold rounded-full uppercase tracking-wider font-sans">
              {msgDateStr}
            </span>
          </div>
        );
      }

      const isUser = msg.role === 'user';
      const senderDisplayName = isUser 
        ? '我' 
        : formatDisplayName(msg.senderName || activeSession?.characterName || 'AI');
      const senderDisplayAvatar = isUser 
        ? (currentUserAvatar || '🤖') 
        : (msg.senderAvatar || activeSession?.characterAvatar || '🔮');

      // Recalled Message style
      if (msg.isRecalled) {
        const sender = isUser ? '你' : formatDisplayName(msg.senderName || activeSession?.characterName || 'AI');
        elements.push(
          <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center my-2.5 px-6 text-center select-none w-full animate-fade-in">
            <span className="px-3 py-1 bg-black/10 text-white/90 text-[10px] rounded-full leading-normal font-sans inline-flex items-center space-x-1.5 max-w-[90%] font-semibold shadow-sm">
              <span>{isUser ? '你撤回了一条消息' : `"${sender}" 撤回了一条消息`}</span>
              {isUser && (
                <button
                  type="button"
                  onClick={() => {
                    let rawText = msg.content;
                    const regex = /\[📎 附图: \/images\/(.+?)\]/;
                    rawText = rawText.replace(regex, '').trim();
                    setNewMessage(rawText);
                  }}
                  className="ml-1 text-[#FEE500] hover:underline font-extrabold focus:outline-none transition-all cursor-pointer active:scale-95"
                >
                  重新编辑
                </button>
              )}
            </span>
          </div>
        );
        return;
      }

      if (msg.role === 'system') {
        elements.push(
          <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center my-4 px-6 text-center select-none w-full">
            <span className="px-3.5 py-1 bg-black/15 text-white text-[10px] font-bold rounded-full leading-normal font-sans inline-block max-w-[90%] break-all">
              {msg.content}
            </span>
          </div>
        );
        return;
      }

      elements.push(
        <div key={msg.id} className="flex items-start w-full relative group">
          {/* Multi-select checkbox */}
          {isMultiSelectMode && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                toggleMessageSelection(msg.id);
              }}
              className="mr-3 self-center flex items-center justify-center shrink-0 cursor-pointer select-none z-10"
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                selectedMessageIds.includes(msg.id)
                  ? 'bg-emerald-600 border-emerald-600 text-white scale-105 shadow-sm'
                  : 'border-slate-400 bg-[#f0f0f0] hover:border-slate-600'
              }`}>
                {selectedMessageIds.includes(msg.id) && <Check size={11} className="stroke-[4px]" />}
              </div>
            </div>
          )}

          <div 
            id={`msg-${msg.id}`}
            className={`flex items-start mb-4 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''} flex-1`}
          >
            {/* Avatar Container */}
            <div className={`w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-lg shadow-sm shrink-0 select-none overflow-hidden ${isUser ? 'ml-2' : 'mr-2'}`}>
              {senderDisplayAvatar.startsWith('data:') || senderDisplayAvatar.startsWith('http') ? (
                <img src={senderDisplayAvatar} alt="avatar" className="w-full h-full object-cover rounded-xl" />
              ) : (
                <span>{senderDisplayAvatar}</span>
              )}
            </div>

            <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} relative`}>
              {/* Sender Label name */}
              <span className="text-[10px] font-extrabold text-gray-800 block mb-1">
                {senderDisplayName}
              </span>

              {/* Bubble layout */}
              <div className={`flex items-end space-x-1.5 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                <div 
                  onTouchStart={() => handleBubbleTouchStart(msg)}
                  onTouchEnd={handleBubbleTouchEnd}
                  onTouchCancel={handleBubbleTouchEnd}
                  onTouchMove={handleBubbleTouchEnd}
                  onMouseDown={() => handleBubbleTouchStart(msg)}
                  onMouseUp={handleBubbleTouchEnd}
                  onMouseLeave={handleBubbleTouchEnd}
                  onContextMenu={(e) => handleBubbleContextMenu(e, msg)}
                  onClick={(e) => handleBubbleClick(msg, e)}
                  className={msg.content.includes('[💸 转账:') 
                    ? `relative select-none rounded-xl overflow-hidden` 
                    : `p-3 rounded-[16px] border text-xs leading-relaxed font-sans shadow-sm select-text whitespace-pre-wrap cursor-pointer transition-all hover:brightness-95 active:scale-[0.99] relative ${
                        msg.replyToId ? 'min-w-[180px] sm:min-w-[240px]' : ''
                      } ${
                        isUser 
                          ? 'bg-[#FEE500] text-[#3C1E1E] border-[#FEE500] rounded-tr-none user-bubble' 
                          : 'bg-[#f0f0f0] text-gray-800 border-gray-100 rounded-tl-none ai-bubble'
                      }`
                  }
                  style={msg.content.includes('[💸 转账:') 
                    ? {} 
                    : isUser ? {
                        backgroundColor: 'var(--theme-user-bubble-bg, #FEE500)',
                        color: 'var(--theme-user-bubble-text, #3C1E1E)',
                        borderColor: 'var(--theme-user-bubble-border, #FEE500)'
                      } : {
                        backgroundColor: 'var(--theme-ai-bubble-bg, #f0f0f0)',
                        color: 'var(--theme-ai-bubble-text, #1f2937)',
                        borderColor: 'var(--theme-ai-bubble-border, #f3f4f6)'
                      }
                  }
                >
                  {/* Replied quote block rendering */}
                  {msg.replyToId && (
                    <div className="mb-2 p-1.5 bg-black/5 rounded-lg border-l-4 border-black/20 text-[10px] text-gray-600 leading-normal select-none w-full max-w-full">
                      <div className="font-extrabold text-gray-700 block truncate mb-0.5">
                        回复 @{msg.replyToSender || '对话'}
                      </div>
                      <div className="line-clamp-2 text-gray-500 text-[10px] break-all whitespace-normal">
                        {(() => {
                          let text = msg.replyToContent || '';
                          const regex = /\[📎 附图: \/images\/(.+?)\]/;
                          text = text.replace(regex, '[图片]').trim();
                          return text;
                        })()}
                      </div>
                    </div>
                  )}

                  {msg.content.includes('[💸 转账:') ? (
                    (() => {
                      const transferRegex = /\[💸\s*转账:\s*([^|]+?)\s*\|\s*备注:\s*([^|]+?)\s*\|\s*状态:\s*([^|\]]+?)\]/;
                      const match = msg.content.match(transferRegex);
                      if (match) {
                        const amountStr = match[1].trim();
                        const noteStr = match[2].trim();
                        const currentStatus = match[3].trim();
                        const isCollected = currentStatus === '已领取';
                        const isReturned = currentStatus === '已退回';

                        return (
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              if (currentStatus === '待领取') {
                                setSelectedTransferMsg(msg);
                              }
                            }}
                            className={`w-56 rounded-xl overflow-hidden shadow-sm border transition-all text-white ${
                              currentStatus === '待领取' ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
                            } ${
                              isCollected 
                                ? 'bg-[#F2A75C]/70 border-[#E69343]/30 opacity-85 hover:opacity-95' 
                                : isReturned
                                ? 'bg-gray-400/80 border-gray-400/40 opacity-80'
                                : 'bg-[#FA9E3B] border-[#E69343] hover:bg-[#F2942C]'
                            }`}
                          >
                            <div className="p-3.5 flex items-start space-x-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base shadow-inner ${isCollected || isReturned ? 'bg-[#f0f0f0]/40 text-white' : 'bg-[#f0f0f0] text-[#FA9E3B] font-black'}`}>
                                <span>¥</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-black truncate">¥{amountStr}</p>
                                <p className="text-[9px] opacity-90 font-bold truncate mt-0.5">{noteStr}</p>
                              </div>
                            </div>
                            <div className="px-3.5 py-1 bg-black/10 border-t border-white/10 flex items-center justify-between text-[8px] font-extrabold opacity-95">
                              <span>{isCollected ? '已领入零钱' : isReturned ? '已退回' : '等待处理'}</span>
                              <span>微信转账</span>
                            </div>
                          </div>
                        );
                      }
                      return <p className="whitespace-pre-wrap">{msg.content}</p>;
                    })()
                  ) : (msg.content.includes('[👗 穿搭:') || msg.content.includes('[👗 今日穿搭:')) ? (
                    <div>
                      {(() => {
                        const outfitRegex = /\[👗\s*(?:穿搭|今日穿搭):\s*([\s\S]+?)\]/;
                        const match = msg.content.match(outfitRegex);
                        const displayBodyText = msg.content.replace(outfitRegex, '').trim();

                        if (match && match[1]) {
                          const imgSrc = match[1].trim();
                          return (
                            <div className={displayBodyText ? 'space-y-2' : ''}>
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImageUrl(imgSrc);
                                }}
                                className="rounded-xl overflow-hidden border border-black/10 max-w-[190px] sm:max-w-[220px] max-h-[260px] bg-slate-100 flex flex-col items-center justify-center cursor-pointer shadow-2xs relative group/outfit hover:shadow-md transition-all active:scale-[0.98]"
                                title="点击放大查看穿搭"
                              >
                                <img 
                                  src={imgSrc} 
                                  alt="今日穿搭" 
                                  className="w-full h-full object-cover max-h-[260px] group-hover/outfit:scale-105 transition-transform duration-300" 
                                />
                                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold flex items-center space-x-1 shadow-sm pointer-events-none">
                                  <Shirt size={11} className="stroke-[2.5px] text-amber-300" />
                                  <span>今日穿搭</span>
                                </div>
                              </div>
                              {displayBodyText && <p className="whitespace-pre-wrap leading-relaxed">{displayBodyText}</p>}
                            </div>
                          );
                        }
                        return <p className="whitespace-pre-wrap">{msg.content}</p>;
                      })()}
                    </div>
                  ) : msg.content.includes('[📎 附图:') ? (
                    <div className="space-y-2">
                      {/* Render attachment img inside bubble dynamically */}
                      {(() => {
                        const regex = /\[📎 附图: \/images\/(.+?)\]/;
                        const match = msg.content.match(regex);
                        const displayBodyText = msg.content.replace(regex, '').trim();

                        if (match && match[1]) {
                          const targetImg = localSandboxImages.find(img => img.name === match[1]);
                          return (
                            <div className="space-y-1.5">
                              <div className="rounded-[8px] overflow-hidden border border-black/5 max-w-[140px] max-h-[140px] sm:max-w-[160px] sm:max-h-[160px] bg-transparent flex items-center justify-center">
                                {targetImg ? (
                                  <img src={targetImg.data} alt="Att" className="max-w-full max-h-full object-contain" />
                                ) : (
                                  <span className="p-3 text-[9px] text-gray-400">未找到本地文件: {match[1]}</span>
                                )}
                              </div>
                              {displayBodyText && <p className="whitespace-pre-wrap">{displayBodyText}</p>}
                            </div>
                          );
                        }
                        return <p className="whitespace-pre-wrap">{msg.content}</p>;
                      })()}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* Temporary visual checkmark for Copy action */}
                  {copiedMessageId === msg.id && (
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-950 text-white text-[9px] font-bold px-2 py-1 rounded-md shadow-lg pointer-events-none select-none z-50">
                      已复制
                    </span>
                  )}
                </div>

                {/* Timestamp side label */}
                <span className="text-[9px] font-mono text-gray-500 select-none pb-0.5" style={{ order: 1 }}>
                  {formatMessageTime(msg.timestamp)}
                </span>
              </div>

              {/* Float iOS/WeChat style bubble context menu */}
              {activeMenuMessageId === msg.id && (
                <div 
                  className={`absolute z-40 ${isUser ? 'right-0' : 'left-0'} top-[-46px] flex flex-row items-center bg-zinc-950 text-white rounded-xl shadow-2xl py-1 px-2 border border-zinc-800 space-x-1.5 font-sans text-[9px] select-none scale-100 transition-all`}
                  dir="ltr"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleCopyMessage(msg); }}
                    className="flex flex-col items-center justify-center px-2 py-1 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer text-white font-semibold"
                  >
                    <Copy size={12} className="stroke-[2.5px] mb-0.5" />
                    <span className="whitespace-nowrap">复制</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleReplyMessage(msg); }}
                    className="flex flex-col items-center justify-center px-2 py-1 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer text-white font-semibold"
                  >
                    <CornerUpLeft size={12} className="stroke-[2.5px] mb-0.5" />
                    <span className="whitespace-nowrap">回复</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleStartEditMessage(msg); }}
                    className="flex flex-col items-center justify-center px-2 py-1 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer text-white font-semibold"
                  >
                    <Edit3 size={12} className="stroke-[2.5px] mb-0.5 text-amber-300" />
                    <span className="whitespace-nowrap">编辑</span>
                  </button>
                  
                  {isUser && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRecallMessage(msg); }}
                      className="flex flex-col items-center justify-center px-2 py-1 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer text-white font-semibold"
                    >
                      <Undo2 size={12} className="stroke-[2.5px] mb-0.5" />
                      <span className="whitespace-nowrap">撤回</span>
                    </button>
                  )}
                  
                  <button
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setIsMultiSelectMode(true); 
                      setSelectedMessageIds([msg.id]); 
                      setActiveMenuMessageId(null); 
                    }}
                    className="flex flex-col items-center justify-center px-2 py-1 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer text-white font-semibold"
                  >
                    <CheckSquare size={12} className="stroke-[2.5px] mb-0.5" />
                    <span className="whitespace-nowrap">多选</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg); }}
                    className="flex flex-col items-center justify-center px-2 py-1 hover:bg-rose-950 hover:text-rose-200 rounded-lg transition-all cursor-pointer text-white font-semibold"
                  >
                    <Trash2 size={12} className="text-rose-400 stroke-[2.5px] mb-0.5" />
                    <span className="whitespace-nowrap">删除</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    });

    return elements;
  };

  // --- RENDER COMPONENT ENTRY ---

  // 1. CHAT ROOM VIEW OVERLAY (If inside active message chamber)
  if (activeSession) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#BACEE0] app-container chat-feed" style={{ backgroundColor: 'var(--theme-feed-bg, #BACEE0)' }}>
        <style id="dynamic-theme">{customThemeCss}</style>
        
        {/* Chat Room Header */}
        <header className="h-16 px-4 bg-[#f0f0f0] border-b border-[#A2B5C6] flex items-center justify-between shrink-0 z-10 select-none chat-header" style={{ backgroundColor: 'var(--theme-header-bg, #f0f0f0)', borderBottomColor: 'var(--theme-header-border, #A2B5C6)' }}>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveSession(null)}
              className="w-8 h-8 rounded-full hover:bg-black/5 text-[#3C1E1E] flex items-center justify-center transition-all cursor-pointer active:scale-95"
              style={{ color: 'var(--theme-header-text, #3C1E1E)' }}
              title="返回消息列表"
            >
              <ChevronLeft size={20} className="stroke-[3px]" />
            </button>

            <div className="flex flex-col">
              <span className="text-lg font-bold text-[#3C1E1E] tracking-tight truncate max-w-[200px]" style={{ color: 'var(--theme-header-text, #3C1E1E)' }}>
                {activeSession.isGroup ? activeSession.title : formatDisplayName(activeSession.characterName)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 relative">
            {/* Look at Outfit button (Left of Settings Menu button) */}
            {!activeSession.isGroup && (
              <button 
                type="button"
                onClick={handleShowOutfit}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer text-[#3C1E1E] hover:bg-black/5 active:scale-95"
                style={{ color: 'var(--theme-header-text, #3C1E1E)' }}
                title="看看穿搭"
              >
                <Shirt size={18} />
              </button>
            )}

            {/* Settings/Menu button (three horizontal lines) */}
            <button 
              type="button"
              onClick={() => setShowSettingsMenu(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer text-[#3C1E1E] hover:bg-black/5 active:scale-95"
              style={{ color: 'var(--theme-header-text, #3C1E1E)' }}
              title="聊天设置"
            >
              <Menu size={18} />
            </button>
          </div>
        </header>

        {/* Searching overlays */}
        <AnimatePresence>
          {showSearch && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#f0f0f0] border-b border-gray-100 overflow-hidden shrink-0 z-20 shadow-sm"
            >
              <div className="p-3 space-y-2 text-gray-800">
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <input
                      type="search"
                      placeholder="搜索聊天历史记录..."
                      value={searchQuery}
                      onChange={handleSearch}
                      className="w-full h-8 pl-8 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] font-sans"
                    />
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  
                  {searchResults.length > 0 && (
                    <div className="flex items-center space-x-1 text-[10px] font-mono text-gray-500">
                      <span>{activeSearchIndex + 1}/{searchResults.length} 条</span>
                      <button 
                        onClick={() => traverseSearchResults('prev')}
                        className="px-1 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 cursor-pointer"
                      >
                        ▲
                      </button>
                      <button 
                        onClick={() => traverseSearchResults('next')}
                        className="px-1 py-0.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 cursor-pointer"
                      >
                        ▼
                      </button>
                    </div>
                  )}

                  <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }} className="p-1 text-gray-400 hover:text-gray-900">
                    <X size={14} />
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="max-h-24 overflow-y-auto space-y-1 border-t border-gray-100 pt-2">
                    {searchResults.map((m, idx) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setActiveSearchIndex(idx);
                          focusMessageInViewport(m.id);
                        }}
                        className={`w-full text-left p-1 rounded hover:bg-gray-50 text-[11px] block truncate transition-all ${activeSearchIndex === idx ? 'bg-amber-50 text-amber-900 font-bold' : 'text-gray-700'}`}
                      >
                        <span className="font-mono text-[9px] text-gray-400 mr-2">[{new Date(m.timestamp).toLocaleDateString()}]</span>
                        <span>{m.content}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>



        {/* Messages feed body */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-1 relative bg-[#BACEE0] chat-feed"
          style={{ backgroundColor: 'var(--theme-feed-bg, #BACEE0)' }}
        >
          {activeMenuMessageId && (
            <div 
              className="absolute inset-0 z-30 bg-black/0 cursor-default" 
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuMessageId(null);
              }}
            />
          )}

          {messages.length > 0 ? (
            renderMessagesWithDividers()
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#7F95A9] text-xs font-semibold py-12 text-center max-w-[85%] mx-auto leading-relaxed select-none">
              <Bot size={28} className="mb-2 text-[#7F95A9]/70" />
              <p>暂无消息记录，开启你们的第一句聊天吧！</p>
            </div>
          )}

          {/* AI Replying loader block */}
          {(isAiReplying || typingCharacter) && (
            <div className="flex items-start mb-4 max-w-[80%]">
              <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-lg shadow-sm border border-slate-300 shrink-0 mr-2 select-none overflow-hidden">
                {typingCharacter && (typingCharacter.avatar.startsWith('data:') || typingCharacter.avatar.startsWith('http')) ? (
                  <img src={typingCharacter.avatar} alt="Typing" className="w-full h-full object-cover" />
                ) : (
                  <span>{typingCharacter ? typingCharacter.avatar : '🔮'}</span>
                )}
              </div>
              <div className="ml-1">
                <span className="text-[10px] font-bold text-gray-800 block mb-1">
                  {typingCharacter ? formatDisplayName(typingCharacter.name) : 'AI'}
                </span>
                <div className="bg-[#f0f0f0] text-gray-600 px-4 py-3 rounded-[16px] rounded-tl-none border border-gray-100 flex items-center space-x-1.5 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-red-100 border border-red-200 text-red-800 text-[11px] rounded-xl font-medium">
              ⚠️ {errorMessage}
            </div>
          )}

          <div ref={messageEndRef} />
        </div>

        {/* Attached image indicators */}
        {attachedImageName && (
          <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2 text-gray-800">
              <Clock size={11} className="text-gray-400" />
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                [沙盒附图: /images/{attachedImageName}]
              </span>
            </div>
            <button onClick={() => setAttachedImageName(null)} className="p-1 bg-gray-200 hover:bg-gray-300 rounded-full">
              <X size={10} />
            </button>
          </div>
        )}

        {/* Keyboard bottom input drawer */}
        {isMultiSelectMode ? (
          <footer className="bg-slate-900 border-t border-slate-800 px-4 py-3 min-h-[64px] shrink-0 relative z-20 text-white flex items-center justify-between shadow-xl animate-fade-in">
            <div className="flex flex-col">
              <span className="text-[10px] font-black tracking-wider text-slate-400 uppercase">已选择消息</span>
              <span className="text-sm font-extrabold text-emerald-400 font-mono">{selectedMessageIds.length} <span className="text-[11px] text-slate-300 font-sans">条</span></span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  setIsMultiSelectMode(false);
                  setSelectedMessageIds([]);
                }}
                className="flex items-center space-x-1.5 px-3 h-8.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-all cursor-pointer active:scale-95"
              >
                <X size={12} className="stroke-[2.5px]" />
                <span>取消</span>
              </button>
              
              <button
                type="button"
                disabled={selectedMessageIds.length === 0}
                onClick={handleMultiCopy}
                className={`flex items-center space-x-1.5 px-3 h-8.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95 ${
                  selectedMessageIds.length > 0
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 border border-slate-800'
                }`}
              >
                <Copy size={12} />
                <span>合并复制</span>
              </button>
              
              <button
                type="button"
                disabled={selectedMessageIds.length === 0}
                onClick={handleMultiDelete}
                className={`flex items-center space-x-1.5 px-3 h-8.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer active:scale-95 ${
                  selectedMessageIds.length > 0
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50 border border-slate-800'
                }`}
              >
                <Trash2 size={12} />
                <span>合并删除</span>
              </button>
            </div>
          </footer>
        ) : (
          <footer className="bg-[#f0f0f0] border-t border-gray-100 px-4 py-3 min-h-[64px] shrink-0 relative z-10 text-gray-800 input-footer" style={{ backgroundColor: 'var(--theme-footer-bg, #f0f0f0)', borderTopColor: 'var(--theme-footer-border, #f3f4f6)', color: 'var(--theme-text-color, #1f2937)' }}>
            {/* Reply Target Preview Block */}
            {replyTargetMessage && (
              <div className="mb-2.5 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between shadow-sm animate-scale-up">
                <div className="flex items-center space-x-2 min-w-0 flex-1">
                  <CornerUpLeft size={13} className="text-gray-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-extrabold text-gray-700 block mb-0.5">
                      回复 @{replyTargetMessage.role === 'user' ? '我' : formatDisplayName(replyTargetMessage.senderName || activeSession.characterName || 'AI')}
                    </span>
                    <p className="text-[10px] text-gray-500 truncate leading-snug">
                      {(() => {
                        let text = replyTargetMessage.content;
                        const regex = /\[📎 附图: \/images\/(.+?)\]/;
                        text = text.replace(regex, '[图片]').trim();
                        return text;
                      })()}
                    </p>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setReplyTargetMessage(null)} 
                  className="p-1 hover:bg-slate-200 text-gray-400 hover:text-gray-600 rounded-full transition-all cursor-pointer active:scale-90 shrink-0 ml-2"
                >
                  <X size={12} className="stroke-[2.5px]" />
                </button>
              </div>
            )}

            {/* @ Mention Pop-up */}
            {activeSession.isGroup && showMentionPopup && (() => {
              const groupMembers = (activeSession.participants || []).map(id => {
                const detail = getParticipantDetails(id);
                return {
                  id: id,
                  name: detail.name,
                  avatar: detail.avatar
                };
              });
              const filtered = groupMembers.filter(m => {
                const displayName = formatDisplayName(m.name).toLowerCase();
                const query = mentionSearchQuery.toLowerCase();
                return displayName.includes(query);
              });

              return (
                <div className="absolute bottom-full left-3 right-3 bg-[#f0f0f0] border border-gray-200 rounded-xl shadow-xl p-2 mb-1.5 max-h-48 overflow-y-auto z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="text-[10px] font-bold text-gray-400 px-2 pb-1.5 border-b border-gray-100 mb-1">
                    选择要提醒的群成员 (@)
                  </div>
                  <div className="space-y-0.5">
                    {filtered.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectMention(member.name)}
                        className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-gray-50 flex items-center space-x-2 text-xs font-semibold text-gray-700 transition-all cursor-pointer"
                      >
                        <span className="text-sm select-none shrink-0">{member.avatar}</span>
                        <span className="truncate">{formatDisplayName(member.name)}</span>
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-[10px] text-gray-400 p-2 text-center">无匹配的群成员</p>
                    )}
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              
              {/* Extra Function Panel trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowExtraPanel(!showExtraPanel);
                    setShowStickerPanel(false); // Close sticker panel if open
                  }}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border ${showExtraPanel ? 'bg-gray-200 border-gray-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                >
                  <Paperclip size={15} className="text-gray-600" />
                </button>
              </div>

              <input
                type="text"
                value={newMessage}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="输入聊天内容..."
                disabled={isAiReplying}
                className="flex-1 h-9 px-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#3C1E1E]"
              />

              <button
                type="button"
                onClick={() => setShowStickerPanel(!showStickerPanel)}
                className={`w-9 h-9 flex items-center justify-center shrink-0 transition-all ${showStickerPanel ? 'text-[#3C1E1E] scale-110' : 'text-gray-500 hover:text-[#3C1E1E]'}`}
              >
                <Smile size={16} />
              </button>

              <button
                type="submit"
                disabled={(!newMessage.trim() && !attachedImageName) || isAiReplying}
                className="h-9 w-9 rounded-xl disabled:opacity-50 font-bold flex items-center justify-center shrink-0 shadow-sm cursor-pointer transition-all active:scale-95 hover:brightness-95"
                style={{ backgroundColor: 'var(--theme-user-bubble-bg, #FEE500)', color: 'var(--theme-user-bubble-text, #3C1E1E)' }}
              >
                <Send size={15} className="-ml-0.5 mt-0.5" />
              </button>
            </form>

            {showExtraPanel && (
              <div className="mt-3 border-t border-gray-100 pt-4 px-2 pb-1 grid grid-cols-5 gap-2.5 sm:gap-4 animate-in slide-in-from-bottom duration-200" style={{ borderTopColor: 'var(--theme-footer-border, #f3f4f6)' }}>
                {/* 1. Voice Call */}
                <button
                  type="button"
                  onClick={() => {
                    setCallState('dialing');
                    setCallDuration(0);
                    setIsCallMinimized(false);
                    setShowExtraPanel(false);
                  }}
                  className="flex flex-col items-center justify-center active:scale-95 transition-all focus:outline-none"
                >
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-100 flex items-center justify-center mb-1 shadow-sm">
                    <Phone size={18} className="text-blue-500" />
                  </div>
                  <span className="text-[10px] text-gray-500 font-extrabold">通话</span>
                </button>

                {/* 2. Direct Photo */}
                <label className="flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-all">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 flex items-center justify-center mb-1 shadow-sm">
                    <Image size={18} className="text-emerald-500" />
                  </div>
                  <span className="text-[10px] text-gray-500 font-extrabold text-center block">照片</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleDirectImageUpload}
                  />
                </label>

                {/* 3. Money Transfer */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(true);
                    setTransferAmount('');
                    setTransferNote('');
                  }}
                  className="flex flex-col items-center justify-center active:scale-95 transition-all focus:outline-none"
                >
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-100 flex items-center justify-center mb-1 shadow-sm">
                    <Coins size={18} className="text-amber-500" />
                  </div>
                  <span className="text-[10px] text-gray-500 font-extrabold">转账</span>
                </button>

                {/* 4. Long-term Memory */}
                <button
                  type="button"
                  onClick={() => {
                    setCustomMemoryText(activeSession.memory || '');
                    setShowMemoryModal(true);
                  }}
                  className="flex flex-col items-center justify-center active:scale-95 transition-all focus:outline-none"
                >
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-100 flex items-center justify-center mb-1 shadow-sm">
                    <Brain size={18} className="text-purple-500" />
                  </div>
                  <span className="text-[10px] text-gray-500 font-extrabold">长期记忆</span>
                </button>

                {/* 5. Offline Mode */}
                {!activeSession.isGroup && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowOfflineChatWindow(true);
                      setShowExtraPanel(false);
                    }}
                    className="flex flex-col items-center justify-center active:scale-95 transition-all focus:outline-none cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-[#9eccab]/20 hover:bg-[#9eccab]/35 border border-[#9eccab]/50 flex items-center justify-center mb-1 shadow-sm">
                      <Compass size={18} className="text-[#365b40]" />
                    </div>
                    <span className="text-[10px] text-[#284631] font-extrabold">线下模式</span>
                  </button>
                )}
              </div>
            )}

            {/* Floating Sticker/Emoji Panel */}
            {showStickerPanel && (
              <div className="absolute bottom-14 right-3 z-50 bg-[#f0f0f0] border border-gray-200 rounded-2xl shadow-xl w-72 p-3 flex flex-col text-gray-800 animate-in fade-in slide-in-from-bottom-3 duration-200" style={{ borderColor: 'var(--theme-footer-border, #e5e7eb)', backgroundColor: 'var(--theme-footer-bg, #f0f0f0)' }}>
                {/* Panel Header/Tabs */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 mb-2" style={{ borderBottomColor: 'var(--theme-footer-border, #f3f4f6)' }}>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setStickerPanelTab('emoji')}
                      className={`text-[10px] font-extrabold px-2 py-1 rounded-lg transition-all cursor-pointer ${
                        stickerPanelTab === 'emoji' ? 'bg-[#FEE500] text-[#3C1E1E]' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                      style={stickerPanelTab === 'emoji' ? { backgroundColor: 'var(--theme-user-bubble-bg, #FEE500)', color: 'var(--theme-user-bubble-text, #3C1E1E)' } : {}}
                    >
                      常用表情
                    </button>
                    <button
                      type="button"
                      onClick={() => setStickerPanelTab('custom')}
                      className={`text-[10px] font-extrabold px-2 py-1 rounded-lg transition-all cursor-pointer ${
                        stickerPanelTab === 'custom' ? 'bg-[#FEE500] text-[#3C1E1E]' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                      style={stickerPanelTab === 'custom' ? { backgroundColor: 'var(--theme-user-bubble-bg, #FEE500)', color: 'var(--theme-user-bubble-text, #3C1E1E)' } : {}}
                    >
                      自定义表情
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStickerPanel(false)}
                    className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    <X size={10} className="stroke-[2.5px]" />
                  </button>
                </div>

                {/* Tab content */}
                {stickerPanelTab === 'emoji' ? (
                  <div className="grid grid-cols-7 gap-1 max-h-40 overflow-y-auto p-1">
                    {['😂', '😍', '🤔', '😭', '😱', '👍', '🔥', '🎉', '👏', '💔', '💩', '🤡', '🦄', '🐶', '🐱', '🦊', '🍀', '🌸', '☕', '🌟', '🌈', '🥳', '👀', '🤯', '🙏', '💯', '✨', '💤', '🧁', '🍦', '🍩', '🍪', '🍻', '🎈', '🎁'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setNewMessage((prev) => prev + emoji);
                        }}
                        className="text-lg p-1 hover:bg-gray-150 rounded-lg active:scale-90 transition-all select-none text-center cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    {/* Upload button */}
                    <button
                      type="button"
                      onClick={() => stickerInputRef.current?.click()}
                      className="w-full h-8 border border-dashed border-gray-300 rounded-xl flex items-center justify-center space-x-1 hover:bg-gray-50 hover:border-gray-400 active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus size={12} className="text-gray-500" />
                      <span className="text-[10px] font-bold text-gray-600">批量导入/GIF表情包</span>
                    </button>
                    <input
                      type="file"
                      ref={stickerInputRef}
                      accept="image/*,image/gif,.gif"
                      multiple
                      onChange={handleStickerUpload}
                      className="hidden"
                    />

                    {/* Custom Stickers Grid */}
                    <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                      {localSandboxImages.filter(img => img.name.startsWith('sticker_')).length > 0 ? (
                        localSandboxImages.filter(img => img.name.startsWith('sticker_')).map((img) => {
                          const isDeleting = activeDeleteStickerName === img.name;
                          return (
                            <div
                              key={img.name}
                              className={`relative group/sticker aspect-square rounded-lg border bg-gray-50 flex items-center justify-center cursor-pointer overflow-hidden transition-all active:scale-95 shadow-sm select-none ${
                                isDeleting ? 'border-red-500 ring-2 ring-red-400/60' : 'border-gray-100 hover:border-gray-300'
                              }`}
                              onTouchStart={() => handleStickerTouchStart(img.name)}
                              onTouchEnd={handleStickerTouchEnd}
                              onTouchCancel={handleStickerTouchEnd}
                              onTouchMove={handleStickerTouchEnd}
                              onMouseDown={() => handleStickerTouchStart(img.name)}
                              onMouseUp={handleStickerTouchEnd}
                              onMouseLeave={handleStickerTouchEnd}
                              onContextMenu={(e) => handleStickerContextMenu(e, img.name)}
                              onClick={() => handleStickerClick(img.name)}
                            >
                              <img src={img.data} alt="" className="w-full h-full object-cover" />
                              {/* Delete button (only visible on long-press) */}
                              {isDeleting && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSticker(e, img.name);
                                      setActiveDeleteStickerName(null);
                                    }}
                                    className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 rounded-full text-white z-10 cursor-pointer shadow-md scale-110"
                                    title="删除表情"
                                  >
                                    <X size={10} className="stroke-[3px]" />
                                  </button>
                                  <div className="absolute inset-x-0 bottom-0 bg-red-600/90 text-white text-[8px] font-bold text-center py-0.5">
                                    确认删除
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="col-span-4 py-6 text-center text-gray-400 text-[10px]">
                          暂无自定义表情包，点击上方按钮上传
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </footer>
        )}

        {/* Brain configurations configs */}
        <AnimatePresence>
          {showConfigDrawer && (
            <div className="absolute inset-x-0 bottom-0 top-0 z-40 bg-black/60 flex flex-col justify-end">
              <div className="absolute inset-0 -z-10" onClick={() => setShowConfigDrawer(false)} />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="bg-[#f0f0f0] rounded-t-[28px] max-h-[90%] flex flex-col overflow-hidden shadow-2xl relative text-gray-800"
              >
                <div className="h-16 px-4 border-b border-gray-150 flex items-center justify-between shrink-0 bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <Bot size={16} />
                    <h3 className="text-xs font-bold text-gray-900">记忆设定书配置</h3>
                  </div>
                  <button onClick={() => setShowConfigDrawer(false)} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">脑记忆设定 (Character memory)</label>
                    <textarea
                      rows={4}
                      value={activeMemoryInput}
                      onChange={(e) => setActiveMemoryInput(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">世界书背景 (World Book)</label>
                    <textarea
                      rows={4}
                      value={activeWorldBookInput}
                      onChange={(e) => setActiveWorldBookInput(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="h-16 px-4 border-t border-gray-50 bg-gray-50 flex space-x-2">
                  <button onClick={() => setShowConfigDrawer(false)} className="flex-1 h-10 rounded-xl border border-gray-200 bg-[#f0f0f0] text-xs font-bold">取消</button>
                  <button onClick={handleSavePromptsConfig} className="flex-1 h-10 rounded-xl bg-gray-900 text-white text-xs font-bold shadow">确认部署</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- INVITE MEMBERS TO EXISTING GROUP CHAT MODAL --- */}
        {showInviteMembersModal && activeSession && (
          <div className="absolute inset-0 bg-black/60 flex flex-col justify-end z-[9999]">
            <div className="absolute inset-0 -z-10" onClick={() => { setShowInviteMembersModal(false); setSelectedInviteIds([]); }} />
            <div className="bg-[#f0f0f0] rounded-t-[24px] max-h-[85%] flex flex-col overflow-hidden shadow-2xl relative text-gray-800 animate-in slide-in-from-bottom duration-200">
              {/* Header */}
              <div className="h-16 px-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between shrink-0 select-none">
                <div className="flex items-center space-x-2">
                  <UserPlus className="text-gray-900" size={16} />
                  <div>
                    <h3 className="text-xs font-black text-gray-900">邀请新成员</h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">ADD NEW MEMBERS TO GROUP</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowInviteMembersModal(false); setSelectedInviteIds([]); }}
                  className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-gray-700 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Scrollable List */}
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
                    选择要邀请的联系人 (Select Contacts)
                  </label>
                  
                  {(() => {
                    const candidates = sessions.filter(s => {
                      if (s.isGroup) return false;
                      const rawId = s.id.replace('session_', '');
                      return !(activeSession.participants || []).some(pid => pid.replace('session_', '') === rawId);
                    });

                    if (candidates.length > 0) {
                      return (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {candidates.map((charSession) => {
                            const isChecked = selectedInviteIds.includes(charSession.id);
                            return (
                              <button
                                key={charSession.id}
                                type="button"
                                onClick={() => {
                                  if (isChecked) {
                                    setSelectedInviteIds(prev => prev.filter(id => id !== charSession.id));
                                  } else {
                                    setSelectedInviteIds(prev => [...prev, charSession.id]);
                                  }
                                }}
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
                                    <h4 className="text-xs font-black text-gray-900">{formatDisplayName(charSession.characterName)}</h4>
                                    <span className="text-[9px] text-gray-400 font-bold block mt-0.5">{charSession.title}</span>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-1.5 select-none shrink-0">
                                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                    isChecked ? 'bg-[#FEE500] border-[#FEE500] text-[#3C1E1E]' : 'border-gray-300'
                                  }`}>
                                    {isChecked && <Check size={10} className="stroke-[3px]" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    } else {
                      return (
                        <div className="text-center py-6 px-4 border border-dashed border-gray-200 rounded-2xl bg-gray-50/50 space-y-3">
                          <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
                            💡 <strong className="font-extrabold text-gray-800">暂无可邀请的单聊AI伙伴</strong>
                            <br />
                            当前通讯录里所有 AI 伴侣（木子、尼奥）都已经在这个群组中啦，或者您的通讯录为空。
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setShowInviteMembersModal(false);
                              setShowAddContactModal(true);
                            }}
                            className="inline-flex items-center space-x-1.5 px-4 h-8 rounded-xl bg-gray-950 text-white text-[10px] font-bold hover:bg-gray-800 transition-all cursor-pointer shadow-sm active:scale-95"
                          >
                            <Plus size={11} className="stroke-[3px]" />
                            <span>立即新建自定义单聊 AI</span>
                          </button>
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="h-16 px-4 bg-gray-50 border-t border-gray-100 flex space-x-2 justify-end shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => { setShowInviteMembersModal(false); setSelectedInviteIds([]); }}
                  className="h-9 px-4 rounded-xl border border-gray-200 bg-[#f0f0f0] text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={selectedInviteIds.length === 0}
                  onClick={() => {
                    handleInviteMembers(selectedInviteIds);
                    setSelectedInviteIds([]);
                  }}
                  className="h-9 px-4 rounded-xl bg-[#FEE500] hover:bg-[#E5CE00] disabled:opacity-50 text-[#3C1E1E] font-black text-xs transition-all shadow-sm cursor-pointer"
                >
                  确认邀请 ({selectedInviteIds.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 1. IMMERSIVE DECORATIVE VOICE CALL FLOATING WINDOW */}
        {/* ======================================================== */}
        {callState !== 'idle' && isCallMinimized && (
          <div
            onPointerDown={handleCallPointerDown}
            onPointerMove={handleCallPointerMove}
            onPointerUp={handleCallPointerUp}
            style={{
              position: 'absolute',
              left: `${floatingPos.x}px`,
              top: `${floatingPos.y}px`,
              touchAction: 'none',
            }}
            className={`w-28 bg-[#f0f0f0]/95 backdrop-blur-md border border-gray-200 rounded-2xl p-3 flex flex-col items-center justify-center shadow-xl z-[99999] select-none transition-all duration-150 ${
              isLongPressed 
                ? 'scale-110 ring-2 ring-emerald-500 shadow-2xl cursor-grabbing' 
                : 'cursor-pointer active:scale-95 hover:border-gray-300'
            }`}
            title="点击恢复窗口，长按1秒可拖动位置"
          >
            {/* Target Avatar with pulse effect */}
            <div className="relative w-11 h-11 mb-1.5">
              <div className={`absolute inset-0 rounded-xl bg-emerald-500/10 scale-110 ${callState === 'dialing' ? 'animate-ping' : 'animate-pulse'}`} />
              <div className="relative w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center text-lg font-bold select-none">
                {activeSession?.characterAvatar && (activeSession.characterAvatar.startsWith('data:') || activeSession.characterAvatar.startsWith('http')) ? (
                  <img src={activeSession.characterAvatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{activeSession?.characterAvatar || '🔮'}</span>
                )}
              </div>
              {/* Blinking call indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm">
                <Phone size={6} className="text-white font-extrabold fill-current" />
              </div>
            </div>

            <div className="text-center min-w-0 w-full">
              <p className="text-[10px] font-black truncate text-gray-800 leading-tight">
                {activeSession?.characterName || '呼叫中'}
              </p>
              <p className="text-[8px] font-mono text-emerald-600 mt-1 font-bold tracking-wider">
                {callState === 'dialing' ? '呼叫中...' : formatCallDuration(callDuration)}
              </p>
            </div>

            {/* Hold Helper Tip */}
            <div className="text-[7.5px] text-gray-400 mt-1 font-medium scale-90 origin-center opacity-85 select-none">
              {isLongPressed ? '可拖动' : '长按可拖动'}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* 2. FULL SCREEN IMMERSIVE CALL VIEW */}
        {/* ======================================================== */}
        {callState !== 'idle' && !isCallMinimized && (
          <div className="absolute inset-0 bg-[#F6F6F8] flex flex-col justify-between p-8 z-[99998] text-gray-800 animate-in fade-in duration-300 select-none">
            
            {/* Top Status and Minimize control */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsCallMinimized(true)}
                className="w-10 h-10 rounded-full bg-[#f0f0f0] border border-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all hover:bg-gray-50 active:scale-95 focus:outline-none cursor-pointer shadow-sm"
                title="最小化为悬浮窗"
              >
                <Minimize2 size={16} />
              </button>
              <div className="w-10" />
            </div>

            {/* Core Profile Centerpiece with pulse waves */}
            <div className="flex flex-col items-center justify-center flex-1 my-12 relative">
              <div className="absolute w-72 h-72 rounded-full border border-emerald-500/5 flex items-center justify-center animate-ping duration-[3000ms] ease-out" />
              <div className="absolute w-56 h-56 rounded-full border border-emerald-500/10 flex items-center justify-center animate-pulse duration-[2000ms]" />
              <div className="absolute w-40 h-40 rounded-full bg-emerald-500/5 flex items-center justify-center" />

              <div className="relative w-28 h-28 mb-6">
                <div className="absolute inset-0 rounded-[32px] bg-gradient-to-tr from-emerald-500 to-green-400 opacity-20 blur-xl animate-pulse" />
                <div className="relative w-28 h-28 rounded-[32px] bg-[#f0f0f0] border-2 border-gray-200/50 p-1.5 overflow-hidden flex items-center justify-center text-4xl font-bold shadow-xl">
                  <div className="w-full h-full rounded-[24px] overflow-hidden bg-gray-50">
                    {activeSession?.characterAvatar && (activeSession.characterAvatar.startsWith('data:') || activeSession.characterAvatar.startsWith('http')) ? (
                      <img src={activeSession.characterAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {activeSession?.characterAvatar || '🔮'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <h2 className="text-xl font-black tracking-wide text-center text-gray-900">
                {activeSession?.characterName || 'AI 角色'}
              </h2>
              
              <p className="text-xs font-semibold text-gray-400 mt-2 tracking-wider">
                {callState === 'dialing' ? '正在呼叫对方...' : '通话进行中'}
              </p>

              <p className="text-2xl font-mono text-emerald-600 mt-4 tracking-widest font-black">
                {callState === 'dialing' ? 'Dialing...' : formatCallDuration(callDuration)}
              </p>
            </div>

            {/* Bottom control buttons */}
            <div className="w-full max-w-sm mx-auto grid grid-cols-3 gap-4 pb-8">
              <button
                type="button"
                onClick={() => setIsCallMuted(!isCallMuted)}
                className="flex flex-col items-center justify-center focus:outline-none cursor-pointer group"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 transition-all ${isCallMuted ? 'bg-rose-500 text-white shadow-lg' : 'bg-[#f0f0f0] border border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-600 shadow-sm'}`}>
                  {isCallMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </div>
                <span className="text-[10px] text-gray-500 font-bold">{isCallMuted ? '麦克风已关' : '静音'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCallState('idle')}
                className="flex flex-col items-center justify-center focus:outline-none cursor-pointer animate-pulse hover:animate-none"
              >
                <div className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center mb-2 shadow-lg shadow-rose-200 active:scale-95 transition-all text-white">
                  <PhoneOff size={18} />
                </div>
                <span className="text-[10px] text-rose-500 font-bold">挂断</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCallSpeakerOn(!isCallSpeakerOn)}
                className="flex flex-col items-center justify-center focus:outline-none cursor-pointer group"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 transition-all ${isCallSpeakerOn ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-[#f0f0f0] border border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-600 shadow-sm'}`}>
                  <Volume2 size={18} />
                </div>
                <span className="text-[10px] text-gray-500 font-bold">{isCallSpeakerOn ? '扬声器开' : '扬声器关'}</span>
              </button>
            </div>
          </div>
        )}

        {/* --- SIMULATED MONEY TRANSFER MODAL --- */}
        {showTransferModal && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
            <div className="bg-[#f0f0f0] rounded-3xl overflow-hidden w-full max-w-sm text-gray-800 shadow-2xl relative border border-gray-100 flex flex-col">
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white relative">
                <h4 className="text-sm font-black tracking-wide">转账</h4>
                <p className="text-[10px] opacity-90 mt-1">给「{activeSession?.characterName || '对方'}」发起一笔转账</p>
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="absolute top-4 right-4 text-white/80 hover:text-white transition-all focus:outline-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleTransferSubmit} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">转账金额 (元)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-extrabold text-base select-none">¥</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full h-11 pl-8 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:outline-none focus:border-amber-500 text-gray-900"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">添加备注</label>
                  <input
                    type="text"
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="转账"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-gray-800"
                  />
                </div>

                <div className="flex w-full space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="flex-1 h-9 rounded-xl border border-gray-200 bg-[#f0f0f0] hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-all cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-1 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center shadow-md shadow-amber-500/20"
                  >
                    立即转账
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- TRANSFER ACTION MODAL (领取/退回) --- */}
        {selectedTransferMsg && (() => {
          const match = selectedTransferMsg.content.match(/\[💸\s*转账:\s*([^|]+?)\s*\|\s*备注:\s*([^|]+?)\s*\|\s*状态:\s*([^|\]]+?)\]/);
          const amountStr = match ? match[1].trim() : '0.00';
          const noteStr = match ? match[2].trim() : '转账';
          const isAssistant = selectedTransferMsg.role === 'assistant';
          const senderName = isAssistant ? (activeSession?.characterName || '对方') : '我';

          return (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
              <div className="bg-[#f0f0f0] rounded-3xl overflow-hidden w-full max-w-xs text-gray-800 shadow-2xl relative border border-gray-100 flex flex-col items-center p-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center text-2xl font-black shadow-inner">
                  ¥
                </div>

                <div>
                  <h4 className="text-base font-black text-gray-900">{senderName} 的转账</h4>
                  <div className="flex items-baseline justify-center space-x-1 mt-1">
                    <span className="text-sm font-black text-amber-600">¥</span>
                    <span className="text-2xl font-black text-gray-900">{amountStr}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 font-medium px-3 py-1.5 bg-gray-50 rounded-xl border border-gray-100">
                    {noteStr}
                  </p>
                </div>

                <div className="w-full space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const msgToCollect = selectedTransferMsg;
                      setSelectedTransferMsg(null);
                      await handleCollectTransfer(msgToCollect);
                    }}
                    className="w-full h-10 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-105 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-orange-100"
                  >
                    确认领取
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const msgToReturn = selectedTransferMsg;
                      setSelectedTransferMsg(null);
                      await handleReturnTransfer(msgToReturn);
                    }}
                    className="w-full h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    退回转账
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTransferMsg(null)}
                    className="w-full h-8 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* --- LONG-TERM MEMORY SYNAPSE MODAL --- */}
        {showMemoryModal && activeSession && (
          <LongTermMemoryModal
            session={activeSession}
            messages={messages}
            onClose={() => setShowMemoryModal(false)}
            onSave={handleSaveLongTermMemorySession}
          />
        )}

        {/* --- NARRATION MODE MODAL --- */}
        {showNarrationModal && activeSession && (
          <NarrationModeModal
            session={activeSession}
            onClose={() => setShowNarrationModal(false)}
            onSave={handleSaveNarrationModeSession}
          />
        )}

        {/* --- PROACTIVE MESSAGING MODAL --- */}
        {showProactiveModal && activeSession && (
          <ProactiveMessagingModal
            session={activeSession}
            onClose={() => setShowProactiveModal(false)}
            onSave={handleSaveProactiveSession}
          />
        )}

        {/* --- OFFLINE SCENARIO & PLOT CONFIGURATION MODAL --- */}
        {showOfflineModal && activeSession && !activeSession.isGroup && (
          <OfflineScenarioModal
            session={activeSession}
            onClose={() => setShowOfflineModal(false)}
            onSave={async (updatedSession) => {
              await dbInstance.saveSession(updatedSession);
              setActiveSession(updatedSession);
              await reloadSessionsAndLastMsgs();
            }}
            onReloadMessages={async () => {
              const targetChatId = getActiveChatId(activeSession);
              const msgs = await dbInstance.getMessages(targetChatId);
              setMessages(msgs);
            }}
          />
        )}

        {/* --- FULL-SCREEN CHAT SETTINGS PAGE OVERLAY --- */}
        <AnimatePresence>
          {showSettingsMenu && activeSession && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute inset-0 z-[100] bg-[#F6F7F9] flex flex-col font-sans overflow-hidden text-gray-800"
            >
              {/* Full-Screen Settings Header */}
              <div className="h-16 px-4 bg-[#f0f0f0] border-b border-gray-200 flex items-center justify-between shrink-0 shadow-2xs">
                <div className="w-8" />
                <h2 className="text-sm font-black text-gray-900 tracking-wide">
                  {activeSession.isGroup ? '群聊设置' : '聊天设置'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowSettingsMenu(false)}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Settings Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-w-lg mx-auto w-full">
                
                {/* Profile Banner Card */}
                <div className="bg-[#f0f0f0] rounded-2xl p-4 sm:p-5 shadow-2xs border border-gray-150 flex items-center space-x-4">
                  {activeSession.isGroup ? (
                    <div 
                      className="relative group/avatar cursor-pointer shrink-0"
                      onClick={() => groupAvatarInputRef.current?.click()}
                      title="点击更换群头像"
                    >
                      {activeSession.characterAvatar && (activeSession.characterAvatar.startsWith('data:') || activeSession.characterAvatar.startsWith('http') || activeSession.characterAvatar.startsWith('/')) ? (
                        <img
                          src={activeSession.characterAvatar}
                          alt={activeSession.title}
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-gray-200 shadow-2xs group-hover/avatar:opacity-80 transition-opacity"
                        />
                      ) : (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xl border border-gray-200 shadow-2xs group-hover/avatar:opacity-80 transition-opacity">
                          {activeSession.characterAvatar || '👥'}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/35 rounded-2xl opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                        <Camera size={18} className="text-white drop-shadow-sm" />
                      </div>
                      <input
                        ref={groupAvatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleGroupAvatarChange}
                      />
                    </div>
                  ) : (
                    <img
                      src={activeSession.characterAvatar}
                      alt={activeSession.characterName || activeSession.title}
                      className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-gray-200 shadow-2xs shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-black text-gray-900 truncate">
                        {activeSession.isGroup 
                          ? activeSession.title 
                          : formatDisplayName(activeSession.characterName)}
                      </h3>
                      {activeSession.isGroup && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                          群聊
                        </span>
                      )}
                    </div>
                    {(activeSession.isGroup || activeSession.relationship || activeSession.userImpression) && (
                      <p className="text-xs text-gray-500 truncate mt-1">
                        {activeSession.isGroup
                          ? `${activeSession.participants?.length || 0} 位群成员`
                          : activeSession.relationship || activeSession.userImpression}
                      </p>
                    )}
                  </div>
                </div>

                {/* 1. 消息与功能偏好 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-gray-400 px-1 uppercase tracking-wider">
                    消息与偏好设置
                  </span>
                  <div className="bg-[#f0f0f0] rounded-2xl shadow-2xs border border-gray-150 overflow-hidden divide-y divide-gray-100">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <Clock size={16} />
                        </div>
                        <div>
                          <span className="text-xs font-black text-gray-900 block">AI感知显示时间</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">向 AI 注入当前真实日期、星期与作息感知</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleToggleTimePerception}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          activeSession.timePerceptionEnabled !== false ? 'bg-[#FEE500]' : 'bg-gray-200'
                        }`}
                        style={activeSession.timePerceptionEnabled !== false ? { backgroundColor: 'var(--theme-user-bubble-bg, #FEE500)' } : {}}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#f0f0f0] shadow-md ring-0 transition duration-200 ease-in-out ${
                            activeSession.timePerceptionEnabled !== false ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <Smile size={16} />
                        </div>
                        <div>
                          <span className="text-xs font-black text-gray-900 block">识别表情包内容</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">自动解析聊天中的表情包与图文细节</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsStickerRecognitionEnabled(!isStickerRecognitionEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isStickerRecognitionEnabled ? 'bg-[#FEE500]' : 'bg-gray-200'
                        }`}
                        style={isStickerRecognitionEnabled ? { backgroundColor: 'var(--theme-user-bubble-bg, #FEE500)' } : {}}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#f0f0f0] shadow-md ring-0 transition duration-200 ease-in-out ${
                            isStickerRecognitionEnabled ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {activeSession.isGroup && (
                      <div className="p-4 space-y-2">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                            <Bot size={16} />
                          </div>
                          <div>
                            <span className="text-xs font-black text-gray-900 block">群聊发言模式</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">选择群内成员的响应机制</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pt-1 pl-11">
                          <button
                            type="button"
                            onClick={() => setSpeakerMode('loop')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              speakerMode === 'loop'
                                ? 'bg-[#FEE500] text-[#3C1E1E] border-[#FEE500] shadow-2xs'
                                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            全部发言 (All)
                          </button>
                          <button
                            type="button"
                            onClick={() => setSpeakerMode('random')}
                            className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              speakerMode === 'random'
                                ? 'bg-[#FEE500] text-[#3C1E1E] border-[#FEE500] shadow-2xs'
                                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                            }`}
                          >
                            随机发言
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 1.5. 今日穿搭 / 专属衣柜 (单人角色专属) */}
                {!activeSession.isGroup && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                        今日穿搭 / 专属衣柜
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        已收录 {activeSession.wardrobe?.length || 0} 套
                      </span>
                    </div>

                    <div className="bg-[#f0f0f0] rounded-2xl p-4 shadow-2xs border border-gray-150 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <Shirt size={16} />
                          </div>
                          <div>
                            <span className="text-xs font-black text-gray-900 block">角色专属衣柜</span>
                            <span className="text-[10px] text-gray-400 block mt-0.5">上传角色的穿搭照片，AI 在聊天中可展示今日穿搭</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => wardrobeInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 shrink-0 border border-amber-200 shadow-2xs active:scale-95"
                        >
                          <Plus size={14} className="stroke-[2.5px]" />
                          <span>添加穿搭</span>
                        </button>
                        <input
                          ref={wardrobeInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleUploadWardrobePhoto}
                        />
                      </div>

                      {/* Wardrobe Photo Gallery Grid */}
                      {activeSession.wardrobe && activeSession.wardrobe.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 pt-1">
                          {activeSession.wardrobe.map((imgSrc, idx) => (
                            <div
                              key={idx}
                              className="relative group/outfit aspect-[3/4] rounded-xl overflow-hidden border border-gray-200 bg-gray-50 shadow-2xs cursor-pointer"
                              onClick={() => setPreviewImageUrl(imgSrc)}
                            >
                              <img src={imgSrc} alt={`穿搭 ${idx + 1}`} className="w-full h-full object-cover transition-transform group-hover/outfit:scale-105" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteWardrobePhoto(idx);
                                }}
                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-md transition-opacity cursor-pointer opacity-90 sm:opacity-0 sm:group-hover/outfit:opacity-100"
                                title="删除该穿搭"
                              >
                                <X size={12} className="stroke-[3px]" />
                              </button>
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 text-center pointer-events-none">
                                <span className="text-[9px] font-bold text-white tracking-wide">套装 #{idx + 1}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div 
                          onClick={() => wardrobeInputRef.current?.click()}
                          className="py-6 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center space-y-1.5 cursor-pointer hover:border-amber-400 hover:bg-amber-50/20 transition-all text-gray-400 hover:text-amber-700"
                        >
                          <Shirt size={22} className="opacity-60" />
                          <span className="text-xs font-bold">衣柜空空如也，点击上传第 1 套穿搭</span>
                          <span className="text-[10px] opacity-70">支持上传单张或批量穿搭照片</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. 高级模式与功能 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-gray-400 px-1 uppercase tracking-wider">
                    聊天扩展功能
                  </span>
                  <div className="bg-[#f0f0f0] rounded-2xl shadow-2xs border border-gray-150 overflow-hidden divide-y divide-gray-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSearch(!showSearch);
                        setShowSettingsMenu(false);
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                          <Search size={16} />
                        </div>
                        <span className="text-xs font-black text-gray-900">搜索聊天记录</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowNarrationModal(true);
                        setShowSettingsMenu(false);
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                          <MessageSquareQuote size={16} />
                        </div>
                        <span className="text-xs font-black text-gray-900">旁白模式</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProactiveModal(true);
                        setShowSettingsMenu(false);
                      }}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                          <BellRing size={16} />
                        </div>
                        <span className="text-xs font-black text-gray-900">挂机主动呼叫</span>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* 3. 角色/群组设定管理 */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-gray-400 px-1 uppercase tracking-wider">
                    {activeSession.isGroup ? '群组管理' : '角色管理'}
                  </span>
                  <div className="bg-[#f0f0f0] rounded-2xl shadow-2xs border border-gray-150 overflow-hidden divide-y divide-gray-100">
                    {activeSession.isGroup ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowInviteMembersModal(true);
                          setShowSettingsMenu(false);
                        }}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <UserPlus size={16} />
                          </div>
                          <span className="text-xs font-black text-gray-900">添加新成员</span>
                        </div>
                        <ChevronRight size={16} className="text-gray-400" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSettingsMenu(false);
                          setSelectedContactDetail(activeSession);
                          setIsEditingSelectedContact(true);
                        }}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Edit size={16} />
                          </div>
                          <span className="text-xs font-black text-gray-900">编辑角色设定</span>
                        </div>
                        <ChevronRight size={16} className="text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. 危险区 */}
                <div className="space-y-1.5 pt-2">
                  <div className="bg-[#f0f0f0] rounded-2xl shadow-2xs border border-rose-100 overflow-hidden divide-y divide-rose-50">
                    <button
                      type="button"
                      onClick={() => {
                        handleClearAllMessages(activeSession.id);
                        setShowSettingsMenu(false);
                      }}
                      className="w-full p-4 flex items-center space-x-3 hover:bg-rose-50/50 transition-colors text-left cursor-pointer text-rose-600"
                    >
                      <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                        <Trash2 size={16} />
                      </div>
                      <span className="text-xs font-black">清空当前聊天记录</span>
                    </button>

                    {activeSession.isGroup ? (
                      <button
                        type="button"
                        onClick={() => {
                          handleDisbandGroupChat(activeSession.id, activeSession.title);
                          setShowSettingsMenu(false);
                        }}
                        className="w-full p-4 flex items-center space-x-3 hover:bg-rose-50/50 transition-colors text-left cursor-pointer text-rose-600"
                      >
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <LogOut size={16} />
                        </div>
                        <span className="text-xs font-black">解散群聊</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteContact(activeSession.id, formatDisplayName(activeSession.characterName));
                          setShowSettingsMenu(false);
                        }}
                        className="w-full p-4 flex items-center space-x-3 hover:bg-rose-50/50 transition-colors text-left cursor-pointer text-rose-600"
                      >
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <UserMinus size={16} />
                        </div>
                        <span className="text-xs font-black">删除此联系人</span>
                      </button>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- OFFLINE CHAT WINDOW OVERLAY --- */}
        {showOfflineChatWindow && activeSession && !activeSession.isGroup && (
          <OfflineChatWindow
            session={activeSession}
            onClose={() => setShowOfflineChatWindow(false)}
            onSaveSession={async (updatedSession) => {
              await dbInstance.saveSession(updatedSession);
              setActiveSession(updatedSession);
              await reloadSessionsAndLastMsgs();
            }}
            onReloadMainMessages={async () => {
              const targetChatId = getActiveChatId(activeSession);
              const msgs = await dbInstance.getMessages(targetChatId);
              setMessages(msgs);
            }}
          />
        )}

        {confirmModal && confirmModal.isOpen && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
            <div className="bg-[#f0f0f0] rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative space-y-4 text-gray-800">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto select-none">
                <Trash size={20} />
              </div>
              <h4 className="text-sm font-bold text-gray-900 font-sans">{confirmModal.title}</h4>
              <p className="text-[11px] text-gray-500 leading-relaxed font-sans px-2">
                {confirmModal.description}
              </p>
              <div className="flex w-full space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 h-9 rounded-xl border border-gray-200 bg-[#f0f0f0] hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => confirmModal.onConfirm()}
                  className="flex-1 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center shadow-md shadow-rose-100"
                >
                  确认
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- CONTACT DETAILED POPUP CARD IN CHAT ROOM --- */}
        <ContactDetailModal
          contact={selectedContactDetail}
          initialEditing={isEditingSelectedContact}
          onClose={() => {
            setSelectedContactDetail(null);
            setIsEditingSelectedContact(false);
          }}
          onSendMessage={() => {
            if (selectedContactDetail) {
              handleSelectSession(selectedContactDetail);
              setCurrentTab('chats');
              setSelectedContactDetail(null);
              setIsEditingSelectedContact(false);
            }
          }}
          onDelete={async () => {
            if (selectedContactDetail) {
              await dbInstance.deleteSession(selectedContactDetail.id);
              if (activeSession?.id === selectedContactDetail.id) {
                setActiveSession(null);
              }
              await reloadSessionsAndLastMsgs();
              setSelectedContactDetail(null);
              setIsEditingSelectedContact(false);
            }
          }}
          onEdit={async (id, fields) => {
            const existing = sessions.find((s) => s.id === id);
            if (!existing) return;

            const titleStr = `${fields.relationship} - ${fields.realName}`;
            const worldPrompt = `身处于温馨真实的日常现实场景中。你与用户的关系是 ${fields.relationship}。`;

            const updatedSession: ChatSession = {
              ...existing,
              title: titleStr,
              characterName: fields.nickname,
              characterAvatar: fields.avatar,
              memory: fields.background.trim(),
              worldBook: worldPrompt,
              realName: fields.realName,
              gender: fields.gender,
              patience: fields.patience,
              relationship: fields.relationship,
              userImpression: fields.userImpression?.trim() || '',
              updatedAt: Date.now()
            };

            try {
              await dbInstance.saveSession(updatedSession);
              await reloadSessionsAndLastMsgs();
              if (activeSession?.id === updatedSession.id) {
                setActiveSession(updatedSession);
              }
              setSelectedContactDetail(null);
              setIsEditingSelectedContact(false);
            } catch (e) {
              alert('保存修改后的设定时遇到本地 IndexedDB 错误。');
            }
          }}
          localSandboxImages={localSandboxImages}
          onRefreshImages={handleRefreshImages}
          moments={moments}
          onLikeMoment={handleLikeMoment}
          onDeleteMoment={handleDeleteMoment}
          onAddComment={handleAddComment}
        />

        {/* Full Image Preview Modal */}
        <AnimatePresence>
          {previewImageUrl && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImageUrl(null)}
              className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 select-none cursor-pointer"
            >
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#f0f0f0]/20 hover:bg-[#f0f0f0]/30 text-white flex items-center justify-center transition-all cursor-pointer z-10 shadow-lg active:scale-95"
                title="关闭预览"
              >
                <X size={20} className="stroke-[2.5px]" />
              </button>
              
              <div 
                className="relative max-w-full max-h-[85vh] flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={previewImageUrl}
                  alt="穿搭大图"
                  className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit Chat Message Modal */}
        {editingChatMessage && (
          <div 
            className="absolute inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#f0f0f0] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl border border-gray-100">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h4 className="text-sm font-black text-gray-900">编辑消息内容</h4>
                <button
                  type="button"
                  onClick={() => setEditingChatMessage(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <textarea
                value={editChatMessageText}
                onChange={(e) => setEditChatMessageText(e.target.value)}
                rows={6}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#9eccab] focus:bg-[#f0f0f0] transition-all leading-relaxed"
                placeholder="修改消息内容..."
              />

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingChatMessage(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditMessage}
                  disabled={!editChatMessageText.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                >
                  保存修改
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Picker Modal with Free Cropper & Multi-Select */}
        <ImagePickerModal
          isOpen={isChatPickerOpen}
          initialImages={pendingChatPickerImages}
          onClose={() => setIsChatPickerOpen(false)}
          onSend={handleChatPickerSend}
          title="选择聊天图片"
          sendButtonText="发送给好友"
        />

      </div>
    );
  }

  // 2. WECHAT MAIN TAB INTERFACE (If activeSession is null)
  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-[#f0f0f0] text-gray-800 app-container" style={{ backgroundColor: 'var(--theme-main-bg, #f0f0f0)', color: 'var(--theme-text-color, #1f2937)' }}>
      <style id="dynamic-theme">{customThemeCss}</style>
      
      {/* Dynamic Header for each specific Tab */}
      <header className="h-16 px-4 bg-[#f0f0f0] border-b border-gray-100 flex items-center justify-between shrink-0 select-none tab-header" style={{ backgroundColor: 'var(--theme-header-bg, #f0f0f0)', borderColor: 'var(--theme-header-border, #f3f4f6)', color: 'var(--theme-header-text, #111827)' }}>
        <div className="flex items-center space-x-2">
          {onHome && (
            <button
              type="button"
              onClick={onHome}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shrink-0 mr-2"
              title="返回手机桌面"
              style={{ backgroundColor: 'var(--theme-button-bg, #f8fafc)', borderColor: 'var(--theme-button-border, #e2e8f0)', color: 'var(--theme-button-text, #334155)' }}
            >
              <Home size={16} className="stroke-[2.5]" />
            </button>
          )}
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            {currentTab === 'chats' && '消息'}
            {currentTab === 'contacts' && '联系人'}
            {currentTab === 'moments' && '动态'}
            {currentTab === 'me' && '个人中心'}
          </h2>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-1.5">
          {currentTab === 'chats' && (
            <button
              type="button"
              onClick={() => setShowCreateGroupModal(true)}
              className="w-8 h-8 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-all cursor-pointer"
              title="拉人建群聊"
            >
              <Plus size={16} />
            </button>
          )}
          {currentTab === 'contacts' && (
            <button
              type="button"
              onClick={() => setShowAddContactModal(true)}
              className="w-8 h-8 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-all cursor-pointer"
              title="添加新AI伴侣"
            >
              <Plus size={16} />
            </button>
          )}
          {currentTab === 'moments' && (
            <div className="flex space-x-1 items-center">
              <button
                type="button"
                onClick={() => setShowPublishMomentModal(true)}
                className="w-8 h-8 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-all cursor-pointer mr-0.5"
                title="发布新动态"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={handleFreshTimelineSync}
                disabled={isRefreshingMoments}
                className="w-8 h-8 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100"
                title="刷新并生成新动态"
              >
                <RefreshCw size={14} className={isRefreshingMoments ? 'animate-spin' : ''} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Tab Content scrollable panels */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Tab 1: CHATS LIST */}
        {currentTab === 'chats' && (
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 chats-panel" style={{ backgroundColor: 'var(--theme-panel-bg, #f9fafb)' }}>
            {sessions.filter(s => !s.isChatHidden).length > 0 ? (
              sessions.filter(s => !s.isChatHidden).map((session) => (
                <div key={session.id} className="relative group w-full">
                  <button
                    type="button"
                    onClick={() => handleSelectSession(session)}
                    className="w-full p-4 pr-12 flex items-center space-x-4 hover:bg-gray-50/50 text-left transition-colors cursor-pointer border-b border-gray-100/50 bg-[#f0f0f0]"
                    style={{ backgroundColor: 'var(--theme-card-bg, #f0f0f0)', borderBottomColor: 'var(--theme-card-border, #f3f4f6)' }}
                  >
                    <div className="w-12 h-12 rounded-[16px] bg-slate-100 border border-slate-200/60 flex items-center justify-center text-2xl shadow-sm shrink-0 select-none overflow-hidden">
                      {session.characterAvatar === '__stacked__' ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <div className="absolute top-1 left-1 w-7 h-7 rounded-full bg-amber-200 border border-white flex items-center justify-center text-xs font-bold text-amber-800 shadow-sm">
                            👤
                          </div>
                          <div className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-indigo-200 border border-white flex items-center justify-center text-xs font-bold text-indigo-800 shadow-sm">
                            🤖
                          </div>
                        </div>
                      ) : session.characterAvatar && (session.characterAvatar.startsWith('data:') || session.characterAvatar.startsWith('http')) ? (
                        <img src={session.characterAvatar} alt={session.characterName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{session.characterAvatar || '🔮'}</span>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <h4 className="text-xs font-bold text-gray-900 truncate pr-4">
                          {session.isGroup ? `✨ ${session.title}` : formatDisplayName(session.characterName)}
                        </h4>
                        <span className="text-[9px] font-mono text-gray-400 shrink-0">
                          {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-gray-400 font-medium truncate">
                        {lastMessages[session.id] || ''}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteChatSession(session.id, session.isGroup ? session.title : formatDisplayName(session.characterName), e)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-rose-50/0 hover:bg-rose-50 text-gray-400 hover:text-rose-600 flex items-center justify-center opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-all cursor-pointer z-10"
                    title="删除聊天窗"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              ))
            ) : (
              <div className="py-24 text-center text-gray-400 text-xs">暂无对话记录。</div>
            )}
          </div>
        )}

        {/* Tab 2: CONTACTS LIST */}
        {currentTab === 'contacts' && (
          <div className="flex-1 flex flex-col overflow-hidden contacts-panel bg-[#f9fafb]" style={{ backgroundColor: 'var(--theme-panel-bg, #f9fafb)' }}>
            {/* Sub-tab selection bar imitating QQ/WeChat style - fixed dark text for high visibility across themes */}
            <div className="flex border-b border-gray-200 shrink-0 bg-[#f0f0f0]">
              <button
                type="button"
                onClick={() => setContactsSubTab('friends')}
                className={`flex-1 py-3 text-center text-xs font-bold transition-all relative ${
                  contactsSubTab === 'friends' ? 'text-gray-900 font-extrabold font-sans' : 'text-gray-500 hover:text-gray-800 font-sans'
                }`}
                style={{ color: contactsSubTab === 'friends' ? '#111827' : '#6b7280' }}
              >
                <span>好友</span>
                {contactsSubTab === 'friends' && (
                  <motion.div 
                    layoutId="contacts_sub_tab_bar" 
                    className="absolute bottom-0 inset-x-8 h-0.5 bg-gray-900 rounded-full" 
                    style={{ backgroundColor: '#111827' }}
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => setContactsSubTab('groups')}
                className={`flex-1 py-3 text-center text-xs font-bold transition-all relative ${
                  contactsSubTab === 'groups' ? 'text-gray-900 font-extrabold font-sans' : 'text-gray-500 hover:text-gray-800 font-sans'
                }`}
                style={{ color: contactsSubTab === 'groups' ? '#111827' : '#6b7280' }}
              >
                <span>多人群组</span>
                {contactsSubTab === 'groups' && (
                  <motion.div 
                    layoutId="contacts_sub_tab_bar" 
                    className="absolute bottom-0 inset-x-8 h-0.5 bg-gray-900 rounded-full" 
                    style={{ backgroundColor: '#111827' }}
                  />
                )}
              </button>
            </div>

            {/* Scrollable list contents */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {contactsSubTab === 'friends' ? (
                sessions.filter(s => !s.isGroup).length > 0 ? (
                  sessions.filter(s => !s.isGroup).map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      onClick={() => setSelectedContactDetail(contact)}
                      className="w-full p-4 flex items-center space-x-4 hover:bg-gray-50/50 text-left transition-colors cursor-pointer bg-[#f0f0f0] border-b border-gray-100/50"
                      style={{ backgroundColor: 'var(--theme-card-bg, #f0f0f0)', borderBottomColor: 'var(--theme-card-border, #f3f4f6)' }}
                    >
                      <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center text-2xl shadow-sm shrink-0 overflow-hidden select-none">
                        {contact.characterAvatar && (contact.characterAvatar.startsWith('data:') || contact.characterAvatar.startsWith('http')) ? (
                          <img src={contact.characterAvatar} alt={contact.characterName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{contact.characterAvatar || '👤'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-gray-900" style={{ color: 'var(--theme-text-color, #111827)' }}>{formatDisplayName(contact.characterName)}</h4>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-24 text-center text-gray-400 text-xs font-sans">通讯录空空如也，请点击加号创建角色设定！</div>
                )
              ) : (
                /* Group sub-tab content */
                sessions.filter(s => s.isGroup).length > 0 ? (
                  sessions.filter(s => s.isGroup).map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => {
                        handleSelectSession(group);
                        setCurrentTab('chats');
                      }}
                      className="w-full p-4 flex items-center space-x-4 hover:bg-gray-50/50 text-left transition-colors cursor-pointer bg-[#f0f0f0] border-b border-gray-100/50"
                      style={{ backgroundColor: 'var(--theme-card-bg, #f0f0f0)', borderBottomColor: 'var(--theme-card-border, #f3f4f6)' }}
                    >
                      <div className="w-11 h-11 rounded-[12px] bg-slate-100 border border-slate-200/60 flex items-center justify-center text-2xl shadow-sm shrink-0 overflow-hidden select-none relative">
                        {group.characterAvatar === '__stacked__' ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <div className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-amber-200 border border-white flex items-center justify-center text-[10px] font-bold text-amber-800 shadow-sm">
                              👤
                            </div>
                            <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-indigo-200 border border-white flex items-center justify-center text-[10px] font-bold text-indigo-800 shadow-sm">
                              🤖
                            </div>
                          </div>
                        ) : group.characterAvatar && (group.characterAvatar.startsWith('data:') || group.characterAvatar.startsWith('http')) ? (
                          <img src={group.characterAvatar} alt={group.title} className="w-full h-full object-cover" />
                        ) : (
                          <span>{group.characterAvatar || '👥'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-gray-900" style={{ color: 'var(--theme-text-color, #111827)' }}>{group.title}</h4>
                        <p className="text-[10px] text-gray-400 font-semibold truncate mt-0.5">
                          {(group.participants || []).length || 2} 个群成员：{(group.participants || []).map(pId => {
                            const found = sessions.find(s => s.id === `session_${pId}` || s.id === pId);
                            return found ? formatDisplayName(found.characterName) : pId;
                          }).join('、')}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-24 text-center text-gray-400 text-xs font-sans">暂无已建立的群聊，您可以在消息标签页点击右上角加号建群。</div>
                )
              )}
            </div>
          </div>
        )}

        {/* Tab 3: MOMENTS TIMELINE */}
        {currentTab === 'moments' && (
          <div className="flex-1 overflow-y-auto bg-gray-100/50 p-4 space-y-4 moments-panel" style={{ backgroundColor: 'var(--theme-panel-bg, #f3f4f6)' }}>
            {moments.length > 0 ? (
              moments.map((mom) => (
                <div key={mom.id} className="bg-[#f0f0f0] p-4 rounded-[16px] border border-gray-100 shadow-sm space-y-3 relative moments-card" style={{ backgroundColor: 'var(--theme-card-bg, #f0f0f0)', borderColor: 'var(--theme-card-border, #f3f4f6)' }}>
                  
                  <div className="flex items-center justify-between select-none">
                    <div 
                      onClick={() => handleOpenCharacterMoments(mom.characterName)}
                      className="flex items-center space-x-2.5 cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-xl select-none shrink-0 shadow-sm overflow-hidden group-hover:opacity-90 transition-opacity">
                        {mom.characterAvatar && (mom.characterAvatar.startsWith('data:') || mom.characterAvatar.startsWith('http')) ? (
                          <img src={mom.characterAvatar} alt={mom.characterName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{mom.characterAvatar}</span>
                        )}
                      </div>
                      <div className="leading-tight">
                        <span className="text-xs font-bold text-gray-900 group-hover:text-blue-600 group-hover:underline transition-colors block">{formatDisplayName(mom.characterName)}</span>
                        <span className="text-[9px] font-mono text-gray-400 block mt-0.5">
                          {new Date(mom.timestamp).toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMoment(mom.id)}
                      className="w-7 h-7 rounded-full hover:bg-rose-50 text-gray-300 hover:text-rose-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title="删除动态"
                    >
                      <Trash size={12} />
                    </button>
                  </div>

                  <p className="text-xs text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">{mom.content}</p>

                  {mom.imageName && (
                    <div className="rounded-[12px] overflow-hidden max-h-48 border border-gray-150 bg-gray-50">
                      {(() => {
                        const imageObj = localSandboxImages.find(img => img.name === mom.imageName);
                        if (imageObj) {
                          return <img src={imageObj.data} alt="Visual" className="w-full h-full object-cover" />;
                        }
                        return <div className="p-4 text-center text-[9px] text-gray-400">本地图片: {mom.imageName}</div>;
                      })()}
                    </div>
                  )}

                  <div className="flex items-center space-x-4 border-t border-gray-50 pt-2 text-gray-400 select-none">
                    <button
                      type="button"
                      onClick={() => handleLikeMoment(mom.id)}
                      className={`flex items-center space-x-1.5 text-[11px] font-bold transition-colors cursor-pointer ${mom.likedByMe ? 'text-rose-600' : 'text-gray-400 hover:text-rose-500'}`}
                    >
                      <Heart size={13} fill={mom.likedByMe ? "currentColor" : "none"} className={mom.likedByMe ? "text-rose-600" : ""} />
                      <span>{mom.likes} 赞</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveCommentInputId(prev => prev === mom.id ? null : mom.id)}
                      className={`flex items-center space-x-1 px-2.5 py-1 text-[10px] font-bold border rounded-[8px] transition-all cursor-pointer ${activeCommentInputId === mom.id ? 'bg-gray-200 border-gray-300 text-gray-900 shadow-inner' : 'bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-100 shadow-sm'}`}
                    >
                      <MessageSquare size={11} className="mr-0.5 text-gray-400 shrink-0" />
                      <span>{mom.comments ? mom.comments.length : (mom.commentsCount || 0)} 评论</span>
                    </button>
                  </div>

                  {/* Comments List */}
                  {mom.comments && mom.comments.length > 0 && (
                    <div className="bg-gray-50 rounded-[12px] p-2.5 mt-2 space-y-1 text-[11px] border border-gray-100/60 select-text">
                      {mom.comments.map((comm) => (
                        <div 
                          key={comm.id} 
                          onClick={() => setSelectedCommentTarget({ momentId: mom.id, comment: comm })}
                          className="text-gray-700 leading-normal p-1 rounded hover:bg-gray-200/60 transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCharacterMoments(comm.senderName);
                              }}
                              className="font-extrabold text-gray-900 cursor-pointer hover:underline hover:text-blue-600"
                            >
                              {formatDisplayName(comm.senderName)}
                            </span>
                            {comm.replyTo ? (
                              <>
                                <span className="text-gray-400 mx-1">回复</span>
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenCharacterMoments(comm.replyTo!);
                                  }}
                                  className="font-extrabold text-gray-900 cursor-pointer hover:underline hover:text-blue-600"
                                >
                                  {formatDisplayName(comm.replyTo)}
                                </span>
                              </>
                            ) : null}
                            <span className="text-gray-900 ml-0.5">
                              ：{comm.content}
                            </span>
                            <span className="text-[8px] text-gray-400 ml-2 font-mono whitespace-nowrap">
                              {new Date(comm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline comment form */}
                  {activeCommentInputId === mom.id && (
                    <form 
                      onSubmit={(e) => { 
                        e.preventDefault(); 
                        handleAddComment(mom.id, commentInputs[mom.id] || ''); 
                      }} 
                      className="mt-2 space-y-1 animate-in fade-in duration-200"
                    >
                      {replyToMap[mom.id] && (
                        <div className="flex items-center justify-between bg-blue-50 px-2 py-0.5 rounded text-[10px] text-blue-700 font-bold">
                          <span>回复 @{formatDisplayName(replyToMap[mom.id] || '')}</span>
                          <button
                            type="button"
                            onClick={() => setReplyToMap(prev => ({ ...prev, [mom.id]: undefined }))}
                            className="text-blue-500 hover:text-blue-900 font-bold px-1 rounded cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder={replyToMap[mom.id] ? `回复 @${formatDisplayName(replyToMap[mom.id] || '')}...` : "写一条评论..."}
                          value={commentInputs[mom.id] || ''}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [mom.id]: e.target.value }))}
                          className="flex-1 h-8 px-3 bg-gray-50 border border-gray-150 rounded-[10px] text-[11px] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:bg-[#f0f0f0] transition-all font-sans font-medium"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="h-8 px-3 bg-gray-950 hover:bg-gray-800 text-white text-[10px] font-bold rounded-[10px] transition-colors cursor-pointer shrink-0"
                        >
                          发送
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-24 text-gray-400 text-xs">
                朋友圈空荡荡。
              </div>
            )}
          </div>
        )}

        {/* Tab 4: ME PROFILE EDIT PANEL */}
        {currentTab === 'me' && (
          <div className="flex-1 flex flex-col overflow-hidden relative me-panel" style={{ backgroundColor: 'var(--theme-panel-bg, #f9fafb)' }}>
            <UserProfilePanel 
              localSandboxImages={localSandboxImages} 
              onRefreshImages={handleRefreshImages} 
            />
          </div>
        )}

      </div>

      {/* WECHAT BOTTOM BAR CONTROLLER */}
      <footer className="h-16 bg-[#f0f0f0] border-t border-gray-100 flex justify-around items-center py-2 px-4 shrink-0 shadow-sm relative z-10 select-none nav-footer" style={{ backgroundColor: 'var(--theme-footer-bg, #f0f0f0)', borderTopColor: 'var(--theme-footer-border, #f3f4f6)' }}>
        {[
          { id: 'chats', label: '消息', icon: MessageSquare },
          { id: 'contacts', label: '联系人', icon: Users },
          { id: 'moments', label: '动态', icon: Compass },
          { id: 'me', label: '我', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCurrentTab(tab.id as "moments" | "me" | "chats" | "contacts");
                if (tab.id === 'moments') {
                  dbInstance.getAllMoments().then(list => setMoments(list)).catch(console.error);
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all cursor-pointer bg-[#f0f0f0] border-none ${
                isSelected 
                  ? 'text-slate-900 font-extrabold scale-105' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              style={{ 
                color: isSelected ? 'var(--theme-footer-active, #0f172a)' : 'var(--theme-footer-text, #9ca3af)',
                backgroundColor: 'var(--theme-footer-bg, #f0f0f0)'
              }}
            >
              <Icon size={20} className={isSelected ? 'stroke-[2.5px]' : 'stroke-[1.8px]'} />
              <span className="text-[10px] mt-1 tracking-wide">{tab.label}</span>
            </button>
          );
        })}
      </footer>

      {/* --- ADD NEW CONTACT SETTING MODAL --- */}
      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        localSandboxImages={localSandboxImages}
        onRefreshImages={handleRefreshImages}
        onSave={handleAddCharacterSave}
      />

      {/* --- CONTACT DETAILED POPUP CARD --- */}
      <ErrorBoundary fallbackTitle="联系人详情卡片加载遇到错误">
        <ContactDetailModal
          contact={selectedContactDetail}
          initialEditing={isEditingSelectedContact}
          initialShowMomentsPage={initialShowMomentsPage}
          onClose={() => {
            setSelectedContactDetail(null);
            setIsEditingSelectedContact(false);
            setInitialShowMomentsPage(false);
          }}
          onSendMessage={() => {
            if (selectedContactDetail) {
              handleSelectSession(selectedContactDetail);
              setCurrentTab('chats');
              setSelectedContactDetail(null);
              setIsEditingSelectedContact(false);
              setInitialShowMomentsPage(false);
            }
          }}
          onDelete={async () => {
            if (selectedContactDetail) {
              await dbInstance.deleteSession(selectedContactDetail.id);
              if (activeSession?.id === selectedContactDetail.id) {
                setActiveSession(null);
              }
              await reloadSessionsAndLastMsgs();
              setSelectedContactDetail(null);
              setIsEditingSelectedContact(false);
              setInitialShowMomentsPage(false);
            }
          }}
          onEdit={async (id, fields) => {
            const existing = sessions.find((s) => s.id === id);
            if (!existing) return;

            const titleStr = `${fields.relationship} - ${fields.realName}`;
            const worldPrompt = `身处于温馨真实的日常现实场景中。你与用户的关系是 ${fields.relationship}。`;

            const updatedSession: ChatSession = {
              ...existing,
              title: titleStr,
              characterName: fields.nickname,
              characterAvatar: fields.avatar,
              memory: fields.background.trim(),
              worldBook: worldPrompt,
              realName: fields.realName,
              gender: fields.gender,
              patience: fields.patience,
              relationship: fields.relationship,
              userImpression: fields.userImpression?.trim() || '',
              updatedAt: Date.now()
            };

            try {
              await dbInstance.saveSession(updatedSession);
              await reloadSessionsAndLastMsgs();
              if (activeSession?.id === updatedSession.id) {
                setActiveSession(updatedSession);
              }
              setSelectedContactDetail(null);
              setIsEditingSelectedContact(false);
              setInitialShowMomentsPage(false);
            } catch (e) {
              alert('保存修改后的设定时遇到本地 IndexedDB 错误。');
            }
          }}
          localSandboxImages={localSandboxImages}
          onRefreshImages={handleRefreshImages}
          moments={moments}
          onLikeMoment={handleLikeMoment}
          onDeleteMoment={handleDeleteMoment}
          onAddComment={handleAddComment}
          onEditComment={handleEditComment}
          onDeleteComment={handleDeleteComment}
          onSelectCharacterByName={handleOpenCharacterMoments}
        />
      </ErrorBoundary>

      {/* COMMENT ACTION POPOVER MODAL FOR MAIN FEED */}
      {selectedCommentTarget && (
        <div 
          onClick={() => setSelectedCommentTarget(null)}
          className="absolute inset-0 bg-black/40 z-[99999] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-150 select-none"
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
                  handleDeleteComment(momentId, comment.id);
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

      {/* EDIT COMMENT MODAL FOR MAIN FEED */}
      {editingCommentTarget && (
        <div 
          onClick={() => setEditingCommentTarget(null)}
          className="absolute inset-0 bg-black/40 z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150 select-none"
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
                    handleEditComment(editingCommentTarget.momentId, editingCommentTarget.commentId, editingCommentTarget.text.trim());
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

      {/* --- CREATE NEW GROUP CHAT MODAL --- */}
      <GroupChatModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        sessions={sessions}
        onSave={handleGroupChatSave}
      />

      {/* --- PUBLISH NEW MOMENT MODAL --- */}
      <PublishMomentModal
        isOpen={showPublishMomentModal}
        onClose={() => setShowPublishMomentModal(false)}
        onPublish={handlePublishUserMoment}
        localSandboxImages={localSandboxImages}
        onRefreshImages={handleRefreshImages}
      />

      {/* --- SIMULATED MONEY TRANSFER MODAL --- */}
      {showTransferModal && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#f0f0f0] rounded-3xl overflow-hidden w-full max-w-sm text-gray-800 shadow-2xl relative border border-gray-100 flex flex-col">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white relative">
              <h4 className="text-sm font-black tracking-wide">转账</h4>
              <p className="text-[10px] opacity-90 mt-1">给「{activeSession?.characterName || '对方'}」发起一笔转账</p>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white transition-all focus:outline-none cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">转账金额 (元)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-extrabold text-base select-none">¥</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full h-11 pl-8 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-black focus:outline-none focus:border-amber-500 text-gray-900"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">添加备注</label>
                <input
                  type="text"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="转账"
                  className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 text-gray-800"
                />
              </div>

              <div className="flex w-full space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 h-9 rounded-xl border border-gray-200 bg-[#f0f0f0] hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-all cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 h-9 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center shadow-md shadow-amber-500/20"
                >
                  立即转账
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- LONG-TERM MEMORY SYNAPSE MODAL --- */}
      {showMemoryModal && activeSession && (
        <LongTermMemoryModal
          session={activeSession}
          messages={messages}
          onClose={() => setShowMemoryModal(false)}
          onSave={handleSaveLongTermMemorySession}
        />
      )}

      {/* --- NARRATION MODE MODAL --- */}
      {showNarrationModal && activeSession && (
        <NarrationModeModal
          session={activeSession}
          onClose={() => setShowNarrationModal(false)}
          onSave={handleSaveNarrationModeSession}
        />
      )}

      {/* --- PROACTIVE MESSAGING MODAL --- */}
      {showProactiveModal && activeSession && (
        <ProactiveMessagingModal
          session={activeSession}
          onClose={() => setShowProactiveModal(false)}
          onSave={handleSaveProactiveSession}
        />
      )}

      {confirmModal && confirmModal.isOpen && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-[#f0f0f0] rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl relative space-y-4 text-gray-800">
            <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mx-auto select-none">
              <Trash size={20} />
            </div>
            <h4 className="text-sm font-bold text-gray-900 font-sans">{confirmModal.title}</h4>
            <p className="text-[11px] text-gray-500 leading-relaxed font-sans px-2">
              {confirmModal.description}
            </p>
            <div className="flex w-full space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 h-9 rounded-xl border border-gray-200 bg-[#f0f0f0] hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                className="flex-1 h-9 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center shadow-md shadow-rose-100"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. IMMERSIVE DECORATIVE VOICE CALL FLOATING WINDOW */}
      {/* ======================================================== */}
      {callState !== 'idle' && isCallMinimized && (
        <div
          onPointerDown={handleCallPointerDown}
          onPointerMove={handleCallPointerMove}
          onPointerUp={handleCallPointerUp}
          style={{
            position: 'absolute',
            left: `${floatingPos.x}px`,
            top: `${floatingPos.y}px`,
            touchAction: 'none',
          }}
          className={`w-28 bg-[#f0f0f0]/95 backdrop-blur-md border border-gray-200 rounded-2xl p-3 flex flex-col items-center justify-center shadow-xl z-[99999] select-none transition-all duration-150 ${
            isLongPressed 
              ? 'scale-110 ring-2 ring-emerald-500 shadow-2xl cursor-grabbing' 
              : 'cursor-pointer active:scale-95 hover:border-gray-300'
          }`}
          title="点击恢复窗口，长按1秒可拖动位置"
        >
          {/* Target Avatar with pulse effect */}
          <div className="relative w-11 h-11 mb-1.5">
            <div className={`absolute inset-0 rounded-xl bg-emerald-500/10 scale-110 ${callState === 'dialing' ? 'animate-ping' : 'animate-pulse'}`} />
            <div className="relative w-11 h-11 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center text-lg font-bold select-none">
              {activeSession?.characterAvatar && (activeSession.characterAvatar.startsWith('data:') || activeSession.characterAvatar.startsWith('http')) ? (
                <img src={activeSession.characterAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{activeSession?.characterAvatar || '🔮'}</span>
              )}
            </div>
            {/* Blinking call indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-sm">
              <Phone size={6} className="text-white font-extrabold fill-current" />
            </div>
          </div>

          <div className="text-center min-w-0 w-full">
            <p className="text-[10px] font-black truncate text-gray-800 leading-tight">
              {activeSession?.characterName || '呼叫中'}
            </p>
            <p className="text-[8px] font-mono text-emerald-600 mt-1 font-bold tracking-wider">
              {callState === 'dialing' ? '呼叫中...' : formatCallDuration(callDuration)}
            </p>
          </div>

          {/* Hold Helper Tip */}
          <div className="text-[7.5px] text-gray-400 mt-1 font-medium scale-90 origin-center opacity-85 select-none">
            {isLongPressed ? '可拖动' : '长按可拖动'}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. FULL SCREEN IMMERSIVE CALL VIEW */}
      {/* ======================================================== */}
      {callState !== 'idle' && !isCallMinimized && (
        <div className="absolute inset-0 bg-[#F6F6F8] flex flex-col justify-between p-8 z-[99998] text-gray-800 animate-in fade-in duration-300 select-none">
          
          {/* Top Status and Minimize control */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsCallMinimized(true)}
              className="w-10 h-10 rounded-full bg-[#f0f0f0] border border-gray-200 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-all hover:bg-gray-50 active:scale-95 focus:outline-none cursor-pointer shadow-sm"
              title="最小化为悬浮窗"
            >
              <Minimize2 size={16} />
            </button>
            <div className="w-10" />
          </div>

          {/* Core Profile Centerpiece with pulse waves */}
          <div className="flex flex-col items-center justify-center flex-1 my-12 relative">
            <div className="absolute w-72 h-72 rounded-full border border-emerald-500/5 flex items-center justify-center animate-ping duration-[3000ms] ease-out" />
            <div className="absolute w-56 h-56 rounded-full border border-emerald-500/10 flex items-center justify-center animate-pulse duration-[2000ms]" />
            <div className="absolute w-40 h-40 rounded-full bg-emerald-500/5 flex items-center justify-center" />

            <div className="relative w-28 h-28 mb-6">
              <div className="absolute inset-0 rounded-[32px] bg-gradient-to-tr from-emerald-500 to-green-400 opacity-20 blur-xl animate-pulse" />
              <div className="relative w-28 h-28 rounded-[32px] bg-[#f0f0f0] border-2 border-gray-200/50 p-1.5 overflow-hidden flex items-center justify-center text-4xl font-bold shadow-xl">
                <div className="w-full h-full rounded-[24px] overflow-hidden bg-gray-50">
                  {activeSession?.characterAvatar && (activeSession.characterAvatar.startsWith('data:') || activeSession.characterAvatar.startsWith('http')) ? (
                    <img src={activeSession.characterAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      {activeSession?.characterAvatar || '🔮'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <h2 className="text-xl font-black tracking-wide text-center text-gray-900">
              {activeSession?.characterName || 'AI 角色'}
            </h2>
            
            <p className="text-xs font-semibold text-gray-400 mt-2 tracking-wider">
              {callState === 'dialing' ? '正在呼叫对方...' : '通话进行中'}
            </p>

            <p className="text-2xl font-mono text-emerald-600 mt-4 tracking-widest font-black">
              {callState === 'dialing' ? 'Dialing...' : formatCallDuration(callDuration)}
            </p>
          </div>

          {/* Bottom control buttons */}
          <div className="w-full max-w-sm mx-auto grid grid-cols-3 gap-4 pb-8">
            <button
              type="button"
              onClick={() => setIsCallMuted(!isCallMuted)}
              className="flex flex-col items-center justify-center focus:outline-none cursor-pointer group"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 transition-all ${isCallMuted ? 'bg-rose-500 text-white shadow-lg' : 'bg-[#f0f0f0] border border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-600 shadow-sm'}`}>
                {isCallMuted ? <MicOff size={18} /> : <Mic size={18} />}
              </div>
              <span className="text-[10px] text-gray-500 font-bold">{isCallMuted ? '麦克风已关' : '静音'}</span>
            </button>

            <button
              type="button"
              onClick={() => setCallState('idle')}
              className="flex flex-col items-center justify-center focus:outline-none cursor-pointer animate-pulse hover:animate-none"
            >
              <div className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center mb-2 shadow-lg shadow-rose-200 active:scale-95 transition-all text-white">
                <PhoneOff size={18} />
              </div>
              <span className="text-[10px] text-rose-500 font-bold">挂断</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCallSpeakerOn(!isCallSpeakerOn)}
              className="flex flex-col items-center justify-center focus:outline-none cursor-pointer group"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 transition-all ${isCallSpeakerOn ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-[#f0f0f0] border border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-600 shadow-sm'}`}>
                <Volume2 size={18} />
              </div>
              <span className="text-[10px] text-gray-500 font-bold">{isCallSpeakerOn ? '扬声器开' : '扬声器关'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit Chat Message Modal */}
      {editingChatMessage && (
        <div 
          className="absolute inset-0 z-[110] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-[#f0f0f0] rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h4 className="text-sm font-black text-gray-900">编辑消息内容</h4>
              <button
                type="button"
                onClick={() => setEditingChatMessage(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg cursor-pointer transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              value={editChatMessageText}
              onChange={(e) => setEditChatMessageText(e.target.value)}
              rows={6}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-[#9eccab] focus:bg-[#f0f0f0] transition-all leading-relaxed"
              placeholder="修改消息内容..."
            />

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingChatMessage(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEditMessage}
                disabled={!editChatMessageText.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
              >
                保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Picker Modal with Free Cropper & Multi-Select */}
      <ImagePickerModal
        isOpen={isChatPickerOpen}
        initialImages={pendingChatPickerImages}
        onClose={() => setIsChatPickerOpen(false)}
        onSend={handleChatPickerSend}
        title="选择聊天图片"
        sendButtonText="发送给好友"
      />

    </div>
  );
}
