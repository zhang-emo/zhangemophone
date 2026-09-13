/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AppIconStyle {
  bg: string;
  iconColor: string;
  border?: string;
  shadow?: string;
  badgeBorder?: string;
}

export interface DesktopThemePreset {
  id: string;
  name: string;
  description: string;
  category: 'light' | 'dark';
  isLight: boolean;
  
  // Backgrounds & Wallpaper
  wallpaperClass: string;
  previewBg: string;

  // Widgets
  clockBg: string;
  clockBorder: string;
  clockTextPrimary: string;
  clockTextSecondary: string;
  clockTagColor: string;
  clockGlow: string;

  weatherBg: string;
  weatherBorder: string;
  weatherTextPrimary: string;
  weatherTextSecondary: string;
  weatherTagColor: string;
  weatherIconColor: string;

  playerBg: string;
  playerBorder: string;
  playerTextPrimary: string;
  playerTextSecondary: string;
  playerIconColor: string;

  sectionTitleColor: string;
  appLabelColor: string;

  // Dock
  dockBg: string;
  dockBorder: string;
  dockBrowserBg: string;
  dockBrowserIcon?: string;
  dockWallpaperBg: string;
  dockWallpaperIcon?: string;
  dockSettingsBg: string;
  dockSettingsIcon: string;
  dockCameraBg: string;
  dockCameraIcon?: string;

  // App Icons
  appIcons: {
    chat: AppIconStyle;
    calendar: AppIconStyle;
    forum: AppIconStyle;
    worldbook: AppIconStyle;
    diary: AppIconStyle;
    relationship: AppIconStyle;
    memory: AppIconStyle;
    inspector: AppIconStyle;
    fanfic: AppIconStyle;
  };
}

