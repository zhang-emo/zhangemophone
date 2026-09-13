import React, { useState, useRef, useEffect } from 'react';
import { X, Check, RotateCw, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface FreeCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedBase64: string) => void;
  title?: string;
}

export default function FreeCropModal({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
  title = '自由裁剪图片'
}: FreeCropModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Crop rectangle percentages relative to viewport container (0-100)
  const [cropRect, setCropRect] = useState({ left: 10, top: 10, right: 90, bottom: 90 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [handleStart, setHandleStart] = useState({ x: 0, y: 0, rect: { left: 10, top: 10, right: 90, bottom: 90 } });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      setCropRect({ left: 5, top: 5, right: 95, bottom: 95 });
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  // Handle Image Pan
  const handleImageMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (activeHandle) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDraggingImage(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (activeHandle && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPercent = ((clientX - handleStart.x) / rect.width) * 100;
      const deltaYPercent = ((clientY - handleStart.y) / rect.height) * 100;

      const newRect = { ...handleStart.rect };
      const minGap = 10; // minimum gap in %

      if (activeHandle.includes('n')) {
        newRect.top = Math.min(Math.max(0, handleStart.rect.top + deltaYPercent), handleStart.rect.bottom - minGap);
      }
      if (activeHandle.includes('s')) {
        newRect.bottom = Math.max(Math.min(100, handleStart.rect.bottom + deltaYPercent), handleStart.rect.top + minGap);
      }
      if (activeHandle.includes('w')) {
        newRect.left = Math.min(Math.max(0, handleStart.rect.left + deltaXPercent), handleStart.rect.right - minGap);
      }
      if (activeHandle.includes('e')) {
        newRect.right = Math.max(Math.min(100, handleStart.rect.right + deltaXPercent), handleStart.rect.left + minGap);
      }

      setCropRect(newRect);
      return;
    }

    if (isDraggingImage) {
      setOffset({
        x: clientX - dragStart.x,
        y: clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingImage(false);
    setActiveHandle(null);
  };

  const startHandleDrag = (handle: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setActiveHandle(handle);
    setHandleStart({
      x: clientX,
      y: clientY,
      rect: { ...cropRect }
    });
  };

  const handleCropSave = () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const containerRect = container.getBoundingClientRect();

    // Size of the crop box in pixels inside viewport
    const boxW = ((cropRect.right - cropRect.left) / 100) * containerRect.width;
    const boxH = ((cropRect.bottom - cropRect.top) / 100) * containerRect.height;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(100, Math.round(boxW * 2));
    canvas.height = Math.max(100, Math.round(boxH * 2));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render original image scaled and moved to align with crop box
    const boxCenterX = (cropRect.left + (cropRect.right - cropRect.left) / 2) / 100 * containerRect.width;
    const boxCenterY = (cropRect.top + (cropRect.bottom - cropRect.top) / 2) / 100 * containerRect.height;

    const scaleFactor = canvas.width / boxW;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);

    const imgDisplayWidth = containerRect.width * zoom;
    const imgDisplayHeight = containerRect.height * zoom;

    // Center of container relative to box center
    const imgOffsetX = (containerRect.width / 2 + offset.x - boxCenterX) * scaleFactor;
    const imgOffsetY = (containerRect.height / 2 + offset.y - boxCenterY) * scaleFactor;

    const drawW = imgDisplayWidth * scaleFactor;
    const drawH = imgDisplayHeight * scaleFactor;

    ctx.drawImage(
      img,
      imgOffsetX - drawW / 2,
      imgOffsetY - drawH / 2,
      drawW,
      drawH
    );

    ctx.restore();

    try {
      const resultBase64 = canvas.toDataURL('image/jpeg', 0.9);
      onCropComplete(resultBase64);
      onClose();
    } catch (err) {
      console.error('Failed to save cropped image:', err);
      alert('裁剪保存失败');
    }
  };

  return (
    <div className="fixed inset-0 z-[1020] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fade-in">
      <div className="bg-white border border-slate-200 text-slate-800 rounded-3xl max-w-lg w-full p-5 shadow-2xl flex flex-col space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center pb-2 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <span>{title}</span>
            <span className="text-[10px] bg-amber-400/20 text-amber-300 font-normal px-2 py-0.5 rounded-full border border-amber-400/30">
              自由宽高比
            </span>
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Viewport Area */}
        <div
          ref={containerRef}
          onMouseDown={handleImageMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleImageMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
          className="relative w-full aspect-[4/3] bg-slate-50 rounded-2xl overflow-hidden cursor-move flex items-center justify-center border border-slate-200"
        >
          {/* Image Layer */}
          <div
            className="absolute transition-transform duration-75 flex items-center justify-center w-full h-full"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`
            }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop target"
              className="max-w-full max-h-full object-contain pointer-events-none select-none"
              crossOrigin="anonymous"
            />
          </div>

          {/* Mask Overlay */}
          <div className="absolute inset-0 pointer-events-none bg-black/50">
            {/* Cutout Area (Clear view) */}
            <div
              className="absolute bg-transparent shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] border-2 border-amber-400 pointer-events-auto"
              style={{
                left: `${cropRect.left}%`,
                top: `${cropRect.top}%`,
                right: `${100 - cropRect.right}%`,
                bottom: `${100 - cropRect.bottom}%`
              }}
            >
              {/* Corner Handles */}
              <div
                onMouseDown={(e) => startHandleDrag('nw', e)}
                onTouchStart={(e) => startHandleDrag('nw', e)}
                className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-amber-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md"
              />
              <div
                onMouseDown={(e) => startHandleDrag('ne', e)}
                onTouchStart={(e) => startHandleDrag('ne', e)}
                className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-amber-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md"
              />
              <div
                onMouseDown={(e) => startHandleDrag('sw', e)}
                onTouchStart={(e) => startHandleDrag('sw', e)}
                className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-amber-400 border-2 border-white rounded-full cursor-nesw-resize shadow-md"
              />
              <div
                onMouseDown={(e) => startHandleDrag('se', e)}
                onTouchStart={(e) => startHandleDrag('se', e)}
                className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-amber-400 border-2 border-white rounded-full cursor-nwse-resize shadow-md"
              />

              {/* Edge Handles */}
              <div
                onMouseDown={(e) => startHandleDrag('n', e)}
                onTouchStart={(e) => startHandleDrag('n', e)}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-400/80 rounded-full cursor-ns-resize"
              />
              <div
                onMouseDown={(e) => startHandleDrag('s', e)}
                onTouchStart={(e) => startHandleDrag('s', e)}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-8 h-3 bg-amber-400/80 rounded-full cursor-ns-resize"
              />
              <div
                onMouseDown={(e) => startHandleDrag('w', e)}
                onTouchStart={(e) => startHandleDrag('w', e)}
                className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-8 bg-amber-400/80 rounded-full cursor-ew-resize"
              />
              <div
                onMouseDown={(e) => startHandleDrag('e', e)}
                onTouchStart={(e) => startHandleDrag('e', e)}
                className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-8 bg-amber-400/80 rounded-full cursor-ew-resize"
              />

              {/* Grid Lines inside crop area */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30 border border-white/50">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col space-y-2 pt-1">
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
                setCropRect({ left: 5, top: 5, right: 95, bottom: 95 });
              }}
              className="flex items-center space-x-1 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>重置全选</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex space-x-3 pt-2 border-t border-slate-800">
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
            <span>确认裁剪图片</span>
          </button>
        </div>
      </div>
    </div>
  );
}
