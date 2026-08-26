/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  MessageCircle,
  Calendar,
  Users,
  BookOpen,
  BookHeart,
  HeartHandshake,
  Brain,
  ScanSearch,
  PenTool,
  Gamepad2,
  CloudSun,
  Music,
  Volume2,
  GripHorizontal,
  RotateCcw,
  Check,
  Move,
  Clock,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DesktopThemePreset } from '../lib/themePresets';

export type DesktopItemType = 'clock' | 'weather' | 'player' | 'app';

export interface DesktopGridItem {
  id: string;
  type: DesktopItemType;
  title: string;
  col: number; // 1 .. 4
  row: number; // 1 .. 7
  colSpan: number; // 1, 2, or 4
  rowSpan: number; // 1 or 2
  appScreen?: 'chat' | 'calendar' | 'forum' | 'worldbook' | 'diary' | 'relationship' | 'memory' | 'inspector' | 'fanfic' | 'games';
  iconKey?: string;
  defaultBg?: string;
  defaultIconColor?: string;
  defaultBorder?: string;
  defaultShadow?: string;
}

export const DEFAULT_DESKTOP_ITEMS: DesktopGridItem[] = [
  {
    id: 'widget_clock',
    type: 'clock',
    title: '系统时钟',
    col: 1,
    row: 1,
    colSpan: 2,
    rowSpan: 1,
  },
  {
    id: 'widget_weather',
    type: 'weather',
    title: '实时天气',
    col: 3,
    row: 1,
    colSpan: 2,
    rowSpan: 1,
  },
  {
    id: 'widget_player',
    type: 'player',
    title: '音乐播放器',
    col: 1,
    row: 2,
    colSpan: 4,
    rowSpan: 1,
  },
  {
    id: 'app_chat',
    type: 'app',
    title: '聊天',
    col: 1,
    row: 3,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'chat',
    iconKey: 'chat',
  },
  {
    id: 'app_calendar',
    type: 'app',
    title: '日历',
    col: 2,
    row: 3,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'calendar',
    iconKey: 'calendar',
  },
  {
    id: 'app_forum',
    type: 'app',
    title: '论坛',
    col: 3,
    row: 3,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'forum',
    iconKey: 'forum',
  },
  {
    id: 'app_worldbook',
    type: 'app',
    title: '世界书',
    col: 4,
    row: 3,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'worldbook',
    iconKey: 'worldbook',
  },
  {
    id: 'app_diary',
    type: 'app',
    title: '日记本',
    col: 1,
    row: 4,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'diary',
    iconKey: 'diary',
    defaultBg: 'bg-[#fa4a75]',
    defaultIconColor: 'text-white',
  },
  {
    id: 'app_relationship',
    type: 'app',
    title: '关系网',
    col: 2,
    row: 4,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'relationship',
    iconKey: 'relationship',
    defaultBg: 'bg-[#615fff]',
    defaultIconColor: 'text-white',
  },
  {
    id: 'app_memory',
    type: 'app',
    title: '记忆',
    col: 3,
    row: 4,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'memory',
    iconKey: 'memory',
  },
  {
    id: 'app_inspector',
    type: 'app',
    title: '查手机',
    col: 4,
    row: 4,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'inspector',
    iconKey: 'inspector',
  },
  {
    id: 'app_fanfic',
    type: 'app',
    title: '梦男之家',
    col: 1,
    row: 5,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'fanfic',
    iconKey: 'fanfic',
    defaultBg: 'bg-[#ffffff]',
    defaultIconColor: 'text-[#d23838]',
    defaultBorder: 'border border-gray-200',
    defaultShadow: 'shadow-md shadow-black/10',
  },
  {
    id: 'app_games',
    type: 'app',
    title: '游戏',
    col: 2,
    row: 5,
    colSpan: 1,
    rowSpan: 1,
    appScreen: 'games',
    iconKey: 'games',
    defaultBg: 'bg-amber-500',
    defaultIconColor: 'text-slate-950',
    defaultBorder: 'border border-amber-300/60',
    defaultShadow: 'shadow-md shadow-amber-500/20',
  },
];

