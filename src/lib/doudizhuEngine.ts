/**
 * DouDiZhu (斗地主) AI Rule Engine - Compliant with Rule Specification v1.0
 * 
 * 1. 总则:
 *    3 人: 1 地主 + 2 农民; 54 张牌 (含大小王);
 *    地主先出完胜; 任意农民先出完两农民共胜; AI 只输出合法动作。
 * 2. 牌与编码:
 *    rank: 3(3) .. A(14), 2(15), 小王(16), 大王(17)
 *    花色: S(黑桃), H(红桃), D(方块), C(梅花); SJ(小王), BJ(大王)
 * 3. 游戏流程:
 *    发牌每人 17 张 + 底牌 3 张; 叫分 0, 1, 2, 3; 出牌自由出牌与跟牌; 连续两家 PASS 上一手清空。
 * 4. 合法牌型:
 *    SINGLE, PAIR, TRIPLE_WITH_SINGLE, TRIPLE_WITH_PAIR, STRAIGHT, STRAIGHT_PAIR, AIRPLANE_WITH_PAIRS, BOMB, ROCKET
 * 5. 比较规则:
 *    火箭最大; 炸弹压普通牌; 普通牌同类型、同总张数、主 rank 更大。
 * 6. 牌型识别优先级:
 *    炸弹 > 飞机带对 > 连对 > 顺子 > 三带二 > 三带一 > 对子 > 单张
 */

export interface DDZCard {
  id: string;
  code: string; // e.g. S3, H3, D3, C3, ..., S2, H2, D2, C2, SJ, BJ
  suit: '♠' | '♥' | '♣' | '♦' | 'JOKER';
  rank: number; // 3 to 15 (2), 16 (SJ/小王), 17 (BJ/大王)
  display: string;
  color: 'black' | 'red';
}

export type DDZCardType =
  | 'INVALID'
  | 'SINGLE'              // 单张 (1张)
  | 'PAIR'                // 对子 (2张)
  | 'TRIPLE_WITH_SINGLE'  // 三带一 (4张)
  | 'TRIPLE_WITH_PAIR'    // 三带二 (5张)
  | 'STRAIGHT'            // 顺子 (>= 5张)
  | 'STRAIGHT_PAIR'       // 连对 (>= 6张且偶数)
  | 'AIRPLANE_WITH_PAIRS' // 飞机带对 (5n张, n >= 2)
  | 'BOMB'                // 炸弹 (4张)
  | 'ROCKET';             // 火箭 (2张: 小王 + 大王)

export interface DDZPlayResult {
  type: DDZCardType;
  mainRank: number; // 主 rank 用于比较
  length: number;   // 总张数 (用于同张数检验)
  desc: string;     // 牌型中文描述
}

