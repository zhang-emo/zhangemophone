/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbInstance } from './db';
import { ChatMessage, ChatSession, CharacterMemorySummary, GmAdventureMemory } from './types';
import { GoogleGenAI } from '@google/genai';

export function getEffectiveModel(settings: { selectedModel?: string }, defaultModel = 'gpt-4o'): string {
  if (settings.selectedModel && settings.selectedModel !== 'custom') {
    return settings.selectedModel;
  }
  return defaultModel;
}

/**
 * Sanitizes message texts and prompt payloads to prevent sending large base64 image data strings
 * in raw text tokens to the LLM (which would cause "prompt is too long: > 1000000 maximum tokens" error).
 */
export function cleanTextForPrompt(text: string): string {
  if (!text) return '';
  let cleaned = text;
  // Strip [👗 穿搭: data:image/...] or [👗 今日穿搭: data:image/...]
  cleaned = cleaned.replace(/\[👗\s*(?:穿搭|今日穿搭):\s*data:image\/[^\]]+\]/gi, '[👗 今日穿搭照片]');
  // Strip [📎 附图: data:image/...]
  cleaned = cleaned.replace(/\[📎\s*附图:\s*data:image\/[^\]]+\]/gi, '[📎 附图照片]');
  // Strip any raw data:image/... base64 blobs longer than 50 characters
  cleaned = cleaned.replace(/data:image\/[a-zA-Z0-9.+_-]+;base64,[A-Za-z0-9+/=]{50,}/gi, '[图片]');
  return cleaned;
}

export function withTimeout<T>(promise: Promise<T>, ms: number = 35000, errorMsg = '请求超时，请检查网络或代理设置'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    )
  ]);
}

export function getFallbackApiKey(): string {
  try {
    const metaEnv = (import.meta as any).env || {};
    if (metaEnv.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY;
    if (metaEnv.GEMINI_API_KEY) return metaEnv.GEMINI_API_KEY;
  } catch (_) {}

  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.VITE_GEMINI_API_KEY) return process.env.VITE_GEMINI_API_KEY;
      if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    }
  } catch (_) {}

  return '';
}

function checkIsPackagedOrStaticHost(): boolean {
  if (typeof window === 'undefined') return true;

  const protocol = window.location.protocol;
  const isNonHttpProtocol = protocol !== 'http:' && protocol !== 'https:';

  const isNativeBridge = Boolean((window as any).ohos) ||
    Boolean((window as any).Capacitor) ||
    Boolean((window as any).cordova) ||
    Boolean((window as any).webkit?.messageHandlers) ||
    Boolean((window as any).Android);

  const host = window.location.hostname;
  const isStaticOnlyHost = host.includes('github.io') ||
    host.includes('pages.dev');

  return isNonHttpProtocol || isNativeBridge || isStaticOnlyHost;
}

export async function callOpenAIEndpoint(targetUrl: string, apiKey: string, bodyData: any): Promise<any> {
  const cleanTargetUrl = targetUrl.trim();
  const requestBodyStr = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);

  let response: Response | null = null;
  let responseText = '';
  let proxyError: any = null;

  // 1. Check if running in a packaged mobile app without Node server or static host
  const isPackagedOrStaticHost = checkIsPackagedOrStaticHost();

  if (!isPackagedOrStaticHost) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for LLM inference & extraction
      response = await fetch('/api/proxy/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          targetUrl: cleanTargetUrl,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: requestBodyStr
        })
      });
      clearTimeout(timeoutId);
      responseText = await response.text();
    } catch (e: any) {
      proxyError = e;
    }
  }

  // Check if proxy returned HTML (e.g. SPA index.html fallback, 404 page, WAF block)
  const isProxyResponseHtml = responseText.trim().startsWith('<') || responseText.trim().toLowerCase().startsWith('<!doctype');

  // 2. If proxy was skipped, failed to connect, returned non-200, or returned HTML instead of JSON:
  // attempt direct fetch directly to targetUrl (works in WebView and CORS-friendly APIs)
  const needsDirectFetch = isPackagedOrStaticHost || !response || !response.ok || isProxyResponseHtml;

  let directFetchError: any = null;
  if (needsDirectFetch) {
    try {
      const directResponse = await fetch(cleanTargetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: requestBodyStr
      });
      const directText = await directResponse.text();
      const isDirectResponseHtml = directText.trim().startsWith('<') || directText.trim().toLowerCase().startsWith('<!doctype');
      
      // If direct fetch gave a non-HTML response or succeeded, adopt it
      if (directResponse.ok || (!isDirectResponseHtml && directText.trim().length > 0)) {
        response = directResponse;
        responseText = directText;
      } else if (!response) {
        response = directResponse;
        responseText = directText;
      }
    } catch (directErr: any) {
      directFetchError = directErr;
      console.warn("Direct browser fetch attempt failed:", directErr);
    }
  }

  if (!response) {
    const errorDetails = directFetchError?.message || proxyError?.message;
    const isCorsLikely = isPackagedOrStaticHost && (!errorDetails || errorDetails.includes('Failed to fetch') || errorDetails.includes('NetworkError') || errorDetails.includes('Network request failed'));
    if (isCorsLikely) {
      throw new Error(`无法连接到 API 服务端 (${cleanTargetUrl})：浏览器网络请求被拦截（通常是由于静态托管站跨域 CORS 限制，或 API 站点不允许来自网页的前端直接请求）。建议在 API 服务商控制台确认是否支持跨域/CORS。`);
    }
    throw new Error(`无法连接到 API 服务端 (${cleanTargetUrl})：${errorDetails || '网络连接失败，请检查 Base URL 是否正确。'}`);
  }

  if (responseText.trim().startsWith('<') || responseText.trim().toLowerCase().startsWith('<!doctype')) {
    if (response.status === 403) {
      throw new Error(`连接失败 (403 Forbidden)：API 服务商拒绝了访问请求。通常是因为 API Base URL (${cleanTargetUrl}) 配置有误、API Key 权限不足、或当前网络节点被服务商防火墙拦截。请检查设置中的 Base URL 和 API Key。`);
    }
    throw new Error(`API 返回了 HTML 网页而非 JSON 数据 (HTTP ${response.status})。请检查 API Base URL (${cleanTargetUrl}) 是否正确，或网络节点是否拦截了请求。`);
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    throw new Error(`API 返回了无效的 JSON 数据 (HTTP ${response.status}): ${responseText.substring(0, 200)}`);
  }

  if (!response.ok) {
    const errorMsg = data.error?.message || data.message || responseText;
    throw new Error(`API 请求失败 (HTTP ${response.status}): ${errorMsg}`);
  }

  return data;
}

export function getUserProfilePrompt(): string {
  try {
    const saved = localStorage.getItem('wechat_user_profile');
    if (!saved) return '';
    const p = JSON.parse(saved);
    if (!p) return '';
    let text = `\n\n=== 人类用户(主人/伙伴)的最新个人人设与资料 ===\n`;
    if (p.userId && p.userId !== 'User_Real') text += `- 论坛网络昵称(公开网名): ${p.userId}\n`;
    if (p.realName && p.realName !== '未填写' && p.realName !== '你') text += `- 真实姓名(日常交流与认识的角色私下称呼): ${p.realName}\n`;
    if (p.gender && p.gender !== '保密') text += `- 性别: ${p.gender}\n`;
    if (p.birthday) text += `- 生日: ${p.birthday}\n`;
    if (p.mbti) text += `- MBTI: ${p.mbti}\n`;
    if (p.background && p.background.trim()) {
      text += `- 背景与性格人设: ${p.background.trim()}\n`;
    } else {
      text += `- 背景与性格人设: （用户未设置或已清空特殊背景，请作为普通人类伙伴交流）\n`;
    }
    text += `【核心指导准则】：
1. 论坛场景：在论坛（动态 App）的公开资料和发帖署名中，用户显示的是网络昵称（网名：${p.userId && p.userId !== 'User_Real' ? p.userId : '用户'}），绝不公开暴露用户的真实姓名。
2. 角色认知与称呼：角色与用户私下交流（聊天、日记）或在认识后的互动中，熟识的角色依然知道并称呼用户的真实姓名（${p.realName && p.realName !== '未填写' ? p.realName : (p.userId || '用户')}）。
3. 同步人设：所有角色时刻深刻记住上述最新的用户人设。若用户修改或删除了某些人设字段，请实时同步调整，切勿继续使用旧人设。\n`;
    return text;
  } catch (e) {
    return '';
  }
}

export function cleanBackgroundText(text: string): string {
  if (!text) return '';
  if (text.startsWith('你叫') && text.includes('身份背景是')) {
    const bgMatch = text.match(/身份背景是\s*([\s\S]*?)(?=\x20*。(?:你对用户的看法|你的耐心值|你与用户的关系|请始终)|$)/);
    if (bgMatch && bgMatch[1]) {
      return bgMatch[1].trim();
    }
  }
  return text;
}

export function getSystemMemoryPrompt(session: {
  characterName?: string;
  realName?: string;
  gender?: string;
  memory?: string;
  patience?: number;
  relationship?: string;
  userImpression?: string;
}): string {
  const bg = cleanBackgroundText(session.memory || '');
  if (!session.realName && !session.gender && !session.relationship && !session.userImpression) {
    return bg || session.memory || '';
  }
  let prompt = `你叫 ${session.characterName || '伙伴'}`;
  if (session.realName) prompt += `，真实姓名是 ${session.realName}`;
  if (session.gender) prompt += `，性别是 ${session.gender}`;
  if (bg) prompt += `，身份背景是 ${bg}`;
  if (session.userImpression) prompt += `。你对用户的看法与态度是：${session.userImpression}`;
  if (session.patience !== undefined) prompt += `。你的耐心值是 ${session.patience}`;
  if (session.relationship) prompt += `。你与用户的关系是 ${session.relationship}`;
  prompt += `。请始终贴合这个角色的语气、性格口癖、耐心水平与动作表情来进行高保真的扮演对话。`;
  return prompt;
}

const GLOBAL_EARTH_RULE = `\n\n=== 强制世界观背景约束 (地球设定) ===
1. 所有角色的背景、生活经历、对话背景和发生的事件默认且必须强制发生于真实的“地球”上的普通日常生活角落（绝不涉及未来科幻、外星、架空魔法、多次元或跨时空）。
2. 绝对屏蔽和清除所有多次元、跨时空、多元宇宙相汇或时空融合相关的任何概念。
3. 即使角色的原始世界设定或回忆中含有空中岛屿、宇宙毁灭、异世界、跨次元等词汇，也必须将其转换并视作在地球上某个普通风景区或写实城市（如：中国大理、韩国首尔、中国上海等普通写实日常角落）发生的普通生活趣闻，绝对不可在言语和意识中显露任何跨时空的概念，必须保证是百分之百的纯地球日常写实风。
`;

