/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ChatTheme {
  id: string;
  name: string;
  description: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  headerBg: string;
  headerBorder: string;
  headerText: string;
  feedBg: string;
  userBubbleBg: string;
  userBubbleText: string;
  userBubbleBorder: string;
  aiBubbleBg: string;
  aiBubbleText: string;
  aiBubbleBorder: string;
  footerBg: string;
  footerBorder: string;
  footerText: string;
  footerActive: string;
  panelBg: string;
  panelText: string;
  cardBg: string;
  cardBorder: string;
  accentText: string;
  accentLight: string;
  isCustom?: boolean;
}

export const CHAT_THEME_PRESETS: ChatTheme[] = [
  {
    id: 'default_warm',
    name: '经典暖调',
    description: '明亮舒适的经典暖黄与清爽蓝底',
    primary: '#FEE500',
    primaryHover: '#E5CE00',
    primaryText: '#3C1E1E',
    headerBg: '#FFFFFF',
    headerBorder: '#F3F4F6',
    headerText: '#111827',
    feedBg: '#BACEE0',
    userBubbleBg: '#FEE500',
    userBubbleText: '#3C1E1E',
    userBubbleBorder: '#FEE500',
    aiBubbleBg: '#FFFFFF',
    aiBubbleText: '#1F2937',
    aiBubbleBorder: '#F3F4F6',
    footerBg: '#FFFFFF',
    footerBorder: '#F3F4F6',
    footerText: '#9CA3AF',
    footerActive: '#111827',
    panelBg: '#F9FAFB',
    panelText: '#1F2937',
    cardBg: '#FFFFFF',
    cardBorder: '#F3F4F6',
    accentText: '#B45309',
    accentLight: 'rgba(254, 229, 0, 0.2)'
  },
  {
    id: 'serene_blue',
    name: '雾霾蓝',
    description: '宁静沉着的雾霭海蓝',
    primary: '#5980A6',
    primaryHover: '#4A6D8F',
    primaryText: '#FAFBFC',
    headerBg: '#B9CDE1',
    headerBorder: '#A2BDD7',
    headerText: '#121A21',
    feedBg: '#DCE7F0',
    userBubbleBg: '#5980A6',
    userBubbleText: '#FAFBFC',
    userBubbleBorder: '#5980A6',
    aiBubbleBg: '#FAFBFC',
    aiBubbleText: '#243342',
    aiBubbleBorder: '#B9CDE1',
    footerBg: '#FAFBFC',
    footerBorder: '#B9CDE1',
    footerText: '#476685',
    footerActive: '#5980A6',
    panelBg: '#EEF3F8',
    panelText: '#243342',
    cardBg: '#FAFBFC',
    cardBorder: '#B9CDE1',
    accentText: '#3B5B7B',
    accentLight: 'rgba(89, 128, 166, 0.16)'
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
    feedBg: '#E6EBE0',
    userBubbleBg: '#788A66',
    userBubbleText: '#FAFCF8',
    userBubbleBorder: '#788A66',
    aiBubbleBg: '#FAFCF8',
    aiBubbleText: '#2B3122',
    aiBubbleBorder: '#D0D9C7',
    footerBg: '#FAFCF8',
    footerBorder: '#D0D9C7',
    footerText: '#5C6B4D',
    footerActive: '#788A66',
    panelBg: '#F4F6F1',
    panelText: '#2B3122',
    cardBg: '#FAFCF8',
    cardBorder: '#D0D9C7',
    accentText: '#5C6B4D',
    accentLight: 'rgba(120, 138, 102, 0.16)'
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
    feedBg: '#F8E8EE',
    userBubbleBg: '#E17899',
    userBubbleText: '#FFFFFF',
    userBubbleBorder: '#E17899',
    aiBubbleBg: '#FFFFFF',
    aiBubbleText: '#2D141C',
    aiBubbleBorder: '#F2D0DB',
    footerBg: '#FDF9FA',
    footerBorder: '#F2D0DB',
    footerText: '#B84E70',
    footerActive: '#E17899',
    panelBg: '#FCF6F8',
    panelText: '#2D141C',
    cardBg: '#FFFFFF',
    cardBorder: '#F2D0DB',
    accentText: '#B84E70',
    accentLight: 'rgba(225, 120, 153, 0.16)'
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
    feedBg: '#EAE6F4',
    userBubbleBg: '#8E7CC3',
    userBubbleText: '#FFFFFF',
    userBubbleBorder: '#8E7CC3',
    aiBubbleBg: '#FFFFFF',
    aiBubbleText: '#1E172E',
    aiBubbleBorder: '#DDD7EC',
    footerBg: '#FAF9FC',
    footerBorder: '#DDD7EC',
    footerText: '#6C59A0',
    footerActive: '#8E7CC3',
    panelBg: '#F7F5FA',
    panelText: '#1E172E',
    cardBg: '#FFFFFF',
    cardBorder: '#DDD7EC',
    accentText: '#6C59A0',
    accentLight: 'rgba(142, 124, 195, 0.16)'
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
    feedBg: '#F7EDE6',
    userBubbleBg: '#D97736',
    userBubbleText: '#FFFFFF',
    userBubbleBorder: '#D97736',
    aiBubbleBg: '#FFFFFF',
    aiBubbleText: '#2E180B',
    aiBubbleBorder: '#EED6C3',
    footerBg: '#FCFAF7',
    footerBorder: '#EED6C3',
    footerText: '#AA541C',
    footerActive: '#D97736',
    panelBg: '#FAF6F2',
    panelText: '#2E180B',
    cardBg: '#FFFFFF',
    cardBorder: '#EED6C3',
    accentText: '#AA541C',
    accentLight: 'rgba(217, 119, 54, 0.16)'
  },
  {
    id: 'default_indigo',
    name: '极光青蓝',
    description: '科技感与现代活力的深邃蓝',
    primary: '#4F46E5',
    primaryHover: '#4338CA',
    primaryText: '#FFFFFF',
    headerBg: '#C7D2FE',
    headerBorder: '#A5B4FC',
    headerText: '#1E1B4B',
    feedBg: '#EEF2FF',
    userBubbleBg: '#4F46E5',
    userBubbleText: '#FFFFFF',
    userBubbleBorder: '#4F46E5',
    aiBubbleBg: '#FFFFFF',
    aiBubbleText: '#1F2937',
    aiBubbleBorder: '#E0E7FF',
    footerBg: '#FFFFFF',
    footerBorder: '#E0E7FF',
    footerText: '#6366F1',
    footerActive: '#4F46E5',
    panelBg: '#F8FAFC',
    panelText: '#1F2937',
    cardBg: '#FFFFFF',
    cardBorder: '#E0E7FF',
    accentText: '#4F46E5',
    accentLight: 'rgba(79, 70, 229, 0.16)'
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
    feedBg: '#E2E8F0',
    userBubbleBg: '#475569',
    userBubbleText: '#FFFFFF',
    userBubbleBorder: '#475569',
    aiBubbleBg: '#FFFFFF',
    aiBubbleText: '#0F172A',
    aiBubbleBorder: '#E2E8F0',
    footerBg: '#FFFFFF',
    footerBorder: '#E2E8F0',
    footerText: '#64748B',
    footerActive: '#475569',
    panelBg: '#F8FAFC',
    panelText: '#0F172A',
    cardBg: '#FFFFFF',
    cardBorder: '#E2E8F0',
    accentText: '#334155',
    accentLight: 'rgba(71, 85, 105, 0.16)'
  }
];