export const THEME_PRESETS: DesktopThemePreset[] = [
  {
    id: 'morning_light',
    name: '晨曦柔光',
    description: '极简白金浅色桌面预设，淡雅高质感',
    category: 'light',
    isLight: true,
    wallpaperClass: 'bg-gradient-to-b from-[#F8FAFC] via-[#EEF2FF] to-[#E0E7FF]',
    previewBg: 'linear-gradient(to bottom, #F8FAFC, #EEF2FF, #E0E7FF)',

    clockBg: 'bg-white/80 backdrop-blur-md',
    clockBorder: 'border-white/90 shadow-lg shadow-indigo-100/50',
    clockTextPrimary: 'text-slate-900',
    clockTextSecondary: 'text-slate-600',
    clockTagColor: 'text-indigo-600 font-bold',
    clockGlow: 'bg-indigo-300/20',

    weatherBg: 'bg-gradient-to-br from-amber-100/90 via-orange-50/90 to-amber-100/90 backdrop-blur-md',
    weatherBorder: 'border-amber-200/80 shadow-md shadow-amber-100/50',
    weatherTextPrimary: 'text-amber-950',
    weatherTextSecondary: 'text-amber-900/80',
    weatherTagColor: 'text-amber-700 font-black',
    weatherIconColor: 'text-amber-500',

    playerBg: 'bg-white/80 backdrop-blur-md',
    playerBorder: 'border-white/90 shadow-sm shadow-slate-200/60',
    playerTextPrimary: 'text-slate-900 font-bold',
    playerTextSecondary: 'text-slate-500',
    playerIconColor: 'text-amber-600',

    sectionTitleColor: 'text-slate-500 font-bold',
    appLabelColor: 'text-slate-700 font-semibold',

    dockBg: 'bg-white/80 backdrop-blur-md shadow-lg shadow-slate-200/60',
    dockBorder: 'border-white/90',
    dockBrowserBg: 'bg-gradient-to-tr from-[#0284C7] to-[#0EA5E9]',
    dockBrowserIcon: 'text-white',
    dockWallpaperBg: 'bg-gradient-to-tr from-indigo-500 to-purple-500',
    dockWallpaperIcon: 'text-white',
    dockSettingsBg: 'bg-gradient-to-b from-slate-200 to-slate-300',
    dockSettingsIcon: 'text-slate-800',
    dockCameraBg: 'bg-gradient-to-b from-sky-400 to-blue-600',
    dockCameraIcon: 'text-white',

    appIcons: {
      chat: {
        bg: 'bg-[#FEF08A] hover:bg-[#FDE047]',
        iconColor: 'text-[#713F12] stroke-[2.2]',
        border: 'border border-amber-300/80',
        shadow: 'shadow-md shadow-amber-200/60',
        badgeBorder: 'border-2 border-amber-100'
      },
      calendar: {
        bg: 'bg-amber-100 hover:bg-amber-200',
        iconColor: 'text-amber-900 stroke-[2.2]',
        border: 'border border-amber-300/80',
        shadow: 'shadow-md shadow-amber-200/50'
      },
      forum: {
        bg: 'bg-indigo-100 hover:bg-indigo-200',
        iconColor: 'text-indigo-800 stroke-[2.2]',
        border: 'border border-indigo-300/80',
        shadow: 'shadow-md shadow-indigo-200/50'
      },
      worldbook: {
        bg: 'bg-orange-100 hover:bg-orange-200',
        iconColor: 'text-orange-800 stroke-[2.2]',
        border: 'border border-orange-300/80',
        shadow: 'shadow-md shadow-orange-200/50'
      },
      diary: {
        bg: 'bg-rose-100 hover:bg-rose-200',
        iconColor: 'text-rose-800 stroke-[2.2]',
        border: 'border border-rose-300/80',
        shadow: 'shadow-md shadow-rose-200/50'
      },
      relationship: {
        bg: 'bg-purple-100 hover:bg-purple-200',
        iconColor: 'text-purple-800 stroke-[2.2]',
        border: 'border border-purple-300/80',
        shadow: 'shadow-md shadow-purple-200/50'
      },
      memory: {
        bg: 'bg-indigo-100 hover:bg-indigo-200',
        iconColor: 'text-indigo-900 stroke-[2.2]',
        border: 'border border-indigo-300/80',
        shadow: 'shadow-md shadow-indigo-200/50'
      },
      inspector: {
        bg: 'bg-emerald-100 hover:bg-emerald-200',
        iconColor: 'text-emerald-800 stroke-[2.2]',
        border: 'border border-emerald-300/80',
        shadow: 'shadow-md shadow-emerald-200/50'
      },
      fanfic: {
        bg: 'bg-[#ffffff] hover:bg-gray-100',
        iconColor: 'text-[#d23838] stroke-[2.2]',
        border: 'border border-gray-200',
        shadow: 'shadow-md shadow-black/10'
      }
    }
  },
  {
    id: 'cream_macaron',
    name: '奶油马卡龙',
    description: '柔温日系奶油与粉彩淡调，治愈感十足',
    category: 'light',
    isLight: true,
    wallpaperClass: 'bg-gradient-to-b from-[#FFF5F5] via-[#FFF0F5] to-[#F3E8FF]',
    previewBg: 'linear-gradient(to bottom, #FFF5F5, #FFF0F5, #F3E8FF)',

    clockBg: 'bg-white/85 backdrop-blur-md',
    clockBorder: 'border-pink-200/70 shadow-lg shadow-pink-100/60',
    clockTextPrimary: 'text-slate-900',
    clockTextSecondary: 'text-slate-600',
    clockTagColor: 'text-pink-600 font-bold',
    clockGlow: 'bg-pink-300/20',

    weatherBg: 'bg-gradient-to-br from-pink-100/90 via-rose-50/90 to-purple-100/90 backdrop-blur-md',
    weatherBorder: 'border-pink-200 shadow-md shadow-pink-100/50',
    weatherTextPrimary: 'text-pink-950',
    weatherTextSecondary: 'text-pink-900/80',
    weatherTagColor: 'text-pink-700 font-black',
    weatherIconColor: 'text-pink-500',

    playerBg: 'bg-white/85 backdrop-blur-md',
    playerBorder: 'border-pink-200/70 shadow-sm shadow-pink-100/40',
    playerTextPrimary: 'text-slate-900 font-bold',
    playerTextSecondary: 'text-slate-500',
    playerIconColor: 'text-pink-500',

    sectionTitleColor: 'text-pink-800/60 font-bold',
    appLabelColor: 'text-slate-700 font-semibold',

    dockBg: 'bg-white/80 backdrop-blur-md shadow-lg shadow-pink-100/60',
    dockBorder: 'border-pink-100',
    dockBrowserBg: 'bg-gradient-to-tr from-sky-400 to-indigo-400',
    dockWallpaperBg: 'bg-gradient-to-tr from-pink-400 to-rose-400',
    dockSettingsBg: 'bg-gradient-to-b from-slate-200 to-slate-300',
    dockSettingsIcon: 'text-slate-800',
    dockCameraBg: 'bg-gradient-to-b from-purple-400 to-indigo-500',

    appIcons: {
      chat: {
        bg: 'bg-[#FEF9C3] hover:bg-[#FEF08A]',
        iconColor: 'text-amber-900 stroke-[2.2]',
        border: 'border border-amber-200',
        shadow: 'shadow-md shadow-amber-100',
        badgeBorder: 'border-2 border-white'
      },
      calendar: {
        bg: 'bg-[#FEF3C7] hover:bg-[#FDE68A]',
        iconColor: 'text-amber-900 stroke-[2.2]',
        border: 'border border-amber-200',
        shadow: 'shadow-md shadow-amber-100'
      },
      forum: {
        bg: 'bg-[#E0E7FF] hover:bg-[#C7D2FE]',
        iconColor: 'text-indigo-900 stroke-[2.2]',
        border: 'border border-indigo-200',
        shadow: 'shadow-md shadow-indigo-100'
      },
      worldbook: {
        bg: 'bg-[#FFEDD5] hover:bg-[#FED7AA]',
        iconColor: 'text-orange-900 stroke-[2.2]',
        border: 'border border-orange-200',
        shadow: 'shadow-md shadow-orange-100'
      },
      diary: {
        bg: 'bg-[#FFE4E6] hover:bg-[#FECDD3]',
        iconColor: 'text-rose-900 stroke-[2.2]',
        border: 'border border-rose-200',
        shadow: 'shadow-md shadow-rose-100'
      },
      relationship: {
        bg: 'bg-[#F3E8FF] hover:bg-[#E9D5FF]',
        iconColor: 'text-purple-900 stroke-[2.2]',
        border: 'border border-purple-200',
        shadow: 'shadow-md shadow-purple-100'
      },
      memory: {
        bg: 'bg-[#E0F2FE] hover:bg-[#BAE6FD]',
        iconColor: 'text-sky-900 stroke-[2.2]',
        border: 'border border-sky-200',
        shadow: 'shadow-md shadow-sky-100'
      },
      inspector: {
        bg: 'bg-[#D1FAE5] hover:bg-[#A7F3D0]',
        iconColor: 'text-emerald-900 stroke-[2.2]',
        border: 'border border-emerald-200',
        shadow: 'shadow-md shadow-emerald-100'
      },
      fanfic: {
        bg: 'bg-[#ffffff] hover:bg-gray-100',
        iconColor: 'text-[#d23838] stroke-[2.2]',
        border: 'border border-gray-200',
        shadow: 'shadow-md shadow-black/10'
      }
    }
  },
  {
    id: 'fresh_mint',
    name: '薄荷凉夏',
    description: '清新马卡龙与清爽蓝绿调浅色桌面',
    category: 'light',
    isLight: true,
    wallpaperClass: 'bg-gradient-to-b from-[#ECFDF5] via-[#E0F2FE] to-[#F0FDF4]',
    previewBg: 'linear-gradient(to bottom, #ECFDF5, #E0F2FE, #F0FDF4)',

    clockBg: 'bg-white/85 backdrop-blur-md',
    clockBorder: 'border-emerald-200/70 shadow-lg shadow-emerald-100/50',
    clockTextPrimary: 'text-slate-900',
    clockTextSecondary: 'text-slate-600',
    clockTagColor: 'text-emerald-600 font-bold',
    clockGlow: 'bg-emerald-300/20',

    weatherBg: 'bg-gradient-to-br from-emerald-100/90 via-teal-50/90 to-sky-100/90 backdrop-blur-md',
    weatherBorder: 'border-emerald-200 shadow-md shadow-emerald-100/50',
    weatherTextPrimary: 'text-emerald-950',
    weatherTextSecondary: 'text-emerald-900/80',
    weatherTagColor: 'text-emerald-700 font-black',
    weatherIconColor: 'text-emerald-500',

    playerBg: 'bg-white/85 backdrop-blur-md',
    playerBorder: 'border-emerald-200/70 shadow-sm shadow-emerald-100/40',
    playerTextPrimary: 'text-slate-900 font-bold',
    playerTextSecondary: 'text-slate-500',
    playerIconColor: 'text-emerald-600',

    sectionTitleColor: 'text-emerald-800/60 font-bold',
    appLabelColor: 'text-slate-700 font-semibold',

    dockBg: 'bg-white/80 backdrop-blur-md shadow-lg shadow-emerald-100/50',
    dockBorder: 'border-emerald-100',
    dockBrowserBg: 'bg-gradient-to-tr from-teal-500 to-sky-500',
    dockWallpaperBg: 'bg-gradient-to-tr from-emerald-400 to-teal-500',
    dockSettingsBg: 'bg-gradient-to-b from-slate-200 to-slate-300',
    dockSettingsIcon: 'text-slate-800',
    dockCameraBg: 'bg-gradient-to-b from-sky-400 to-teal-600',

    appIcons: {
      chat: {
        bg: 'bg-[#FEF08A] hover:bg-[#FDE047]',
        iconColor: 'text-amber-900 stroke-[2.2]',
        border: 'border border-amber-300',
        shadow: 'shadow-md shadow-amber-100'
      },
      calendar: {
        bg: 'bg-emerald-100 hover:bg-emerald-200',
        iconColor: 'text-emerald-900 stroke-[2.2]',
        border: 'border border-emerald-300',
        shadow: 'shadow-md shadow-emerald-100'
      },
      forum: {
        bg: 'bg-sky-100 hover:bg-sky-200',
        iconColor: 'text-sky-900 stroke-[2.2]',
        border: 'border border-sky-300',
        shadow: 'shadow-md shadow-sky-100'
      },
      worldbook: {
        bg: 'bg-teal-100 hover:bg-teal-200',
        iconColor: 'text-teal-900 stroke-[2.2]',
        border: 'border border-teal-300',
        shadow: 'shadow-md shadow-teal-100'
      },
      diary: {
        bg: 'bg-rose-100 hover:bg-rose-200',
        iconColor: 'text-rose-900 stroke-[2.2]',
        border: 'border border-rose-300',
        shadow: 'shadow-md shadow-rose-100'
      },
      relationship: {
        bg: 'bg-indigo-100 hover:bg-indigo-200',
        iconColor: 'text-indigo-900 stroke-[2.2]',
        border: 'border border-indigo-300',
        shadow: 'shadow-md shadow-indigo-100'
      },
      memory: {
        bg: 'bg-cyan-100 hover:bg-cyan-200',
        iconColor: 'text-cyan-900 stroke-[2.2]',
        border: 'border border-cyan-300',
        shadow: 'shadow-md shadow-cyan-100'
      },
      inspector: {
        bg: 'bg-emerald-200 hover:bg-emerald-300',
        iconColor: 'text-emerald-950 stroke-[2.2]',
        border: 'border border-emerald-400',
        shadow: 'shadow-md shadow-emerald-100'
      },
      fanfic: {
        bg: 'bg-[#ffffff] hover:bg-gray-100',
        iconColor: 'text-[#d23838] stroke-[2.2]',
        border: 'border border-gray-200',
        shadow: 'shadow-md shadow-black/10'
      }
    }
  },
  {
    id: 'cosmic_indigo',
    name: '星空夜羽',
    description: '深邃宇宙湛蓝渐变，经典深色主题',
    category: 'dark',
    isLight: false,
    wallpaperClass: 'bg-gradient-to-b from-[#131526] via-[#1C1F37] to-[#252A4A]',
    previewBg: 'linear-gradient(to bottom, #131526, #1C1F37, #252A4A)',

    clockBg: 'bg-white/10 backdrop-blur-md',
    clockBorder: 'border-white/10 shadow-lg',
    clockTextPrimary: 'text-white',
    clockTextSecondary: 'text-white/70',
    clockTagColor: 'text-white/50 font-mono',
    clockGlow: 'bg-amber-400/10',

    weatherBg: 'bg-gradient-to-br from-amber-500/20 to-rose-500/20 backdrop-blur-md',
    weatherBorder: 'border-white/10 shadow-lg',
    weatherTextPrimary: 'text-white',
    weatherTextSecondary: 'text-white/90',
    weatherTagColor: 'text-[#FEE500] font-black',
    weatherIconColor: 'text-amber-300',

    playerBg: 'bg-white/5 backdrop-blur-sm',
    playerBorder: 'border-white/10 shadow',
    playerTextPrimary: 'text-white font-bold',
    playerTextSecondary: 'text-white/60',
    playerIconColor: 'text-[#FEE500]',

    sectionTitleColor: 'text-white/40 font-bold',
    appLabelColor: 'text-white/90 font-medium',

    dockBg: 'bg-white/10 backdrop-blur-md shadow-xl',
    dockBorder: 'border-white/10',
    dockBrowserBg: 'bg-gradient-to-tr from-[#0284C7] to-[#0EA5E9]',
    dockWallpaperBg: 'bg-gradient-to-tr from-purple-500 to-pink-500',
    dockSettingsBg: 'bg-gradient-to-b from-gray-200 to-gray-400',
    dockSettingsIcon: 'text-slate-800',
    dockCameraBg: 'bg-gradient-to-b from-sky-400 to-blue-600',

    appIcons: {
      chat: {
        bg: 'bg-[#FEE500] hover:bg-[#EED500]',
        iconColor: 'text-[#3C1E1E] stroke-[2.2]',
        shadow: 'shadow-md shadow-yellow-500/20',
        badgeBorder: 'border-2 border-[#1E1F35]'
      },
      calendar: {
        bg: 'bg-[#FFCC00] hover:bg-[#E6B800]',
        iconColor: 'text-zinc-900 stroke-[2.2]',
        border: 'border border-[#FFCC00]/45',
        shadow: 'shadow-md shadow-[#FFCC00]/25'
      },
      forum: {
        bg: 'bg-indigo-600 hover:bg-indigo-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-indigo-600/45',
        shadow: 'shadow-md shadow-indigo-600/25'
      },
      worldbook: {
        bg: 'bg-amber-500 hover:bg-amber-600',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-amber-500/45',
        shadow: 'shadow-md shadow-amber-500/25'
      },
      diary: {
        bg: 'bg-rose-500 hover:bg-rose-600',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-rose-500/45',
        shadow: 'shadow-md shadow-rose-500/25'
      },
      relationship: {
        bg: 'bg-purple-600 hover:bg-purple-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-purple-600/45',
        shadow: 'shadow-md shadow-purple-600/25'
      },
      memory: {
        bg: 'bg-indigo-600 hover:bg-indigo-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-purple-500/45',
        shadow: 'shadow-md shadow-purple-600/25'
      },
      inspector: {
        bg: 'bg-emerald-600 hover:bg-emerald-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-emerald-600/45',
        shadow: 'shadow-md shadow-emerald-600/25'
      },
      fanfic: {
        bg: 'bg-[#ffffff] hover:bg-gray-100',
        iconColor: 'text-[#d23838] stroke-[2.2]',
        border: 'border border-gray-200',
        shadow: 'shadow-md shadow-black/10'
      }
    }
  },
  {
    id: 'slate_charcoal',
    name: '静谧板岩',
    description: '冷峻石墨深色，沉稳内敛',
    category: 'dark',
    isLight: false,
    wallpaperClass: 'bg-gradient-to-b from-[#111827] via-[#1F2937] to-[#374151]',
    previewBg: 'linear-gradient(to bottom, #111827, #1F2937, #374151)',

    clockBg: 'bg-white/10 backdrop-blur-md',
    clockBorder: 'border-white/10 shadow-lg',
    clockTextPrimary: 'text-white',
    clockTextSecondary: 'text-white/70',
    clockTagColor: 'text-white/50 font-mono',
    clockGlow: 'bg-sky-400/10',

    weatherBg: 'bg-gradient-to-br from-sky-500/20 to-indigo-500/20 backdrop-blur-md',
    weatherBorder: 'border-white/10 shadow-lg',
    weatherTextPrimary: 'text-white',
    weatherTextSecondary: 'text-white/90',
    weatherTagColor: 'text-sky-300 font-black',
    weatherIconColor: 'text-sky-300',

    playerBg: 'bg-white/5 backdrop-blur-sm',
    playerBorder: 'border-white/10 shadow',
    playerTextPrimary: 'text-white font-bold',
    playerTextSecondary: 'text-white/60',
    playerIconColor: 'text-sky-300',

    sectionTitleColor: 'text-white/40 font-bold',
    appLabelColor: 'text-white/90 font-medium',

    dockBg: 'bg-white/10 backdrop-blur-md shadow-xl',
    dockBorder: 'border-white/10',
    dockBrowserBg: 'bg-gradient-to-tr from-sky-600 to-blue-600',
    dockWallpaperBg: 'bg-gradient-to-tr from-purple-500 to-indigo-500',
    dockSettingsBg: 'bg-gradient-to-b from-gray-200 to-gray-400',
    dockSettingsIcon: 'text-slate-800',
    dockCameraBg: 'bg-gradient-to-b from-slate-600 to-slate-800',

    appIcons: {
      chat: {
        bg: 'bg-[#FEE500] hover:bg-[#EED500]',
        iconColor: 'text-[#3C1E1E] stroke-[2.2]',
        shadow: 'shadow-md shadow-yellow-500/20',
        badgeBorder: 'border-2 border-[#1E1F35]'
      },
      calendar: {
        bg: 'bg-amber-500 hover:bg-amber-600',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-amber-500/45',
        shadow: 'shadow-md shadow-amber-500/25'
      },
      forum: {
        bg: 'bg-blue-600 hover:bg-blue-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-blue-600/45',
        shadow: 'shadow-md shadow-blue-600/25'
      },
      worldbook: {
        bg: 'bg-amber-600 hover:bg-amber-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-amber-600/45',
        shadow: 'shadow-md shadow-amber-600/25'
      },
      diary: {
        bg: 'bg-rose-600 hover:bg-rose-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-rose-600/45',
        shadow: 'shadow-md shadow-rose-600/25'
      },
      relationship: {
        bg: 'bg-indigo-600 hover:bg-indigo-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-indigo-600/45',
        shadow: 'shadow-md shadow-indigo-600/25'
      },
      memory: {
        bg: 'bg-indigo-600 hover:bg-indigo-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-indigo-500/45',
        shadow: 'shadow-md shadow-indigo-600/25'
      },
      inspector: {
        bg: 'bg-teal-600 hover:bg-teal-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-teal-600/45',
        shadow: 'shadow-md shadow-teal-600/25'
      },
      fanfic: {
        bg: 'bg-[#ffffff] hover:bg-gray-100',
        iconColor: 'text-[#d23838] stroke-[2.2]',
        border: 'border border-gray-200',
        shadow: 'shadow-md shadow-black/10'
      }
    }
  },
  {
    id: 'cyber_violet',
    name: '赛博霓虹',
    description: '紫光暗夜，科技感十足',
    category: 'dark',
    isLight: false,
    wallpaperClass: 'bg-gradient-to-b from-[#4C1D95] via-[#2D1B4E] to-[#1E1B4B]',
    previewBg: 'linear-gradient(to bottom, #4C1D95, #2D1B4E, #1E1B4B)',

    clockBg: 'bg-white/10 backdrop-blur-md',
    clockBorder: 'border-white/10 shadow-lg',
    clockTextPrimary: 'text-white',
    clockTextSecondary: 'text-white/70',
    clockTagColor: 'text-pink-300 font-mono',
    clockGlow: 'bg-pink-500/20',

    weatherBg: 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-md',
    weatherBorder: 'border-white/10 shadow-lg',
    weatherTextPrimary: 'text-white',
    weatherTextSecondary: 'text-white/90',
    weatherTagColor: 'text-pink-300 font-black',
    weatherIconColor: 'text-pink-300',

    playerBg: 'bg-white/5 backdrop-blur-sm',
    playerBorder: 'border-white/10 shadow',
    playerTextPrimary: 'text-white font-bold',
    playerTextSecondary: 'text-white/60',
    playerIconColor: 'text-pink-400',

    sectionTitleColor: 'text-purple-300/50 font-bold',
    appLabelColor: 'text-white/90 font-medium',

    dockBg: 'bg-white/10 backdrop-blur-md shadow-xl',
    dockBorder: 'border-white/10',
    dockBrowserBg: 'bg-gradient-to-tr from-purple-600 to-indigo-600',
    dockWallpaperBg: 'bg-gradient-to-tr from-pink-500 to-rose-500',
    dockSettingsBg: 'bg-gradient-to-b from-gray-200 to-gray-400',
    dockSettingsIcon: 'text-slate-800',
    dockCameraBg: 'bg-gradient-to-b from-purple-500 to-pink-600',

    appIcons: {
      chat: {
        bg: 'bg-[#FEE500] hover:bg-[#EED500]',
        iconColor: 'text-[#3C1E1E] stroke-[2.2]',
        shadow: 'shadow-md shadow-yellow-500/20',
        badgeBorder: 'border-2 border-[#1E1F35]'
      },
      calendar: {
        bg: 'bg-amber-500 hover:bg-amber-600',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-amber-500/45',
        shadow: 'shadow-md shadow-amber-500/25'
      },
      forum: {
        bg: 'bg-purple-600 hover:bg-purple-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-purple-600/45',
        shadow: 'shadow-md shadow-purple-600/25'
      },
      worldbook: {
        bg: 'bg-pink-600 hover:bg-pink-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-pink-600/45',
        shadow: 'shadow-md shadow-pink-600/25'
      },
      diary: {
        bg: 'bg-rose-500 hover:bg-rose-600',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-rose-500/45',
        shadow: 'shadow-md shadow-rose-500/25'
      },
      relationship: {
        bg: 'bg-violet-600 hover:bg-violet-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-violet-600/45',
        shadow: 'shadow-md shadow-violet-600/25'
      },
      memory: {
        bg: 'bg-purple-600 hover:bg-purple-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-pink-500/45',
        shadow: 'shadow-md shadow-pink-600/25'
      },
      inspector: {
        bg: 'bg-fuchsia-600 hover:bg-fuchsia-700',
        iconColor: 'text-white stroke-[2.2]',
        border: 'border border-fuchsia-600/45',
        shadow: 'shadow-md shadow-fuchsia-600/25'
      },
      fanfic: {
        bg: 'bg-[#ffffff] hover:bg-gray-100',
        iconColor: 'text-[#d23838] stroke-[2.2]',
        border: 'border border-gray-200',
        shadow: 'shadow-md shadow-black/10'
      }
    }
  }
];

export const DEFAULT_PRESET_ID = 'cosmic_indigo';

export function getPresetById(id: string): DesktopThemePreset {
  const found = THEME_PRESETS.find(p => p.id === id);
  return found || THEME_PRESETS[0];
}
