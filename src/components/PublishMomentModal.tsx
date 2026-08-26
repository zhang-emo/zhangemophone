import React, { useState } from 'react';
import { X, Image as ImageIcon, Send, Camera } from 'lucide-react';
import { LocalImage } from '../lib/types';
import { dbInstance } from '../lib/db';
import ImagePickerModal from './ImagePickerModal';

interface PublishMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPublish: (content: string, imageName?: string) => void;
  localSandboxImages: LocalImage[];
  onRefreshImages: () => void;
}

export default function PublishMomentModal({
  isOpen,
  onClose,
  onPublish,
  localSandboxImages,
  onRefreshImages
}: PublishMomentModalProps) {
  const [content, setContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [pendingPickerImages, setPendingPickerImages] = useState<string[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const loaders = Array.from(files).map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string || '');
        reader.readAsDataURL(file);
      });
    });

    Promise.all(loaders).then(base64s => {
      const valid = base64s.filter(Boolean);
      if (valid.length > 0) {
        setPendingPickerImages(valid);
        setIsPickerOpen(true);
      }
    });
    e.target.value = '';
  };

  const handlePickerSend = async (selectedBase64List: string[]) => {
    if (selectedBase64List.length === 0) return;

    // Save the first selected picture or primary picture as the moment image attachment
    const firstBase64 = selectedBase64List[0];
    const imgName = `moment_user_attach_${Date.now()}.png`;
    await dbInstance.saveImage({
      name: imgName,
      data: firstBase64,
      createdAt: Date.now()
    });
    setSelectedImage(imgName);
    if (onRefreshImages) {
      onRefreshImages();
    }
    setShowImageSelector(false);
  };

  const handlePublishClick = () => {
    if (!content.trim()) {
      alert('请输入动态内容！');
      return;
    }
    onPublish(content.trim(), selectedImage);
    setContent('');
    setSelectedImage(undefined);
    setShowImageSelector(false);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
      {/* Background click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="bg-white rounded-[24px] w-full max-w-sm p-6 relative flex flex-col space-y-4 shadow-2xl border border-gray-100 text-gray-800">
        {/* Header title */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 select-none">
          <div>
            <h3 className="text-xs font-black text-gray-900">发布新动态</h3>
            <p className="text-[9px] text-gray-400 font-mono mt-0.5 uppercase tracking-wide">POST NEW MOMENT</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-50 text-gray-400 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Textarea */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            动态文字
          </label>
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="分享你的新鲜事、日常碎碎念..."
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:border-gray-900 focus:bg-white transition-all font-sans font-medium placeholder-gray-400 leading-relaxed resize-none"
          />
        </div>

        {/* Image Attachment Row */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
              配图 (可选)
            </span>
            <button
              type="button"
              onClick={() => setShowImageSelector(!showImageSelector)}
              className="text-[10px] font-bold text-gray-700 flex items-center space-x-1 hover:text-gray-900 transition-colors"
            >
              <ImageIcon size={11} className="text-gray-500" />
              <span>{selectedImage ? '更换图片' : '添加配图'}</span>
            </button>
          </div>

          {selectedImage && (
            <div className="relative w-24 h-24 rounded-[12px] overflow-hidden border border-gray-200 shadow-sm bg-gray-50 group">
              {(() => {
                const imgObj = localSandboxImages.find(img => img.name === selectedImage);
                return imgObj ? (
                  <img src={imgObj.data} alt="Selected" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">{selectedImage}</div>
                );
              })()}
              <button
                type="button"
                onClick={() => setSelectedImage(undefined)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-all cursor-pointer"
              >
                <X size={10} />
              </button>
            </div>
          )}

          {/* Inline Image selector list */}
          {showImageSelector && (
            <div className="bg-gray-50 rounded-[12px] border border-gray-200 p-3 space-y-2.5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-1">
                <span className="text-[9px] font-bold text-gray-500">选择或上传图片</span>
                <button
                  type="button"
                  onClick={() => setShowImageSelector(false)}
                  className="text-[9px] text-gray-400 hover:text-gray-900"
                >
                  收起
                </button>
              </div>

              <label className="w-full h-7 rounded-[6px] bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-[9px] font-bold text-gray-700 cursor-pointer shadow-sm">
                <Camera size={10} className="mr-1 text-gray-500" />
                本地相册选择图片
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {localSandboxImages.length > 0 ? (
                <div className="space-y-1">
                  <span className="text-[8px] text-gray-400 font-bold block uppercase">沙盒已有图：</span>
                  <div className="grid grid-cols-5 gap-1.5 max-h-24 overflow-y-auto p-0.5">
                    {localSandboxImages.map((img) => (
                      <button
                        key={img.name}
                        type="button"
                        onClick={() => {
                          setSelectedImage(img.name);
                          setShowImageSelector(false);
                        }}
                        className={`w-9 h-9 rounded-[6px] overflow-hidden border ${selectedImage === img.name ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'} bg-white flex items-center justify-center shadow-sm shrink-0`}
                      >
                        <img src={img.data} alt="sandbox thumb" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[9px] text-gray-400 text-center">暂无沙盒缓存图。上传新图后会自动暂存。</p>
              )}
            </div>
          )}
        </div>

        {/* Publish Action Button */}
        <div className="flex space-x-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 text-xs font-bold text-gray-700 transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handlePublishClick}
            className="flex-1 h-10 rounded-xl bg-gray-950 hover:bg-gray-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1 shadow"
          >
            <Send size={12} />
            <span>立即发布</span>
          </button>
        </div>

      </div>

      {/* Image Picker with Free Cropper */}
      <ImagePickerModal
        isOpen={isPickerOpen}
        initialImages={pendingPickerImages}
        onClose={() => setIsPickerOpen(false)}
        onSend={handlePickerSend}
        title="朋友圈配图相册"
        sendButtonText="确认使用图片"
      />
    </div>
  );
}