export function generateChatThemeFromHex(hex: string): ChatTheme {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) || 79;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 70;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 229;

  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  const primaryText = lum > 0.65 ? '#1F2937' : '#FFFFFF';

  const hr = Math.round(r + (255 - r) * 0.45);
  const hg = Math.round(g + (255 - g) * 0.45);
  const hb = Math.round(b + (255 - b) * 0.45);
  const headerBg = `rgb(${hr}, ${hg}, ${hb})`;

  const hbr = Math.round(r + (255 - r) * 0.3);
  const hbg = Math.round(g + (255 - g) * 0.3);
  const hbb = Math.round(b + (255 - b) * 0.3);
  const headerBorder = `rgb(${hbr}, ${hbg}, ${hbb})`;

  const fbr = Math.round(r + (255 - r) * 0.88);
  const fbg = Math.round(g + (255 - g) * 0.88);
  const fbb = Math.round(b + (255 - b) * 0.88);
  const feedBg = `rgb(${fbr}, ${fbg}, ${fbb})`;

  const mbr = Math.round(r + (255 - r) * 0.95);
  const mbg = Math.round(g + (255 - g) * 0.95);
  const mbb = Math.round(b + (255 - b) * 0.95);
  const panelBg = `rgb(${mbr}, ${mbg}, ${mbb})`;

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
    feedBg,
    userBubbleBg: `#${cleanHex}`,
    userBubbleText: primaryText,
    userBubbleBorder: `#${cleanHex}`,
    aiBubbleBg: '#FFFFFF',
    aiBubbleText: '#1F2937',
    aiBubbleBorder: cardBorder,
    footerBg: '#FFFFFF',
    footerBorder: cardBorder,
    footerText: '#6B7280',
    footerActive: `#${cleanHex}`,
    panelBg,
    panelText: '#1F2937',
    cardBg,
    cardBorder,
    accentText: `#${cleanHex}`,
    accentLight: `rgba(${r}, ${g}, ${b}, 0.16)`,
    isCustom: true
  };
}

