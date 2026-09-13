import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedBase64: string) => void;
  title?: string;
}

export default function ImageCropModal({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  title = '自由裁剪头像 (1:1 正方形)'
}: ImageCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset controls when new image comes in
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCropSave = () => {
    const img = imgRef.current;
    if (!img) return;

    const canvas = document.createElement('canvas');
    const cropSize = 400; // Output 400x400 avatar size
    canvas.width = cropSize;
    canvas.height = cropSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Background white/transparent fill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cropSize, cropSize);

    // Calculate crop box scaling relative to the UI container
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const cropBoxWidth = Math.min(containerRect.width, containerRect.height) * 0.8; // UI crop viewport

    // Center point in canvas
    ctx.save();
    ctx.translate(cropSize / 2, cropSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    // Scaling ratio from UI crop viewport to export canvas (400px)
    const scaleFactor = cropSize / cropBoxWidth;

    // Render scaled and offset image
    const drawWidth = (img.naturalWidth * zoom * scaleFactor) * (cropBoxWidth / img.naturalWidth);
    const drawHeight = (img.naturalHeight * zoom * scaleFactor) * (cropBoxWidth / img.naturalWidth);

    ctx.drawImage(
      img,
      (offset.x * scaleFactor) - (drawWidth / 2),
      (offset.y * scaleFactor) - (drawHeight / 2),
      drawWidth,
      drawHeight
    );

    ctx.restore();

    try {
      const resultBase64 = canvas.toDataURL('image/jpeg', 0.85);
      onCropComplete(resultBase64);
      onClose();
    } catch (err) {
      console.error('Failed to crop image:', err);
      alert('裁剪图片失败，请重试');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl max-w-sm w-full p-5 shadow-2xl flex flex-col space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <span>{title}</span>
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Interactive Crop Viewport Area */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          className="relative w-full aspect-square bg-slate-50 rounded-2xl overflow-hidden cursor-move flex items-center justify-center border border-slate-200"
        >
          {/* Image Layer */}
          <div
            className="absolute transition-transform duration-75"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`
            }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop target"
              className="max-w-none max-h-none pointer-events-none select-none"
              style={{ maxHeight: '280px', maxWidth: '280px' }}
              crossOrigin="anonymous"
            />
          </div>

          {/* Mask Overlay with 1x1 Square Cutout */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Outer Dark Mask */}
            <div className="w-full h-full border-[32px] border-black/60 rounded-2xl flex items-center justify-center">
              {/* 1x1 Frame Guides */}
              <div className="w-full h-full border-2 border-dashed border-amber-400/90 rounded-2xl shadow-lg relative">
                <div className="absolute top-1 left-1.5 text-[9px] font-bold text-amber-300 bg-black/60 px-1.5 py-0.5 rounded">
                  1 : 1 裁剪框
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-col space-y-3 pt-1">
          {/* Zoom Control */}
          <div className="flex items-center space-x-3 px-1">
            <ZoomOut size={16} className="text-slate-500" />
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <ZoomIn size={16} className="text-slate-500" />
          </div>

          {/* Quick Rotate & Reset Buttons */}
          <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
            >
              <RotateCw size={13} />
              <span>旋转 90°</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setRotation(0);
                setOffset({ x: 0, y: 0 });
              }}
              className="text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
            >
              重置参数
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs transition-all cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleCropSave}
            className="flex-1 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1.5"
          >
            <Check size={16} className="stroke-[3px]" />
            <span>确认裁剪并保存</span>
          </button>
        </div>
      </div>
    </div>
  );
}
