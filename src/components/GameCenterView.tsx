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
  PenTool
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

// Default Fallback Companions
export const DEFAULT_COMPANIONS: GameCompanion[] = [
  {
    id: 'char_default_1',
    name: '顾时川',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    persona: '沉稳腹黑，牌技精湛，擅长心理战与算牌。',
    quote: '这把牌的胜率，在我手里是百分之百。'
  },
  {
    id: 'char_default_2',
    name: '林予安',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    persona: '傲娇嘴硬，喜欢冒险打大牌，被抓包时会气急败坏。',
    quote: '哼，别以为我不知道你在想什么！'
  },
  {
    id: 'char_default_3',
    name: '陆轻言',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    persona: '温柔护短，经常在游戏中给主角暗中放水，言语宠溺。',
    quote: '想出什么就出什么，输了算我的。'
  }
];

// --- UNO Card Definition ---
export type UNOColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type UNOTargetType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface UNOCard {
  id: string;
  color: UNOColor;
  type: UNOTargetType;
  value?: number;
  display: string;
}

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
  const p1 = selectedCompanions[0] || DEFAULT_COMPANIONS[0];
  const p2 = selectedCompanions[1] || DEFAULT_COMPANIONS[1];

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

  // Bidding Phase
  const handleBid = (score: number) => {
    const p1Bid = Math.random() > 0.5 ? Math.max(score, 1) + (Math.random() > 0.5 ? 1 : 0) : 0;
    const p2Bid = Math.random() > 0.5 ? Math.max(p1Bid, score, 1) : 0;

    const highestBid = Math.max(score, p1Bid, p2Bid);
    let chosenLandlord = 0;
    if (highestBid === p2Bid && p2Bid > 0) chosenLandlord = 2;
    else if (highestBid === p1Bid && p1Bid > 0) chosenLandlord = 1;
    else if (score > 0) chosenLandlord = 0;
    else chosenLandlord = Math.floor(Math.random() * 3);

    setLandlordPlayer(chosenLandlord);
    setGameStage('playing');
    setCurrentTurn(chosenLandlord);

    if (chosenLandlord === 0) {
      setUserHand(prev => sortDDZCards([...prev, ...bottomCards]));
      triggerCharacterBubble(p1.id, '你抢了地主，准备接受我们两个农民的围剿吧！');
      triggerCharacterBubble(p2.id, '农民联手，其利断金！');
    } else if (chosenLandlord === 1) {
      setP1Hand(prev => sortDDZCards([...prev, ...bottomCards]));
      triggerCharacterBubble(p1.id, '哈哈，底牌归我了！这把让你们看看地主的威严！');
      triggerCharacterBubble(p2.id, '我和玩家联手，一定能把你打趴下。');
    } else {
      setP2Hand(prev => sortDDZCards([...prev, ...bottomCards]));
      triggerCharacterBubble(p2.id, '地主到手！三张底牌很给力，你们小心了！');
      triggerCharacterBubble(p1.id, '地主在右边，玩家我们一起夹击他！');
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
      triggerCharacterBubble(p1.id, parsed.type === 'ROCKET' ? '<Zap size={14} className="inline mr-1" />王炸！！这也太强了！' : '<Zap size={14} className="inline mr-1" />哇！居然有炸弹！');
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
            <div className="flex items-center space-x-2 animate-fadeIn">
              <button
                type="button"
                onClick={() => handleBid(0)}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs shadow-md active:scale-95 cursor-pointer"
              >
                不叫
              </button>
              <button
                type="button"
                onClick={() => handleBid(1)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-black rounded-xl text-xs shadow-md active:scale-95 cursor-pointer"
              >
                叫地主 (1分)
              </button>
              <button
                type="button"
                onClick={() => handleBid(3)}
                className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black rounded-xl text-xs shadow-lg active:scale-95 cursor-pointer flex items-center space-x-1"
              >
                <Crown size={14} />
                <span>抢地主 (3分)</span>
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
              <h3 className="text-xl font-black text-amber-400">
                {winner === 0 || (winner !== landlordPlayer && landlordPlayer !== 0) ? '<Sparkles size={16} className="inline mr-1" />恭喜获得胜利！' : '<AlertTriangle size={16} className="inline mr-1" />本局惜败'}
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
  const [discardTop, setDiscardTop] = useState<UNOCard>({ id: 'init', color: 'red', type: 'number', value: 7, display: '7' });
  const [activeColor, setActiveColor] = useState<UNOColor>('red');
  const [currentTurnIdx, setCurrentTurnIdx] = useState<number>(0);
  const [turnDirection, setTurnDirection] = useState<1 | -1>(1);
  const [showColorPicker, setShowColorPicker] = useState<boolean>(false);
  const [pendingWildCard, setPendingWildCard] = useState<UNOCard | null>(null);
  const [unoShouted, setUnoShouted] = useState<boolean>(false);
  const [winnerName, setWinnerName] = useState<string | null>(null);
  const [gameStage, setGameStage] = useState<'playing' | 'gameover'>('playing');
  const [actionBanner, setActionBanner] = useState<{ text: string; color: string; iconType: string } | null>(null);

  // Remaining draw deck ref
  const deckRef = useRef<UNOCard[]>([]);
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
    }, 2800);
  };

  const getColorName = (c: UNOColor) => {
    switch (c) {
      case 'red': return '红色';
      case 'blue': return '蓝色';
      case 'green': return '绿色';
      case 'yellow': return '黄色';
      default: return '万能色';
    }
  };

  const generateFullUNODeck = (): UNOCard[] => {
    const colors: ('red' | 'blue' | 'green' | 'yellow')[] = ['red', 'blue', 'green', 'yellow'];
    const deck: UNOCard[] = [];
    let id = 1;

    colors.forEach(color => {
      // 0 card (1 per color)
      deck.push({ id: `u_${id++}`, color, type: 'number', value: 0, display: '0' });
      // 1-9 cards (2 per color)
      for (let v = 1; v <= 9; v++) {
        deck.push({ id: `u_${id++}`, color, type: 'number', value: v, display: String(v) });
        deck.push({ id: `u_${id++}`, color, type: 'number', value: v, display: String(v) });
      }
      // Action cards (2 each per color: Skip, Reverse, Draw 2)
      for (let i = 0; i < 2; i++) {
        deck.push({ id: `u_${id++}`, color, type: 'skip', display: '⊘' });
        deck.push({ id: `u_${id++}`, color, type: 'reverse', display: '⇄' });
        deck.push({ id: `u_${id++}`, color, type: 'draw2', display: '+2' });
      }
    });

    // Wild & Wild Draw 4 cards (4 each)
    for (let i = 0; i < 4; i++) {
      deck.push({ id: `u_${id++}`, color: 'wild', type: 'wild', display: '★' });
      deck.push({ id: `u_${id++}`, color: 'wild', type: 'wild4', display: '+4' });
    }

    return deck.sort(() => Math.random() - 0.5);
  };

  const drawCardsFromDeck = (count: number): UNOCard[] => {
    if (deckRef.current.length < count) {
      deckRef.current = [...deckRef.current, ...generateFullUNODeck()];
    }
    const drawn = deckRef.current.slice(0, count);
    deckRef.current = deckRef.current.slice(count);
    return drawn;
  };

  const initUno = useCallback(() => {
    const freshDeck = generateFullUNODeck();
    const userCards = freshDeck.slice(0, 7);
    let cardIdx = 7;

    const initialCompHands: { [id: string]: UNOCard[] } = {};
    companionsRef.current.forEach(c => {
      initialCompHands[c.id] = freshDeck.slice(cardIdx, cardIdx + 7);
      cardIdx += 7;
    });

    // Initial discard top card (must be a number card)
    let topIndex = cardIdx;
    while (topIndex < freshDeck.length && freshDeck[topIndex].type !== 'number') {
      topIndex++;
    }
    const topCard = topIndex < freshDeck.length
      ? freshDeck[topIndex]
      : ({ id: 'init', color: 'red', type: 'number', value: 5, display: '5' } as UNOCard);

    freshDeck.splice(topIndex, 1);
    deckRef.current = freshDeck.slice(cardIdx);

    setUserHand(userCards);
    setCompHands(initialCompHands);
    setDiscardTop(topCard);
    setActiveColor(topCard.color);
    setCurrentTurnIdx(0);
    setTurnDirection(1);
    setShowColorPicker(false);
    setPendingWildCard(null);
    setUnoShouted(false);
    setWinnerName(null);
    setGameStage('playing');
    setActionBanner(null);
  }, []);

  useEffect(() => {
    initUno();
  }, [initUno]);

  const isValidCard = (card: UNOCard) => {
    if (card.color === 'wild' || card.type === 'wild' || card.type === 'wild4') return true;
    if (card.color === activeColor) return true;
    if (card.type === 'number' && discardTop.type === 'number' && card.value === discardTop.value) return true;
    if (card.type !== 'number' && card.type === discardTop.type) return true;
    return false;
  };

  const getPlayerName = (playerIdx: number) => {
    if (playerIdx === 0) return '我';
    return companions[playerIdx - 1]?.name || '角色';
  };

  // Turn calculation with Action Card effects
  const applyCardEffectsAndAdvance = (playedBy: number, card: UNOCard, chosenColor: UNOColor) => {
    const totalPlayers = companions.length + 1;
    const actorName = getPlayerName(playedBy);
    const dir = turnDirectionRef.current;

    // Normal next player index (step = 1)
    const directNextIdx = (playedBy + dir + totalPlayers * 2) % totalPlayers;
    const directNextName = getPlayerName(directNextIdx);

    if (card.type === 'reverse') {
      if (totalPlayers === 2) {
        // In 2-player UNO, reverse behaves like skip
        showActionAlert(`<RefreshCw size={12} className="inline mr-1" />${actorName} 打出【反转卡】！2人局等同于【跳过】，${directNextName} 被跳过！`, 'indigo', 'reverse');
        const nextIdx = (playedBy + dir * 2 + totalPlayers * 2) % totalPlayers;
        setCurrentTurnIdx(nextIdx);
      } else {
        const newDirection = (dir === 1 ? -1 : 1) as 1 | -1;
        setTurnDirection(newDirection);
        turnDirectionRef.current = newDirection;
        const newNextIdx = (playedBy + newDirection + totalPlayers * 2) % totalPlayers;
        showActionAlert(`<RefreshCw size={12} className="inline mr-1" />${actorName} 打出【反转卡】！出牌方向变为 ${newDirection === 1 ? '顺时针 ↻' : '逆时针 ↺'}！`, 'indigo', 'reverse');
        setCurrentTurnIdx(newNextIdx);
      }
    } else if (card.type === 'skip') {
      showActionAlert(`<Ban size={12} className="inline mr-1" />${actorName} 打出【跳过卡】！${directNextName} 本轮被禁手跳过！`, 'rose', 'skip');
      if (playedBy === 0) {
        if (directNextIdx > 0) {
          triggerCharacterBubble(companions[directNextIdx - 1].id, '居然跳过我！气煞我也！');
        }
      }
      const nextIdx = (playedBy + dir * 2 + totalPlayers * 2) % totalPlayers;
      setCurrentTurnIdx(nextIdx);
    } else if (card.type === 'draw2') {
      const drawnCards = drawCardsFromDeck(2);
      if (directNextIdx === 0) {
        setUserHand(prev => [...prev, ...drawnCards]);
        showActionAlert(`<Zap size={12} className="inline mr-1" />${actorName} 打出【+2 罚牌】！你被罚摸 2 张牌并跳过回合！`, 'amber', 'zap');
      } else {
        const victimComp = companions[directNextIdx - 1];
        setCompHands(prev => ({
          ...prev,
          [victimComp.id]: [...(prev[victimComp.id] || []), ...drawnCards]
        }));
        showActionAlert(`<Zap size={12} className="inline mr-1" />${actorName} 打出【+2 罚牌】！${victimComp.name} 罚摸 2 张牌并跳过！`, 'amber', 'zap');
        triggerCharacterBubble(victimComp.id, '啊！被加了2张牌！手牌越来越多了！');
      }
      const nextIdx = (playedBy + dir * 2 + totalPlayers * 2) % totalPlayers;
      setCurrentTurnIdx(nextIdx);
    } else if (card.type === 'wild4') {
      const drawnCards = drawCardsFromDeck(4);
      if (directNextIdx === 0) {
        setUserHand(prev => [...prev, ...drawnCards]);
        showActionAlert(`<Zap size={14} className="inline mr-1" />${actorName} 打出【+4 王炸】并指定【${getColorName(chosenColor)}】！你被罚摸 4 张牌并跳过！`, 'rose', 'flame');
      } else {
        const victimComp = companions[directNextIdx - 1];
        setCompHands(prev => ({
          ...prev,
          [victimComp.id]: [...(prev[victimComp.id] || []), ...drawnCards]
        }));
        showActionAlert(`<Zap size={14} className="inline mr-1" />${actorName} 打出【+4 王炸】并指定【${getColorName(chosenColor)}】！${victimComp.name} 罚摸 4 张牌并跳过！`, 'rose', 'flame');
        triggerCharacterBubble(victimComp.id, '太狠了吧！+4暴击直接把我打懵了！');
      }
      const nextIdx = (playedBy + dir * 2 + totalPlayers * 2) % totalPlayers;
      setCurrentTurnIdx(nextIdx);
    } else if (card.type === 'wild') {
      showActionAlert(`<Sparkles size={12} className="inline mr-1" />${actorName} 打出【万能变色牌】，将当前有效颜色变为【${getColorName(chosenColor)}】！`, 'emerald', 'sparkle');
      const nextIdx = (playedBy + dir + totalPlayers * 2) % totalPlayers;
      setCurrentTurnIdx(nextIdx);
    } else {
      const nextIdx = (playedBy + dir + totalPlayers * 2) % totalPlayers;
      setCurrentTurnIdx(nextIdx);
    }
  };

  // User Executes Card Play
  const executeUserCardPlay = (card: UNOCard, chosenColor: UNOColor) => {
    const newHand = userHand.filter(c => c.id !== card.id);
    setUserHand(newHand);
    setDiscardTop(card);
    setActiveColor(chosenColor);

    if (newHand.length === 1 && !unoShouted) {
      setUnoShouted(true);
      showActionAlert('<AlertTriangle size={12} className="inline mr-1" />我喊出了：“UNO！” 仅剩最后1张手牌！', 'amber', 'bell');
      triggerCharacterBubble('user', 'UNO！');
    }

    if (newHand.length === 0) {
      setWinnerName('我');
      setGameStage('gameover');
      addCoins(300);
      onWin('uno');
      return;
    }

    applyCardEffectsAndAdvance(0, card, chosenColor);
  };

  const handleUserPlayCard = (card: UNOCard) => {
    if (currentTurnIdx !== 0 || !isValidCard(card)) return;

    if (card.type === 'wild' || card.type === 'wild4') {
      setPendingWildCard(card);
      setShowColorPicker(true);
      return;
    }

    executeUserCardPlay(card, card.color);
  };

  const handleUserDrawCard = () => {
    if (currentTurnIdx !== 0) return;
    const drawn = drawCardsFromDeck(1);
    const newHand = [...userHand, ...drawn];
    setUserHand(newHand);
    showActionAlert('<Layers size={12} className="inline mr-1" />你从牌堆摸了 1 张牌', 'slate', 'draw');

    // Auto-advance turn
    const totalPlayers = companions.length + 1;
    const nextIdx = (currentTurnIdx + turnDirection + totalPlayers * 2) % totalPlayers;
    setCurrentTurnIdx(nextIdx);
  };

  // AI Turn Handling with Real Hands & Action Strategy
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

      // Filter valid playable cards
      const validCards = currentHand.filter(card => {
        if (card.color === 'wild' || card.type === 'wild' || card.type === 'wild4') return true;
        if (card.color === curActiveColor) return true;
        if (card.type === 'number' && curTop.type === 'number' && card.value === curTop.value) return true;
        if (card.type !== 'number' && card.type === curTop.type) return true;
        return false;
      });

      if (validCards.length > 0) {
        // AI Strategy:
        // Priority 1: +4 or +2 or Skip if next player has few cards
        // Priority 2: Same color action cards (Reverse, Skip, Draw2)
        // Priority 3: Matching number/color
        // Priority 4: Wild cards
        validCards.sort((a, b) => {
          const scoreMap: { [k: string]: number } = {
            wild4: 5,
            draw2: 4,
            skip: 3,
            reverse: 2,
            number: 1,
            wild: 0
          };
          return (scoreMap[b.type] || 0) - (scoreMap[a.type] || 0);
        });

        const chosenCard = validCards[0];
        const remainingHand = currentHand.filter(c => c.id !== chosenCard.id);

        setCompHands(prev => ({
          ...prev,
          [comp.id]: remainingHand
        }));
        setDiscardTop(chosenCard);

        // Pick best color if Wild
        let chosenColor: UNOColor = chosenCard.color;
        if (chosenCard.color === 'wild' || chosenCard.type === 'wild' || chosenCard.type === 'wild4') {
          const colorCounts: { [k: string]: number } = { red: 0, blue: 0, green: 0, yellow: 0 };
          remainingHand.forEach(c => {
            if (c.color !== 'wild') colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
          });
          const bestColor = (Object.keys(colorCounts) as ('red' | 'blue' | 'green' | 'yellow')[]).reduce((a, b) =>
            colorCounts[a] >= colorCounts[b] ? a : b
          );
          chosenColor = bestColor;
          setActiveColor(bestColor);
        } else {
          setActiveColor(chosenCard.color);
        }

        // Voice lines & Reaction
        if (chosenCard.type === 'wild4') {
          triggerCharacterBubble(comp.id, `吃我一记 +4 王炸！给我变【${getColorName(chosenColor)}】！`);
        } else if (chosenCard.type === 'draw2') {
          triggerCharacterBubble(comp.id, `送你一张 +2 罚牌，多摸几张吧！`);
        } else if (chosenCard.type === 'skip') {
          triggerCharacterBubble(comp.id, `跳过！这轮你别想出牌了！`);
        } else if (chosenCard.type === 'reverse') {
          triggerCharacterBubble(comp.id, `反转！牌局方向逆转！`);
        } else if (chosenCard.type === 'wild') {
          triggerCharacterBubble(comp.id, `万能变色！现在由我主导，变【${getColorName(chosenColor)}】！`);
        } else {
          triggerCharacterBubble(comp.id, `出 ${getColorName(chosenCard.color)} 色【${chosenCard.display}】！`);
        }

        if (remainingHand.length === 1) {
          triggerCharacterBubble(comp.id, 'UNO！就剩最后一张牌了！');
          showActionAlert(`<AlertTriangle size={12} className="inline mr-1" />${comp.name} 喊出了：“UNO！” 仅剩 1 张手牌！`, 'amber', 'bell');
        }

        if (remainingHand.length === 0) {
          setWinnerName(comp.name);
          setGameStage('gameover');
          addCoins(-150);
          return;
        }

        applyCardEffectsAndAdvance(currentTurnIdx, chosenCard, chosenColor);
      } else {
        // AI Draws 1 Card
        const drawn = drawCardsFromDeck(1);
        setCompHands(prev => ({
          ...prev,
          [comp.id]: [...(prev[comp.id] || []), ...drawn]
        }));
        triggerCharacterBubble(comp.id, '摸了一张牌，过~');

        const totalPlayers = companions.length + 1;
        const nextIdx = (currentTurnIdx + turnDirectionRef.current + totalPlayers * 2) % totalPlayers;
        setCurrentTurnIdx(nextIdx);
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
            <span className="font-black text-xs text-white">{getColorName(activeColor)}</span>
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
        <div className="flex justify-center items-center space-x-3 h-8">
          {currentTurnIdx === 0 ? (
            <span className="text-xs text-amber-300 font-bold bg-black/50 px-3.5 py-1 rounded-full border border-indigo-500/30 animate-bounce">
              <Sparkles size={12} className="inline mr-1" />轮到你出牌，点击匹配颜色、点数或打出功能牌
            </span>
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
                <h3 className="text-sm font-black text-white">
                  {pendingWildCard?.type === 'wild4' ? '<Zap size={14} className="inline mr-1" />打出 +4 王炸！请指定变色' : '<Sparkles size={12} className="inline mr-1" />打出万能牌！请指定变色'}
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
              <h3 className="text-xl font-black text-indigo-300">
                {winnerName === '我' ? '<Sparkles size={16} className="inline mr-1" />UNO 最终决胜！' : `👑 ${winnerName} 获得胜利！`}
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
          setSelectedCompanions(mapped.slice(0, 3));
        } else {
          setAllContacts(DEFAULT_COMPANIONS);
          setSelectedCompanions(DEFAULT_COMPANIONS);
        }
      } catch (e) {
        setAllContacts(DEFAULT_COMPANIONS);
        setSelectedCompanions(DEFAULT_COMPANIONS);
      }
    };
    fetchContacts();
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
    setPendingGameToStart(game);
    setShowCompanionPicker(true);
  };

  const confirmCompanionsAndLaunch = () => {
    if (!pendingGameToStart) return;
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

                <div
                  onClick={() => handleStartGameWithCompanions('doudizhu')}
                  className="bg-white border border-gray-200 hover:border-amber-400 rounded-3xl p-4 transition-all shadow-sm hover:shadow-md hover:shadow-amber-500/10 cursor-pointer active:scale-[0.99] flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-13 h-13 shrink-0 rounded-2xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs" style={{ backgroundColor: '#ffc242' }}>
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
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border" style={{ backgroundColor: '#fff8e7', color: '#ce992d', borderColor: '#fce3a6' }}>
                          3人对战
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">叫抢地主、王炸连对、经典农民与地主博弈</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:text-amber-500 group-hover:bg-gray-200 transition-colors shrink-0">
                    <ChevronRight size={18} />
                  </div>
                </div>

                <div
                  onClick={() => handleStartGameWithCompanions('uno')}
                  className="bg-white border border-gray-200 hover:border-sky-400 rounded-3xl p-4 transition-all shadow-sm hover:shadow-md hover:shadow-sky-500/10 cursor-pointer active:scale-[0.99] flex items-center justify-between group"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-13 h-13 shrink-0 rounded-2xl border border-sky-300/40 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs" style={{ backgroundColor: '#98cffb' }}>
                      <Layers size={26} className="stroke-[2.2]" style={{ color: '#449be3' }} />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-black text-slate-800">UNO 优诺</h3>
                        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold border" style={{ backgroundColor: '#f0f8ff', color: '#449be3', borderColor: '#c1e2fd' }}>
                          2~4人狂欢
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">转盘变色、+4惩罚、反转跳过与高燃喊UNO</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:text-sky-500 group-hover:bg-gray-200 transition-colors shrink-0">
                    <ChevronRight size={18} />
                  </div>
                </div>

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
        <DoudizhuGame
          selectedCompanions={selectedCompanions}
          onBackToLobby={() => setActiveGame('lobby')}
          addCoins={addCoins}
          onWin={handleGameWin}
          triggerCharacterBubble={triggerCharacterBubble}
          floatingBubbles={floatingBubbles}
        />
      )}

      {activeGame === 'uno' && (
        <UnoGame
          selectedCompanions={selectedCompanions}
          onBackToLobby={() => setActiveGame('lobby')}
          addCoins={addCoins}
          onWin={handleGameWin}
          triggerCharacterBubble={triggerCharacterBubble}
          floatingBubbles={floatingBubbles}
        />
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
                  <h3 className="text-sm font-black text-slate-800">选择陪玩好友 (1~3人)</h3>
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
                {allContacts.map((c) => {
                  const isSelected = selectedCompanions.some(item => item.id === c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        if (isSelected) {
                          if (selectedCompanions.length > 1) {
                            setSelectedCompanions(prev => prev.filter(item => item.id !== c.id));
                          }
                        } else {
                          if (selectedCompanions.length < 3) {
                            setSelectedCompanions(prev => [...prev, c]);
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
                })}
              </div>

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
                  onClick={confirmCompanionsAndLaunch}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-xs shadow-lg cursor-pointer"
                >
                  开始对局 ({selectedCompanions.length}人)
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
                  '给大佬端茶倒水<Coins size={12} className="inline" />'
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
    </div>
  );
}