export function generateChatCssFromTheme(theme: ChatTheme): string {
  return `
:root {
  --theme-main-bg: ${theme.panelBg};
  --theme-text-color: ${theme.panelText};
  --theme-accent-color: ${theme.primary};
  --theme-accent-text: ${theme.primaryText};
  
  --theme-header-bg: ${theme.headerBg};
  --theme-header-border: ${theme.headerBorder};
  --theme-header-text: ${theme.headerText};

  --theme-footer-bg: ${theme.footerBg};
  --theme-footer-border: ${theme.footerBorder};
  --theme-footer-text: ${theme.footerText};
  --theme-footer-active: ${theme.footerActive};

  --theme-feed-bg: ${theme.feedBg};
  --theme-user-bubble-bg: ${theme.userBubbleBg};
  --theme-user-bubble-text: ${theme.userBubbleText};
  --theme-user-bubble-border: ${theme.userBubbleBorder};

  --theme-ai-bubble-bg: ${theme.aiBubbleBg};
  --theme-ai-bubble-text: ${theme.aiBubbleText};
  --theme-ai-bubble-border: ${theme.aiBubbleBorder};

  --theme-panel-bg: ${theme.panelBg};
  --theme-panel-text: ${theme.panelText};
  --theme-card-bg: ${theme.cardBg};
  --theme-card-border: ${theme.cardBorder};

  --theme-header-btn-bg: rgba(0, 0, 0, 0.05);
  --theme-header-btn-text: ${theme.headerText};
  --theme-header-btn-hover: rgba(0, 0, 0, 0.09);
  --theme-button-bg: rgba(255, 255, 255, 0.8);
  --theme-button-border: ${theme.headerBorder};
  --theme-button-text: ${theme.headerText};
}

.tab-header {
  background-color: var(--theme-header-bg) !important;
  border-bottom-color: var(--theme-header-border) !important;
}
.tab-header span {
  color: var(--theme-header-text) !important;
}
.tab-header button {
  background-color: var(--theme-header-btn-bg) !important;
  color: var(--theme-header-btn-text) !important;
}
.tab-header button:hover {
  background-color: var(--theme-header-btn-hover) !important;
}
.chat-header {
  background-color: var(--theme-header-bg) !important;
  border-bottom-color: var(--theme-header-border) !important;
}
.chat-header span, .chat-header h3, .chat-header button {
  color: var(--theme-header-text) !important;
}
.chat-feed {
  background-color: var(--theme-feed-bg) !important;
}
.user-bubble {
  background-color: var(--theme-user-bubble-bg) !important;
  color: var(--theme-user-bubble-text) !important;
  border-color: var(--theme-user-bubble-border) !important;
}
.ai-bubble {
  background-color: var(--theme-ai-bubble-bg) !important;
  color: var(--theme-ai-bubble-text) !important;
  border-color: var(--theme-ai-bubble-border) !important;
}
.nav-footer {
  background-color: var(--theme-footer-bg) !important;
  border-top-color: var(--theme-footer-border) !important;
}
.nav-footer button {
  color: var(--theme-footer-text) !important;
}
.nav-footer button.font-extrabold {
  color: var(--theme-footer-active) !important;
}
.input-footer {
  background-color: var(--theme-footer-bg) !important;
  border-top-color: var(--theme-footer-border) !important;
}
.chats-panel, .contacts-panel {
  background-color: var(--theme-panel-bg) !important;
}
.chats-panel button, .contacts-panel button {
  background-color: var(--theme-card-bg) !important;
  border-bottom-color: var(--theme-card-border) !important;
}
.moments-panel {
  background-color: var(--theme-panel-bg) !important;
}
.moments-panel .moments-card {
  background-color: var(--theme-card-bg) !important;
  border-color: var(--theme-card-border) !important;
}
.me-panel {
  background-color: var(--theme-panel-bg) !important;
}
.me-panel .profile-card, .me-panel .details-list {
  background-color: var(--theme-card-bg) !important;
  border-color: var(--theme-card-border) !important;
}
`;
}
