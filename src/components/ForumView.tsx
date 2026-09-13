/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight,
  ArrowLeft,
  Home,
  Search, 
  MessageSquare, 
  Heart, 
  Plus, 
  Send, 
  Layers, 
  Cpu, 
  MessageCircle, 
  Sparkles, 
  ShieldAlert,
  Leaf,
  Coffee,
  Bot,
  User,
  X,
  TrendingUp,
  Share2,
  RefreshCw,
  Flame,
  Frown,
  Compass,
  Trash2,
  Bookmark,
  Palette,
  Check,
  RotateCcw,
  Pipette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbInstance } from '../lib/db';
import { generateAiMomentComment, generateAiCommentReply, getSystemMemoryPrompt, cleanBackgroundText, getUserProfilePrompt, callOpenAIEndpoint } from '../lib/api';
import { ChatSession, ChatMessage } from '../lib/types';

export interface ForumTheme {
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
  navActiveColor: string;
  isCustom?: boolean;
}

export const FORUM_THEME_PRESETS: ForumTheme[] = [
  {
    id: 'default_indigo',
    name: '极光青蓝',
    description: '科技感与现代活力的默认色调',
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
    accentLight: 'rgba(79, 70, 229, 0.12)',
    navActiveColor: '#4F46E5'
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
    accentLight: 'rgba(74, 114, 151, 0.14)',
    navActiveColor: '#4A7297'
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
    accentLight: 'rgba(120, 138, 102, 0.14)',
    navActiveColor: '#788A66'
  },
  {
    id: 'classic_gold',
    name: '经典暖金',
    description: '温暖明亮的经典暖黄',
    primary: '#D97706',
    primaryHover: '#B45309',
    primaryText: '#FFFFFF',
    headerBg: '#FEF3C7',
    headerBorder: '#FDE68A',
    headerText: '#1C1917',
    mainBg: '#FDFBF7',
    cardBg: '#FFFFFF',
    cardBorder: '#FDE68A',
    accentText: '#B45309',
    accentLight: 'rgba(217, 119, 6, 0.14)',
    navActiveColor: '#D97706'
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
    accentLight: 'rgba(225, 120, 153, 0.14)',
    navActiveColor: '#E17899'
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
    accentLight: 'rgba(142, 124, 195, 0.14)',
    navActiveColor: '#8E7CC3'
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
    accentLight: 'rgba(217, 119, 54, 0.14)',
    navActiveColor: '#D97736'
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
    accentLight: 'rgba(71, 85, 105, 0.14)',
    navActiveColor: '#475569'
  }
];

function generateForumThemeFromHex(hex: string): ForumTheme {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 79;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 70;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 229;

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

  const mbr = Math.round(r + (255 - r) * 0.95);
  const mbg = Math.round(g + (255 - g) * 0.95);
  const mbb = Math.round(b + (255 - b) * 0.95);
  const mainBg = `rgb(${mbr}, ${mbg}, ${mbb})`;

  const cbr = Math.round(r + (255 - r) * 0.98);
  const cbg = Math.round(g + (255 - g) * 0.98);
  const cbb = Math.round(b + (255 - b) * 0.98);
  const cardBg = `rgb(${cbr}, ${cbg}, ${cbb})`;

  const cbor_r = Math.round(r + (255 - r) * 0.85);
  const cbor_g = Math.round(g + (255 - g) * 0.85);
  const cbor_b = Math.round(b + (255 - b) * 0.85);
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
    navActiveColor: `#${cleanHex}`,
    isCustom: true
  };
}

interface Comment {
  id: string;
  authorName: string;
  authorType: 'octocat' | 'assistant' | 'user' | 'custom';
  content: string;
  timestamp: string;
  replyTo?: string;
  isAnonymous?: boolean;
}

interface ForumPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorType: 'octocat' | 'assistant' | 'user' | 'custom';
  category: 'hot' | 'rant' | 'gossip' | 'intel' | 'confession';
  timestamp: string;
  likes: number;
  comments: Comment[];
  hasLiked?: boolean;
  hasBookmarked?: boolean;
  isAnonymous?: boolean;
  isUserCreated?: boolean;
}

// Helper to format character and sender display name to strip parentheses containing real name
const formatDisplayName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*[\(\（].*?[\)\）]/g, '').trim();
};

const getUserDisplayName = (): string => {
  try {
    const saved = localStorage.getItem('wechat_user_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.userId && parsed.userId.trim() && parsed.userId !== 'User_Real') {
        return parsed.userId.trim();
      }
    }
  } catch (e) {}
  return '用户';
};

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

const formatAuthorName = (name?: string, isAnonymous?: boolean): string => {
  if (isAnonymous || !name || name === '匿名' || name === '匿名用户' || name === '匿名旅人') {
    return '匿名';
  }
  const formatted = formatDisplayName(name);
  if (formatted === '章鱼猫') {
    return '章导爱玩小手机';
  }
  return formatted;
};

const INITIAL_POSTS: ForumPost[] = [
  {
    id: 'post_guide_apikey',
    title: '关于如何配置第三方 API Key 的简单教程',
    content: '如果您在聊天和论坛互动中希望体验更真实、个性的 AI 好友拟真对话，可以点击【系统设置】。在输入框中填入您的 API Key（支持 OpenAI / Claude / DeepSeek 兼容接口格式）。本系统采用全客户端直连，绝对不会收集和中转您的 API Key，请放心使用！🔑💻',
    authorName: '章导爱玩小手机',
    authorType: 'octocat',
    category: 'intel',
    timestamp: '置顶',
    likes: 88,
    hasLiked: false,
    comments: []
  }
];

interface ForumViewProps {
  onHome: () => void;
}