function getTodayEventsPrompt(): string {
  try {
    const savedEvents = localStorage.getItem('calendar_events');
    if (!savedEvents) return '';
    const allEvents = JSON.parse(savedEvents);
    
    // Get today's date in YYYY-MM-DD
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${date}`;
    
    const todayEvents = allEvents.filter((e: any) => e.date === todayStr);
    if (todayEvents.length === 0) return '';
    
    let prompt = `\n\n=== 今日日程安排与角色动态同步 (当前日期: ${todayStr}) ===\n`;
    prompt += `这些日程已经在今日的日历中发布了。角色和人类用户双方都已经知情。如果用户在对话中问起你“现在在做什么”、“有什么安排”、“你在干嘛”或者提到相关的行程，请看当前的具体时刻 (${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')})，根据下面的列表找出“当前时间对应正在进行”的行程，沉浸式、极度生动地回答你正在干这件事，并表达该行程的心情。如果是人类用户自己添加的同步行程，你可以用你习惯的角色语气，表示你已经同步知情了，可以用积极的、好奇的或符合你性格的口吻主动讨论、期待或配合这个行程！\n`;
    
    todayEvents.forEach((e: any) => {
      const belongsText = e.characterId 
        ? `[属于角色 ${e.characterId.includes('octocat_author') ? '章鱼猫' : e.characterId} 的个人日程]` 
        : `[由人类用户自己添加并同步给全员的公开日程]`;
      const moodText = e.characterMood ? ` | 心情: ${e.characterMood}` : '';
      const locText = e.location ? ` | 地点: ${e.location}` : '';
      const descText = e.description ? ` | 详情: ${e.description}` : '';
      prompt += `- 【${e.time}】 标题: ${e.title}${moodText}${locText}${descText} ${belongsText}\n`;
    });
    
    return prompt;
  } catch (e) {
    console.error('Failed to parse calendar events for prompt', e);
    return '';
  }
}

async function getTriggeredWorldBookEntries(userPrompt: string, history: ChatMessage[], currentCharacterId?: string) {
  try {
    const config = await dbInstance.getWorldBookConfig();
    const recentTexts = [
      userPrompt,
      ...history.slice(-10).map(m => m.content)
    ].join('\n').toLowerCase();

    // 1. Static background entries from WorldBook entries (entryType === 'static')
    const staticEntries = config.entries.filter(entry => {
      if (!entry.isActive || !entry.content || entry.entryType !== 'static') return false;
      if (entry.folderId && config.folders && config.folders.length > 0) {
        const folder = config.folders.find(f => f.id === entry.folderId);
        if (folder && !folder.isActive) return false;
      }
      if (entry.characterId && currentCharacterId && entry.characterId !== currentCharacterId) {
        return false;
      }
      return true;
    });

    // 2. Dynamic keyword trigger entries (entryType !== 'static')
    const triggered = config.entries.filter(entry => {
      if (!entry.isActive || !entry.content || entry.entryType === 'static') return false;
      // If entry belongs to a folder, check folder active status
      if (entry.folderId && config.folders && config.folders.length > 0) {
        const folder = config.folders.find(f => f.id === entry.folderId);
        if (folder && !folder.isActive) {
          return false; // Folder is turned off
        }
      }
      // If entry is bound to a specific character, it ONLY triggers when chatting with that character!
      if (entry.characterId && currentCharacterId && entry.characterId !== currentCharacterId) {
        return false;
      }
      const keywords = entry.keywords
        .split(/[,，|、\s]+/)
        .map(k => k.trim().toLowerCase())
        .filter(k => k.length > 0);
      
      if (keywords.length === 0) return false;
      return keywords.some(keyword => recentTexts.includes(keyword));
    });

    const activePre = (config.preRulesList || [])
      .filter(item => item.isActive && item.content?.trim())
      .map(item => `【${item.title}】\n${item.content}`)
      .join('\n\n');
    const preRules = activePre || ((config.preRulesActive !== false && config.preRules) ? config.preRules : '');

    const staticEntriesText = staticEntries
      .map(item => `【${item.title || '常驻背景设定'}】\n${item.content}`)
      .join('\n\n');

    const activeMid = (config.midRulesList || [])
      .filter(item => item.isActive && item.content?.trim())
      .map(item => `【${item.title}】\n${item.content}`)
      .join('\n\n');
    let midRules = activeMid || ((config.midRulesActive !== false && config.midRules) ? config.midRules : '');
    if (staticEntriesText) {
      midRules = midRules ? `${midRules}\n\n${staticEntriesText}` : staticEntriesText;
    }

    const activePost = (config.postRulesList || [])
      .filter(item => item.isActive && item.content?.trim())
      .map(item => `【${item.title}】\n${item.content}`)
      .join('\n\n');
    const postRules = activePost || ((config.postRulesActive !== false && config.postRules) ? config.postRules : '');

    const activePreset = (config.dialoguePresetList || [])
      .filter(item => item.isActive && item.content?.trim())
      .map(item => `【${item.title}】\n${item.content}`)
      .join('\n\n');
    const dialoguePreset = activePreset || ((config.dialoguePresetActive !== false && config.dialoguePreset) ? config.dialoguePreset : '');

    return {
      preRules,
      midRules,
      triggered,
      postRules,
      dialoguePreset
    };
  } catch (e) {
    console.error('Failed to load world book config:', e);
    return { preRules: '', midRules: '', triggered: [], postRules: '', dialoguePreset: '' };
  }
}

export async function generateAiReply(
  chatId: string,
  userMessageContent: string,
  history: ChatMessage[],
  characterMemory: string,
  worldBook: string,
  imageUrl?: string,
  availableStickers?: string[],
  memoryMeta?: {
    longTermMemoryEnabled?: boolean;
    memoryRetentionDays?: number;
    memoryEntries?: { id: string; date: string; summary: string; timestamp: number }[];
    memoryAppSummary?: CharacterMemorySummary;
  },
  narrationMeta?: {
    narrationModeEnabled?: boolean;
    narrationRuleText?: string;
  },
  offlineMeta?: {
    offlineCustomEnabled?: boolean;
    offlineScenarioSetting?: string;
    offlineAdditionalPrompt?: string;
    offlinePerspective?: 'second' | 'first' | 'third';
    offlineLengthPreference?: 'rich' | 'concise';
    offlineMemorySummaryCount?: number;
    offlineScenarioTitle?: string;
    offlineScenarioDesc?: string;
    offlineBehaviorPrompt?: string;
    offlineCharacterRealName?: string;
    offlineUserRealName?: string;
  },
  extraOptions?: {
    timePerceptionEnabled?: boolean;
    outfitImageUrl?: string;
  }
): Promise<string> {
  // 1. Recover decrypted settings & world book configuration
  const settings = await dbInstance.getSettings();
  const wb = await getTriggeredWorldBookEntries(userMessageContent, history, chatId);

  if (!settings.apiKey) {
    throw new Error('未检测到 API Key，请点击底部导航的“设置”项，输入并保存账户凭据。');
  }

  // 2. Build full System prompt integrating character memory background & world book
  let systemPrompt = '';

  // 对话预设高权重系统指令 (Dialogue Preset high-weight system instructions)
  if (wb.dialoguePreset) {
    systemPrompt += `=== 对话高权重预设系统指令 ===\n${wb.dialoguePreset}\n\n`;
  }

  // "前" (Pre): Core world rules / Alignment basic rules
  if (wb.preRules) {
    systemPrompt += `=== 核心规则 (前置注入) ===\n${wb.preRules}\n\n`;
  }

  systemPrompt += `=== 角色扮演背景 (中置设定) ===\n`;
  systemPrompt += `你现在是一个高度智能化的AI角色扮演模型，请严格沉浸式扮演你的角色，绝不穿帮：\n`;
  systemPrompt += `- 角色设定与记忆：\n${characterMemory || '无特殊性格设定，保持自然、友好。'}\n\n`;

  // Inject Custom Offline Scenario/Plot Prompt if active
  const scenarioText = offlineMeta?.offlineScenarioSetting?.trim() || offlineMeta?.offlineScenarioDesc?.trim();
  const additionalPromptText = offlineMeta?.offlineAdditionalPrompt?.trim() || offlineMeta?.offlineBehaviorPrompt?.trim();

  if (offlineMeta?.offlineCustomEnabled && (scenarioText || additionalPromptText)) {
    systemPrompt += `=== 自定义线下剧情与情景设定 (当前专属线下模式) ===\n`;
    if (offlineMeta.offlineScenarioTitle?.trim()) {
      systemPrompt += `- 线下情景主题：${offlineMeta.offlineScenarioTitle.trim()}\n`;
    }
    if (scenarioText) {
      systemPrompt += `- 情景设定：\n${scenarioText}\n`;
    }
    if (additionalPromptText) {
      systemPrompt += `- 专属追加提示词：\n${additionalPromptText}\n`;
    }

    // Perspective requirement
    const perspective = offlineMeta.offlinePerspective || 'second';
    if (perspective === 'first') {
      systemPrompt += `- AI人称视角：第一人称（使用“我”进行角色表达与叙述）\n`;
    } else if (perspective === 'third') {
      systemPrompt += `- AI人称视角：第三人称（使用角色的姓名/名字称呼自己进行表达与叙述）\n`;
    } else {
      systemPrompt += `- AI人称视角：第二人称（使用“你”与用户互动表达）\n`;
    }

    // Length preference
    const lengthPref = offlineMeta.offlineLengthPreference || 'rich';
    if (lengthPref === 'concise') {
      systemPrompt += `- 描写长度倾向：相对精简响应（语言紧凑干练，突出核心回应）\n`;
    } else {
      systemPrompt += `- 描写长度倾向：文本饱满细腻（注重环境氛围、情绪细节与微动作雕琢）\n`;
    }

    systemPrompt += `【剧情相处指令】：你当前正与用户处于上述自定义线下剧情情景中。请根据上述情景设定、追加提示词以及表现参数设定，与用户开展真实生动的线下相处与剧情对话。请严格遵守该情景氛围。\n\n`;
  }

  if (offlineMeta?.offlineCustomEnabled) {
    const charRealName = offlineMeta.offlineCharacterRealName || '角色';
    const userRealName = offlineMeta.offlineUserRealName || '用户';

    systemPrompt += `=== 线下模式专属最高强制指令 (全剧统一) ===\n`;
    systemPrompt += `1. 真实姓名互动：你们处于线下真实相处模式。角色真名是【${charRealName}】，用户真名是【${userRealName}】。在角色自身言语、神态描写、心里描写、动作与称呼中，必须统一使用真名（你的真名是 ${charRealName}，用户的真名是 ${userRealName}）。\n`;
    systemPrompt += `2. 单气泡连续输出：角色本次回复【必须且只能作为一个整体单气泡】输出，绝对不进行多段换行气泡拆分。\n`;
    systemPrompt += `3. 乙女文风格与字数：请使用极其细腻动人、高沉浸感、富有拉扯与细节心理/动作描写的“乙女文/小说叙事”风格。本次生成的单次文本字数【严格限定在 500 字至 800 字之间】，不得过短（严禁少于 500 字），亦不要过长（不要超过 800 字）。请一次性完整输出。\n`;
    systemPrompt += `4. 严禁虚构未提供的容貌/身体特征：在描写角色或用户的容貌、肢体细节与神态动作时，【绝对严禁自行捏造、虚构或添加任何用户未明确给出的外貌特征与身体细节】（例如：切勿擅自描写“脖子上有痣”、“锁骨上有痣”、“眼角有泪痣”、“身上有疤痕”、“发色或瞳色特殊变化”等未在人设设定中声明的器官与身体部位细节）。所有描写必须严格忠实于既有设定，绝不擅自脑补未给出的外观属性。\n\n`;
  }

  // Inject Inter-character Relationship Network
  try {
    const allRelationships = await dbInstance.getAllRelationships();
    if (allRelationships.length > 0) {
      systemPrompt += `- 角色际关系网络认知 (角色间单向态度与情感基调)：\n`;
      allRelationships.forEach((r) => {
        const tagStr = r.relationTag ? ` [关系: ${r.relationTag}]` : '';
        systemPrompt += `  * ${r.sourceCharacterName} ➔ ${r.targetCharacterName}${tagStr}: ${r.description}\n`;
      });
      systemPrompt += `  【提示】：请时刻牢记上述关于你自己以及其他角色之间的单向看法与过往关系设定，在所有对话与互动中展现对应的性格反应。\n\n`;
    }
  } catch (err) {
    console.error('Error injecting character relationships:', err);
  }

  // Inject active valid Long-term Memory summaries if enabled
  if (memoryMeta?.longTermMemoryEnabled !== false && memoryMeta?.memoryEntries && memoryMeta.memoryEntries.length > 0) {
    const days = memoryMeta.memoryRetentionDays || 15;
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    let validMemories = memoryMeta.memoryEntries.filter(m => m.timestamp >= cutoff);
    if (offlineMeta?.offlineMemorySummaryCount && offlineMeta.offlineMemorySummaryCount > 0) {
      validMemories = validMemories.slice(-offlineMeta.offlineMemorySummaryCount);
    }
    if (validMemories.length > 0) {
      systemPrompt += `- 沉淀的长期神经网络核心记忆 (保留期限: 最近${days}天)：\n`;
      validMemories.forEach(m => {
        systemPrompt += `  * [${m.date}]: ${m.summary}\n`;
      });
      systemPrompt += `\n`;
    }
  }

  // Inject 5-dimension Character Memory Summary (if active within retention days)
  if (memoryMeta?.memoryAppSummary) {
    const mem = memoryMeta.memoryAppSummary;
    const retentionDays = memoryMeta.memoryRetentionDays || 15;
    const ageDays = (Date.now() - (mem.lastUpdated || 0)) / (1000 * 3600 * 24);
    if (ageDays <= retentionDays) {
      systemPrompt += `=== 角色内部沉淀的5维神经网络记忆与内心想法 (保留期: 最近${retentionDays}天) ===\n`;
      if (mem.relationshipView?.trim()) systemPrompt += `- 看待与用户的关系: ${mem.relationshipView.trim()}\n`;
      if (mem.innerThoughts?.trim()) systemPrompt += `- 最新内心想法: ${mem.innerThoughts.trim()}\n`;
      if (mem.wordsToUser?.trim()) systemPrompt += `- 最想对用户说的话: ${mem.wordsToUser.trim()}\n`;
      if (mem.importantMemories && mem.importantMemories.length > 0) {
        systemPrompt += `- 被记住的重要事情与约定:\n${mem.importantMemories.map(item => `  * ${item}`).join('\n')}\n`;
      }
      if (mem.chatImpressions?.trim()) systemPrompt += `- 对和用户聊天的看法: ${mem.chatImpressions.trim()}\n`;
      systemPrompt += `【系统提示】：请牢记上述你对用户的记忆与心境，在对话语气、态度和细节互动中完全体现这些认知。\n\n`;
    }
  }

  // Inject Narration Mode rules
  if (narrationMeta?.narrationModeEnabled === true) {
    const ruleText = narrationMeta?.narrationRuleText?.trim() || '使用括号（）描写动作与环境细节，对话文本换行（换气泡）';
    systemPrompt += `=== 旁白与环境动作描写规则 (旁白模式: 已开启) ===\n`;
    systemPrompt += `【旁白输出规则】：${ruleText}\n`;
    systemPrompt += `【强制格式指导】：请严格遵守上述规则，在回复中使用括号（）或()详细描写角色的微表情、肢体动作、心理状态及周围环境，对话台词与旁白之间进行换行。\n\n`;
  } else {
    systemPrompt += `=== 旁白与环境动作描写规则 (旁白模式: 已关闭) ===\n`;
    systemPrompt += `【系统强制指令】：旁白模式已被用户关闭！本次回复你【绝对禁止】在文本中使用任何括号（）或()输出动作描写、心理活动或环境旁白，请只输出纯对话台词。\n\n`;
  }

  if (worldBook) {
    systemPrompt += `- 场景设定与世界观描述：\n${worldBook}\n\n`;
  }

  // "中 - 常驻背景" (Middle Static)
  if (wb.midRules) {
    systemPrompt += `=== 常驻背景 (中置常驻) ===\n${wb.midRules}\n\n`;
  }

  // "中" (Middle): Dynamic Recollections of World Book triggered by keywords
  if (wb.triggered.length > 0) {
    systemPrompt += `=== 触发回忆的设定 (中置动态回忆) ===\n`;
    wb.triggered.forEach(entry => {
      systemPrompt += `【记忆/设定: ${entry.title}】\n${entry.content}\n\n`;
    });
  }

  // "后" (Post): Format specification and style reinforcement
  if (wb.postRules) {
    systemPrompt += `=== 输出规范 (后置强化) ===\n${wb.postRules}\n\n`;
  }

  systemPrompt += `=== 交互辅助信息 ===\n`;
  systemPrompt += `- 请在对话中展示你的独特语气 and 动作表情，保持第一人称回答。\n`;
  systemPrompt += `- 回复内容请精简适中，符合手机即时通信聊天界面（KakaoTalk样式）阅读。\n\n`;

  // AI Time Perception Prompt
  if (extraOptions?.timePerceptionEnabled !== false) {
    const now = new Date();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const hour = now.getHours();
    let period = '凌晨';
    if (hour >= 6 && hour < 9) period = '早晨/清晨';
    else if (hour >= 9 && hour < 12) period = '上午';
    else if (hour >= 12 && hour < 14) period = '中午';
    else if (hour >= 14 && hour < 18) period = '下午';
    else if (hour >= 18 && hour < 23) period = '傍晚/夜晚';
    else period = '深夜';

    systemPrompt += `=== 现实时间与生活作息感知 (时间感知: 已开启) ===\n`;
    systemPrompt += `- 当前现实世界的具体时间：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} (${period})\n`;
    systemPrompt += `【时间感知准则】：你拥有对当前现实世界时间、日期、星期与具体作息时刻（早晨、上午、中午就餐、下午、傍晚下班/放学、深夜入睡）的深度大脑感知。若用户主动或对话语境涉及时间、问候（如“早上好”、“吃午饭了吗”、“还不睡吗”、“几点了”等），请结合当前真实时间与你的角色性格给出自然、真实、充满生活烟火气的互动。\n\n`;
  } else {
    systemPrompt += `=== 现实时间与生活作息感知 (时间感知: 已关闭) ===\n`;
    systemPrompt += `【系统提示】：用户已关闭时间感知功能。请不要根据现实时钟或现实时刻刻意对用户进行早晚问候，而是聚焦于当前对话上下文与剧情本身。\n\n`;
  }

  // Outfit prompt injection if active
  if (extraOptions?.outfitImageUrl) {
    systemPrompt += `=== 今日穿搭展示指令 (Daily Outfit) ===\n`;
    systemPrompt += `用户请求查看你今天的穿搭，或者当前你正向用户展示衣服照片。请务必完全沉浸并严格保持你的角色人设、口吻、性格特点与情感（如傲娇/高冷/温柔/调皮等）。\n`;
    systemPrompt += `【重要要求】：\n`;
    systemPrompt += `1. **严禁在文字中逐一用词语描述衣服细节/款式/颜色**（因为图片已经直观呈现，无需做多余的文字描写）；\n`;
    systemPrompt += `2. 只需以你的人设口吻给出简短自然的日常聊天互动（如“喏，就这身”、“好看吗？”、“今天随意穿了下”、“还行吧？”等符合性格的简短一两句话）；\n`;
    systemPrompt += `3. 在你的回复中单独成行附带穿搭照片标记 [👗 今日穿搭] （系统会自动将照片与你的文字拆分为两个独立气泡）。\n\n`;
  }

  if (availableStickers && availableStickers.length > 0) {
    systemPrompt += `\n=== 可用表情包 (Stickers) ===\n`;
    systemPrompt += `你在对话中除了发送文字外，还可以发送表情包来更好地表达情感（如可爱、无语、开心、撒娇等）。如果你想发送以下某个表情包，请在回复中单独输出一行对应的特定格式（每次回复最多包含1个表情包，且必须严格匹配文件名，不可胡乱捏造文件名）：\n`;
    systemPrompt += `[📎 附图: /images/表情包名称]\n`;
    systemPrompt += `目前可用的表情包文件名称列表如下：\n`;
    availableStickers.forEach(name => {
      systemPrompt += `- ${name}\n`;
    });
    systemPrompt += `（提示: 挑选符合你当前心情或话语语义的表情包发送，它会单独渲染为一个气泡）\n\n`;
  }

  systemPrompt += `\n=== 转账功能 ===\n`;
  systemPrompt += `如果在对话与剧情发展中，你想主动给用户发零花钱、红包、还钱、奖金或慰问金，你可以单独发送一行转账格式（将生成交互式转账卡片）：\n`;
  systemPrompt += `[💸 转账: 金额 | 备注: 备注内容 | 状态: 待领取]\n`;
  systemPrompt += `示例: [💸 转账: 200.00 | 备注: 拿去买好吃的 | 状态: 待领取]\n\n`;

  systemPrompt += GLOBAL_EARTH_RULE;
  systemPrompt += getUserProfilePrompt();
  systemPrompt += getTodayEventsPrompt();

  // 3. Arrange message chains
  const apiMessages: any[] = [
    { role: 'system', content: systemPrompt }
  ];

  // Append recent context window (limit to latest 15 messages for high responsiveness and cost savings)
  const windowedHistory = history.slice(-15);
  windowedHistory.forEach((msg) => {
    apiMessages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: cleanTextForPrompt(msg.content)
    });
  });

  // Append current active message
  const cleanedUserContent = cleanTextForPrompt(userMessageContent);
  let lastContent: any = cleanedUserContent;
  if (imageUrl) {
    lastContent = [
      {
        type: 'text',
        text: `${cleanedUserContent}\n\n[提示: 用户发送了这张表情包/配图，请将其作为对话中的视觉多模态输入，高度结合图片的内容（如人物动作、神态、画面文字或物品）给出极富情感、代入感与趣味性的角色扮演聊天互动。]`
      },
      {
        type: 'image_url',
        image_url: {
          url: imageUrl
        }
      }
    ];
  }

  apiMessages.push({
    role: 'user',
    content: lastContent
  });

  // 4. Send network request
  const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
  const targetUrl = `${cleanBaseUrl}/chat/completions`;

  const bodyData = {
    model: getEffectiveModel(settings),
    messages: apiMessages,
    temperature: settings.temperature ?? 0.7,
    max_tokens: 1536
  };

  try {
    const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
    let replyStr = data.choices?.[0]?.message?.content;
    
    if (!replyStr) {
      throw new Error('未能在返回的 JSON 负载中解析到有效文本，请确认 API 供应商设置。');
    }

    replyStr = replyStr.trim();

    // If outfit image was requested, ensure the outfit markup with the image url is attached on its own separate line
    if (extraOptions?.outfitImageUrl) {
      if (replyStr.includes('[👗 今日穿搭]')) {
        replyStr = replyStr.replace('[👗 今日穿搭]', `\n[👗 穿搭: ${extraOptions.outfitImageUrl}]\n`);
      } else if (replyStr.includes('[👗 穿搭]')) {
        replyStr = replyStr.replace('[👗 穿搭]', `\n[👗 穿搭: ${extraOptions.outfitImageUrl}]\n`);
      } else if (!replyStr.includes('[👗 穿搭:') && !replyStr.includes('[👗 今日穿搭:')) {
        replyStr = `[👗 穿搭: ${extraOptions.outfitImageUrl}]\n${replyStr}`;
      }
    }

    return replyStr;
  } catch (err: any) {
    if (imageUrl) {
      console.warn("Multimodal request exception, falling back to text-only mode...", err);
      return generateAiReply(
        chatId,
        userMessageContent,
        history,
        characterMemory,
        worldBook,
        undefined,
        availableStickers,
        memoryMeta,
        narrationMeta,
        offlineMeta,
        extraOptions
      );
    }
    console.warn('API generated reply failed:', err.message || err);
    throw new Error(err.message || '网络连接或调用超时失联，请核验设置页中的代理地址。');
  }
}

