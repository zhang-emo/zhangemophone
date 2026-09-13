/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ApiProfile {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  selectedModel?: string;
}

export interface AppSettings {
  apiKey: string;
  baseUrl: string;
  selectedModel: string;
  temperature: number;
  customModels?: string[]; // Pullable models from OpenAI-compatible API
  apiProfiles?: ApiProfile[]; // Saved endpoint credentials profiles
  activeProfileId?: string; // ID of active saved profile
}

export interface LocalImage {
  name: string;
  data: string; // Base64 encoding of image
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  senderName?: string;   // For group chat participant identification
  senderAvatar?: string; // For group chat participant identification
  replyToId?: string;    // ID of the message being replied to
  replyToContent?: string; // Content of the message being replied to
  replyToSender?: string;  // Sender name of the message being replied to
  isRecalled?: boolean;    // If this message has been recalled by the user
}

export interface MemoryEntry {
  id: string;
  date: string; // e.g. "2026-07-31"
  summary: string;
  timestamp: number;
}

export interface CharacterMemorySummary {
  characterId: string;
  relationshipView: string;      // （角色）看待我们的关系
  innerThoughts: string;         // （角色）最新内心想法
  wordsToUser: string;           // 想对我（用户）说的话
  importantMemories: string[];   // 被记住的重要事情
  chatImpressions: string;       // 对和我（用户）聊天的看法
  lastUpdated: number;           // 时间戳
}

export interface ChatSession {
  id: string;
  title: string;
  characterName: string;
  characterAvatar: string; // Key of avatar, e.g., 'muzi', 'neo', 'frodo', 'apeach'
  memory: string; // Character System Prompt backdrop memory
  worldBook: string; // World book background context
  createdAt: number;
  updatedAt: number;
  isGroup?: boolean;       // True if this is a Group Chatroom
  participants?: string[]; // Array of character unique IDs in this group chat
  realName?: string;       // Custom character real name
  gender?: string;         // Custom character gender
  patience?: number;       // Custom character patience value (1-100)
  relationship?: string;   // Custom character relationship with user
  userImpression?: string; // Custom character view/impression of user
  isChatHidden?: boolean;  // If true, hidden from messages tab
  isContactDeleted?: boolean; // If true, deleted/removed contact

  // Long-term Memory System configuration per character
  longTermMemoryEnabled?: boolean; // Toggle switch: true if enabled
  memoryRetentionDays?: number;    // Retention period: default 15 days
  autoSummaryMsgThreshold?: number; // 多少条消息后AI自动整理并保存记忆，默认50条
  summaryMsgCount?: number;         // 单次总结提取最新多少条消息，默认100条
  lastAutoSummaryMsgCount?: number; // 上次自动整理时的消息计数值
  memoryEntries?: MemoryEntry[];   // List of date summary cards
  memoryAppSummary?: CharacterMemorySummary; // Dynamic summarized memory app breakdown

  // Narration Mode configuration per character
  narrationModeEnabled?: boolean;  // Toggle switch: true if enabled
  narrationRuleText?: string;      // Custom narration prompt rules text

  // Proactive Messaging configuration per character
  onlineProactiveEnabled?: boolean;       // 在线主动发消息开关
  onlineIdleMinutes?: number;             // 进入聊天停顿/不说话触发时间 (分钟, 如 5, 10, 15, 30)
  backgroundProactiveEnabled?: boolean;  // 后台挂机主动呼叫开关
  backgroundActiveTimeStart?: string;     // 活动时间范围起点 (e.g. "08:00")
  backgroundActiveTimeEnd?: string;       // 活动时间范围终点 (e.g. "22:00")
  backgroundFrequency?: 'high' | 'medium' | 'low'; // 主动发送频率: 高频(15-30m), 中频(1-3h), 低频(6-12h)

