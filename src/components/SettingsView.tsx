/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Key, 
  Globe, 
  Cpu, 
  Thermometer, 
  Download, 
  Upload, 
  Check, 
  AlertCircle,
  Eye,
  EyeOff,
  Sliders,
  Settings,
  Database,
  Lock,
  ArrowRight,
  Info,
  RefreshCw,
  Image as ImageIcon,
  Plus,
  Trash2,
  FileImage,
  Loader2,
  Home,
  ArrowLeft,
  Save,
  Activity,
  Wifi,
  CheckCircle2,
  Copy,
  FileText,
  X
} from 'lucide-react';
import { AppSettings, ApiProfile, BackupData, LocalImage } from '../lib/types';
import { dbInstance } from '../lib/db';
import { compressFileImage } from '../lib/imageCompressor';

const POPULAR_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (OpenAI)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o-Mini (OpenAI)' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat' },
  { value: 'deepseek-reasoner', label: 'DeepSeek R1' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
];

const DEFAULT_API_PROFILES: ApiProfile[] = [
  { id: 'openai-default', name: 'OpenAI 官方', baseUrl: 'https://api.openai.com/v1', apiKey: '' },
  { id: 'deepseek-default', name: 'DeepSeek 官方', baseUrl: 'https://api.deepseek.com/v1', apiKey: '' },
  { id: 'openrouter-default', name: 'OpenRouter 聚合', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '' },
];