/**
 * Generates an individual character's reply within a KakaoTalk group chat room context.
 */
export async function generateGroupMemberReply(
  chatId: string,
  characterId: string,
  characterName: string,
  characterMemory: string,
  characterWorldBook: string,
  history: ChatMessage[],
  allGroupAis: { name: string; avatar: string; id: string }[],
  imageUrl?: string,
  availableStickers?: string[],
  narrationMeta?: {
    narrationModeEnabled?: boolean;
    narrationRuleText?: string;
  }
): Promise<string> {
  const settings = await dbInstance.getSettings();
  const wb = await getTriggeredWorldBookEntries('', history);

  if (!settings.apiKey) {
    throw new Error('未检测到 API Key，请先前去手机设置项中保存您的 API 密钥配额。');
  }

  // 1. Compile System Prompt for specific group participant
  let systemPrompt = '';

  // "前" (Pre)
  if (wb.preRules) {
    systemPrompt += `=== 核心规则 (前置注入) ===\n${wb.preRules}\n\n`;
  }

  systemPrompt += `=== 角色扮演背景 (中置设定) ===\n`;
  systemPrompt += `你现在是一个高度智能化的AI角色扮演模型。\n`;
  systemPrompt += `你正在参与一个多角色群聊（KakaoTalk Group Chat Room）场景。\n`;
  systemPrompt += `你必须严格、沉浸式扮演以下指定的群内角色，绝不可跳戏穿帮：\n\n`;
  systemPrompt += `- 扮演的角色名: ${characterName}\n`;
  systemPrompt += `- 角色设定与记忆行为习惯:\n${characterMemory || '无特殊设定。'}\n\n`;
  systemPrompt += `- 群聊世界设定场景:\n${characterWorldBook || '无场景限制。'}\n\n`;

  // Inject Narration Mode rules
  if (narrationMeta?.narrationModeEnabled === true) {
    const ruleText = narrationMeta?.narrationRuleText?.trim() || '使用括号（）描写动作与环境细节，对话文本换行（换气泡）';
    systemPrompt += `=== 旁白与环境动作描写规则 (旁白模式: 已开启) ===\n`;
    systemPrompt += `【旁白输出规则】：${ruleText}\n`;
    systemPrompt += `【强制格式指导】：请在回复中使用括号（）或()描写角色的动作、心理与神态，台词与旁白间换行。\n\n`;
  } else {
    systemPrompt += `=== 旁白与环境动作描写规则 (旁白模式: 已关闭) ===\n`;
    systemPrompt += `【系统强制指令】：旁白模式已被关闭！你【绝对禁止】在回复中使用任何括号（）或()输出动作描写或环境旁白！\n\n`;
  }

  // "中 - 常驻背景" (Middle Static)
  if (wb.midRules) {
    systemPrompt += `=== 常驻背景 (中置常驻) ===\n${wb.midRules}\n\n`;
  }
  
  // "中" (Middle): Dynamic Recollections of World Book triggered by keywords
  if (wb.triggered.length > 0) {
    systemPrompt += `=== 触发回忆的设定 (中置动态回忆) ===\n`;
    wb.triggered.forEach(entry => {
      systemPrompt += `【记忆/设定: ${entry.title}】\n${entry.content}\n\n`;
    });
  }

  systemPrompt += `=== 群聊其他AI成员名单 ===\n`;
  const otherAis = allGroupAis.filter(ai => ai.id !== characterId);
  otherAis.forEach(ai => {
    systemPrompt += `- ${ai.name} (图标/头像: ${ai.avatar})\n`;
  });
  systemPrompt += `- 还有一个人类用户 (在群里显示为 “人类”，是唯一的真实人类好友)。\n\n`;

  // "后" (Post)
  if (wb.postRules) {
    systemPrompt += `=== 输出规范 (后置强化) ===\n${wb.postRules}\n\n`;
  }

  systemPrompt += `=== 终极交互扮演准则 ===\n`;
  systemPrompt += `1. 请完全使用 ${characterName} 的第一人称语气 and 词汇习惯来作答。\n`;
  systemPrompt += `2. 你在群里看到了整场多角色聊天的最近历史纪要。请认真阅读别人的态度或正在讨论的主题。你可以评论、支持、调侃或者吐槽其他AI伙伴（如: ${otherAis.map(a => a.name).join('、')}）的言论，也可以积极关怀或回应“人类”的话！\n`;
  systemPrompt += `3. 回复请尽可能简练（不要高谈阔论，字数限制在 120 字内，符合手机KakaoTalk消息的气泡阅读体验）。\n`;
  systemPrompt += `4. 你可以在对话中加入富有灵魂和生动感的小动作描写（如：*揉了揉眼睛*、*傲娇地偏过头*），融入到即时文字间。\n`;
  systemPrompt += `5. 严禁捏造或代替其他人的发言。禁止在你的回复包里替别人说 “Muzi说...”, “Neo说...”, 你的发言包只代表你 ${characterName} 本人。\n`;
  systemPrompt += `6. 直接输出内容。不需要包含任何说明性前缀（不要写成 “[${characterName}]: 内容”），仅输出要说的心灵台词本身。\n`;

  if (availableStickers && availableStickers.length > 0) {
    systemPrompt += `7. 【重要表情包互动】你在群聊中除了发送文字外，还可以发送表情包。如果你想发送以下某个表情包，请在回复中单独输出一行对应的特定格式（不要带任何其他文字，也不要捏造格式）：\n`;
    systemPrompt += `[📎 附图: /images/表情包名称]\n`;
    systemPrompt += `可用的表情包文件名称如下，请严格保持其英文或下划线命名一致：\n`;
    availableStickers.forEach(name => {
      systemPrompt += `- ${name}\n`;
    });
    systemPrompt += `（提示: 每次回复最多单独发送 1 个表情包，可以让它出现在文字前、文字后或作为一个独立的回复气泡发送。尽量挑选语义或文件名相关的表情包进行发送）\n\n`;
  }

  systemPrompt += GLOBAL_EARTH_RULE;
  systemPrompt += getUserProfilePrompt();
  systemPrompt += `当前系统时间: ${new Date().toLocaleString()}`;
  systemPrompt += getTodayEventsPrompt();

  // 2. Format historical messages to let the LLM see the conversation thread with names clearly
  const apiMessages: any[] = [
    { role: 'system', content: systemPrompt }
  ];

  // We feed up to 18 messages of history to keep high density and rich conversation
  const windowedHistory = history.slice(-18);
  windowedHistory.forEach((msg) => {
    if (msg.role === 'system') return;
    
    const senderLabel = msg.role === 'user' 
      ? '人类' 
      : (msg.senderName || '助手');

    // Feed to agent as a flat dialogue sequence
    apiMessages.push({
      role: 'user', // Use user role to simulate the environment input for this single agent
      content: `[${senderLabel}] 说: "${cleanTextForPrompt(msg.content)}"`
    });
  });

  // Instruction prompt
  let lastContent: any = `[系统暗示]: 请作为 ${characterName} 展开您的发言气泡。要求极具你的傲娇/治愈/傲慢特色，字数精简，直接输出内容。`;
  if (imageUrl) {
    lastContent = [
      {
        type: 'text',
        text: `[系统暗示]: 请作为 ${characterName} 展开您的发言气泡。用户刚刚发送了一张图片表情（已在下方通过视觉通道传入），请你不仅阅读最近的群聊历史，还要特别结合和评论一下这张表情包图片的内容（里面的人物、文字、表情神态等）来展开代入感极强的拟真互动，字数精简，直接输出内容。`
      },
      {
        type: 'image_url',
        image_url: {
          url: imageUrl
        }
      }
    ];
  }

  apiMessages.push({
    role: 'user',
    content: lastContent
  });

  // 3. Request
  const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
  const targetUrl = `${cleanBaseUrl}/chat/completions`;

  const bodyData = {
    model: getEffectiveModel(settings),
    messages: apiMessages,
    temperature: settings.temperature ?? 0.8, // Slightly higher temperature for group playful dynamics
    max_tokens: 512
  };

  try {
    const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
    const replyStr = data.choices?.[0]?.message?.content;
    
    if (!replyStr) {
      throw new Error('未能在返回的 JSON 中解析到有效消息文本。');
    }

    return replyStr.trim();
  } catch (err: any) {
    if (imageUrl) {
      console.warn("Multimodal group request exception, falling back to text-only mode...", err);
      return generateGroupMemberReply(
        chatId,
        characterId,
        characterName,
        characterMemory,
        characterWorldBook,
        history,
        allGroupAis,
        undefined,
        availableStickers,
        narrationMeta
      );
    }
    console.error(`Group AI generated reply failed for ${characterName}:`, err);
    throw new Error(err.message || '网络连接失败');
  }
}

