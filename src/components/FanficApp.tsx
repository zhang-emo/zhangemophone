import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Home, Plus, Edit3, Trash2, Heart, Sparkles, User, RefreshCw, X, ChevronRight, Save, Check, Clock, BookOpen, PenTool, MessageCircle, Send, Bookmark, Utensils, UserCheck, CheckCircle, Database, ShoppingBag, Tag } from 'lucide-react';
import { dbInstance } from '../lib/db';
import { callOpenAIEndpoint } from '../lib/api';

export interface OCProfile {
  id: string;
  name: string;
  mainTag?: string; // 主标签（某鱼对角色的称呼用此代替）
  popularity?: '烫门' | '热门' | '温门' | '冷门'; // 热度（影响某鱼周边价格判定）
  age: string;
  birthday: string;
  gender: string;
  mbti: string;
  height: string;
  weight: string;
  hair: string;
  eyes: string;
  skin: string;
  features: string;
  personality: string;
  likes: string;
  dislikes: string;
  goodAt: string;
  hobbies: string;
  color: string;
  music: string;
  food: string;
  season: string;
  keyEvents: string;
  hiddenSide: string;
}

export interface FanficPost {
  id: string;
  category?: 'plaza' | 'ao3' | 'xianyu';
  isAo3?: boolean;
  price?: string;
  tradeType?: 'sell' | 'buy' | 'discuss';
  targetOcName?: string;
  title: string;
  content: string;
  authorPenName: string; // The pen name of the character/netizen
  authorType: 'character' | 'netizen';
  baseCharacterName?: string; // If authorType is character, who is it really? (for easter egg)
  tags: string[];
  likes: number;
  comments: number;
  timestamp: number;
  topComments?: string[];
}

