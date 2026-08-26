/**
 * Complete DouDiZhu (斗地主) Rule & AI Engine
 */

export interface DDZCard {
  id: string;
  suit: '♠' | '♥' | '♣' | '♦' | 'JOKER';
  rank: number; // 3 to 15 (2), 16 (Black Joker), 17 (Red Joker)
  display: string;
  color: 'black' | 'red';
}

export type DDZCardType =
  | 'INVALID'
  | 'SINGLE'             // 单张
  | 'PAIR'               // 对子
  | 'TRIPLET'            // 三张不带
  | 'TRIPLET_WITH_ONE'   // 三带一
  | 'TRIPLET_WITH_PAIR'  // 三带二（一对）
  | 'STRAIGHT'           // 顺子 (>= 5 cards, 3 to A)
  | 'DOUBLE_STRAIGHT'    // 连对 (>= 3 pairs, e.g. 334455)
  | 'AIRPLANE'           // 飞机不带 (>= 2 consecutive triplets, e.g. 333444)
  | 'AIRPLANE_WITH_WINGS'// 飞机带翅膀
  | 'FOUR_WITH_TWO'      // 四带二 (4 cards + 2 singles or 2 pairs)
  | 'BOMB'               // 炸弹 (4 cards of same rank)
  | 'ROCKET';            // 王炸 / 火箭 (小王 + 大王)

export interface DDZPlayResult {
  type: DDZCardType;
  mainRank: number; // Primary rank used for comparison
  length: number;   // Number of cards or length of sequence
  desc: string;     // e.g. "单张 K", "顺子 (5-9)", "炸弹"
}

// Generate standard 54 cards
export function generateDDZDeck(): DDZCard[] {
  const suits: ('♠' | '♥' | '♣' | '♦')[] = ['♠', '♥', '♣', '♦'];
  const cards: DDZCard[] = [];
  let idCounter = 1;

  for (let rank = 3; rank <= 15; rank++) {
    for (const suit of suits) {
      let display = String(rank);
      if (rank === 11) display = 'J';
      else if (rank === 12) display = 'Q';
      else if (rank === 13) display = 'K';
      else if (rank === 14) display = 'A';
      else if (rank === 15) display = '2';

      cards.push({
        id: `ddz_c_${idCounter++}`,
        suit,
        rank,
        display,
        color: suit === '♥' || suit === '♦' ? 'red' : 'black'
      });
    }
  }
  cards.push({ id: `ddz_c_${idCounter++}`, suit: 'JOKER', rank: 16, display: '小王', color: 'black' });
  cards.push({ id: `ddz_c_${idCounter++}`, suit: 'JOKER', rank: 17, display: '大王', color: 'red' });

  return cards.sort(() => Math.random() - 0.5);
}

// Sort cards descending
export function sortDDZCards(cards: DDZCard[]): DDZCard[] {
  return [...cards].sort((a, b) => b.rank - a.rank);
}

export function getRankDisplay(rank: number): string {
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  if (rank === 15) return '2';
  if (rank === 16) return '小王';
  if (rank === 17) return '大王';
  return String(rank);
}