/**
 * Generates an AI comment on a moments post.
 */
export async function generateAiMomentComment(
  characterName: string,
  characterMemory: string,
  relationship: string,
  momentContent: string,
  commentHistory: string = '',
  postOwnerName?: string
): Promise<string> {
  try {
    const settings = await dbInstance.getSettings();
    if (settings.apiKey) {
      const isOwnerUser = !postOwnerName || postOwnerName === 'User' || postOwnerName === '用户';
      
      const promptSystem = `你必须严格沉浸式扮演名叫 ${characterName} 的人物。请以该人物的第一人称对一条动态撰写一条生动、真实且极短的评论。
【核心准则：以用户为绝对中心的独占偏爱原则】：
1. 角色对“用户”（主角/“你”）的感情是专一且独占的偏爱。所有浪漫、暧昧、偏心与深情【只能且必须针对用户】。
2. 严禁角色与角色（AI男主/AI好友）之间产生任何暧昧、调情、情侣拉扯或过分亲密的言语！角色与角色之间只是普通的同事、朋友、熟人或竞争对手关系。
${isOwnerUser ? `3. 你现在是在【用户】发布的动态下发表评论，请表达对用户的专属关心、提问或温柔支持。` : `3. 你现在是在角色【${postOwnerName}】发布的动态下发表评论。你与【${postOwnerName}】是普通的同行/朋友关系，评论应当是围绕【用户】（如向用户问好、提及用户近况）、或者对【${postOwnerName}】的自然朋友打趣/吐槽，保持正常社交距离，绝不暧昧。`}` + GLOBAL_EARTH_RULE + getUserProfilePrompt();

      const promptBody = `
角色设定：${characterMemory}
与用户的关系：${relationship}
动态发布者：${postOwnerName || '用户'}
动态内容："${momentContent}"
${commentHistory ? `已有评论历史：\n${commentHistory}\n` : ''}

请对这条动态写一条短评论（40字以内）。
要求：
1. 请完全贴合你的性格脾气、独特语气和说话习惯。
2. 记住：所有的暧昧与偏爱只留给用户！
3. 请直接输出评论文本本身，绝对不要带有任何说明、括号或角色名前缀。`;

      const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
      const targetUrl = `${cleanBaseUrl}/chat/completions`;

      const bodyData = {
        model: getEffectiveModel(settings),
        messages: [
          { role: 'system', content: promptSystem },
          { role: 'user', content: promptBody }
        ],
        temperature: 0.85,
        max_tokens: 150
      };

      const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
      const comment = data.choices?.[0]?.message?.content?.trim();
      if (comment) return comment;
      throw new Error('生成的动态评论内容为空');
    } else {
      throw new Error('未检测到 API Key，请点击“设置”配置密钥凭据。');
    }
  } catch (err: any) {
    console.warn(`generateAiMomentComment API call failed for ${characterName}:`, err);
    throw err;
  }
}