export default function FanficApp({ onHome }: { onHome: () => void }) {
  const [activeTab, setActiveTab] = useState<'profiles' | 'plaza' | 'ao3' | 'xianyu' | 'editor' | 'reader' | 'author' | 'mine'>('plaza');
  const [prevTab, setPrevTab] = useState<'profiles' | 'plaza' | 'ao3' | 'xianyu' | 'editor' | 'reader' | 'author' | 'mine'>('plaza');
  const [bottomTab, setBottomTab] = useState<'eat' | 'mine'>('eat');
  
  const [activeAuthor, setActiveAuthor] = useState<{
    penName: string;
    baseCharacterName?: string;
    authorType?: 'character' | 'netizen';
  } | null>(null);

  const [characterPenNames, setCharacterPenNames] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('fanfic_character_pen_names');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  const [isAuthorRevealed, setIsAuthorRevealed] = useState(false);

  useEffect(() => {
    localStorage.setItem('fanfic_character_pen_names', JSON.stringify(characterPenNames));
  }, [characterPenNames]);

  const openAuthorPage = (penName: string, baseCharacterName?: string, authorType?: 'character' | 'netizen', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPrevTab(activeTab);
    setActiveAuthor({ penName, baseCharacterName, authorType });
    setIsAuthorRevealed(false);
    setActiveTab('author');
  };

  const openPost = (post: FanficPost, sourceTab?: 'plaza' | 'ao3' | 'xianyu' | 'mine' | 'author' | 'profiles') => {
    setPrevTab(sourceTab || activeTab);
    setActivePost(post);
    setActiveTab('reader');
  };

  const handleBackFromReader = () => {
    const target = prevTab || 'plaza';
    if (target === 'mine') {
      setBottomTab('mine');
      setActiveTab('mine');
    } else if (target === 'author') {
      setActiveTab('author');
    } else if (target === 'ao3' || target === 'xianyu' || target === 'plaza' || target === 'profiles') {
      setBottomTab('eat');
      setActiveTab(target);
    } else {
      setBottomTab('eat');
      setActiveTab(activePost?.category || (activePost?.isAo3 ? 'ao3' : 'plaza'));
    }
  };

  const handleBackFromAuthor = () => {
    if (prevTab === 'reader' && activePost) {
      setActiveTab('reader');
    } else if (prevTab === 'mine') {
      setBottomTab('mine');
      setActiveTab('mine');
    } else if (prevTab === 'ao3' || prevTab === 'xianyu' || prevTab === 'plaza' || prevTab === 'profiles') {
      setBottomTab('eat');
      setActiveTab(prevTab);
    } else {
      setBottomTab('eat');
      setActiveTab('plaza');
    }
  };

  const [settings, setSettings] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadData() {
      const s = await dbInstance.getSettings();
      setSettings(s);
      const sess = await dbInstance.getAllSessions();
      setSessions(sess);
      try {
        const dbProfiles = await dbInstance.getOcProfiles();
        if (dbProfiles && dbProfiles.length > 0) {
          setProfiles(dbProfiles);
        }
      } catch (e) {
        console.error('Failed to load OC profiles from SQLite database', e);
      }
    }
    loadData();
  }, []);
  
  const [profiles, setProfiles] = useState<OCProfile[]>(() => {
    const saved = localStorage.getItem('fanfic_oc_profiles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    return localStorage.getItem('fanfic_active_profile_id') || null;
  });
  
  const [editingProfile, setEditingProfile] = useState<OCProfile | null>(null);
  
  const [posts, setPosts] = useState<FanficPost[]>(() => {
    const saved = localStorage.getItem('fanfic_posts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [activePost, setActivePost] = useState<FanficPost | null>(null);
  
  const [likedPostIds, setLikedPostIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('fanfic_liked_post_ids');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('fanfic_bookmarked_post_ids');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [newCommentText, setNewCommentText] = useState('');

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('fanfic_oc_profiles', JSON.stringify(profiles));
    if (activeProfileId) {
      localStorage.setItem('fanfic_active_profile_id', activeProfileId);
    }
  }, [profiles, activeProfileId]);

  useEffect(() => {
    localStorage.setItem('fanfic_posts', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem('fanfic_liked_post_ids', JSON.stringify(likedPostIds));
  }, [likedPostIds]);

  useEffect(() => {
    localStorage.setItem('fanfic_bookmarked_post_ids', JSON.stringify(bookmarkedPostIds));
  }, [bookmarkedPostIds]);

  const handleToggleBookmark = (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isBookmarked = bookmarkedPostIds.includes(postId);
    const updated = isBookmarked
      ? bookmarkedPostIds.filter(id => id !== postId)
      : [...bookmarkedPostIds, postId];
    setBookmarkedPostIds(updated);
  };

  // Interactive Likes Handler
  const handleToggleLike = (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isLiked = likedPostIds.includes(postId);
    const updatedLikedIds = isLiked
      ? likedPostIds.filter(id => id !== postId)
      : [...likedPostIds, postId];

    setLikedPostIds(updatedLikedIds);

    const updatedPosts = posts.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          likes: isLiked ? Math.max(0, p.likes - 1) : p.likes + 1
        };
      }
      return p;
    });

    setPosts(updatedPosts);

    if (activePost && activePost.id === postId) {
      setActivePost({
        ...activePost,
        likes: isLiked ? Math.max(0, activePost.likes - 1) : activePost.likes + 1
      });
    }
  };

  // Add Comment Handler
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePost || !newCommentText.trim()) return;

    const commentStr = newCommentText.trim();
    const existingComments = activePost.topComments || [];
    const updatedComments = [commentStr, ...existingComments];
    const newCommentCount = (activePost.comments || 0) + 1;

    const updatedActivePost = {
      ...activePost,
      topComments: updatedComments,
      comments: newCommentCount
    };

    setActivePost(updatedActivePost);

    const updatedPosts = posts.map(p => p.id === activePost.id ? updatedActivePost : p);
    setPosts(updatedPosts);
    setNewCommentText('');
  };

  const getPopularityBadgeClass = (pop?: string) => {
    if (pop === '烫门') return 'bg-red-500 text-white';
    if (pop === '温门') return 'bg-emerald-500 text-white';
    if (pop === '冷门') return 'bg-[#5893ea] text-white';
    return 'bg-amber-500 text-white';
  };

  const getCleanCharacterName = (rawName?: string, penName?: string) => {
    // 1. Try reverse lookup via penName first
    if (penName) {
      for (const s of sessions) {
        const displayName = s.realName || s.characterName.split('的')[0].split('（')[0].split('(')[0].trim();
        if (characterPenNames[displayName] === penName || characterPenNames[s.characterName] === penName) {
          return displayName;
        }
      }
    }

    if (!rawName) return '已知角色';

    // 2. Search matched session in user's created contacts
    const matchedSession = sessions.find(s => 
      (s.realName && (s.realName === rawName || rawName.includes(s.realName))) ||
      (s.characterName && (s.characterName === rawName || rawName.includes(s.characterName)))
    );

    if (matchedSession?.realName) {
      return matchedSession.realName;
    }

    if (matchedSession?.characterName) {
      return matchedSession.characterName.split('的')[0].split('（')[0].split('(')[0].trim();
    }

    return rawName.split('的')[0].split('（')[0].split('(')[0].trim();
  };

  const formatCleanPrice = (rawPrice?: string, tradeType?: string, title?: string, content?: string) => {
    if (!rawPrice) return undefined;
    const str = rawPrice.trim();
    if (str === '询价' || str === '展示') {
      return str;
    }
    
    const combinedText = `${title || ''} ${content || ''} ${str}`;
    if (
      str.includes('询价') || 
      str.includes('估价') || 
      str.includes('求问市价') || 
      (tradeType === 'discuss' && (combinedText.includes('询价') || combinedText.includes('多少钱') || combinedText.includes('市价') || combinedText.includes('求问') || combinedText.includes('出不出')))
    ) {
      return '询价';
    }

    if (
      str.includes('展示') || 
      str.includes('晒谷') || 
      str.includes('晒痛包') || 
      str.includes('非卖') || 
      (tradeType === 'discuss' && (combinedText.includes('展示') || combinedText.includes('痛包') || combinedText.includes('谷美') || combinedText.includes('非卖') || combinedText.includes('扎板') || combinedText.includes('晒')))
    ) {
      return '展示';
    }

    const match = str.match(/\d+/);
    if (match) {
      return `￥${match[0]}`;
    }
    return str.startsWith('￥') || str.startsWith('¥') ? str : `￥${str}`;
  };

  // Editor handlers
  const handleSaveProfile = async () => {
    if (!editingProfile) return;
    const isNew = !profiles.find(p => p.id === editingProfile.id);
    let newProfiles;
    if (isNew) {
      newProfiles = [...profiles, editingProfile];
      if (!activeProfileId) setActiveProfileId(editingProfile.id);
    } else {
      newProfiles = profiles.map(p => p.id === editingProfile.id ? editingProfile : p);
    }
    setProfiles(newProfiles);

    // Persist to SQLite DB
    try {
      await dbInstance.saveOcProfiles(newProfiles);
    } catch (e) {
      console.error('Failed to save profiles to SQLite database', e);
    }

    const profileName = editingProfile.name.trim() || '未命名人设';
    setToastMessage(`✅ 档案【${profileName}】已保存，并存入 SQLite 本地数据库！`);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);

    const targetTab = (prevTab && prevTab !== 'editor') ? prevTab : 'mine';
    setActiveTab(targetTab);
  };

  const handleCreateProfile = () => {
    setEditingProfile({
      id: `oc_${Date.now()}`,
      name: '', mainTag: '', popularity: '热门', age: '', birthday: '', gender: '', mbti: '',
      height: '', weight: '', hair: '', eyes: '', skin: '', features: '',
      personality: '', likes: '', dislikes: '', goodAt: '', hobbies: '',
      color: '', music: '', food: '', season: '',
      keyEvents: '', hiddenSide: ''
    });
    setPrevTab(activeTab);
    setActiveTab('editor');
  };

  const handleDeleteProfile = (id: string) => {
    setDeleteProfileId(id);
  };

  // Generation Logic
  const handleGenerateFanfics = async (targetMode: 'plaza' | 'ao3' | 'xianyu' = (activeTab === 'ao3' ? 'ao3' : activeTab === 'xianyu' ? 'xianyu' : 'plaza')) => {
    if (!settings || !settings.apiKey) {
      setError("请先在设置中配置 API Key");
      return;
    }
    if (targetMode !== 'xianyu' && !activeProfileId) {
      setError("请先选择或创建一个梦男人设");
      setActiveTab('mine');
      return;
    }
    
    const activeProfile = profiles.find(p => p.id === activeProfileId);
    if (targetMode !== 'xianyu' && !activeProfile) return;

    setIsGenerating(true);
    setError(null);

    const charContext = sessions
      .filter(s => !s.isGroup && !s.isContactDeleted)
      .map(s => {
        const displayName = s.realName || s.characterName.split('的')[0].split('（')[0].split('(')[0].trim();
        const boundPenName = characterPenNames[displayName] || characterPenNames[s.characterName];
        return `- 角色真实姓名【${displayName}】${boundPenName ? `(已固定专属马甲笔名："${boundPenName}")` : '(尚无马甲笔名)'}：${s.memory.substring(0, 100)}...`;
      })
      .join('\n');

    const isAo3 = targetMode === 'ao3';
    const isXianyu = targetMode === 'xianyu';

    let promptSystem = '';
    let userPromptText = '';

    if (isXianyu) {
      const allProfilesText = profiles.length > 0
        ? profiles.map((p, idx) => `- 档案${idx + 1}: 姓名【${p.name || '未命名'}】，主标签【${p.mainTag || p.name || '未命名'}】，周边热度【${p.popularity || '热门'}】，${p.gender || ''} ${p.age || ''}岁，MBTI ${p.mbti || '未知'}，外貌特征: ${p.features || '无'}，性格与喜好: ${p.personality || ''}；喜欢 ${p.likes || ''}`).join('\n')
        : '（当前用户暂未创建具体档案，针对二次元通用梦周边发帖）';

      promptSystem = `你是一个二次元“二手交易论坛（某鱼）”的后台生成引擎。在这个论坛贴吧里，玩家网民，以及通讯录里的已知角色【披闲鱼马甲】会出谷（卖周边）、收谷（买周边）、或者发帖讨论/展示自己的痛包与谷美（如立牌、徽章、色纸、流沙麻将、拍立得、挂件、棉花娃娃等）。

【用户拥有的梦人设档案列表（请从中随机抽选人设的谷子/周边进行发帖）】：
${allProfilesText}

【通讯录已知角色列表（角色也会披闲鱼马甲在上面【买谷/收谷/展示/讨论】，绝对不会【出谷】卖周边）】：
${charContext || '（当前暂无通讯录角色，可自由发挥闲鱼路人卖家/买家）'}

========================================
【角色作为创作者的匿名与喜好禁令（最高优先级规则）】：
- 当帖子/作品是由通讯录角色作为创作者（authorType === "character"，即角色披马甲发帖/写作）时：
  1. 【绝对不允许在正文 content 或标题 title 中提及角色自己的任何真名、昵称、官方昵称或花名】！
  2. 【绝对不可直白提及角色自己的职业或工作】（例如：绝对严禁写“我是教授”、“我是特警”、“我是老板”、“我是设计师”等，必须保持马甲的完全匿名性）！
- 在整个论坛生成的任何帖子与正文里：
  3. 【绝对不可以直白的提及角色的喜好食物与喜好音乐】（例如：绝对严禁直白描写“他最喜欢吃XX”、“他平时最常听XX音乐”等！切忌生硬列出喜好列表）！

========================================
【角色出谷限制规则（极其重要）】：
- 【通讯录角色绝对不会出谷/卖谷！】（通讯录里的已知角色披闲鱼马甲时，只允许发【收谷/buy】或【晒谷/讨论/discuss】帖，【出谷/sell】帖子必须且只能由路人网民（netizen）发帖！）。

========================================
【角色称呼与主标签规则（极其重要）】：
- 某鱼所有帖子对该角色的称呼（包括帖子中的 targetOcName、标题和正文中对角色的所有提及）必须统一使用该档案的【主标签】（如果用户未填主标签，则使用姓名）代替！

========================================
【周边热度、品类与价格/复数预算判定规则（极其重要）】：
- 帖子的标价/单价（price）以及盘扣/捆绑/议价要求必须严格按以下规则判定：
  1. 热度与吧唧基准单价：
     - 烫门：高溢价、多捆/H捆C（普谷：¥80至¥150/1吧唧；稀有/古早谷：¥300至¥800+/1吧唧）
     - 热门：正常热门、价格略高于官价（普谷：¥40至¥80/1吧唧；稀有/古早谷：¥150至¥600+/1吧唧）
     - 温门：官价或微溢价（普谷：¥25至¥30/1吧唧；稀有/古早谷：¥150至¥300+/1吧唧）
     - 冷门：白菜价、捆物（普谷：¥5至¥15/1吧唧；稀有/古早谷：¥50至¥100+/1吧唧）

  2. 不同谷子品类浮动规则：
     - 拍立得、小卡类纸片制品：比吧唧便宜一些，单价浮动在 ¥5至¥30。
     - 立牌、亚克力砖等制品：无论热度，价格通常稳定在 ¥40至¥200。

  3. 少见于市的大稀有品类天花板：
     - 绝版/限量吧唧、立牌、挂画、版画、毛毯、官方娃娃、联动娃娃、联名香水、联名手表等大稀有谷子，无论热度如何，单价基本固定在 ¥900至¥4000+/1！

  4. 标价与预算价格格式（极其重要）：
     - 【出谷(sell)】与【收谷(buy)】帖子：标价/预算 price 必须且仅能填写为【￥纯数字】格式（例如：'￥120'、'￥2500'、'￥450'）。绝对不包含任何单位或描述后缀！
     - 【询价帖】（询问市价/查价/求估价）：price 字段必须直接填写为【询价】！
     - 【展示贴/晒谷贴】（痛包/谷美/展示/非卖品）：price 字段必须直接填写为【展示】！
     - 具体的买卖数量、出/收说明、打包要求请写在正文 content 中。

  5. 允许并鼓励发出的讨论帖类型（discuss）：
     - 允许并欢迎出现【询问市价】（例：‘求问家产这款绝版吧唧现在市价多少？’）与【抱怨谷价过高/吐槽炒谷】（例：‘家产这块砖溢价也太夸张了吧！’、‘冷门捆三吃不起’）等贴！

========================================
【全局健康与外貌描写禁令】：
1. 默认所有角色（包括所有男女主角与配角）均进行精细的体毛管理，【绝对严禁出现任何胡子、胡茬、络腮胡或体毛描写】！
2. 整个正文、描述及评论中，【绝对严禁出现任何吸烟、抽烟、点烟、烟草、香烟、烟灰、吐烟圈等相关词汇和行为描写】！

========================================
【角色粉籍称呼与代称规则（极其重要）】：
- 表达角色粉丝/单推/吃谷人时，必须优先且只能使用：【（主标签）厨】或【（主标签）推】（例: ‘家产厨’、‘家产推’、‘小狗推’）。
- 【极其重要】：若未填写主标签，【绝对严禁】使用‘角色姓名(仅名)厨/推’（如严禁使用‘陆沉厨’/‘沉厨’）或‘角色职业厨/推’（如严禁使用‘教授推’）！未填主标签时统一改用通用粉丝称呼（如‘同好’、‘梦向粉’、‘二次元粉’等）。

========================================
【同好评论区专属代称与规则】：
- 生成的同好评论（topComments）中，【绝对不允许出现任何已知角色的真实姓名、官方昵称或花名】！
- 如果需要合并称呼作品里的男女主角两个人（CP/双主角/男女主），必须统一且仅使用“家产”作为代称！（例如：“家产这套谷美绝了”、“求家产双人立牌”、“家产锁死”等）。
- 如果需要单人称呼女主角/女主，必须统一且仅使用“家女”或“我家明珠”作为代称！（例如：“家女太美了”、“我家明珠今天也是绝美美貌”、“求家女单人吧唧”等）。

========================================
【某鱼发帖生成指令】：
你需要【针对用户所有档案内随机抽选人设】，一次性【固定生成 4 篇】二手交易论坛的帖子！
包含：出谷（sell）、收谷（buy）、讨论/展示痛包或谷美（discuss）。
请严格返回合法的 JSON 对象，格式如下：
{
  "fanfics": [
    {
      "title": "帖子标题（例如：【出】烫谷现货！流沙麻将/色纸打包走，或者【高价收】绝版全彩痛包/拍立得，或者【讨论】家产这款立牌配什么扎板好看？）",
      "content": "帖子正文内容（描述谷子品相、盘扣/打包要求、邮费、或者讨论心得，如需换行请使用 \\n）",
      "price": "标价、预算或性质（出/收帖填 ￥纯数字 如 '￥120'；询价帖填 '询价'；展示/晒谷贴填 '展示'）",
      "tradeType": "sell" 或 "buy" 或 "discuss",
      "targetOcName": "涉及的是哪一个人设的周边谷子（严格填写该人设档案的【主标签】）",
      "authorPenName": "发帖闲鱼ID/笔名",
      "authorType": "character" (如果是通讯录里的角色披马甲发的，注意：角色绝对不能出谷sell) 或 "netizen" (如果是路人网民发的),
      "baseCharacterName": "如果是 character 写的话，填写角色的简短真实姓名/昵称（例如：'诺顿' 或 '诺顿·坎贝尔'，严禁带有 '平行世界'、'同位体' 等冗长设定描述），如果是路人填 null",
      "tags": ["出谷", "烫谷", "痛包", "吃谷" 等 2-4个标签],
      "topComments": ["回帖评论1", "回帖评论2"] // 1~3条简短的回帖评论（如：“排！”、“已私”、“家产这套绝了”）
    }
  ]
}
【极其重要】：
1. 所有的双引号必须转义。绝对不可直接使用真实换行，必须使用 \\n。
2. 必须生成 4 篇帖子（fanfics 数组元素个数为 4）。
3. 返回的结果必须是一个合法的 JSON 对象。
`;
      userPromptText = `请从用户所有档案中随机抽选人设，严格按照要求固定生成 4 篇某鱼二手交易/谷子讨论帖 JSON。`;
    } else {
      const profileText = `
【主角（用户）人设档案】
- 基础：姓名 ${activeProfile?.name || '未命名'}，${activeProfile?.age || '未知年龄'}，性别 ${activeProfile?.gender || '保密'}，生日 ${activeProfile?.birthday || '未知'}，MBTI ${activeProfile?.mbti || '未知'}
- 外貌：身高 ${activeProfile?.height || '未知'}，体重 ${activeProfile?.weight || '未知'}，发型/发色 ${activeProfile?.hair || '未知'}，眼瞳 ${activeProfile?.eyes || '未知'}，肤色 ${activeProfile?.skin || '未知'}，特征 ${activeProfile?.features || '无'}
- 性格：${activeProfile?.personality || '未知'}
- 喜好：喜欢 ${activeProfile?.likes || '无'}，讨厌 ${activeProfile?.dislikes || '无'}，擅长 ${activeProfile?.goodAt || '无'}，兴趣 ${activeProfile?.hobbies || '无'}
- 偏好细节：颜色 ${activeProfile?.color || '无'}，音乐 ${activeProfile?.music || '无'}，食物 ${activeProfile?.food || '无'}，季节 ${activeProfile?.season || '无'}
- 人生大事件：${activeProfile?.keyEvents || '无'}
- 隐藏面/秘密：${activeProfile?.hiddenSide || '无'}
`;

      promptSystem = `你是一个“同人创作社区”的后台生成引擎。这个同人社区中有通讯录里的已知角色【披马甲/笔名】产粮，也有路人同好网民产粮。

【当前同人作品主角（即用户梦人设）档案】：
${profileText}

【通讯录已知角色列表（极其重要：如果角色产粮，必须使用通讯录里的角色真实名字；马甲笔名由你决定或沿用已有马甲）】：
${charContext || '（当前暂无通讯录角色，全由路人同好产粮）'}

========================================
【角色作为创作者的匿名与喜好禁令（最高优先级规则）】：
- 当作品/文章是由通讯录角色作为创作者（authorType === "character"，即角色披马甲/笔名写作）时：
  1. 【绝对不允许在正文 content 或标题 title 中提及角色自己的任何真名、昵称、官方昵称或花名】！
  2. 【绝对不可直白提及角色自己的职业或职务】（例如：绝对严禁写“我是教授”、“我是特警”、“我是老板”等，必须保持马甲的完全匿名性）！
- 在所有生成的同人作品正文、片段与描述中：
  3. 【绝对不可以直白的提及角色的喜好食物与喜好音乐】（例如：绝对严禁直白写出“他最爱吃XX”、“他最喜欢听XX风格的音乐”等列举式说明！要通过氛围与情景自然流露，切忌生硬列出喜好列表）！

========================================
【全局健康与外貌描写禁令】：
1. 默认所有角色（包括所有男女主角与配角）均进行精细的体毛管理，【绝对严禁出现任何胡子、胡茬、络腮胡或体毛描写】！
2. 整个正文、描述及评论中，【绝对严禁出现任何吸烟、抽烟、点烟、烟草、香烟、烟灰、吐烟圈等相关词汇和行为描写】！

========================================
【同好评论区专属代称与规则】：
- 生成的同好评论（topComments）中，【绝对不允许出现任何已知角色的真实姓名、官方昵称或花名】！
- 如果需要合并称呼作品里的男女主角两个人（CP/双主角/男女主），必须统一且仅使用“家产”作为代称！（例如：“家产真的太好嗑了”、“家产锁死”、“救命家产太甜了”等）。
- 如果需要单人称呼女主角/女主，必须统一且仅使用“家女”或“我家明珠”作为代称！（例如：“家女太绝了”、“我家明珠今天也是绝美美貌”、“家女独美”等）。

========================================
【核心文风预设与写作指令（按要求选择使用）】：

【文风预设一：电影感镜头 / 极简意识流】
1. 影像化叙事：禁止心理旁白，改用“镜头语言”。通过环境光的明暗、雨滴的划落、指尖的颤抖来传达情绪，而非直接描述心情或心理。
2. 极简主义与去工业化：剔除冗余形容词，力量感来源于精准动词，拒绝套路与工业糖精。
3. 专项修正：拒绝“解释性回复”，打破 [动作]+[内心戏] 循环，采用感官错位（用听觉写视觉，用触觉写听觉）。
4. 语言风格参考：海明威‘冰山理论’或王家卫意识流独白。具文学性而非剧本说明。
5. 词汇禁令：严禁出现 ‘猎物、诚实、有趣、涟漪、手术刀’ 等被污染词汇。

【文风预设二：真实质朴白描风格】
1. 真实环境白描：用平实自然、顺滑如白开水般的语言铺垫环境场景，真实贴合生活，不使用冗杂叙述，蕴含深厚情感。
2. 人物对话氛围：将真实情感不加繁复修饰表达出来，语言简单质朴、真实鲜活不嚼蜡。直接呈现生活化对话，不堆砌修饰，真实表达人心。
3. 感情与性张力：通过对细微变化的描写衬托爱意与暧昧（字字不说爱，字字都是爱）。
   【绝对禁止出现词汇组合】：严禁出现 ‘揉进，揉碎，浮木，低吼一声，长驱直入，神明，把命给你，神祇，主人，囚笼，骑士’ 等词，会严重破坏白描氛围！
4. 酸涩与情绪流转：通过切入周围环境烘托主人公苦情与酸涩，七分真实加三分生动，干净利落，不拖泥带水。

【文风应用规则】：
1. 脑洞/梗/摘要类作品：不需要文风修饰，保持真实、简洁、脑洞大开或碎碎念式的直接呈现。
2. 正文短文类作品：请在【文风预设一】与【文风预设二】中【各自独立随机选择一种文风】进行创作，使生成的作品风格丰富多样、不拘一格。
========================================

${isAo3 ? '【注意：你需要生成的内容是成人向（NSFW / R18）的同人作品，包括两性情感的描写。但绝不可包含违背安全政策的极端露骨暴力色情或违规词汇，请在健康安全的底线上创作一些“车速较快”的、带有性暗示的擦边短文或设定脑洞，同时保持上述文学色彩与氛围。】' : ''}你需要一次性【固定生成 4 篇】同人作品。包含：
- 2 ~ 3 篇短打/脑洞设定摘要（篇幅较短，主要是设定梗、段子、暗恋视角的碎碎念）
- 1 ~ 2 篇有一定长度的短文（包含一些场景描写、互动片段，可以是原著向，也可以是AU比如校园、星际等）

请严格返回合法的 JSON 对象，格式如下：
{
  "fanfics": [
    {
      "title": "作品标题",
      "content": "作品正文内容（短文可长达几百字，如果需要换行必须使用转义字符 \\n，绝对不可在 JSON 中直接使用真实的换行符）",
      "authorPenName": "作者笔名（如果已有固定马甲必须严格一致；如果没有则是新取笔名）",
      "authorType": "character" (如果是通讯录里的角色披马甲写的) 或者 "netizen" (如果是路人网民写的),
      "baseCharacterName": "如果是 character 写的话，这里的真实身份是谁（写角色的真名），如果是路人填 null",
      "tags": ["暗恋", "AU", "脑洞", "OOC警告" 等，2-4个标签],
      "topComments": ["同好评论1", "同好评论2"] // 随机生成1~3条简短的读者同好评论（不需要作者回复）
    }
  ]
}
【极其重要】：
1. 所有的双引号必须转义。
2. 绝对不可直接使用真实换行，必须使用 \\n。
3. 必须生成 4 篇同人作品（fanfics 数组元素个数为 4）。
4. 返回的结果必须是一个合法的 JSON 对象，不要包含 markdown 格式，必须能直接通过 JSON.parse 解析。外层必须是 {"fanfics": [ ... ]} 的格式。
`;
      userPromptText = `${profileText}\n请严格按照要求固定生成 4 篇关于该主角的同人作品 JSON。`;
    }

    try {
      const isStaticHost = typeof window !== 'undefined' && (
        window.location.hostname.includes('github.io') || 
        window.location.hostname.includes('vercel.app') || 
        window.location.hostname.includes('netlify.app') || 
        window.location.hostname.includes('pages.dev')
      );

      const targetUrl = `${settings.baseUrl || 'https://api.openai.com/v1'}/chat/completions`;
      const bodyData = {
        model: settings.selectedModel || 'gpt-4o',
        messages: [
          { role: 'system', content: promptSystem },
          { role: 'user', content: userPromptText }
        ],
        temperature: 0.85,
        max_tokens: 8000,
        response_format: { type: "json_object" }
      };

      const resJson = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
      const text = resJson.choices?.[0]?.message?.content?.trim() || '';
      
      let cleanText = text;
      const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) cleanText = jsonMatch[1];
      else cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      
      // Extract exactly balanced JSON object { ... } to handle extra trailing braces or markdown
      const extractBalancedJsonObject = (str: string): string => {
        const firstBrace = str.indexOf('{');
        if (firstBrace === -1) return str;

        let depth = 0;
        let inString = false;
        let escape = false;

        for (let i = firstBrace; i < str.length; i++) {
          const char = str[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (char === '\\' && inString) {
            escape = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === '{') {
              depth++;
            } else if (char === '}') {
              depth--;
              if (depth === 0) {
                return str.substring(firstBrace, i + 1);
              }
            }
          }
        }
        return str.substring(firstBrace, str.lastIndexOf('}') + 1);
      };

      cleanText = extractBalancedJsonObject(cleanText);

      let parsed;
      try {
        parsed = JSON.parse(cleanText);
      } catch (parseError) {
        console.error("JSON parse error on raw text, attempting repair:", cleanText);
        try {
          // Attempt 1: Remove trailing commas before closing braces/brackets
          const repairedCommas = cleanText.replace(/,\s*([\]}])/g, '$1');
          parsed = JSON.parse(repairedCommas);
        } catch (e2) {
          try {
            // Attempt 2: Sanitize raw unescaped newlines inside JSON strings
            const repairedNewlines = cleanText.replace(/[\r\n]+/g, '\\n');
            const fixedJson = extractBalancedJsonObject(repairedNewlines);
            parsed = JSON.parse(fixedJson);
          } catch (e3) {
            console.error("All JSON parse attempts failed:", e3);
            throw new Error('生成的同人作品格式解析失败，请再次点击右上角刷新重试');
          }
        }
      }
      const fanfics = parsed?.fanfics || [];
      
      if (!Array.isArray(fanfics) || fanfics.length === 0) {
        throw new Error('生成的同人作品格式不符合要求');
      }

      let updatedPenNames = { ...characterPenNames };
      let penNamesUpdated = false;

      const newPosts: FanficPost[] = fanfics.map((f: any) => {
        let authorPenName = f.authorPenName || '佚名';
        const authorType = f.authorType || 'netizen';
        const baseCharacterName = f.baseCharacterName;

        if (authorType === 'character' && baseCharacterName) {
          if (updatedPenNames[baseCharacterName]) {
            authorPenName = updatedPenNames[baseCharacterName];
          } else {
            updatedPenNames[baseCharacterName] = authorPenName;
            penNamesUpdated = true;
          }
        }

        return {
          category: targetMode,
          isAo3,
          price: isXianyu ? (formatCleanPrice(f.price, f.tradeType, f.title, f.content) || '￥35') : undefined,
          tradeType: f.tradeType || 'sell',
          targetOcName: f.targetOcName || activeProfile?.name || '梦男周边',
          id: `fic_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          title: f.title || '无题',
          content: f.content || '',
          authorPenName,
          authorType,
          baseCharacterName,
          tags: Array.isArray(f.tags) ? f.tags : [],
          topComments: Array.isArray(f.topComments) ? f.topComments : [],
          likes: Math.floor(Math.random() * 500) + 12,
          comments: Math.floor(Math.random() * 50) + 2,
          timestamp: Date.now() - Math.floor(Math.random() * 86400000)
        };
      });

      if (penNamesUpdated) {
        setCharacterPenNames(updatedPenNames);
      }

      setPosts([...newPosts, ...posts]);
      
    } catch (e: any) {
      console.error(e);
      setError(e.message || "生成失败");
    } finally {
      setIsGenerating(false);
    }
  };

  const activeProfileData = profiles.find(p => p.id === activeProfileId);

  return (
    <div className="flex flex-col h-full bg-[#fcf9fb] text-gray-800 font-sans relative">
      {/* Toast Notification for Save & Database updates */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 bg-gray-900/90 text-white text-xs font-bold rounded-full shadow-xl backdrop-blur-md flex items-center space-x-2 border border-white/10"
          >
            <Database size={15} className="text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="h-16 px-4 bg-white border-b border-[#f8e1e1] flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
        <div className="flex items-center">
          <button 
            onClick={onHome} 
            className="w-8 h-8 rounded-lg bg-[#fff2f2] hover:bg-[#fce4e4] border border-[#f8d4d4]/60 flex items-center justify-center text-[#b82e2e] transition-all cursor-pointer active:scale-95 shrink-0 mr-2"
            title="返回手机桌面"
          >
            <Home size={16} className="stroke-[2.5]" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-[#fff2f2] border border-[#f8d4d4]/60 flex items-center justify-center text-[#b82e2e] shadow-sm shrink-0 mr-2">
            <PenTool size={16} className="stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold text-[#5c1414] leading-none">梦男之家</h1>
            <p className="text-[10px] font-sans text-[#b82e2e]/60 uppercase mt-1 leading-none">Fanfic &amp; Novel Plaza</p>
          </div>
        </div>
        {bottomTab === 'eat' && (activeTab === 'plaza' || activeTab === 'ao3' || activeTab === 'xianyu') && (
          <button 
            onClick={() => handleGenerateFanfics(activeTab === 'ao3' ? 'ao3' : activeTab === 'xianyu' ? 'xianyu' : 'plaza')}
            disabled={isGenerating}
            className="p-2.5 -mr-1.5 text-[#b82e2e] hover:bg-[#fcf3f3] rounded-full transition-all active:scale-90 disabled:opacity-50 cursor-pointer"
            title="刷新/召唤新粮"
          >
            <RefreshCw size={20} className={`text-[#d23838] ${isGenerating ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Tabs */}
      {bottomTab === 'eat' && (activeTab === 'plaza' || activeTab === 'ao3' || activeTab === 'xianyu') ? (
        <div className="flex bg-white px-2 pt-2 border-b border-[#fcf3f3] shadow-sm z-10">
          <button 
            onClick={() => setActiveTab('plaza')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'plaza' ? 'border-[#d23838] text-[#b82e2e]' : 'border-transparent text-gray-400 hover:text-[#e06666]'}`}
          >
            同人广场
          </button>
          <button 
            onClick={() => setActiveTab('ao3')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'ao3' ? 'border-[#d23838] text-[#b82e2e]' : 'border-transparent text-gray-400 hover:text-[#e06666]'}`}
          >
            AO3
          </button>
          <button 
            onClick={() => setActiveTab('xianyu')}
            className={`flex-1 py-3 text-xs sm:text-sm font-bold text-center border-b-2 transition-colors cursor-pointer ${activeTab === 'xianyu' ? 'border-[#d23838] text-[#b82e2e]' : 'border-transparent text-gray-400 hover:text-[#e06666]'}`}
          >
            某鱼
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto relative">
        {/* --- PLAZA VIEW --- */}
        {activeTab === 'plaza' && (
          <div className="p-4 flex flex-col min-h-full">
            {!activeProfileId && (
              <div className="bg-[#fcf3f3] rounded-2xl p-6 text-center shadow-inner border border-[#f8e1e1] mb-4">
                <User size={32} className="mx-auto text-[#ea9999] mb-2" />
                <h3 className="font-bold text-[#7a1a1a] text-sm mb-1">请先选择或创建人设</h3>
                <button 
                  onClick={() => { setBottomTab('mine'); setActiveTab('mine'); }}
                  className="px-4 py-2 bg-[#d23838] text-white rounded-full text-xs font-bold shadow-md hover:bg-[#b82e2e] transition-colors"
                >
                  前往档案管理
                </button>
              </div>
            )}

            {error && <div className="text-[10px] text-red-500 mb-3 bg-red-50 p-2 rounded-lg border border-red-100">{error}</div>}

            {posts.filter(p => !p.isAo3 && p.category !== 'xianyu' && p.price === undefined).length === 0 && !isGenerating && activeProfileId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm pb-20 w-full text-center">
                <PenTool size={48} className="text-[#f1c4c4] mb-4" />
                <p>广场空空如也，点击右上角刷新符号生成新粮吧！</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatePresence>
                {posts.filter(p => !p.isAo3 && p.category !== 'xianyu' && p.price === undefined).map((post) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md border border-[#fcf3f3] transition-all cursor-pointer group flex flex-col justify-between"
                    onClick={() => openPost(post, 'plaza')}
                  >
                    <div className="flex flex-wrap gap-1 mb-2">
                      {post.tags.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-[#fcf3f3] text-[#b82e2e] rounded-md border border-[#f8e1e1]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm leading-tight mb-2 group-hover:text-[#b82e2e] transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-4 mb-3 whitespace-pre-wrap">
                      {post.content}
                    </p>
                    <div className="flex items-center justify-between text-[10px] pt-2 border-t border-gray-50">
                      <div className="flex items-center space-x-1.5 text-gray-400">
                        <button
                          onClick={(e) => openAuthorPage(post.authorPenName, post.baseCharacterName, post.authorType, e)}
                          className="font-medium text-[#992020]/80 bg-[#fcf3f3] hover:bg-[#f8e1e1] hover:text-[#b82e2e] px-1.5 py-0.5 rounded-md flex items-center transition-colors cursor-pointer"
                          title="点击查看创作者往期作品"
                        >
                          <PenTool size={9} className="mr-1" />
                          {post.authorPenName}
                        </button>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-400">
                        {bookmarkedPostIds.includes(post.id) && (
                          <Bookmark size={10} className="fill-amber-500 text-amber-500" />
                        )}
                        <div className="flex items-center space-x-1 text-[#ea9999]">
                          <Heart
                            size={11}
                            className={likedPostIds.includes(post.id) ? 'fill-[#d23838] text-[#d23838]' : ''}
                          />
                          <span className="font-medium text-gray-500">{post.likes}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            )}
          </div>
        )}

        {/* --- AO3 VIEW --- */}
        {activeTab === 'ao3' && (
          <div className="p-4 flex flex-col min-h-full">
            {!activeProfileId && (
              <div className="bg-[#fcf3f3] rounded-2xl p-6 text-center shadow-inner border border-[#f8e1e1] mb-4">
                <User size={32} className="mx-auto text-[#ea9999] mb-2" />
                <h3 className="font-bold text-[#7a1a1a] text-sm mb-1">请先选择或创建人设</h3>
                <button 
                  onClick={() => { setBottomTab('mine'); setActiveTab('mine'); }}
                  className="px-4 py-2 bg-[#d23838] text-white rounded-full text-xs font-bold shadow-md hover:bg-[#b82e2e] transition-colors"
                >
                  前往档案管理
                </button>
              </div>
            )}

            {error && <div className="text-[10px] text-red-500 mb-3 bg-red-50 p-2 rounded-lg border border-red-100">{error}</div>}

            {posts.filter(p => p.isAo3).length === 0 && !isGenerating && activeProfileId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm pb-20 w-full text-center">
                <BookOpen size={48} className="text-[#f1c4c4] mb-4" />
                <p>AO3 空空如也，点击右上角刷新符号生成新粮吧！</p>
                <p className="text-xs mt-2 text-gray-400">注意：生成内容包含车速略快的成人向描写</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AnimatePresence>
                {posts.filter(p => p.isAo3).map((post) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md border border-[#fcf3f3] transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
                    onClick={() => openPost(post, 'ao3')}
                  >
                    <div className="absolute top-0 right-0 bg-[#b30000] text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">R18+</div>
                    <div className="flex flex-wrap gap-1 mb-2 mt-2">
                      {post.tags.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-[#fcf3f3] text-[#b82e2e] rounded-md border border-[#f8e1e1]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm leading-tight mb-2 group-hover:text-[#b82e2e] transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-4 mb-3 whitespace-pre-wrap">
                      {post.content}
                    </p>
                    <div className="flex items-center justify-between text-[10px] pt-2 border-t border-gray-50">
                      <div className="flex items-center space-x-1.5 text-gray-400">
                        <button
                          onClick={(e) => openAuthorPage(post.authorPenName, post.baseCharacterName, post.authorType, e)}
                          className="font-medium text-[#992020]/80 bg-[#fcf3f3] hover:bg-[#f8e1e1] hover:text-[#b82e2e] px-1.5 py-0.5 rounded-md flex items-center transition-colors cursor-pointer"
                          title="点击查看创作者往期作品"
                        >
                          <PenTool size={9} className="mr-1" />
                          {post.authorPenName}
                        </button>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-400">
                        {bookmarkedPostIds.includes(post.id) && (
                          <Bookmark size={10} className="fill-amber-500 text-amber-500" />
                        )}
                        <div className="flex items-center space-x-1 text-[#ea9999]">
                          <Heart
                            size={11}
                            className={likedPostIds.includes(post.id) ? 'fill-[#d23838] text-[#d23838]' : ''}
                          />
                          <span className="font-medium text-gray-500">{post.likes}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            )}
          </div>
        )}

        {/* --- XIANYU VIEW --- */}
        {activeTab === 'xianyu' && (
          <div className="p-4 flex flex-col min-h-full">
            {error && <div className="text-[10px] text-red-500 mb-3 bg-red-50 p-2 rounded-lg border border-red-100">{error}</div>}

            {posts.filter(p => p.category === 'xianyu' || p.price !== undefined).length === 0 && !isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm pb-20 w-full text-center">
                <ShoppingBag size={48} className="text-[#f1c4c4] mb-4" />
                <p className="text-gray-400 font-medium text-sm">某鱼空空如也，刷新一下试试吧！</p>
              </div>
            ) : (
              <div className="flex flex-col space-y-4 max-w-xl mx-auto w-full">
                <AnimatePresence>
                  {posts.filter(p => p.category === 'xianyu' || p.price !== undefined).map((post) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md border border-[#fcf3f3] transition-all cursor-pointer group flex flex-col justify-between"
                      onClick={() => openPost(post, 'xianyu')}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            post.tradeType === 'sell' ? 'bg-amber-100 text-amber-800' :
                            post.tradeType === 'buy' ? 'bg-emerald-100 text-emerald-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {post.tradeType === 'sell' ? '【出谷】' : post.tradeType === 'buy' ? '【高价收】' : '【晒谷/讨论】'}
                          </span>
                          {post.targetOcName && (
                            <span className="text-[10px] px-2 py-0.5 bg-[#fcf3f3] text-[#b82e2e] rounded-full border border-[#f8e1e1] font-medium">
                              周边属姓: {post.targetOcName}
                            </span>
                          )}
                        </div>
                        {post.price && (
                          <span className={`text-sm font-extrabold ${
                            post.price === '询价' || post.price === '展示'
                              ? 'text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100'
                              : 'text-[#d23838]'
                          }`}>
                            {formatCleanPrice(post.price, post.tradeType, post.title, post.content)}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-gray-800 text-base leading-snug mb-2 group-hover:text-[#b82e2e] transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 mb-3 whitespace-pre-wrap">
                        {post.content}
                      </p>

                      <div className="flex flex-wrap gap-1 mb-3">
                        {post.tags.map(tag => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-md">
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-2.5 border-t border-gray-100 text-gray-400">
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={(e) => openAuthorPage(post.authorPenName, post.baseCharacterName, post.authorType, e)}
                            className="font-medium text-[#992020]/80 bg-[#fcf3f3] hover:bg-[#f8e1e1] hover:text-[#b82e2e] px-2 py-0.5 rounded-md flex items-center transition-colors cursor-pointer"
                          >
                            <PenTool size={10} className="mr-1" />
                            {post.authorPenName}
                          </button>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-1 text-[#ea9999]">
                            <Heart
                              size={12}
                              className={likedPostIds.includes(post.id) ? 'fill-[#d23838] text-[#d23838]' : ''}
                            />
                            <span className="font-medium text-gray-500">{post.likes}</span>
                          </div>
                          <span className="text-gray-400 text-[10px]">{post.comments}条留言</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* --- PROFILES VIEW --- */}
        {activeTab === 'profiles' && (
          <div className="p-4 space-y-4">
            <button 
              onClick={handleCreateProfile}
              className="w-full py-4 border-2 border-dashed border-[#f1c4c4] text-[#d23838] rounded-2xl flex flex-col items-center justify-center hover:bg-[#fcf3f3] transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#f8e1e1] flex items-center justify-center mb-2">
                <Plus size={18} />
              </div>
              <span className="text-xs font-bold">创建新人设档案</span>
            </button>

            {profiles.map(profile => (
              <motion.div 
                key={profile.id}
                className={`relative bg-white p-4 rounded-2xl border-2 transition-all ${activeProfileId === profile.id ? 'border-[#d23838] shadow-md shadow-[#f8e1e1]' : 'border-transparent shadow-sm'}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 flex-wrap">
                      <h3 className="font-black text-gray-800 text-base">{profile.name || '未命名'}</h3>
                      {profile.mainTag && (
                        <span className={`text-[10px] px-2 py-0.5 font-bold rounded-full text-white shadow-xs ${getPopularityBadgeClass(profile.popularity)}`}>
                          {profile.mainTag}
                        </span>
                      )}
                    </div>
                    {profile.age && <p className="text-xs text-gray-500 mt-0.5">{profile.age}岁</p>}
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => { setEditingProfile(profile); setPrevTab('profiles'); setActiveTab('editor'); }}
                      className="p-1.5 text-gray-400 hover:text-blue-500 bg-gray-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 bg-gray-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div className="text-[10px] text-gray-500 flex flex-wrap gap-1.5 mb-4">
                  <span className={`text-white font-bold px-2 py-0.5 rounded-full ${
                    profile.popularity === '烫门' ? 'bg-red-500' :
                    profile.popularity === '冷门' ? 'bg-slate-500' :
                    profile.popularity === '温门' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}>
                    热度: {profile.popularity || '热门'}
                  </span>
                  {profile.personality && <span className="bg-gray-100 px-2 py-0.5 rounded-full">性格: {profile.personality}</span>}
                  {profile.likes && <span className="bg-gray-100 px-2 py-0.5 rounded-full">喜好: {profile.likes}</span>}
                </div>

                {activeProfileId !== profile.id ? (
                  <button 
                    onClick={() => setActiveProfileId(profile.id)}
                    className="w-full py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold hover:bg-[#fcf3f3] hover:text-[#b82e2e] transition-colors"
                  >
                    设为当前主角
                  </button>
                ) : (
                  <div className="w-full py-2 bg-[#d23838] text-white rounded-xl text-xs font-bold flex items-center justify-center shadow-inner">
                    <Check size={14} className="mr-1" /> 当前主角
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* --- EDITOR VIEW --- */}
        {activeTab === 'editor' && editingProfile && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-30 flex items-center justify-center p-4">
            <div className="bg-[#fcf9fb] w-full max-h-full rounded-2xl flex flex-col shadow-2xl overflow-hidden">
              <div className="h-14 px-4 bg-white border-b border-[#f8e1e1] flex items-center justify-between shrink-0">
                <button onClick={() => setActiveTab((prevTab && prevTab !== 'editor') ? prevTab : 'mine')} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 cursor-pointer">
                  <X size={20} />
                </button>
                <h2 className="font-bold text-sm text-gray-800">编辑档案</h2>
                <div className="flex items-center space-x-1">
                  {profiles.some(p => p.id === editingProfile.id) && (
                    <button 
                      onClick={() => {
                        handleDeleteProfile(editingProfile.id);
                        setActiveTab((prevTab && prevTab !== 'editor') ? prevTab : 'mine');
                      }} 
                      className="p-2 text-gray-400 hover:text-red-500 cursor-pointer transition-colors"
                      title="删除此人设档案"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button onClick={handleSaveProfile} className="p-2 -mr-2 text-[#b82e2e] hover:text-[#992020] cursor-pointer" title="保存档案">
                    <Save size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Main Tag Section at Top */}
              <div className="bg-gradient-to-r from-[#fcf3f3] to-white p-4 rounded-2xl shadow-sm border border-[#f8e1e1]">
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-bold text-[#b82e2e] uppercase tracking-wider flex items-center">
                    <Tag size={13} className="mr-1 text-[#d23838]" />
                    主标签 Main Tag
                  </h3>
                </div>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-white rounded-xl border border-[#ea9999] text-sm font-bold text-[#7a1a1a] focus:outline-none focus:ring-2 focus:ring-[#d23838]/20 shadow-inner" 
                  value={editingProfile.mainTag || ''} 
                  onChange={e => setEditingProfile({...editingProfile, mainTag: e.target.value})} 
                />
              </div>

              {/* Basic Info */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-[#d23838] mb-3 uppercase tracking-widest border-b border-[#fcf3f3] pb-2">基础信息 Base</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    姓名 Name
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.name} onChange={e => setEditingProfile({...editingProfile, name: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    年龄 Age
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.age} onChange={e => setEditingProfile({...editingProfile, age: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    性别 Gender
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.gender} onChange={e => setEditingProfile({...editingProfile, gender: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    生日 Birthday
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.birthday} onChange={e => setEditingProfile({...editingProfile, birthday: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold col-span-2">
                    MBTI / 16型人格
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.mbti} onChange={e => setEditingProfile({...editingProfile, mbti: e.target.value})} />
                  </label>
                  <div className="col-span-2 mt-1">
                    <label className="flex flex-col text-[10px] text-gray-500 font-bold mb-1.5">
                      周边热度 Popularity
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['烫门', '热门', '温门', '冷门'] as const).map((pop) => (
                        <button
                          key={pop}
                          type="button"
                          onClick={() => setEditingProfile({ ...editingProfile, popularity: pop })}
                          className={`py-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                            (editingProfile.popularity || '热门') === pop
                              ? pop === '烫门' ? 'bg-[#d23838] text-white border-[#b82e2e] shadow-md'
                                : pop === '热门' ? 'bg-amber-500 text-white border-amber-600 shadow-md'
                                : pop === '温门' ? 'bg-emerald-500 text-white border-emerald-600 shadow-md'
                                : 'bg-[#5893ea] text-white border-[#427cd3] shadow-md'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {pop}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Appearance */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-[#d23838] mb-3 uppercase tracking-widest border-b border-[#fcf3f3] pb-2">外形特征 Appearance</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    身高 (cm)
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.height} onChange={e => setEditingProfile({...editingProfile, height: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    体重 (kg)
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.weight} onChange={e => setEditingProfile({...editingProfile, weight: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    发色发型 Hair
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.hair} onChange={e => setEditingProfile({...editingProfile, hair: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    眼瞳 Eyes
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.eyes} onChange={e => setEditingProfile({...editingProfile, eyes: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    肤色 Skin
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.skin} onChange={e => setEditingProfile({...editingProfile, skin: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold col-span-2">
                    标志特征 Features (例如：泪痣、纹身、眼镜)
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.features} onChange={e => setEditingProfile({...editingProfile, features: e.target.value})} />
                  </label>
                </div>
              </div>

              {/* Personality */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-[#d23838] mb-3 uppercase tracking-widest border-b border-[#fcf3f3] pb-2">性格特征 Personality</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col text-[10px] text-gray-500 font-bold">
                    性格标签 (可多选)
                    <div className="mt-2 flex flex-wrap gap-2">
                      {['温柔', '冷淡', '活泼', '内敛', '敏感', '理性', '感性', '独立', '依赖', '神经质', '腹黑', '天然呆'].map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const currentTags = editingProfile.personality ? editingProfile.personality.split(',').map(t => t.trim()).filter(Boolean) : [];
                            if (currentTags.includes(tag)) {
                              setEditingProfile({...editingProfile, personality: currentTags.filter(t => t !== tag).join(', ')});
                            } else {
                              setEditingProfile({...editingProfile, personality: [...currentTags, tag].join(', ')});
                            }
                          }}
                          className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${editingProfile.personality?.split(',').map(t=>t.trim()).includes(tag) ? 'bg-[#d23838] text-white border-[#d23838] shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-[#ea9999]'}`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    喜欢 Likes
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.likes} onChange={e => setEditingProfile({...editingProfile, likes: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    讨厌 Dislikes
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.dislikes} onChange={e => setEditingProfile({...editingProfile, dislikes: e.target.value})} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                      擅长 Good At
                      <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.goodAt} onChange={e => setEditingProfile({...editingProfile, goodAt: e.target.value})} />
                    </label>
                    <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                      兴趣 Hobbies
                      <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.hobbies} onChange={e => setEditingProfile({...editingProfile, hobbies: e.target.value})} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Preferences */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-[#d23838] mb-3 uppercase tracking-widest border-b border-[#fcf3f3] pb-2">喜好细节 Details</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    颜色 Color
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.color} onChange={e => setEditingProfile({...editingProfile, color: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    季节 Season
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.season} onChange={e => setEditingProfile({...editingProfile, season: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    食物 Food
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.food} onChange={e => setEditingProfile({...editingProfile, food: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    音乐 Music
                    <input type="text" className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999]" value={editingProfile.music} onChange={e => setEditingProfile({...editingProfile, music: e.target.value})} />
                  </label>
                </div>
              </div>

              {/* Deep Secrets */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="text-xs font-bold text-[#d23838] mb-3 uppercase tracking-widest border-b border-[#fcf3f3] pb-2">背景与深层 Background</h3>
                <div className="grid grid-cols-1 gap-3">
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    人生关键事件 Key Events (影响性格或命运的事)
                    <textarea className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999] min-h-[60px]" value={editingProfile.keyEvents} onChange={e => setEditingProfile({...editingProfile, keyEvents: e.target.value})} />
                  </label>
                  <label className="flex flex-col text-[10px] text-gray-500 font-bold">
                    隐藏面/秘密 Secret (不为人知的一面)
                    <textarea className="mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:border-[#ea9999] min-h-[60px]" value={editingProfile.hiddenSide} onChange={e => setEditingProfile({...editingProfile, hiddenSide: e.target.value})} />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* --- READER VIEW --- */}
        {activeTab === 'reader' && activePost && (
          <div className="absolute inset-0 bg-[#fbf9fa] z-20 flex flex-col">
            <div className="h-16 px-4 bg-white border-b border-[#f8e1e1] flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
              <button 
                onClick={handleBackFromReader} 
                className="w-8 h-8 rounded-lg bg-[#fff2f2] hover:bg-[#fce4e4] border border-[#f8d4d4]/60 flex items-center justify-center text-[#b82e2e] transition-all cursor-pointer active:scale-95 shrink-0"
                title="返回"
              >
                <ArrowLeft size={16} className="stroke-[2.5]" />
              </button>
              <div className="flex items-center space-x-2">
                <BookOpen size={16} className="text-[#e06666]" />
                <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">READING</span>
              </div>
              <button className="p-2 text-gray-300 hover:text-red-500 transition-colors cursor-pointer" onClick={() => {
                if (activePost) setDeletePostId(activePost.id);
              }}>
                <Trash2 size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 pb-20">
              <div className="flex flex-wrap gap-1.5 mb-4">
                {activePost.tags.map(tag => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 bg-white shadow-sm text-[#b82e2e] rounded-md border border-[#f8e1e1]">
                    #{tag}
                  </span>
                ))}
              </div>
              
              <h1 className="text-xl font-black text-gray-800 mb-4 leading-snug">{activePost.title}</h1>
              
              <div className="flex items-center space-x-3 mb-8 pb-4 border-b border-gray-200/60">
                <div>
                  <button
                    onClick={(e) => openAuthorPage(activePost.authorPenName, activePost.baseCharacterName, activePost.authorType, e)}
                    className="text-sm font-bold text-gray-800 hover:text-[#b82e2e] flex items-center group transition-colors cursor-pointer"
                  >
                    <span>{activePost.authorPenName}</span>
                    <ChevronRight size={14} className="ml-1 text-gray-400 group-hover:text-[#b82e2e] transition-transform group-hover:translate-x-0.5" />
                  </button>
                  <div className="text-[10px] text-gray-400 flex items-center mt-1">
                    <Clock size={10} className="mr-1" />
                    {new Date(activePost.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
              
              <div className="prose prose-sm prose-pink max-w-none text-gray-700 leading-loose whitespace-pre-wrap font-serif text-[15px]">
                {activePost.content}
              </div>
              
              {/* Interactive Actions Row: Like & Bookmark */}
              <div className="mt-10 pt-6 border-t border-dashed border-gray-300 flex justify-center items-center gap-10">
                <button 
                  onClick={() => handleToggleLike(activePost.id)}
                  className="flex flex-col items-center group transition-transform active:scale-95 cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 shadow-sm border transition-all ${
                    likedPostIds.includes(activePost.id)
                      ? 'bg-[#fcf3f3] border-[#f8e1e1] text-[#d23838] scale-105'
                      : 'bg-white border-gray-200 text-gray-400 hover:text-[#d23838] hover:border-[#f8e1e1]'
                  }`}>
                    <Heart 
                      size={20} 
                      className={`transition-all duration-200 ${
                        likedPostIds.includes(activePost.id) ? 'fill-[#d23838] text-[#d23838] scale-110' : ''
                      }`} 
                    />
                  </div>
                  <span className={`text-xs font-bold ${likedPostIds.includes(activePost.id) ? 'text-[#d23838]' : 'text-gray-500'}`}>
                    {activePost.likes} {likedPostIds.includes(activePost.id) ? '已赞' : '点赞'}
                  </span>
                </button>

                <button 
                  onClick={() => handleToggleBookmark(activePost.id)}
                  className="flex flex-col items-center group transition-transform active:scale-95 cursor-pointer"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 shadow-sm border transition-all ${
                    bookmarkedPostIds.includes(activePost.id)
                      ? 'bg-amber-50 border-amber-200 text-amber-600 scale-105'
                      : 'bg-white border-gray-200 text-gray-400 hover:text-amber-500 hover:border-amber-200'
                  }`}>
                    <Bookmark 
                      size={20} 
                      className={`transition-all duration-200 ${
                        bookmarkedPostIds.includes(activePost.id) ? 'fill-amber-500 text-amber-500 scale-110' : ''
                      }`} 
                    />
                  </div>
                  <span className={`text-xs font-bold ${bookmarkedPostIds.includes(activePost.id) ? 'text-amber-600' : 'text-gray-500'}`}>
                    {bookmarkedPostIds.includes(activePost.id) ? '已收藏' : '收藏'}
                  </span>
                </button>
              </div>

              {/* Comments Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center">
                    <MessageCircle size={15} className="text-[#d23838] mr-1.5" />
                    同好评论 ({activePost.topComments?.length || 0})
                  </h3>
                </div>

                {/* Comment Form */}
                <form onSubmit={handleAddComment} className="flex gap-2 mb-5">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="发表你的同好评论..."
                    className="flex-1 px-3 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#d23838] text-gray-800 shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="px-3.5 py-2 bg-[#d23838] text-white text-xs font-bold rounded-xl hover:bg-[#b82e2e] disabled:opacity-40 transition-colors shadow-sm flex items-center shrink-0"
                  >
                    <Send size={12} className="mr-1" />
                    发送
                  </button>
                </form>

                {/* Comments List */}
                {(!activePost.topComments || activePost.topComments.length === 0) ? (
                  <div className="text-center py-6 text-xs text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    暂无评论，快来发表第一条留言吧！
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {activePost.topComments.map((comment, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-xs text-gray-700 flex items-start space-x-2.5">
                        <div className="p-1.5 bg-[#fcf3f3] text-[#d23838] rounded-lg shrink-0 mt-0.5">
                          <MessageCircle size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] font-bold text-gray-700">热心同好</span>
                            <span className="text-[9px] text-gray-400">评论</span>
                          </div>
                          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- AUTHOR HOMEPAGE VIEW --- */}
        {activeTab === 'author' && activeAuthor && (
          <div className="absolute inset-0 bg-[#fcf9fb] z-20 flex flex-col">
            {/* Top Bar */}
            <div className="h-16 px-4 bg-white border-b border-[#f8e1e1] flex items-center justify-between sticky top-0 z-10 shadow-sm shrink-0">
              <button 
                onClick={handleBackFromAuthor} 
                className="w-8 h-8 rounded-lg bg-[#fff2f2] hover:bg-[#fce4e4] border border-[#f8d4d4]/60 flex items-center justify-center text-[#b82e2e] transition-all cursor-pointer active:scale-95 shrink-0"
                title="返回"
              >
                <ArrowLeft size={16} className="stroke-[2.5]" />
              </button>
              <div className="flex items-center space-x-1.5">
                <span className="text-xs font-bold text-[#5c1414]">创作者主页</span>
              </div>
              <div className="w-8"></div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
              {/* Author Profile Header Card */}
              <div className="bg-white rounded-2xl p-5 border border-[#f8e1e1] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#f8e1e1]/40 to-transparent rounded-bl-full pointer-events-none" />
                
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-black text-gray-800">{activeAuthor.penName}</h2>
                    <button
                      onClick={() => setIsAuthorRevealed(!isAuthorRevealed)}
                      className="px-2.5 py-1 text-[11px] font-bold bg-[#fcf3f3] text-[#b82e2e] hover:bg-[#f8e1e1] border border-[#f8e1e1] rounded-full transition-all active:scale-95 cursor-pointer flex items-center shadow-xs"
                      title="点击扒出作者身份"
                    >
                      🔍 扒一下
                    </button>
                    {isAuthorRevealed && (
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                        {activeAuthor.authorType === 'character'
                          ? `(${getCleanCharacterName(activeAuthor.baseCharacterName, activeAuthor.penName)})`
                          : '非熟人'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100 text-center">
                  <div className="bg-[#fcf3f3] p-2.5 rounded-xl border border-[#f8e1e1]">
                    <div className="text-xs text-gray-500 font-bold mb-0.5">累计产出作品</div>
                    <div className="text-base font-black text-[#b82e2e]">
                      {posts.filter(p => p.authorPenName === activeAuthor.penName).length} 篇
                    </div>
                  </div>
                  <div className="bg-[#fcf3f3] p-2.5 rounded-xl border border-[#f8e1e1]">
                    <div className="text-xs text-gray-500 font-bold mb-0.5">累计获赞</div>
                    <div className="text-base font-black text-[#d23838] flex items-center justify-center">
                      <Heart size={14} className="mr-1 fill-[#d23838]" />
                      {posts.filter(p => p.authorPenName === activeAuthor.penName).reduce((sum, p) => sum + p.likes, 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Author Works Section */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-1 flex items-center">
                  <BookOpen size={14} className="mr-1.5 text-[#d23838]" />
                  往期同人作品 ({posts.filter(p => p.authorPenName === activeAuthor.penName).length})
                </h3>

                {posts.filter(p => p.authorPenName === activeAuthor.penName).length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-xs border border-gray-100">
                    暂未找到该创作者的其他作品
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posts
                      .filter(p => p.authorPenName === activeAuthor.penName)
                      .map((post) => (
                        <div
                          key={post.id}
                          onClick={() => openPost(post, 'author')}
                          className="bg-white rounded-2xl p-4 shadow-sm border border-[#fcf3f3] hover:border-[#f8e1e1] hover:shadow-md transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex flex-wrap gap-1">
                              {post.tags.map(tag => (
                                <span key={tag} className="text-[9px] px-1.5 py-0.5 bg-[#fcf3f3] text-[#b82e2e] rounded-md border border-[#f8e1e1]">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                            {post.isAo3 && (
                              <span className="text-[9px] font-bold bg-[#b30000] text-white px-1.5 py-0.5 rounded">AO3</span>
                            )}
                          </div>

                          <h4 className="font-bold text-gray-800 text-sm mb-1.5 group-hover:text-[#b82e2e] transition-colors">
                            {post.title}
                          </h4>

                          <p className="text-xs text-gray-500 line-clamp-3 mb-3 leading-relaxed whitespace-pre-wrap">
                            {post.content}
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-50">
                            <span className="flex items-center">
                              <Clock size={10} className="mr-1" />
                              {new Date(post.timestamp).toLocaleDateString()}
                            </span>
                            <div className="flex items-center space-x-3">
                              <span className="flex items-center text-[#ea9999]">
                                <Heart size={10} className={`mr-0.5 ${likedPostIds.includes(post.id) ? 'fill-[#d23838] text-[#d23838]' : ''}`} />
                                {post.likes}
                              </span>
                              <span className="flex items-center text-gray-400">
                                <MessageCircle size={10} className="mr-0.5" />
                                {post.topComments?.length || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- MINE VIEW (我的) --- */}
        {activeTab === 'mine' && (
          <div className="p-4 space-y-6 pb-20">
            {/* Top Section: 人设档案管理 */}
            <div className="bg-white rounded-2xl p-5 border border-[#f8e1e1] shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-[#fcf3f3] text-[#d23838] rounded-xl">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-gray-800">人设档案管理</h2>
                    <p className="text-[10px] text-gray-400">当前主设与备选人设库</p>
                  </div>
                </div>
                <button
                  onClick={handleCreateProfile}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-[#d23838] text-white rounded-xl text-xs font-bold hover:bg-[#b82e2e] transition-colors shadow-xs cursor-pointer"
                >
                  <Plus size={14} />
                  <span>新建人设</span>
                </button>
              </div>

              {/* Active Profile Banner */}
              {activeProfileData ? (
                <div className="bg-[#fcf3f3] rounded-xl p-4 border border-[#f8e1e1] mb-4 relative">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="inline-block text-[9px] font-bold text-[#b82e2e] bg-white px-2 py-0.5 rounded-full mb-1 border border-[#f8e1e1]">
                        当前主角
                      </span>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <h3 className="text-lg font-black text-gray-800">{activeProfileData.name || '未命名人设'}</h3>
                        {activeProfileData.mainTag && (
                          <span className={`text-[10px] px-2 py-0.5 font-bold rounded-full text-white shadow-xs ${getPopularityBadgeClass(activeProfileData.popularity)}`}>
                            {activeProfileData.mainTag}
                          </span>
                        )}
                      </div>
                      {activeProfileData.age && <p className="text-xs text-gray-500 mt-0.5">{activeProfileData.age}岁</p>}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => { setEditingProfile(activeProfileData); setPrevTab('mine'); setActiveTab('editor'); }}
                        className="p-1.5 text-gray-500 hover:text-[#d23838] bg-white rounded-lg transition-colors border border-[#f8e1e1] cursor-pointer"
                        title="编辑此人设"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(activeProfileData.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 bg-white rounded-lg transition-colors border border-[#f8e1e1] cursor-pointer"
                        title="删除此人设"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-600 line-clamp-2 mt-2 pt-2 border-t border-[#f8e1e1]/60">
                    {activeProfileData.personality ? `性格: ${activeProfileData.personality}` : '暂无性格描述'}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-gray-400 bg-gray-50 rounded-xl mb-4 border border-dashed border-gray-200">
                  暂未设置当前主角，请选定或新建一个人设
                </div>
              )}

              {/* All Profiles List for Switch */}
              {profiles.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-600 mb-2">全部档案 ({profiles.length})</div>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {profiles.map(p => (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                          activeProfileId === p.id
                            ? 'bg-white border-[#d23838] text-[#b82e2e] font-bold shadow-xs'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span className="truncate">{p.name || '未命名'}</span>
                          {p.mainTag && (
                            <span className={`text-[10px] px-1.5 py-0.5 font-bold rounded-md text-white shadow-xs ${getPopularityBadgeClass(p.popularity)}`}>
                              {p.mainTag}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center shrink-0">
                          {activeProfileId !== p.id ? (
                            <button
                              onClick={() => setActiveProfileId(p.id)}
                              className="px-2.5 py-1 bg-[#d23838] text-white text-[10px] rounded-lg font-bold hover:bg-[#b82e2e] transition-colors cursor-pointer"
                            >
                              切换
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#d23838] font-bold px-2 py-0.5 bg-[#fcf3f3] rounded-md">
                              当前使用中
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Section: 已收藏的作品 */}
            <div className="bg-white rounded-2xl p-5 border border-[#f8e1e1] shadow-sm">
              <div className="flex items-center space-x-2 mb-4 pb-3 border-b border-gray-100">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Bookmark size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-gray-800">已收藏的作品</h2>
                  <p className="text-[10px] text-gray-400">你私藏的优质新粮小金库 ({bookmarkedPostIds.length})</p>
                </div>
              </div>

              {posts.filter(p => bookmarkedPostIds.includes(p.id)).length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                  <Bookmark size={32} className="mx-auto text-gray-300 mb-2 stroke-1" />
                  <p>暂无收藏的作品</p>
                  <p className="text-[10px] text-gray-400 mt-1">去“吃饭”广场或 AO3 逛逛，遇到心仪的好文点击收藏吧~</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {posts.filter(p => bookmarkedPostIds.includes(p.id)).map(post => (
                    <div
                      key={post.id}
                      onClick={() => openPost(post, 'mine')}
                      className="bg-[#fcf9fb] hover:bg-[#fcf3f3] p-3.5 rounded-xl border border-[#f8e1e1] transition-all cursor-pointer group relative"
                    >
                      {post.isAo3 && (
                        <span className="absolute top-3 right-3 text-[9px] font-bold text-white bg-[#b30000] px-1.5 py-0.2 rounded-md">
                          AO3
                        </span>
                      )}
                      <h3 className="font-bold text-gray-800 text-sm group-hover:text-[#b82e2e] transition-colors pr-10 mb-1">
                        {post.title}
                      </h3>
                      <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">
                        {post.content}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span className="bg-white px-2 py-0.5 rounded-md border border-gray-200 font-medium text-gray-600">
                          {post.authorPenName}
                        </span>
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center text-[#ea9999]">
                            <Heart size={10} className={`mr-1 ${likedPostIds.includes(post.id) ? 'fill-[#d23838] text-[#d23838]' : ''}`} />
                            {post.likes}
                          </span>
                          <button
                            onClick={(e) => handleToggleBookmark(post.id, e)}
                            className="text-amber-600 hover:text-red-500 font-bold px-1.5 py-0.5 rounded hover:bg-amber-100/50 transition-colors cursor-pointer"
                          >
                            取消收藏
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="h-16 bg-white border-t border-[#f8e1e1] flex items-center justify-around sticky bottom-0 z-20 shadow-md shrink-0">
        <button
          onClick={() => {
            setBottomTab('eat');
            if (activeTab !== 'plaza' && activeTab !== 'ao3') {
              setActiveTab('plaza');
            }
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            bottomTab === 'eat' ? 'text-[#d23838]' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Utensils size={18} className={bottomTab === 'eat' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[11px] font-bold mt-0.5">吃饭</span>
        </button>

        <button
          onClick={() => {
            setBottomTab('mine');
            setActiveTab('mine');
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            bottomTab === 'mine' ? 'text-[#d23838]' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <User size={18} className={bottomTab === 'mine' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[11px] font-bold mt-0.5">我的</span>
        </button>
      </div>

      {/* Delete Profile Confirmation Modal */}
      {deleteProfileId && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除人设档案</h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed break-words break-all">
              确定要删除人设档案 <span className="font-bold text-zinc-800">『{profiles.find(p => p.id === deleteProfileId)?.name || '未命名人设'}』</span> 吗？此操作不可恢复。
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteProfileId(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = deleteProfileId;
                  const updatedProfiles = profiles.filter(p => p.id !== targetId);
                  setProfiles(updatedProfiles);
                  if (activeProfileId === targetId) {
                    setActiveProfileId(updatedProfiles.length > 0 ? updatedProfiles[0].id : null);
                  }
                  try {
                    await dbInstance.saveOcProfiles(updatedProfiles);
                  } catch (e) {
                    console.error('Failed to sync deleted profile to SQLite database', e);
                  }
                  setDeleteProfileId(null);
                  setToastMessage('🗑️ 人设档案已删除');
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Post Confirmation Modal */}
      {deletePostId && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除同人创作</h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要删除这篇同人创作吗？此操作不可逆。</p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletePostId(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setPosts(posts.filter(p => p.id !== deletePostId));
                  if (activePost && activePost.id === deletePostId) {
                    setActiveTab(activePost.category || (activePost.isAo3 ? 'ao3' : 'plaza'));
                  }
                  setDeletePostId(null);
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