  // Offline Scenario / Plot Configuration per character
  offlineCustomEnabled?: boolean;     // 自定义线下情景开关
  offlineScenarioSetting?: string;    // 情景设定
  offlineAdditionalPrompt?: string;   // 专属追加提示词
  offlinePerspective?: 'second' | 'first' | 'third'; // AI人称视角: 第二人称（你）, 第一人称（我）, 第三人称（姓名）
  offlineLengthPreference?: 'rich' | 'concise';      // 描写长度倾向: 文本饱满细腻, 相对精简响应
  offlineMemorySummaryCount?: number;                // 记忆总结条数 (如 10)
  offlineScenarioTitle?: string;      // Legacy: 线下剧情/情景主题名称
  offlineScenarioDesc?: string;       // Legacy: 线下剧情与详细情景描述
  offlineBehaviorPrompt?: string;     // Legacy: 角色线下互动姿态与偏好

  // AI Time Perception & Wardrobe / Outfit configuration
  timePerceptionEnabled?: boolean;    // AI现实时间与作息感知开关 (默认开启)
  wardrobe?: string[];                // 专属衣柜 (保存穿搭图片的base64/URL数据列表)
}

export const DEFAULT_NARRATION_RULE = "使用括号（）描写动作与环境细节，对话文本换行（换气泡）";

export interface MomentComment {
  id: string;
  senderName: string;
  senderAvatar: string;
  content: string;
  timestamp: number;
  replyTo?: string; // Optional: who are they replying to
}

export interface MomentPost {
  id: string;
  characterName: string;
  characterAvatar: string;
  content: string;
  imageName?: string; // Reference to sandbox local file
  timestamp: number;
  likes: number;
  commentsCount: number;
  likedByMe?: boolean; // Track if current user has liked this post
  comments?: MomentComment[]; // Array of comments on this post
}

export interface CharacterRelationship {
  id: string;
  sourceCharacterName: string; // 主体角色名称 (谁看谁)
  targetCharacterName: string; // 目标角色名称 (对谁的态度)
  relationTag?: string;        // 关系标签 (如: "暗恋", "宿敌", "师徒", "死对头")
  description: string;         // 详细的单向态度、看法与记忆描述 (自定义文本)
  updatedAt: number;
}

export interface BackupData {
  version: string;
  settings: AppSettings;
  sessions: ChatSession[];
  messages: ChatMessage[];
  moments?: MomentPost[];
  relationships?: CharacterRelationship[];
  exportedAt: number;
}

export interface WorldBookFolder {
  id: string;
  name: string;
  isActive: boolean; // 文件夹一键总开关
  characterId?: string; // 绑定的角色ID (如有)
  characterName?: string; // 绑定的角色昵称 (如有)
  createdAt: number;
}

export interface WorldBookEntry {
  id: string;
  title: string;
  keywords: string;
  content: string;
  isActive: boolean;
  characterId?: string;
  characterName?: string;
  folderId?: string;
  entryType?: 'static' | 'dynamic'; // 'static' = 常驻背景, 'dynamic' = 词汇触发
}

export interface RuleEntry {
  id: string;
  title: string;
  content: string;
  isActive: boolean;
}

export interface GmAdventureMemory {
  worldRules: string[];       // 世界法则与铁律
  characterStates: string[];  // 角色与NPC状态
  activeQuests: string[];     // 主线与未决任务
  majorChronicles: string[];  // 重大编年史
  lastUpdatedRound?: number;
  summaryIntervalRounds?: number; // 提炼记忆触发轮数 (4: 密集模式, 6: 均衡模式[推荐], 8: 经济模式)
}

export interface WorldBookConfig {
  preRules: string;
  preRulesActive?: boolean;
  preRulesTitle?: string;
  preRulesList?: RuleEntry[];
  midRules: string;
  midRulesActive?: boolean;
  midRulesTitle?: string;
  midRulesList?: RuleEntry[];
  entries: WorldBookEntry[];
  folders?: WorldBookFolder[];
  postRules: string;
  postRulesActive?: boolean;
  postRulesTitle?: string;
  postRulesList?: RuleEntry[];
  dialoguePreset: string;
  dialoguePresetActive?: boolean;
  dialoguePresetTitle?: string;
  dialoguePresetList?: RuleEntry[];
}

export interface DiaryEntry {
  id: string;
  characterId: string; // The character this diary book belongs to
  authorName: string; // User or character name
  authorAvatar: string; // Character avatar key or user avatar
  authorType: 'user' | 'character';
  title: string;
  content: string;
  timestamp: number;
  // If user-written, character replies inside the same entry
  replyTitle?: string;
  replyContent?: string;
  replyTimestamp?: number;
}