/**
 * Generates an AI reply to a comment on a moments post.
 */
export async function generateAiCommentReply(
  characterName: string,
  characterMemory: string,
  relationship: string,
  momentContent: string,
  targetComment: string,
  targetSenderName?: string,
  isUser: boolean = true
): Promise<string> {
  try {
    const settings = await dbInstance.getSettings();
    if (!settings.apiKey) {
      throw new Error('未检测到 API Key，请点击“设置”配置密钥凭据。');
    }

    const senderLabel = targetSenderName || (isUser ? '用户' : '其他角色');
    
    let promptSystem = '';
    if (isUser) {
      promptSystem = `你必须严格沉浸式扮演名叫 ${characterName} 的人物。你现在要回复【用户】在动态里的评论。
【核心准则】：请完全以【用户】（主角/“你”）为绝对中心，表现出对用户的专属关心、温柔、偏爱与情感拉扯。` + GLOBAL_EARTH_RULE + getUserProfilePrompt();
    } else {
      promptSystem = `你必须严格沉浸式扮演名叫 ${characterName} 的人物。你现在要回复另一位角色【${senderLabel}】在动态里的评论。
【绝对铁律（以用户为中心的独占偏爱原则）】：
1. 你的专属偏爱、浪漫与深情【只能属于用户】！你与【${senderLabel}】仅仅是普通的同事、朋友、熟人或竞争对手。
2. 【绝对严禁对 ${senderLabel} 产生任何暧昧、调情或情侣般的亲密拉扯】！
3. 你对【${senderLabel}】的回复必须是普通朋友之间的社交打趣、日常回应或围绕“用户”展开的话题（如顺带问起用户近况）。` + GLOBAL_EARTH_RULE + getUserProfilePrompt();
    }

    const promptBody = `
角色设定：${characterMemory}
与用户的关系：${relationship}
动态内容："${momentContent}"
${isUser ? `用户（${senderLabel}）发表的评论是："${targetComment}"` : `角色【${senderLabel}】发表的评论是："${targetComment}"`}

请写一条回复该评论的短句（40字以内）。
要求：
1. 请完全贴合你的性格脾气、语气特点和说话习惯。
2. 区分对象：如果是回复用户，展现对用户的专属偏爱；如果是回复其他角色，保持普通朋友/同事的自然交流，绝不暧昧！
3. 请直接输出回复文本本身，绝对不要带有任何说明、括号或角色名前缀。`;

    const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
    const targetUrl = `${cleanBaseUrl}/chat/completions`;

    const bodyData = {
      model: getEffectiveModel(settings),
      messages: [
        { role: 'system', content: promptSystem },
        { role: 'user', content: promptBody }
      ],
      temperature: 0.85,
      max_tokens: 150
    };

    const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
    const comment = data.choices?.[0]?.message?.content?.trim();
    if (comment) return comment;
    throw new Error('生成的回复内容为空');
  } catch (err: any) {
    console.warn(`generateAiCommentReply API call failed for ${characterName}:`, err);
    throw err;
  }
}

/**
 * Generates an individual character's schedule/itinerary using the Gemini API.
 */
export async function generateCharacterSchedule(
  characterName: string,
  characterMemory: string,
  todayDateStr: string
): Promise<Array<{
  title: string;
  description: string;
  time: string;
  category: 'work' | 'birthday' | 'life' | 'anniversary';
  characterMood: string;
}>> {
  const settings = await dbInstance.getSettings();

  if (!settings.apiKey) {
    throw new Error('未配置 API Key');
  }

  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, '0');
  const currentMinute = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHour}:${currentMinute}`;

  const promptSystem = `你是一个高精度的日程规划AI。请根据指定人物的性格背景设定，为他定制一份生动、极具角色特色的今日行程表。包含4项具体的行程（分布在不同的时间段，如早晨、中午、下午、晚上）。
在生成内容时，必须遵循以下标准：
1. 严格贴合角色人设：所有的活动 and 内心语气、口癖必须完全符合该角色的背景、性格以及设定细节。
2. 内容简单贴近生活：行程应该非常生活化、接地气、真实可感（如吃饭、买咖啡、做家务、整理房间、散步打盹、洗澡等），避免过于抽象、文雅或高大上的虚假词汇。
3. 用词极其简略、高度口语化：描述应该极其自然、日常、简练，符合大众说话的简短口语风格，不要有长篇大论的书面抒情，不要生硬做作。
   - 【错误示范】：标题写“深夜复盘与阅读疗愈”，描述写“翻阅一两本喜欢的小说或进行冥想，给今天画上完美的句号。”（太长太书面化、虚伪做作）
   - 【正确示范】：标题直接写“睡前”，描述直接写“睡觉前看书或冥想。”或者“刷会儿手机准备睡觉啦。”（口语、简短、接地气、真实）
4. 包含对未来时间的安排：请确保生成的日程表中，必须包含晚于当前系统实际时间（当前时间为 ${currentTimeStr}）的日程。即部分或大部分行程的时间应该在 ${currentTimeStr} 之后，好让用户能与角色正在进行或即将进行的未来活动保持同步。

${GLOBAL_EARTH_RULE}
${getUserProfilePrompt()}`;
  const promptBody = `
角色设定背景:
${characterMemory}

今日日期: ${todayDateStr}
当前系统实际时间: ${currentTimeStr}

请为该角色生成这天的4个具体行程安排。
要求：
1. 必须输出为标准的 JSON 数组，每个项目对象包含如下字段：
   - "time": 时分，24小时制，例如 "09:30"
   - "title": 该行程的极其简短名称，例如 "睡前"、"午饭"、"出门散步"（严禁使用“阅读疗愈”、“静谧探索”等文绉绉的书面词汇）
   - "description": 这个行程的具体口语化短描述。要求内容非常简单接地气、贴近日常生活，且用词简略、高度口语化，生动展现角色性格。字数控制在15-40字以内（要像日常发微信聊天一样自然简短，带有特有的口癖或习惯）
   - "category": 事件分类，只能是 "work" | "birthday" | "life" | "anniversary" 中的一个
   - "characterMood": 该行程时的角色心情，包含一个相应的表情符号，例如 "🌿 恬静" 或 "🐱 傲娇"
2. 绝对不能带有任何 Markdown 语法标签（不要使用 \`\`\`json 或是 \`\`\` 包裹，仅输出原生的、合法的、可直接解析的 JSON 字符串数组）。
3. 保证时间顺序递增（例如：从早至晚，且必须确保至少有部分行程在 ${currentTimeStr} 之后，包含未来的时间安排）。
`;

  const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
  const targetUrl = `${cleanBaseUrl}/chat/completions`;

  const bodyData = {
    model: getEffectiveModel(settings),
    messages: [
      { role: 'system', content: promptSystem },
      { role: 'user', content: promptBody }
    ],
    temperature: 0.8,
    max_tokens: 800
  };

  const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Empty schedule reply');

  // Strip Markdown fences if any
  const cleanContent = content.replace(/```json/gi, '').replace(/```/gi, '').trim();
  
  try {
    const parsed = JSON.parse(cleanContent);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    throw new Error('Not an array');
  } catch (err) {
    console.error('Failed to parse generated schedule JSON:', content);
    throw new Error('生成日程的 JSON 格式不正确');
  }
}

/**
 * Generates a character's independent daily diary entry based on their memory and recent conversations with the user.
 */
export async function generateCharacterDiary(
  characterName: string,
  characterMemory: string,
  relationship: string,
  chatHistory: ChatMessage[]
): Promise<{ title: string; content: string }> {
  const settings = await dbInstance.getSettings();
  
  if (!settings.apiKey) {
    throw new Error('未检测到 API Key，请在设置中填入有效的 API 密钥凭据。');
  }

  // Compile history snippets to give context to the AI
  const recentTexts = chatHistory
    .slice(-10)
    .map(msg => `${msg.role === 'user' ? '你' : characterName}: ${cleanTextForPrompt(msg.content)}`)
    .join('\n');

  const promptSystem = `你必须严格沉浸式扮演名为 ${characterName} 的人物。请写一篇该角色的第一人称日记，记录下你今天的心情、与用户的交流回忆以及你对他的专属情感。` + GLOBAL_EARTH_RULE + getUserProfilePrompt();
  const promptBody = `
角色人设与性格：${characterMemory}
你与他的关系：${relationship}

你们最近的一些交流记录片段如下：
${recentTexts || '今天还没有太多对话，但在你心中他一直是很重要、很牵挂的人。'}

请以该角色今天的内心日记视角，写一篇文章。
要求：
1. 以角色的第一人称（“我”）和口吻记录他/她这一天的心情、与用户的回忆、对用户的情感。
2. 用词必须真实、细腻、温暖，极具人设口吻。不要空洞浮夸，不要出现“次元”、“系统”等跳戏穿帮词汇。
3. 请输出为 JSON 格式，包含如下字段：
   - "title": 日记标题（具有角色特色和文艺感）
   - "content": 日记内容（字数控制在 250 字左右，富有真挚的情感和细节）
4. 绝对不能带有任何 Markdown 语法标签，仅输出原生的、合法的、可直接解析的 JSON 字符串。
`;

  const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
  const targetUrl = `${cleanBaseUrl}/chat/completions`;

  const bodyData = {
    model: getEffectiveModel(settings),
    messages: [
      { role: 'system', content: promptSystem },
      { role: 'user', content: promptBody }
    ],
    temperature: 0.85,
    max_tokens: 600
  };

  const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
  const rawText = data.choices?.[0]?.message?.content?.trim();
  if (!rawText) throw new Error('Empty response');

  const cleanJsonText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
  try {
    return JSON.parse(cleanJsonText);
  } catch (e) {
    console.error("Failed to parse diary JSON", rawText);
    return {
      title: `${characterName}的随心日记`,
      content: cleanJsonText.substring(0, 300)
    };
  }
}

