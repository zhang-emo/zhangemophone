import React, { useState } from 'react';
import { X, Check, Edit3, ChevronLeft, ChevronRight, Send, Trash2, Plus } from 'lucide-react';
import FreeCropModal from './FreeCropModal';

interface ImageItem {
  id: string;
  src: string;
  selected: boolean;
}

interface ImagePickerModalProps {
  isOpen: boolean;
  initialImages: string[];
  onClose: () => void;
  onSend: (selectedBase64List: string[]) => void;
  title?: string;
  sendButtonText?: string;
}

export default function ImagePickerModal({
  isOpen,
  initialImages,
  onClose,
  onSend,
  title = '选择图片',
  sendButtonText = '发送'
}: ImagePickerModalProps) {
  const [imageList, setImageList] = useState<ImageItem[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);

  // Initialize images on open
  React.useEffect(() => {
    if (isOpen) {
      const items: ImageItem[] = initialImages.map((src, i) => ({
        id: `img_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
        src,
        selected: true
      }));
      setImageList(items);
      setPreviewIndex(null);
      setCropIndex(null);
    }
  }, [isOpen, initialImages]);

  if (!isOpen) return null;

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setImageList(prev => prev.map(img => img.id === id ? { ...img, selected: !img.selected } : img));
  };

  const handleAddMoreFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const loaders = Array.from(files).map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string || '');
        reader.readAsDataURL(file);
      });
    });

    Promise.all(loaders).then(newBase64s => {
      const newItems: ImageItem[] = newBase64s.filter(Boolean).map((src, i) => ({
        id: `img_more_${Date.now()}_${i}`,
        src,
        selected: true
      }));
      setImageList(prev => [...prev, ...newItems]);
    });
    e.target.value = '';
  };

  const handleCropComplete = (croppedBase64: string) => {
    if (cropIndex === null) return;
    setImageList(prev => prev.map((img, idx) => idx === cropIndex ? { ...img, src: croppedBase64 } : img));
    setCropIndex(null);
  };

  const selectedCount = imageList.filter(img => img.selected).length;

  const handleConfirmSend = () => {
    const selectedSrcs = imageList.filter(img => img.selected).map(img => img.src);
    if (selectedSrcs.length === 0) {
      alert('请至少勾选一张图片');
      return;
    }
    onSend(selectedSrcs);
    onClose();
  };

  const currentPreviewImage = previewIndex !== null ? imageList[previewIndex] : null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 select-none animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-sm text-slate-100">{title}</h3>
            <span className="text-xs text-slate-400 font-medium">({selectedCount}/{imageList.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Thumbnail Gallery Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 sm:grid-cols-4 gap-2.5 min-h-[220px]">
          {imageList.map((img, idx) => (
            <div
              key={img.id}
              onClick={() => setPreviewIndex(idx)}
              className={`group relative aspect-square rounded-2xl overflow-hidden bg-slate-950 border-2 transition-all cursor-pointer ${
                img.selected ? 'border-amber-400 shadow-md scale-[0.99]' : 'border-slate-800 opacity-70 hover:opacity-100'
              }`}
            >
              <img src={img.src} alt="" className="w-full h-full object-cover" />

              {/* Selection Checkbox */}
              <button
                type="button"
                onClick={(e) => toggleSelect(img.id, e)}
                className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                  img.selected
                    ? 'bg-amber-400 border-amber-300 text-amber-950 shadow'
                    : 'bg-black/40 border-white/60 text-transparent hover:bg-black/60'
                }`}
              >
                <Check size={14} className="stroke-[3px]" />
              </button>

              {/* Hover Edit Badge */}
              <div className="absolute inset-x-0 bottom-0 py-1 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[10px] text-amber-300 font-bold flex items-center space-x-1">
                  <Edit3 size={11} />
                  <span>点击预览/编辑</span>
                </span>
              </div>
            </div>
          ))}

          {/* Add More Images Tile */}
          <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-700 hover:border-amber-400/80 bg-slate-800/40 hover:bg-slate-800/80 transition-all flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-amber-300 space-y-1">
            <Plus size={24} />
            <span className="text-[10px] font-bold">加图</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddMoreFiles}
              className="hidden"
            />
          </label>
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 border-t border-slate-800 flex justify-between items-center bg-slate-900/90 shrink-0">
          <button
            type="button"
            onClick={() => setImageList(prev => prev.map(img => ({ ...img, selected: true })))}
            className="text-xs text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            全选所有
          </button>

          <button
            type="button"
            onClick={handleConfirmSend}
            disabled={selectedCount === 0}
            className={`px-5 py-2.5 rounded-2xl font-extrabold text-xs flex items-center space-x-2 transition-all shadow-md cursor-pointer ${
              selectedCount > 0
                ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 active:scale-95'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Send size={14} />
            <span>{sendButtonText} ({selectedCount})</span>
          </button>
        </div>
      </div>

      {/* Fullscreen Image Preview & Edit Modal */}
      {currentPreviewImage && previewIndex !== null && (
        <div className="fixed inset-0 z-[1010] bg-black/95 flex flex-col justify-between animate-fade-in p-4">
          {/* Top Bar in Full Preview */}
          <div className="flex justify-between items-center text-white px-2 py-2">
            <button
              type="button"
              onClick={() => setPreviewIndex(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center space-x-1 cursor-pointer"
            >
              <ChevronLeft size={16} />
              <span>返回列表</span>
            </button>

            <span className="text-xs font-bold text-slate-400">
              {previewIndex + 1} / {imageList.length}
            </span>

            {/* Checkbox toggle in fullscreen */}
            <button
              type="button"
              onClick={() => toggleSelect(currentPreviewImage.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
                currentPreviewImage.selected
                  ? 'bg-amber-400 text-amber-950'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <Check size={14} className="stroke-[3px]" />
              <span>{currentPreviewImage.selected ? '已勾选' : '勾选此图'}</span>
            </button>
          </div>

          {/* Center Image Display */}
          <div className="relative flex-1 flex items-center justify-center p-2 overflow-hidden">
            <img
              src={currentPreviewImage.src}
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />

            {/* Previous Image Button */}
            {previewIndex > 0 && (
              <button
                type="button"
                onClick={() => setPreviewIndex(previewIndex - 1)}
                className="absolute left-2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all cursor-pointer"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* Next Image Button */}
            {previewIndex < imageList.length - 1 && (
              <button
                type="button"
                onClick={() => setPreviewIndex(previewIndex + 1)}
                className="absolute right-2 p-2 rounded-full bg-black/60 hover:bg-black/90 text-white transition-all cursor-pointer"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Bottom Toolbar in Full Preview */}
          <div className="flex justify-around items-center pt-2 pb-4 border-t border-slate-800/80 px-4 max-w-md mx-auto w-full">
            {/* Delete Image from list */}
            <button
              type="button"
              onClick={() => {
                const nextList = imageList.filter((_, i) => i !== previewIndex);
                setImageList(nextList);
                if (nextList.length === 0) {
                  setPreviewIndex(null);
                } else if (previewIndex >= nextList.length) {
                  setPreviewIndex(nextList.length - 1);
                }
              }}
              className="flex flex-col items-center text-xs text-rose-400 hover:text-rose-300 space-y-1 cursor-pointer"
            >
              <Trash2 size={20} />
              <span>移除</span>
            </button>

            {/* Open Free Cropper */}
            <button
              type="button"
              onClick={() => setCropIndex(previewIndex)}
              className="flex flex-col items-center text-xs text-amber-300 hover:text-amber-200 space-y-1 cursor-pointer"
            >
              <Edit3 size={20} />
              <span>编辑 / 自由裁剪</span>
            </button>

            {/* Send All Checked */}
            <button
              type="button"
              onClick={handleConfirmSend}
              disabled={selectedCount === 0}
              className="px-6 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-extrabold text-xs shadow-lg transition-all cursor-pointer flex items-center space-x-1.5"
            >
              <Send size={15} />
              <span>发送已选 ({selectedCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* Free Crop Modal */}
      {cropIndex !== null && imageList[cropIndex] && (
        <FreeCropModal
          isOpen={true}
          imageSrc={imageList[cropIndex].src}
          onClose={() => setCropIndex(null)}
          onCropComplete={handleCropComplete}
          title="自由裁剪 (任意宽高比)"
        />
      )}
    </div>
  );
}