export default function SettingsView({ onHome }: { onHome?: () => void }) {
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    selectedModel: 'gpt-4o',
    temperature: 0.7,
    customModels: [],
    apiProfiles: DEFAULT_API_PROFILES,
    activeProfileId: 'custom'
  });

  const [presetNameInput, setPresetNameInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Local sandbox files list (/images)
  const [localImages, setLocalImages] = useState<LocalImage[]>([]);
  const [showDeletePresetConfirm, setShowDeletePresetConfirm] = useState(false);
  const [deleteImageName, setDeleteImageName] = useState<string | null>(null);
  
  // JSON Backup / Restore Text Modal State (Mobile WebView Fallback)
  const [showJsonBackupModal, setShowJsonBackupModal] = useState(false);
  const [jsonBackupText, setJsonBackupText] = useState('');
  const [showPasteRestoreModal, setShowPasteRestoreModal] = useState(false);
  const [pasteJsonInput, setPasteJsonInput] = useState('');

  // Custom toast feedback state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // File inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUploadRef = useRef<HTMLInputElement>(null);

  // Load database settings and mock images on mount
  useEffect(() => {
    async function loadSettingsAndImages() {
      try {
        const storedSettings = await dbInstance.getSettings();
        const storedProfiles = storedSettings.apiProfiles && storedSettings.apiProfiles.length > 0
          ? storedSettings.apiProfiles
          : DEFAULT_API_PROFILES;
        
        const activeId = storedSettings.activeProfileId || 'custom';
        const currentProf = storedProfiles.find(p => p.id === activeId);
        if (currentProf) {
          setPresetNameInput(currentProf.name);
        }

        setSettings({
          ...storedSettings,
          apiProfiles: storedProfiles,
          activeProfileId: activeId
        });

        // Fetch local sandbox picture elements
        const list = await dbInstance.getAllImages();
        setLocalImages(list);
      } catch (e) {
        showToast('加载本地设置/沙盒文件失败', 'error');
      } finally {
        setIsLoading(false);
      }
    }
    loadSettingsAndImages();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async (updatedSettings: AppSettings) => {
    setIsSaving(true);
    try {
      await dbInstance.saveSettings(updatedSettings);
      showToast('设置已安全保存到本地存储');
    } catch (e) {
      showToast('保存设置失败', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: keyof AppSettings, value: any) => {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
    // Auto-save changes for modern polished mobile flow
    handleSave(updated);
  };

  // API Profile Presets Handlers
  const handleSelectProfile = (profileId: string) => {
    if (profileId === 'custom') {
      const updated = {
        ...settings,
        activeProfileId: 'custom'
      };
      setSettings(updated);
      setPresetNameInput('');
      handleSave(updated);
      return;
    }

    const profiles = settings.apiProfiles || DEFAULT_API_PROFILES;
    const target = profiles.find(p => p.id === profileId);
    if (target) {
      const updated: AppSettings = {
        ...settings,
        activeProfileId: target.id,
        baseUrl: target.baseUrl || settings.baseUrl,
        apiKey: target.apiKey || settings.apiKey,
        selectedModel: target.selectedModel || settings.selectedModel,
      };
      setSettings(updated);
      setPresetNameInput(target.name);
      handleSave(updated);
      showToast(`已装载凭据预设：${target.name}`);
    }
  };

  const handleSavePreset = () => {
    const name = presetNameInput.trim();
    if (!name) {
      showToast('请先输入预设名称', 'error');
      return;
    }

    const currentProfiles = settings.apiProfiles || DEFAULT_API_PROFILES;
    let activeId = settings.activeProfileId;
    let updatedProfiles: ApiProfile[];

    const existingIdx = currentProfiles.findIndex(p => p.id === activeId || p.name === name);

    if (existingIdx >= 0) {
      activeId = currentProfiles[existingIdx].id;
      updatedProfiles = currentProfiles.map((p, idx) => idx === existingIdx ? {
        ...p,
        name,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        selectedModel: settings.selectedModel,
      } : p);
    } else {
      activeId = `profile_${Date.now()}`;
      const newProf: ApiProfile = {
        id: activeId,
        name,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        selectedModel: settings.selectedModel,
      };
      updatedProfiles = [...currentProfiles, newProf];
    }

    const updatedSettings: AppSettings = {
      ...settings,
      apiProfiles: updatedProfiles,
      activeProfileId: activeId,
    };

    setSettings(updatedSettings);
    handleSave(updatedSettings);
    showToast(`凭据预设【${name}】已保存`);
  };

  const handleDeletePreset = () => {
    const activeId = settings.activeProfileId;
    if (!activeId || activeId === 'custom') return;
    setShowDeletePresetConfirm(true);
  };

  // TEST API CONNECTION via lightweight endpoint request
  const handleTestConnection = async () => {
    if (!settings.apiKey) {
      showToast('未检测到 API Key，请先输入 API Key', 'error');
      return;
    }

    setIsTestingConnection(true);
    try {
      const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
      const response = await fetch(`${cleanBaseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showToast('API Key 网络连接验证成功！服务响应正常', 'success');
      } else if (response.status === 401 || response.status === 403) {
        showToast(`连接失败：API Key 无效或未授权 (HTTP ${response.status})`, 'error');
      } else {
        showToast(`已收到终端响应 (HTTP ${response.status})，网络畅通`, 'success');
      }
    } catch (err: any) {
      showToast(`网络连接测试失败: ${err?.message || '请检查代理终端地址与网络连接'}`, 'error');
    } finally {
      setIsTestingConnection(false);
    }
  };

  // FETCH ONLINE MODELS via standard API List request
  const handleFetchModels = async () => {
    if (!settings.apiKey) {
      showToast('拉取在线模型前，请在下方表单中填写您的 API Key', 'error');
      return;
    }

    setIsFetchingModels(true);
    showToast('正在尝试连接服务拉取可用模型列表...', 'success');

    try {
      const cleanBaseUrl = settings.baseUrl.trim().replace(/\/$/, "");
      const response = await fetch(`${cleanBaseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`服务回响错误: HTTP ${response.status}`);
      }

      const data = await response.json();
      let fetchedModels: string[] = [];

      if (data && Array.isArray(data.data)) {
        fetchedModels = data.data.map((m: any) => m.id).filter(Boolean);
      } else if (Array.isArray(data)) {
        fetchedModels = data.map((m: any) => m.id || m.name).filter(Boolean);
      } else if (data && typeof data === 'object') {
        // Some backends wrap in an outer object with other keys
        const keysWithArray = Object.values(data).find(val => Array.isArray(val));
        if (Array.isArray(keysWithArray)) {
          fetchedModels = keysWithArray.map((m: any) => m.id || m.name || m).filter(m => typeof m === 'string');
        }
      }

      if (fetchedModels.length > 0) {
        // Dedup and sort list
        const uniqueModels = Array.from(new Set(fetchedModels)).sort();
        const updated = {
          ...settings,
          customModels: uniqueModels
        };
        setSettings(updated);
        await dbInstance.saveSettings(updated);
        showToast(`成功！已从 API 终端拉取并保存了 ${uniqueModels.length} 个可用模型。`);
      } else {
        throw new Error('未能提取到任何有效的模型标识符，服务端返回可能非常规。');
      }
    } catch (err: any) {
      console.error(err);
      showToast(`拉取失败: ${err.message || '请确认您的 Base URL 和网络连接'}`, 'error');
    } finally {
      setIsFetchingModels(false);
    }
  };

  // ZIP EXPORT BUILDER (Enhanced for Mobile Webview & ArkWeb)
  const handleExportZip = async () => {
    setIsSaving(true);
    try {
      showToast('正在压缩处理数据库与离线图片...', 'success');
      const zipBlob = await dbInstance.exportDatabaseZip();
      
      // Standard Blob download
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `mobile_ai_backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      
      showToast('全部数据已整合生成 ZIP 备份包并触发下载！');
    } catch (e: any) {
      console.error(e);
      showToast(`导出 ZIP 失败: ${e?.message || '请重试'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // JSON TEXT EXPORT (100% Mobile WebView Compatible)
  const handleExportJsonText = async () => {
    try {
      setIsSaving(true);
      const backupData = await dbInstance.exportDatabase();
      const jsonStr = JSON.stringify(backupData, null, 2);
      setJsonBackupText(jsonStr);
      setShowJsonBackupModal(true);
      
      // Copy to clipboard automatically if supported
      try {
        await navigator.clipboard.writeText(jsonStr);
        showToast('JSON 数据库全局备份文本已自动复制到剪贴板！');
      } catch (_) {
        showToast('已生成 JSON 全量备份，可长按框内文本复制保存');
      }
    } catch (e: any) {
      showToast(`导出 JSON 失败: ${e?.message || '未知错误'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // RESTORE FROM PASTED JSON TEXT
  const handleRestoreFromPastedJson = async () => {
    if (!pasteJsonInput.trim()) {
      showToast('请先贴入备份的 JSON 文本', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const parsed = JSON.parse(pasteJsonInput);
      await dbInstance.importDatabase(parsed);

      const importedSettings = await dbInstance.getSettings();
      setSettings(importedSettings);
      setShowPasteRestoreModal(false);
      setPasteJsonInput('');
      showToast('成功恢复文本 JSON 备份！全量聊天记录与设置已恢复。');
    } catch (e: any) {
      showToast(`恢复失败：备份 JSON 文本格式错误或损坏 (${e?.message})`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ZIP IMPORT RESTORE
  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      await dbInstance.importDatabaseZip(file);
      
      // Re-read settings state from IndexedDB sandbox
      const importedSettings = await dbInstance.getSettings();
      setSettings(importedSettings);
      
      // Load imported virtual files in /images directory
      const list = await dbInstance.getAllImages();
      setLocalImages(list);

      showToast('成功解压 ZIP 备份！本地库与虚拟 /images 目录已高安全完成覆盖。');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error(err);
      showToast(`导入包解析出错: ${err.message || '请确保上传的是合规的 ZIP 压缩包'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // FILE SANDBOX UPLOAD & DELETION (Automated Canvas Resize)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('为了维持系统安全，当前沙盒仅接受图片文件进入 /images 文件夹', 'error');
      return;
    }

    try {
      // Automatic Canvas Resize & Compression (800x800 max, 0.8 quality)
      const compressedBase64 = await compressFileImage(file, 800, 800, 0.8);
      const cleanName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      
      const newImage: LocalImage = {
        name: cleanName,
        data: compressedBase64,
        createdAt: Date.now()
      };

      await dbInstance.saveImage(newImage);
      const list = await dbInstance.getAllImages();
      setLocalImages(list);
      showToast(`已成功将压缩优化后的图片保存至：/images/${cleanName}`);
    } catch (err: any) {
      console.error(err);
      showToast(`存储文件到虚拟盘失败: ${err?.message || '未知错误'}`, 'error');
    }
  };

  const handleDeleteImage = async (name: string) => {
    setDeleteImageName(name);
  };

  const handleCreateDemoImage = async () => {
    try {
      const demoColors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444'];
      const chosenColor = demoColors[Math.floor(Math.random() * demoColors.length)];
      const randomId = Math.floor(Math.random() * 900) + 100;
      
      const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="${chosenColor}"/><circle cx="50" cy="50" r="30" fill="white" fill-opacity="0.2"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="'Courier New', monospace" font-weight="bold" font-size="28" fill="white">AI</text></svg>`;
      const base64Data = `data:image/svg+xml;base64,${btoa(sampleSvg)}`;
      
      const newImage: LocalImage = {
        name: `mock_image_uuid_${randomId}.svg`,
        data: base64Data,
        createdAt: Date.now()
      };

      await dbInstance.saveImage(newImage);
      const list = await dbInstance.getAllImages();
      setLocalImages(list);
      showToast(`已为您模拟在本地生成了一张精美的头像图片文件！`);
    } catch (err) {
      showToast('创制测试图片失败', 'error');
    }
  };

  // Assemble dynamic list of models
  const uniqueModelMap = new Map();
  POPULAR_MODELS.forEach(m => uniqueModelMap.set(m.value, m));
  if (settings.customModels && Array.isArray(settings.customModels)) {
    settings.customModels.forEach(m => {
      if (!uniqueModelMap.has(m)) {
        uniqueModelMap.set(m, { value: m, label: m });
      }
    });
  }
  if (settings.selectedModel && !uniqueModelMap.has(settings.selectedModel)) {
    uniqueModelMap.set(settings.selectedModel, { value: settings.selectedModel, label: settings.selectedModel });
  }
  const combinedModels = Array.from(uniqueModelMap.values());

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 uppercase font-mono text-xs text-gray-500 tracking-wider">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-8 h-8 text-gray-900 animate-spin" />
          <span>正在沙箱中加密载入本地存储...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Toast Alert component */}
      {toast && (
        <div className="absolute top-4 left-4 right-4 z-50 animate-slide-down">
          <div className={`p-4 rounded-2xl flex items-center shadow-lg border text-xs font-sans tracking-wide leading-relaxed ${
            toast.type === 'success' 
              ? 'bg-slate-900 text-white border-slate-800' 
              : 'bg-red-50 text-red-800 border-red-100'
          }`}>
            {toast.type === 'success' ? (
              <Check className="mr-3 shrink-0 text-emerald-400" size={16} />
            ) : (
              <AlertCircle className="mr-3 shrink-0 text-red-500" size={16} />
            )}
            <span className="font-semibold">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header Bar - strictly 8x grid (h-16 = 64px, px-6 = 24px) */}
      <header className="h-16 px-4 bg-white border-b border-gray-100 flex items-center justify-between shrink-0 z-10 animate-fade-in">
        <div className="flex items-center space-x-3">
          {onHome && (
            <button
              type="button"
              onClick={onHome}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 hover:text-slate-900 transition-all cursor-pointer active:scale-95 shrink-0"
              title="返回手机桌面"
            >
              <Home size={16} className="stroke-[2.5]" />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-gray-950 flex items-center justify-center text-white shadow-sm shrink-0">
            <Settings size={16} className="stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-none">手机系统设置</h2>
            <p className="text-[10px] font-mono tracking-wider text-gray-400 uppercase mt-1">Chat Settings Device</p>
          </div>
        </div>
        <div className="flex items-center space-x-1 py-1 px-3 bg-gray-900 rounded-full text-[10px] text-white font-medium shadow-sm select-none">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1"></span>
          LOCAL MODE
        </div>
      </header>

      {/* Settings Panel Scroll View */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        
        {/* Sandbox Privacy Shield */}
        <div className="p-4 bg-gray-100/80 rounded-2xl border border-gray-200/40 flex space-x-3 select-none">
          <Lock className="text-gray-900 shrink-0 mt-0.5" size={16} />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-gray-900">数据与 API 安全沙岛</h4>
            <p className="text-[11px] text-gray-600 leading-normal">
              本终端不设后端。所有密钥与聊天档案直接保存在手机硬件模拟的 <strong>SQLite (IndexedDB)</strong> 中，通信流量直接发起不经由外置转发。
            </p>
          </div>
        </div>

        {/* 1. API & Model Credentials Unified Card */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
            <Key size={14} className="text-gray-900" />
            <span>API 凭据配置与模型调配</span>
          </div>

          <div className="space-y-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            {/* 1.1 API Profiles Dropdown & Saver */}
            <div className="space-y-2.5 pb-3 border-b border-gray-100">
              <label className="text-xs font-bold text-gray-700 flex justify-between items-center">
                <span>凭据预设与终端切换</span>
                <span className="text-[10px] text-gray-400 font-normal">多节点快速切换</span>
              </label>

              <div className="relative">
                <select
                  value={settings.activeProfileId || 'custom'}
                  onChange={(e) => handleSelectProfile(e.target.value)}
                  className="w-full h-10 px-3.5 pr-9 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-white transition-all appearance-none cursor-pointer"
                >
                  <option value="custom">-- 自定义 / 未保存凭据 --</option>
                  {(settings.apiProfiles || DEFAULT_API_PROFILES).map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.name} {prof.baseUrl ? `(${prof.baseUrl})` : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-400">
                  <Sliders size={13} />
                </div>
              </div>

              {/* Name Input & Action Buttons */}
              <div className="flex items-center space-x-2 pt-0.5">
                <input
                  type="text"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder="给当前终端预设命名 (如: 我的独享节点)..."
                  className="flex-1 h-9 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all"
                />
                
                <button
                  type="button"
                  onClick={handleSavePreset}
                  title="保存当前终端凭据预设"
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-900 hover:bg-gray-800 active:scale-95 text-white transition-all cursor-pointer shrink-0 shadow-sm"
                >
                  <Save size={15} />
                </button>

                {settings.activeProfileId && settings.activeProfileId !== 'custom' && (
                  <button
                    type="button"
                    onClick={handleDeletePreset}
                    title="删除当前预设"
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 border border-red-200/80 transition-all cursor-pointer shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* 1.2 API Key Input */}
            <div className="space-y-2 pb-3 border-b border-gray-100">
              <label className="text-xs font-bold text-gray-700 flex justify-between items-center">
                <span>API Key (加密保存)</span>
                <span className="text-[9px] font-mono text-emerald-600 tracking-wider">AES-GCM-256</span>
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => handleFieldChange('apiKey', e.target.value)}
                  placeholder="sk-..."
                  className="w-full h-10 pl-4 pr-11 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:bg-white transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* 1.3 Base URL Input */}
            <div className="space-y-2 pb-3 border-b border-gray-100">
              <label className="text-xs font-bold text-gray-700 block">代理终端地址 (Base URL)</label>
              <div className="relative">
                <input
                  type="url"
                  value={settings.baseUrl}
                  onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full h-10 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-white transition-all font-mono"
                />
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              </div>
              
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleFieldChange('baseUrl', 'https://api.openai.com/v1')}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] rounded-lg font-medium transition-all"
                >
                  OpenAI
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('baseUrl', 'https://api.deepseek.com/v1')}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] rounded-lg font-medium transition-all"
                >
                  DeepSeek
                </button>
                <button
                  type="button"
                  onClick={() => handleFieldChange('baseUrl', 'https://openrouter.ai/api/v1')}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] rounded-lg font-medium transition-all"
                >
                  OpenRouter
                </button>
              </div>
            </div>

            {/* 1.4 Model Selection & Online Pulling */}
            <div className="space-y-2 pb-3 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700">当前使用模型</label>
                
                <button
                  type="button"
                  onClick={handleFetchModels}
                  disabled={isFetchingModels}
                  className="flex items-center text-[10px] font-bold text-gray-900 hover:text-gray-600 disabled:opacity-50 transition-all space-x-1 uppercase tracking-wide px-2 py-1 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200"
                >
                  {isFetchingModels ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <RefreshCw size={10} />
                  )}
                  <span>拉取API模型</span>
                </button>
              </div>

              <div className="relative">
                <select
                  value={settings.selectedModel}
                  onChange={(e) => handleFieldChange('selectedModel', e.target.value)}
                  className="w-full h-10 px-4 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-white transition-all appearance-none cursor-pointer"
                >
                  {combinedModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <ArrowRight size={12} className="rotate-90 text-gray-400" />
                </div>
              </div>

              {/* Fixed Test Connection Button below model selector */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConnection}
                  className="w-full h-9 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition-all active:scale-98 cursor-pointer shadow-sm"
                >
                  {isTestingConnection ? (
                    <Loader2 size={14} className="animate-spin text-white" />
                  ) : (
                    <Activity size={14} className="text-emerald-400" />
                  )}
                  <span>{isTestingConnection ? '正在测试网络连通性...' : '测试网络连接'}</span>
                </button>
              </div>
            </div>

            {/* 1.6 Temperature Slider */}
            <div className="space-y-3 pt-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gray-700">温度系数 (Temperature)</span>
                <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-lg">
                  {settings.temperature.toFixed(2)}
                </span>
              </div>
              <div className="relative flex items-center py-1">
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-950 focus:outline-none"
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 font-semibold font-mono">
                <span>克制 (0.00)</span>
                <span>智能平衡 (0.70)</span>
                <span>狂野创造 (2.00)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. SIMULATED LOCAL FILE SANDBOX DIRECTORY (/images) */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
              <FileImage size={14} className="text-gray-900" />
              <span>本地沙盒文件目录 (/images)</span>
            </div>
            
            <button
              onClick={handleCreateDemoImage}
              className="text-[10px] font-bold text-gray-900 flex items-center space-x-1 hover:text-gray-600 bg-gray-100 px-2 py-1 rounded-lg hover:bg-gray-200 transition-all cursor-pointer"
            >
              <Plus size={10} />
              <span>虚拟测试图</span>
            </button>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            
            {/* File Drag/Upload zone */}
            <div 
              onClick={() => imageUploadRef.current?.click()}
              className="border border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-gray-900 hover:bg-gray-50/50 transition-all duration-300 flex flex-col items-center space-y-1.5"
            >
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600">
                <Plus size={14} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">点击或投递图片追加到 /images</p>
                <p className="text-[10px] text-gray-400 mt-0.5">支持 PNG, JPG, JPEG, SVG</p>
              </div>
            </div>

            <input
              type="file"
              ref={imageUploadRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />

            {/* Local images files grid (strict 8px spacings) */}
            {localImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 max-h-[190px] overflow-y-auto pr-1">
                {localImages.map((img) => (
                  <div key={img.name} className="bg-gray-50 p-2 rounded-xl border border-gray-200/40 relative flex items-center space-x-2 group">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center shrink-0 border border-gray-200">
                       {img.data.startsWith('data:image/') ? (
                        <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon size={18} className="text-gray-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 leading-normal">
                      <span className="text-[10px] font-mono font-bold text-gray-900 block truncate" title={img.name}>
                        {img.name}
                      </span>
                      <span className="text-[8px] font-mono text-gray-400 block mt-0.5">
                        {new Date(img.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    {/* Delete file button */}
                    <button
                      onClick={() => handleDeleteImage(img.name)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg p-1.5 border border-gray-200/50 transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow-sm"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50/50 rounded-xl border border-gray-100">
                <ImageIcon size={20} className="mx-auto text-gray-300" />
                <p className="text-[10px] text-gray-400 mt-1">/images 目录下目前没有图片文件</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Database Sandbox Migration & Compression (.ZIP) */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
            <Database size={14} className="text-gray-900" />
            <span>沙箱数据高压缩迁移</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Export .ZIP Button (includes sqlite.db and images/) */}
            <button
              onClick={handleExportZip}
              type="button"
              className="p-4 bg-gray-950 text-white rounded-2xl flex flex-col items-center justify-center text-center space-y-2 hover:bg-gray-900 active:scale-98 transition-all group cursor-pointer shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-white/10 text-white flex items-center justify-center group-hover:bg-white/20 transition-all duration-300">
                <Download size={16} />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white block">导出打包 .ZIP</span>
                <span className="text-[8px] font-mono text-gray-400 uppercase tracking-wider block">DB &amp; /images Archive</span>
              </div>
            </button>

            {/* Import .ZIP Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              type="button"
              className="p-4 bg-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center text-center space-y-2 hover:bg-gray-50 hover:border-gray-400 active:scale-98 transition-all group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-50 text-gray-900 flex items-center justify-center group-hover:bg-gray-900 group-hover:text-white transition-all duration-300">
                <Upload size={16} />
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-gray-900 block">导入并覆盖 .ZIP</span>
                <span className="text-[8px] font-mono text-gray-400 uppercase tracking-wider block">Restore zip package</span>
              </div>
            </button>
          </div>

          {/* Fallback JSON Text Backup & Restore for Mobile WebView / HAP ArkWeb */}
          <div className="pt-1 grid grid-cols-2 gap-3">
            <button
              onClick={handleExportJsonText}
              type="button"
              className="p-2.5 bg-indigo-50 border border-indigo-200/80 rounded-xl flex items-center justify-center space-x-2 text-indigo-800 hover:bg-indigo-100 transition-all cursor-pointer"
            >
              <FileText size={14} className="text-indigo-600" />
              <span className="text-xs font-bold">复制/导出 JSON 备份</span>
            </button>

            <button
              onClick={() => setShowPasteRestoreModal(true)}
              type="button"
              className="p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-center justify-center space-x-2 text-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer"
            >
              <Copy size={14} className="text-emerald-600" />
              <span className="text-xs font-bold">贴入 JSON 恢复</span>
            </button>
          </div>

          {/* Hidden reference form elements */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportZip}
            accept=".zip"
            className="hidden"
          />
        </div>

      </div>

      {/* JSON Backup Export Text Modal (Mobile WebView Universal Compatible) */}
      {showJsonBackupModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-gray-100 flex flex-col space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <FileText size={18} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-gray-900">JSON 全局数据库备份</h3>
              </div>
              <button
                onClick={() => setShowJsonBackupModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              在 Android WebView 或鸿蒙 HAP 中如果文件下载被阻断，您可以直接全选复制下方 JSON 密文并保存至备忘录：
            </p>

            <textarea
              readOnly
              value={jsonBackupText}
              className="w-full h-44 p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[10px] leading-relaxed text-gray-800 focus:outline-none resize-none select-all"
            />

            <div className="flex space-x-3 justify-end pt-1">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(jsonBackupText);
                    showToast('已成功全选并复制 JSON 到剪贴板！');
                  } catch (_) {
                    showToast('请手动长按框内文本全选复制');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center space-x-1.5"
              >
                <Copy size={13} />
                <span>一键复制 JSON 文本</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Restore JSON Modal */}
      {showPasteRestoreModal && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-gray-100 flex flex-col space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <Copy size={18} className="text-emerald-600" />
                <h3 className="text-sm font-bold text-gray-900">贴入 JSON 备份进行恢复</h3>
              </div>
              <button
                onClick={() => setShowPasteRestoreModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              请在下方粘贴您之前导出的 JSON 备份文本：
            </p>

            <textarea
              value={pasteJsonInput}
              onChange={(e) => setPasteJsonInput(e.target.value)}
              placeholder="在此粘贴 JSON 备份文本..."
              className="w-full h-44 p-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-[10px] leading-relaxed text-gray-800 focus:outline-none focus:border-gray-900 resize-none"
            />

            <div className="flex space-x-3 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowPasteRestoreModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleRestoreFromPastedJson}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                解析并还原数据库
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Preset Confirmation Modal */}
      {showDeletePresetConfirm && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除终端凭据预设</h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed">确定要删除当前终端凭据预设吗？</p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeletePresetConfirm(false)}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  const activeId = settings.activeProfileId;
                  const currentProfiles = settings.apiProfiles || DEFAULT_API_PROFILES;
                  const updatedProfiles = currentProfiles.filter(p => p.id !== activeId);

                  const updatedSettings: AppSettings = {
                    ...settings,
                    apiProfiles: updatedProfiles,
                    activeProfileId: 'custom',
                  };

                  setSettings(updatedSettings);
                  setPresetNameInput('');
                  handleSave(updatedSettings);
                  showToast('已删除该凭据预设');
                  setShowDeletePresetConfirm(false);
                }}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sandbox Image Confirmation Modal */}
      {deleteImageName && (
        <div className="absolute inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-zinc-200">
            <h3 className="text-base font-bold text-zinc-900 mb-2">确认删除沙盒盘图片</h3>
            <p className="text-xs text-zinc-500 mb-6 leading-relaxed break-words break-all">
              确定要从沙盒盘中删除文件 <span className="font-mono font-bold text-zinc-800 bg-zinc-100 px-1.5 py-0.5 rounded break-all select-all inline-block max-w-full truncate align-bottom">/images/{deleteImageName}</span> 吗？
            </p>
            <div className="flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteImageName(null)}
                className="px-4 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await dbInstance.deleteImage(deleteImageName);
                    const list = await dbInstance.getAllImages();
                    setLocalImages(list);
                    showToast(`文件已从本地沙盒 /images/${deleteImageName} 中安全擦除`);
                  } catch (err) {
                    showToast('删除文件失败', 'error');
                  } finally {
                    setDeleteImageName(null);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