// Parse and validate a group of cards into a DouDiZhu pattern
export function parseDDZCombination(cards: DDZCard[]): DDZPlayResult {
  const n = cards.length;
  if (n === 0) return { type: 'INVALID', mainRank: 0, length: 0, desc: '无效牌型' };

  // Count occurrences per rank
  const countMap: { [rank: number]: number } = {};
  for (const c of cards) {
    countMap[c.rank] = (countMap[c.rank] || 0) + 1;
  }
  const ranks = Object.keys(countMap).map(Number).sort((a, b) => b - a);

  // 1. Single (单张)
  if (n === 1) {
    return {
      type: 'SINGLE',
      mainRank: cards[0].rank,
      length: 1,
      desc: `单张 ${cards[0].display}`
    };
  }

  // 2. Rocket / King Bomb (王炸)
  if (n === 2 && countMap[16] === 1 && countMap[17] === 1) {
    return {
      type: 'ROCKET',
      mainRank: 17,
      length: 2,
      desc: '🔥 王炸'
    };
  }

  // 3. Pair (对子)
  if (n === 2 && ranks.length === 1) {
    return {
      type: 'PAIR',
      mainRank: ranks[0],
      length: 2,
      desc: `对 ${getRankDisplay(ranks[0])}`
    };
  }

  // 4. Triplet (三张不带)
  if (n === 3 && ranks.length === 1) {
    return {
      type: 'TRIPLET',
      mainRank: ranks[0],
      length: 3,
      desc: `三张 ${getRankDisplay(ranks[0])}`
    };
  }

  // 5. Bomb (炸弹)
  if (n === 4 && ranks.length === 1) {
    return {
      type: 'BOMB',
      mainRank: ranks[0],
      length: 4,
      desc: `💣 炸弹 ${getRankDisplay(ranks[0])}`
    };
  }

  // 6. Triplet with One (三带一)
  if (n === 4 && ranks.length === 2) {
    const tripRank = ranks.find(r => countMap[r] === 3);
    if (tripRank) {
      return {
        type: 'TRIPLET_WITH_ONE',
        mainRank: tripRank,
        length: 4,
        desc: `三带一 (${getRankDisplay(tripRank)})`
      };
    }
  }

  // 7. Triplet with Pair (三带二 / 三带一对)
  if (n === 5 && ranks.length === 2) {
    const tripRank = ranks.find(r => countMap[r] === 3);
    const pairRank = ranks.find(r => countMap[r] === 2);
    if (tripRank && pairRank) {
      return {
        type: 'TRIPLET_WITH_PAIR',
        mainRank: tripRank,
        length: 5,
        desc: `三带一对 (${getRankDisplay(tripRank)} 带 对${getRankDisplay(pairRank)})`
      };
    }
  }

  // 8. Straight (顺子, 5 to 12 consecutive cards, rank <= 14 A)
  if (n >= 5 && ranks.length === n && ranks.every(r => r <= 14)) {
    const sortedAsc = [...ranks].sort((a, b) => a - b);
    let isCont = true;
    for (let i = 0; i < sortedAsc.length - 1; i++) {
      if (sortedAsc[i + 1] !== sortedAsc[i] + 1) {
        isCont = false;
        break;
      }
    }
    if (isCont) {
      return {
        type: 'STRAIGHT',
        mainRank: sortedAsc[sortedAsc.length - 1],
        length: n,
        desc: `顺子 (${getRankDisplay(sortedAsc[0])}-${getRankDisplay(sortedAsc[sortedAsc.length - 1])})`
      };
    }
  }

  // 9. Double Straight (连对, >= 3 pairs, e.g. 334455, rank <= 14)
  if (n >= 6 && n % 2 === 0 && ranks.every(r => countMap[r] === 2 && r <= 14)) {
    const sortedAsc = [...ranks].sort((a, b) => a - b);
    let isCont = true;
    for (let i = 0; i < sortedAsc.length - 1; i++) {
      if (sortedAsc[i + 1] !== sortedAsc[i] + 1) {
        isCont = false;
        break;
      }
    }
    if (isCont) {
      return {
        type: 'DOUBLE_STRAIGHT',
        mainRank: sortedAsc[sortedAsc.length - 1],
        length: n,
        desc: `连对 (${getRankDisplay(sortedAsc[0])}-${getRankDisplay(sortedAsc[sortedAsc.length - 1])})`
      };
    }
  }

  // 10. Four with Two Singles or Pairs (四带二)
  if (n === 6 || n === 8) {
    const fourRank = ranks.find(r => countMap[r] === 4);
    if (fourRank) {
      if (n === 6) {
        return {
          type: 'FOUR_WITH_TWO',
          mainRank: fourRank,
          length: 6,
          desc: `四带二单 (${getRankDisplay(fourRank)})`
        };
      }
      if (n === 8 && ranks.filter(r => countMap[r] === 2).length === 2) {
        return {
          type: 'FOUR_WITH_TWO',
          mainRank: fourRank,
          length: 8,
          desc: `四带两对 (${getRankDisplay(fourRank)})`
        };
      }
    }
  }

  // 11. Airplane (飞机不带 / 飞机带单 / 飞机带对)
  const triplets = ranks.filter(r => countMap[r] >= 3 && r <= 14).sort((a, b) => a - b);
  if (triplets.length >= 2) {
    // Check if there are continuous triplets
    for (let i = 0; i <= triplets.length - 2; i++) {
      const contTrips: number[] = [triplets[i]];
      for (let j = i + 1; j < triplets.length; j++) {
        if (triplets[j] === contTrips[contTrips.length - 1] + 1) {
          contTrips.push(triplets[j]);
        } else {
          break;
        }
      }
      const k = contTrips.length;
      if (k >= 2) {
        // Airplane without wings
        if (n === k * 3) {
          return {
            type: 'AIRPLANE',
            mainRank: contTrips[contTrips.length - 1],
            length: k,
            desc: `飞机 (${getRankDisplay(contTrips[0])}-${getRankDisplay(contTrips[contTrips.length - 1])})`
          };
        }
        // Airplane with single wings (k * 4)
        if (n === k * 4) {
          return {
            type: 'AIRPLANE_WITH_WINGS',
            mainRank: contTrips[contTrips.length - 1],
            length: k,
            desc: `飞机带翅膀 (${getRankDisplay(contTrips[0])}-${getRankDisplay(contTrips[contTrips.length - 1])})`
          };
        }
        // Airplane with pair wings (k * 5)
        if (n === k * 5) {
          return {
            type: 'AIRPLANE_WITH_WINGS',
            mainRank: contTrips[contTrips.length - 1],
            length: k,
            desc: `飞机带对翅膀 (${getRankDisplay(contTrips[0])}-${getRankDisplay(contTrips[contTrips.length - 1])})`
          };
        }
      }
    }
  }

  return { type: 'INVALID', mainRank: 0, length: 0, desc: '不符合出牌规则' };
}