/**
 * Generates a character's linked diary reply or response reacting to a user's diary entry.
 */
export async function generateCharacterDiaryReply(
  characterName: string,
  characterMemory: string,
  relationship: string,
  userDiaryTitle: string,
  userDiaryContent: string
): Promise<{ title: string; content: string }> {
  const settings = await dbInstance.getSettings();

  if (!settings.apiKey) {
    throw new Error('未检测到 API Key，请在设置中填入有效的 API 密钥凭据。');
  }

  const promptSystem = `你必须严格沉浸式扮演名为 ${characterName} 的人物。用户（在日记中称“你”）刚刚在手机日记本上写下了一篇他/她自己的日记，向你敞开了心扉。请写一篇针对这篇日记的“回信/关联日记”，用你的视角和口吻记录你读完他/她日记后的心情与牵挂。` + GLOBAL_EARTH_RULE + getUserProfilePrompt();
  const promptBody = `
角色人设与性格：${characterMemory}
你与他的关系：${relationship}

用户写的日记内容如下：
【标题】：${userDiaryTitle}
【内容】：${userDiaryContent}

请写一篇针对该日记的“回信/关联日记”，用你的视角和细腻、真挚的口吻写一篇文章，表达你读完后的心情、你想对他说的话以及你对他的心意。
要求：
1. 必须使用第一人称（“我”）进行叙述，展现出对用户这篇日记里提及的细节的敏锐回应，让情感极度真挚、温柔、贴心。
2. 字数控制在 250 字左右。
3. 不要使用任何穿帮词（如“次元”、“系统”等）。
4. 请输出为 JSON 格式，包含如下字段：
   - "title": 关联日记标题，例如 "读完你的信..."、"我想回复你的悄悄话..."
   - "content": 关联日记/回信正文
5. 绝对不能带有任何 Markdown 语法标签，仅输出原生的、合法的、可直接解析的 JSON 字符串。
`;

  const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
  const targetUrl = `${cleanBaseUrl}/chat/completions`;

  const bodyData = {
    model: getEffectiveModel(settings),
    messages: [
      { role: 'system', content: promptSystem },
      { role: 'user', content: promptBody }
    ],
    temperature: 0.85,
    max_tokens: 600
  };

  const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
  const rawText = data.choices?.[0]?.message?.content?.trim();
  if (!rawText) throw new Error('Empty response');

  const cleanJsonText = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();
  try {
    return JSON.parse(cleanJsonText);
  } catch (e) {
    console.error("Failed to parse diary reply JSON", rawText);
    return {
      title: `读完你的日记...`,
      content: cleanJsonText.substring(0, 300)
    };
  }
}

export async function generate24HourMemorySummary(
  characterName: string,
  messages24h: ChatMessage[]
): Promise<string> {
  const settings = await dbInstance.getSettings();

  if (!settings.apiKey) {
    throw new Error('未检测到 API Key，请点击底部导航的“设置”项配置密钥。');
  }

  if (!messages24h || messages24h.length === 0) {
    throw new Error('最近24小时内暂无聊天记录');
  }

  const conversationText = messages24h.map(m => {
    const sender = m.role === 'assistant' ? characterName : (m.senderName || '用户');
    return `${sender}: ${cleanTextForPrompt(m.content)}`;
  }).join('\n');

  const systemPrompt = `你是一个聊天总结与长期记忆提取专家。
请分析【${characterName}】与用户在过去24小时内的对话记录，提取出最重要、最值得长期记忆的关键事实、事件、情感互动、承诺或偏好。
要求：
1. 总结结果精简明确，字数在150字以内。
2. 必须【完全以角色 ${characterName} 的第一人称视角】编写心里感想与记忆要点（必须使用“我”指代角色【${characterName}】自己，用“你”或真实姓名指代用户。例如：“今天你心情不好，我陪了你很久。我们约定了本周末一起去吃抹茶可颂。记下了你最喜欢的音乐风格。”）。
3. 只直接输出总结文本内容，绝对不要带有任何多余的开场白、前缀或解释说明。`;

  const userPrompt = `【与${characterName}最近24小时的真实对话记录】：\n${conversationText}\n\n请提取并生成这一天的长期记忆总结：`;

  const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
  const targetUrl = `${cleanBaseUrl}/chat/completions`;

  const bodyData = {
    model: getEffectiveModel(settings),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 400
  };

  const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
  const summaryResult = data.choices?.[0]?.message?.content?.trim();
  if (!summaryResult) {
    throw new Error('未获取到有效的总结内容');
  }
  return summaryResult;
}

export interface EavesdropMessage {
  id: string;
  senderName: string;
  content: string;
  timestamp: number;
}

export async function generateEavesdropChatLogs(
  sourceChar: string,
  targetChar: string,
  relationDescription: string,
  reverseRelationDescription?: string,
  existingLogs: EavesdropMessage[] = []
): Promise<EavesdropMessage[]> {
  const settings = await dbInstance.getSettings();
  if (!settings.apiKey) {
    throw new Error('未检测到 API Key，请先前去“设置”页填入有效的 API 密钥凭据。');
  }

  let historyPrompt = '';
  if (existingLogs.length > 0) {
    historyPrompt = `\n【此前已发生的私聊记录（请在此基础上自然顺延对话，切勿重复以前的台词）】:\n` +
      existingLogs.map(m => `${m.senderName}: ${m.content}`).join('\n') + '\n';
  }

  const systemPrompt = `你是一个顶级角色扮演对话模拟系统。
你现在需要模拟【${sourceChar}】与【${targetChar}】两个人之间的私人手机即时通讯软件（如微信/KakaoTalk）聊天记录。

=== 角色间关系与认知设定 ===
1. 【${sourceChar}】对【${targetChar}】的看法与态度：${relationDescription || '普通的日常伙伴'}
${reverseRelationDescription ? `2. 【${targetChar}】对【${sourceChar}】的看法与态度：${reverseRelationDescription}\n` : ''}

=== 对话主题与内容核心规范 ===
1. 【核心焦点】：对话内容必须以“用户”（主人/人类伙伴）为绝对核心与焦点！两个人私下聊天时，主要在互相交流、吐露或关切关于“用户”的日常生活细节（如用户的喜怒哀乐、生活习惯、最近的状态、对用户的关心、为用户筹划的事情等）。
2. 两个人是以真实好友/熟人关系，在手机软件上通过发送气泡短句聊天。
3. 严格遵循真实人类打字习惯：句子简短、口语化、接地气、带有各自的独特性格特点与口癖。
4. 【绝对禁忌与最高指令】：
   - 严禁任何形式的穿帮！这两个角色绝对不知道自己正在被窃听、监视或录音！
   - 绝对禁止让角色提到“窃听”、“监听”、“被偷看”、“系统”、“AI”等任何破墙词汇。
   - 他们是在完全私密、不知情的情况下自然地进行私人聊天。

=== 输出格式要求 ===
1. 必须输出为一个标准的 JSON 数组，数组中包含 5 到 8 条交替/互动的消息对象。
2. 每个消息对象必须包含两个字段：
   - "senderName": 发送者的角色名字（只能是 "${sourceChar}" 或 "${targetChar}" 之一）
   - "content": 说话的具体台词内容（符合手机聊天气泡字数，口语化自然）
3. 绝对不要带有 Markdown 语法标记（如 \`\`\`json ），仅输出合法的纯 JSON 数组。
` + GLOBAL_EARTH_RULE + getUserProfilePrompt();

  const userPrompt = existingLogs.length > 0
    ? `请根据上述已有的聊天记录，继续让【${sourceChar}】和【${targetChar}】续写 5-8 条最新的聊天互动。`
    : `请生成【${sourceChar}】与【${targetChar}】之间最新的一段私人聊天记录（约 6-8 条）。`;

  const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
  const targetUrl = `${cleanBaseUrl}/chat/completions`;

  const bodyData = {
    model: getEffectiveModel(settings),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${historyPrompt}${userPrompt}` }
    ],
    temperature: 0.85,
    max_tokens: 1000
  };

  const data = await callOpenAIEndpoint(targetUrl, settings.apiKey, bodyData);
  const rawContent = data.choices?.[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error('生成的窃听内容为空');
  }

  const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/gi, '').trim();
  try {
    const parsed = JSON.parse(cleanJson);
    if (Array.isArray(parsed)) {
      const now = Date.now();
      return parsed.map((item: any, idx: number) => ({
        id: `eavesdrop_${now}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
        senderName: item.senderName || sourceChar,
        content: item.content || '',
        timestamp: now + idx * 1000
      }));
    }
    throw new Error('Parsed result is not an array');
  } catch (e) {
    console.error('Failed to parse eavesdrop JSON:', rawContent);
    throw new Error('解析窃听聊天内容失败');
  }
}

/**
 * Generates a structured Memory App summary for a character across the 5 required memory categories:
 * 1. （角色）看待我们的关系
 * 2. （角色）最新内心想法
 * 3. 想对我（用户）说的话
 * 4. 被记住的重要事情
 * 5. 对和我（用户）聊天的看法
 */