// Generate standard 54 cards
export function generateDDZDeck(): DDZCard[] {
  const suits: ('♠' | '♥' | '♣' | '♦')[] = ['♠', '♥', '♣', '♦'];
  const suitLetterMap: Record<string, 'S' | 'H' | 'C' | 'D'> = {
    '♠': 'S',
    '♥': 'H',
    '♣': 'C',
    '♦': 'D'
  };
  const cards: DDZCard[] = [];

  for (let rank = 3; rank <= 15; rank++) {
    for (const suit of suits) {
      let display = String(rank);
      if (rank === 11) display = 'J';
      else if (rank === 12) display = 'Q';
      else if (rank === 13) display = 'K';
      else if (rank === 14) display = 'A';
      else if (rank === 15) display = '2';

      const sLetter = suitLetterMap[suit];
      const code = `${sLetter}${display}`;
      // Note: Spade Jack would be SJ, which matches Small Joker SJ.
      // We give Spade Jack unique React key 'S_J' while code is 'SJ' to ensure unique IDs
      const id = (suit === '♠' && rank === 11) ? 'S_J' : code;

      cards.push({
        id,
        code,
        suit,
        rank,
        display,
        color: suit === '♥' || suit === '♦' ? 'red' : 'black'
      });
    }
  }

  // 小王 (SJ) and 大王 (BJ)
  cards.push({ id: 'SJ', code: 'SJ', suit: 'JOKER', rank: 16, display: '小王', color: 'black' });
  cards.push({ id: 'BJ', code: 'BJ', suit: 'JOKER', rank: 17, display: '大王', color: 'red' });

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

/**
 * 6. 牌型识别优先级:
 *    如果一组牌存在多种解释，按以下优先级识别:
 *    炸弹 > 飞机带对 > 连对 > 顺子 > 三带二 > 三带一 > 对子 > 单张
 */
export function parseDDZCombination(cards: DDZCard[]): DDZPlayResult {
  const n = cards.length;
  if (n === 0) return { type: 'INVALID', mainRank: 0, length: 0, desc: '无效牌型' };

  // Count occurrences per rank
  const countMap: Record<number, number> = {};
  for (const c of cards) {
    countMap[c.rank] = (countMap[c.rank] || 0) + 1;
  }
  const ranks = Object.keys(countMap).map(Number).sort((a, b) => b - a);

  // 火箭 (ROCKET): 小王 (16) + 大王 (17) (总张数 2)
  if (n === 2 && countMap[16] === 1 && countMap[17] === 1) {
    return {
      type: 'ROCKET',
      mainRank: 17,
      length: 2,
      desc: '🔥 火箭 (王炸)'
    };
  }

  // 优先级 1: 炸弹 (BOMB) - 4 张同 rank (3 <= rank <= 15)
  if (n === 4 && ranks.length === 1 && ranks[0] <= 15) {
    return {
      type: 'BOMB',
      mainRank: ranks[0],
      length: 4,
      desc: `💣 炸弹 ${getRankDisplay(ranks[0])}`
    };
  }

  // 优先级 2: 飞机带对 (AIRPLANE_WITH_PAIRS) - n 个连续三张 + n 个对子, 总张数 5n (n >= 2)
  // 顺子、连对、飞机中，只能使用 3 到 A (3 <= rank <= 14)，不能包含 2、小王、大王
  // 飞机带对中的附加牌，不能与飞机主体三张同 rank，且大小王不能组成对子
  if (n >= 10 && n % 5 === 0) {
    const k = n / 5; // 三张主体的数量 (至少 2 个连续三张)
    const validTripletRanks = ranks.filter(r => countMap[r] >= 3 && r >= 3 && r <= 14).sort((a, b) => a - b);

    // 寻找是否存在连续 k 个三张主体
    for (let i = 0; i <= validTripletRanks.length - k; i++) {
      let isConsecutive = true;
      const tripSeq: number[] = [validTripletRanks[i]];
      for (let j = 1; j < k; j++) {
        if (validTripletRanks[i + j] !== validTripletRanks[i + j - 1] + 1) {
          isConsecutive = false;
          break;
        }
        tripSeq.push(validTripletRanks[i + j]);
      }

      if (isConsecutive) {
        // 校验剩余牌是否恰好组成 k 个对子，且不能包含大小王，且不能与主体同 rank
        const remCounts = { ...countMap };
        tripSeq.forEach(r => {
          remCounts[r] -= 3;
        });

        let pairCount = 0;
        let validWings = true;
        for (const [rStr, cnt] of Object.entries(remCounts)) {
          const r = Number(rStr);
          if (cnt === 0) continue;
          // 大小王不能做对子，对子必须偶数，且附加牌不能包含大小王
          if (r > 15 || cnt % 2 !== 0) {
            validWings = false;
            break;
          }
          pairCount += cnt / 2;
        }

        if (validWings && pairCount === k) {
          const maxTripRank = tripSeq[tripSeq.length - 1];
          return {
            type: 'AIRPLANE_WITH_PAIRS',
            mainRank: maxTripRank,
            length: n,
            desc: `飞机带对 (${getRankDisplay(tripSeq[0])}-${getRankDisplay(maxTripRank)})`
          };
        }
      }
    }
  }

  // 优先级 3: 连对 (STRAIGHT_PAIR) - 至少 3 个连续对子, 总张数 >= 6 且偶数 (3 <= rank <= 14)
  if (n >= 6 && n % 2 === 0) {
    const pairCount = n / 2;
    if (ranks.length === pairCount && ranks.every(r => countMap[r] === 2 && r >= 3 && r <= 14)) {
      const sortedAsc = [...ranks].sort((a, b) => a - b);
      let isConsecutive = true;
      for (let i = 0; i < sortedAsc.length - 1; i++) {
        if (sortedAsc[i + 1] !== sortedAsc[i] + 1) {
          isConsecutive = false;
          break;
        }
      }
      if (isConsecutive) {
        const maxPairRank = sortedAsc[sortedAsc.length - 1];
        return {
          type: 'STRAIGHT_PAIR',
          mainRank: maxPairRank,
          length: n,
          desc: `连对 (${getRankDisplay(sortedAsc[0])}-${getRankDisplay(maxPairRank)})`
        };
      }
    }
  }

  // 优先级 4: 顺子 (STRAIGHT) - 至少 5 张连续单牌, 只能使用 3 到 A (3 <= rank <= 14)
  if (n >= 5 && ranks.length === n && ranks.every(r => r >= 3 && r <= 14)) {
    const sortedAsc = [...ranks].sort((a, b) => a - b);
    let isConsecutive = true;
    for (let i = 0; i < sortedAsc.length - 1; i++) {
      if (sortedAsc[i + 1] !== sortedAsc[i] + 1) {
        isConsecutive = false;
        break;
      }
    }
    if (isConsecutive) {
      const maxStraightRank = sortedAsc[sortedAsc.length - 1];
      return {
        type: 'STRAIGHT',
        mainRank: maxStraightRank,
        length: n,
        desc: `顺子 (${getRankDisplay(sortedAsc[0])}-${getRankDisplay(maxStraightRank)})`
      };
    }
  }

  // 优先级 5: 三带二 (TRIPLE_WITH_PAIR) - 3 张同 rank + 1 个对子, 总张数 5
  // 附加牌不能与三张主体同 rank; 大小王不能组成对子 (pairRank <= 15)
  if (n === 5 && ranks.length === 2) {
    const tripRank = ranks.find(r => countMap[r] === 3);
    const pairRank = ranks.find(r => countMap[r] === 2);
    if (tripRank && pairRank && pairRank <= 15) {
      return {
        type: 'TRIPLE_WITH_PAIR',
        mainRank: tripRank,
        length: 5,
        desc: `三带二 (${getRankDisplay(tripRank)} 带 对${getRankDisplay(pairRank)})`
      };
    }
  }

  // 优先级 6: 三带一 (TRIPLE_WITH_SINGLE) - 3 张同 rank + 1 张单牌, 总张数 4
  // 附加牌不能与三张主体同 rank (大小王可作为附加单牌)
  if (n === 4 && ranks.length === 2) {
    const tripRank = ranks.find(r => countMap[r] === 3);
    const singleRank = ranks.find(r => countMap[r] === 1);
    if (tripRank && singleRank) {
      return {
        type: 'TRIPLE_WITH_SINGLE',
        mainRank: tripRank,
        length: 4,
        desc: `三带一 (${getRankDisplay(tripRank)} 带 ${getRankDisplay(singleRank)})`
      };
    }
  }

  // 优先级 7: 对子 (PAIR) - 2 张同 rank (大小王不能组成对子, rank <= 15)
  if (n === 2 && ranks.length === 1 && ranks[0] <= 15) {
    return {
      type: 'PAIR',
      mainRank: ranks[0],
      length: 2,
      desc: `对 ${getRankDisplay(ranks[0])}`
    };
  }

  // 优先级 8: 单张 (SINGLE) - 1 张
  if (n === 1) {
    return {
      type: 'SINGLE',
      mainRank: cards[0].rank,
      length: 1,
      desc: `单张 ${cards[0].display}`
    };
  }

  return { type: 'INVALID', mainRank: 0, length: 0, desc: '不符合合法牌型规则' };
}

/**
 * 5. 比较规则:
 * - 如果 new_play 是火箭，永远可以压。
 * - 如果 last_play 是火箭，任何牌都不能压。
 * - 如果 new_play 是炸弹，且 last_play 不是炸弹/火箭，则可以压。
 * - 如果 last_play 是炸弹，且 new_play 是炸弹，则比较炸弹 rank，大者赢。
 * - 普通牌型必须满足：类型相同；总张数相同；主 rank 更大。
 */
export function canBeatLastPlay(
  newPlay: DDZPlayResult,
  lastPlay: DDZPlayResult | null
): { canBeat: boolean; reason?: string } {
  if (newPlay.type === 'INVALID') {
    return { canBeat: false, reason: '牌型不符合规则' };
  }

  // 自由出牌 (上一手为空)
  if (!lastPlay) {
    return { canBeat: true };
  }

  // 如果 new_play 是火箭，永远可以压
  if (newPlay.type === 'ROCKET') {
    return { canBeat: true };
  }

  // 如果 last_play 是火箭，任何牌都不能压
  if (lastPlay.type === 'ROCKET') {
    return { canBeat: false, reason: '火箭最大，任何牌都不能压制' };
  }

  // 如果 new_play 是炸弹，且 last_play 不是炸弹/火箭，则可以压
  if (newPlay.type === 'BOMB') {
    if (lastPlay.type !== 'BOMB') {
      return { canBeat: true };
    }
    // 如果 last_play 是炸弹，且 new_play 是炸弹，则比较炸弹 rank，大者赢
    if (newPlay.mainRank > lastPlay.mainRank) {
      return { canBeat: true };
    }
    return { canBeat: false, reason: '炸弹必须大于上家炸弹' };
  }

  // 如果 last_play 是炸弹，而 new_play 不是炸弹/火箭
  if (lastPlay.type === 'BOMB') {
    return { canBeat: false, reason: '只有更大炸弹或火箭才能压制炸弹' };
  }

  // 普通牌型必须满足：类型相同；总张数相同；主 rank 更大
  if (newPlay.type !== lastPlay.type) {
    return { canBeat: false, reason: '必须出相同牌型' };
  }

  if (newPlay.length !== lastPlay.length) {
    return { canBeat: false, reason: '总张数必须与上家一致' };
  }

  if (newPlay.mainRank > lastPlay.mainRank) {
    return { canBeat: true };
  }

  return { canBeat: false, reason: '出的牌主点数必须大于上家' };
}

/**
 * AI 出牌决策器 (只输出合法动作，不得输出解释性文字)
 */
export function findBestAIPlay(
  hand: DDZCard[],
  lastPlay: { player: number; cards: DDZCard[]; result: DDZPlayResult } | null,
  isFreePlay: boolean
): DDZCard[] | null {
  if (hand.length === 0) return null;

  // Group hand cards by rank
  const rankBuckets: Record<number, DDZCard[]> = {};
  for (const c of hand) {
    if (!rankBuckets[c.rank]) rankBuckets[c.rank] = [];
    rankBuckets[c.rank].push(c);
  }
  const sortedRanksAsc = Object.keys(rankBuckets).map(Number).sort((a, b) => a - b);

  // 1. FREE PLAY: 自由出牌 (上一手为空或连续两家 PASS)
  if (isFreePlay || !lastPlay) {
    // 优先出顺子 (>= 5 cards, 3 <= rank <= 14)
    const singleRanks = sortedRanksAsc.filter(r => rankBuckets[r].length === 1 && r >= 3 && r <= 14);
    if (singleRanks.length >= 5) {
      let run: number[] = [];
      for (const r of singleRanks) {
        if (run.length === 0 || r === run[run.length - 1] + 1) {
          run.push(r);
        } else {
          if (run.length >= 5) break;
          run = [r];
        }
      }
      if (run.length >= 5) {
        return run.map(r => rankBuckets[r][0]);
      }
    }

    // 优先出连对 (>= 3 pairs, rank <= 14)
    const pairRanks = sortedRanksAsc.filter(r => rankBuckets[r].length === 2 && r >= 3 && r <= 14);
    if (pairRanks.length >= 3) {
      let pairRun: number[] = [];
      for (const r of pairRanks) {
        if (pairRun.length === 0 || r === pairRun[pairRun.length - 1] + 1) {
          pairRun.push(r);
        } else {
          if (pairRun.length >= 3) break;
          pairRun = [r];
        }
      }
      if (pairRun.length >= 3) {
        const straightPairCards: DDZCard[] = [];
        pairRun.forEach(r => straightPairCards.push(...rankBuckets[r].slice(0, 2)));
        return straightPairCards;
      }
    }

    // 出最低的三带二 (TRIPLE_WITH_PAIR)
    const tripletRanks = sortedRanksAsc.filter(r => rankBuckets[r].length === 3 && r <= 14);
    const availablePairs = sortedRanksAsc.filter(r => rankBuckets[r].length === 2 && r <= 15);
    if (tripletRanks.length > 0 && availablePairs.length > 0) {
      const tripRank = tripletRanks[0];
      const pRank = availablePairs.find(r => r !== tripRank);
      if (pRank) {
        return [...rankBuckets[tripRank], ...rankBuckets[pRank].slice(0, 2)];
      }
    }

    // 出最低的三带一 (TRIPLE_WITH_SINGLE)
    if (tripletRanks.length > 0) {
      const tripRank = tripletRanks[0];
      const sRank = sortedRanksAsc.find(r => r !== tripRank && rankBuckets[r].length === 1);
      if (sRank) {
        return [...rankBuckets[tripRank], rankBuckets[sRank][0]];
      }
    }

    // 出最小对子 (PAIR)
    if (availablePairs.length > 0) {
      return rankBuckets[availablePairs[0]].slice(0, 2);
    }

    // 出最小单牌 (SINGLE, 避免直接出 2 和 大小王)
    const smallSingle = sortedRanksAsc.find(r => rankBuckets[r].length === 1 && r <= 14);
    if (smallSingle) {
      return [rankBuckets[smallSingle][0]];
    }

    // 否则出最小单张
    return [rankBuckets[sortedRanksAsc[0]][0]];
  }

  // 2. FOLLOWING PLAY: 跟牌 (必须严格压制上一手)
  const target = lastPlay.result;

  // 跟单张 (SINGLE)
  if (target.type === 'SINGLE') {
    const higherSingles = sortedRanksAsc.filter(r => r > target.mainRank && rankBuckets[r].length === 1);
    if (higherSingles.length > 0) {
      return [rankBuckets[higherSingles[0]][0]];
    }
    // 拆牌跟随
    const higherAny = sortedRanksAsc.filter(r => r > target.mainRank && rankBuckets[r].length < 4 && r <= 15);
    if (higherAny.length > 0) {
      return [rankBuckets[higherAny[0]][0]];
    }
    // 大小王
    if (target.mainRank < 16 && rankBuckets[16]?.length === 1 && rankBuckets[17]?.length !== 1) {
      return [rankBuckets[16][0]];
    }
    if (target.mainRank < 17 && rankBuckets[17]?.length === 1 && rankBuckets[16]?.length !== 1) {
      return [rankBuckets[17][0]];
    }
  }

  // 跟对子 (PAIR)
  if (target.type === 'PAIR') {
    const higherPairs = sortedRanksAsc.filter(r => r > target.mainRank && rankBuckets[r].length >= 2 && r <= 15);
    if (higherPairs.length > 0) {
      return rankBuckets[higherPairs[0]].slice(0, 2);
    }
  }

  // 跟三带一 (TRIPLE_WITH_SINGLE)
  if (target.type === 'TRIPLE_WITH_SINGLE') {
    const higherTrips = sortedRanksAsc.filter(r => r > target.mainRank && rankBuckets[r].length >= 3 && r <= 14);
    if (higherTrips.length > 0) {
      const tripRank = higherTrips[0];
      const trip = rankBuckets[tripRank].slice(0, 3);
      // 找附加单牌 (非主体 rank)
      const wingRank = sortedRanksAsc.find(r => r !== tripRank && rankBuckets[r].length === 1) ||
                       sortedRanksAsc.find(r => r !== tripRank && rankBuckets[r].length < 4);
      if (wingRank) {
        return [...trip, rankBuckets[wingRank][0]];
      }
    }
  }

  // 跟三带二 (TRIPLE_WITH_PAIR)
  if (target.type === 'TRIPLE_WITH_PAIR') {
    const higherTrips = sortedRanksAsc.filter(r => r > target.mainRank && rankBuckets[r].length >= 3 && r <= 14);
    const availablePairs = sortedRanksAsc.filter(r => rankBuckets[r].length >= 2 && r <= 15);
    if (higherTrips.length > 0) {
      const tripRank = higherTrips[0];
      const trip = rankBuckets[tripRank].slice(0, 3);
      const pairRank = availablePairs.find(r => r !== tripRank);
      if (pairRank) {
        return [...trip, ...rankBuckets[pairRank].slice(0, 2)];
      }
    }
  }

  // 跟顺子 (STRAIGHT) - 同长度比较, 3..14
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

  // 跟连对 (STRAIGHT_PAIR) - 同长度比较 (总张数相同), 3..14
  if (target.type === 'STRAIGHT_PAIR') {
    const pairCount = target.length / 2;
    for (let start = target.mainRank - pairCount + 2; start <= 14 - pairCount + 1; start++) {
      let valid = true;
      const straightPair: DDZCard[] = [];
      for (let r = start; r < start + pairCount; r++) {
        if (!rankBuckets[r] || rankBuckets[r].length < 2) {
          valid = false;
          break;
        }
        straightPair.push(...rankBuckets[r].slice(0, 2));
      }
      if (valid && (start + pairCount - 1) > target.mainRank) {
        return straightPair;
      }
    }
  }

  // 跟飞机带对 (AIRPLANE_WITH_PAIRS) - 同张数比较 (5n)
  if (target.type === 'AIRPLANE_WITH_PAIRS') {
    const k = target.length / 5;
    for (let start = target.mainRank - k + 2; start <= 14 - k + 1; start++) {
      let validTrips = true;
      const tripCards: DDZCard[] = [];
      const usedTripRanks = new Set<number>();
      for (let r = start; r < start + k; r++) {
        if (!rankBuckets[r] || rankBuckets[r].length < 3) {
          validTrips = false;
          break;
        }
        tripCards.push(...rankBuckets[r].slice(0, 3));
        usedTripRanks.add(r);
      }

      if (validTrips && (start + k - 1) > target.mainRank) {
        // 查找 k 个非主体对子 (不含大小王)
        const wingCards: DDZCard[] = [];
        for (const r of sortedRanksAsc) {
          if (usedTripRanks.has(r) || r > 15) continue;
          const availableCount = rankBuckets[r].length;
          if (availableCount >= 2) {
            wingCards.push(...rankBuckets[r].slice(0, 2));
            if (wingCards.length === k * 2) break;
          }
        }
        if (wingCards.length === k * 2) {
          return [...tripCards, ...wingCards];
        }
      }
    }
  }

  // 炸弹 (BOMB): 炸弹压所有普通牌型，炸弹之间比 rank
  const bombs = sortedRanksAsc.filter(r => rankBuckets[r].length === 4 && r <= 15);
  if (bombs.length > 0) {
    if (target.type === 'BOMB') {
      const higherBomb = bombs.find(r => r > target.mainRank);
      if (higherBomb) return rankBuckets[higherBomb];
    } else if (target.type !== 'ROCKET') {
      // 普通牌型可被炸弹压制 (手牌少或概率压制)
      if (hand.length <= 6 || Math.random() > 0.3) {
        return rankBuckets[bombs[0]];
      }
    }
  }

  // 火箭 (ROCKET): 火箭最大，压一切
  if (rankBuckets[16]?.length === 1 && rankBuckets[17]?.length === 1) {
    if (target.type !== 'ROCKET') {
      if (hand.length <= 4 || target.type === 'BOMB') {
        return [rankBuckets[16][0], rankBuckets[17][0]];
      }
    }
  }

  return null; // PASS
}