// Compare if new play can beat previous play
export function canBeatLastPlay(
  newPlay: DDZPlayResult,
  lastPlay: DDZPlayResult | null
): { canBeat: boolean; reason?: string } {
  if (newPlay.type === 'INVALID') {
    return { canBeat: false, reason: '牌型不符合规则' };
  }

  // Free play (no previous play)
  if (!lastPlay) {
    return { canBeat: true };
  }

  // Rocket beats everything
  if (newPlay.type === 'ROCKET') {
    return { canBeat: true };
  }
  if (lastPlay.type === 'ROCKET') {
    return { canBeat: false, reason: '王炸最大，无法压制' };
  }

  // Bomb beats all non-bombs
  if (newPlay.type === 'BOMB') {
    if (lastPlay.type !== 'BOMB') {
      return { canBeat: true };
    }
    // Both are bombs: higher rank wins
    if (newPlay.mainRank > lastPlay.mainRank) {
      return { canBeat: true };
    }
    return { canBeat: false, reason: '炸弹必须大于上家炸弹' };
  }

  if (lastPlay.type === 'BOMB') {
    return { canBeat: false, reason: '只有更大炸弹或王炸才能压制炸弹' };
  }

  // Same pattern and same length required
  if (newPlay.type !== lastPlay.type) {
    return { canBeat: false, reason: '必须出相同牌型' };
  }

  if (newPlay.length !== lastPlay.length) {
    return { canBeat: false, reason: '牌张数必须与上家一致' };
  }

  if (newPlay.mainRank > lastPlay.mainRank) {
    return { canBeat: true };
  }

  return { canBeat: false, reason: '出的牌必须大于上家' };
}