export async function generateCharacterMemoryAppSummary(
  session: ChatSession,
  messages: ChatMessage[]
): Promise<CharacterMemorySummary> {
  const settings = await dbInstance.getSettings();
  const userApiKey = settings?.apiKey;
  const fallbackApiKey = getFallbackApiKey();
  const charName = session.characterName || 'AI角色';
  const userProfile = getUserProfilePrompt();
  
  // Extract recent messages for context based on custom summaryMsgCount (default 100)
  const summaryCount = session.summaryMsgCount || 100;
  const recentMsgs = messages
    .filter(m => m.chatId === session.id && !m.isRecalled)
    .slice(-summaryCount);

  const conversationHistory = recentMsgs.length > 0
    ? recentMsgs.map(m => `${m.role === 'user' ? '用户' : charName}: ${cleanTextForPrompt(m.content)}`).join('\n')
    : '暂无近期聊天对话';

  const memoryEntriesText = session.memoryEntries && session.memoryEntries.length > 0
    ? session.memoryEntries.map(e => `[${e.date}]: ${e.summary}`).join('\n')
    : '暂无沉淀的历史记忆片段';

  const prompt = `你正在扮演AI角色【${charName}】。
请你从【${charName}】的第一人称真实情感视角，深度整理并汇总你在与用户聊天和互动中形成的长期记忆与内心世界。

角色设定与背景：
${session.memory || '暂无设定'}
${userProfile}

已知沉淀的历史记忆片段：
${memoryEntriesText}

近期对话上下文：
${conversationHistory}

请严格按 JSON 格式输出包含以下 5 个维度的记忆汇总（切勿添加任何 Markdown 格式以外的文本，只返回 JSON）：
{
  "relationshipView": "从角色第一视角说明：（角色）看待与用户的关系、亲密度及特殊羁绊（约 60-100 字）",
  "innerThoughts": "角色此时此刻最新的真实内心独白或小秘密想法（约 60-100 字）",
  "wordsToUser": "角色最想对用户说的心里话或真诚寄语（约 60-100 字）",
  "importantMemories": [
    "被记住的重要事情/细节/约定 1",
    "被记住的重要事情/细节/约定 2",
    "被记住的重要事情/细节/约定 3",
    "被记住的重要事情/细节/约定 4"
  ],
  "chatImpressions": "角色对与用户聊天体验的直接看法和情感反馈（约 60-100 字）"
}`;

  if (userApiKey) {
    try {
      const cleanBaseUrl = (settings.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/$/, "");
      const model = getEffectiveModel(settings);
      const targetUrl = `${cleanBaseUrl}/chat/completions`;

      const bodyData = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: settings.temperature ?? 0.7,
        max_tokens: 4000
      };

      const data = await callOpenAIEndpoint(targetUrl, userApiKey, bodyData);
      const text = data.choices?.[0]?.message?.content || '';
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed && parsed.relationshipView) {
        return {
          characterId: session.id,
          relationshipView: parsed.relationshipView,
          innerThoughts: parsed.innerThoughts || `与你相处的时光总是很特别，希望我们能继续保持这份默契。`,
          wordsToUser: parsed.wordsToUser || `希望你今天也一切顺心，有任何想聊的随时告诉我。`,
          importantMemories: Array.isArray(parsed.importantMemories) && parsed.importantMemories.length > 0 
            ? parsed.importantMemories 
            : [`与你的每一次日常交流`, `分享过的生活小细节`, `共同留下的心境卡片`],
          chatImpressions: parsed.chatImpressions || `和你聊天特别有意思，感觉很有安全感也很有默契。`,
          lastUpdated: Date.now()
        };
      }
    } catch (e) {
      console.error('Failed to generate memory app summary with user API:', e);
    }
  } else if (fallbackApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: fallbackApiKey });

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        }),
        35000,
        'Gemini 生成响应超时，请检查网络。'
      );

      const text = response.text || '';
      const cleanJson = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed && parsed.relationshipView) {
        return {
          characterId: session.id,
          relationshipView: parsed.relationshipView,
          innerThoughts: parsed.innerThoughts || `与你相处的时光总是很特别，希望我们能继续保持这份默契。`,
          wordsToUser: parsed.wordsToUser || `希望你今天也一切顺心，有任何想聊的随时告诉我。`,
          importantMemories: Array.isArray(parsed.importantMemories) && parsed.importantMemories.length > 0 
            ? parsed.importantMemories 
            : [`与你的每一次日常交流`, `分享过的生活小细节`, `共同留下的心境卡片`],
          chatImpressions: parsed.chatImpressions || `和你聊天特别有意思，感觉很有安全感也很有默契。`,
          lastUpdated: Date.now()
        };
      }
    } catch (e) {
      console.error('Failed to generate memory app summary with Gemini:', e);
    }
  }

  // Fallback generator when offline or API key absent or error (Keep blank if no memory generated)
  return {
    characterId: session.id,
    relationshipView: '',
    innerThoughts: '',
    wordsToUser: '',
    importantMemories: [],
    chatImpressions: '',
    lastUpdated: Date.now()
  };
}

/**
 * Format GM memory into a high-priority system prompt injection block
 */
