import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Home,
  Gamepad2,
  Trophy,
  Users,
  Sparkles,
  MessageCircle,
  Send,
  RotateCcw,
  Check,
  X,
  Play,
  Flame,
  Shield,
  Coins,
  Crown,
  Heart,
  Skull,
  Layers,
  ChevronRight,
  Eye,
  AlertTriangle,
  Ban,
  RefreshCw,
  Zap,
  Plus,
  PenTool,
  Lock,
  Bell,
  Volume2
} from 'lucide-react';
import { dbInstance } from '../lib/db';
import { ChatSession } from '../lib/types';
import WorkbenchView from './WorkbenchView';
import {
  DDZCard,
  DDZPlayResult,
  generateDDZDeck,
  sortDDZCards,
  parseDDZCombination,
  canBeatLastPlay,
  findBestAIPlay
} from '../lib/doudizhuEngine';
import {
  UNOCard,
  UNOColorUI,
  generate108UNODeck,
  isCardPlayable,
  drawCardsFromPiles,
  getNextTurn,
  COLOR_MAP,
  aiSelectPlayableCard,
  aiChooseBestColor,
  shuffleDeck
} from '../lib/unoEngine';

// ==========================================
// TYPES & DATA STRUCTURES
// ==========================================

import AiAdventureGame from './AiAdventureGame';

export type ActiveGameType = 'lobby' | 'doudizhu' | 'uno' | 'aiAdventure';

export interface GameCompanion {
  id: string;
  name: string;
  avatar: string;
  persona?: string;
  quote?: string;
}

// Default Companions (No hardcoded preset NPCs; kept blank if user has no contacts)
export const DEFAULT_COMPANIONS: GameCompanion[] = [];

// --- UNO Card Definition ---
export type UNOColor = UNOColorUI;
export type UNOTargetType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';
export type { UNOCard };

export interface InGameMessage {
  id: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  isUser: boolean;
  time: string;
}

