/**
 * UNO AI 规则规范 v1.0 核心引擎
 * 严格对齐 UNO 官方经典对决规则 (108张牌)
 */

export type UNOColorUI = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type UNOColorCode = 'R' | 'B' | 'G' | 'Y' | 'W';
export type UNOCardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface UNOCard {
  id: string;
  code: string;       // e.g. 'R0', 'R5', 'GSKIP', 'BREV', 'Y+2', 'WILD', 'WILD+4'
  color: UNOColorUI;  // 'red' | 'blue' | 'green' | 'yellow' | 'wild'
  colorCode: UNOColorCode;
  type: UNOCardType;
  value?: number;     // 0..9 for numbers
  display: string;    // '0'..'9', '⊘', '⇄', '+2', '★', '+4'
}

export const COLOR_MAP: Record<UNOColorUI, { name: string; code: UNOColorCode; bg: string }> = {
  red: { name: '红色', code: 'R', bg: 'bg-rose-500' },
  blue: { name: '蓝色', code: 'B', bg: 'bg-sky-500' },
  green: { name: '绿色', code: 'G', bg: 'bg-emerald-500' },
  yellow: { name: '黄色', code: 'Y', bg: 'bg-amber-400' },
  wild: { name: '万能', code: 'W', bg: 'bg-purple-600' }
};

/**
 * 2. 牌与编码
 * 2.2 严格生成 108 张标准 UNO 牌：
 * - 0: 每种颜色 1 张 (共 4 张)
 * - 1~9: 每种颜色各 2 张 (共 72 张)
 * - 跳过 (SKIP): 每种颜色各 2 张 (共 8 张)
 * - 反转 (REVERSE): 每种颜色各 2 张 (共 8 张)
 * - +2 (DRAW2): 每种颜色各 2 张 (共 8 张)
 * - 万能 (WILD): 4 张
 * - 万能 +4 (WILD+4): 4 张
 * 总计: 4 + 72 + 8 + 8 + 8 + 4 + 4 = 108 张
 */
export function generate108UNODeck(): UNOCard[] {
  const deck: UNOCard[] = [];
  const primaryColors: { color: UNOColorUI; code: UNOColorCode }[] = [
    { color: 'red', code: 'R' },
    { color: 'blue', code: 'B' },
    { color: 'green', code: 'G' },
    { color: 'yellow', code: 'Y' }
  ];

  let cardId = 1;

  primaryColors.forEach(({ color, code }) => {
    // 数字 0：每种颜色 1 张
    deck.push({
      id: `${code}0_${cardId++}`,
      code: `${code}0`,
      color,
      colorCode: code,
      type: 'number',
      value: 0,
      display: '0'
    });

    // 数字 1–9：每种颜色每个数字 2 张
    for (let v = 1; v <= 9; v++) {
      for (let copy = 1; copy <= 2; copy++) {
        deck.push({
          id: `${code}${v}_${copy}_${cardId++}`,
          code: `${code}${v}`,
          color,
          colorCode: code,
          type: 'number',
          value: v,
          display: String(v)
        });
      }
    }

    // 跳过：每种颜色 2 张
    for (let copy = 1; copy <= 2; copy++) {
      deck.push({
        id: `${code}SKIP_${copy}_${cardId++}`,
        code: `${code}SKIP`,
        color,
        colorCode: code,
        type: 'skip',
        display: '⊘'
      });
    }

    // 反转：每种颜色 2 张
    for (let copy = 1; copy <= 2; copy++) {
      deck.push({
        id: `${code}REV_${copy}_${cardId++}`,
        code: `${code}REV`,
        color,
        colorCode: code,
        type: 'reverse',
        display: '⇄'
      });
    }

    // +2：每种颜色 2 张
    for (let copy = 1; copy <= 2; copy++) {
      deck.push({
        id: `${code}+2_${copy}_${cardId++}`,
        code: `${code}+2`,
        color,
        colorCode: code,
        type: 'draw2',
        display: '+2'
      });
    }
  });

  // 万能牌：4 张
  for (let copy = 1; copy <= 4; copy++) {
    deck.push({
      id: `WILD_${copy}_${cardId++}`,
      code: 'WILD',
      color: 'wild',
      colorCode: 'W',
      type: 'wild',
      display: '★'
    });
  }

  // 万能 +4：4 张
  for (let copy = 1; copy <= 4; copy++) {
    deck.push({
      id: `WILD+4_${copy}_${cardId++}`,
      code: 'WILD+4',
      color: 'wild',
      colorCode: 'W',
      type: 'wild4',
      display: '+4'
    });
  }

  return shuffleDeck(deck);
}