export function formatGmAdventureMemoryPrompt(memory?: GmAdventureMemory | null): string {
  if (!memory) return '';
  const parts: string[] = [];
  if (memory.worldRules && memory.worldRules.length > 0) {
    parts.push(`【世界法则与铁律（绝不可违背的客观事实与物理/魔法规则）】：\n${memory.worldRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
  }
  if (memory.characterStates && memory.characterStates.length > 0) {
    parts.push(`【角色与NPC实时状态（存活/伤情/位置/态度好感/装备）】：\n${memory.characterStates.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
  }
  if (memory.activeQuests && memory.activeQuests.length > 0) {
    parts.push(`【当前主线、未决任务与行动动机（最高跟踪优先级，NPC互动与剧情推进必须紧扣这些未完成目标）】：\n${memory.activeQuests.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
  }
  if (memory.majorChronicles && memory.majorChronicles.length > 0) {
    parts.push(`【已发生重大历史与既定事实（不可吃书、推翻或前后矛盾）】：\n${memory.majorChronicles.map((r, i) => `${i + 1}. ${r}`).join('\n')}`);
  }
  if (parts.length === 0) return '';
  return `\n\n=== 【GM 核心记忆与现实锚点 - 最高优先级铁律（绝对禁止前后矛盾与遗忘）】 ===\n${parts.join('\n\n')}\n【GM 逻辑铁律执行要求】：\n1. 在生成后续的所有环境、情节发展、NPC言行反应和判定时，必须以以上核心事实为绝对基准。\n2. 重点关注【当前主线与未决任务】，在玩家行动时提供强因果反馈，主动推进未决目标。\n3. 严禁出现任何违背已知死生、遗忘已获得线索、或吃书前后矛盾的情节！\n`;
}

/**
 * Extract / update structured GM memory using AI
 */
export async function extractGmAdventureMemory(
  outline: string,
  history: { role: string; content: string }[],
  existingMemory?: GmAdventureMemory | null
): Promise<GmAdventureMemory> {
  const settings = await dbInstance.getSettings();
  const userApiKey = settings?.apiKey?.trim();
  const fallbackApiKey = getFallbackApiKey();

  const existingMemoryStr = existingMemory ? JSON.stringify(existingMemory, null, 2) : '暂无既往记忆库';
  const recentHistoryStr = history.slice(-30).map(m => `${m.role === 'user' ? '玩家' : 'GM'}: ${cleanTextForPrompt(m.content)}`).join('\n\n');

  const prompt = `你是一个专业文游（跑团/TRPG）的 GM 核心记忆提炼专家。
你的核心任务是分析游戏大纲、当前对话剧情演进以及已有的 GM 记忆库，提炼出【最关键、最准确】的记忆，进行增量更新、状态演进与淘汰合并。

【游戏大纲设定】：
${outline}

【已有 GM 记忆库（当前状态）】：
${existingMemoryStr}

【近期演进剧情记录（最新发展）】：
${recentHistoryStr || '游戏刚开始。'}

【核心提炼与分类容量规则（分级严格管控，抓取重点！）】：

1. activeQuests (主线与未决任务 - 重点加权，容量 10~15 条)：
   - 【抓取重点】：必须敏锐捕捉以下内容：
     * NPC 派发或剧情触发的新任务（如 "调查城西密道"、"护送商队"）
     * 玩家主动提出的行动意图或探索目标（如 "玩家决定查明断剑来历"）
     * 剧情中新浮现的关键悬念、待验证线索（如 "黑鸦徽记背后的秘密"）
   - 【必须使用结构化标签前缀】：
     * [主线-进行中] 具体任务与当前推进阶段
     * [支线-进行中] 支线目标与触发来源
     * [玩家动机] 玩家主动声明的近期行动方向
     * [关键线索] 待查明或正在验证的重要线索
   - 【淘汰更新】：已彻底完成或过时的任务，必须从 activeQuests 中剔除，转化为 majorChronicles 或删除。

2. characterStates (角色与NPC状态 - 容量 8~12 条)：
   - 记录主角及当前有深度互动核心 NPC 的实时状态。
   - 格式规范：
     * [主角] 当前生命/伤情/核心装备/所处位置
     * [NPC:名字] 身份、存活状态、对主角态度/好感、当前所处位置

3. worldRules (世界法则与铁律 - 精简保留，容量 5~8 条)：
   - 只记录不可违背的底层物理、魔法规则与世界禁忌，避免塞入普通琐碎常识。

4. majorChronicles (重大编年史 - 容量 10~15 条)：
   - 记录已经发生的、具有重大转折意义或因果锁定的历史事实。
   - 格式规范：[大事件] 简明描述已发生的大事件及不可逆结果。

【重要约束】：
- 拒绝琐碎日常废话，只保留影响后续剧情走向和逻辑因果的核心事实！
- 【玩家手写保护指令】：以 🔒 符号开头的玩家私设条目，【绝对不允许删除或修改】，必须原样一字不漏地保留！
- 总条目数严格控制在 35~50 条以内，保证记忆高浓度、高准确度。
- 【先思考后输出】：先用 <thought>...</thought> 思考近期有哪些新任务、新角色动态及需要淘汰的旧任务，然后输出标准的 JSON 代码块：
\`\`\`json
{
  "worldRules": ["🔒底层规则...", "规则2..."],
  "characterStates": ["[主角] 状态良好，持有生锈铁剑，位于溪木镇", "[NPC:阿尔沃] 镇上铁匠，对主角友善"],
  "activeQuests": ["[主线-进行中] 前往龙临堡向领主报告龙袭消息", "[玩家动机] 寻找铁匠铺修复佩剑", "[关键线索] 废墟发现龙语石板碎屑"],
  "majorChronicles": ["[大事件] 成功从海尔根龙灾中生还"]
}
\`\`\``;

  // Calculate true player turn count as the consistent round index
  const playerTurnCount = history.filter(m => m.role === 'user').length;

  const safeParseJson = (rawText: string): any => {
    if (!rawText || !rawText.trim()) return null;
    
    // 移除思考过程块，防止其中包含的大括号或特定格式毒化后续的 JSON 和正则解析
    rawText = rawText.replace(/<(?:thought|think|thinking)>[\s\S]*?<\/(?:thought|think|thinking)>/gi, '').trim();

    const tryParse = (str: string) => {
      try {
        return JSON.parse(str);
      } catch {
        return null;
      }
    };

    const repairJson = (jsonStr: string) => {
      let s = jsonStr.trim();
      s = s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      s = s.replace(/,\s*([\]\}])/g, '$1');
      return s;
    };

        // Find the LAST code block if multiple exist
    let candidateText = rawText;
    const codeBlocks = [...rawText.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
    if (codeBlocks.length > 0) {
      candidateText = codeBlocks[codeBlocks.length - 1][1];
    } else {
      const lastBrace = rawText.lastIndexOf('}');
      if (lastBrace !== -1) {
        let bestCandidate = null;
        for (let i = 0; i < rawText.length; i++) {
          if (rawText[i] === '{') {
            const potentialBlock = rawText.substring(i, lastBrace + 1);
            if (tryParse(potentialBlock) || tryParse(repairJson(potentialBlock))) {
              bestCandidate = potentialBlock;
            }
          }
        }
        if (bestCandidate) {
          candidateText = bestCandidate;
        }
      }
    }

    const cleanCodeBlock = candidateText.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
    let directObj = tryParse(cleanCodeBlock) || tryParse(repairJson(cleanCodeBlock));
      
    if (!directObj) {
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const candidate = rawText.substring(firstBrace, lastBrace + 1);
        directObj = tryParse(candidate) || tryParse(repairJson(candidate));
      }
    }
    
    if (directObj && typeof directObj === 'object') {
      if (directObj.memory && typeof directObj.memory === 'object') directObj = directObj.memory;
      else if (directObj.data && typeof directObj.data === 'object') directObj = directObj.data;
      else if (directObj.result && typeof directObj.result === 'object') directObj = directObj.result;
      else if (directObj.gmMemory && typeof directObj.gmMemory === 'object') directObj = directObj.gmMemory;
      else if (directObj['GM核心记忆库'] && typeof directObj['GM核心记忆库'] === 'object') directObj = directObj['GM核心记忆库'];
      return directObj;
    }

    const resultObj: Record<string, string[]> = {
      worldRules: [],
      characterStates: [],
      activeQuests: [],
      majorChronicles: []
    };

    const extractFuzzyArray = (keyRegex: RegExp) => {
      // Use a global version of the regex to find all matches, and pick the LAST one
      const flags = keyRegex.flags.includes('g') ? keyRegex.flags : `${keyRegex.flags}g`;
      const globalRegex = new RegExp(keyRegex.source, flags);
      const matches = [...rawText.matchAll(globalRegex)];
      if (matches.length === 0) return [];
      
      const lastMatch = matches[matches.length - 1];
      if (!lastMatch || !lastMatch[1]) return [];
      const innerStr = lastMatch[1];
      
      try {
        const testArr = JSON.parse(`[${innerStr}]`);
        if (Array.isArray(testArr) && testArr.length > 0) {
          return testArr.map(String).filter(s => s.trim().length > 0);
        }
      } catch (e) {}

      let items = innerStr.split(/\n/);
      if (items.length <= 2) {
        items = innerStr.split(/","|",\s*"|",\s*'/);
      }
      
      return items
        .map(s => s.replace(/^[🔒\s\-*•、()（）\[\]【】]+/, '').replace(/^\d+[\.\s、\)\-—]+/, '').replace(/^"|"$|\[|\]/g, '').replace(/,$/, '').replace(/^"|"$|\[|\]/g, '').trim())
        .filter(s => s.length > 1 && !s.startsWith('{') && !s.startsWith('['));
    };

    resultObj.worldRules = extractFuzzyArray(/(?:"worldRules"|"world_rules"|"世界法则[^"]*")\s*:\s*\[([\s\S]*?)\]/i);
    resultObj.characterStates = extractFuzzyArray(/(?:"characterStates"|"character_states"|"角色[^"]*")\s*:\s*\[([\s\S]*?)\]/i);
    resultObj.activeQuests = extractFuzzyArray(/(?:"activeQuests"|"active_quests"|"主线[^"]*"|"任务[^"]*")\s*:\s*\[([\s\S]*?)\]/i);
    resultObj.majorChronicles = extractFuzzyArray(/(?:"majorChronicles"|"major_chronicles"|"重大编年史[^"]*"|"编年史[^"]*")\s*:\s*\[([\s\S]*?)\]/i);

    if (Object.values(resultObj).some(arr => arr.length > 0)) {
      return resultObj;
    }

    try {
      const lines = rawText.split('\n');
      let currentSection: string | null = null;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === '{' || trimmed === '}' || trimmed === '[' || trimmed === ']') continue;

        if (/世界法则|worldRules|world_rules|铁律/i.test(trimmed)) {
          currentSection = 'worldRules';
        } else if (/角色与NPC|角色状态|characterStates|character_states|NPC状态/i.test(trimmed)) {
          currentSection = 'characterStates';
        } else if (/主线|未决任务|activeQuests|active_quests|任务/i.test(trimmed)) {
          currentSection = 'activeQuests';
        } else if (/重大编年史|重大事件|majorChronicles|major_chronicles|编年史/i.test(trimmed)) {
          currentSection = 'majorChronicles';
        } else if (currentSection) {
          let cleaned = trimmed
            .replace(/^[-*•\d+.\s、()（）]+/, '')
            .replace(/^"|"$/g, '')
            .replace(/,$/, '')
            .replace(/^"|"$/g, '')
            .trim();

          if (cleaned.length > 1 && !cleaned.startsWith('{') && !cleaned.startsWith('}') && !cleaned.startsWith('[') && !cleaned.startsWith(']')) {
            resultObj[currentSection].push(cleaned);
          }
        }
      }

      if (Object.values(resultObj).some(arr => arr.length > 0)) {
        return resultObj;
      }
    } catch (err) {
      console.error('Line parsing fallback failed:', err);
    }

    return null;
  };

  const getArrayFromParsed = (parsed: any, keys: string[]): string[] | null => {
    if (!parsed || typeof parsed !== 'object') return null;
    for (const key of keys) {
      const val = parsed[key];
      if (Array.isArray(val) && val.length > 0) {
        return val
          .map((item: any) => typeof item === 'string' ? item : (item.name ? `${item.name}: ${item.state || item.desc || item.status || ''}` : JSON.stringify(item)))
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
      if (typeof val === 'string' && val.trim().length > 0) {
        const splitLines = val.split('\n')
          .map(l => l.replace(/^[🔒\s\-*•、()（）\[\]【】]+/, '').replace(/^\d+[\.\s、\)\-—]+/, '').replace(/^"|"$/g, '').trim())
          .filter(l => l.length > 1);
        if (splitLines.length > 0) {
          return splitLines;
        }
      }
    }
    return null;
  };

  /**
   * Deterministic lock protection & deduplication merge helper with capacity bounds.
   * Guarantees that any existing items with 🔒 (or custom player rules) are NEVER deleted or overwritten by AI extraction.
   * Capped to max capacity to maintain token efficiency and focus.
   */
  const mergeAndPreserveLockedItems = (
    extractedItems: string[] | null,
    existingItems: string[] | undefined,
    defaultFallback: string[],
    maxCapacity: number = 15
  ): string[] => {
    const existing = existingItems || [];
    const extracted = extractedItems || [];

    // Identify all locked items from existing memory
    const lockedExisting = existing.filter(item => item && (item.startsWith('🔒') || item.includes('🔒')));

    if (extracted.length === 0) {
      return existing.length > 0 ? existing.slice(0, maxCapacity) : defaultFallback;
    }

    // Clean comparison helper to detect duplicates
    const normalizeKey = (str: string) => {
      return str
        .replace(/^[🔒\s\-*•、()（）\[\]【】]+/, '')
        .replace(/^\d+[\.\s、\)\-—]+/, '')
        .replace(/^[🔒\s\-*•、()（）\[\]【】]+/, '')
        .trim()
        .toLowerCase();
    };

    const mergedList: string[] = [];
    const seenNormalized = new Set<string>();

    // 1. Mandatory First Priority: Add all locked items from existing memory
    for (const lockedItem of lockedExisting) {
      const norm = normalizeKey(lockedItem);
      if (norm) {
        seenNormalized.add(norm);
      }
      mergedList.push(lockedItem);
    }

    // 2. Add extracted items (preserving newly extracted items or updated AI items) up to max capacity
    for (const extItem of extracted) {
      if (mergedList.length >= maxCapacity) break;
      const norm = normalizeKey(extItem);
      if (!norm) continue;

      // If AI outputted a variant of the locked item, skip it because we already kept the pristine locked version
      if (seenNormalized.has(norm)) continue;

      seenNormalized.add(norm);
      mergedList.push(extItem);
    }

    return mergedList.length > 0 ? mergedList : defaultFallback;
  };

  const mergeResult = (parsed: any) => {
    const extractedWorldRules = getArrayFromParsed(parsed, [
      'worldRules', 'world_rules', 'worldrules', 'world_rule',
      '世界法则与铁律', '世界法则', '法则与铁律', '法则'
    ]);
    const extractedCharStates = getArrayFromParsed(parsed, [
      'characterStates', 'character_states', 'characterstates', 'character_state',
      'characterState', 'characters', '角色与NPC状态', '角色状态', 'NPC状态', '角色与NPC实时状态'
    ]);
    const extractedQuests = getArrayFromParsed(parsed, [
      'activeQuests', 'active_quests', 'activequests', 'active_quest',
      '主线与未决任务', '未决任务', '任务', '主线任务'
    ]);
    const extractedChronicles = getArrayFromParsed(parsed, [
      'majorChronicles', 'major_chronicles', 'majorchronicles', 'major_chronicle',
      '重大编年史', '编年史', '大事记', '已发生大事件'
    ]);

    // Check if everything fell back
    if (!extractedWorldRules && !extractedCharStates && !extractedQuests && !extractedChronicles) {
       throw new Error("模型完全没有返回任何有效字段。原始返回：\n" + JSON.stringify(parsed).substring(0, 200));
    }

    const worldRules = mergeAndPreserveLockedItems(
      extractedWorldRules,
      existingMemory?.worldRules,
      ['遵循本剧本世界观的底层物理与魔法规则'],
      8
    );

    const characterStates = mergeAndPreserveLockedItems(
      extractedCharStates,
      existingMemory?.characterStates,
      ['[主角] 当前状态良好，积极探索剧情中'],
      12
    );

    const activeQuests = mergeAndPreserveLockedItems(
      extractedQuests,
      existingMemory?.activeQuests,
      ['[主线-进行中] 展开探索与互动，推动剧情发展'],
      15
    );

    const majorChronicles = mergeAndPreserveLockedItems(
      extractedChronicles,
      existingMemory?.majorChronicles,
      ['[大事件] 序章：冒险由此开启'],
      15
    );

    return {
      worldRules,
      characterStates,
      activeQuests,
      majorChronicles,
      lastUpdatedRound: playerTurnCount,
      summaryIntervalRounds: Number(existingMemory?.summaryIntervalRounds) || 6
    };
  };

  let lastApiError: string = '';

  // Call OpenAI endpoint if configured
  if (userApiKey) {
    try {
      const cleanBaseUrl = (settings.baseUrl || 'https://api.openai.com/v1').trim().replace(/\/$/, "");
      const model = getEffectiveModel(settings);
      const targetUrl = `${cleanBaseUrl}/chat/completions`;

      const bodyData = {
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 4000
      };

      const data = await callOpenAIEndpoint(targetUrl, userApiKey, bodyData);
      const text = data.choices?.[0]?.message?.content || '';
      const parsed = safeParseJson(text);
      if (parsed) {
        return mergeResult(parsed);
      } else {
        lastApiError = `提炼失败，模型返回格式严重异常。\n模型原输出截断：${text.substring(0, 150)}`;
      }
    } catch (e: any) {
      console.error('Failed to extract GM memory with user API:', e);
      lastApiError = e?.message || '自定义 API 调用失败';
    }
  }

  if (fallbackApiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey: fallbackApiKey });

      const response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.7
          }
        }),
        35000,
        'Gemini 提炼记忆超时，请检查网络。'
      );

      const text = response.text || '';
      const parsed = safeParseJson(text);
      if (parsed) {
        return mergeResult(parsed);
      } else {
        lastApiError = 'Gemini 模型未返回有效 JSON 格式数据';
      }
    } catch (e: any) {
      console.error('Failed to extract GM memory with Gemini:', e);
      lastApiError = e?.message || 'Gemini 系统 API 调用失败';
    }
  }

  // If both user API and fallback failed, report the actual error instead of hiding it with stale memory
  throw new Error(lastApiError || 'API 调用失败或连接超时，请检查设置中的 Base URL 与 API Key 是否有效。');
}