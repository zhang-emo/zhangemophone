/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Home,
  BookOpen, 
  Plus, 
  Trash2, 
  Sparkles, 
  FileText, 
  Search, 
  FolderOpen,
  FolderPlus,
  Folder,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  MoreVertical,
  Upload
} from 'lucide-react';
import mammoth from 'mammoth';
import { WorldBookConfig, WorldBookEntry, WorldBookFolder } from '../lib/types';
import { dbInstance, DEFAULT_DIALOGUE_PRESET } from '../lib/db';

export default function WorldBookView({ onHome }: { onHome?: () => void }) {
  const [config, setConfig] = useState<WorldBookConfig>({
    preRules: '',
    preRulesActive: true,
    preRulesTitle: '核心前置规则',
    midRules: '',
    midRulesActive: true,
    midRulesTitle: '中置常驻规则',
    entries: [],
    postRules: '',
    postRulesActive: true,
    postRulesTitle: '格式自检与强化规则',
    dialoguePreset: DEFAULT_DIALOGUE_PRESET,
    dialoguePresetActive: true,
    dialoguePresetTitle: '预设设定'
  });

  const [activeMainTab, setActiveMainTab] = useState<'preset' | 'worldbook'>('preset');
  const [worldBookSubTab, setWorldBookSubTab] = useState<'pre' | 'mid' | 'post'>('pre');
  const [midSubTab, setMidSubTab] = useState<'static' | 'dynamic'>('static');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<'pre' | 'mid' | 'post' | 'preset' | null>(null);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<{
    type: 'entry' | 'list';
    listType?: 'pre' | 'mid' | 'post' | 'preset';
    id: string;
    title: string;
  } | null>(null);

  // Active dropdown menu ID for folder/entry management
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenuId(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [editModal, setEditModal] = useState<{
    type: 'pre' | 'mid' | 'post' | 'preset' | 'dynamic';
    id: string;
    title: string;
    content: string;
    keywords?: string;
  } | null>(null);

  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');
  const [modalKeywords, setModalKeywords] = useState('');
  const [modalFolderId, setModalFolderId] = useState<string>('');
  const [modalEntryType, setModalEntryType] = useState<'dynamic' | 'static'>('dynamic');

  // Folder states
  const [folderModal, setFolderModal] = useState<{ mode: 'create' | 'edit'; id?: string; name: string } | null>(null);
  const [folderModalName, setFolderModalName] = useState<string>('');
  const [deleteFolderConfirm, setDeleteFolderConfirm] = useState<{ id: string; name: string; count: number } | null>(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderEntryCard = (entry: WorldBookEntry, idx: number) => {
    const isExpanded = expandedIds[entry.id] ?? false;
    const isStatic = entry.entryType === 'static';
    const kwList = entry.keywords ? entry.keywords.split(/[,，]/).map(k => k.trim()).filter(Boolean) : [];
    return (
      <div 
        key={entry.id} 
        className={`bg-white rounded-2xl border transition-all p-3.5 flex flex-col gap-2.5 shadow-xs ${
          entry.isActive ? 'border-gray-200/80 hover:border-gray-300' : 'border-gray-200/50 opacity-60'
        }`}
      >
        {/* Top Row: Clickable header for toggling collapse */}
        <div className="flex items-center justify-between gap-2">
          <div 
            onClick={() => toggleExpand(entry.id)}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none group"
          >
            <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 rounded-lg px-2 py-1 font-mono shrink-0">
              {(idx + 1).toString().padStart(2, '0')}
            </span>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                <span className="font-extrabold text-xs text-gray-800 truncate group-hover:text-amber-600 transition-colors">
                  {entry.title || <span className="text-gray-400 italic font-normal">未命名的设定</span>}
                </span>

                {/* Entry Type Badge */}
                {isStatic ? (
                  <span className="text-[9px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 shrink-0">
                    📌 常驻背景
                  </span>
                ) : (
                  <span className="text-[9px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 shrink-0">
                    🔑 词汇触发
                  </span>
                )}

                {entry.characterName && (
                  <span className="text-[9px] font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5 shrink-0">
                    👤 {entry.characterName}
                  </span>
                )}
              </div>
              {/* Small inline preview of keywords */}
              {!isStatic && kwList.length > 0 && !isExpanded && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {kwList.slice(0, 3).map((kw, kIdx) => (
                    <span key={kIdx} className="text-[9px] bg-amber-50 text-amber-700 px-1 py-0.2 rounded font-medium">
                      {kw}
                    </span>
                  ))}
                  {kwList.length > 3 && <span className="text-[9px] text-gray-400">...</span>}
                </div>
              )}
            </div>
            {isExpanded ? (
              <ChevronUp size={13} className="text-gray-400 shrink-0" />
            ) : (
              <ChevronDown size={13} className="text-gray-400 shrink-0" />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Switch Active Status */}
            <button
              type="button"
              onClick={() => handleUpdateEntry(entry.id, 'isActive', !entry.isActive)}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                entry.isActive ? 'bg-[#FEE500]' : 'bg-gray-200'
              }`}
              title={entry.isActive ? '点击禁用' : '点击启用'}
            >
              <div 
                className={`w-4 h-4 rounded-full bg-white shadow-xs transform duration-200 ${
                  entry.isActive ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            {/* Manage Button */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenuId(activeMenuId === entry.id ? null : entry.id);
                }}
                className="px-2.5 py-1 bg-gray-100 hover:bg-amber-100/80 text-gray-700 hover:text-amber-900 rounded-lg transition-colors cursor-pointer text-[11px] font-extrabold"
                title="管理设定"
              >
                <span>管理</span>
              </button>

              {activeMenuId === entry.id && (
                <div 
                  className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      setEditModal({
                        type: 'dynamic',
                        id: entry.id,
                        title: entry.title,
                        content: entry.content,
                        keywords: entry.keywords
                      });
                      setModalFolderId(entry.folderId || '');
                      setModalEntryType(entry.entryType || 'dynamic');
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Pencil size={12} className="text-amber-600" />
                    <span>编辑设定</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveMenuId(null);
                      setDeleteItemConfirm({ type: 'entry', id: entry.id, title: entry.title || '该设定' });
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                  >
                    <Trash2 size={12} className="text-rose-500" />
                    <span>删除设定</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content Section (Collapsible) */}
        {isExpanded && (
          <div className="space-y-3 pt-2.5 border-t border-gray-100 animate-fadeIn">
            {/* Keywords trigger display */}
            <div className="space-y-1">
              <div className="text-[9px] font-bold text-amber-600">🔑 触发关键词</div>
              <div className="flex flex-wrap gap-1.5 bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                {kwList.length > 0 ? (
                  kwList.map((kw, kIdx) => (
                    <span key={kIdx} className="text-xs bg-[#FEE500]/15 text-[#3C1E1E] px-2 py-0.5 rounded-lg font-bold">
                      {kw}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-gray-400 italic">未设置触发词 (不会被动态加载)</span>
                )}
              </div>
            </div>

            {/* Read-only content block */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">📝 详细设定内容</span>
                <button
                  type="button"
                  onClick={() => setEditModal({
                    type: 'dynamic',
                    id: entry.id,
                    title: entry.title,
                    content: entry.content,
                    keywords: entry.keywords
                  })}
                  className="text-[9px] font-extrabold text-amber-600 hover:underline cursor-pointer"
                >
                  点击编辑
                </button>
              </div>
              <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100 text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {entry.content || <span className="text-gray-400 italic">暂无详细设定内容</span>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolderIds(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // One-click Folder Master Switch
  const handleToggleFolderActive = (folderId: string) => {
    const folders = config.folders || [];
    const target = folders.find(f => f.id === folderId);
    if (!target) return;

    const newActive = !target.isActive;
    const updatedFolders = folders.map(f => f.id === folderId ? { ...f, isActive: newActive } : f);
    const updatedEntries = config.entries.map(e => {
      if (e.folderId === folderId) {
        return { ...e, isActive: newActive };
      }
      return e;
    });

    setConfig(prev => ({ ...prev, folders: updatedFolders, entries: updatedEntries }));
  };

  // Create or Update Folder
  const handleSaveFolderModal = () => {
    if (!folderModal || !folderModalName.trim()) return;
    const name = folderModalName.trim();
    const folders = config.folders || [];

    if (folderModal.mode === 'create') {
      const newFolder: WorldBookFolder = {
        id: 'folder_' + Date.now(),
        name,
        isActive: true,
        createdAt: Date.now()
      };
      setConfig(prev => ({ ...prev, folders: [newFolder, ...(prev.folders || [])] }));
    } else if (folderModal.mode === 'edit' && folderModal.id) {
      const updatedFolders = folders.map(f => f.id === folderModal.id ? { ...f, name } : f);
      setConfig(prev => ({ ...prev, folders: updatedFolders }));
    }

    setFolderModal(null);
    setFolderModalName('');
  };

  // Delete Folder and all contained entries
  const handleConfirmDeleteFolder = () => {
    if (!deleteFolderConfirm) return;
    const folderId = deleteFolderConfirm.id;

    const updatedFolders = (config.folders || []).filter(f => f.id !== folderId);
    const updatedEntries = config.entries.filter(e => e.folderId !== folderId);

    setConfig(prev => ({ ...prev, folders: updatedFolders, entries: updatedEntries }));
    setDeleteFolderConfirm(null);
  };

  // Add new entry directly under a folder
  const handleAddEntryToFolder = (folderId?: string, entryType: 'dynamic' | 'static' = 'dynamic') => {
    const newEntry: WorldBookEntry = {
      id: 'entry_' + Date.now(),
      title: '',
      keywords: '',
      content: '',
      isActive: true,
      folderId: folderId || undefined,
      entryType: entryType
    };
    setConfig(prev => ({
      ...prev,
      entries: [newEntry, ...prev.entries]
    }));
    setEditModal({
      type: 'dynamic',
      id: newEntry.id,
      title: '',
      content: '',
      keywords: ''
    });
    setModalFolderId(folderId || '');
    setModalEntryType(entryType);
  };

  // Helper to parse .docx, .txt, .json files
  const parseDocumentFile = async (file: File): Promise<{ title: string; content: string }> => {
    const rawFileName = file.name;
    const title = rawFileName.replace(/\.(docx|doc|txt|json|md)$/i, '');
    
    if (rawFileName.toLowerCase().endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return { title, content: result.value || '' };
    } else {
      const text = await file.text();
      if (rawFileName.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed === 'string') return { title, content: parsed };
          if (parsed && typeof parsed === 'object') {
            if (parsed.content) return { title: parsed.title || title, content: parsed.content };
            return { title, content: JSON.stringify(parsed, null, 2) };
          }
        } catch {
          // fallback
        }
      }
      return { title, content: text };
    }
  };

  // Import file to create new WorldBook entry / folder / rule (supports .docx, .txt, .json, .md)
  const handleImportFileToNewEntry = async (
    e: React.ChangeEvent<HTMLInputElement>,
    entryType: 'dynamic' | 'static' = 'dynamic',
    type: 'dynamic' | 'preset' | 'pre' | 'mid' | 'post' = 'dynamic',
    folderId?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1. Specialized handling for .json files (Folder / Single entry / Array)
      if (file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);

        // Case A: Exported Folder format
        if (parsed && (parsed.type === 'worldbook_folder' || (parsed.folder && Array.isArray(parsed.entries)))) {
          const folderObj = parsed.folder || {};
          const folderName = folderObj.name || file.name.replace(/\.json$/i, '');
          const targetCategory = folderObj.category === 'static' ? 'static' : (entryType || 'dynamic');
          const entriesList = Array.isArray(parsed.entries) ? parsed.entries : [];

          // Check if folder exists or create a new one
          let existingFolder = (config.folders || []).find(f => f.name === folderName);
          let targetFolderId = existingFolder?.id;
          let updatedFolders = [...(config.folders || [])];

          if (!existingFolder) {
            targetFolderId = 'folder_' + Date.now();
            const newFolder: WorldBookFolder = {
              id: targetFolderId,
              name: folderName,
              isActive: true,
              characterName: folderObj.characterName,
              createdAt: Date.now()
            };
            updatedFolders = [newFolder, ...updatedFolders];
          }

          const newEntries: WorldBookEntry[] = entriesList.map((item: any, idx: number) => ({
            id: 'entry_' + Date.now() + '_' + idx,
            title: item.title || item.name || `设定条目 ${idx + 1}`,
            keywords: item.keywords || item.key || item.title || '',
            content: typeof item.content === 'string' ? item.content : (item.value || JSON.stringify(item, null, 2)),
            isActive: item.isActive ?? true,
            entryType: item.entryType || targetCategory,
            folderId: targetFolderId,
            characterName: item.characterName || folderObj.characterName
          }));

          setConfig(prev => ({
            ...prev,
            folders: updatedFolders,
            entries: [...newEntries, ...prev.entries]
          }));
          return;
        }

        // Case B: Array of entries or rules
        if (Array.isArray(parsed)) {
          if (type === 'dynamic') {
            const newEntries: WorldBookEntry[] = parsed.map((item: any, idx: number) => {
              if (typeof item === 'string') {
                return {
                  id: 'entry_' + Date.now() + '_' + idx,
                  title: `${file.name.replace(/\.json$/i, '')} - ${idx + 1}`,
                  keywords: '',
                  content: item,
                  isActive: true,
                  entryType: entryType,
                  folderId: folderId
                };
              }
              return {
                id: 'entry_' + Date.now() + '_' + idx,
                title: item.title || item.name || `条目 ${idx + 1}`,
                keywords: item.keywords || item.key || item.title || '',
                content: typeof item.content === 'string' ? item.content : (item.value || JSON.stringify(item, null, 2)),
                isActive: item.isActive ?? true,
                entryType: item.entryType || entryType,
                folderId: folderId,
                characterName: item.characterName
              };
            });
            setConfig(prev => ({
              ...prev,
              entries: [...newEntries, ...prev.entries]
            }));
          } else {
            const listKey = type === 'preset' ? 'dialoguePresetList' : type === 'pre' ? 'preRulesList' : type === 'mid' ? 'midRulesList' : 'postRulesList';
            const newRules = parsed.map((item: any, idx: number) => ({
              id: 'rule_' + Date.now() + '_' + idx,
              title: typeof item === 'string' ? `规则 ${idx + 1}` : (item.title || item.name || `规则 ${idx + 1}`),
              content: typeof item === 'string' ? item : (item.content || JSON.stringify(item, null, 2)),
              isActive: item.isActive ?? true
            }));
            setConfig(prev => ({
              ...prev,
              [listKey]: [...newRules, ...(prev[listKey] || [])]
            }));
          }
          return;
        }

        // Case C: Single JSON entry/rule object
        if (parsed && typeof parsed === 'object') {
          const itemTitle = parsed.title || parsed.name || file.name.replace(/\.json$/i, '');
          const itemKeywords = parsed.keywords || parsed.key || itemTitle;
          const itemContent = typeof parsed.content === 'string' ? parsed.content : (typeof parsed.value === 'string' ? parsed.value : JSON.stringify(parsed, null, 2));

          if (type === 'dynamic') {
            const newEntry: WorldBookEntry = {
              id: 'entry_' + Date.now(),
              title: itemTitle,
              keywords: itemKeywords,
              content: itemContent,
              isActive: parsed.isActive ?? true,
              entryType: parsed.entryType || entryType,
              folderId: folderId,
              characterName: parsed.characterName
            };
            setConfig(prev => ({
              ...prev,
              entries: [newEntry, ...prev.entries]
            }));
            setEditModal({
              type: 'dynamic',
              id: newEntry.id,
              title: newEntry.title,
              content: newEntry.content,
              keywords: newEntry.keywords
            });
            setModalFolderId(folderId || '');
            setModalEntryType(newEntry.entryType || 'dynamic');
          } else {
            const newListEntry = {
              id: 'rule_' + Date.now(),
              title: itemTitle,
              content: itemContent,
              isActive: parsed.isActive ?? true
            };
            const listKey = type === 'preset' ? 'dialoguePresetList' : type === 'pre' ? 'preRulesList' : type === 'mid' ? 'midRulesList' : 'postRulesList';
            setConfig(prev => ({
              ...prev,
              [listKey]: [newListEntry, ...(prev[listKey] || [])]
            }));
            setEditModal({
              type: type,
              id: newListEntry.id,
              title: newListEntry.title,
              content: newListEntry.content
            });
          }
          return;
        }
      }

      // 2. Standard document file handling (.docx, .txt, .md)
      const { title, content } = await parseDocumentFile(file);
      if (type === 'dynamic') {
        const newEntry: WorldBookEntry = {
          id: 'entry_' + Date.now(),
          title: title,
          keywords: title,
          content: content,
          isActive: true,
          entryType: entryType,
          folderId: folderId
        };
        setConfig(prev => ({
          ...prev,
          entries: [newEntry, ...prev.entries]
        }));
        setEditModal({
          type: 'dynamic',
          id: newEntry.id,
          title: title,
          content: content,
          keywords: title
        });
        setModalFolderId(folderId || '');
        setModalEntryType(entryType);
      } else {
        const newListEntry = {
          id: 'rule_' + Date.now(),
          title: title,
          content: content,
          isActive: true
        };
        const listKey = type === 'preset' ? 'dialoguePresetList' : type === 'pre' ? 'preRulesList' : type === 'mid' ? 'midRulesList' : 'postRulesList';
        setConfig(prev => ({
          ...prev,
          [listKey]: [newListEntry, ...(prev[listKey] || [])]
        }));
        setEditModal({
          type: type,
          id: newListEntry.id,
          title: title,
          content: content
        });
      }
    } catch (err) {
      console.error('Failed to import file:', err);
      alert('导入文档失败，请检查文档或JSON格式');
    } finally {
      e.target.value = '';
    }
  };

  // Sync modal values when editModal opens
  useEffect(() => {
    if (editModal) {
      setModalTitle(editModal.title || '');
      setModalContent(editModal.content || '');
      setModalKeywords(editModal.keywords || '');
      if (editModal.type === 'dynamic') {
        const entry = config.entries.find(e => e.id === editModal.id);
        setModalFolderId(entry?.folderId || '');
        setModalEntryType(entry?.entryType || 'dynamic');
      }
    } else {
      setModalTitle('');
      setModalContent('');
      setModalKeywords('');
      setModalFolderId('');
      setModalEntryType('dynamic');
    }
  }, [editModal, config.entries]);

  // Keep track of first load to prevent overwriting during initial mount
  const isLoaded = useRef(false);

  // Load World Book on Mount & Filter out Octocat (章鱼猫)
  useEffect(() => {
    async function loadConfig() {
      try {
        const storedConfig = await dbInstance.getWorldBookConfig();
        if (storedConfig.entries) {
          storedConfig.entries = storedConfig.entries.filter(e => 
            !e.title?.includes('章鱼猫') && 
            !e.keywords?.includes('章鱼猫') && 
            !e.content?.includes('章鱼猫')
          );
        }
        setConfig(storedConfig);
        isLoaded.current = true;
      } catch (err) {
        console.error('Failed to load world book config:', err);
      }
    }
    loadConfig();
  }, []);

  // Debounced Auto-Save
  useEffect(() => {
    if (!isLoaded.current) return;

    setIsSaving(true);
    const timer = setTimeout(async () => {
      try {
        await dbInstance.saveWorldBookConfig(config);
        setIsSaving(false);
      } catch (err) {
        console.error('Failed to auto-save world book:', err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [config]);

  // Handle updates for pre, mid_static, and post rules
  const handlePreRulesChange = (val: string) => {
    setConfig(prev => ({ ...prev, preRules: val }));
  };

  const handleMidRulesChange = (val: string) => {
    setConfig(prev => ({ ...prev, midRules: val }));
  };

  const handlePostRulesChange = (val: string) => {
    setConfig(prev => ({ ...prev, postRules: val }));
  };

  const handleDialoguePresetChange = (val: string) => {
    setConfig(prev => ({ ...prev, dialoguePreset: val }));
  };

  const handleAddListEntry = (type: 'pre' | 'mid' | 'post' | 'preset') => {
    const newEntry = {
      id: Date.now().toString(),
      title: type === 'pre' ? '新前置规则' : type === 'mid' ? '新中置规则' : type === 'post' ? '新后置自检规则' : '新预设设定',
      content: '',
      isActive: true
    };
    if (type === 'pre') {
      setConfig(prev => ({ ...prev, preRulesList: [...(prev.preRulesList || []), newEntry] }));
    } else if (type === 'mid') {
      setConfig(prev => ({ ...prev, midRulesList: [...(prev.midRulesList || []), newEntry] }));
    } else if (type === 'post') {
      setConfig(prev => ({ ...prev, postRulesList: [...(prev.postRulesList || []), newEntry] }));
    } else if (type === 'preset') {
      setConfig(prev => ({ ...prev, dialoguePresetList: [...(prev.dialoguePresetList || []), newEntry] }));
    }
  };

  const handleDeleteListEntry = (type: 'pre' | 'mid' | 'post' | 'preset', id: string) => {
    if (type === 'pre') {
      setConfig(prev => ({ ...prev, preRulesList: (prev.preRulesList || []).filter(item => item.id !== id) }));
    } else if (type === 'mid') {
      setConfig(prev => ({ ...prev, midRulesList: (prev.midRulesList || []).filter(item => item.id !== id) }));
    } else if (type === 'post') {
      setConfig(prev => ({ ...prev, postRulesList: (prev.postRulesList || []).filter(item => item.id !== id) }));
    } else if (type === 'preset') {
      setConfig(prev => ({ ...prev, dialoguePresetList: (prev.dialoguePresetList || []).filter(item => item.id !== id) }));
    }
  };

  const handleUpdateListEntry = (type: 'pre' | 'mid' | 'post' | 'preset', id: string, field: 'title' | 'content' | 'isActive', value: any) => {
    const update = (list: any[]) => list.map(item => item.id === id ? { ...item, [field]: value } : item);
    if (type === 'pre') {
      setConfig(prev => ({ ...prev, preRulesList: update(prev.preRulesList || []) }));
    } else if (type === 'mid') {
      setConfig(prev => ({ ...prev, midRulesList: update(prev.midRulesList || []) }));
    } else if (type === 'post') {
      setConfig(prev => ({ ...prev, postRulesList: update(prev.postRulesList || []) }));
    } else if (type === 'preset') {
      setConfig(prev => ({ ...prev, dialoguePresetList: update(prev.dialoguePresetList || []) }));
    }
  };



  // Export a folder and its entries as a .json file
  const handleExportFolder = (folder: WorldBookFolder, entryType: 'dynamic' | 'static' = 'dynamic') => {
    const matchingEntries = config.entries.filter(e => e.folderId === folder.id && (entryType === 'static' ? e.entryType === 'static' : e.entryType !== 'static'));
    const exportData = {
      type: 'worldbook_folder',
      version: 1,
      folder: {
        id: folder.id,
        name: folder.name,
        category: entryType,
        characterName: folder.characterName
      },
      entries: matchingEntries.map(e => ({
        title: e.title || '',
        keywords: e.keywords || '',
        content: e.content || '',
        entryType: e.entryType || entryType,
        isActive: e.isActive ?? true,
        characterName: e.characterName
      }))
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folder.name || '世界书文件夹'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Delete a dynamic entry
  const handleDeleteEntry = (id: string) => {
    setConfig(prev => ({
      ...prev,
      entries: prev.entries.filter(entry => entry.id !== id)
    }));
  };

  // Update a specific field in a dynamic entry
  const handleUpdateEntry = (id: string, field: keyof WorldBookEntry, value: any) => {
    setConfig(prev => ({
      ...prev,
      entries: prev.entries.map(entry => {
        if (entry.id === id) {
          return { ...entry, [field]: value };
        }
        return entry;
      })
    }));
  };

  // Filter dynamic entries based on search query
  const filteredEntries = config.entries.filter(entry => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      entry.title.toLowerCase().includes(query) ||
      entry.keywords.toLowerCase().includes(query) ||
      entry.content.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex-1 flex flex-col bg-[#F8F9FB] text-[#333333] overflow-hidden select-none font-sans relative">
      
      {/* HEADER BAR */}
      <header className="h-16 bg-white border-b border-gray-200/80 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onHome}
            className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shrink-0"
            title="返回手机桌面"
          >
            <Home size={16} className="stroke-[2.5]" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <BookOpen size={16} className="stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-none">世界书</h2>
            <div className="flex items-center space-x-1.5 mt-1 leading-none">
              {isSaving ? (
                <span className="text-[9px] text-amber-600 font-bold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                  云端同步中...
                </span>
              ) : (
                <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-500" />
                  已自动存盘
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* TOP-LEVEL TABS */}
      <div className="bg-white px-3 py-1.5 border-b border-gray-200/60 grid grid-cols-2 gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveMainTab('preset')}
          className={`py-2 rounded-xl text-xs font-extrabold transition-all text-center flex items-center justify-center gap-2 border ${
            activeMainTab === 'preset'
              ? 'bg-[#FEE500]/15 text-[#3C1E1E] border-[#FEE500] shadow-sm'
              : 'bg-transparent text-gray-500 border-transparent hover:text-gray-800'
          }`}
        >
          <MessageSquare size={13} className={activeMainTab === 'preset' ? 'text-amber-500' : 'text-gray-400'} />
          <span>预设</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('worldbook')}
          className={`py-2 rounded-xl text-xs font-extrabold transition-all text-center flex items-center justify-center gap-2 border ${
            activeMainTab === 'worldbook'
              ? 'bg-[#FEE500]/15 text-[#3C1E1E] border-[#FEE500] shadow-sm'
              : 'bg-transparent text-gray-500 border-transparent hover:text-gray-800'
          }`}
        >
          <BookOpen size={13} className={activeMainTab === 'worldbook' ? 'text-amber-500' : 'text-gray-400'} />
          <span>世界书</span>
        </button>
      </div>

      {/* SECOND-LEVEL TABS FOR WORLDBOOK */}
      {activeMainTab === 'worldbook' && (
        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200/50 flex space-x-1 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setWorldBookSubTab('pre')}
            className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
              worldBookSubTab === 'pre'
                ? 'bg-white text-gray-900 border-gray-200 shadow-xs'
                : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <Sparkles size={11} className={worldBookSubTab === 'pre' ? 'text-amber-500' : 'text-gray-400'} />
            <span>【前】前置</span>
          </button>

          <button
            type="button"
            onClick={() => setWorldBookSubTab('mid')}
            className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
              worldBookSubTab === 'mid'
                ? 'bg-white text-gray-900 border-gray-200 shadow-xs'
                : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <BookOpen size={11} className={worldBookSubTab === 'mid' ? 'text-amber-500' : 'text-gray-400'} />
            <span>【中】背景</span>
          </button>

          <button
            type="button"
            onClick={() => setWorldBookSubTab('post')}
            className={`py-1.5 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border ${
              worldBookSubTab === 'post'
                ? 'bg-white text-gray-900 border-gray-200 shadow-xs'
                : 'bg-transparent text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <FileText size={11} className={worldBookSubTab === 'post' ? 'text-amber-500' : 'text-gray-400'} />
            <span>【后】自检</span>
          </button>
        </div>
      )}

      {/* TAB CONTENT WINDOW */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* TAB 0: DIALOGUE PRESETS (Preset card designed matching keywords style) */}
        {activeMainTab === 'preset' && (
          <div className="space-y-3.5 flex flex-col h-full animate-fadeIn">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[11px] font-extrabold tracking-wider text-gray-500 uppercase flex items-center gap-1">
                <MessageSquare size={12} className="text-amber-500" />
                预设设定 ({config.dialoguePresetList?.length || 0} 条)
              </span>
              <div className="flex items-center space-x-2">
                <label className="px-2.5 py-1 bg-[#FEE500]/20 hover:bg-[#FEE500]/30 text-[#3C1E1E] rounded-lg text-xs font-extrabold flex items-center space-x-1 transition-all cursor-pointer" title="导入 docx/txt 文件创建预设">
                  <Upload size={12} className="text-[#3C1E1E]" />
                  <span>导入 docx/txt</span>
                  <input
                    type="file"
                    accept=".docx,.txt,.json,.md"
                    className="hidden"
                    onChange={(e) => handleImportFileToNewEntry(e, 'dynamic', 'preset')}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => handleAddListEntry('preset')}
                  className="w-7 h-7 bg-[#FEE500] hover:bg-[#EED500] text-[#3C1E1E] rounded-lg flex items-center justify-center shadow-sm transition-all cursor-pointer"
                  title="新设预设"
                >
                  <Plus size={14} className="stroke-[3]" />
                </button>
              </div>
            </div>

            <div className="space-y-4 pb-8">
              {(!config.dialoguePresetList || config.dialoguePresetList.length === 0) ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
                  <MessageSquare size={28} className="mx-auto text-gray-300 stroke-[1.5] mb-2" />
                  <p className="text-xs text-gray-400">
                    无预设设定，点击右上角 “+” 新增一个。
                  </p>
                </div>
              ) : (
                config.dialoguePresetList.map((item, idx) => {
                  const isExpanded = expandedIds[item.id] ?? false;
                  return (
                    <div 
                      key={item.id}
                      className={`bg-white rounded-2xl border transition-all p-3.5 flex flex-col gap-2.5 shadow-xs ${
                        item.isActive ? 'border-gray-200/80 hover:border-gray-300' : 'border-gray-200/50 opacity-60'
                      }`}
                    >
                      {/* Top Row: Clickable header for toggling collapse */}
                      <div className="flex items-center justify-between gap-2">
                        <div 
                          onClick={() => toggleExpand(item.id)}
                          className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none group"
                        >
                          <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 rounded-lg px-2 py-1 font-mono shrink-0">
                            {(idx + 1).toString().padStart(2, '0')}
                          </span>
                          <span className="font-extrabold text-xs text-gray-800 truncate group-hover:text-amber-600 transition-colors">
                            {item.title || <span className="text-gray-400 italic font-normal">未命名预设</span>}
                          </span>
                          {isExpanded ? (
                            <ChevronUp size={13} className="text-gray-400 shrink-0" />
                          ) : (
                            <ChevronDown size={13} className="text-gray-400 shrink-0" />
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 shrink-0">
                          {/* Switch Active Status */}
                          <button
                            type="button"
                            onClick={() => handleUpdateListEntry('preset', item.id, 'isActive', !item.isActive)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                              item.isActive ? 'bg-[#FEE500]' : 'bg-gray-200'
                            }`}
                          >
                            <div 
                              className={`w-4 h-4 rounded-full bg-white shadow-xs transform duration-200 ${
                                item.isActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>

                          {/* Manage Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuId(activeMenuId === item.id ? null : item.id);
                              }}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-amber-100/80 text-gray-700 hover:text-amber-900 rounded-lg transition-colors cursor-pointer text-[11px] font-extrabold"
                              title="管理预设"
                            >
                              <span>管理</span>
                            </button>

                            {activeMenuId === item.id && (
                              <div 
                                className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-fadeIn"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setEditModal({
                                      type: 'preset',
                                      id: item.id,
                                      title: item.title,
                                      content: item.content
                                    });
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer"
                                >
                                  <Pencil size={12} className="text-amber-600" />
                                  <span>编辑预设</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    setDeleteItemConfirm({ type: 'list', listType: 'preset', id: item.id, title: item.title || '该预设' });
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                >
                                  <Trash2 size={12} className="text-rose-500" />
                                  <span>删除预设</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Content Section (Collapsible) */}
                      {isExpanded ? (
                        <div className="space-y-1.5 pt-1.5 border-t border-gray-100 animate-fadeIn">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">📝 详细内容 (只读预览，点击编辑按钮修改)</span>
                            <button
                              type="button"
                              onClick={() => setEditModal({
                                type: 'preset',
                                id: item.id,
                                title: item.title,
                                content: item.content
                              })}
                              className="text-[9px] font-extrabold text-amber-600 hover:underline cursor-pointer"
                            >
                              点击编辑
                            </button>
                          </div>
                          <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100 text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                            {item.content || <span className="text-gray-400 italic">暂无详细内容</span>}
                          </div>
                        </div>
                      ) : (
                        item.content && (
                          <div 
                            onClick={() => toggleExpand(item.id)}
                            className="text-[11px] text-gray-400 font-mono truncate px-1 cursor-pointer hover:text-gray-500 transition-colors"
                          >
                            {item.content}
                          </div>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        
        {/* WORLDBOOK SUB-TABS */}
        {activeMainTab === 'worldbook' && (
          <>
            {/* SUB-TAB 1: PRE-RULES (Core base settings in card format matching keywords style) */}
            {worldBookSubTab === 'pre' && (
              <div className="space-y-3.5 flex flex-col h-full animate-fadeIn">
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-[11px] font-extrabold tracking-wider text-gray-500 uppercase flex items-center gap-1">
                    <Sparkles size={12} className="text-amber-500" />
                    前置协议 ({config.preRulesList?.length || 0} 条)
                  </span>
                  <div className="flex items-center space-x-2">
                    <label className="px-2.5 py-1 bg-[#FEE500]/20 hover:bg-[#FEE500]/30 text-[#3C1E1E] rounded-lg text-xs font-extrabold flex items-center space-x-1 transition-all cursor-pointer" title="导入 docx/txt 文件创建前置规则">
                      <Upload size={12} className="text-[#3C1E1E]" />
                      <span>导入 docx/txt</span>
                      <input
                        type="file"
                        accept=".docx,.txt,.json,.md"
                        className="hidden"
                        onChange={(e) => handleImportFileToNewEntry(e, 'dynamic', 'pre')}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddListEntry('pre')}
                      className="w-7 h-7 bg-[#FEE500] hover:bg-[#EED500] text-[#3C1E1E] rounded-lg flex items-center justify-center shadow-sm transition-all cursor-pointer"
                      title="新设前置"
                    >
                      <Plus size={14} className="stroke-[3]" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pb-8">
                  {(!config.preRulesList || config.preRulesList.length === 0) ? (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
                      <Sparkles size={28} className="mx-auto text-gray-300 stroke-[1.5] mb-2" />
                      <p className="text-xs text-gray-400">
                        无前置协议，点击右上角 “+” 新增一个。
                      </p>
                    </div>
                  ) : (
                    config.preRulesList.map((item, idx) => {
                      const isExpanded = expandedIds[item.id] ?? false;
                      return (
                        <div 
                          key={item.id}
                          className={`bg-white rounded-2xl border transition-all p-3.5 flex flex-col gap-2.5 shadow-xs ${
                            item.isActive ? 'border-gray-200/80 hover:border-gray-300' : 'border-gray-200/50 opacity-60'
                          }`}
                        >
                          {/* Top Row: Clickable header for toggling collapse */}
                          <div className="flex items-center justify-between gap-2">
                            <div 
                              onClick={() => toggleExpand(item.id)}
                              className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none group"
                            >
                              <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 rounded-lg px-2 py-1 font-mono shrink-0">
                                {(idx + 1).toString().padStart(2, '0')}
                              </span>
                              <span className="font-extrabold text-xs text-gray-800 truncate group-hover:text-amber-600 transition-colors">
                                {item.title || <span className="text-gray-400 italic font-normal">未命名前置规则</span>}
                              </span>
                              {isExpanded ? (
                                <ChevronUp size={13} className="text-gray-400 shrink-0" />
                              ) : (
                                <ChevronDown size={13} className="text-gray-400 shrink-0" />
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-2 shrink-0">
                              {/* Switch Active Status */}
                              <button
                                type="button"
                                onClick={() => handleUpdateListEntry('pre', item.id, 'isActive', !item.isActive)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                                  item.isActive ? 'bg-[#FEE500]' : 'bg-gray-200'
                                }`}
                              >
                                <div 
                                  className={`w-4 h-4 rounded-full bg-white shadow-xs transform duration-200 ${
                                    item.isActive ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>

                              {/* Manage Button */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                  }}
                                  className="px-2.5 py-1 bg-gray-100 hover:bg-amber-100/80 text-gray-700 hover:text-amber-900 rounded-lg transition-colors cursor-pointer text-[11px] font-extrabold"
                                  title="管理规则"
                                >
                                  <span>管理</span>
                                </button>

                                {activeMenuId === item.id && (
                                  <div 
                                    className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-fadeIn"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setEditModal({
                                          type: 'pre',
                                          id: item.id,
                                          title: item.title,
                                          content: item.content
                                        });
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer"
                                    >
                                      <Pencil size={12} className="text-amber-600" />
                                      <span>编辑规则</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setDeleteItemConfirm({ type: 'list', listType: 'pre', id: item.id, title: item.title || '该前置规则' });
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                    >
                                      <Trash2 size={12} className="text-rose-500" />
                                      <span>删除规则</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Content Section (Collapsible) */}
                          {isExpanded ? (
                            <div className="space-y-1.5 pt-1.5 border-t border-gray-100 animate-fadeIn">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">📝 详细内容 (只读预览，点击编辑按钮修改)</span>
                                <button
                                  type="button"
                                  onClick={() => setEditModal({
                                    type: 'pre',
                                    id: item.id,
                                    title: item.title,
                                    content: item.content
                                  })}
                                  className="text-[9px] font-extrabold text-amber-600 hover:underline cursor-pointer"
                                >
                                  点击编辑
                                </button>
                              </div>
                              <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100 text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                {item.content || <span className="text-gray-400 italic">暂无详细内容</span>}
                              </div>
                            </div>
                          ) : (
                            item.content && (
                              <div 
                                onClick={() => toggleExpand(item.id)}
                                className="text-[11px] text-gray-400 font-mono truncate px-1 cursor-pointer hover:text-gray-500 transition-colors"
                              >
                                {item.content}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SUB-TAB 2: MID-RULES (常驻背景 - with inner sub-tabs) */}
            {worldBookSubTab === 'mid' && (
              <div className="space-y-4 h-full flex flex-col">
                {/* INNER SUB-TAB SELECTOR (Keep this sub-tab switching!) */}
                <div className="flex bg-gray-200/50 p-1 rounded-xl shrink-0 self-start border border-gray-200/40">
                  <button
                    type="button"
                    onClick={() => setMidSubTab('static')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      midSubTab === 'static'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    常驻背景
                  </button>
                  <button
                    type="button"
                    onClick={() => setMidSubTab('dynamic')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      midSubTab === 'dynamic'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    <span>关键词</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold transition-all ${
                      midSubTab === 'dynamic' ? 'bg-[#FEE500] text-[#3C1E1E]' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {config.entries.length}
                    </span>
                  </button>
                </div>

                {/* SUB-TAB CONTENTS */}
                {midSubTab === 'static' ? (
                  <div className="space-y-3.5 flex flex-col h-full animate-fadeIn">
                    <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
                      <span className="text-[11px] font-extrabold tracking-wider text-gray-500 uppercase flex items-center gap-1">
                        <BookOpen size={12} className="text-amber-500" />
                        常驻背景设定库 ({config.entries.filter(e => e.entryType === 'static').length + (config.midRulesList?.length || 0)} 条设定)
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFolderModal({ mode: 'create', name: '' });
                            setFolderModalName('');
                          }}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl flex items-center space-x-1 text-xs font-extrabold cursor-pointer transition-colors"
                          title="新建分类文件夹"
                        >
                          <FolderPlus size={14} className="text-amber-700" />
                          <span>新建文件夹</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddEntryToFolder('', 'static')}
                          className="px-2.5 py-1.5 bg-[#FEE500] hover:bg-[#EED500] text-[#3C1E1E] rounded-xl flex items-center space-x-1 text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
                          title="新建常驻背景"
                        >
                          <Plus size={14} className="stroke-[3]" />
                          <span>新建常驻背景</span>
                        </button>
                        <label className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl flex items-center space-x-1 text-xs font-extrabold cursor-pointer transition-colors" title="导入 docx/txt 文档">
                          <Upload size={14} className="text-amber-700" />
                          <span>导入 docx/txt</span>
                          <input
                            type="file"
                            accept=".docx,.txt,.json,.md"
                            className="hidden"
                            onChange={(e) => handleImportFileToNewEntry(e, 'static', 'dynamic')}
                          />
                        </label>
                      </div>
                    </div>

                    {/* SEARCH BAR */}
                    <div className="relative shrink-0">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索常驻背景标题或内容..."
                        className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400 transition-colors shadow-sm"
                      />
                    </div>

                    {/* FOLDER & STATIC ENTRIES LIST */}
                    <div className="space-y-4 pb-8">
                      {config.entries.filter(e => e.entryType === 'static').length === 0 && (!config.folders || config.folders.length === 0) && (!config.midRulesList || config.midRulesList.length === 0) ? (
                        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
                          <BookOpen size={28} className="mx-auto text-gray-300 stroke-[1.5] mb-2" />
                          <p className="text-xs text-gray-400">
                            {searchQuery ? '没有找到符合搜索条件的常驻背景' : '无常驻背景设定，点击“新建文件夹”或“新建常驻背景”开始。'}
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* 1. RENDER FOLDERS (FOR STATIC ENTRIES) */}
                          {(config.folders || []).map((folder) => {
                            const staticFolderEntries = filteredEntries.filter(e => e.folderId === folder.id && e.entryType === 'static');
                            const isCollapsed = collapsedFolderIds[folder.id] ?? false;

                            return (
                              <div key={folder.id} className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 shadow-xs">
                                {/* Folder Header */}
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div 
                                    onClick={() => toggleFolderCollapse(folder.id)}
                                    className="flex items-center space-x-2 cursor-pointer select-none group flex-1 min-w-0"
                                  >
                                    <Folder size={18} className={folder.isActive ? "text-amber-500 fill-amber-100" : "text-slate-400"} />
                                    <span className="font-extrabold text-xs text-slate-800 group-hover:text-amber-600 transition-colors truncate">
                                      {folder.name}
                                    </span>
                                    {folder.characterName && (
                                      <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 shrink-0">
                                        👤 {folder.characterName}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 rounded-full px-2 py-0.5 shrink-0">
                                      {staticFolderEntries.length} 条常驻设定
                                    </span>
                                    {isCollapsed ? (
                                      <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                    ) : (
                                      <ChevronUp size={14} className="text-slate-400 shrink-0" />
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-1.5 shrink-0">
                                    {/* Folder Master Switch */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFolderActive(folder.id)}
                                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                                        folder.isActive ? 'bg-[#FEE500]' : 'bg-gray-200'
                                      }`}
                                      title={folder.isActive ? '点击禁用文件夹内所有条目' : '点击启用文件夹内所有条目'}
                                    >
                                      <div 
                                        className={`w-4 h-4 rounded-full bg-white shadow-xs transform duration-200 ${
                                          folder.isActive ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>

                                    {/* Manage Folder Button */}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveMenuId(activeMenuId === folder.id ? null : folder.id);
                                        }}
                                        className="px-2.5 py-1 bg-white hover:bg-amber-100/80 text-gray-700 hover:text-amber-900 rounded-lg border border-gray-200/80 transition-colors cursor-pointer text-[11px] font-extrabold"
                                        title="管理文件夹"
                                      >
                                        <span>管理</span>
                                      </button>

                                      {activeMenuId === folder.id && (
                                        <div 
                                          className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-fadeIn"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              handleAddEntryToFolder(folder.id, 'static');
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer"
                                          >
                                            <Plus size={12} className="text-amber-600" />
                                            <span>新增常驻条目</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              handleExportFolder(folder, 'static');
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                          >
                                            <Upload size={12} className="text-amber-600 rotate-180" />
                                            <span>导出文件夹 (.json)</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              setFolderModal({ mode: 'edit', id: folder.id, name: folder.name });
                                              setFolderModalName(folder.name);
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                          >
                                            <Pencil size={12} className="text-amber-600" />
                                            <span>重命名文件夹</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              setDeleteFolderConfirm({ id: folder.id, name: folder.name, count: staticFolderEntries.length });
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                          >
                                            <Trash2 size={12} className="text-rose-500" />
                                            <span>删除文件夹</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Folder Contents */}
                                {!isCollapsed && (
                                  <div className="space-y-2.5 pt-1 pl-2 border-l-2 border-amber-200">
                                    {staticFolderEntries.length === 0 ? (
                                      <div className="text-[11px] text-slate-400 italic py-3 text-center bg-white rounded-xl border border-dashed border-slate-200">
                                        该文件夹暂无常驻背景条目，点击右上方“+”新增
                                      </div>
                                    ) : (
                                      staticFolderEntries.map((entry, idx) => renderEntryCard(entry, idx))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* 2. RENDER UNCLASSIFIED STATIC ENTRIES */}
                          {(() => {
                            const rootStaticEntries = filteredEntries.filter(e => !e.folderId && e.entryType === 'static');
                            if (rootStaticEntries.length === 0 && (!config.midRulesList || config.midRulesList.length === 0)) return null;

                            return (
                              <div className="space-y-3 pt-2">
                                <div className="text-[11px] font-extrabold text-slate-500 flex items-center space-x-1.5 px-1">
                                  <span>📁 未分类常驻背景 ({rootStaticEntries.length + (config.midRulesList?.length || 0)})</span>
                                </div>
                                <div className="space-y-3">
                                  {rootStaticEntries.map((entry, idx) => renderEntryCard(entry, idx))}

                                  {/* Legacy MidRulesList */}
                                  {(config.midRulesList || []).map((item) => {
                                    const isExpanded = expandedIds[item.id] ?? false;
                                    return (
                                      <div 
                                        key={item.id}
                                        className={`bg-white rounded-2xl border transition-all p-3.5 flex flex-col gap-2.5 shadow-xs ${
                                          item.isActive ? 'border-gray-200/80 hover:border-gray-300' : 'border-gray-200/50 opacity-60'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div 
                                            onClick={() => toggleExpand(item.id)}
                                            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none group"
                                          >
                                            <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 rounded-lg px-2 py-1 font-mono shrink-0">
                                              📌
                                            </span>
                                            <span className="font-extrabold text-xs text-gray-800 truncate group-hover:text-amber-600 transition-colors">
                                              {item.title || <span className="text-gray-400 italic font-normal">未命名背景设定</span>}
                                            </span>
                                            {isExpanded ? (
                                              <ChevronUp size={13} className="text-gray-400 shrink-0" />
                                            ) : (
                                              <ChevronDown size={14} className="text-gray-400 shrink-0" />
                                            )}
                                          </div>

                                          <div className="flex items-center space-x-2 shrink-0">
                                            {/* Switch Active Status */}
                                            <button
                                              type="button"
                                              onClick={() => handleUpdateListEntry('mid', item.id, 'isActive', !item.isActive)}
                                              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                                                item.isActive ? 'bg-[#FEE500]' : 'bg-gray-200'
                                              }`}
                                            >
                                              <div 
                                                className={`w-4 h-4 rounded-full bg-white shadow-xs transform duration-200 ${
                                                  item.isActive ? 'translate-x-4' : 'translate-x-0'
                                                }`}
                                              />
                                            </button>

                                            {/* Manage Button */}
                                            <div className="relative">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                                }}
                                                className="px-2.5 py-1 bg-gray-100 hover:bg-amber-100/80 text-gray-700 hover:text-amber-900 rounded-lg transition-colors cursor-pointer text-[11px] font-extrabold"
                                                title="管理规则"
                                              >
                                                <span>管理</span>
                                              </button>

                                              {activeMenuId === item.id && (
                                                <div 
                                                  className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-fadeIn"
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setActiveMenuId(null);
                                                      setEditModal({
                                                        type: 'mid',
                                                        id: item.id,
                                                        title: item.title,
                                                        content: item.content
                                                      });
                                                    }}
                                                    className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer"
                                                  >
                                                    <Pencil size={12} className="text-amber-600" />
                                                    <span>编辑规则</span>
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setActiveMenuId(null);
                                                      setDeleteItemConfirm({ type: 'list', listType: 'mid', id: item.id, title: item.title || '该中置规则' });
                                                    }}
                                                    className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                                  >
                                                    <Trash2 size={12} className="text-rose-500" />
                                                    <span>删除规则</span>
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {isExpanded && (
                                          <div className="space-y-1.5 pt-1.5 border-t border-gray-100 animate-fadeIn">
                                            <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100 text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                              {item.content || <span className="text-gray-400 italic">暂无详细内容</span>}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3.5 flex flex-col h-full animate-fadeIn">
                    <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
                      <span className="text-[11px] font-extrabold tracking-wider text-gray-500 uppercase flex items-center gap-1">
                        <FolderOpen size={13} className="text-[#3C1E1E]" />
                        词汇触发设定库 ({config.entries.length} 条设定 / {(config.folders || []).length} 文件夹)
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFolderModal({ mode: 'create', name: '' });
                            setFolderModalName('');
                          }}
                          className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl flex items-center space-x-1 text-xs font-extrabold cursor-pointer transition-colors"
                          title="新建分类文件夹"
                        >
                          <FolderPlus size={14} className="text-amber-700" />
                          <span>新建文件夹</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddEntryToFolder('')}
                          className="px-2.5 py-1.5 bg-[#FEE500] hover:bg-[#EED500] text-[#3C1E1E] rounded-xl flex items-center space-x-1 text-xs font-extrabold shadow-xs transition-colors cursor-pointer"
                          title="新建设定"
                        >
                          <Plus size={14} className="stroke-[3]" />
                          <span>新建设定</span>
                        </button>
                        <label className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl flex items-center space-x-1 text-xs font-extrabold cursor-pointer transition-colors" title="导入 docx/txt 文档">
                          <Upload size={14} className="text-amber-700" />
                          <span>导入 docx/txt</span>
                          <input
                            type="file"
                            accept=".docx,.txt,.json,.md"
                            className="hidden"
                            onChange={(e) => handleImportFileToNewEntry(e, 'dynamic', 'dynamic')}
                          />
                        </label>
                      </div>
                    </div>

                    {/* SEARCH BAR */}
                    <div className="relative shrink-0">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索标题、关键词或设定内容..."
                        className="w-full h-9 pl-9 pr-4 rounded-xl border border-gray-200 bg-white text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400 transition-colors shadow-sm"
                      />
                    </div>

                    {/* FOLDER & ENTRIES LIST */}
                    <div className="space-y-4 pb-8">
                      {filteredEntries.length === 0 && (!config.folders || config.folders.length === 0) ? (
                        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
                          <BookOpen size={28} className="mx-auto text-gray-300 stroke-[1.5] mb-2" />
                          <p className="text-xs text-gray-400">
                            {searchQuery ? '没有找到符合搜索条件的设定' : '无词汇触发设定，点击“新建文件夹”或“新建设定”开始。'}
                          </p>
                        </div>
                      ) : (
                        <>
                          {/* 1. RENDER FOLDERS */}
                          {(config.folders || []).map((folder) => {
                            const folderEntries = filteredEntries.filter(e => e.folderId === folder.id);
                            const isCollapsed = collapsedFolderIds[folder.id] ?? false;

                            return (
                              <div key={folder.id} className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 space-y-3 shadow-xs">
                                {/* Folder Header */}
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div 
                                    onClick={() => toggleFolderCollapse(folder.id)}
                                    className="flex items-center space-x-2 cursor-pointer select-none group flex-1 min-w-0"
                                  >
                                    <Folder size={18} className={folder.isActive ? "text-amber-500 fill-amber-100" : "text-slate-400"} />
                                    <span className="font-extrabold text-xs text-slate-800 group-hover:text-amber-600 transition-colors truncate">
                                      {folder.name}
                                    </span>
                                    {folder.characterName && (
                                      <span className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5 shrink-0">
                                        👤 {folder.characterName}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-200/60 rounded-full px-2 py-0.5 shrink-0">
                                      {folderEntries.length} 条设定
                                    </span>
                                    {isCollapsed ? (
                                      <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                    ) : (
                                      <ChevronUp size={14} className="text-slate-400 shrink-0" />
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-1.5 shrink-0">
                                    {/* Folder Master Switch */}
                                    <button
                                      type="button"
                                      onClick={() => handleToggleFolderActive(folder.id)}
                                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                                        folder.isActive ? 'bg-[#FEE500]' : 'bg-gray-200'
                                      }`}
                                      title={folder.isActive ? '点击禁用文件夹内所有条目' : '点击启用文件夹内所有条目'}
                                    >
                                      <div 
                                        className={`w-4 h-4 rounded-full bg-white shadow-xs transform duration-200 ${
                                          folder.isActive ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>

                                    {/* Manage Folder Button */}
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveMenuId(activeMenuId === folder.id ? null : folder.id);
                                        }}
                                        className="px-2.5 py-1 bg-white hover:bg-amber-100/80 text-gray-700 hover:text-amber-900 rounded-lg border border-gray-200/80 transition-colors cursor-pointer text-[11px] font-extrabold"
                                        title="管理文件夹"
                                      >
                                        <span>管理</span>
                                      </button>

                                      {activeMenuId === folder.id && (
                                        <div 
                                          className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-fadeIn"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              handleAddEntryToFolder(folder.id, 'dynamic');
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer"
                                          >
                                            <Plus size={12} className="text-amber-600" />
                                            <span>新增分类条目</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              handleExportFolder(folder, 'dynamic');
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                          >
                                            <Upload size={12} className="text-amber-600 rotate-180" />
                                            <span>导出文件夹 (.json)</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              setFolderModal({ mode: 'edit', id: folder.id, name: folder.name });
                                              setFolderModalName(folder.name);
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                          >
                                            <Pencil size={12} className="text-amber-600" />
                                            <span>重命名文件夹</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMenuId(null);
                                              setDeleteFolderConfirm({ id: folder.id, name: folder.name, count: folderEntries.length });
                                            }}
                                            className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                          >
                                            <Trash2 size={12} className="text-rose-500" />
                                            <span>删除文件夹</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Folder Contents */}
                                {!isCollapsed && (
                                  <div className="space-y-2.5 pt-1 pl-2 border-l-2 border-slate-200">
                                    {folderEntries.length === 0 ? (
                                      <div className="text-[11px] text-slate-400 italic py-3 text-center bg-white rounded-xl border border-dashed border-slate-200">
                                        文件夹内暂无设定条目，点击右上方“+”新增
                                      </div>
                                    ) : (
                                      folderEntries.map((entry, idx) => renderEntryCard(entry, idx))
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* 2. RENDER UNCATEGORIZED ENTRIES */}
                          {(() => {
                            const uncategorizedEntries = filteredEntries.filter(
                              e => !e.folderId || !(config.folders || []).some(f => f.id === e.folderId)
                            );
                            if (uncategorizedEntries.length === 0) return null;

                            return (
                              <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 space-y-3 shadow-xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <FolderOpen size={16} className="text-slate-400" />
                                    <span className="font-extrabold text-xs text-slate-700">未分类设定条目</span>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                                      {uncategorizedEntries.length} 条
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-2.5">
                                  {uncategorizedEntries.map((entry, idx) => renderEntryCard(entry, idx))}
                                </div>
                              </div>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: POST-RULES (Formatting and reinforcement in card format matching keywords style) */}
            {worldBookSubTab === 'post' && (
              <div className="space-y-3.5 flex flex-col h-full animate-fadeIn">
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-[11px] font-extrabold tracking-wider text-gray-500 uppercase flex items-center gap-1">
                    <FileText size={12} className="text-amber-500" />
                    后置自检规则 ({config.postRulesList?.length || 0} 条)
                  </span>
                  <div className="flex items-center space-x-2">
                    <label className="px-2.5 py-1 bg-[#FEE500]/20 hover:bg-[#FEE500]/30 text-[#3C1E1E] rounded-lg text-xs font-extrabold flex items-center space-x-1 transition-all cursor-pointer" title="导入 docx/txt 文件创建后置规则">
                      <Upload size={12} className="text-[#3C1E1E]" />
                      <span>导入 docx/txt</span>
                      <input
                        type="file"
                        accept=".docx,.txt,.json,.md"
                        className="hidden"
                        onChange={(e) => handleImportFileToNewEntry(e, 'dynamic', 'post')}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleAddListEntry('post')}
                      className="w-7 h-7 bg-[#FEE500] hover:bg-[#EED500] text-[#3C1E1E] rounded-lg flex items-center justify-center shadow-sm transition-all cursor-pointer"
                      title="新设后置"
                    >
                      <Plus size={14} className="stroke-[3]" />
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pb-8">
                  {(!config.postRulesList || config.postRulesList.length === 0) ? (
                    <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-12 text-center">
                      <FileText size={28} className="mx-auto text-gray-300 stroke-[1.5] mb-2" />
                      <p className="text-xs text-gray-400">
                        无后置自检规则，点击右上角 “+” 新增一个。
                      </p>
                    </div>
                  ) : (
                    config.postRulesList.map((item, idx) => {
                      const isExpanded = expandedIds[item.id] ?? false;
                      return (
                        <div 
                          key={item.id}
                          className={`bg-white rounded-2xl border transition-all p-3.5 flex flex-col gap-2.5 shadow-xs ${
                            item.isActive ? 'border-gray-200/80 hover:border-gray-300' : 'border-gray-200/50 opacity-60'
                          }`}
                        >
                          {/* Top Row: Clickable header for toggling collapse */}
                          <div className="flex items-center justify-between gap-2">
                            <div 
                              onClick={() => toggleExpand(item.id)}
                              className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none group"
                            >
                              <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 rounded-lg px-2 py-1 font-mono shrink-0">
                                {(idx + 1).toString().padStart(2, '0')}
                              </span>
                              <span className="font-extrabold text-xs text-gray-800 truncate group-hover:text-amber-600 transition-colors">
                                {item.title || <span className="text-gray-400 italic font-normal">未命名自检规则</span>}
                              </span>
                              {isExpanded ? (
                                <ChevronUp size={13} className="text-gray-400 shrink-0" />
                              ) : (
                                <ChevronDown size={13} className="text-gray-400 shrink-0" />
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center space-x-2 shrink-0">
                              {/* Switch Active Status */}
                              <button
                                type="button"
                                onClick={() => handleUpdateListEntry('post', item.id, 'isActive', !item.isActive)}
                                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                                  item.isActive ? 'bg-[#FEE500]' : 'bg-gray-200'
                                }`}
                              >
                                <div 
                                  className={`w-4 h-4 rounded-full bg-white shadow-xs transform duration-200 ${
                                    item.isActive ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>

                              {/* Manage Button */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuId(activeMenuId === item.id ? null : item.id);
                                  }}
                                  className="px-2.5 py-1 bg-gray-100 hover:bg-amber-100/80 text-gray-700 hover:text-amber-900 rounded-lg transition-colors cursor-pointer text-[11px] font-extrabold"
                                  title="管理规则"
                                >
                                  <span>管理</span>
                                </button>

                                {activeMenuId === item.id && (
                                  <div 
                                    className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-fadeIn"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setEditModal({
                                          type: 'post',
                                          id: item.id,
                                          title: item.title,
                                          content: item.content
                                        });
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-900 font-extrabold flex items-center space-x-1.5 cursor-pointer"
                                    >
                                      <Pencil size={12} className="text-amber-600" />
                                      <span>编辑规则</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null);
                                        setDeleteItemConfirm({ type: 'list', listType: 'post', id: item.id, title: item.title || '该后置规则' });
                                      }}
                                      className="w-full px-3 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50 font-extrabold flex items-center space-x-1.5 cursor-pointer border-t border-gray-50"
                                    >
                                      <Trash2 size={12} className="text-rose-500" />
                                      <span>删除规则</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Content Section (Collapsible) */}
                          {isExpanded ? (
                            <div className="space-y-1.5 pt-1.5 border-t border-gray-100 animate-fadeIn">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">📝 详细自检设定 (只读预览，点击编辑按钮修改)</span>
                                <button
                                  type="button"
                                  onClick={() => setEditModal({
                                    type: 'post',
                                    id: item.id,
                                    title: item.title,
                                    content: item.content
                                  })}
                                  className="text-[9px] font-extrabold text-amber-600 hover:underline cursor-pointer"
                                >
                                  点击编辑
                                </button>
                              </div>
                              <div className="bg-gray-50/70 rounded-xl p-3 border border-gray-100 text-xs text-gray-600 font-mono whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                                {item.content || <span className="text-gray-400 italic">暂无详细内容</span>}
                              </div>
                            </div>
                          ) : (
                            item.content && (
                              <div 
                                onClick={() => toggleExpand(item.id)}
                                className="text-[11px] text-gray-400 font-mono truncate px-1 cursor-pointer hover:text-gray-500 transition-colors"
                              >
                                {item.content}
                              </div>
                            )
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* EDIT MODAL POPUP */}
        {editModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            {/* Backdrop Overlay */}
            <div 
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity duration-300 animate-fadeIn"
              onClick={() => setEditModal(null)}
            />

            {/* Modal Box */}
            <div className="relative bg-white w-full max-w-xl rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden transform transition-all duration-300 animate-scaleUp">
              {/* Modal Header */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-gray-900">
                      编辑{editModal.type === 'preset' ? '预设' : editModal.type === 'pre' ? '前置规则' : editModal.type === 'mid' ? '常驻背景' : editModal.type === 'post' ? '后置自检' : '词汇触发设定'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="w-7 h-7 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Modal Content / Form */}
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3 sm:space-y-4">
                {/* Title Input */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">设定项名称</label>
                  <input
                    type="text"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    placeholder="请输入名称/标题..."
                    className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 bg-gray-50/50 focus:bg-white transition-all font-bold"
                  />
                </div>

                {/* Keywords (only for dynamic triggers) */}
                {editModal.type === 'dynamic' && (
                  <div className="space-y-3 animate-fadeIn">
                    {/* Entry Type Toggle */}
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                        设定注入模式
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setModalEntryType('dynamic')}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                            modalEntryType === 'dynamic'
                              ? 'bg-[#FEE500] text-[#3C1E1E] border-[#FEE500] font-extrabold shadow-xs'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span>🔑 词汇触发</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalEntryType('static')}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1 transition-all cursor-pointer ${
                            modalEntryType === 'static'
                              ? 'bg-[#FEE500] text-[#3C1E1E] border-[#FEE500] font-extrabold shadow-xs'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <span>📌 常驻背景</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-extrabold text-[#3C1E1E] uppercase tracking-wider flex items-center gap-1">
                        <span>📁 归属文件夹</span>
                      </label>
                      <select
                        value={modalFolderId}
                        onChange={(e) => setModalFolderId(e.target.value)}
                        className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs text-gray-800 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-amber-400 font-bold"
                      >
                        <option value="">未分类 (根目录)</option>
                        {(config.folders || []).map(f => (
                          <option key={f.id} value={f.id}>
                            📁 {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {modalEntryType === 'dynamic' && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-extrabold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                          <span>🔑 触发关键词</span>
                          <span className="text-[9px] font-medium text-gray-400 normal-case">(英文或中文逗号隔开)</span>
                        </label>
                        <input
                          type="text"
                          value={modalKeywords}
                          onChange={(e) => setModalKeywords(e.target.value)}
                          placeholder="例如: 角色1, 背景, 关系..."
                          className="w-full h-9 px-3 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 bg-gray-50/50 focus:bg-white transition-all font-bold"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Detailed Content Textarea */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">详细设定内容</label>
                    <label className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200/80 rounded-lg text-[11px] font-extrabold flex items-center space-x-1 cursor-pointer transition-all">
                      <Upload size={12} className="text-amber-700" />
                      <span>导入 docx/txt 文档</span>
                      <input
                        type="file"
                        accept=".docx,.txt,.json,.md"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const { title, content } = await parseDocumentFile(file);
                            if (content) {
                              setModalContent(content);
                              if (!modalTitle.trim()) {
                                setModalTitle(title);
                              }
                            }
                          } catch (err) {
                            console.error(err);
                            alert('读取文件失败，请检查文档格式');
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                    </label>
                  </div>
                  <textarea
                    value={modalContent}
                    onChange={(e) => setModalContent(e.target.value)}
                    placeholder="请输入具体的规则、世界设定、预设、或触发载入内容..."
                    className="w-full h-40 sm:h-64 p-3 sm:p-3.5 border border-gray-200 rounded-xl text-xs leading-relaxed text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 bg-gray-50/50 focus:bg-white transition-all resize-y font-mono"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { type, id } = editModal;
                    if (type === 'dynamic') {
                      handleUpdateEntry(id, 'title', modalTitle);
                      handleUpdateEntry(id, 'keywords', modalKeywords);
                      handleUpdateEntry(id, 'content', modalContent);
                      handleUpdateEntry(id, 'folderId', modalFolderId || undefined);
                      handleUpdateEntry(id, 'entryType', modalEntryType);
                    } else {
                      handleUpdateListEntry(type, id, 'title', modalTitle);
                      handleUpdateListEntry(type, id, 'content', modalContent);
                    }
                    setEditModal(null);
                  }}
                  className="px-5 py-2 bg-[#FEE500] hover:bg-[#EED500] text-[#3C1E1E] rounded-xl text-xs font-extrabold shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-center"
                >
                  <span>保存</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE / EDIT FOLDER MODAL */}
        {folderModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-xs animate-fadeIn" onClick={() => setFolderModal(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl border border-gray-100 p-5 space-y-4 animate-scaleUp z-10">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-sm text-gray-900 flex items-center space-x-1.5">
                  <FolderPlus size={16} className="text-amber-600" />
                  <span>{folderModal.mode === 'create' ? '新建分类文件夹' : '重命名文件夹'}</span>
                </h3>
                <button onClick={() => setFolderModal(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600">文件夹名称</label>
                <input
                  type="text"
                  value={folderModalName}
                  onChange={(e) => setFolderModalName(e.target.value)}
                  placeholder="例如: 角色记忆、装备设定、主线故事..."
                  className="w-full h-10 px-3 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 bg-gray-50 focus:bg-white transition-all"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFolderModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSaveFolderModal}
                  disabled={!folderModalName.trim()}
                  className="px-4 py-2 bg-[#FEE500] hover:bg-[#EED500] disabled:opacity-50 text-[#3C1E1E] rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE FOLDER CONFIRMATION MODAL */}
        {deleteFolderConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-xs animate-fadeIn" onClick={() => setDeleteFolderConfirm(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl border border-rose-100 p-5 space-y-4 animate-scaleUp z-10">
              <div className="flex items-center space-x-2 text-rose-600">
                <Trash2 size={20} />
                <h3 className="font-extrabold text-sm">删除文件夹确认</h3>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed">
                确定要删除文件夹 <span className="font-bold text-rose-700">『{deleteFolderConfirm.name}』</span> 吗？
                <br />
                <span className="text-rose-600 font-bold">警告：此操作将彻底删除该文件夹及其包含的全部 {deleteFolderConfirm.count} 条设定条目，不可恢复！</span>
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteFolderConfirm(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteFolder}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                >
                  彻底删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE ITEM CONFIRMATION MODAL */}
        {deleteItemConfirm && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-xs animate-fadeIn" onClick={() => setDeleteItemConfirm(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-xl border border-rose-100 p-5 space-y-4 animate-scaleUp z-10">
              <div className="flex items-center space-x-2 text-rose-600">
                <Trash2 size={20} />
                <h3 className="font-extrabold text-sm">删除确认</h3>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed">
                确定要删除 <span className="font-bold text-rose-700">『{deleteItemConfirm.title}』</span> 吗？
                <br />
                <span className="text-gray-500 font-bold">此操作不可恢复，确定要删除吗？</span>
              </p>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteItemConfirm(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deleteItemConfirm.type === 'entry') {
                      handleDeleteEntry(deleteItemConfirm.id);
                    } else if (deleteItemConfirm.type === 'list' && deleteItemConfirm.listType) {
                      handleDeleteListEntry(deleteItemConfirm.listType, deleteItemConfirm.id);
                    }
                    setDeleteItemConfirm(null);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