export function shuffleDeck(cards: UNOCard[]): UNOCard[] {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 4. 合法出牌判定
 * 一张牌可以出，当且仅当满足以下条件之一：
 * 1. 该牌是 WILD。
 * 2. 该牌是 WILD+4，且手中没有与当前颜色相同的牌。
 * 3. 该牌颜色与当前颜色相同。
 * 4. 该牌是数字牌，且与弃牌堆顶牌数字相同。
 * 5. 该牌是功能牌，且与弃牌堆顶牌符号相同。
 */
export function isCardPlayable(
  card: UNOCard,
  discardTop: UNOCard,
  activeColor: UNOColorUI,
  hand: UNOCard[]
): { valid: boolean; reason?: string } {
  // 1. WILD: 万能牌随时可出
  if (card.type === 'wild') {
    return { valid: true };
  }

  // 2. WILD+4: 严格检查手中是否有与当前颜色相同的牌
  if (card.type === 'wild4') {
    const hasCurrentColor = hand.some(c => c.id !== card.id && c.color === activeColor);
    if (hasCurrentColor) {
      return {
        valid: false,
        reason: `手中有当前颜色（${COLOR_MAP[activeColor]?.name || activeColor}）的牌，按经典规则不能打出 +4 万能牌！`
      };
    }
    return { valid: true };
  }

  // 3. 颜色与当前指定颜色相同
  if (card.color === activeColor) {
    return { valid: true };
  }

  // 4. 数字牌与顶牌数字相同
  if (card.type === 'number' && discardTop.type === 'number' && card.value === discardTop.value) {
    return { valid: true };
  }

  // 5. 功能牌与顶牌符号相同（SKIP, REVERSE, DRAW2）
  if (card.type !== 'number' && card.type === discardTop.type) {
    return { valid: true };
  }

  return { valid: false, reason: '牌面颜色或点数/符号与当前牌不匹配' };
}

/**
 * 6. 抽牌堆耗尽处理
 * 当抽牌堆为空时，将弃牌堆除最上面一张外的所有牌重新洗牌作为新抽牌堆。
 */
export function drawCardsFromPiles(
  drawPile: UNOCard[],
  discardPile: UNOCard[],
  count: number
): { drawn: UNOCard[]; newDrawPile: UNOCard[]; newDiscardPile: UNOCard[] } {
  let currentDraw = [...drawPile];
  let currentDiscard = [...discardPile];
  const drawn: UNOCard[] = [];

  for (let i = 0; i < count; i++) {
    if (currentDraw.length === 0) {
      if (currentDiscard.length > 0) {
        currentDraw = shuffleDeck(currentDiscard);
        currentDiscard = [];
      } else {
        // 弃牌堆也空了，无法再摸牌
        break;
      }
    }
    const card = currentDraw.shift();
    if (card) {
      drawn.push(card);
    }
  }

  return { drawn, newDrawPile: currentDraw, newDiscardPile: currentDiscard };
}

/**
 * 计算下一位玩家的索引
 */
export function getNextTurn(
  current: number,
  direction: 1 | -1,
  totalPlayers: number,
  step: number = 1
): number {
  return (current + direction * step + totalPlayers * 10) % totalPlayers;
}

/**
 * AI 智能变色决策：选择剩余手牌中最多的有效颜色
 */
export function aiChooseBestColor(hand: UNOCard[]): UNOColorUI {
  const counts: Record<'red' | 'blue' | 'green' | 'yellow', number> = {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0
  };

  hand.forEach(c => {
    if (c.color !== 'wild' && counts[c.color] !== undefined) {
      counts[c.color]++;
    }
  });

  const primaryColors: ('red' | 'blue' | 'green' | 'yellow')[] = ['red', 'blue', 'green', 'yellow'];
  let bestColor: 'red' | 'blue' | 'green' | 'yellow' = 'red';
  let maxCount = -1;

  primaryColors.forEach(color => {
    if (counts[color] > maxCount) {
      maxCount = counts[color];
      bestColor = color;
    }
  });

  return bestColor;
}

/**
 * AI 选牌策略（只输出合法动作）
 */
export function aiSelectPlayableCard(
  hand: UNOCard[],
  discardTop: UNOCard,
  activeColor: UNOColorUI,
  nextPlayerCount: number
): { card: UNOCard; chosenColor: UNOColorUI } | null {
  const validCards = hand.filter(c => isCardPlayable(c, discardTop, activeColor, hand).valid);
  if (validCards.length === 0) return null;

  // 优先级策略：
  // 1. 下家快出完(<=2张)时优先打阻碍牌(+4, +2, SKIP, REVERSE)
  // 2. 匹配当前颜色的功能牌
  // 3. 匹配当前颜色的数字牌
  // 4. 同点数换色牌
  // 5. 普通 WILD 牌
  // 6. WILD+4（若此时手牌合法）
  validCards.sort((a, b) => {
    const getCardWeight = (card: UNOCard): number => {
      if (nextPlayerCount <= 2) {
        if (card.type === 'wild4') return 100;
        if (card.type === 'draw2') return 90;
        if (card.type === 'skip') return 80;
        if (card.type === 'reverse') return 70;
      }
      if (card.type === 'draw2') return 50;
      if (card.type === 'skip') return 45;
      if (card.type === 'reverse') return 40;
      if (card.type === 'number') {
        return card.color === activeColor ? 30 : 25;
      }
      if (card.type === 'wild') return 20;
      if (card.type === 'wild4') return 15;
      return 10;
    };
    return getCardWeight(b) - getCardWeight(a);
  });

  const chosenCard = validCards[0];
  let chosenColor: UNOColorUI = chosenCard.color;

  if (chosenCard.type === 'wild' || chosenCard.type === 'wild4') {
    const remainingHand = hand.filter(c => c.id !== chosenCard.id);
    chosenColor = aiChooseBestColor(remainingHand);
  }

  return { card: chosenCard, chosenColor };
}