// ==========================================
// SUB-GAME 1: 斗地主 (DOU DI ZHU) COMPONENT
// ==========================================
function DoudizhuGame({
  selectedCompanions,
  onBackToLobby,
  addCoins,
  onWin,
  triggerCharacterBubble,
  floatingBubbles
}: {
  selectedCompanions: GameCompanion[];
  onBackToLobby: () => void;
  addCoins: (n: number) => void;
  onWin: (g: 'ddz' | 'uno') => void;
  triggerCharacterBubble: (id: string, text: string) => void;
  floatingBubbles: { [charId: string]: string };
}) {
  const p1 = selectedCompanions[0] || { id: 'comp_p1', name: '陪玩好友1', avatar: '', persona: '', quote: '' };
  const p2 = selectedCompanions[1] || { id: 'comp_p2', name: '陪玩好友2', avatar: '', persona: '', quote: '' };

  const [userHand, setUserHand] = useState<DDZCard[]>([]);
  const [p1Hand, setP1Hand] = useState<DDZCard[]>([]);
  const [p2Hand, setP2Hand] = useState<DDZCard[]>([]);
  const [bottomCards, setBottomCards] = useState<DDZCard[]>([]);
  const [landlordPlayer, setLandlordPlayer] = useState<number | null>(null); // 0, 1, 2
  const [gameStage, setGameStage] = useState<'bidding' | 'playing' | 'gameover'>('bidding');
  const [currentTurn, setCurrentTurn] = useState<number>(0);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [lastPlay, setLastPlay] = useState<{ player: number; cards: DDZCard[]; desc: string; result: DDZPlayResult } | null>(null);
  const [passCount, setPassCount] = useState<number>(0);
  const [winner, setWinner] = useState<number | null>(null);
  const [roundMultiplier, setRoundMultiplier] = useState<number>(1);
  const [ruleErrorToast, setRuleErrorToast] = useState<string | null>(null);

  // References for AI turn resolution to prevent re-render loops
  const p1HandRef = useRef<DDZCard[]>([]);
  const p2HandRef = useRef<DDZCard[]>([]);
  const lastPlayRef = useRef<{ player: number; cards: DDZCard[]; desc: string; result: DDZPlayResult } | null>(null);
  const passCountRef = useRef<number>(0);
  const p1Ref = useRef(p1);
  const p2Ref = useRef(p2);

  p1HandRef.current = p1Hand;
  p2HandRef.current = p2Hand;
  lastPlayRef.current = lastPlay;
  passCountRef.current = passCount;
  p1Ref.current = p1;
  p2Ref.current = p2;

  const showToast = (msg: string) => {
    setRuleErrorToast(msg);
    setTimeout(() => {
      setRuleErrorToast(prev => (prev === msg ? null : prev));
    }, 2500);
  };

  const initDoudizhu = useCallback(() => {
    const deck = generateDDZDeck();
    const uHand = sortDDZCards(deck.slice(0, 17));
    const p1H = sortDDZCards(deck.slice(17, 34));
    const p2H = sortDDZCards(deck.slice(34, 51));
    const bottom = sortDDZCards(deck.slice(51, 54));

    setUserHand(uHand);
    setP1Hand(p1H);
    setP2Hand(p2H);
    setBottomCards(bottom);
    setLandlordPlayer(null);
    setGameStage('bidding');
    setCurrentTurn(0);
    setSelectedCardIds([]);
    setLastPlay(null);
    setPassCount(0);
    setWinner(null);
    setRoundMultiplier(1);
    setRuleErrorToast(null);
  }, []);

  useEffect(() => {
    initDoudizhu();
  }, [initDoudizhu]);

  // Bidding Phase: strictly conforms to 1-3 point DouDiZhu rules with hand evaluation and redeal on pass
  const handleBid = (score: number) => {
    // Helper to evaluate hand strength for AI bidding
    const evaluateBidPower = (hand: DDZCard[]) => {
      let power = 0;
      const rankCounts: Record<number, number> = {};
      hand.forEach(c => {
        rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
        if (c.rank === 17) power += 3; // 大王
        else if (c.rank === 16) power += 2; // 小王
        else if (c.rank === 15) power += 1.5; // 2
        else if (c.rank === 14) power += 0.5; // A
      });
      // 王炸 or 炸弹
      if (rankCounts[16] && rankCounts[17]) power += 4;
      Object.values(rankCounts).forEach(cnt => {
        if (cnt === 4) power += 3;
      });
      return power;
    };

    let currentHighestBid = 0;
    let currentLeader = -1; // 0: User, 1: P1, 2: P2

    // 1. User turn (user bids first)
    if (score > 0) {
      currentHighestBid = Math.min(score, 3);
      currentLeader = 0;
    }

    // If user bids 3 (抢地主), user immediately wins landlord
    if (currentHighestBid < 3) {
      // 2. P1 (Left AI) bidding turn
      const p1Power = evaluateBidPower(p1Hand);
      let p1Desired = 0;
      if (p1Power >= 7) p1Desired = 3;
      else if (p1Power >= 4.5) p1Desired = 2;
      else if (p1Power >= 2.5) p1Desired = 1;

      // In DouDiZhu, a bid must be strictly greater than currentHighestBid
      if (p1Desired > currentHighestBid) {
        currentHighestBid = p1Desired;
        currentLeader = 1;
      }
    }

    if (currentHighestBid < 3) {
      // 3. P2 (Right AI) bidding turn
      const p2Power = evaluateBidPower(p2Hand);
      let p2Desired = 0;
      if (p2Power >= 7) p2Desired = 3;
      else if (p2Power >= 4.5) p2Desired = 2;
      else if (p2Power >= 2.5) p2Desired = 1;

      if (p2Desired > currentHighestBid) {
        currentHighestBid = p2Desired;
        currentLeader = 2;
      }
    }

    // 4. Check if everyone passed (流局)
    if (currentHighestBid === 0 || currentLeader === -1) {
      showToast('三家均不叫地主，本局流局，重新洗牌发牌！');
      triggerCharacterBubble(p1.id, '手气平平都不叫，本局流局重新洗牌！');
      triggerCharacterBubble(p2.id, '三家都不叫，洗牌重开！');
      setTimeout(() => {
        initDoudizhu();
      }, 1500);
      return;
    }

    // 5. Landlord decided
    const chosenLandlord = currentLeader;
    setLandlordPlayer(chosenLandlord);
    setRoundMultiplier(Math.max(1, currentHighestBid));
    setGameStage('playing');
    setCurrentTurn(chosenLandlord);

    if (chosenLandlord === 0) {
      setUserHand(prev => sortDDZCards([...prev, ...bottomCards]));
      triggerCharacterBubble(p1.id, `你叫了${currentHighestBid}分当选地主，准备接受我们两个农民的围剿吧！`);
      triggerCharacterBubble(p2.id, '农民联手，其利断金！');
      showToast(`你以 ${currentHighestBid} 分当选地主，底牌已加入手牌！`);
    } else if (chosenLandlord === 1) {
      setP1Hand(prev => sortDDZCards([...prev, ...bottomCards]));
      triggerCharacterBubble(p1.id, `哈哈，我叫了${currentHighestBid}分成为地主！底牌归我了！`);
      triggerCharacterBubble(p2.id, '我和玩家联手，一定能把你打趴下。');
      showToast(`${p1.name} 以 ${currentHighestBid} 分成为地主！`);
    } else {
      setP2Hand(prev => sortDDZCards([...prev, ...bottomCards]));
      triggerCharacterBubble(p2.id, `地主到手（${currentHighestBid}分）！三张底牌很给力，你们小心了！`);
      triggerCharacterBubble(p1.id, '地主在右边，玩家我们一起夹击他！');
      showToast(`${p2.name} 以 ${currentHighestBid} 分成为地主！`);
    }
  };

  const toggleSelectCard = (id: string) => {
    setSelectedCardIds(prev =>
      prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
    );
  };

  const handleGameOver = (winPlayer: number) => {
    setWinner(winPlayer);
    setGameStage('gameover');

    const isUserLandlord = landlordPlayer === 0;
    const isWinnerLandlord = winPlayer === landlordPlayer;
    const userWon = (isUserLandlord && isWinnerLandlord) || (!isUserLandlord && !isWinnerLandlord);

    if (userWon) {
      const wonCoins = 200 * roundMultiplier;
      addCoins(wonCoins);
      onWin('ddz');
      triggerCharacterBubble(p1.id, '厉害啊！这把打得太精彩了！');
      triggerCharacterBubble(p2.id, '输得心服口服，下把你可不一定能赢了！');
    } else {
      addCoins(-100 * roundMultiplier);
      triggerCharacterBubble(p1.id, '哈哈，胜败乃兵家常事，下把继续努力！');
      triggerCharacterBubble(p2.id, '地主/农民的胜利！承让承让~');
    }
  };

  // Smart Hint (提示) for User
  const handleUserHint = () => {
    const isFreePlay = passCount >= 2 || (lastPlay && lastPlay.player === 0);
    const suggestedCards = findBestAIPlay(userHand, isFreePlay ? null : lastPlay, isFreePlay);
    if (suggestedCards && suggestedCards.length > 0) {
      setSelectedCardIds(suggestedCards.map(c => c.id));
    } else {
      showToast('没有能压过上家的牌，建议不出 (过)');
    }
  };

  // User Plays Cards with strict rule checking
  const handleUserPlayCards = () => {
    if (selectedCardIds.length === 0) return;
    const selected = userHand.filter(c => selectedCardIds.includes(c.id));
    const parsed = parseDDZCombination(selected);

    if (parsed.type === 'INVALID') {
      showToast('您选择的牌型不符合斗地主规则');
      return;
    }

    const isFreePlay = passCount >= 2 || (lastPlay && lastPlay.player === 0);
    const check = canBeatLastPlay(parsed, isFreePlay ? null : (lastPlay ? lastPlay.result : null));

    if (!check.canBeat) {
      showToast(check.reason || '出的牌必须大于上家');
      return;
    }

    // Multiply if Bomb or Rocket
    if (parsed.type === 'BOMB' || parsed.type === 'ROCKET') {
      setRoundMultiplier(prev => prev * 2);
      triggerCharacterBubble(p1.id, parsed.type === 'ROCKET' ? '⚡ 王炸！！这也太强了！' : '💣 哇！居然有炸弹！');
      triggerCharacterBubble(p2.id, '倍数翻倍！');
    }

    const newHand = userHand.filter(c => !selectedCardIds.includes(c.id));
    setUserHand(newHand);
    setSelectedCardIds([]);
    setLastPlay({
      player: 0,
      cards: sortDDZCards(selected),
      desc: parsed.desc,
      result: parsed
    });
    setPassCount(0);

    if (newHand.length === 0) {
      handleGameOver(0);
      return;
    }

    setCurrentTurn(1);
  };

  const handleUserPass = () => {
    setPassCount(prev => prev + 1);
    setCurrentTurn(1);
  };

  // AI Turn Handler (Genuine DDZ AI Engine with stable references)
  useEffect(() => {
    if (gameStage !== 'playing' || currentTurn === 0) return;

    const timer = setTimeout(() => {
      const isP1 = currentTurn === 1;
      const currentHand = isP1 ? p1HandRef.current : p2HandRef.current;
      const companion = isP1 ? p1Ref.current : p2Ref.current;
      const last = lastPlayRef.current;
      const passes = passCountRef.current;

      const isFreePlay = passes >= 2 || (last && last.player === currentTurn);
      const playedCards = findBestAIPlay(currentHand, isFreePlay ? null : last, isFreePlay);

      if (playedCards && playedCards.length > 0) {
        const playedIds = new Set(playedCards.map(c => c.id));
        const remaining = currentHand.filter(c => !playedIds.has(c.id));
        const parsed = parseDDZCombination(playedCards);

        if (isP1) setP1Hand(remaining);
        else setP2Hand(remaining);

        if (parsed.type === 'BOMB' || parsed.type === 'ROCKET') {
          setRoundMultiplier(prev => prev * 2);
          triggerCharacterBubble(companion.id, parsed.type === 'ROCKET' ? '王炸降临！这把稳了！' : `炸弹！${parsed.desc}，接招！`);
        } else {
          triggerCharacterBubble(companion.id, `出【${parsed.desc}】！`);
        }

        setLastPlay({
          player: currentTurn,
          cards: sortDDZCards(playedCards),
          desc: parsed.desc,
          result: parsed
        });
        setPassCount(0);

        if (remaining.length === 0) {
          handleGameOver(currentTurn);
          return;
        }
      } else {
        // AI Passes
        setPassCount(prev => prev + 1);
        triggerCharacterBubble(companion.id, '要不起，过！');
      }

      setCurrentTurn(isP1 ? 2 : 0);
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentTurn, gameStage]);

  if (selectedCompanions.length < 2) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-sm">
          <Users size={32} />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <h3 className="text-sm font-black text-slate-800">联系人列表未添加人设</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            斗地主不设预设陪玩NPC，需在手机通讯录中至少添加 2 位角色人设后方可开启该功能。
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToLobby}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          返回游戏大厅
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-3 select-none relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18)_0,transparent_70%)] pointer-events-none" />

      {/* Toast Warning */}
      <AnimatePresence>
        {ruleErrorToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-14 left-1/2 -translate-x-1/2 z-50 bg-rose-600/95 text-white font-bold text-xs px-4 py-2 rounded-full shadow-2xl border border-rose-300 flex items-center space-x-1.5 backdrop-blur-md"
          >
            <AlertTriangle size={14} />
            <span>{ruleErrorToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Info Bar */}
      <div className="flex items-center justify-between z-10 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-emerald-500/25 text-xs text-white">
        <div className="flex items-center space-x-2">
          <span className="font-extrabold text-amber-400">倍数: x{roundMultiplier}</span>
          <span className="text-gray-500">|</span>
          <span className="text-emerald-300 font-bold">
            地主: {landlordPlayer === 0 ? '我' : landlordPlayer === 1 ? p1.name : landlordPlayer === 2 ? p2.name : '竞价中'}
          </span>
        </div>

        {/* Bottom Cards Display */}
        <div className="flex items-center space-x-1">
          <span className="text-[10px] text-gray-300 font-medium">底牌:</span>
          {bottomCards.map((c, i) => (
            <div
              key={i}
              className={`w-6 h-8 rounded-md bg-white text-[11px] font-black flex flex-col items-center justify-center shadow-md border ${
                gameStage === 'bidding'
                  ? 'bg-amber-100/90 text-amber-900 border-amber-300'
                  : c.color === 'red'
                  ? 'text-rose-600 border-rose-200'
                  : 'text-slate-950 border-gray-300'
              }`}
            >
              <span>{gameStage === 'bidding' ? '?' : c.display}</span>
              {gameStage !== 'bidding' && <span className="text-[8px] leading-none">{c.suit}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* AI Companions Row */}
      <div className="flex justify-between items-start pt-1 z-10">
        {/* Player 1 (Left) */}
        <div className="flex flex-col items-center space-y-1 relative">
          {floatingBubbles[p1.id] && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -top-12 left-0 bg-white text-slate-900 text-[11px] font-black px-3 py-1.5 rounded-2xl shadow-2xl border border-amber-300 z-30 whitespace-nowrap max-w-[140px] truncate"
            >
              {floatingBubbles[p1.id]}
            </motion.div>
          )}
          <div className={`relative p-0.5 rounded-full ${currentTurn === 1 ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-emerald-950 animate-pulse' : ''}`}>
            <img src={p1.avatar} alt={p1.name} className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-md" />
            {landlordPlayer === 1 && (
              <Crown size={16} className="absolute -top-2 -right-1 text-amber-400 fill-amber-400 filter drop-shadow" />
            )}
          </div>
          <span className="text-xs font-bold text-white max-w-[70px] truncate">{p1.name}</span>
          <div className="bg-emerald-900/90 border border-emerald-500/60 text-[10px] text-amber-300 font-black px-2 py-0.5 rounded-full shadow">
            <Layers size={12} className="inline mr-1 -mt-0.5" /> {p1Hand.length} 张
          </div>
        </div>

        {/* Table Center (Played Cards with Numbers & Suits) */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-[120px] px-2">
          {lastPlay ? (
            <div className="flex flex-col items-center animate-scaleIn">
              <span className="text-[11px] text-amber-300 font-black mb-1 bg-black/40 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                {lastPlay.player === 0 ? '我' : lastPlay.player === 1 ? p1.name : p2.name} 出牌: {lastPlay.desc}
              </span>
              <div className="flex -space-x-3.5 max-w-full overflow-x-auto py-1">
                {lastPlay.cards.map((c, i) => (
                  <div
                    key={i}
                    className={`w-9 h-13 sm:w-10 sm:h-14 bg-white rounded-lg shadow-xl border border-gray-300 flex flex-col justify-between p-1 font-black shrink-0 ${
                      c.color === 'red' ? 'text-rose-600' : 'text-slate-950'
                    }`}
                  >
                    <div className="flex justify-between items-start leading-none">
                      <span className="text-xs">{c.display}</span>
                      <span className="text-[9px]">{c.suit}</span>
                    </div>
                    <span className="self-center text-sm leading-none">{c.suit}</span>
                    <span className="self-end text-[9px] leading-none transform rotate-180">{c.display}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-xs text-emerald-300/60 italic font-medium">等待首家出牌...</span>
          )}
        </div>

        {/* Player 2 (Right) */}
        <div className="flex flex-col items-center space-y-1 relative">
          {floatingBubbles[p2.id] && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -top-12 right-0 bg-white text-slate-900 text-[11px] font-black px-3 py-1.5 rounded-2xl shadow-2xl border border-amber-300 z-30 whitespace-nowrap max-w-[140px] truncate"
            >
              {floatingBubbles[p2.id]}
            </motion.div>
          )}
          <div className={`relative p-0.5 rounded-full ${currentTurn === 2 ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-emerald-950 animate-pulse' : ''}`}>
            <img src={p2.avatar} alt={p2.name} className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-md" />
            {landlordPlayer === 2 && (
              <Crown size={16} className="absolute -top-2 -right-1 text-amber-400 fill-amber-400 filter drop-shadow" />
            )}
          </div>
          <span className="text-xs font-bold text-white max-w-[70px] truncate">{p2.name}</span>
          <div className="bg-emerald-900/90 border border-emerald-500/60 text-[10px] text-amber-300 font-black px-2 py-0.5 rounded-full shadow">
            <Layers size={12} className="inline mr-1 -mt-0.5" /> {p2Hand.length} 张
          </div>
        </div>
      </div>

      {/* User Hand & Interactive Action Controls */}
      <div className="flex flex-col space-y-2 z-10 pt-1">
        <div className="flex justify-center items-center space-x-2 h-10">
          {gameStage === 'bidding' && currentTurn === 0 && (
            <div className="flex items-center space-x-1.5 animate-fadeIn">
              <button
                type="button"
                onClick={() => handleBid(0)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs shadow-md active:scale-95 cursor-pointer"
              >
                不叫 (0分)
              </button>
              <button
                type="button"
                onClick={() => handleBid(1)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs shadow-md active:scale-95 cursor-pointer"
              >
                1分
              </button>
              <button
                type="button"
                onClick={() => handleBid(2)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md active:scale-95 cursor-pointer"
              >
                2分
              </button>
              <button
                type="button"
                onClick={() => handleBid(3)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black rounded-xl text-xs shadow-lg active:scale-95 cursor-pointer flex items-center space-x-1"
              >
                <Crown size={13} />
                <span>3分 (抢地主)</span>
              </button>
            </div>
          )}

          {gameStage === 'playing' && currentTurn === 0 && (
            <div className="flex items-center space-x-2 animate-fadeIn">
              <button
                type="button"
                onClick={handleUserPass}
                disabled={passCount >= 2 || (lastPlay && lastPlay.player === 0)}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white font-bold rounded-xl text-xs shadow-md active:scale-95 cursor-pointer"
              >
                不出 (过)
              </button>
              <button
                type="button"
                onClick={handleUserHint}
                className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-amber-200 font-bold rounded-xl text-xs shadow-md active:scale-95 cursor-pointer flex items-center space-x-1"
              >
                <Sparkles size={13} />
                <span>提示</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCardIds([])}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-gray-300 font-bold rounded-xl text-xs shadow-md active:scale-95 cursor-pointer"
              >
                重选
              </button>
              <button
                type="button"
                onClick={handleUserPlayCards}
                disabled={selectedCardIds.length === 0}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 disabled:opacity-40 text-slate-950 font-black rounded-xl text-xs shadow-lg active:scale-95 cursor-pointer flex items-center space-x-1"
              >
                <Play size={14} className="fill-slate-950" />
                <span>出牌 ({selectedCardIds.length})</span>
              </button>
            </div>
          )}

          {gameStage === 'playing' && currentTurn !== 0 && (
            <div className="text-xs text-amber-300 font-bold flex items-center space-x-1.5 animate-pulse bg-black/40 px-3.5 py-1 rounded-full border border-emerald-500/20">
              <RotateCcw size={12} className="animate-spin" />
              <span>等待 {currentTurn === 1 ? p1.name : p2.name} 出牌...</span>
            </div>
          )}
        </div>

        {/* Mobile Portrait Compact Hand Cards (竖屏完全适配) */}
        <div className="w-full overflow-x-auto pb-2 pt-3 px-1 scrollbar-none flex justify-center">
          <div className="flex transition-all" style={{ maxWidth: '100%' }}>
            {userHand.map((card, index) => {
              const isSelected = selectedCardIds.includes(card.id);
              // Dynamic negative margin based on number of cards to fit vertical screen perfectly
              const overlapMargin = index === 0 ? 0 : userHand.length > 15 ? -22 : userHand.length > 10 ? -18 : -14;

              return (
                <motion.div
                  key={card.id}
                  onClick={() => toggleSelectCard(card.id)}
                  animate={{ y: isSelected ? -16 : 0 }}
                  whileHover={{ y: isSelected ? -18 : -6 }}
                  style={{ marginLeft: `${overlapMargin}px` }}
                  className={`w-9 h-14 sm:w-10 sm:h-16 rounded-xl bg-white shadow-xl border-2 flex flex-col justify-between p-1 font-black cursor-pointer transition-all shrink-0 select-none ${
                    isSelected
                      ? 'border-amber-400 ring-2 ring-amber-300 shadow-amber-400/40 z-30'
                      : 'border-gray-300 hover:border-amber-200 z-10'
                  } ${card.color === 'red' ? 'text-rose-600' : 'text-slate-950'}`}
                >
                  <div className="flex justify-between items-start leading-none">
                    <span className="text-xs font-black">{card.display}</span>
                    <span className="text-[9px] font-bold">{card.suit}</span>
                  </div>
                  <span className="self-center text-sm leading-none">{card.suit}</span>
                  <span className="self-end text-[8px] leading-none transform rotate-180">{card.display}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameStage === 'gameover' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl text-white space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 mx-auto flex items-center justify-center text-amber-400">
                <Trophy size={32} />
              </div>
              <h3 className="text-xl font-black text-amber-400 flex items-center justify-center space-x-1.5">
                {winner === 0 || (winner !== landlordPlayer && landlordPlayer !== 0) ? (
                  <>
                    <Sparkles size={18} className="inline mr-1 text-amber-300 animate-pulse" />
                    <span>恭喜获得胜利！</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={18} className="inline mr-1 text-rose-400" />
                    <span>本局惜败</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-gray-300">
                获胜者: {winner === 0 ? '我' : winner === 1 ? p1.name : p2.name} (
                {winner === landlordPlayer ? '地主胜利' : '农民胜利'})
              </p>
              <div className="py-2 border-y border-white/10 text-sm font-bold text-amber-300">
                金币结算: {winner === 0 ? `+${200 * roundMultiplier}` : `-${100 * roundMultiplier}`} <Coins size={12} className="inline ml-1" />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onBackToLobby}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
                >
                  返回大厅
                </button>
                <button
                  type="button"
                  onClick={initDoudizhu}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                >
                  再来一局
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// SUB-GAME 2: UNO (优诺) COMPONENT WITH FULL ACTION CARDS
// ==========================================
function UnoGame({
  selectedCompanions,
  onBackToLobby,
  addCoins,
  onWin,
  triggerCharacterBubble,
  floatingBubbles
}: {
  selectedCompanions: GameCompanion[];
  onBackToLobby: () => void;
  addCoins: (n: number) => void;
  onWin: (g: 'ddz' | 'uno') => void;
  triggerCharacterBubble: (id: string, text: string) => void;
  floatingBubbles: { [charId: string]: string };
}) {
  const companions = useMemo(() => selectedCompanions.slice(0, 3), [selectedCompanions]);
  const [userHand, setUserHand] = useState<UNOCard[]>([]);
  const [compHands, setCompHands] = useState<{ [id: string]: UNOCard[] }>({});
  const [discardTop, setDiscardTop] = useState<UNOCard>({
    id: 'init',
    code: 'R7',
    color: 'red',
    colorCode: 'R',
    type: 'number',
    value: 7,
    display: '7'
  });
  const [activeColor, setActiveColor] = useState<UNOColor>('red');
  const [currentTurnIdx, setCurrentTurnIdx] = useState<number>(0);
  const [turnDirection, setTurnDirection] = useState<1 | -1>(1);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [pendingWildCard, setPendingWildCard] = useState<UNOCard | null>(null);
  const [drawnCardPending, setDrawnCardPending] = useState<UNOCard | null>(null);
  const [userUnoDeclared, setUserUnoDeclared] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [gameStage, setGameStage] = useState<'playing' | 'gameover'>('playing');
  const [actionBanner, setActionBanner] = useState<{ text: string; color: string; iconType: string } | null>(null);

  // 6. 抽牌堆与弃牌堆（精确维持 108 张牌守恒）
  const deckRef = useRef<UNOCard[]>([]);
  const discardPileRef = useRef<UNOCard[]>([]);
  const companionsRef = useRef(companions);
  const userHandRef = useRef(userHand);
  const compHandsRef = useRef(compHands);
  const currentTurnIdxRef = useRef(currentTurnIdx);
  const turnDirectionRef = useRef(turnDirection);
  const activeColorRef = useRef(activeColor);
  const discardTopRef = useRef(discardTop);

  companionsRef.current = companions;
  userHandRef.current = userHand;
  compHandsRef.current = compHands;
  currentTurnIdxRef.current = currentTurnIdx;
  turnDirectionRef.current = turnDirection;
  activeColorRef.current = activeColor;
  discardTopRef.current = discardTop;

  const showActionAlert = (text: string, color: string = 'amber', iconType: string = 'sparkle') => {
    setActionBanner({ text, color, iconType });
    setTimeout(() => {
      setActionBanner(prev => (prev?.text === text ? null : prev));
    }, 3000);
  };

  const getPlayerName = (playerIdx: number) => {
    if (playerIdx === 0) return '我';
    return companions[playerIdx - 1]?.name || '角色';
  };

  // 6. 抽牌堆耗尽处理函数
  const drawCards = (count: number): UNOCard[] => {
    const res = drawCardsFromPiles(deckRef.current, discardPileRef.current, count);
    deckRef.current = res.newDrawPile;
    discardPileRef.current = res.newDiscardPile;
    return res.drawn;
  };

  // 3. 游戏初始化与发牌 (3.1 发牌 & 3.2 起始牌特殊处理)
  const initUno = useCallback(() => {
    const fullDeck = generate108UNODeck();
    const userCards = fullDeck.splice(0, 7);
    const comps = companionsRef.current;
    const initialCompHands: { [id: string]: UNOCard[] } = {};

    comps.forEach(c => {
      initialCompHands[c.id] = fullDeck.splice(0, 7);
    });

    // 3.2 起始牌特殊处理:
    // 若起始牌为 WILD 或 WILD+4，将其放回抽牌堆，重新洗牌并翻新牌，直到起始牌不是万能牌。
    let topCard = fullDeck.shift()!;
    while (topCard.type === 'wild' || topCard.type === 'wild4') {
      fullDeck.push(topCard);
      shuffleDeck(fullDeck);
      topCard = fullDeck.shift()!;
    }

    const totalPlayers = comps.length + 1;
    let initialTurn = 0;
    let initialDir: 1 | -1 = 1;
    let startingUserHand = [...userCards];

    // 若起始牌为功能牌：
    // SKIP：第一个玩家被跳过。
    // REVERSE：方向反转，由庄家右手边玩家开始。
    // +2：第一个玩家抽 2 张并跳过。
    // 若起始牌为数字牌：正常开始。
    if (topCard.type === 'skip') {
      initialTurn = getNextTurn(0, 1, totalPlayers, 1);
      showActionAlert(`起始牌为【跳过牌】！第一位玩家被禁手跳过！`, 'rose', 'skip');
    } else if (topCard.type === 'reverse') {
      if (totalPlayers === 2) {
        initialTurn = 1;
        showActionAlert(`起始牌为【反转牌】（2人局视为跳过）！第一位玩家被跳过！`, 'indigo', 'reverse');
      } else {
        initialDir = -1;
        initialTurn = getNextTurn(0, -1, totalPlayers, 1);
        showActionAlert(`起始牌为【反转牌】！出牌方向逆转为逆时针！`, 'indigo', 'reverse');
      }
    } else if (topCard.type === 'draw2') {
      const extraCards = fullDeck.splice(0, 2);
      startingUserHand.push(...extraCards);
      initialTurn = getNextTurn(0, 1, totalPlayers, 1);
      showActionAlert(`起始牌为【+2 罚牌】！第一位玩家摸 2 张牌并被跳过！`, 'amber', 'zap');
    }

    deckRef.current = fullDeck;
    discardPileRef.current = [];

    setUserHand(startingUserHand);
    setCompHands(initialCompHands);
    setDiscardTop(topCard);
    setActiveColor(topCard.color);
    setCurrentTurnIdx(initialTurn);
    setTurnDirection(initialDir);
    setShowColorPicker(false);
    setPendingWildCard(null);
    setDrawnCardPending(null);
    setUserUnoDeclared(false);
    setWinnerName(null);
    setGameStage('playing');
    setActionBanner(null);
  }, []);

  useEffect(() => {
    initUno();
  }, [initUno]);

  // 4. 合法出牌校验（严格包含 WILD+4 不得在持有当前有效颜色牌时出牌的规定）
  const isValidCard = (card: UNOCard) => {
    return isCardPlayable(card, discardTop, activeColor, userHand).valid;
  };

  // 5. 牌效果应用与回合流转
  const applyCardEffectsAndAdvance = (playedBy: number, card: UNOCard, chosenColor: UNOColor) => {
    const totalPlayers = companions.length + 1;
    const actorName = getPlayerName(playedBy);
    const dir = turnDirectionRef.current;

    const directNextIdx = getNextTurn(playedBy, dir, totalPlayers, 1);
    const directNextName = getPlayerName(directNextIdx);

    if (card.type === 'reverse') {
      if (totalPlayers === 2) {
        // 2人局中，反转等同于跳过，当前玩家继续出牌
        showActionAlert(`${actorName} 打出【反转卡】！2人局等同于【跳过】，${directNextName} 被跳过！`, 'indigo', 'reverse');
        const nextIdx = getNextTurn(playedBy, dir, totalPlayers, 2);
        setCurrentTurnIdx(nextIdx);
      } else {
        const newDirection = (dir === 1 ? -1 : 1) as 1 | -1;
        setTurnDirection(newDirection);
        turnDirectionRef.current = newDirection;
        const newNextIdx = getNextTurn(playedBy, newDirection, totalPlayers, 1);
        showActionAlert(`${actorName} 打出【反转卡】！出牌方向变为 ${newDirection === 1 ? '顺时针 ↻' : '逆时针 ↺'}！`, 'indigo', 'reverse');
        setCurrentTurnIdx(newNextIdx);
      }
    } else if (card.type === 'skip') {
      showActionAlert(`${actorName} 打出【跳过卡】！${directNextName} 本轮被禁手跳过！`, 'rose', 'skip');
      if (playedBy === 0 && directNextIdx > 0) {
        triggerCharacterBubble(companions[directNextIdx - 1].id, '居然跳过我！气煞我也！');
      }
      const nextIdx = getNextTurn(playedBy, dir, totalPlayers, 2);
      setCurrentTurnIdx(nextIdx);
    } else if (card.type === 'draw2') {
      const drawnCards = drawCards(2);
      if (directNextIdx === 0) {
        setUserHand(prev => [...prev, ...drawnCards]);
        showActionAlert(`${actorName} 打出【+2 罚牌】！你被罚摸 2 张牌并跳过回合！`, 'amber', 'zap');
      } else {
        const victimComp = companions[directNextIdx - 1];
        setCompHands(prev => ({
          ...prev,
          [victimComp.id]: [...(prev[victimComp.id] || []), ...drawnCards]
        }));
        showActionAlert(`${actorName} 打出【+2 罚牌】！${victimComp.name} 罚摸 2 张牌并跳过！`, 'amber', 'zap');
        triggerCharacterBubble(victimComp.id, '啊！被加了2张牌！手牌越来越多了！');
      }
      const nextIdx = getNextTurn(playedBy, dir, totalPlayers, 2);
      setCurrentTurnIdx(nextIdx);
    } else if (card.type === 'wild4') {
      const drawnCards = drawCards(4);
      if (directNextIdx === 0) {
        setUserHand(prev => [...prev, ...drawnCards]);
        showActionAlert(`${actorName} 打出【WILD+4 万能牌】并指定【${COLOR_MAP[chosenColor]?.name || chosenColor}】！你被罚摸 4 张牌并跳过！`, 'rose', 'flame');
      } else {
        const victimComp = companions[directNextIdx - 1];
        setCompHands(prev => ({
          ...prev,
          [victimComp.id]: [...(prev[victimComp.id] || []), ...drawnCards]
        }));
        showActionAlert(`${actorName} 打出【WILD+4 万能牌】并指定【${COLOR_MAP[chosenColor]?.name || chosenColor}】！${victimComp.name} 罚摸 4 张牌并跳过！`, 'rose', 'flame');
        triggerCharacterBubble(victimComp.id, '太狠了吧！+4暴击直接把我打懵了！');
      }
      const nextIdx = getNextTurn(playedBy, dir, totalPlayers, 2);
      setCurrentTurnIdx(nextIdx);
    } else if (card.type === 'wild') {
      showActionAlert(`${actorName} 打出【WILD 万能变色牌】，将当前有效颜色变为【${COLOR_MAP[chosenColor]?.name || chosenColor}】！`, 'emerald', 'sparkle');
      const nextIdx = getNextTurn(playedBy, dir, totalPlayers, 1);
      setCurrentTurnIdx(nextIdx);
    } else {
      const nextIdx = getNextTurn(playedBy, dir, totalPlayers, 1);
      setCurrentTurnIdx(nextIdx);
    }
  };

  // 玩家真正执行出牌逻辑
  const executeUserCardPlay = (card: UNOCard, chosenColor: UNOColor, isFromPending: boolean = false) => {
    let newHand: UNOCard[];
    if (isFromPending) {
      newHand = [...userHand];
      setDrawnCardPending(null);
    } else {
      newHand = userHand.filter(c => c.id !== card.id);
    }

    // 6. 弃牌堆留存
    discardPileRef.current.push(discardTop);
    setDiscardTop(card);
    setActiveColor(chosenColor);

    // 7. UNO 声明判定
    if (newHand.length === 1) {
      if (userUnoDeclared) {
        setUserUnoDeclared(false);
        showActionAlert('我声明了：“UNO！” 仅剩最后 1 张手牌！', 'amber', 'bell');
        triggerCharacterBubble('user', 'UNO！');
      } else {
        // 未声明 UNO，环境直接罚该玩家抽 2 张牌
        const penalties = drawCards(2);
        newHand = [...newHand, ...penalties];
        showActionAlert('⚠️ 未在出牌时声明 UNO！被对手抓包罚摸 2 张牌！', 'rose', 'flame');
        if (companions.length > 0) {
          triggerCharacterBubble(companions[0].id, '抓到了！你没喊 UNO，罚抽2张！');
        }
      }
    } else {
      setUserUnoDeclared(false);
    }

    setUserHand(newHand);

    // 手牌为 0，游戏结束
    if (newHand.length === 0) {
      setWinnerName('我');
      setGameStage('gameover');
      addCoins(300);
      onWin('uno');
      return;
    }

    applyCardEffectsAndAdvance(0, card, chosenColor);
  };

  // 玩家点击手牌尝试出牌
  const handleUserPlayCard = (card: UNOCard) => {
    if (currentTurnIdx !== 0 || drawnCardPending !== null) return;

    // 4. 合法出牌校验（拦截非法 WILD+4 或不匹配牌）
    const check = isCardPlayable(card, discardTop, activeColor, userHand);
    if (!check.valid) {
      showActionAlert(check.reason || '该牌不可出！请匹配颜色或符号', 'rose', 'ban');
      return;
    }

    if (card.type === 'wild' || card.type === 'wild4') {
      setPendingWildCard(card);
      setShowColorPicker(true);
      return;
    }

    executeUserCardPlay(card, card.color, false);
  };

  // 3.4 玩家回合：抽牌
  const handleUserDrawCard = () => {
    if (currentTurnIdx !== 0 || drawnCardPending !== null) return;
    const drawn = drawCards(1);
    if (drawn.length === 0) {
      showActionAlert('牌堆与弃牌堆均已耗尽，跳过本次抽牌', 'slate', 'ban');
      const totalPlayers = companions.length + 1;
      const nextIdx = getNextTurn(currentTurnIdx, turnDirectionRef.current, totalPlayers, 1);
      setCurrentTurnIdx(nextIdx);
      return;
    }

    const drawnCard = drawn[0];
    const check = isCardPlayable(drawnCard, discardTop, activeColor, [...userHand, drawnCard]);

    if (check.valid) {
      // 3.4: 若抽到的牌可以出，环境会再次询问该玩家是否立即出这张牌
      setDrawnCardPending(drawnCard);
      showActionAlert(`摸到了【${drawnCard.display}】（${COLOR_MAP[drawnCard.color]?.name || drawnCard.color}），可立即打出！`, 'indigo', 'sparkle');
    } else {
      // 3.4: 若抽到的牌不可出，回合自动结束
      setUserHand(prev => [...prev, drawnCard]);
      showActionAlert(`摸到了【${drawnCard.display}】（暂不可出），回合结束`, 'slate', 'draw');
      const totalPlayers = companions.length + 1;
      const nextIdx = getNextTurn(currentTurnIdx, turnDirectionRef.current, totalPlayers, 1);
      setCurrentTurnIdx(nextIdx);
    }
  };

  // 3.4 玩家选择 PASS 不出刚才抽到的牌
  const handlePassDrawnCard = () => {
    if (!drawnCardPending) return;
    setUserHand(prev => [...prev, drawnCardPending]);
    setDrawnCardPending(null);
    showActionAlert('选择不出 (PASS)，保留手牌，回合结束', 'slate', 'pass');
    const totalPlayers = companions.length + 1;
    const nextIdx = getNextTurn(0, turnDirectionRef.current, totalPlayers, 1);
    setCurrentTurnIdx(nextIdx);
  };

  // 3.4 玩家选择立即出刚才抽到的牌
  const handlePlayDrawnCard = () => {
    if (!drawnCardPending) return;
    if (drawnCardPending.type === 'wild' || drawnCardPending.type === 'wild4') {
      setPendingWildCard(drawnCardPending);
      setShowColorPicker(true);
      return;
    }
    executeUserCardPlay(drawnCardPending, drawnCardPending.color, true);
  };

  // 选择万能牌变色
  const handleSelectColor = (chosenColor: UNOColor) => {
    if (pendingWildCard) {
      const isFromPending = drawnCardPending?.id === pendingWildCard.id;
      executeUserCardPlay(pendingWildCard, chosenColor, isFromPending);
      setPendingWildCard(null);
    }
    setShowColorPicker(false);
  };

  // AI 回合流转（只输出合法动作，严格遵守规范）
  useEffect(() => {
    if (gameStage !== 'playing' || currentTurnIdx === 0) return;

    const timer = setTimeout(() => {
      const comps = companionsRef.current;
      const comp = comps[currentTurnIdx - 1];
      if (!comp) {
        setCurrentTurnIdx(0);
        return;
      }

      const hands = compHandsRef.current;
      const currentHand = hands[comp.id] || [];
      const curActiveColor = activeColorRef.current;
      const curTop = discardTopRef.current;
      const totalPlayers = comps.length + 1;
      const nextPlayerIdx = getNextTurn(currentTurnIdx, turnDirectionRef.current, totalPlayers, 1);
      const nextPlayerCount = nextPlayerIdx === 0
        ? userHandRef.current.length
        : (hands[comps[nextPlayerIdx - 1]?.id]?.length ?? 7);

      // AI 选牌策略（只输出合法动作）
      const decision = aiSelectPlayableCard(currentHand, curTop, curActiveColor, nextPlayerCount);

      if (decision) {
        const { card: chosenCard, chosenColor } = decision;
        const remainingHand = currentHand.filter(c => c.id !== chosenCard.id);

        discardPileRef.current.push(curTop);
        setCompHands(prev => ({
          ...prev,
          [comp.id]: remainingHand
        }));
        setDiscardTop(chosenCard);
        setActiveColor(chosenColor);

        // 语音台词与气泡
        if (chosenCard.type === 'wild4') {
          triggerCharacterBubble(comp.id, `吃我一记 +4 王炸！给我变【${COLOR_MAP[chosenColor].name}】！`);
        } else if (chosenCard.type === 'draw2') {
          triggerCharacterBubble(comp.id, `送你一张 +2 罚牌，多摸几张吧！`);
        } else if (chosenCard.type === 'skip') {
          triggerCharacterBubble(comp.id, `跳过！这轮你别想出牌了！`);
        } else if (chosenCard.type === 'reverse') {
          triggerCharacterBubble(comp.id, `反转！牌局方向逆转！`);
        } else if (chosenCard.type === 'wild') {
          triggerCharacterBubble(comp.id, `万能变色！现在由我主导，变【${COLOR_MAP[chosenColor].name}】！`);
        } else {
          triggerCharacterBubble(comp.id, `出 ${COLOR_MAP[chosenCard.color].name} 色【${chosenCard.display}】！`);
        }

        // 7. AI 出牌时若剩 1 张手牌，必须在同一动作中声明 UNO
        if (remainingHand.length === 1) {
          triggerCharacterBubble(comp.id, 'UNO！就剩最后一张牌了！');
          showActionAlert(`${comp.name} 声明：“UNO！” 仅剩 1 张手牌！`, 'amber', 'bell');
        }

        if (remainingHand.length === 0) {
          setWinnerName(comp.name);
          setGameStage('gameover');
          addCoins(-150);
          return;
        }

        applyCardEffectsAndAdvance(currentTurnIdx, chosenCard, chosenColor);
      } else {
        // 3.4 AI 抽牌
        const drawn = drawCards(1);
        if (drawn.length === 0) {
          triggerCharacterBubble(comp.id, '牌堆已抽空，过~');
          const nextIdx = getNextTurn(currentTurnIdx, turnDirectionRef.current, totalPlayers, 1);
          setCurrentTurnIdx(nextIdx);
          return;
        }

        const drawnCard = drawn[0];
        const canPlayDrawn = isCardPlayable(drawnCard, curTop, curActiveColor, [...currentHand, drawnCard]).valid;

        if (canPlayDrawn) {
          // AI 立即出牌并结算
          let chosenColor: UNOColor = drawnCard.color;
          if (drawnCard.type === 'wild' || drawnCard.type === 'wild4') {
            chosenColor = aiChooseBestColor(currentHand);
          }

          discardPileRef.current.push(curTop);
          setDiscardTop(drawnCard);
          setActiveColor(chosenColor);

          triggerCharacterBubble(comp.id, `摸到【${drawnCard.display}】并立即打出！`);
          showActionAlert(`${comp.name} 摸到了【${drawnCard.display}】并立即打出！`, 'indigo', 'sparkle');

          if (currentHand.length === 1) {
            triggerCharacterBubble(comp.id, 'UNO！就剩最后一张牌了！');
            showActionAlert(`${comp.name} 声明：“UNO！” 仅剩 1 张手牌！`, 'amber', 'bell');
          }

          applyCardEffectsAndAdvance(currentTurnIdx, drawnCard, chosenColor);
        } else {
          // AI 保留手牌，回合自动结束
          setCompHands(prev => ({
            ...prev,
            [comp.id]: [...(prev[comp.id] || []), drawnCard]
          }));
          triggerCharacterBubble(comp.id, '摸了一张牌，不可出，过~');
          const nextIdx = getNextTurn(currentTurnIdx, turnDirectionRef.current, totalPlayers, 1);
          setCurrentTurnIdx(nextIdx);
        }
      }
    }, 1100);

    return () => clearTimeout(timer);
  }, [currentTurnIdx, gameStage, companions]);

  // Visual helper for card badges & icons
  const renderCardFace = (card: UNOCard, isLarge: boolean = false) => {
    if (card.type === 'skip') {
      return (
        <div className="flex flex-col items-center justify-center space-y-0.5">
          <Ban size={isLarge ? 28 : 18} className="stroke-[2.8]" />
          <span className={`${isLarge ? 'text-xs' : 'text-[9px]'} font-black tracking-tight`}>跳过</span>
        </div>
      );
    }
    if (card.type === 'reverse') {
      return (
        <div className="flex flex-col items-center justify-center space-y-0.5">
          <RefreshCw size={isLarge ? 26 : 17} className="stroke-[2.8]" />
          <span className={`${isLarge ? 'text-xs' : 'text-[9px]'} font-black tracking-tight`}>反转</span>
        </div>
      );
    }
    if (card.type === 'draw2') {
      return (
        <div className="flex flex-col items-center justify-center space-y-0.5">
          <span className={`${isLarge ? 'text-2xl' : 'text-base'} font-black leading-none`}>+2</span>
          <span className={`${isLarge ? 'text-[10px]' : 'text-[8px]'} font-extrabold tracking-tight`}>抓两张</span>
        </div>
      );
    }
    if (card.type === 'wild') {
      return (
        <div className="flex flex-col items-center justify-center space-y-0.5">
          <Sparkles size={isLarge ? 28 : 18} className="text-amber-300" />
          <span className={`${isLarge ? 'text-xs' : 'text-[9px]'} font-black text-amber-200 tracking-tight`}>变色</span>
        </div>
      );
    }
    if (card.type === 'wild4') {
      return (
        <div className="flex flex-col items-center justify-center space-y-0.5">
          <span className={`${isLarge ? 'text-2xl' : 'text-base'} font-black text-amber-300 leading-none`}>+4</span>
          <span className={`${isLarge ? 'text-[10px]' : 'text-[8px]'} font-black text-white tracking-tight`}>变色+4</span>
        </div>
      );
    }
    return (
      <span className={`${isLarge ? 'text-4xl' : 'text-xl'} font-black leading-none`}>
        {card.display}
      </span>
    );
  };

  if (companions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-500 shadow-sm">
          <Users size={32} />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <h3 className="text-sm font-black text-slate-800">联系人列表未添加人设</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            UNO对决不设预设陪玩NPC，需在手机通讯录中至少添加 1 位角色人设后方可开启该功能。
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToLobby}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
        >
          返回游戏大厅
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-3 select-none relative overflow-hidden">
      {/* Top Action Notification Banner */}
      <AnimatePresence>
        {actionBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`absolute top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full font-black text-xs shadow-2xl border flex items-center space-x-2 backdrop-blur-md whitespace-nowrap ${
              actionBanner.color === 'rose'
                ? 'bg-rose-600/95 text-white border-rose-300'
                : actionBanner.color === 'amber'
                ? 'bg-amber-500/95 text-slate-950 border-amber-200'
                : actionBanner.color === 'indigo'
                ? 'bg-indigo-600/95 text-white border-indigo-300'
                : 'bg-emerald-600/95 text-white border-emerald-300'
            }`}
          >
            {actionBanner.iconType === 'flame' && <Flame size={15} className="animate-bounce" />}
            {actionBanner.iconType === 'zap' && <Zap size={15} className="animate-bounce" />}
            {actionBanner.iconType === 'skip' && <Ban size={15} className="animate-bounce" />}
            {actionBanner.iconType === 'reverse' && <RefreshCw size={15} className="animate-spin" />}
            {actionBanner.iconType === 'sparkle' && <Sparkles size={15} className="animate-pulse" />}
            <span>{actionBanner.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info: Active Color & Direction */}
      <div className="flex items-center justify-between z-10 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-indigo-500/30 text-xs text-white">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-amber-400">当前有效颜色:</span>
          <div className="flex items-center space-x-1.5 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
            <span
              className={`w-3.5 h-3.5 rounded-full border border-white shadow ${
                activeColor === 'red'
                  ? 'bg-rose-500'
                  : activeColor === 'blue'
                  ? 'bg-sky-500'
                  : activeColor === 'green'
                  ? 'bg-emerald-500'
                  : 'bg-amber-400'
              }`}
            />
            <span className="font-black text-xs text-white">{COLOR_MAP[activeColor]?.name || activeColor}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] text-gray-400">出牌方向:</span>
          <span className="font-bold text-indigo-300 flex items-center space-x-1">
            <RefreshCw size={11} className={turnDirection === -1 ? 'transform -scale-x-100' : ''} />
            <span>{turnDirection === 1 ? '顺时针 ↻' : '逆时针 ↺'}</span>
          </span>
        </div>
      </div>

      {/* Companions In Game */}
      <div className="flex justify-around items-center pt-2 z-10">
        {companions.map((comp, idx) => {
          const isTurn = currentTurnIdx === idx + 1;
          const count = compHands[comp.id]?.length ?? 7;

          return (
            <div key={comp.id} className="flex flex-col items-center space-y-1 relative">
              {floatingBubbles[comp.id] && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute -top-12 bg-white text-slate-800 text-[11px] font-black px-3 py-1.5 rounded-2xl shadow-xl border border-indigo-300 z-30 whitespace-nowrap max-w-[130px] truncate"
                >
                  {floatingBubbles[comp.id]}
                </motion.div>
              )}
              <div className={`p-0.5 rounded-full relative ${isTurn ? 'ring-4 ring-indigo-400 ring-offset-2 ring-offset-slate-900 animate-pulse' : ''}`}>
                <img src={comp.avatar} alt={comp.name} className="w-12 h-12 rounded-full object-cover border-2 border-indigo-400 shadow-md" />
                {count === 1 && (
                  <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full border border-white animate-bounce shadow">
                    UNO!
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-white max-w-[70px] truncate">{comp.name}</span>
              <div className="bg-indigo-900/90 border border-indigo-500/60 text-[10px] text-amber-300 font-extrabold px-2 py-0.5 rounded-full shadow">
                <Layers size={12} className="inline mr-1 -mt-0.5" /> {count} 张
              </div>
            </div>
          );
        })}
      </div>

      {/* Discard & Draw Center */}
      <div className="flex items-center justify-center space-x-6 my-auto z-10">
        {/* Draw Pile (摸牌) */}
        <div
          onClick={handleUserDrawCard}
          className="w-16 h-24 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 border-2 border-slate-500 shadow-2xl flex flex-col items-center justify-center p-2 cursor-pointer hover:border-amber-400 transition-all active:scale-95 group relative select-none"
        >
          <Layers size={22} className="text-gray-300 group-hover:text-amber-400 transition-colors" />
          <span className="text-[10px] font-bold text-gray-300 mt-1">摸牌</span>
          <span className="text-[8px] text-gray-400">({deckRef.current.length}张)</span>
        </div>

        {/* Current Discard Top (牌桌中央顶牌) */}
        <motion.div
          key={discardTop.id}
          initial={{ scale: 0.8, rotate: -8 }}
          animate={{ scale: 1, rotate: 0 }}
          className={`w-22 h-32 rounded-2xl shadow-2xl border-2 border-white flex flex-col justify-between p-2 font-black select-none ${
            discardTop.color === 'red'
              ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-600/30'
              : discardTop.color === 'blue'
              ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sky-600/30'
              : discardTop.color === 'green'
              ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-emerald-600/30'
              : discardTop.color === 'yellow'
              ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 shadow-amber-500/30'
              : 'bg-gradient-to-br from-purple-700 via-rose-600 to-amber-500 text-white shadow-purple-600/40 ring-2 ring-amber-300'
          }`}
        >
          <div className="flex justify-between items-start leading-none text-xs">
            <span>{discardTop.display}</span>
            {discardTop.type !== 'number' && <span className="text-[9px] uppercase">{discardTop.type}</span>}
          </div>

          <div className="self-center">
            {renderCardFace(discardTop, true)}
          </div>

          <div className="flex justify-between items-end leading-none text-xs transform rotate-180">
            <span>{discardTop.display}</span>
            {discardTop.type !== 'number' && <span className="text-[9px] uppercase">{discardTop.type}</span>}
          </div>
        </motion.div>
      </div>

      {/* User Hand & Interactive Action Controls */}
      <div className="flex flex-col space-y-2 z-10 pt-1">
        <div className="flex justify-center items-center space-x-2.5 h-8">
          {currentTurnIdx === 0 ? (
            <div className="flex items-center space-x-2">
              <span className="text-xs text-amber-300 font-bold bg-black/50 px-3.5 py-1 rounded-full border border-indigo-500/30">
                <Sparkles size={12} className="inline mr-1" />轮到你出牌
              </span>
              {userHand.length <= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setUserUnoDeclared(prev => !prev);
                    if (!userUnoDeclared) {
                      showActionAlert('已声明 UNO！出牌后手牌剩 1 张时不会被罚牌！', 'amber', 'bell');
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-black transition-all flex items-center space-x-1 active:scale-95 cursor-pointer ${
                    userUnoDeclared
                      ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/50 ring-2 ring-white animate-pulse'
                      : 'bg-rose-600 hover:bg-rose-500 text-white shadow-md animate-bounce'
                  }`}
                  title="手牌剩2张出牌前请务必声明 UNO，否则出完剩1张时会被抓包罚抽2张！"
                >
                  <Bell size={12} />
                  <span>{userUnoDeclared ? '✓ 已声明 UNO' : '📢 喊 UNO!'}</span>
                </button>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400 flex items-center space-x-1 bg-black/40 px-3 py-1 rounded-full border border-slate-700">
              <RotateCcw size={12} className="animate-spin" />
              <span>等待 {companions[currentTurnIdx - 1]?.name} 出牌...</span>
            </span>
          )}
        </div>

        {/* User Card Horizontal List */}
        <div className="w-full overflow-x-auto pb-2 pt-2 px-1 scrollbar-none flex justify-center">
          <div className="flex transition-all" style={{ maxWidth: '100%' }}>
            {userHand.map((card, index) => {
              const playable = currentTurnIdx === 0 && isValidCard(card);
              const overlapMargin = index === 0 ? 0 : userHand.length > 12 ? -24 : userHand.length > 8 ? -18 : -12;

              return (
                <motion.div
                  key={card.id}
                  onClick={() => handleUserPlayCard(card)}
                  whileHover={playable ? { y: -16, scale: 1.05 } : {}}
                  style={{ marginLeft: `${overlapMargin}px` }}
                  className={`w-11 h-18 sm:w-13 sm:h-20 rounded-xl shadow-xl border-2 flex flex-col justify-between p-1 font-black cursor-pointer transition-all shrink-0 select-none ${
                    playable
                      ? 'border-white ring-2 ring-amber-400/90 -translate-y-2.5 z-30 shadow-amber-400/30'
                      : 'border-gray-600 opacity-55 hover:opacity-80 z-10'
                  } ${
                    card.color === 'red'
                      ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white'
                      : card.color === 'blue'
                      ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white'
                      : card.color === 'green'
                      ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white'
                      : card.color === 'yellow'
                      ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950'
                      : 'bg-gradient-to-br from-purple-700 via-rose-600 to-amber-500 text-white border-amber-300'
                  }`}
                >
                  <span className="text-[10px] self-start leading-none">{card.display}</span>
                  <div className="self-center">
                    {renderCardFace(card, false)}
                  </div>
                  <span className="text-[10px] self-end leading-none transform rotate-180">{card.display}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Wild Color Picker Dialog */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl p-5 text-center max-w-xs w-full shadow-2xl space-y-4">
              <div>
                <h3 className="text-sm font-black text-white flex items-center justify-center space-x-1.5">
                  {pendingWildCard?.type === 'wild4' ? (
                    <>
                      <Zap size={14} className="text-amber-400 inline mr-1" />
                      <span>打出 +4 王炸！请指定变色</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-emerald-400 inline mr-1" />
                      <span>打出万能牌！请指定变色</span>
                    </>
                  )}
                </h3>
                <p className="text-[11px] text-gray-400 mt-1">选择接下来牌桌的有效出牌颜色</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (pendingWildCard) executeUserCardPlay(pendingWildCard, 'red');
                    setShowColorPicker(false);
                  }}
                  className="py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-md active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <span className="w-3 h-3 rounded-full bg-white/80" />
                  <span>红色 (Red)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingWildCard) executeUserCardPlay(pendingWildCard, 'blue');
                    setShowColorPicker(false);
                  }}
                  className="py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs shadow-md active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <span className="w-3 h-3 rounded-full bg-white/80" />
                  <span>蓝色 (Blue)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingWildCard) executeUserCardPlay(pendingWildCard, 'green');
                    setShowColorPicker(false);
                  }}
                  className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <span className="w-3 h-3 rounded-full bg-white/80" />
                  <span>绿色 (Green)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (pendingWildCard) executeUserCardPlay(pendingWildCard, 'yellow');
                    setShowColorPicker(false);
                  }}
                  className="py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <span className="w-3 h-3 rounded-full bg-slate-900/60" />
                  <span>黄色 (Yellow)</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3.4 抽牌后可立即出牌的询问弹窗 */}
      <AnimatePresence>
        {drawnCardPending && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl p-5 text-center max-w-xs w-full shadow-2xl space-y-4">
              <div>
                <h3 className="text-sm font-black text-white flex items-center justify-center space-x-1.5">
                  <Sparkles size={16} className="text-amber-400 inline mr-1" />
                  <span>抽到可出牌！是否立即打出？</span>
                </h3>
                <p className="text-[11px] text-gray-400 mt-1">按经典规则可选择立即打出该牌，或不出 (PASS) 保留在手牌中</p>
              </div>

              {/* Card preview */}
              <div className="flex justify-center py-2">
                <div
                  className={`w-14 h-22 rounded-xl shadow-xl border-2 flex flex-col justify-between p-1.5 font-black ${
                    drawnCardPending.color === 'red'
                      ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white border-white'
                      : drawnCardPending.color === 'blue'
                      ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white border-white'
                      : drawnCardPending.color === 'green'
                      ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white border-white'
                      : drawnCardPending.color === 'yellow'
                      ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 border-white'
                      : 'bg-gradient-to-br from-purple-700 via-rose-600 to-amber-500 text-white border-amber-300'
                  }`}
                >
                  <span className="text-xs self-start leading-none">{drawnCardPending.display}</span>
                  <div className="self-center">
                    {renderCardFace(drawnCardPending, false)}
                  </div>
                  <span className="text-xs self-end leading-none transform rotate-180">{drawnCardPending.display}</span>
                </div>
              </div>

              <div className="flex space-x-2 pt-1">
                <button
                  type="button"
                  onClick={handlePassDrawnCard}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md active:scale-95 cursor-pointer"
                >
                  不出 (PASS)
                </button>
                <button
                  type="button"
                  onClick={handlePlayDrawnCard}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-xs shadow-lg active:scale-95 cursor-pointer flex items-center justify-center space-x-1"
                >
                  <Play size={14} className="fill-slate-950" />
                  <span>立即打出</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Over Modal */}
      <AnimatePresence>
        {gameStage === 'gameover' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-500/30 rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl text-white space-y-4">
              <div className="w-16 h-16 rounded-full bg-indigo-500/20 border-2 border-indigo-400 mx-auto flex items-center justify-center text-indigo-400">
                <Trophy size={32} />
              </div>
              <h3 className="text-xl font-black text-indigo-300 flex items-center justify-center space-x-1.5">
                {winnerName === '我' ? (
                  <>
                    <Sparkles size={18} className="inline mr-1 text-amber-300 animate-pulse" />
                    <span>UNO 最终决胜！</span>
                  </>
                ) : (
                  <span>👑 {winnerName} 获得胜利！</span>
                )}
              </h3>
              <p className="text-xs text-gray-300">
                {winnerName === '我' ? '恭喜你在角色对决中率先打光所有手牌！' : '很遗憾，被对手先一步出完了手牌~'}
              </p>
              <div className="py-2 border-y border-white/10 text-sm font-bold text-amber-300">
                金币结算: {winnerName === '我' ? '+300' : '-150'} <Coins size={12} className="inline ml-1" />
              </div>
              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={onBackToLobby}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold cursor-pointer"
                >
                  返回大厅
                </button>
                <button
                  type="button"
                  onClick={initUno}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-xs shadow-lg cursor-pointer"
                >
                  再来一局
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================

export default function GameCenterView({ onHome }: { onHome: () => void }) {
  const [activeGame, setActiveGame] = useState<ActiveGameType>('lobby');
  const [lobbyTab, setLobbyTab] = useState<'games' | 'workbench'>('games');
  const [coins, setCoins] = useState<number>(() => {
    const saved = localStorage.getItem('game_center_coins');
    return saved !== null ? Number(saved) : 1888;
  });
  const [gameStats, setGameStats] = useState<{ ddzWins: number; unoWins: number }>(() => {
    const saved = localStorage.getItem('game_center_stats');
    return saved ? JSON.parse(saved) : { ddzWins: 0, unoWins: 0 };
  });

  const [allContacts, setAllContacts] = useState<GameCompanion[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<GameCompanion[]>([]);
  const [showCompanionPicker, setShowCompanionPicker] = useState<boolean>(false);
  const [pendingGameToStart, setPendingGameToStart] = useState<ActiveGameType | null>(null);

  const [chatMessages, setChatMessages] = useState<InGameMessage[]>([]);
  const [showChatDrawer, setShowChatDrawer] = useState<boolean>(false);
  const [chatInputText, setChatInputText] = useState<string>('');
  const [floatingBubbles, setFloatingBubbles] = useState<{ [charId: string]: string }>({});

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const sessions = await dbInstance.getAllSessions();
        const validChars = (sessions || []).filter(s => !s.isGroup && !s.isContactDeleted);
        if (validChars && validChars.length > 0) {
          const mapped: GameCompanion[] = validChars.map((s: ChatSession) => ({
            id: s.id,
            name: s.realName || s.characterName || '好友',
            avatar: s.characterAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
            persona: s.relationship || s.userImpression || s.memory?.slice(0, 40) || '你的好友，善于交际。',
            quote: '随时奉陪！'
          }));
          setAllContacts(mapped);
          setSelectedCompanions(mapped.slice(0, 2));
        } else {
          setAllContacts([]);
          setSelectedCompanions([]);
        }
      } catch (e) {
        setAllContacts([]);
        setSelectedCompanions([]);
      }
    };
    fetchContacts();
  }, []);

  const [lobbyAlert, setLobbyAlert] = useState<string | null>(null);
  const showLobbyAlert = useCallback((msg: string) => {
    setLobbyAlert(msg);
    setTimeout(() => {
      setLobbyAlert(prev => (prev === msg ? null : prev));
    }, 2800);
  }, []);

  const addCoins = useCallback((amount: number) => {
    setCoins(prev => {
      const updated = Math.max(0, prev + amount);
      localStorage.setItem('game_center_coins', String(updated));
      return updated;
    });
  }, []);

  const handleGameWin = useCallback((type: 'ddz' | 'uno') => {
    setGameStats(prev => {
      const updated = {
        ...prev,
        ddzWins: type === 'ddz' ? prev.ddzWins + 1 : prev.ddzWins,
        unoWins: type === 'uno' ? prev.unoWins + 1 : prev.unoWins,
      };
      localStorage.setItem('game_center_stats', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const triggerCharacterBubble = useCallback((charId: string, text: string) => {
    setFloatingBubbles(prev => ({ ...prev, [charId]: text }));
    setTimeout(() => {
      setFloatingBubbles(prev => {
        const next = { ...prev };
        if (next[charId] === text) {
          delete next[charId];
        }
        return next;
      });
    }, 4000);
  }, []);

  const handleSendChatMessage = (textToSend?: string) => {
    const text = textToSend || chatInputText.trim();
    if (!text) return;

    const userMsg: InGameMessage = {
      id: `msg_${Date.now()}`,
      senderName: '我',
      text: text,
      isUser: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInputText('');

    if (selectedCompanions.length > 0) {
      const responder = selectedCompanions[Math.floor(Math.random() * selectedCompanions.length)];
      setTimeout(() => {
        let reply = '';
        if (text.includes('好') || text.includes('厉害')) {
          reply = `${responder.name}：“基操勿六，看我这把怎么带飞你。”`;
        } else if (text.includes('骗') || text.includes('吹牛')) {
          reply = `${responder.name}：“眼神这么犀利？那你就大胆质疑我试试看。”`;
        } else if (text.includes('输') || text.includes('放水')) {
          reply = `${responder.name}：“放水是不可能的，不过输了请你喝奶茶倒是可以。”`;
        } else if (text.includes('王炸') || text.includes('炸')) {
          reply = `${responder.name}：“别虚张声势了，有炸弹赶紧亮出来！”`;
        } else {
          const randomReplies = [
            `“别分心，该你出牌了。”`,
            `“你的表情已经出卖了你的底牌。”`,
            `“打得不错，不过我的牌也不赖。”`,
            `“胜负未定，鹿死谁手还不一定呢。”`
          ];
          reply = `${responder.name}：${randomReplies[Math.floor(Math.random() * randomReplies.length)]}`;
        }

        const compMsg: InGameMessage = {
          id: `msg_${Date.now() + 1}`,
          senderName: responder.name,
          senderAvatar: responder.avatar,
          text: reply,
          isUser: false,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, compMsg]);
        triggerCharacterBubble(responder.id, reply.replace(`${responder.name}：`, '').replace(/[“”]/g, ''));
      }, 600);
    }
  };

  const handleStartGameWithCompanions = (game: ActiveGameType) => {
    if (game === 'doudizhu' && allContacts.length < 2) {
      showLobbyAlert('联系人列表未添加人设（斗地主需至少2位联系人人设陪玩），请先在通讯录添加人设角色！');
      return;
    }
    if (game === 'uno' && allContacts.length === 0) {
      showLobbyAlert('联系人列表未添加人设（UNO需至少1位联系人人设陪玩），请先在通讯录添加人设角色！');
      return;
    }
    setPendingGameToStart(game);
    if (game === 'doudizhu') {
      if (selectedCompanions.length !== 2 && allContacts.length >= 2) {
        setSelectedCompanions(allContacts.slice(0, 2));
      }
    } else if (game === 'uno') {
      if (selectedCompanions.length === 0 && allContacts.length > 0) {
        setSelectedCompanions(allContacts.slice(0, Math.min(allContacts.length, 3)));
      }
    }
    setShowCompanionPicker(true);
  };

  const confirmCompanionsAndLaunch = () => {
    if (!pendingGameToStart) return;
    if (pendingGameToStart === 'doudizhu' && selectedCompanions.length !== 2) {
      showLobbyAlert('斗地主需要选择 2 位联系人角色陪玩！');
      return;
    }
    if (pendingGameToStart === 'uno' && selectedCompanions.length === 0) {
      showLobbyAlert('UNO需要选择至少 1 位联系人角色陪玩！');
      return;
    }
    setShowCompanionPicker(false);
    setActiveGame(pendingGameToStart);
    setChatMessages([]);
    setFloatingBubbles({});
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F9FCFF] text-slate-800 font-sans relative overflow-hidden select-none">
      {/* Standardized App Header Bar */}
      {activeGame !== 'aiAdventure' && !(activeGame === 'lobby' && lobbyTab === 'workbench') && (
        <div className="h-16 px-4 bg-white/90 backdrop-blur-md border-b border-gray-200 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => {
                if (activeGame !== 'lobby') {
                  setActiveGame('lobby');
                } else {
                  onHome();
                }
              }}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shrink-0"
              title={activeGame === 'lobby' ? "返回手机桌面" : "返回游戏大厅"}
            >
              {activeGame === 'lobby' ? (
                <Home size={16} className="stroke-[2.5]" />
              ) : (
                <ArrowLeft size={16} className="stroke-[2.5]" />
              )}
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-slate-950 shadow-sm shrink-0">
                <Gamepad2 size={16} className="stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 leading-none">
                  {activeGame === 'lobby'
                    ? '游戏中心'
                    : activeGame === 'doudizhu'
                    ? '经典斗地主'
                    : activeGame === 'uno'
                    ? 'UNO 优诺对决'
                    : ''}
                </h2>
                {activeGame !== 'lobby' ? (
                  <div className="text-[10px] text-gray-500 uppercase mt-1 leading-none">
                    局内实时嘴炮互动已开启
                  </div>
                ) : (
                  <p className="text-[10px] font-sans text-slate-400 uppercase mt-1 leading-none">Casual Mini Games</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Status */}
          <div className="flex items-center space-x-2">
            {activeGame !== 'lobby' && (
              <button
                type="button"
                onClick={() => setShowChatDrawer(true)}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-full text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors active:scale-95"
              >
                <MessageCircle size={14} />
                <span>互动台词</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* View Content */}
      {activeGame === 'lobby' && (
        <div className="flex-1 flex flex-col min-h-0 relative">
          {lobbyTab === 'games' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
              <div className="grid grid-cols-2 gap-4 items-stretch justify-center">
                <div className="bg-white border border-gray-200 rounded-3xl p-4 flex flex-col items-center justify-center h-full min-h-[96px] text-center shadow-xs">
                  <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">斗地主胜场</span>
                  <span className="text-lg font-black mt-2" style={{ color: '#ce992d' }}>{gameStats.ddzWins} 场</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-3xl p-4 flex flex-col items-center justify-center h-full min-h-[96px] text-center shadow-xs">
                  <span className="text-[10px] text-gray-400 block font-bold uppercase tracking-wider">UNO胜场</span>
                  <span className="text-lg font-black mt-2" style={{ color: '#449be3' }}>{gameStats.unoWins} 场</span>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-black text-gray-600 uppercase tracking-wider">精选卡牌桌游</span>
                  <span className="text-[10px] text-amber-400 font-bold">即开即玩 · 流畅对局</span>
                </div>

                {/* 经典斗地主 Card */}
                {(() => {
                  const isDdzAvailable = allContacts.length >= 2;
                  return (
                    <div
                      onClick={() => {
                        if (!isDdzAvailable) {
                          showLobbyAlert('联系人列表未添加人设（斗地主需至少2位联系人人设陪玩），请先在通讯录添加人设角色！');
                          return;
                        }
                        handleStartGameWithCompanions('doudizhu');
                      }}
                      className={`border rounded-3xl p-4 transition-all flex items-center justify-between group ${
                        isDdzAvailable
                          ? 'bg-white border-gray-200 hover:border-amber-400 shadow-sm hover:shadow-md hover:shadow-amber-500/10 cursor-pointer active:scale-[0.99]'
                          : 'bg-gray-50/80 border-gray-200/70 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div
                          className={`w-13 h-13 shrink-0 rounded-2xl flex items-center justify-center transition-transform shadow-xs ${
                            isDdzAvailable ? 'group-hover:scale-105' : 'grayscale-[40%]'
                          }`}
                          style={{ backgroundColor: '#ffc242' }}
                        >
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            {/* 倾斜底牌 */}
                            <rect x="2.5" y="5.5" width="11" height="15" rx="1.8" fill="#ffc242" stroke="#ce992d" strokeWidth="1.8" transform="rotate(-14 8 13)" />
                            {/* 正向顶牌 */}
                            <rect x="9.5" y="3.5" width="11" height="15" rx="1.8" fill="#ffc242" stroke="#ce992d" strokeWidth="1.8" />
                            {/* 牌面 A 与 菱形花色 */}
                            <text x="11.2" y="9.2" fontSize="5.5" fontWeight="900" fill="#ce992d" fontFamily="system-ui, sans-serif">A</text>
                            <path d="M15 11.2 L16.8 13.8 L15 16.4 L13.2 13.8 Z" fill="#ce992d" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-black text-slate-800">经典斗地主</h3>
                            <span
                              className="text-[9px] px-2 py-0.5 rounded-full font-bold border"
                              style={
                                isDdzAvailable
                                  ? { backgroundColor: '#fff8e7', color: '#ce992d', borderColor: '#fce3a6' }
                                  : { backgroundColor: '#f1f5f9', color: '#94a3b8', borderColor: '#e2e8f0' }
                              }
                            >
                              {isDdzAvailable ? '3人对战' : '暂不可用 · 缺人设'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {isDdzAvailable
                              ? '叫抢地主、王炸连对、经典农民与地主博弈'
                              : '联系人列表未添加人设，暂无陪玩NPC'}
                          </p>
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isDdzAvailable
                          ? 'bg-gray-100 text-gray-500 group-hover:text-amber-500 group-hover:bg-gray-200 transition-colors'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isDdzAvailable ? <ChevronRight size={18} /> : <Lock size={15} />}
                      </div>
                    </div>
                  );
                })()}

                {/* UNO 优诺 Card */}
                {(() => {
                  const isUnoAvailable = allContacts.length > 0;
                  return (
                    <div
                      onClick={() => {
                        if (!isUnoAvailable) {
                          showLobbyAlert('联系人列表未添加人设（UNO需至少1位联系人人设陪玩），请先在通讯录添加人设角色！');
                          return;
                        }
                        handleStartGameWithCompanions('uno');
                      }}
                      className={`border rounded-3xl p-4 transition-all flex items-center justify-between group ${
                        isUnoAvailable
                          ? 'bg-white border-gray-200 hover:border-sky-400 shadow-sm hover:shadow-md hover:shadow-sky-500/10 cursor-pointer active:scale-[0.99]'
                          : 'bg-gray-50/80 border-gray-200/70 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div
                          className={`w-13 h-13 shrink-0 rounded-2xl border flex items-center justify-center transition-transform shadow-xs ${
                            isUnoAvailable
                              ? 'border-sky-300/40 group-hover:scale-105'
                              : 'border-gray-200 grayscale-[40%]'
                          }`}
                          style={{ backgroundColor: isUnoAvailable ? '#98cffb' : '#e2e8f0' }}
                        >
                          <Layers
                            size={26}
                            className="stroke-[2.2]"
                            style={{ color: isUnoAvailable ? '#449be3' : '#94a3b8' }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-black text-slate-800">UNO 优诺</h3>
                            <span
                              className="text-[9px] px-2 py-0.5 rounded-full font-bold border"
                              style={
                                isUnoAvailable
                                  ? { backgroundColor: '#f0f8ff', color: '#449be3', borderColor: '#c1e2fd' }
                                  : { backgroundColor: '#f1f5f9', color: '#94a3b8', borderColor: '#e2e8f0' }
                              }
                            >
                              {isUnoAvailable ? '2~4人狂欢' : '暂不可用 · 缺人设'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {isUnoAvailable
                              ? '转盘变色、+4惩罚、反转跳过与高燃喊UNO'
                              : '联系人列表未添加人设，暂无陪玩NPC'}
                          </p>
                        </div>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isUnoAvailable
                          ? 'bg-gray-100 text-gray-500 group-hover:text-sky-500 group-hover:bg-gray-200 transition-colors'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                        {isUnoAvailable ? <ChevronRight size={18} /> : <Lock size={15} />}
                      </div>
                    </div>
                  );
                })()}

                <div
                  onClick={() => setActiveGame('aiAdventure')}
                  className="bg-white border border-gray-200 hover:border-violet-400 rounded-3xl p-4 transition-all shadow-sm hover:shadow-md hover:shadow-violet-500/10 cursor-pointer active:scale-[0.99] flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-13 h-13 shrink-0 rounded-2xl border border-violet-300/40 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs" style={{ backgroundColor: '#e2d9f3' }}>
                      <Sparkles size={26} className="stroke-[2.2]" style={{ color: '#8b5cf6' }} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-black text-slate-800">AI 文字冒险</h3>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border" style={{ backgroundColor: '#f5f3ff', color: '#8b5cf6', borderColor: '#ddd6fe' }}>
                          1人沉浸冒险
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">自定义大纲、智能解析、无限探索与专属GM</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:text-violet-500 group-hover:bg-gray-200 transition-colors shrink-0">
                    <ChevronRight size={18} />
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50 relative pb-16">
              <WorkbenchView onHome={onHome} />
            </div>
          )}

          {/* Elegant persistent lobby bottom navigation tab bar */}
          <div className="absolute bottom-0 inset-x-0 h-16 bg-white border-t border-gray-200/80 px-6 flex items-center justify-around z-30 shadow-lg shadow-gray-100">
            <button
              type="button"
              onClick={() => setLobbyTab('games')}
              className={`flex flex-col items-center justify-center space-y-1 transition-all focus:outline-none cursor-pointer ${
                lobbyTab === 'games' ? 'text-[#5b7d61] scale-105' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Gamepad2 size={20} className={lobbyTab === 'games' ? 'stroke-[2.5]' : 'stroke-[2]'} />
              <span className="text-[10px] font-black">游戏大厅</span>
            </button>
            <button
              type="button"
              onClick={() => setLobbyTab('workbench')}
              className={`flex flex-col items-center justify-center space-y-1 transition-all focus:outline-none cursor-pointer ${
                lobbyTab === 'workbench' ? 'text-[#5b7d61] scale-105' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <PenTool size={20} className={lobbyTab === 'workbench' ? 'stroke-[2.5]' : 'stroke-[2]'} />
              <span className="text-[10px] font-black">工作台</span>
            </button>
          </div>
        </div>
      )}

      {/* Sub-game views with stable top-level components */}
      {activeGame === 'doudizhu' && (
        selectedCompanions.length >= 2 ? (
          <DoudizhuGame
            selectedCompanions={selectedCompanions}
            onBackToLobby={() => setActiveGame('lobby')}
            addCoins={addCoins}
            onWin={handleGameWin}
            triggerCharacterBubble={triggerCharacterBubble}
            floatingBubbles={floatingBubbles}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-sm">
              <Users size={32} />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <h3 className="text-sm font-black text-slate-800">联系人列表未添加人设</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                斗地主不设预设陪玩NPC，需在手机通讯录中至少添加 2 位角色人设后方可开启该功能。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveGame('lobby')}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              返回游戏大厅
            </button>
          </div>
        )
      )}

      {activeGame === 'uno' && (
        selectedCompanions.length > 0 ? (
          <UnoGame
            selectedCompanions={selectedCompanions}
            onBackToLobby={() => setActiveGame('lobby')}
            addCoins={addCoins}
            onWin={handleGameWin}
            triggerCharacterBubble={triggerCharacterBubble}
            floatingBubbles={floatingBubbles}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-500 shadow-sm">
              <Users size={32} />
            </div>
            <div className="space-y-1.5 max-w-xs">
              <h3 className="text-sm font-black text-slate-800">联系人列表未添加人设</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                UNO对决不设预设陪玩NPC，需在手机通讯录中至少添加 1 位角色人设后方可开启该功能。
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveGame('lobby')}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              返回游戏大厅
            </button>
          </div>
        )
      )}

      {activeGame === 'aiAdventure' && (
        <AiAdventureGame
          onBackToLobby={() => setActiveGame('lobby')}
        />
      )}

      {/* Companion Picker Modal */}
      <AnimatePresence>
        {showCompanionPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md z-40 flex items-center justify-center p-4"
          >
            <div className="bg-white border border-gray-200 rounded-3xl p-5 max-w-sm w-full shadow-2xl text-slate-800 space-y-4">
              <div className="flex justify-between items-center pb-1 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <Users size={18} className="text-amber-400" />
                  <h3 className="text-sm font-black text-slate-800">
                    {pendingGameToStart === 'doudizhu' ? '选择斗地主陪玩角色 (需2人)' : '选择UNO陪玩角色 (需1~3人)'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCompanionPicker(false)}
                  className="p-1 text-gray-500 hover:text-slate-800 rounded-full bg-gray-100"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {allContacts.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-2.5 border border-dashed border-gray-200 rounded-2xl bg-gray-50/70">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                      <Users size={22} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-700">联系人列表暂无人设</h4>
                      <p className="text-[10px] text-slate-400 max-w-[210px] mx-auto leading-relaxed">
                        当前未添加任何联系人人设角色，无法开启陪玩对局。请先在手机通讯录中添加角色人设！
                      </p>
                    </div>
                  </div>
                ) : (
                  allContacts.map((c) => {
                    const isSelected = selectedCompanions.some(item => item.id === c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCompanions(prev => prev.filter(item => item.id !== c.id));
                          } else {
                            const maxLimit = pendingGameToStart === 'doudizhu' ? 2 : 3;
                            if (selectedCompanions.length < maxLimit) {
                              setSelectedCompanions(prev => [...prev, c]);
                            } else if (pendingGameToStart === 'doudizhu') {
                              setSelectedCompanions(prev => [prev[1] || prev[0], c]);
                            }
                          }
                        }}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400 text-slate-800'
                            : 'bg-gray-50/60 border-gray-200/60 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          <img src={c.avatar} alt={c.name} className="w-10 h-10 rounded-full object-cover border border-gray-300 shrink-0" />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-800 truncate">{c.name}</h4>
                            <p className="text-[10px] text-gray-500 truncate">{c.persona || c.quote}</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 ${
                          isSelected ? 'bg-amber-400 border-amber-400 text-slate-950' : 'border-gray-300'
                        }`}>
                          {isSelected && <Check size={12} className="stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {pendingGameToStart === 'doudizhu' && allContacts.length > 0 && allContacts.length < 2 && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-center font-medium">
                  斗地主需要 2 位联系人陪玩，当前可用人设仅 {allContacts.length} 位，数量不足。
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompanionPicker(false)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-100 text-xs font-bold text-gray-600"
                >
                  取消
                </button>
                <button
                  type="button"
                  disabled={
                    allContacts.length === 0 ||
                    (pendingGameToStart === 'doudizhu' && selectedCompanions.length !== 2) ||
                    (pendingGameToStart === 'uno' && selectedCompanions.length === 0)
                  }
                  onClick={confirmCompanionsAndLaunch}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all ${
                    allContacts.length === 0 ||
                    (pendingGameToStart === 'doudizhu' && selectedCompanions.length !== 2) ||
                    (pendingGameToStart === 'uno' && selectedCompanions.length === 0)
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 cursor-pointer active:scale-95'
                  }`}
                >
                  {allContacts.length === 0
                    ? '暂不可用 (未添加人设)'
                    : pendingGameToStart === 'doudizhu'
                    ? selectedCompanions.length === 2
                      ? '开始对局 (2位好友陪玩)'
                      : `请选择 2 位好友 (${selectedCompanions.length}/2)`
                    : selectedCompanions.length > 0
                    ? `开始对局 (${selectedCompanions.length + 1}人狂欢)`
                    : '请选择至少1位好友'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-Game Chat Drawer */}
      <AnimatePresence>
        {showChatDrawer && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute inset-x-2 bottom-2 top-16 bg-white/95 backdrop-blur-xl border border-gray-200 rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden text-slate-800"
          >
            <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-white">
              <div className="flex items-center space-x-2">
                <MessageCircle size={16} className="text-amber-400" />
                <span className="text-xs font-black">牌桌互动 & 角色嘴炮</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChatDrawer(false)}
                className="p-1 rounded-full bg-gray-100 text-gray-500 hover:text-slate-800"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-3 bg-gray-50/60 border-b border-gray-200 space-y-1.5">
              <span className="text-[10px] text-gray-500 font-bold block">快捷战术发言:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  '你的牌打得也太好了！',
                  '手下留情啊各位大佬！',
                  '我感觉有人在吹牛诈唬！',
                  '看我这把绝地翻盘！',
                  '给大佬端茶倒水 🍵'
                ].map((phrase, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendChatMessage(phrase)}
                    className="text-[11px] px-2.5 py-1 rounded-xl bg-gray-100 hover:bg-amber-500/20 hover:text-amber-300 border border-gray-200 hover:border-amber-400/40 text-gray-600 font-medium transition-all active:scale-95 cursor-pointer"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center py-10 text-xs text-gray-500 italic">
                  点击上方快捷发言或输入文字，同桌角色会实时回怼互动！
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex items-start space-x-2 ${msg.isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
                  >
                    {!msg.isUser && (
                      <img src={msg.senderAvatar} alt={msg.senderName} className="w-7 h-7 rounded-full object-cover border border-gray-300 shrink-0" />
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-xs ${
                      msg.isUser ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                      {!msg.isUser && <span className="text-[10px] text-amber-400 font-bold block mb-0.5">{msg.senderName}</span>}
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-white border-t border-gray-200 flex items-center space-x-2">
              <input
                type="text"
                value={chatInputText}
                onChange={e => setChatInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="发送战术聊天..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-gray-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => handleSendChatMessage()}
                className="p-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer active:scale-95"
              >
                <Send size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lobby Alert Toast */}
      <AnimatePresence>
        {lobbyAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center space-x-2 text-slate-800 bg-white border border-amber-300 shadow-amber-500/10 pointer-events-none max-w-[85vw] text-center"
          >
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <span>{lobbyAlert}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
