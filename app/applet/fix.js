const fs = require('fs');

const filePath = '/app/applet/src/components/FanficApp.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const startIndex = code.indexOf('  // Generation Logic');
const endIndex = code.indexOf('  const activeProfileData = profiles.find');

if (startIndex === -1 || endIndex === -1) {
  console.error('Markers not found!');
  process.exit(1);
}

const replacement = `  // Generation Logic
  const handleGenerateFanfics = async (targetMode: 'plaza' | 'ao3' | 'xianyu' = (activeTab === 'ao3' ? 'ao3' : activeTab === 'xianyu' ? 'xianyu' : 'plaza')) => {
    if (!settings || !settings.apiKey) {
      setError("请先在设置中配置 API Key");
      return;
    }
    if (targetMode !== 'xianyu' && !activeProfileId) {
      setError("请先选择或创建一个梦男人设");
      setActiveTab('mine');
      return;
    }
    
    const activeProfile = profiles.find(p => p.id === activeProfileId);
    if (targetMode !== 'xianyu' && !activeProfile) return;

    setIsGenerating(true);
    setError(null);

    const charContext = sessions
      .filter(s => !s.isGroup && !s.isContactDeleted)
      .map(s => {
        const boundPenName = characterPenNames[s.characterName];
        return \`- 角色真实姓名【\${s.characterName}】\${boundPenName ? \`(已固定专属马甲笔名："\${boundPenName}")\` : '(尚无马甲笔名)'}：\${s.memory.substring(0, 100)}...\`;
      })
      .join('\\n');

    const isAo3 = targetMode === 'ao3';
    const isXianyu = targetMode === 'xianyu';

    let promptSystem = '';
    let userPromptText = '';

    if (isXianyu) {
      const allProfilesText = profiles.length > 0
        ? profiles.map((p, idx) => \`- 档案\${idx + 1}: 姓名【\${p.name || '未命名'}】，\${p.gender || ''} \${p.age || ''}岁，MBTI \${p.mbti || '未知'}，外貌特征: \${p.features || '无'}，性格与喜好: \${p.personality || ''}；喜欢 \${p.likes || ''}\`).join('\\n')
        : '（当前用户暂未创建具体档案，针对二次元通用梦周边发帖）';

      promptSystem = \`你是一个二次元“二手二手交易论坛（某鱼）”的后台生成引擎。在这个论坛贴吧里，玩家网民，以及通讯录里的已知角色【披闲鱼马甲】会出谷（卖周边）、收谷（买周边）、或者发帖讨论/展示自己的痛包与谷美（如立牌、徽章、色纸、流沙麻将、拍立得、挂件、棉花娃娃等）。

【用户拥有的梦人设档案列表（请从中随机抽选人设的谷子/周边进行发帖）】：
\${allProfilesText}

【通讯录已知角色列表（角色也会披闲鱼马甲在上面出/收/讨论谷子）】：
\${charContext || '（当前暂无通讯录角色，可自由发挥闲鱼路人卖家/买家）'}

========================================
【全局健康与外貌描写禁令】：
1. 默认所有角色（包括所有男女主角与配角）均进行精细的体毛管理，【绝对严禁出现任何胡子、胡茬、络腮胡或体毛描写】！
2. 整个正文、描述及评论中，【绝对严禁出现任何吸烟、抽烟、点烟、烟草、香烟、烟灰、吐烟圈等相关词汇和行为描写】！

========================================
【同好评论区专属规则】：
- 生成的同好评论（topComments）中，【绝对不允许出现任何已知角色的真实姓名、官方昵称或花名】！
- 如果评论中需要合并称呼作品里的男女主角两个人（CP/双主角/男女主），必须统一且仅使用“家产”作为代称！（例如：“家产这套谷美绝了”、“求家产双人立牌”、“家产锁死”等）。

========================================
【某鱼发帖生成指令】：
你需要【针对用户所有档案内随机抽选人设】，一次性【固定生成 4 篇】二手交易论坛的帖子！
包含：出谷（sell）、收谷（buy）、讨论/展示痛包或谷美（discuss）。
请严格返回合法的 JSON 对象，格式如下：
{
  "fanfics": [
    {
      "title": "帖子标题（例如：【出】烫谷现货！流沙麻将/色纸打包走，或者【高价收】绝版全彩痛包/拍立得，或者【讨论】家产这款立牌配什么扎板好看？）",
      "content": "帖子正文内容（描述谷子品相、盘扣/打包要求、邮费、或者讨论心得，如需换行请使用 \\\\n）",
      "price": "标价或预算（例如：'￥45'、'￥120'、'可议价/换谷'、'自提包邮'等）",
      "tradeType": "sell" 或 "buy" 或 "discuss",
      "targetOcName": "涉及的是哪一个人设的周边谷子（写该人设的姓名）",
      "authorPenName": "发帖闲鱼ID/笔名",
      "authorType": "character" (如果是通讯录里的角色披马甲发的) 或 "netizen" (如果是路人网民发的),
      "baseCharacterName": "如果是 character 写的话，填写角色的真名，如果是路人填 null",
      "tags": ["出谷", "烫谷", "痛包", "吃谷" 等 2-4个标签],
      "topComments": ["回帖评论1", "回帖评论2"] // 1~3条简短的回帖评论（如：“排！”、“已私”、“家产这套绝了”）
    }
  ]
}
【极其重要】：
1. 所有的双引号必须转义。绝对不可直接使用真实换行，必须使用 \\\\n。
2. 必须生成 4 篇帖子（fanfics 数组元素个数为 4）。
3. 返回的结果必须是一个合法的 JSON 对象。
\`;
      userPromptText = \`请从用户所有档案中随机抽选人设，严格按照要求固定生成 4 篇某鱼二手交易/谷子讨论帖 JSON。\`;
    } else {
      const profileText = \`
【主角（用户）人设档案】
- 基础：姓名 \${activeProfile?.name || '未命名'}，\${activeProfile?.age || '未知年龄'}，性别 \${activeProfile?.gender || '保密'}，生日 \${activeProfile?.birthday || '未知'}，MBTI \${activeProfile?.mbti || '未知'}
- 外貌：身高 \${activeProfile?.height || '未知'}，体重 \${activeProfile?.weight || '未知'}，发型/发色 \${activeProfile?.hair || '未知'}，眼瞳 \${activeProfile?.eyes || '未知'}，肤色 \${activeProfile?.skin || '未知'}，特征 \${activeProfile?.features || '无'}
- 性格：\${activeProfile?.personality || '未知'}
- 喜好：喜欢 \${activeProfile?.likes || '无'}，讨厌 \${activeProfile?.dislikes || '无'}，擅长 \${activeProfile?.goodAt || '无'}，兴趣 \${activeProfile?.hobbies || '无'}
- 偏好细节：颜色 \${activeProfile?.color || '无'}，音乐 \${activeProfile?.music || '无'}，食物 \${activeProfile?.food || '无'}，季节 \${activeProfile?.season || '无'}
- 人生大事件：\${activeProfile?.keyEvents || '无'}
- 隐藏面/秘密：\${activeProfile?.hiddenSide || '无'}
\`;

      promptSystem = \`你是一个“同人创作社区”的后台生成引擎。这个同人社区中有通讯录里的已知角色【披马甲/笔名】产粮，也有路人同好网民产粮。

【当前同人作品主角（即用户梦人设）档案】：
\${profileText}

【通讯录已知角色列表（极其重要：如果角色产粮，必须使用通讯录里的角色真实名字；马甲笔名由你决定或沿用已有马甲）】：
\${charContext || '（当前暂无通讯录角色，全由路人同好产粮）'}

========================================
【全局健康与外貌描写禁令】：
1. 默认所有角色（包括所有男女主角与配角）均进行精细的体毛管理，【绝对严禁出现任何胡子、胡茬、络腮胡或体毛描写】！
2. 整个正文、描述及评论中，【绝对严禁出现任何吸烟、抽烟、点烟、烟草、香烟、烟灰、吐烟圈等相关词汇和行为描写】！

========================================
【同好评论区专属规则】：
- 生成的同好评论（topComments）中，【绝对不允许出现任何已知角色的真实姓名、官方昵称或花名】！
- 如果评论中需要合并称呼作品里的男女主角两个人（CP/双主角/男女主），必须统一且仅使用“家产”作为代称！（例如：“家产真的太好嗑了”、“家产锁死”、“救命家产太甜了”等）。

========================================
【核心文风预设与写作指令（按要求选择使用）】：

【文风预设一：电影感镜头 / 极简意识流】
1. 影像化叙事：禁止心理旁白，改用“镜头语言”。通过环境光的明暗、雨滴的划落、指尖的颤抖来传达情绪，而非直接描述心情或心理。
2. 极简主义与去工业化：剔除冗余形容词，力量感来源于精准动词，拒绝套路与工业糖精。
3. 专项修正：拒绝“解释性回复”，打破 [动作]+[内心戏] 循环，采用感官错位（用听觉写视觉，用触觉写听觉）。
4. 语言风格参考：海明威‘冰山理论’或王家卫意识流独白。具文学性而非剧本说明。
5. 词汇禁令：严禁出现 ‘猎物、诚实、有趣、涟漪、手术刀’ 等被污染词汇。

【文风预设二：真实质朴白描风格】
1. 真实环境白描：用平实自然、顺滑如白开水般的语言铺垫环境场景，真实贴合生活，不使用冗杂叙述，蕴含深厚情感。
2. 人物对话氛围：将真实情感不加繁复修饰表达出来，语言简单质朴、真实鲜活不嚼蜡。直接呈现生活化对话，不堆砌修饰，真实表达人心。
3. 感情与性张力：通过对细微变化的描写衬托爱意与暧昧（字字不说爱，字字都是爱）。
   【绝对禁止出现词汇组合】：严禁出现 ‘揉进，揉碎，浮木，低吼一声，长驱直入，神明，把命给你，神祇，主人，囚笼，骑士’ 等词，会严重破坏白描氛围！
4. 酸涩与情绪流转：通过切入周围环境烘托主人公苦情与酸涩，七分真实加三分生动，干净利落，不拖泥带水。

【文风应用规则】：
1. 脑洞/梗/摘要类作品：不需要文风修饰，保持真实、简洁、脑洞大开或碎碎念式的直接呈现。
2. 正文短文类作品：请在【文风预设一】与【文风预设二】中【各自独立随机选择一种文风】进行创作，使生成的作品风格丰富多样、不拘一格。
========================================

\${isAo3 ? '【注意：你需要生成的内容是成人向（NSFW / R18）的同人作品，包括两性情感的描写。但绝不可包含违背安全政策的极端露骨暴力色情或违规词汇，请在健康安全的底线上创作一些“车速较快”的、带有性暗示的擦边短文或设定脑洞，同时保持上述文学色彩与氛围。】' : ''}你需要一次性【固定生成 4 篇】同人作品。包含：
- 2 ~ 3 篇短打/脑洞设定摘要（篇幅较短，主要是设定梗、段子、暗恋视角的碎碎念）
- 1 ~ 2 篇有一定长度的短文（包含一些场景描写、互动片段，可以是原著向，也可以是AU比如校园、星际等）

请严格返回合法的 JSON 对象，格式如下：
{
  "fanfics": [
    {
      "title": "作品标题",
      "content": "作品正文内容（短文可长达几百字，如果需要换行必须使用转义字符 \\\\n，绝对不可在 JSON 中直接使用真实的换行符）",
      "authorPenName": "作者笔名（如果已有固定马甲必须严格一致；如果没有则是新取笔名）",
      "authorType": "character" (如果是通讯录里的角色披马甲写的) 或者 "netizen" (如果是路人网民写的),
      "baseCharacterName": "如果是 character 写的话，这里的真实身份是谁（写角色的真名），如果是路人填 null",
      "tags": ["暗恋", "AU", "脑洞", "OOC警告" 等，2-4个标签],
      "topComments": ["同好评论1", "同好评论2"] // 随机生成1~3条简短的读者同好评论（不需要作者回复）
    }
  ]
}
【极其重要】：
1. 所有的双引号必须转义。
2. 绝对不可直接使用真实换行，必须使用 \\\\n。
3. 必须生成 4 篇同人作品（fanfics 数组元素个数为 4）。
4. 返回的结果必须是一个合法的 JSON 对象，不要包含 markdown 格式 (如 \`\`\`json) ，必须能直接通过 JSON.parse 解析。外层必须是 {"fanfics": [ ... ]} 的格式。
\`;
      userPromptText = \`\${profileText}\\n请严格按照要求固定生成 4 篇关于该主角的同人作品 JSON。\`;
    }

    try {
      const response = await fetch('/api/proxy/openai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: \`\${settings.baseUrl || 'https://api.openai.com/v1'}/chat/completions\`,
          headers: {
            'Authorization': \`Bearer \${settings.apiKey}\`,
            'Content-Type': 'application/json'
          },
          body: {
            model: settings.selectedModel || 'gpt-4o',
            messages: [
              { role: 'system', content: promptSystem },
              { role: 'user', content: userPromptText }
            ],
            temperature: 0.85,
            max_tokens: 8000,
            response_format: { type: "json_object" }
          }
        })
      });

      if (!response.ok) {
        throw new Error(\`API Error: \${response.statusText}\`);
      }

      const resJson = await response.json();
      const text = resJson.choices?.[0]?.message?.content?.trim() || '';
      
      let cleanText = text;
      const jsonMatch = cleanText.match(/\`\`\`(?:json)?\\s*([\\s\\S]*?)\\s*\`\`\`/i);
      if (jsonMatch) cleanText = jsonMatch[1];
      else cleanText = cleanText.replace(/^\`\`\`(?:json)?\\s*/i, '').replace(/\\s*\`\`\`$/, '').trim();
      
      // Extract exactly balanced JSON object { ... } to handle extra trailing braces or markdown
      const extractBalancedJsonObject = (str: string): string => {
        const firstBrace = str.indexOf('{');
        if (firstBrace === -1) return str;

        let depth = 0;
        let inString = false;
        let escape = false;

        for (let i = firstBrace; i < str.length; i++) {
          const char = str[i];
          if (escape) {
            escape = false;
            continue;
          }
          if (char === '\\\\' && inString) {
            escape = true;
            continue;
          }
          if (char === '"') {
            inString = !inString;
            continue;
          }
          if (!inString) {
            if (char === '{') {
              depth++;
            } else if (char === '}') {
              depth--;
              if (depth === 0) {
                return str.substring(firstBrace, i + 1);
              }
            }
          }
        }
        return str.substring(firstBrace, str.lastIndexOf('}') + 1);
      };

      cleanText = extractBalancedJsonObject(cleanText);

      let parsed;
      try {
        parsed = JSON.parse(cleanText);
      } catch (parseError) {
        console.error("JSON parse error on raw text, attempting repair:", cleanText);
        try {
          // Attempt 1: Remove trailing commas before closing braces/brackets
          const repairedCommas = cleanText.replace(/,\\s*([\\]}])/g, '$1');
          parsed = JSON.parse(repairedCommas);
        } catch (e2) {
          try {
            // Attempt 2: Sanitize raw unescaped newlines inside JSON strings
            const repairedNewlines = cleanText.replace(/[\\r\\n]+/g, '\\\\n');
            const fixedJson = extractBalancedJsonObject(repairedNewlines);
            parsed = JSON.parse(fixedJson);
          } catch (e3) {
            console.error("All JSON parse attempts failed:", e3);
            throw new Error('生成的同人作品格式解析失败，请再次点击右上角刷新重试');
          }
        }
      }
      const fanfics = parsed?.fanfics || [];
      
      if (!Array.isArray(fanfics) || fanfics.length === 0) {
        throw new Error('生成的同人作品格式不符合要求');
      }

      let updatedPenNames = { ...characterPenNames };
      let penNamesUpdated = false;

      const newPosts: FanficPost[] = fanfics.map((f: any) => {
        let authorPenName = f.authorPenName || '佚名';
        const authorType = f.authorType || 'netizen';
        const baseCharacterName = f.baseCharacterName;

        if (authorType === 'character' && baseCharacterName) {
          if (updatedPenNames[baseCharacterName]) {
            authorPenName = updatedPenNames[baseCharacterName];
          } else {
            updatedPenNames[baseCharacterName] = authorPenName;
            penNamesUpdated = true;
          }
        }

        return {
          category: targetMode,
          isAo3,
          price: f.price || (isXianyu ? '￥35' : undefined),
          tradeType: f.tradeType || 'sell',
          targetOcName: f.targetOcName || activeProfile?.name || '梦男周边',
          id: \`fic_\${Date.now()}_\${Math.random().toString(36).substr(2, 5)}\`,
          title: f.title || '无题',
          content: f.content || '',
          authorPenName,
          authorType,
          baseCharacterName,
          tags: Array.isArray(f.tags) ? f.tags : [],
          topComments: Array.isArray(f.topComments) ? f.topComments : [],
          likes: Math.floor(Math.random() * 500) + 12,
          comments: Math.floor(Math.random() * 50) + 2,
          timestamp: Date.now() - Math.floor(Math.random() * 86400000)
        };
      });

      if (penNamesUpdated) {
        setCharacterPenNames(updatedPenNames);
      }

      setPosts([...newPosts, ...posts]);
      
    } catch (e: any) {
      console.error(e);
      setError(e.message || "生成失败");
    } finally {
      setIsGenerating(false);
    }
  };

`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully repaired FanficApp.tsx');