// Smart AI Card Finder
export function findBestAIPlay(
  hand: DDZCard[],
  lastPlay: { player: number; cards: DDZCard[]; result: DDZPlayResult } | null,
  isFreePlay: boolean
): DDZCard[] | null {
  if (hand.length === 0) return null;

  // Group hand cards by rank
  const rankBuckets: { [rank: number]: DDZCard[] } = {};
  for (const c of hand) {
    if (!rankBuckets[c.rank]) rankBuckets[c.rank] = [];
    rankBuckets[c.rank].push(c);
  }
  const sortedRanksAsc = Object.keys(rankBuckets).map(Number).sort((a, b) => a - b);

  // 1. FREE PLAY: AI leads
  if (isFreePlay || !lastPlay) {
    // Lead lowest single, pair, or straight
    // Check if small straight exists
    const singles = sortedRanksAsc.filter(r => rankBuckets[r].length === 1 && r <= 14);
    if (singles.length >= 5) {
      let run: number[] = [];
      for (const r of singles) {
        if (run.length === 0 || r === run[run.length - 1] + 1) {
          run.push(r);
        } else {
          if (run.length >= 5) break;
          run = [r];
        }
      }
      if (run.length >= 5) {
        const straightCards: DDZCard[] = [];
        run.forEach(r => straightCards.push(rankBuckets[r][0]));
        return straightCards;
      }
    }

    // Lead lowest pair
    const pairs = sortedRanksAsc.filter(r => rankBuckets[r].length === 2 && r <= 13);
    if (pairs.length > 0) {
      return rankBuckets[pairs[0]];
    }

    // Lead lowest triplet with one
    const triplets = sortedRanksAsc.filter(r => rankBuckets[r].length === 3 && r <= 13);
    if (triplets.length > 0) {
      const trip = rankBuckets[triplets[0]];
      const single = sortedRanksAsc.find(r => r !== triplets[0] && rankBuckets[r].length === 1);
      if (single) {
        return [...trip, rankBuckets[single][0]];
      }
      return trip;
    }

    // Lead lowest single (skip jokers and 2 if possible)
    const smallSingle = sortedRanksAsc.find(r => rankBuckets[r].length === 1 && r <= 14);
    if (smallSingle) {
      return [rankBuckets[smallSingle][0]];
    }

    // Otherwise lead smallest single card
    return [rankBuckets[sortedRanksAsc[0]][0]];
  }

  // 2. FOLLOWING PLAY: Must beat lastPlay
  const target = lastPlay.result;

  // Follow Single
  if (target.type === 'SINGLE') {
    const higherSingles = sortedRanksAsc.filter(r => r > target.mainRank && rankBuckets[r].length === 1);
    if (higherSingles.length > 0) {
      return [rankBuckets[higherSingles[0]][0]];
    }
    // Break a pair if needed and rank is not too high
    const higherAny = sortedRanksAsc.filter(r => r > target.mainRank && r <= 15);
    if (higherAny.length > 0) {
      return [rankBuckets[higherAny[0]][0]];
    }
  }

  // Follow Pair
  if (target.type === 'PAIR') {
    const higherPairs = sortedRanksAsc.filter(r => r > target.mainRank && rankBuckets[r].length >= 2);
    if (higherPairs.length > 0) {
      return rankBuckets[higherPairs[0]].slice(0, 2);
    }
  }

  // Follow Triplet with One
  if (target.type === 'TRIPLET_WITH_ONE') {
    const higherTrips = sortedRanksAsc.filter(r => r > target.mainRank && rankBuckets[r].length >= 3);
    if (higherTrips.length > 0) {
      const tripRank = higherTrips[0];
      const trip = rankBuckets[tripRank].slice(0, 3);
      const wingRank = sortedRanksAsc.find(r => r !== tripRank);
      if (wingRank) {
        return [...trip, rankBuckets[wingRank][0]];
      }
    }
  }

  // Follow Triplet with Pair
  if (target.type === 'TRIPLET_WITH_PAIR') {
    const higherTrips = sortedRanksAsc.filter(r => r > target.mainRank && rankBuckets[r].length >= 3);
    const availablePairs = sortedRanksAsc.filter(r => rankBuckets[r].length >= 2);
    if (higherTrips.length > 0) {
      const tripRank = higherTrips[0];
      const trip = rankBuckets[tripRank].slice(0, 3);
      const pairRank = availablePairs.find(r => r !== tripRank);
      if (pairRank) {
        return [...trip, ...rankBuckets[pairRank].slice(0, 2)];
      }
    }
  }

  // Follow Straight
  if (target.type === 'STRAIGHT') {
    const len = target.length;
    for (let start = target.mainRank - len + 2; start <= 14 - len + 1; start++) {
      let valid = true;
      const straight: DDZCard[] = [];
      for (let r = start; r < start + len; r++) {
        if (!rankBuckets[r] || rankBuckets[r].length === 0) {
          valid = false;
          break;
        }
        straight.push(rankBuckets[r][0]);
      }
      if (valid && (start + len - 1) > target.mainRank) {
        return straight;
      }
    }
  }

  // Check if AI wants to Bomb
  const bombs = sortedRanksAsc.filter(r => rankBuckets[r].length === 4);
  if (bombs.length > 0) {
    if (target.type === 'BOMB') {
      const higherBomb = bombs.find(r => r > target.mainRank);
      if (higherBomb) return rankBuckets[higherBomb];
    } else if (target.type !== 'ROCKET' && (Math.random() > 0.4 || hand.length <= 6)) {
      return rankBuckets[bombs[0]];
    }
  }

  // Check Rocket
  if (rankBuckets[16]?.length === 1 && rankBuckets[17]?.length === 1 && hand.length <= 4) {
    return [rankBuckets[16][0], rankBuckets[17][0]];
  }

  return null; // Pass
}