export default function ForumView({ onHome }: ForumViewProps) {
  // Toast Notification state
  const [toastMsg, setToastMsg] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);
  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const [posts, setPosts] = useState<ForumPost[]>(() => {
    const saved = localStorage.getItem('forum_posts_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((post: any) => {
            let cat = post.category;
            if (cat === 'tech') cat = 'intel';
            else if (cat === 'chitchat') cat = 'gossip';
            else if (cat === 'brainstorm') cat = 'confession';
            else if (cat === 'feedback') cat = 'rant';
            
            if (!['hot', 'rant', 'gossip', 'intel', 'confession'].includes(cat)) {
              cat = 'gossip';
            }
            return {
              ...post,
              category: cat
            };
          });
        }
      } catch (e) {
        console.error('Error parsing forum posts', e);
      }
    }
    return INITIAL_POSTS;
  });
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'forum' | 'my'>('forum');
  const [mySubTab, setMySubTab] = useState<'published' | 'bookmarked'>('published');
  
  // Modals / Detail panels
  const [activePost, setActivePost] = useState<ForumPost | null>(null);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sharingPost, setSharingPost] = useState<ForumPost | null>(null);
  const [activeChats, setActiveChats] = useState<ChatSession[]>([]);
  const [usedPresetIndices, setUsedPresetIndices] = useState<number[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'single' | 'all'; targetId?: string } | null>(null);
  
  // New Post Form State
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<'hot' | 'rant' | 'gossip' | 'intel' | 'confession'>('gossip');
  const [isNewPostAnonymous, setIsNewPostAnonymous] = useState(false);
  
  // New Comment Input
  const [commentText, setCommentText] = useState('');
  const [replyingToComment, setReplyingToComment] = useState<Comment | null>(null);
  const [isAnonymousComment, setIsAnonymousComment] = useState(false);

  // Theme Settings
  const [currentTheme, setCurrentTheme] = useState<ForumTheme>(() => {
    const saved = localStorage.getItem('forum_app_theme');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.primary) return parsed;
      } catch (e) {
        console.error('Failed to parse forum theme', e);
      }
    }
    return FORUM_THEME_PRESETS[0]; // default_indigo
  });

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [customHexInput, setCustomHexInput] = useState('#4F46E5');

  const handleSelectPresetTheme = (theme: ForumTheme) => {
    setCurrentTheme(theme);
    localStorage.setItem('forum_app_theme', JSON.stringify(theme));
  };

  const handleApplyCustomColor = (hex: string) => {
    const theme = generateForumThemeFromHex(hex);
    setCurrentTheme(theme);
    localStorage.setItem('forum_app_theme', JSON.stringify(theme));
  };

  // Persist posts
  useEffect(() => {
    localStorage.setItem('forum_posts_v3', JSON.stringify(posts));
  }, [posts]);

  // Load sessions for sharing modal
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const list = await dbInstance.getAllSessions();
        const active = list.filter(s => !s.isContactDeleted);
        setActiveChats(active);
      } catch (e) {
        console.error('Failed to load active chats for sharing:', e);
      }
    };
    if (sharingPost) {
      loadSessions();
    }
  }, [sharingPost]);

  // Handle Like
  const handleLikePost = (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        const isLiked = post.hasLiked;
        return {
          ...post,
          likes: isLiked ? post.likes - 1 : post.likes + 1,
          hasLiked: !isLiked
        };
      }
      return post;
    }));
    
    // Also sync activePost details if open
    if (activePost && activePost.id === postId) {
      setActivePost(prev => {
        if (!prev) return null;
        const isLiked = prev.hasLiked;
        return {
          ...prev,
          likes: isLiked ? prev.likes - 1 : prev.likes + 1,
          hasLiked: !isLiked
        };
      });
    }
  };

  // Handle Bookmark
  const handleBookmarkPost = (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let nowBookmarked = false;
    setPosts(prev => prev.map(post => {
      if (post.id === postId) {
        nowBookmarked = !post.hasBookmarked;
        return {
          ...post,
          hasBookmarked: nowBookmarked
        };
      }
      return post;
    }));
    
    if (activePost && activePost.id === postId) {
      setActivePost(prev => prev ? { ...prev, hasBookmarked: !prev.hasBookmarked } : null);
    }

    showToast(nowBookmarked ? '已成功收藏该帖子' : '已取消收藏该帖子', 'success');
  };

  // Simulates mutual comments and replies among characters on a specific forum post
  const simulateForumInteractions = (newPost: ForumPost) => {
    // 角色动态不需要百分百在评论区互动（控制触发几率，约40%的动态会获得评论，不强求每条都必须评论）
    if (Math.random() > 0.4) return;

    // Character comments on this post after a random delay (e.g., 2.5s)
    const commenterDelay = 2000 + Math.random() * 2000;
    setTimeout(async () => {
      try {
        const sessions = await dbInstance.getAllSessions();
        const customChars = sessions
          .filter(s => !s.isGroup && !s.isContactDeleted)
          .map(s => {
            const cleanName = formatDisplayName(s.characterName);
            return {
              name: cleanName,
              type: 'custom' as const,
              memory: s.memory
            };
          });

        const charactersList = [
          { name: '章导爱玩小手机', type: 'octocat' as const, memory: '你的真实名字叫章鱼猫，论坛网名为“章导爱玩小手机”，是用户的一位普通人类朋友，同时也是这部手机系统的独立开发者和作者。你目前身处异地，性格幽默风趣，热爱写代码，对生活充满好奇，经常和用户分享你在异地的生活和开发见闻。' },
          ...customChars,
          { name: '匿名', type: 'custom' as const, memory: '你是当前世界观（或原作）中的某个未被加为好友的其他角色，你现在披着马甲（匿名）在论坛上随便看看和回复帖子。回复时微弱地保留一点点你在原作中的性格特点和口癖，伪装成普通网民，不要太夸张。严禁说出你的真实姓名。可以顺带侧面提及其他角色，但不可以直呼名字。' }
        ];

        const validCommenters = charactersList.filter(c => c.name !== newPost.authorName);
        if (validCommenters.length === 0) return;
        
        const commenter = validCommenters[Math.floor(Math.random() * validCommenters.length)];
        
        let customComment = '';
        const settings = await dbInstance.getSettings();
        
        if (settings.apiKey) {
          try {
            customComment = await generateAiMomentComment(
              commenter.name,
              commenter.memory,
              '普通朋友',
              newPost.content,
              '',
              newPost.authorName
            );
          } catch (e) {
            console.warn('AI comment generation failed:', e.message || e);
          }
        }
        
        if (!customComment) {
          return; // No API Key or API failed: do not post fallback fake comment
        }
        
        const newComment: Comment = {
          id: `comment_auto_${Date.now()}`,
          authorName: commenter.name,
          authorType: commenter.type as any,
          content: customComment,
          timestamp: '刚刚'
        };
        
        // Add comment to state
        setPosts(prev => {
          return prev.map(p => {
            if (p.id === newPost.id) {
              return { ...p, comments: [...p.comments, newComment], likes: p.likes + (Math.random() > 0.5 ? 1 : 0) };
            }
            return p;
          });
        });

        // Sync details panel if open
        setActivePost(prev => {
          if (prev && prev.id === newPost.id) {
            return { ...prev, comments: [...prev.comments, newComment], likes: prev.likes + (Math.random() > 0.5 ? 1 : 0) };
          }
          return prev;
        });

        // Author replies to this commenter's comment! (Only if the author is a character, with lower casual probability ~35%)
        const isAuthorCharacter = ['octocat', 'assistant', 'custom'].includes(newPost.authorType);
        if (isAuthorCharacter && Math.random() < 0.35) {
          const authorReplyDelay = 3000 + Math.random() * 2000;
          setTimeout(async () => {
            let replyText = '';
            const authorChar = charactersList.find(c => c.name === newPost.authorName);
            if (!authorChar) return;

            if (settings.apiKey) {
              try {
                replyText = await generateAiCommentReply(
                  authorChar.name,
                  authorChar.memory,
                  '普通朋友',
                  newPost.content,
                  customComment,
                  commenter.name,
                  false
                );
              } catch (e) {
                console.warn('AI reply generation failed:', e.message || e);
              }
            }

            if (!replyText) {
              return; // No API Key or API failed: do not post fallback reply
            }

            const authorReplyComment: Comment = {
              id: `comment_reply_auto_${Date.now()}`,
              authorName: authorChar.name,
              authorType: authorChar.type as any,
              content: replyText,
              timestamp: '刚刚',
              replyTo: commenter.name
            };

            setPosts(prev => {
              return prev.map(p => {
                if (p.id === newPost.id) {
                  return { ...p, comments: [...p.comments, authorReplyComment] };
                }
                return p;
              });
            });

            // Sync details panel if open
            setActivePost(prev => {
              if (prev && prev.id === newPost.id) {
                return { ...prev, comments: [...prev.comments, authorReplyComment] };
              }
              return prev;
            });

          }, authorReplyDelay);
        }

      } catch (err) {
        console.error('Error in simulateForumInteractions:', err);
      }
    }, commenterDelay);
  };

  // Create New Post
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return;

    const newPost: ForumPost = {
      id: `post_${Date.now()}`,
      title: newPostTitle,
      content: newPostContent,
      authorName: isNewPostAnonymous ? '匿名' : getUserDisplayName(),
      authorType: 'user',
      category: newPostCategory,
      timestamp: '刚刚',
      likes: 0,
      hasLiked: false,
      comments: [],
      isAnonymous: isNewPostAnonymous,
      isUserCreated: true
    };

    setPosts(prev => [newPost, ...prev]);
    
    // Reset Form and Close
    setNewPostTitle('');
    setNewPostContent('');
    setNewPostCategory('gossip');
    setIsNewPostAnonymous(false);
    setIsNewPostOpen(false);

    // Also trigger character interactions with the user's newly created post!
    simulateForumInteractions(newPost);
  };

  // Delete Individual Post
  const handleDeletePost = (postId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setDeleteConfirm({ type: 'single', targetId: postId });
  };

  // Delete All Posts
  const handleDeleteAllPosts = () => {
    setDeleteConfirm({ type: 'all' });
  };

  // Execute Deletion
  const executeDeletion = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'single' && deleteConfirm.targetId) {
      const targetId = deleteConfirm.targetId;
      setPosts(prev => prev.filter(p => p.id !== targetId));
      if (activePost && activePost.id === targetId) {
        setActivePost(null);
      }
    } else if (deleteConfirm.type === 'all') {
      setPosts([]);
      setActivePost(null);
    }
    setDeleteConfirm(null);
  };

  // Add Comment to activePost and trigger character response
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activePost) return;

    const userAuthorName = isAnonymousComment ? '匿名' : getUserDisplayName();

    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      authorName: userAuthorName,
      authorType: 'user',
      content: commentText,
      timestamp: '刚刚',
      replyTo: replyingToComment ? replyingToComment.authorName : undefined,
      isAnonymous: isAnonymousComment
    };

    const updatedPosts = posts.map(post => {
      if (post.id === activePost.id) {
        return {
          ...post,
          comments: [...post.comments, newComment]
        };
      }
      return post;
    });

    setPosts(updatedPosts);
    setActivePost(prev => {
      if (!prev) return null;
      return {
        ...prev,
        comments: [...prev.comments, newComment]
      };
    });
    
    const savedCommentText = commentText;
    setCommentText('');
    setReplyingToComment(null);
    setIsAnonymousComment(false);

    // Trigger delayed character reply to user's comment (identical to Moments interaction logic)
    const replyDelay = 1500 + Math.random() * 1500;
    setTimeout(async () => {
      try {
        const settings = await dbInstance.getSettings();
        
        // Pick responder character
        const sessions = await dbInstance.getAllSessions();
        const customChars = sessions
          .filter(s => !s.isGroup && !s.isContactDeleted)
          .map(s => {
            const cleanName = formatDisplayName(s.characterName);
            return {
              name: cleanName,
              type: 'custom' as const,
              memory: s.memory
            };
          });

        const charactersList = [
          { name: '章导爱玩小手机', type: 'octocat' as const, memory: '你的真实名字叫章鱼猫，论坛网名为“章导爱玩小手机”，是用户的一位普通人类朋友，同时也是这部手机系统的独立开发者和作者。你目前身处异地，性格幽默风趣，热爱写代码，对生活充满好奇，经常和用户分享你在异地的生活 and 开发见闻。' },
          ...customChars,
          { name: '匿名', type: 'custom' as const, memory: '你是当前世界观（或原作）中的某个未被加为好友的其他角色，你现在披着马甲（匿名）在论坛上随便看看和回复帖子。回复时微弱地保留一点点你在原作中的性格特点和口癖，伪装成普通网民，不要太夸张。严禁说出你的真实姓名。可以顺带侧面提及其他角色，但不可以直呼名字。' }
        ];

        let responder = charactersList.find(c => c.type === activePost.authorType || (c.type === 'custom' && formatDisplayName(c.name) === formatDisplayName(activePost.authorName)));
        if (!responder || activePost.authorType === 'user') {
          // If user's own post, pick a random character to respond
          responder = charactersList[Math.floor(Math.random() * charactersList.length)];
        }

        let replyText = '';
        if (settings.apiKey) {
          try {
            replyText = await generateAiCommentReply(
              responder.name,
              responder.memory,
              '普通朋友',
              activePost.content,
              savedCommentText,
              '用户',
              true
            );
          } catch (e) {
            console.warn('AI reply generation failed:', e.message || e);
          }
        }

        if (!replyText) {
          return; // No API Key or API error: do not post fallback reply
        }

        const systemReplyComment: Comment = {
          id: `comment_reply_user_${Date.now()}`,
          authorName: responder.name,
          authorType: responder.type as any,
          content: replyText,
          timestamp: '刚刚',
          replyTo: userAuthorName
        };

        setPosts(prev => {
          return prev.map(p => {
            if (p.id === activePost.id) {
              return { ...p, comments: [...p.comments, systemReplyComment] };
            }
            return p;
          });
        });

        setActivePost(prev => {
          if (prev && prev.id === activePost.id) {
            return { ...prev, comments: [...prev.comments, systemReplyComment] };
          }
          return prev;
        });

      } catch (err) {
        console.warn('Failed to trigger character reply to user comment:', err.message || err);
      }
    }, replyDelay);
  };

  const checkOctocatAllowed = (candidateName: string, candidateType: string, currentGenerated: any[], allPosts: ForumPost[]) => {
    const clean = candidateName ? formatDisplayName(candidateName) : '';
    const isOctocat = clean.includes('章鱼猫') || clean.includes('章导爱玩小手机') || clean.toLowerCase().includes('octocat') || candidateType === 'octocat';
    if (!isOctocat) return { isOctocat: false, allowed: true };

    const totalFeed = [...currentGenerated, ...allPosts];
    const octocatCount = totalFeed.filter(p => (p.authorName && (p.authorName.includes('章鱼猫') || p.authorName.includes('章导爱玩小手机'))) || p.authorType === 'octocat').length;
    const totalCount = totalFeed.length;

    // Enforce ~1 in 15-20 posts frequency rule
    const allowed = octocatCount === 0 ? totalCount >= 15 : (totalCount / octocatCount >= 17.5);
    return { isOctocat: true, allowed };
  };

  const handleRefreshPosts = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      const settings = await dbInstance.getSettings();
      if (!settings.apiKey) {
        showToast("未检测到 API Key，请点击“设置”配置密钥凭据。", "error");
        setIsRefreshing(false);
        return;
      }

      const sessions = await dbInstance.getAllSessions();
      const individualSessions = sessions.filter(s => !s.isGroup && !s.isContactDeleted);
      
      // Build characters context description
      const charactersContext = individualSessions.map(s => {
        const cleanName = formatDisplayName(s.characterName);
        return `- 角色姓名: ${cleanName}
   设定与喜好/生活习惯: ${getSystemMemoryPrompt(s)}
   当前背景限定：必须是地球现实普通日常（绝非科幻、魔法、异次元等）`;
      }).join('\n\n');

      const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
      const targetUrl = `${cleanBaseUrl}/chat/completions`;

      const promptSystem = `你现在是这个手机社交论坛的多角色发帖生成器。你必须一次性生成 5 篇完全不同的、极具生活化气息与接地气日常感的论坛帖子！
【极度严格的标题规范（核心重中之重）】：
1. 绝对严禁在标题里出现发帖人的网名、姓名、角色名或【】前缀！例如：
   - ❌ 错误标题：“【木子】今天去打卡了老书店”、“Muzi：下班路上的晚霞”、“【章鱼猫给用户...】”
   - ✅ 正确标题：“今天在路边打卡了一家超有氛围的老书店”、“下班路上看到的粉红色晚霞，太治愈了”、“这路口的红绿灯也太久了吧”
2. 标题必须像现实中真实网友随手发的贴文标题一样，自然、口语化、接地气，极具生活气息！

【发帖内容与身份分配】：
1. 【主要角色发帖（1~2篇）】：第一人称抒发日常生活碎碎念、工作/学习感悟或对身边朋友/用户的挂念，表达自然真切，标题绝对不要带网名或【】前缀！
2. 【路人网民或原作其他角色匿名发帖（3~4篇）】：
   - 路人网民发帖：接地气的城市日常生活与吐槽。网民昵称自然生动。
   - 原作其他角色匿名发帖：原作中的其他未出场角色可以亲自下场发帖，但【必须硬性要求使用匿名】（如“匿名用户”、“不愿透露姓名的路人甲”等作为 authorName，且设置 isAnonymous 为 true）。他们在发帖时，要微弱地保留一点点他们在原作中的性格特点和口癖（形似路人，神似本尊，不要太夸张放飞）。
3. 【侧面提及原作角色（重要）】：无论是路人、主要角色还是匿名原作角色发帖，帖子内容里都可以自然地、侧面提及原作世界观下的其他角色。但在提及他们时，【绝对严禁直白地说出他们的真实姓名或具体职业】，必须用模糊的代称、外貌特征或特征性事件来暗示（例如“隔壁学校那个打球很厉害的前辈”、“那个总是一身黑衣的家伙”）。可以基于原作进行合理的自由联想，不要太放飞。
4. 【系统作者“章鱼猫”（论坛昵称“章导爱玩小手机”）】：发帖频率极低。
5. 【背景要求】：完全基于地球现实普通生活，严禁科幻、玄幻设定。严禁生成代表用户本身（如'用户 (你)'、'用户'、'我'）的帖子。

请只返回一个合法的 JSON 对象，格式必须如下：
{
  "posts": [
    {
      "title": "帖子标题（20字以内，真实自然口语化，绝对严禁带发帖人名字、网名或【】前缀）",
      "content": "帖子正文（120字以内，口语化、自然精炼，如果需要换行【必须】使用转义字符 \n，绝对不可在 JSON 中直接使用真实的换行符）",
      "category": "必须是 'hot' | 'rant' | 'gossip' | 'intel' | 'confession' 之一",
      "authorName": "发帖人昵称（主要角色名字或“章导爱玩小手机”，或真实感路人网民昵称如‘失眠便利店’；若匿名则必须为‘匿名’）",
      "authorType": "如果是系统作者章鱼猫（论坛昵称“章导爱玩小手机”）发帖设为 'octocat'，如果是自定义角色或路人网民发帖设为 'custom'。",
      "isAnonymous": true/false
    }
  ]
}
【极其重要】：确保生成的返回结果是完全合法且格式标准的 JSON。
1. 字符串内部的所有的双引号必须转义（\"）。
2. 绝对不可以在字符串内部直接使用真实的回车换行，必须转义为 \n！

当前存在的主要角色设定上下文如下：
${charactersContext}
${getUserProfilePrompt()}

注意：绝不要返回任何 Markdown 标记（如 \`\`\`json），只返回一行可解析的 JSON 数组！`;

      const bodyData = {
        model: settings.selectedModel || 'gpt-4o',
        messages: [
          { role: 'system', content: promptSystem },
          { role: 'user', content: '现在请立即一次性生成符合上述全部标准的 5 篇论坛新帖子 JSON，格式为包含 posts 数组的对象。' }
        ],
        temperature: 0.85,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      };

      const resJson = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
      const jsonText = resJson.choices?.[0]?.message?.content?.trim() || '';
      if (!jsonText) {
        throw new Error('API 返回了空内容');
      }

      let cleanJsonText = jsonText;
      const jsonMatch = cleanJsonText.match(/```json\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        cleanJsonText = jsonMatch[1];
      } else {
        cleanJsonText = cleanJsonText.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      }
      
      // 修复大模型生成的 JSON 中存在的真实换行符问题
      cleanJsonText = cleanJsonText.replace(/([^\\])\n/g, '$1\\n');

      let parsedData;
      try {
        parsedData = JSON.parse(cleanJsonText);
      } catch (e) {
        throw new Error(`JSON解析失败: ${e.message}`);
      }
      const parsedArray = Array.isArray(parsedData) ? parsedData : (parsedData.posts || []);
      
      if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
        throw new Error('解析生成数据失败：未获得有效的帖子数组');
      }

      const charNameList = individualSessions.map(s => formatDisplayName(s.characterName));
      let generatedPostsData: Array<{
        title: string;
        content: string;
        category: 'hot' | 'rant' | 'gossip' | 'intel' | 'confession';
        authorName: string;
        authorType: 'octocat' | 'assistant' | 'custom' | 'user';
        isAnonymous: boolean;
      }> = [];

      for (const parsed of parsedArray) {
        if (parsed.title && parsed.content && parsed.category) {
          const parsedName = formatDisplayName(parsed.authorName || '');
          const isUser = parsedName === '用户 (图)' || parsedName === '用户' || parsedName === '匿名用户' || parsedName === '我' || parsed.authorType === 'user';
          if (isUser) continue;

          const isAnonymous = parsed.isAnonymous || parsedName === '匿名';
          let finalAuthorName = isAnonymous ? '匿名' : (parsed.authorName || '热心网民');
          let authorType = parsed.authorType || 'custom';

          if (parsedName.includes('章鱼猫') || parsedName.includes('章导爱玩小手机')) {
            authorType = 'octocat';
            finalAuthorName = '章导爱玩小手机';
          }

          // Sanitize title: strip any leading brackets 【...】 or [...] and leading author names / colons
          let cleanTitle = parsed.title.trim();
          cleanTitle = cleanTitle.replace(/^【[^】]+】\s*/, '').replace(/^\[[^\]]+\]\s*/, '');
          charNameList.forEach(name => {
            if (name) {
              const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              cleanTitle = cleanTitle.replace(new RegExp(`^${escaped}[:：\\s]+`, 'i'), '');
            }
          });
          cleanTitle = cleanTitle.trim() || parsed.title.trim();

          generatedPostsData.push({
            title: cleanTitle,
            content: parsed.content,
            category: parsed.category,
            authorName: finalAuthorName,
            authorType: authorType,
            isAnonymous: isAnonymous
          });
        }
      }

      if (generatedPostsData.length === 0) {
        throw new Error('未能提取到格式正确的帖子数据');
      }

      // Convert generated post data into real post elements and insert
      const newPosts: ForumPost[] = generatedPostsData.map((data, index) => ({
        id: `post_auto_${Date.now()}_${index}`,
        title: data.title,
        content: data.content,
        authorName: data.authorName,
        authorType: data.authorType,
        category: data.category,
        timestamp: '刚刚',
        likes: Math.floor(Math.random() * 8),
        hasLiked: false,
        comments: [],
        isAnonymous: data.isAnonymous
      }));

      setPosts(prev => {
        const updated = [...newPosts, ...prev];
        try {
          localStorage.setItem('forum_posts_v3', JSON.stringify(updated));
        } catch (e) {
          console.error("Failed to save forum posts", e);
        }
        return updated;
      });

      // Trigger automatic mutual interactions for each new post sequentially
      newPosts.forEach(post => {
        simulateForumInteractions(post);
      });

      showToast(`成功刷新并获得了 ${newPosts.length} 篇新动态！`, 'success');

    } catch (err: any) {
      console.error('Failed to generate forum posts:', err);
      showToast(`生成论坛帖子失败：${err?.message || '网络连接或配置异常'}`, 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConfirmShare = async (session: ChatSession, post: ForumPost) => {
    try {
      const shareContent = `我向你分享了论坛帖子：【${post.title}】\n\n"${post.content.slice(0, 150)}${post.content.length > 150 ? '...' : ''}"\n\n💬 点击卡片可前往论坛与我共同探讨哦！`;
      
      // Save user share message
      const userMsg: ChatMessage = {
        id: `shared_post_${Date.now()}`,
        chatId: session.id,
        role: 'user',
        content: shareContent,
        timestamp: Date.now()
      };
      await dbInstance.saveMessage(userMsg);

      // Bring chat back to list and save
      const updatedSession = {
        ...session,
        isChatHidden: false,
        updatedAt: Date.now()
      };
      await dbInstance.saveSession(updatedSession);

      // Trigger automatic reply in shared chat!
      setTimeout(async () => {
        try {
          const settings = await dbInstance.getSettings();
          let replyText = '';

          if (settings.apiKey) {
            const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
            const targetUrl = `${cleanBaseUrl}/chat/completions`;

            const promptSystem = session.isGroup 
              ? `你现在要在群聊中扮演角色。你刚刚收到了一个用户分享的论坛帖子：【${post.title}】。`
              : `你现在扮演名叫 ${session.characterName} 的人物。你的伴侣刚刚在私聊中向你分享了论坛帖子：【${post.title}】。`;
            
            const promptBody = `
角色设定：${getSystemMemoryPrompt(session)}
背景：${session.worldBook}
帖子标题：${post.title}
帖子正文：${post.content}

请以第一人称回复这个分享，说说你对这篇帖子的看法或评价。
要求：
1. 贴合性格与背景，语气自然、生活化、字数在 60 字以内。
2. 绝对只输出回复文本，不能有解释或任何说明。`;

            const bodyData = {
              model: settings.selectedModel || 'gpt-4o',
              messages: [
                { role: 'system', content: promptSystem },
                { role: 'user', content: promptBody }
              ],
              temperature: 0.85,
              max_tokens: 256
            };

            const resJson = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
            replyText = resJson.choices?.[0]?.message?.content?.trim() || '';
          }

          if (!replyText) {
            return; // No API Key or API error: do not send fallback message
          }

          const replyMsg: ChatMessage = {
            id: `shared_post_reply_${Date.now()}`,
            chatId: session.id,
            role: 'assistant',
            senderName: session.isGroup ? session.characterName : undefined,
            senderAvatar: session.isGroup ? session.characterAvatar : undefined,
            content: replyText,
            timestamp: Date.now()
          };
          await dbInstance.saveMessage(replyMsg);

          // Update session timestamp again
          const lastUpdatedSession = {
            ...updatedSession,
            updatedAt: Date.now()
          };
          await dbInstance.saveSession(lastUpdatedSession);

        } catch (err) {
          console.warn('Failed to generate shared chat reply:', err.message || err);
        }
      }, 1500 + Math.random() * 1000);

      // Show alert/notification via in-app toast
      showToast(`🎉 成功分享至：${session.isGroup ? session.title : formatDisplayName(session.characterName)}！`, 'success');
      setSharingPost(null);

    } catch (e) {
      console.error(e);
      showToast('分享失败，请重试。', 'error');
    }
  };

  const getAuthorBadgeAndColor = (type: 'octocat' | 'assistant' | 'user' | 'custom', isAnonymous?: boolean, name?: string) => {
    if (isAnonymous) {
      return {
        bg: 'bg-zinc-100 text-zinc-500 border-zinc-200',
        icon: <User size={16} className="text-zinc-500" />,
        title: '匿名'
      };
    }
    switch (type) {
      case 'octocat':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          icon: <span className="text-sm">🐱</span>,
          title: '本机作者'
        };
      case 'assistant':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-100',
          icon: <Bot size={16} className="text-indigo-600" />,
          title: 'AI 助手'
        };
      case 'custom':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-100',
          icon: <Sparkles size={16} className="text-amber-600" />,
          title: '自定义角色'
        };
      case 'user':
      default:
        const cleanName = name ? formatDisplayName(name) : '';
        const userDisplayName = getUserDisplayName();
        const isUserSelf = cleanName === userDisplayName || cleanName === '用户 (你)' || cleanName === '用户' || cleanName === '匿名用户' || cleanName === '我' || cleanName === '旅人 (你)' || cleanName === '旅人' || cleanName === '匿名旅人' || !cleanName;
        return {
          bg: 'bg-sky-50 text-sky-700 border-sky-100',
          icon: <User size={16} className="text-sky-600" />,
          title: isUserSelf ? '你' : '路人'
        };
    }
  };

  const getCategoryDetails = (category: any) => {
    switch (category) {
      case 'hot':
        return { label: '近期热门', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: <Flame size={16} /> };
      case 'rant':
      case 'feedback':
        return { label: '日常吐槽区', color: 'bg-rose-50 text-rose-700 border-rose-100', icon: <Frown size={16} /> };
      case 'gossip':
      case 'chitchat':
        return { label: '八卦闲聊区', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <MessageCircle size={16} /> };
      case 'intel':
      case 'tech':
        return { label: '情报交流区', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: <Cpu size={16} /> };
      case 'confession':
      case 'brainstorm':
        return { label: '袒露心声区', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: <Heart size={16} className="text-purple-600" /> };
      default:
        return { label: '八卦闲聊区', color: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: <MessageCircle size={16} /> };
    }
  };

  const normalizeAuthorType = (type: string, name: string): 'octocat' | 'assistant' | 'user' | 'custom' => {
    if (type === 'user') return 'user';
    const cleanName = name ? formatDisplayName(name) : '';
    const isOctocat = (cleanName.includes('章鱼猫') || cleanName.includes('章导爱玩小手机')) || cleanName.toLowerCase().includes('octocat');
    if (isOctocat) return 'octocat';
    if (type === 'octocat' || type === 'assistant') return 'custom';
    return (type as any) || 'custom';
  };

  // 1. Data layer uniform filtering & name normalization (only showing nicknames, no real names, and formatting anonymous author names as '匿名')
  const displayPosts = React.useMemo(() => {
    return posts
      .filter(post => {
        // Uniform filter: make sure no system-generated posts represent the user
        if (!post.isUserCreated) {
          const name = post.authorName || '';
          if (name === '用户 (你)' || name === '用户' || name === '匿名用户' || name === '旅人 (你)' || name === '旅人' || name === '匿名旅人' || name === '我' || post.authorType === 'user') {
            return false;
          }
        }
        return true;
      })
      .map(post => {
        return {
          ...post,
          authorType: normalizeAuthorType(post.authorType, post.authorName),
          authorName: formatAuthorName(post.authorName, post.isAnonymous),
          comments: (post.comments || []).map(c => ({
            ...c,
            authorType: normalizeAuthorType(c.authorType, c.authorName),
            authorName: formatAuthorName(c.authorName, c.isAnonymous),
            replyTo: c.replyTo ? formatAuthorName(c.replyTo, false) : undefined
          }))
        };
      });
  }, [posts]);

  const filteredPosts = React.useMemo(() => {
    return displayPosts.filter(post => {
      const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;
      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            post.authorName.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [displayPosts, selectedCategory, searchQuery]);

  // Synchronized active post with formatted names & comments
  const displayActivePost = React.useMemo(() => {
    if (!activePost) return null;
    const synced = displayPosts.find(p => p.id === activePost.id);
    if (synced) return synced;
    return {
      ...activePost,
      authorType: normalizeAuthorType(activePost.authorType, activePost.authorName),
      authorName: formatAuthorName(activePost.authorName, activePost.isAnonymous),
      comments: (activePost.comments || []).map(c => ({
        ...c,
        authorType: normalizeAuthorType(c.authorType, c.authorName),
        authorName: formatAuthorName(c.authorName, c.isAnonymous),
        replyTo: c.replyTo ? formatAuthorName(c.replyTo, false) : undefined
      }))
    };
  }, [activePost, displayPosts]);

  const isUserPublishedPost = (p: ForumPost): boolean => {
    if (p.isUserCreated || p.authorType === 'user') return true;
    const uname = getUserDisplayName();
    const name = p.authorName;
    return name === uname || name === '用户 (你)' || name === '用户 (图)' || name === '匿名用户' || name === '旅人 (图)' || name === '旅人 (你)' || name === '匿名旅人';
  };

  const userPublishedPosts = React.useMemo(() => {
    return displayPosts.filter(p => isUserPublishedPost(p));
  }, [displayPosts]);

  const userBookmarkedPosts = React.useMemo(() => {
    return displayPosts.filter(p => !!p.hasBookmarked);
  }, [displayPosts]);

  const renderPostCard = (post: ForumPost) => {
    const authorMeta = getAuthorBadgeAndColor(post.authorType, post.isAnonymous, post.authorName);
    const catMeta = getCategoryDetails(post.category);
    
    return (
      <motion.div
        key={post.id}
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={() => setActivePost(post)}
        className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer space-y-4"
      >
        {/* Card Header Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {/* Author Info */}
            <div className="leading-tight">
              <div className="text-xs font-bold text-zinc-850 flex items-center space-x-2">
                <span>{post.authorName}</span>
                {post.authorType !== 'custom' && (
                  <span className={`text-[9px] h-6 px-2 rounded-lg font-bold flex items-center justify-center ${authorMeta.bg} border`}>
                    {authorMeta.title}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 font-medium">{post.timestamp}</span>
            </div>
          </div>

          {/* Category Badge */}
          <div className={`h-[24px] px-2 rounded-lg border flex items-center space-x-2 text-[10px] font-bold ${catMeta.color}`}>
            {catMeta.icon}
            <span>{catMeta.label}</span>
          </div>
        </div>

        {/* Title & snippet */}
        <div className="space-y-2">
          <h3 className="text-sm font-extrabold text-zinc-900 leading-snug">{post.title}</h3>
          <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
            {post.content}
          </p>
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-zinc-100"></div>

        {/* Footer Stats Row */}
        <div className="flex items-center justify-between text-zinc-400 text-xs">
          <div className="flex items-center space-x-3">
            
            {/* Like button */}
            <button
              type="button"
              onClick={(e) => handleLikePost(post.id, e)}
              className={`flex items-center space-x-1.5 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer ${
                post.hasLiked ? 'text-rose-500 font-bold' : ''
              }`}
              title={post.hasLiked ? "取消点赞" : "点赞"}
            >
              <Heart size={16} fill={post.hasLiked ? 'currentColor' : 'none'} />
              <span>{post.likes}</span>
            </button>

            {/* Bookmark button */}
            <button
              type="button"
              onClick={(e) => handleBookmarkPost(post.id, e)}
              className={`flex items-center space-x-1.5 hover:text-amber-500 transition-colors p-1.5 rounded-lg hover:bg-amber-50 cursor-pointer ${
                post.hasBookmarked ? 'text-amber-500 font-bold' : 'text-zinc-400'
              }`}
              title={post.hasBookmarked ? "取消收藏" : "收藏帖子"}
            >
              <Bookmark size={16} fill={post.hasBookmarked ? 'currentColor' : 'none'} />
            </button>

            {/* Comment Count badge */}
            <div className="flex items-center space-x-1.5 p-1.5 rounded-lg">
              <MessageSquare size={16} />
              <span>{post.comments.length}</span>
            </div>

          </div>

          {/* Action buttons (Delete & Share) */}
          <div className="flex items-center space-x-1">
            {/* Delete post button */}
            <button
              type="button"
              onClick={(e) => handleDeletePost(post.id, e)}
              className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer active:scale-95"
              title="删除帖子"
            >
              <Trash2 size={16} />
            </button>
            
            {/* Share button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSharingPost(post);
              }}
              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer active:scale-95"
              title="分享到聊天"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>

      </motion.div>
    );
  };

  const detailPost = displayActivePost || activePost;

  return (
    <div 
      className="flex-1 flex flex-col h-full relative overflow-hidden select-none transition-colors duration-200"
      style={{ backgroundColor: currentTheme.mainBg }}
    >
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 transform scale-100 max-w-[90%]">
          <div className={`px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 ${
            toastMsg.type === 'error' ? 'bg-rose-500 text-white border-rose-600' :
            toastMsg.type === 'success' ? 'bg-emerald-600 text-white border-emerald-700' :
            'bg-zinc-800 text-white border-zinc-700'
          }`}>
            <span>{toastMsg.message}</span>
          </div>
        </div>
      )}

      {/* 1. Header Bar - strictly h-16 (64px) with px-4 (16px) */}
      <div 
        className="h-16 px-4 border-b flex items-center justify-between shrink-0 shadow-2xs transition-colors duration-200"
        style={{
          backgroundColor: currentTheme.headerBg,
          borderBottomColor: currentTheme.headerBorder,
          color: currentTheme.headerText
        }}
      >
        <button
          type="button"
          onClick={onHome}
          className="w-8 h-8 rounded-lg bg-white/75 hover:bg-white border flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 shadow-2xs"
          style={{
            borderColor: currentTheme.headerBorder,
            color: currentTheme.headerText
          }}
          title="返回手机桌面"
        >
          <Home size={16} className="stroke-[2.5]" />
        </button>

        <h2 className="text-base font-black tracking-tight" style={{ color: currentTheme.headerText }}>论坛</h2>

        {/* Action Buttons Group - Clear gap (space-x-3) and visual distinction to prevent accidental touches */}
        <div className="flex items-center space-x-3">
          {/* Refresh Button - Icon Only (Hidden when in 'my' tab) */}
          {activeTab !== 'my' && (
            <button
              type="button"
              onClick={handleRefreshPosts}
              disabled={isRefreshing}
              className="w-8 h-8 rounded-lg bg-white/75 hover:bg-white flex items-center justify-center transition-all cursor-pointer active:scale-95 disabled:opacity-50 border shadow-2xs"
              style={{
                borderColor: currentTheme.headerBorder,
                color: currentTheme.headerText
              }}
              title="刷新论坛"
            >
              <RefreshCw size={16} className={`${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Publish Moment Button - Icon Only */}
          <button
            type="button"
            onClick={() => setIsNewPostOpen(true)}
            className="w-8 h-8 active:scale-95 rounded-lg flex items-center justify-center shadow-xs transition-all cursor-pointer border"
            style={{
              backgroundColor: currentTheme.primary,
              color: currentTheme.primaryText,
              borderColor: currentTheme.primaryHover
            }}
            title="发布新帖子"
          >
            <Plus size={18} className="stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* 2. Scrollable Body - strictly using space-y-4 (16px) */}
      <div className="flex-1 overflow-y-auto pb-24 space-y-4">
        {activeTab === 'forum' ? (
          <>
            {/* Search Bar - h-12 (48px), margins & padding are multiples of 8 */}
            <div className="mx-4 mt-4">
              <div className="relative h-12 flex items-center bg-white border border-gray-100 rounded-lg shadow-sm px-4">
                <Search size={16} className="text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索讨论帖子、作者或关键词..."
                  className="w-full text-xs text-gray-800 bg-transparent focus:outline-none"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Categories Tab Selector - padding px-4 (16px) and space-x-2 (8px) */}
            <div className="px-4">
              <div className="flex items-center space-x-2 overflow-x-auto py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x">
                
                {/* Category: All */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className={`h-[32px] px-4 rounded-lg flex items-center space-x-2 text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-[#1E1F35] text-white border-[#1E1F35] shadow-sm'
                      : 'bg-white text-zinc-600 border-zinc-100 hover:bg-zinc-50'
                  }`}
                >
                  <Layers size={16} />
                  <span>全部</span>
                </button>

                {/* Category: Hot */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('hot')}
                  className={`h-[32px] px-4 rounded-lg flex items-center space-x-2 text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                    selectedCategory === 'hot'
                      ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                      : 'bg-white text-zinc-600 border-zinc-100 hover:bg-zinc-50'
                  }`}
                >
                  <Flame size={16} />
                  <span>近期热门</span>
                </button>

                {/* Category: Rant */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('rant')}
                  className={`h-[32px] px-4 rounded-lg flex items-center space-x-2 text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                    selectedCategory === 'rant'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white text-zinc-600 border-zinc-100 hover:bg-zinc-50'
                  }`}
                >
                  <Frown size={16} />
                  <span>日常吐槽区</span>
                </button>

                {/* Category: Gossip */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('gossip')}
                  className={`h-[32px] px-4 rounded-lg flex items-center space-x-2 text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                    selectedCategory === 'gossip'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-zinc-600 border-zinc-100 hover:bg-zinc-50'
                  }`}
                >
                  <MessageCircle size={16} />
                  <span>八卦闲聊区</span>
                </button>

                {/* Category: Intel */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('intel')}
                  className={`h-[32px] px-4 rounded-lg flex items-center space-x-2 text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                    selectedCategory === 'intel'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-zinc-600 border-zinc-100 hover:bg-zinc-50'
                  }`}
                >
                  <Cpu size={16} />
                  <span>情报交流区</span>
                </button>

                {/* Category: Confession */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory('confession')}
                  className={`h-[32px] px-4 rounded-lg flex items-center space-x-2 text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                    selectedCategory === 'confession'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-zinc-600 border-zinc-100 hover:bg-zinc-50'
                  }`}
                >
                  <Heart size={16} />
                  <span>袒露心声区</span>
                </button>

              </div>
            </div>

            {/* Posts List Cards Container - space-y-4 (16px) */}
            <div className="px-4 space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredPosts.length > 0 ? (
                  filteredPosts.map((post) => renderPostCard(post))
                ) : (
                  <div className="text-center py-12 space-y-2 bg-white rounded-2xl border border-gray-100 p-4">
                    <Search size={32} className="text-zinc-300 mx-auto" />
                    <h4 className="text-xs font-bold text-zinc-700">没有找到相关讨论帖</h4>
                    <p className="text-[10px] text-zinc-400">试着换一个分类，或搜索其他关键词吧！</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <>
            {/* User Profile Info Card */}
            <div 
              className="mx-4 mt-4 p-5 border rounded-3xl shadow-xs flex flex-col items-center text-center space-y-3 relative overflow-hidden transition-colors"
              style={{
                backgroundColor: currentTheme.cardBg,
                borderColor: currentTheme.cardBorder
              }}
            >
              <div 
                className="w-16 h-16 rounded-full border-2 flex items-center justify-center shadow-inner overflow-hidden shrink-0"
                style={{
                  backgroundColor: currentTheme.accentLight,
                  borderColor: currentTheme.primary,
                  color: currentTheme.primary
                }}
              >
                {(() => {
                  const avatar = getUserAvatar();
                  return avatar && avatar !== '🤖' ? (
                    <img src={avatar} alt="User Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User size={32} />
                  );
                })()}
              </div>

              <div className="leading-tight">
                <h3 className="text-sm font-black text-zinc-900">{getUserDisplayName()}</h3>
                <p className="text-[10px] text-zinc-400 font-medium mt-1">记录日常生活中的真实点滴</p>
              </div>
            </div>

            {/* Theme Setting Entry Card */}
            <div className="mx-4">
              <button
                type="button"
                onClick={() => setShowThemeModal(true)}
                className="w-full p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer active:scale-[0.99] shadow-xs group text-left"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.cardBorder
                }}
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center border shadow-2xs shrink-0 transition-colors"
                    style={{
                      backgroundColor: currentTheme.accentLight,
                      borderColor: currentTheme.primary,
                      color: currentTheme.primary
                    }}
                  >
                    <Palette size={20} className="stroke-[2.2]" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-xs font-black text-zinc-900">论坛主题风格</h4>
                      <span 
                        className="w-2.5 h-2.5 rounded-full border border-white shadow-2xs inline-block" 
                        style={{ backgroundColor: currentTheme.primary }} 
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 font-medium mt-0.5">
                      当前：{currentTheme.name}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <span className="text-[11px] font-bold" style={{ color: currentTheme.primary }}>切换配色</span>
                  <ChevronRight size={16} className="text-zinc-400" />
                </div>
              </button>
            </div>

            {/* Sub-tabs for My Profile page */}
            <div className="mx-4 flex items-center bg-zinc-100/80 p-1 rounded-2xl">
              <button
                type="button"
                onClick={() => setMySubTab('published')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  mySubTab === 'published' ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <span>我发布的 ({userPublishedPosts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMySubTab('bookmarked')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  mySubTab === 'bookmarked' ? 'bg-white text-amber-600 shadow-xs' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                <Bookmark size={13} className={mySubTab === 'bookmarked' ? 'fill-amber-500 text-amber-500' : ''} />
                <span>我的收藏 ({userBookmarkedPosts.length})</span>
              </button>
            </div>

            {/* Posts list under selected sub-tab */}
            <div className="px-4 space-y-4">
              {mySubTab === 'published' ? (
                <>
                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-xs font-black text-zinc-850 flex items-center space-x-2">
                      <span>我发布的帖子 ({userPublishedPosts.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleDeleteAllPosts}
                      className="px-2.5 h-7 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 rounded-lg flex items-center space-x-1 text-[10px] font-bold border border-rose-100 transition-all cursor-pointer shrink-0"
                      title="清空论坛所有帖子"
                    >
                      <Trash2 size={12} />
                      <span>清空所有帖子</span>
                    </button>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {userPublishedPosts.length > 0 ? (
                      userPublishedPosts.map((post) => renderPostCard(post))
                    ) : (
                      <div className="text-center py-12 space-y-2 bg-white rounded-2xl border border-gray-100 p-4">
                        <Search size={32} className="text-zinc-300 mx-auto" />
                        <h4 className="text-xs font-bold text-zinc-700">暂无已发帖子</h4>
                        <p className="text-[10px] text-zinc-400">你还没有发布过帖子，快点击右上角的加号发布第一篇吧！</p>
                      </div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-xs font-black text-zinc-850 flex items-center space-x-2">
                      <span>我的收藏帖子 ({userBookmarkedPosts.length})</span>
                    </span>
                  </div>

                  <AnimatePresence mode="popLayout">
                    {userBookmarkedPosts.length > 0 ? (
                      userBookmarkedPosts.map((post) => renderPostCard(post))
                    ) : (
                      <div className="text-center py-12 space-y-2 bg-white rounded-2xl border border-gray-100 p-4">
                        <Bookmark size={32} className="text-amber-300 mx-auto" />
                        <h4 className="text-xs font-bold text-zinc-700">暂无收藏帖子</h4>
                        <p className="text-[10px] text-zinc-400">去论坛逛逛吧，遇到有趣的帖子点击“收藏”就可以在这里找到！</p>
                      </div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* 4. Bottom Navigation Bar */}
      <div 
        className="h-16 px-4 border-t flex items-center justify-around shrink-0 z-10 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] transition-colors duration-200"
        style={{
          backgroundColor: currentTheme.cardBg,
          borderTopColor: currentTheme.cardBorder
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('forum')}
          className={`flex-1 flex flex-col items-center justify-center h-full transition-all cursor-pointer ${
            activeTab === 'forum' ? 'font-bold' : 'text-zinc-400 hover:text-zinc-600'
          }`}
          style={activeTab === 'forum' ? { color: currentTheme.navActiveColor } : undefined}
        >
          <Compass size={20} className={`transition-transform duration-200 ${activeTab === 'forum' ? 'scale-110' : ''}`} />
          <span className="text-[10px] mt-1 font-bold">发现论坛</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('my')}
          className={`flex-1 flex flex-col items-center justify-center h-full transition-all cursor-pointer ${
            activeTab === 'my' ? 'font-bold' : 'text-zinc-400 hover:text-zinc-600'
          }`}
          style={activeTab === 'my' ? { color: currentTheme.navActiveColor } : undefined}
        >
          <User size={20} className={`transition-transform duration-200 ${activeTab === 'my' ? 'scale-110' : ''}`} />
          <span className="text-[10px] mt-1 font-bold">我的</span>
        </button>
      </div>

      {/* --- PANEL MODAL 1: POST DETAIL VIEW PANEL --- */}
      <AnimatePresence>
        {activePost && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-[#F9FCFF] z-20 flex flex-col justify-between overflow-hidden"
          >
            {/* Header h-16 (64px) with px-4 (16px) */}
            <div className="h-16 px-4 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setActivePost(null)}
                className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shrink-0"
                title="返回"
              >
                <ArrowLeft size={16} className="stroke-[2.5]" />
              </button>
              <span className="text-sm font-black text-zinc-900 truncate px-2">
                帖子详情
              </span>
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSharingPost(detailPost);
                  }}
                  className="w-10 h-10 rounded-lg bg-zinc-50 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-700 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                  title="分享到聊天"
                >
                  <Share2 size={20} />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleLikePost(detailPost.id, e)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer active:scale-95 ${
                    detailPost.hasLiked ? 'bg-rose-50 text-rose-500' : 'bg-gray-50 text-gray-400 hover:text-rose-500'
                  }`}
                >
                  <Heart size={20} fill={detailPost.hasLiked ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>

            {/* Scrollable details content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Post author and heading */}
              <div className="p-4 bg-white border border-gray-100 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="leading-tight">
                      <div className="text-xs font-bold text-zinc-850 flex items-center space-x-2">
                        <span>{detailPost.authorName}</span>
                        {detailPost.authorType !== 'custom' && (
                          <span className={`text-[9px] h-6 px-2 rounded-lg font-bold flex items-center justify-center ${getAuthorBadgeAndColor(detailPost.authorType, detailPost.isAnonymous, detailPost.authorName).bg} border`}>
                            {getAuthorBadgeAndColor(detailPost.authorType, detailPost.isAnonymous, detailPost.authorName).title}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-medium">{detailPost.timestamp}</span>
                    </div>
                  </div>

                  <div className={`h-[24px] px-2 rounded-lg border flex items-center space-x-2 text-[10px] font-bold ${getCategoryDetails(detailPost.category).color}`}>
                    {getCategoryDetails(detailPost.category).icon}
                    <span>{getCategoryDetails(detailPost.category).label}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h1 className="text-base font-extrabold text-zinc-900 leading-snug">{detailPost.title}</h1>
                  <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap select-text">
                    {detailPost.content}
                  </p>
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-zinc-100"></div>

                {/* Footer Action Bar */}
                <div className="flex items-center justify-between text-zinc-400 text-xs pt-1">
                  <div className="flex items-center space-x-3">
                    {/* Like button */}
                    <button
                      type="button"
                      onClick={(e) => handleLikePost(detailPost.id, e)}
                      className={`flex items-center space-x-1.5 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer ${
                        detailPost.hasLiked ? 'text-rose-500 font-bold' : ''
                      }`}
                    >
                      <Heart size={16} fill={detailPost.hasLiked ? 'currentColor' : 'none'} />
                      <span>{detailPost.likes}</span>
                    </button>

                    {/* Bookmark button */}
                    <button
                      type="button"
                      onClick={(e) => handleBookmarkPost(detailPost.id, e)}
                      className={`flex items-center space-x-1.5 hover:text-amber-500 transition-colors p-1.5 rounded-lg hover:bg-amber-50 cursor-pointer ${
                        detailPost.hasBookmarked ? 'text-amber-500 font-bold' : 'text-zinc-400'
                      }`}
                      title={detailPost.hasBookmarked ? "取消收藏" : "收藏帖子"}
                    >
                      <Bookmark size={16} fill={detailPost.hasBookmarked ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        handleDeletePost(detailPost.id, e);
                        setActivePost(null);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                      title="删除帖子"
                    >
                      <Trash2 size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSharingPost(detailPost);
                      }}
                      className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
                      title="分享到聊天"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Comments Section Heading */}
              <div className="flex items-center justify-between px-2 pt-2">
                <span className="text-xs font-black text-zinc-800 flex items-center space-x-2">
                  <MessageSquare size={16} className="text-amber-500" />
                  <span>所有评论 ({detailPost.comments.length})</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono uppercase">DISCUSSIONS</span>
              </div>

              {/* Comments list */}
              <div className="space-y-4">
                {detailPost.comments.length > 0 ? (
                  detailPost.comments.map((comm) => {
                    const commMeta = getAuthorBadgeAndColor(comm.authorType, comm.isAnonymous, comm.authorName);
                    return (
                      <div key={comm.id} className="p-4 bg-white border border-gray-50 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="leading-tight">
                              <div className="text-xs font-bold text-zinc-800 flex items-center flex-wrap gap-1.5">
                                <span>{comm.authorName}</span>
                                {comm.replyTo && (
                                  <>
                                    <span className="text-[10px] text-zinc-400 font-normal">回复</span>
                                    <span className="text-zinc-700">{comm.replyTo}</span>
                                  </>
                                )}
                                {comm.authorType !== 'custom' && (
                                  <span className={`text-[8px] h-5 px-1.5 rounded-md font-bold flex items-center justify-center ${commMeta.bg} border shrink-0`}>
                                    {commMeta.title}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2.5">
                            <span className="text-[9px] text-zinc-400 font-mono">{comm.timestamp}</span>
                            <button
                              type="button"
                              onClick={() => setReplyingToComment(comm)}
                              className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer active:scale-95 transition-transform"
                            >
                              回复
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-zinc-600 leading-relaxed select-text">
                          {comm.content}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 bg-zinc-50 border border-dashed border-zinc-200 rounded-2xl p-4">
                    <p className="text-[10px] text-zinc-400">目前还没有评论。发表评论来和角色开始互动吧！</p>
                  </div>
                )}
              </div>

            </div>

            {/* Bottom comment bar */}
            <div className="border-t border-gray-100 bg-white shrink-0">
              {/* Reply To indicator banner */}
              {replyingToComment && (
                <div className="px-4 py-2 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between text-xs text-indigo-700 font-medium shrink-0">
                  <span className="truncate">正在回复 @{replyingToComment.authorName} 的评论</span>
                  <button
                    type="button"
                    onClick={() => setReplyingToComment(null)}
                    className="p-1 rounded-full hover:bg-indigo-100 text-indigo-500 cursor-pointer active:scale-95 transition-transform"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              
              <div className="p-4 space-y-2 shrink-0">
                <form onSubmit={handleAddComment} className="flex items-center space-x-2 h-12 bg-gray-50 border border-gray-100 rounded-lg px-3">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={replyingToComment ? `回复 @${replyingToComment.authorName}...` : "写下你的评论想法..."}
                    className="w-full text-xs text-gray-800 bg-transparent focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim()}
                    className="w-8 h-8 rounded-lg bg-[#1E1F35] hover:bg-[#2A2B4A] disabled:opacity-30 disabled:hover:bg-[#1E1F35] text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </form>

                {/* Anonymous comment toggle */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="anon-comment-toggle"
                    checked={isAnonymousComment}
                    onChange={(e) => setIsAnonymousComment(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="anon-comment-toggle" className="text-[10px] text-zinc-500 select-none cursor-pointer">
                    匿名发表评论
                  </label>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PANEL MODAL 2: WRITE NEW POST PANEL --- */}
      <AnimatePresence>
        {isNewPostOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-0 bg-[#F9FCFF] z-30 flex flex-col justify-between overflow-hidden"
          >
            {/* Header h-16 (64px) with px-4 (16px) */}
            <div className="h-16 px-4 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setIsNewPostOpen(false)}
                className="w-12 h-12 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
              >
                <X size={24} />
              </button>
              <span className="text-sm font-black text-zinc-900">发布新讨论帖子</span>
              <div className="w-12 h-12"></div>
            </div>

            {/* Scrollable form content */}
            <form onSubmit={handleCreatePost} className="flex-1 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* Form fields card - p-4 (16px), rounded-2xl (16px), space-y-4 (16px) */}
                <div className="p-4 bg-white border border-gray-100 rounded-2xl space-y-4">
                  
                  {/* Title Field */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-700 block">帖子标题</label>
                    <input
                      type="text"
                      required
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      placeholder="写一个吸引人的标题..."
                      className="w-full h-12 bg-zinc-50 border border-zinc-100 rounded-lg px-4 text-xs text-zinc-800 focus:outline-none focus:border-indigo-300 transition-all"
                    />
                  </div>

                  {/* Category Field */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-700 block">选择分类频道</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewPostCategory('hot')}
                        className={`h-12 rounded-lg border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                          newPostCategory === 'hot'
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-white text-zinc-500 border-zinc-100 hover:bg-zinc-50'
                        }`}
                      >
                        <Flame size={16} />
                        <span>近期热门</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewPostCategory('rant')}
                        className={`h-12 rounded-lg border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                          newPostCategory === 'rant'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-white text-zinc-500 border-zinc-100 hover:bg-zinc-50'
                        }`}
                      >
                        <Frown size={16} />
                        <span>日常吐槽区</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewPostCategory('gossip')}
                        className={`h-12 rounded-lg border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                          newPostCategory === 'gossip'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-white text-zinc-500 border-zinc-100 hover:bg-zinc-50'
                        }`}
                      >
                        <MessageCircle size={16} />
                        <span>八卦闲聊区</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewPostCategory('intel')}
                        className={`h-12 rounded-lg border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                          newPostCategory === 'intel'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-white text-zinc-500 border-zinc-100 hover:bg-zinc-50'
                        }`}
                      >
                        <Cpu size={16} />
                        <span>情报交流区</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewPostCategory('confession')}
                        className={`col-span-2 h-12 rounded-lg border text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                          newPostCategory === 'confession'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-white text-zinc-500 border-zinc-100 hover:bg-zinc-50'
                        }`}
                      >
                        <Heart size={16} className="text-purple-600" />
                        <span>袒露心声区</span>
                      </button>
                    </div>
                  </div>

                  {/* Content Field */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-700 block">讨论内容</label>
                    <textarea
                      required
                      rows={6}
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="分享你的见闻、创意、或者发帖吐槽吧..."
                      className="w-full bg-zinc-50 border border-zinc-100 rounded-lg p-4 text-xs text-zinc-850 focus:outline-none focus:border-indigo-300 transition-all resize-none leading-relaxed"
                    />
                  </div>

                  {/* Anonymous Toggle */}
                  <div className="flex items-center justify-between p-3.5 bg-zinc-50 border border-zinc-100 rounded-lg">
                    <div className="space-y-0.5 leading-none">
                      <span className="text-xs font-bold text-zinc-700 block">匿名发布</span>
                      <span className="text-[10px] text-zinc-400">勾选后将以“匿名”的身份发布此贴</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isNewPostAnonymous}
                      onChange={(e) => setIsNewPostAnonymous(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl flex items-start space-x-2 text-[11px] text-amber-800">
                  <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    帖子发布后将实时更新在论坛中。你发布的内容将由本地 IndexedDB 沙盒妥善保管，其他好友会在适当时间进行关注和互动。
                  </p>
                </div>

              </div>

              {/* Bottom Action Submit Button Row */}
              <div className="p-4 border-t border-gray-100 bg-white">
                <button
                  type="submit"
                  disabled={!newPostTitle.trim() || !newPostContent.trim()}
                  className="w-full h-12 rounded-lg bg-[#1E1F35] hover:bg-[#2A2B4A] active:scale-98 disabled:opacity-30 disabled:hover:bg-[#1E1F35] text-white text-xs font-black transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                >
                  <Send size={16} />
                  <span>发布到论坛</span>
                </button>
              </div>
            </form>

          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PANEL MODAL 3: SHARE POST TO CHAT SELECTOR PANEL --- */}
      <AnimatePresence>
        {sharingPost && (
          <>
            {/* Backdrop cover for clicking outside */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSharingPost(null)}
              className="absolute inset-0 bg-black z-30"
            />
            <motion.div
              initial={{ opacity: 0, y: '50%' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '50%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute inset-x-0 bottom-0 max-h-[85%] bg-white rounded-t-3xl border-t border-gray-100 shadow-2xl z-40 flex flex-col justify-between overflow-hidden"
            >
              {/* Header h-16 (64px) with px-4 (16px) */}
              <div className="h-16 px-4 border-b border-gray-100 bg-white flex items-center justify-between shrink-0">
                <button
                  type="button"
                  onClick={() => setSharingPost(null)}
                  className="w-12 h-12 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors cursor-pointer active:scale-95"
                >
                  <X size={20} />
                </button>
                <div className="text-center">
                  <span className="text-sm font-black text-zinc-900 block">分享至</span>
                  <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[200px] block">《{sharingPost.title}》</span>
                </div>
                <div className="w-12 h-12"></div>
              </div>

              {/* Scrollable chat list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {activeChats.length > 0 ? (
                  activeChats.map((chat) => {
                    const cleanName = chat.isGroup 
                      ? chat.title 
                      : formatDisplayName(chat.characterName);
                    
                    return (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => handleConfirmShare(chat, sharingPost)}
                        className="w-full p-4 bg-zinc-50 hover:bg-indigo-50/40 border border-zinc-100 hover:border-indigo-100 rounded-2xl flex items-center space-x-3 transition-all cursor-pointer text-left active:scale-98"
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center font-bold text-indigo-700 shrink-0 text-sm">
                          {chat.isGroup ? '👥' : cleanName.slice(0, 1)}
                        </div>
                        
                        {/* Chat info */}
                        <div className="flex-1 min-w-0 leading-tight">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-zinc-800 truncate">
                              {cleanName}
                            </span>
                            {chat.isGroup ? (
                              <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-bold shrink-0">
                                群聊
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold shrink-0">
                                私聊
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 font-medium truncate mt-1">
                            {cleanBackgroundText(chat.memory) || '点击将此帖子一键分享给伙伴。'}
                          </p>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center py-12 space-y-2 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <MessageCircle size={32} className="text-zinc-300 mx-auto" />
                    <h4 className="text-xs font-bold text-zinc-700">暂无活跃对话</h4>
                    <p className="text-[10px] text-zinc-400">请先在聊天应用里建立与角色的对话吧！</p>
                  </div>
                )}
              </div>

              {/* Bottom cancel row */}
              <div className="p-4 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  onClick={() => setSharingPost(null)}
                  className="w-full h-12 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 text-xs font-black transition-all flex items-center justify-center cursor-pointer"
                >
                  取消分享
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* --- PANEL MODAL 4: CUSTOM DELETE CONFIRMATION DIALOG --- */}
      <AnimatePresence>
        {deleteConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm(null)}
              className="absolute inset-0 bg-black z-45"
            />
            
            {/* Dialog Container */}
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="w-full max-w-[290px] bg-white rounded-3xl p-6 shadow-2xl border border-zinc-50 pointer-events-auto text-center space-y-4"
              >
                {/* Icon Container */}
                <div className="w-14 h-14 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center text-rose-500 mx-auto shadow-sm">
                  <Trash2 size={28} />
                </div>

                {/* Typography details */}
                <div className="space-y-2">
                  <h3 className="text-sm font-black text-zinc-900">
                    {deleteConfirm.type === 'single' ? '确认删除这篇帖子吗？' : '确认清空所有帖子吗？'}
                  </h3>
                  <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                    {deleteConfirm.type === 'single' 
                      ? '此操作将永久删除该讨论贴，你和其它角色将无法再浏览此内容。' 
                      : '此操作将彻底删除论坛内的全部帖子。所有讨论内容都将被清空且无法撤销。'}
                  </p>
                </div>

                {/* Actions button row */}
                <div className="flex flex-col space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={executeDeletion}
                    className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-rose-100"
                  >
                    确认删除
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(null)}
                    className="w-full h-11 rounded-xl bg-zinc-50 hover:bg-zinc-100 active:scale-98 text-zinc-500 text-xs font-bold transition-all cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* --- PANEL MODAL 5: FORUM THEME PICKER MODAL --- */}
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
                      <h3 className="text-sm font-black text-zinc-900 leading-none">论坛主题配色</h3>
                      <p className="text-[10px] font-sans text-zinc-400 uppercase mt-1">FORUM THEME PALETTE</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleSelectPresetTheme(FORUM_THEME_PRESETS[0])}
                      className="h-8 px-2.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-[11px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
                      title="恢复默认极光青蓝"
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
                    {FORUM_THEME_PRESETS.map((preset) => {
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
                      {['#4F46E5', '#4A7297', '#788A66', '#D97706', '#E17899', '#8E7CC3', '#009688', '#E91E63', '#FF5722', '#607D8B', '#0EA5E9', '#84CC16'].map((colorHex) => (
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