const WEATHER_TIPS = [
  "22°C 多云转晴 / 气候极为舒适",
  "24°C 清晨和风 / 适宜在窗前读书",
  "21°C 微风徐徐 / 脑力状态极好",
  "23°C 阳光温和 / 适宜出门喝杯拿铁"
];

interface DesktopGridViewProps {
  currentPreset: DesktopThemePreset;
  iconStyle: 'default' | 'transparent_white' | 'transparent_black';
  dynamicAppLabelColor: string;
  getIconContainerClasses: (defaultBg: string, defaultBorder?: string, defaultShadow?: string) => string;
  getIconSvgColor: (defaultColor: string) => string;
  currentTime: Date;
  chatUnreadCount: number;
  onOpenApp: (screen: 'chat' | 'calendar' | 'forum' | 'worldbook' | 'diary' | 'relationship' | 'memory' | 'inspector' | 'fanfic' | 'games') => void;
  formatMonthDate: (date: Date) => string;
  formatDayOfWeek: (date: Date) => string;
}

export default function DesktopGridView({
  currentPreset,
  iconStyle,
  dynamicAppLabelColor,
  getIconContainerClasses,
  getIconSvgColor,
  currentTime,
  chatUnreadCount,
  onOpenApp,
  formatMonthDate,
  formatDayOfWeek,
}: DesktopGridViewProps) {
  const [items, setItems] = useState<DesktopGridItem[]>(() => {
    try {
      const saved = localStorage.getItem('desktop_layout_4x7_coordinates_v4');
      if (saved) {
        const parsed = JSON.parse(saved) as DesktopGridItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, DesktopGridItem>();
          parsed.forEach(p => {
            if (p && p.id && typeof p.col === 'number' && typeof p.row === 'number') {
              map.set(p.id, p);
            }
          });

          return DEFAULT_DESKTOP_ITEMS.map(def => {
            const existing = map.get(def.id);
            if (existing) {
              return {
                ...def,
                col: existing.col,
                row: existing.row,
                colSpan: def.colSpan,
                rowSpan: def.rowSpan,
              };
            }
            return def;
          });
        }
      }
    } catch (e) {
      console.warn("Failed to load saved coordinate desktop layout:", e);
    }
    return DEFAULT_DESKTOP_ITEMS;
  });

  const [activeWeatherIndex, setActiveWeatherIndex] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverTargetSlot, setHoverTargetSlot] = useState<{ col: number; row: number } | null>(null);
  const [dragPointerPos, setDragPointerPos] = useState<{ x: number; y: number } | null>(null);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blankLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const blankStartPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const hasTriggeredLongPressRef = useRef(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const draggingIdRef = useRef<string | null>(null);
  const hoverTargetSlotRef = useRef<{ col: number; row: number } | null>(null);
  const itemsRef = useRef<DesktopGridItem[]>(items);

  itemsRef.current = items;
  draggingIdRef.current = draggingId;
  hoverTargetSlotRef.current = hoverTargetSlot;

  // Persist layout to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('desktop_layout_4x7_coordinates_v4', JSON.stringify(items));
    } catch (e) {
      console.warn("Failed to persist desktop layout:", e);
    }
  }, [items]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      if (blankLongPressTimerRef.current) {
        clearTimeout(blankLongPressTimerRef.current);
      }
    };
  }, []);

  const handleResetLayout = () => {
    setItems(DEFAULT_DESKTOP_ITEMS);
    localStorage.removeItem('desktop_layout_4x7_coordinates_v4');
    setIsEditMode(false);
    setDraggingId(null);
    setHoverTargetSlot(null);
    setDragPointerPos(null);
  };

  const draggingItem = useMemo(() => {
    return items.find(it => it.id === draggingId) || null;
  }, [items, draggingId]);

  const calculateSlotFromPointer = useCallback((clientX: number, clientY: number, item: DesktopGridItem | null) => {
    if (!gridContainerRef.current) return null;
    const rect = gridContainerRef.current.getBoundingClientRect();
    const cellWidth = rect.width / 4;
    const cellHeight = rect.height / 7;

    const relX = Math.max(0, Math.min(rect.width - 1, clientX - rect.left));
    const relY = Math.max(0, Math.min(rect.height - 1, clientY - rect.top));

    const rawCol = Math.floor(relX / cellWidth) + 1; // 1..4
    const rawRow = Math.floor(relY / cellHeight) + 1; // 1..7

    const colSpan = item ? item.colSpan : 1;
    const rowSpan = item ? item.rowSpan : 1;

    // Clamp so the entire item footprint stays inside 4 columns and 7 rows
    const clampedCol = Math.min(Math.max(1, rawCol), 4 - colSpan + 1);
    const clampedRow = Math.min(Math.max(1, rawRow), 7 - rowSpan + 1);

    return { col: clampedCol, row: clampedRow };
  }, []);

  // Handler for long-pressing on empty desktop blank space to enter edit mode
  const handleBlankPointerDown = (e: React.PointerEvent) => {
    // If pointer down was initiated on an app or widget, ignore (it has its own item pointer handler)
    const target = e.target as HTMLElement;
    if (target.closest('[data-desktop-item-id]') || target.closest('button')) {
      return;
    }

    if (isEditMode) return;

    blankStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (blankLongPressTimerRef.current) {
      clearTimeout(blankLongPressTimerRef.current);
    }

    blankLongPressTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(40);
        } catch (_) {}
      }
      setIsEditMode(true);
      blankLongPressTimerRef.current = null;
    }, 350);
  };

  // Global pointer move & up handlers to guarantee drop anywhere (including empty background)
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      // Cancel blank long press if finger/pointer moved more than 8px
      if (blankLongPressTimerRef.current) {
        const dist = Math.hypot(e.clientX - blankStartPosRef.current.x, e.clientY - blankStartPosRef.current.y);
        if (dist > 8) {
          clearTimeout(blankLongPressTimerRef.current);
          blankLongPressTimerRef.current = null;
        }
      }

      if (!isDraggingRef.current || !draggingIdRef.current) return;

      setDragPointerPos({ x: e.clientX, y: e.clientY });

      const currentItem = itemsRef.current.find(it => it.id === draggingIdRef.current) || null;
      const slot = calculateSlotFromPointer(e.clientX, e.clientY, currentItem);
      if (slot) {
        setHoverTargetSlot(slot);
      }
    };

    const handleGlobalPointerUp = (e: PointerEvent) => {
      if (blankLongPressTimerRef.current) {
        clearTimeout(blankLongPressTimerRef.current);
        blankLongPressTimerRef.current = null;
      }

      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (isDraggingRef.current && draggingIdRef.current) {
        const activeId = draggingIdRef.current;
        const currentItem = itemsRef.current.find(it => it.id === activeId) || null;
        const targetSlot = calculateSlotFromPointer(e.clientX, e.clientY, currentItem) || hoverTargetSlotRef.current;

        if (targetSlot && currentItem) {
          setItems(prevItems => {
            const moving = prevItems.find(it => it.id === activeId);
            if (!moving) return prevItems;

            const targetCol = targetSlot.col;
            const targetRow = targetSlot.row;

            if (moving.col === targetCol && moving.row === targetRow) {
              return prevItems;
            }

            // Find collisions at destination
            const targetMinC = targetCol;
            const targetMaxC = targetCol + moving.colSpan - 1;
            const targetMinR = targetRow;
            const targetMaxR = targetRow + moving.rowSpan - 1;

            const collidingItems = prevItems.filter(it => {
              if (it.id === moving.id) return false;
              const itMinC = it.col;
              const itMaxC = it.col + it.colSpan - 1;
              const itMinR = it.row;
              const itMaxR = it.row + it.rowSpan - 1;

              const overlapC = Math.max(targetMinC, itMinC) <= Math.min(targetMaxC, itMaxC);
              const overlapR = Math.max(targetMinR, itMinR) <= Math.min(targetMaxR, itMaxR);
              return overlapC && overlapR;
            });

            // 1. Target is an empty slot: move directly without shifting other icons!
            if (collidingItems.length === 0) {
              return prevItems.map(it => {
                if (it.id === moving.id) {
                  return { ...it, col: targetCol, row: targetRow };
                }
                return it;
              });
            }

            // 2. Single 1x1 app collision: swap coordinates
            if (collidingItems.length === 1 && moving.colSpan === 1 && moving.rowSpan === 1 && collidingItems[0].colSpan === 1 && collidingItems[0].rowSpan === 1) {
              const other = collidingItems[0];
              return prevItems.map(it => {
                if (it.id === moving.id) {
                  return { ...it, col: targetCol, row: targetRow };
                }
                if (it.id === other.id) {
                  return { ...it, col: moving.col, row: moving.row };
                }
                return it;
              });
            }

            // 3. Widget collision: swap origin
            const primaryColliding = collidingItems[0];
            const origCol = moving.col;
            const origRow = moving.row;

            return prevItems.map(it => {
              if (it.id === moving.id) {
                return { ...it, col: targetCol, row: targetRow };
              }
              if (it.id === primaryColliding.id) {
                const safeCol = Math.min(Math.max(1, origCol), 4 - primaryColliding.colSpan + 1);
                const safeRow = Math.min(Math.max(1, origRow), 7 - primaryColliding.rowSpan + 1);
                return { ...it, col: safeCol, row: safeRow };
              }
              return it;
            });
          });
        }
      }

      setDraggingId(null);
      setHoverTargetSlot(null);
      setDragPointerPos(null);
      isDraggingRef.current = false;
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, { passive: true });
    window.addEventListener('pointerup', handleGlobalPointerUp, { passive: true });
    window.addEventListener('pointercancel', handleGlobalPointerUp, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [calculateSlotFromPointer]);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    if (blankLongPressTimerRef.current) {
      clearTimeout(blankLongPressTimerRef.current);
      blankLongPressTimerRef.current = null;
    }

    startPosRef.current = { x: e.clientX, y: e.clientY };
    hasTriggeredLongPressRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    if (isEditMode) {
      setDraggingId(id);
      setDragPointerPos({ x: e.clientX, y: e.clientY });
      isDraggingRef.current = true;
      const currentItem = itemsRef.current.find(it => it.id === id) || null;
      const slot = calculateSlotFromPointer(e.clientX, e.clientY, currentItem);
      if (slot) setHoverTargetSlot(slot);
      return;
    }

    // Long press 300ms trigger
    longPressTimerRef.current = setTimeout(() => {
      hasTriggeredLongPressRef.current = true;
      // Trigger a crisp, tactile single short vibration (40ms)
      if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(40);
        } catch (_) {}
      }
      setIsEditMode(true);
      setDraggingId(id);
      setDragPointerPos({ x: e.clientX, y: e.clientY });
      isDraggingRef.current = true;
      const currentItem = itemsRef.current.find(it => it.id === id) || null;
      const slot = calculateSlotFromPointer(e.clientX, e.clientY, currentItem);
      if (slot) setHoverTargetSlot(slot);
    }, 300);
  };

  const handleItemClick = (item: DesktopGridItem, e: React.MouseEvent) => {
    if (hasTriggeredLongPressRef.current || isEditMode) {
      e.stopPropagation();
      return;
    }

    if (item.type === 'app' && item.appScreen) {
      onOpenApp(item.appScreen);
    } else if (item.type === 'weather') {
      setActiveWeatherIndex(prev => (prev + 1) % WEATHER_TIPS.length);
    }
  };

  const handleEmptySlotClick = (cell: { col: number; row: number }) => {
    if (!isEditMode || !draggingId) return;
    // If an item was selected, place it here
    setItems(prev => prev.map(it => it.id === draggingId ? { ...it, col: cell.col, row: cell.row } : it));
    setDraggingId(null);
    setHoverTargetSlot(null);
  };

  const renderAppIcon = (item: DesktopGridItem) => {
    switch (item.iconKey) {
      case 'chat':
        return <MessageCircle size={26} className={getIconSvgColor(currentPreset.appIcons.chat.iconColor)} />;
      case 'calendar':
        return <Calendar size={26} className={getIconSvgColor(currentPreset.appIcons.calendar.iconColor)} />;
      case 'forum':
        return <Users size={26} className={getIconSvgColor(currentPreset.appIcons.forum.iconColor)} />;
      case 'worldbook':
        return <BookOpen size={26} className={getIconSvgColor(currentPreset.appIcons.worldbook.iconColor)} />;
      case 'diary':
        return <BookHeart size={26} className={getIconSvgColor(item.defaultIconColor || 'text-white')} />;
      case 'relationship':
        return <HeartHandshake size={26} className={getIconSvgColor(item.defaultIconColor || 'text-white')} />;
      case 'memory':
        return <Brain size={26} className={getIconSvgColor(currentPreset.appIcons.memory.iconColor)} />;
      case 'inspector':
        return <ScanSearch size={26} className={getIconSvgColor(currentPreset.appIcons.inspector.iconColor)} />;
      case 'fanfic':
        return <PenTool size={26} className={getIconSvgColor(item.defaultIconColor || 'text-[#d23838] stroke-[2.2]')} />;
      case 'games':
        return <Gamepad2 size={26} className={getIconSvgColor(item.defaultIconColor || 'text-slate-950 stroke-[2.2]')} />;
      default:
        return <Sparkles size={26} className={getIconSvgColor('text-amber-500')} />;
    }
  };

  const renderItemContent = (item: DesktopGridItem) => {
    if (item.type === 'clock') {
      return (
        <div className={`w-full h-full px-3 py-2 ${currentPreset.clockBg} ${currentPreset.clockBorder} rounded-2xl flex items-center justify-between shadow-md relative overflow-hidden group select-none`}>
          <div className={`absolute top-0 right-0 w-16 h-16 ${currentPreset.clockGlow} rounded-full blur-xl pointer-events-none`}></div>
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center space-x-1">
              <span className={`text-[8px] uppercase font-mono tracking-widest ${currentPreset.clockTagColor} block`}>TIME</span>
              <Clock size={10} className={currentPreset.clockTagColor} />
            </div>
            <div className={`text-xl sm:text-2xl font-light tracking-tight tabular-nums font-mono leading-tight mt-0.5 ${currentPreset.clockTextPrimary}`}>
              {String(currentTime.getHours()).padStart(2, '0')}
              <span className="animate-pulse inline-block mx-0.5">:</span>
              {String(currentTime.getMinutes()).padStart(2, '0')}
            </div>
          </div>
          <div className="text-right shrink-0 flex flex-col justify-center pl-2">
            <div className={`text-[10px] sm:text-[11px] font-bold font-sans ${currentPreset.clockTextPrimary}`}>{formatMonthDate(currentTime)}</div>
            <div className={`text-[8px] sm:text-[8.5px] ${currentPreset.clockTextSecondary} mt-0.5`}>{formatDayOfWeek(currentTime)}</div>
          </div>
        </div>
      );
    }

    if (item.type === 'weather') {
      return (
        <div
          className={`w-full h-full px-3 py-2 ${currentPreset.weatherBg} ${currentPreset.weatherBorder} rounded-2xl flex flex-col justify-between shadow-md relative select-none cursor-pointer`}
          title="点击刷新天气微报"
        >
          <div className="flex justify-between items-center">
            <span className={`text-[8px] uppercase font-mono tracking-widest ${currentPreset.weatherTagColor}`}>WEATHER</span>
            <CloudSun className={`${currentPreset.weatherIconColor} animate-bounce`} size={13} />
          </div>
          <div className={`text-[8.5px] leading-tight font-sans font-medium line-clamp-1 truncate ${currentPreset.weatherTextPrimary}`}>
            {WEATHER_TIPS[activeWeatherIndex]}
          </div>
          <div className={`text-[7px] ${currentPreset.weatherTextSecondary} font-mono tracking-wider text-right uppercase`}>
            TAP TO CYCLE
          </div>
        </div>
      );
    }

    if (item.type === 'player') {
      return (
        <div className={`w-full h-full px-3 py-2 ${currentPreset.playerBg} ${currentPreset.playerBorder} rounded-2xl flex items-center justify-between shadow select-none`}>
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shrink-0 animate-spin" style={{ animationDuration: '8s' }}>
              <Music size={14} className="text-white" />
            </div>
            <div className="min-w-0 leading-tight">
              <span className={`text-[9.5px] font-bold ${currentPreset.playerTextPrimary} block truncate`}>午后联奏：留声机回响</span>
              <span className={`text-[7.5px] ${currentPreset.playerTextSecondary} font-mono block`}>BITRATE 320KBPS / MP3</span>
            </div>
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <Volume2 size={14} className={currentPreset.playerIconColor} />
            <span className={`text-[7.5px] font-mono tracking-wider select-none font-bold ${currentPreset.playerTextPrimary}`}>PLAYING</span>
          </div>
        </div>
      );
    }

    // App Icon (1x1)
    const iconContainerClass = (() => {
      if (item.iconKey && (currentPreset.appIcons as any)[item.iconKey]) {
        const iconStyleObj = (currentPreset.appIcons as any)[item.iconKey];
        return getIconContainerClasses(iconStyleObj.bg, iconStyleObj.border, iconStyleObj.shadow);
      }
      return getIconContainerClasses(
        item.defaultBg || 'bg-white',
        item.defaultBorder || 'border border-gray-200/80',
        item.defaultShadow || 'shadow-md shadow-gray-200/50'
      );
    })();

    return (
      <div className="w-full h-full flex flex-col items-center justify-center select-none group cursor-pointer">
        <div
          className={`w-12 h-12 sm:w-14 sm:h-14 ${iconContainerClass} rounded-[20px] flex items-center justify-center relative transition-transform duration-200 group-hover:scale-105 group-active:scale-95`}
          style={iconStyle === 'default' && item.defaultBg?.startsWith('bg-[#') ? {
            backgroundColor: item.defaultBg.replace('bg-[', '').replace(']', '')
          } : undefined}
        >
          {renderAppIcon(item)}
          
          {item.iconKey === 'chat' && chatUnreadCount > 0 && (
            <span className={`absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-[9px] font-extrabold flex items-center justify-center shadow ${currentPreset.appIcons.chat.badgeBorder || 'border-2 border-[#1E1F35]'}`}>
              {chatUnreadCount}
            </span>
          )}
        </div>
        <span className={`text-[10px] mt-1 font-medium truncate max-w-[64px] text-center ${dynamicAppLabelColor}`}>
          {item.title}
        </span>
      </div>
    );
  };

  // Generate 28 background cells (4 cols x 7 rows)
  const gridCells = useMemo(() => {
    const cells: { col: number; row: number }[] = [];
    for (let r = 1; r <= 7; r++) {
      for (let c = 1; c <= 4; c++) {
        cells.push({ col: c, row: r });
      }
    }
    return cells;
  }, []);

  return (
    <div 
      onPointerDown={handleBlankPointerDown}
      className="flex-1 w-full h-full flex flex-col justify-between relative select-none overflow-hidden"
    >
      {/* Edit Mode Top Toolbar */}
      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="w-full px-2 pt-1 pb-1 z-40 flex items-center justify-between shrink-0"
          >
            <div className="flex items-center space-x-2 bg-slate-900/90 backdrop-blur-md text-white px-3 py-1 rounded-full shadow-lg border border-white/20 text-[10px] font-bold">
              <Move size={12} className="text-amber-400 animate-pulse" />
              <span>长按或拖拽图标进行 4×7 网格布局</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleResetLayout}
                className="h-8 px-4 bg-white/90 hover:bg-white text-slate-800 rounded-xl shadow-md border border-gray-200 flex items-center space-x-1 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                title="恢复默认 4×7 桌面布局"
              >
                <RotateCcw size={12} className="text-slate-600" />
                <span>重置</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEditMode(false);
                  setDraggingId(null);
                  setHoverTargetSlot(null);
                  setDragPointerPos(null);
                }}
                className="h-8 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md font-extrabold flex items-center space-x-1 text-xs transition-all active:scale-95 cursor-pointer"
              >
                <Check size={12} className="stroke-[3]" />
                <span>完成</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4 × 7 Desktop Grid Area (Strictly 4 columns × 7 rows with Free Placement) */}
      <div 
        ref={gridContainerRef}
        onPointerDown={handleBlankPointerDown}
        className="flex-1 w-full grid grid-cols-4 grid-rows-7 gap-2 p-2 overflow-hidden relative"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
        }}
      >
        {/* Background Empty Slot Guides in Edit Mode (Clean without coordinate numbers) */}
        {isEditMode && gridCells.map((cell) => (
          <div
            key={`cell_${cell.col}_${cell.row}`}
            onClick={() => handleEmptySlotClick(cell)}
            style={{
              gridColumn: `${cell.col} / span 1`,
              gridRow: `${cell.row} / span 1`,
            }}
            className="w-full h-full rounded-2xl border border-dashed border-white/20 bg-white/[0.03] flex items-center justify-center cursor-pointer transition-colors hover:bg-white/[0.08]"
          />
        ))}

        {/* Dynamic Drop Target Highlight Indicator */}
        {isEditMode && draggingItem && hoverTargetSlot && (
          <div
            style={{
              gridColumn: `${hoverTargetSlot.col} / span ${draggingItem.colSpan}`,
              gridRow: `${hoverTargetSlot.row} / span ${draggingItem.rowSpan}`,
            }}
            className="w-full h-full rounded-2xl border-2 border-amber-400 bg-amber-400/25 shadow-lg shadow-amber-500/30 pointer-events-none z-10 transition-all duration-75 animate-pulse"
          />
        )}

        {/* Desktop Items placed exactly at (col, row) */}
        {items.map((item) => {
          const isDragging = draggingId === item.id;

          return (
            <div
              key={item.id}
              data-desktop-item-id={item.id}
              onPointerDown={(e) => handlePointerDown(item.id, e)}
              onClick={(e) => handleItemClick(item, e)}
              style={{
                gridColumn: `${item.col} / span ${item.colSpan}`,
                gridRow: `${item.row} / span ${item.rowSpan}`,
              }}
              className={`relative flex items-center justify-center transition-all duration-150 touch-none select-none ${
                isDragging 
                  ? 'opacity-40 scale-95 z-30 shadow-2xl ring-2 ring-amber-400 rounded-2xl pointer-events-none' 
                  : isEditMode 
                  ? 'animate-desktop-wiggle cursor-grab active:cursor-grabbing z-20 hover:scale-105' 
                  : 'z-20'
              }`}
            >
              {renderItemContent(item)}

              {isEditMode && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-900/90 border border-white/40 text-amber-300 rounded-full flex items-center justify-center shadow pointer-events-none z-20">
                  <GripHorizontal size={10} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
