import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ArrowLeft,
  Home,
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  Tag, 
  HeartHandshake, 
  X,
  Check,
  ArrowUpRight,
  ArrowRight,
  RotateCw,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dbInstance } from '../lib/db';
import { CharacterRelationship, ChatSession } from '../lib/types';
import { generateEavesdropChatLogs, EavesdropMessage } from '../lib/api';

interface RelationshipNetworkViewProps {
  onBack: () => void;
}

// Helper to format character display name
const formatDisplayName = (name: string): string => {
  if (!name) return '';
  return name.replace(/\s*[\(\（].*?[\)\）]/g, '').trim();
};

export default function RelationshipNetworkView({ onBack }: RelationshipNetworkViewProps) {
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  
  // View State: null = Level 1 (Character Directory), string = Level 2 (Specific Character Detail)
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reverseEditingId, setReverseEditingId] = useState<string | null>(null);

  // Form Fields
  const [sourceName, setSourceName] = useState('');
  const [targetName, setTargetName] = useState('');
  const [relationTag, setRelationTag] = useState('');
  const [description, setDescription] = useState('');
  const [reverseDescription, setReverseDescription] = useState('');

  // Confirmation Modal
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Eavesdrop Modal State
  const [eavesdropRel, setEavesdropRel] = useState<CharacterRelationship | null>(null);
  const [eavesdropLogs, setEavesdropLogs] = useState<EavesdropMessage[]>([]);
  const [isGeneratingEavesdrop, setIsGeneratingEavesdrop] = useState<boolean>(false);
  const [eavesdropError, setEavesdropError] = useState<string | null>(null);
  const [showClearEavesdropConfirm, setShowClearEavesdropConfirm] = useState<boolean>(false);

  const eavesdropEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (eavesdropRel) {
      eavesdropEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [eavesdropLogs, eavesdropRel]);

  const loadData = async () => {
    try {
      const [relList, sessionList] = await Promise.all([
        dbInstance.getAllRelationships(),
        dbInstance.getAllSessions()
      ]);
      setRelationships(relList);
      // Filter unique character contacts (exclude group chat sessions)
      const individualSessions = sessionList.filter((s) => !s.isGroup && !s.isContactDeleted);
      setSessions(individualSessions);
    } catch (e) {
      console.error('Failed to load relationships network data:', e);
    }
  };

  // Helper to find avatar key for a given character name
  const getAvatarForName = (name: string): string => {
    if (!name) return '';
    const clean = formatDisplayName(name).trim().toLowerCase();
    const found = sessions.find((s) => {
      const sClean = formatDisplayName(s.characterName).trim().toLowerCase();
      const sReal = formatDisplayName(s.realName || '').trim().toLowerCase();
      const sName = s.characterName.trim().toLowerCase();
      return sClean === clean || sReal === clean || sName === clean || sName === name.trim().toLowerCase();
    });
    return found?.characterAvatar || '';
  };

  const renderAvatarContent = (name: string, avatarSrc?: string, sizeClass = "w-12 h-12 rounded-2xl", isDark = false) => {
    const avatar = avatarSrc !== undefined ? avatarSrc : getAvatarForName(name);
    const isImage = avatar && (
      avatar.startsWith('data:') || 
      avatar.startsWith('http') || 
      avatar.startsWith('blob:') || 
      avatar.startsWith('/')
    );

    return (
      <div className={`${sizeClass} ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-gradient-to-br from-indigo-100 to-purple-100 border-indigo-200/80'} overflow-hidden border shrink-0 shadow-2xs flex items-center justify-center`}>
        {isImage ? (
          <img
            src={avatar}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <span className={`font-black text-sm select-none ${isDark ? 'text-purple-300' : 'text-indigo-600'}`}>
            {avatar && avatar.length <= 4 ? avatar : (name ? name.slice(0, 1) : '👤')}
          </span>
        )}
      </div>
    );
  };

  // Extract all distinct character names from contacts list and relationships
  const allKnownCharacters = Array.from(
    new Set([
      ...sessions.map((s) => s.characterName),
      ...relationships.map((r) => r.sourceCharacterName),
      ...relationships.map((r) => r.targetCharacterName)
    ])
  );

  const findReverseRel = (src: string, tgt: string) => {
    return relationships.find(
      (r) => r.sourceCharacterName === tgt.trim() && r.targetCharacterName === src.trim()
    );
  };

  const handleOpenAddModal = (defaultSource?: string, defaultTarget?: string) => {
    const src = defaultSource || selectedCharacter || (sessions.length > 0 ? sessions[0].characterName : '');
    const candidate = allKnownCharacters.find((c) => c !== src) || '';
    const tgt = defaultTarget || candidate;

    setEditingId(null);
    setReverseEditingId(null);
    setSourceName(src);
    setTargetName(tgt);
    setRelationTag('');
    setDescription('');
    setReverseDescription('');

    // Check if relationships already exist between these two characters
    const forward = relationships.find((r) => r.sourceCharacterName === src && r.targetCharacterName === tgt);
    if (forward) {
      setEditingId(forward.id);
      setRelationTag(forward.relationTag || '');
      setDescription(forward.description);
    }
    const rev = findReverseRel(src, tgt);
    if (rev) {
      setReverseEditingId(rev.id);
      if (!forward && rev.relationTag) setRelationTag(rev.relationTag);
      setReverseDescription(rev.description);
    }

    setShowModal(true);
  };

  const handleOpenEditModal = (rel: CharacterRelationship) => {
    setEditingId(rel.id);
    setSourceName(rel.sourceCharacterName);
    setTargetName(rel.targetCharacterName);
    setRelationTag(rel.relationTag || '');
    setDescription(rel.description);

    // Look up reverse relationship (target ➔ source) for simultaneous editing
    const rev = findReverseRel(rel.sourceCharacterName, rel.targetCharacterName);
    if (rev) {
      setReverseEditingId(rev.id);
      setReverseDescription(rev.description);
    } else {
      setReverseEditingId(null);
      setReverseDescription('');
    }

    setShowModal(true);
  };

  // Auto update descriptions if user changes sourceName or targetName in modal
  const handleCharacterNameChange = (newSrc: string, newTgt: string) => {
    setSourceName(newSrc);
    setTargetName(newTgt);
    const forward = relationships.find(
      (r) => r.sourceCharacterName === newSrc.trim() && r.targetCharacterName === newTgt.trim()
    );
    if (forward) {
      setEditingId(forward.id);
      setDescription(forward.description);
      if (forward.relationTag) setRelationTag(forward.relationTag);
    } else {
      setEditingId(null);
      setDescription('');
    }

    const rev = findReverseRel(newSrc, newTgt);
    if (rev) {
      setReverseEditingId(rev.id);
      setReverseDescription(rev.description);
    } else {
      setReverseEditingId(null);
      setReverseDescription('');
    }
  };

  const handleSaveRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    const src = sourceName.trim();
    const tgt = targetName.trim();

    if (!src || !tgt) {
      alert('请填写完整的角色名称');
      return;
    }

    if (src === tgt) {
      alert('主体角色与目标对象不能是同一个角色');
      return;
    }

    if (!description.trim() && !reverseDescription.trim()) {
      alert('请至少填写一个方向的关系态度描述');
      return;
    }

    try {
      // 1. Save Forward Relationship (src ➔ tgt)
      if (description.trim()) {
        const forwardRel: CharacterRelationship = {
          id: editingId || `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          sourceCharacterName: src,
          targetCharacterName: tgt,
          relationTag: relationTag.trim() || undefined,
          description: description.trim(),
          updatedAt: Date.now()
        };
        await dbInstance.saveRelationship(forwardRel);
      } else if (editingId) {
        // If user cleared forward description, remove forward relationship
        await dbInstance.deleteRelationship(editingId);
      }

      // 2. Save Reverse Relationship (tgt ➔ src)
      if (reverseDescription.trim()) {
        const revRel: CharacterRelationship = {
          id: reverseEditingId || `rel_${Date.now() + 1}_${Math.random().toString(36).substring(2, 7)}`,
          sourceCharacterName: tgt,
          targetCharacterName: src,
          relationTag: relationTag.trim() || undefined,
          description: reverseDescription.trim(),
          updatedAt: Date.now()
        };
        await dbInstance.saveRelationship(revRel);
      } else if (reverseEditingId) {
        // If user cleared reverse description, remove reverse relationship
        await dbInstance.deleteRelationship(reverseEditingId);
      }

      setShowModal(false);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dbInstance.deleteRelationship(id);
      setDeleteConfirmId(null);
      await loadData();
    } catch (e) {
      console.error(e);
      alert('删除失败');
    }
  };

  // --- EAVESDROP / WIRETAP HANDLERS ---
  const handleOpenEavesdrop = (rel: CharacterRelationship) => {
    setEavesdropRel(rel);
    setEavesdropError(null);
    setShowClearEavesdropConfirm(false);

    const savedKey = `eavesdrop_logs_${rel.id}`;
    try {
      const raw = localStorage.getItem(savedKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEavesdropLogs(parsed);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to parse saved eavesdrop logs:', err);
    }

    setEavesdropLogs([]);
    triggerGenerateEavesdrop(rel, []);
  };

  const triggerGenerateEavesdrop = async (rel: CharacterRelationship, currentLogs: EavesdropMessage[]) => {
    setIsGeneratingEavesdrop(true);
    setEavesdropError(null);

    try {
      const reverseRel = findReverseRel(rel.sourceCharacterName, rel.targetCharacterName);
      const newMessages = await generateEavesdropChatLogs(
        rel.sourceCharacterName,
        rel.targetCharacterName,
        rel.description,
        reverseRel?.description,
        currentLogs
      );

      const updated = [...currentLogs, ...newMessages];
      setEavesdropLogs(updated);
      localStorage.setItem(`eavesdrop_logs_${rel.id}`, JSON.stringify(updated));
    } catch (err: any) {
      console.error('Eavesdrop generation error:', err);
      setEavesdropError(err.message || '生成窃听记录失败');
    } finally {
      setIsGeneratingEavesdrop(false);
    }
  };

  // --- LEVEL 1 FILTERING (CHARACTERS DIRECTORY) ---
  const filteredCharacters = allKnownCharacters.filter((cName) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      cName.toLowerCase().includes(q) ||
      relationships.some(
        (r) =>
          (r.sourceCharacterName === cName || r.targetCharacterName === cName) &&
          ((r.relationTag && r.relationTag.toLowerCase().includes(q)) ||
            r.description.toLowerCase().includes(q))
      )
    );
  });

  // --- LEVEL 2 FILTERING (SPECIFIC CHARACTER OUTGOING RELATIONSHIPS) ---
  const activeCharacterRelationships = relationships.filter((rel) => {
    if (!selectedCharacter) return false;

    // Show outgoing relationships where selectedCharacter is the source (看待者)
    if (rel.sourceCharacterName !== selectedCharacter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        rel.sourceCharacterName.toLowerCase().includes(q) ||
        rel.targetCharacterName.toLowerCase().includes(q) ||
        (rel.relationTag && rel.relationTag.toLowerCase().includes(q)) ||
        rel.description.toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="absolute inset-0 bg-slate-50 text-gray-800 flex flex-col font-sans z-20 overflow-hidden">
      {/* ========================================================= */}
      {/* LEVEL 1 HEADER: CHARACTER CARDS DIRECTORY */}
      {/* ========================================================= */}
      {!selectedCharacter ? (
        <div className="bg-white/90 backdrop-blur-md border-b border-gray-200/80 h-16 px-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onBack}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shrink-0"
              title="返回手机桌面"
            >
              <Home size={16} className="stroke-[2.5]" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white shadow-sm shrink-0">
              <Users size={16} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-none flex items-center space-x-1.5">
                <span>角色关系网</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-mono font-bold">
                  {allKnownCharacters.length}
                </span>
              </h2>
              <p className="text-[10px] font-sans text-gray-400 uppercase mt-1 leading-none">Character Connections</p>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* LEVEL 2 HEADER: SPECIFIC CHARACTER RELATIONSHIPS NETWORK */
        /* ========================================================= */
        <div className="bg-white/90 backdrop-blur-md border-b border-gray-200/80 h-16 px-4 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center space-x-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                setSelectedCharacter(null);
                setSearchQuery('');
              }}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shrink-0"
              title="返回角色列表"
            >
              <ArrowLeft size={16} className="stroke-[2.5]" />
            </button>
            <div className="flex items-center space-x-2 min-w-0">
              {renderAvatarContent(selectedCharacter, getAvatarForName(selectedCharacter), "w-8 h-8 rounded-full")}
              <div className="min-w-0">
                <h1 className="text-sm font-black text-gray-900 tracking-tight truncate">
                  {selectedCharacter} 的关系网
                </h1>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenAddModal(selectedCharacter)}
            className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
            title="添加关系"
          >
            <Plus size={16} className="stroke-[2.5]" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN BODY CONTENT */}
      {/* ========================================================= */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={
              !selectedCharacter
                ? "搜索角色名字或关系描述..."
                : `搜索 ${selectedCharacter} 相关的角色关系...`
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
        </div>

        {/* ========================================================= */}
        {/* LEVEL 1: CHARACTER CARDS GRID LIST (SINGLE COLUMN) */}
        {/* ========================================================= */}
        {!selectedCharacter && (
          <div className="space-y-3 pb-8">
            {filteredCharacters.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-300 space-y-3 my-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-500">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700">暂无符合条件的角色</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredCharacters.map((cName) => {
                  const avatarKey = getAvatarForName(cName);
                  const charOutgoing = relationships.filter((r) => r.sourceCharacterName === cName);
                  const charIncoming = relationships.filter((r) => r.targetCharacterName === cName);
                  const totalRelated = charOutgoing.length;


                  return (
                    <motion.div
                      key={cName}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedCharacter(cName);
                        setSearchQuery('');
                      }}
                      className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        {renderAvatarContent(cName, avatarKey, "w-12 h-12 rounded-2xl")}

                        <div className="min-w-0 space-y-1">
                          <h3 className="text-sm font-black text-gray-900 truncate flex items-center space-x-1.5">
                            <span>{cName}</span>
                          </h3>

                          {/* Relationship Stats Pill */}
                          <div className="flex items-center space-x-1.5 text-[10px] font-bold">
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                              共 {totalRelated} 组社会关系
                            </span>
                          </div>

                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-indigo-600 text-gray-400 group-hover:text-white flex items-center justify-center transition-all shrink-0 ml-2">
                        <ArrowUpRight size={16} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* LEVEL 2: SELECTED CHARACTER RELATIONSHIP LIST */}
        {/* ========================================================= */}
        {selectedCharacter && (
          <div className="space-y-3 pb-8">
            {/* Relationship List Cards */}
            {activeCharacterRelationships.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-300 space-y-3 my-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-500">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700">暂无符合条件的角色关系</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal(selectedCharacter)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer inline-flex items-center space-x-1"
                >
                  <Plus size={14} />
                  <span>为 {selectedCharacter} 添加关系</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {activeCharacterRelationships.map((rel) => {
                  const isCurrentSource = rel.sourceCharacterName === selectedCharacter;
                  // Determine the target/other character (被看待者)
                  const targetCharName = isCurrentSource ? rel.targetCharacterName : rel.sourceCharacterName;
                  const targetAvatar = getAvatarForName(targetCharName);
                  const reverseRel = findReverseRel(rel.sourceCharacterName, rel.targetCharacterName);

                  return (
                    <motion.div
                      key={rel.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs hover:shadow-md transition-all space-y-3 relative"
                    >
                      {/* Card Header: Shows target character (被看待者) avatar & nickname, tag, plus Eavesdrop Button */}
                      <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <div
                          onClick={() => {
                            setSelectedCharacter(targetCharName);
                            setSearchQuery('');
                          }}
                          className="flex flex-col items-start space-y-1 min-w-0 cursor-pointer group/target"
                          title={`点击查看 ${targetCharName} 的关系网`}
                        >
                          {/* Avatar & Nickname Row */}
                          <div className="flex items-center space-x-2 min-w-0">
                            {renderAvatarContent(targetCharName, targetAvatar, "w-8 h-8 rounded-full")}
                            <span className="text-sm font-black text-gray-900 group-hover/target:text-indigo-600 transition-colors truncate">
                              {targetCharName}
                            </span>
                          </div>

                          {/* Tag displayed beneath Avatar and Nickname */}
                          {rel.relationTag && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 inline-flex items-center space-x-1 shrink-0">
                              <Tag size={10} />
                              <span>{rel.relationTag}</span>
                            </span>
                          )}
                        </div>

                        {/* Eavesdrop / Wiretap Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEavesdrop(rel);
                          }}
                          className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
                          title={`窃听 ${rel.sourceCharacterName} 与 ${targetCharName} 的私聊`}
                        >
                          <Radio size={13} className="animate-pulse text-purple-200" />
                          <span>窃听</span>
                        </button>
                      </div>

                      {/* Relationship Card Preview Format:
                          看待者 → (看待者对被看待者的看法)
                          被看待者 → (被看待者对看待者的看法) */}
                      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100/80 text-xs text-gray-700 leading-relaxed space-y-2">
                        {/* Direction 1: 看待者 ➔ 看法 */}
                        <div className="flex items-start space-x-1.5">
                          <span className="font-bold text-indigo-900 shrink-0 flex items-center space-x-1 pt-0.5">
                            <span>{rel.sourceCharacterName}</span>
                            <ArrowRight size={13} className="text-indigo-600 inline shrink-0" />
                          </span>
                          <p className="whitespace-pre-wrap font-sans text-gray-800 flex-1">{rel.description}</p>
                        </div>

                        {/* Direction 2: 被看待者 ➔ 看法 (if reverse relationship exists) */}
                        {reverseRel && reverseRel.description && (
                          <div className="flex items-start space-x-1.5 pt-2 border-t border-slate-200/60">
                            <span className="font-bold text-purple-900 shrink-0 flex items-center space-x-1 pt-0.5">
                              <span>{rel.targetCharacterName}</span>
                              <ArrowRight size={13} className="text-purple-600 inline shrink-0" />
                            </span>
                            <p className="whitespace-pre-wrap font-sans text-gray-800 flex-1">{reverseRel.description}</p>
                          </div>
                        )}
                      </div>

                      {/* Bottom Actions Bar */}
                      <div className="flex items-center justify-end pt-1 text-[11px] text-gray-500 space-x-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(rel)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-indigo-600 hover:bg-gray-100 transition-colors cursor-pointer"
                          title="编辑关系"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(rel.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="删除关系"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* ADD / EDIT RELATIONSHIP MODAL (DUAL-DIRECTIONAL EDITING) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showModal && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-md p-5 shadow-2xl space-y-4 text-gray-800 border border-gray-100 relative max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                    <HeartHandshake size={18} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-gray-900">
                      {editingId ? '编辑角色关系' : '添加角色关系'}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveRelationship} className="space-y-4 text-xs">
                {/* Source Character & Target Character Choice */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Source Character */}
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 block">
                      主体角色 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      list="known-characters-list"
                      placeholder="输入角色名"
                      value={sourceName}
                      onChange={(e) => handleCharacterNameChange(e.target.value, targetName)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                      required
                    />
                  </div>

                  {/* Target Character */}
                  <div className="space-y-1">
                    <label className="font-bold text-gray-700 block">
                      目标对象 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      list="known-characters-list"
                      placeholder="输入角色名"
                      value={targetName}
                      onChange={(e) => handleCharacterNameChange(sourceName, e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                      required
                    />
                  </div>
                </div>

                <datalist id="known-characters-list">
                  {allKnownCharacters.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>

                {/* Relation Tag */}
                <div className="space-y-1">
                  <label className="font-bold text-gray-700 block">
                    关系短标签
                  </label>
                  <input
                    type="text"
                    value={relationTag}
                    onChange={(e) => setRelationTag(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>

                {/* Dual-Direction Relationship Text Areas */}
                <div className="space-y-3 pt-1">
                  {/* Direction 1: Source ➔ Target */}
                  <div className="space-y-1">
                    <label className="font-bold text-indigo-900 flex items-center space-x-1">
                      <span>【{sourceName || '角色A'} ➔ {targetName || '角色B'}】 关系态度&过往羁绊：</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl text-gray-800 leading-relaxed focus:outline-none focus:border-indigo-500 focus:bg-white resize-y min-h-[100px]"
                    />
                  </div>

                  {/* Direction 2: Target ➔ Source (Simultaneous Mutual Editing) */}
                  <div className="space-y-1">
                    <label className="font-bold text-purple-900 flex items-center space-x-1">
                      <span>【{targetName || '角色B'} ➔ {sourceName || '角色A'}】 关系态度&过往羁绊：</span>
                    </label>
                    <textarea
                      rows={4}
                      value={reverseDescription}
                      onChange={(e) => setReverseDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-purple-50/50 border border-purple-100 rounded-xl text-gray-800 leading-relaxed focus:outline-none focus:border-purple-500 focus:bg-white resize-y min-h-[100px]"
                    />
                  </div>
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-bold text-xs transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <Check size={15} />
                    <span>保存</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-5 w-full max-w-sm text-center shadow-2xl space-y-4 text-gray-800 border border-gray-100"
            >
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-gray-900">确认删除此条关系设定？</h3>
                <p className="text-xs text-gray-500">删除后，该条关系的相关记忆将被抹除</p>
              </div>
              <div className="flex items-center justify-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* FULL-SCREEN EAVESDROP / WIRETAP MESSAGING APP MODAL */}
      {/* ========================================================= */}
      <AnimatePresence>
        {eavesdropRel && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute inset-0 bg-slate-900 z-50 flex flex-col font-sans"
          >
            {/* Messaging App Top Header Bar */}
            <div className="bg-slate-900 text-white h-16 px-4 flex items-center justify-between border-b border-slate-800/80 shadow-md shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setEavesdropRel(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-200 transition-colors cursor-pointer shrink-0"
                  title="关闭窃听频道"
                >
                  <ChevronLeft size={20} />
                </button>
                
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-purple-900/80 border border-purple-500/50 flex items-center justify-center text-purple-300 shrink-0">
                    <Radio size={16} className="animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-1 truncate">
                      <span className="font-black text-sm text-white">
                        {eavesdropRel.sourceCharacterName}
                      </span>
                      <span className="text-xs text-purple-400 font-bold px-0.5">💬</span>
                      <span className="font-black text-sm text-white">
                        {eavesdropRel.targetCharacterName}
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-400 flex items-center space-x-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                      <span>加密信号拦截中 · 无感知监控</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Reset/Clear Button */}
              <button
                type="button"
                onClick={() => setShowClearEavesdropConfirm(true)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title="清空窃听记录"
              >
                <RotateCw size={15} />
              </button>
            </div>

            {/* Messaging App Main Messages Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/95 text-slate-100">
              {eavesdropLogs.length === 0 && !isGeneratingEavesdrop && !eavesdropError && (
                <div className="flex flex-col items-center justify-center h-64 space-y-3 text-slate-500">
                  <Radio size={36} className="text-slate-600" />
                  <p className="text-xs font-bold text-slate-400">
                    当前暂无窃听记录
                  </p>
                  <p className="text-[11px] text-slate-500">
                    点击下方“继续窃听”按钮抓取【{eavesdropRel.sourceCharacterName}】与【{eavesdropRel.targetCharacterName}】的私聊气泡
                  </p>
                </div>
              )}

              {eavesdropLogs.length === 0 && isGeneratingEavesdrop && (
                <div className="flex flex-col items-center justify-center h-64 space-y-3 text-purple-300">
                  <Radio size={36} className="animate-spin text-purple-400" />
                  <p className="text-xs font-bold animate-pulse text-purple-200">
                    正在秘密拦截【{eavesdropRel.sourceCharacterName}】与【{eavesdropRel.targetCharacterName}】的私聊气泡...
                  </p>
                </div>
              )}

              {eavesdropError && (
                <div className="bg-rose-950/80 border border-rose-800 text-rose-200 rounded-2xl p-4 text-xs space-y-2 text-center my-4">
                  <p className="font-bold">{eavesdropError}</p>
                  <button
                    type="button"
                    onClick={() => triggerGenerateEavesdrop(eavesdropRel, eavesdropLogs)}
                    className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 rounded-xl font-bold text-white transition-colors cursor-pointer"
                  >
                    重新建立窃听信号
                  </button>
                </div>
              )}

              {eavesdropLogs.map((msg) => {
                // 看待者 (sourceCharacterName) -> RIGHT SIDE
                // 被看待者 (targetCharacterName) -> LEFT SIDE
                const isSource = msg.senderName === eavesdropRel.sourceCharacterName;
                const avatarKey = getAvatarForName(msg.senderName);

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-start space-x-2.5 ${
                      isSource ? 'flex-row-reverse space-x-reverse' : 'flex-row'
                    }`}
                  >
                    {/* Character Avatar */}
                    {renderAvatarContent(msg.senderName, avatarKey, "w-9 h-9 rounded-full", true)}

                    {/* Sender Name & Chat Bubble */}
                    <div className={`max-w-[74%] space-y-1 ${isSource ? 'items-end text-right' : 'items-start text-left'}`}>
                      <div className="px-1 text-[10px] font-bold text-slate-400">
                        {msg.senderName}
                      </div>

                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed shadow-md break-words whitespace-pre-wrap ${
                          isSource
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-xs'
                            : 'bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tl-xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              <div ref={eavesdropEndRef} />
            </div>

            {/* Messaging App Bottom Action Toolbar */}
            <div className="px-4 py-3 min-h-[64px] bg-slate-900 border-t border-slate-800 flex flex-col items-center justify-center space-y-2 shrink-0">
              <button
                type="button"
                onClick={() => triggerGenerateEavesdrop(eavesdropRel, eavesdropLogs)}
                disabled={isGeneratingEavesdrop}
                className="w-full py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold text-xs rounded-2xl shadow-lg hover:shadow-purple-900/40 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 active:scale-98"
              >
                {isGeneratingEavesdrop ? (
                  <>
                    <Radio size={16} className="animate-spin text-purple-200" />
                    <span>正在截获下一段私聊对话...</span>
                  </>
                ) : (
                  <>
                    <Radio size={16} className="animate-pulse text-purple-200" />
                    <span>继续窃听 (不覆盖已有内容)</span>
                  </>
                )}
              </button>

              <p className="text-[10px] text-slate-500 text-center">
                对话记录已全量加密保存至本地 · AI角色对窃听保持100%无感知状态
              </p>
            </div>

            {/* Custom Clear Confirmation Dialog */}
            {showClearEavesdropConfirm && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs z-30 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-slate-900 border border-slate-700/80 rounded-2xl p-5 max-w-xs w-full text-center space-y-4 shadow-2xl"
                >
                  <p className="text-sm font-bold text-white">确认清空记录？</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    将清空【{eavesdropRel.sourceCharacterName}】与【{eavesdropRel.targetCharacterName}】的全部历史窃听对话，无法撤销。
                  </p>
                  <div className="flex items-center space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowClearEavesdropConfirm(false)}
                      className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (eavesdropRel) {
                          localStorage.removeItem(`eavesdrop_logs_${eavesdropRel.id}`);
                          setEavesdropLogs([]);
                          setEavesdropError(null);
                        }
                        setShowClearEavesdropConfirm(false);
                      }}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm active:scale-95"
                    >
                      确定清空
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
