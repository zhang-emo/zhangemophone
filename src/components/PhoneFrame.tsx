/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface PhoneFrameProps {
  children: React.ReactNode;
  title?: string;
  onBack?: () => void;
  onHome?: () => void;
  isHomeScreen?: boolean;
  isLightMode?: boolean;
}

export default function PhoneFrame({ children, title = "系统设置", onBack, onHome, isHomeScreen = false, isLightMode = false }: PhoneFrameProps) {
  return (
    <div className="flex items-center justify-center min-h-[100dvh] h-[100dvh] w-full bg-[#F3F4F6] sm:bg-[#E5E9F0] p-0 sm:px-4 sm:py-6 font-sans transition-all duration-300 overflow-hidden">
      {/* Phone Screen Container */}
      <div className={`w-full sm:max-w-[420px] h-full sm:h-[840px] flex flex-col overflow-hidden relative sm:border sm:shadow-2xl transition-all duration-500 ${
        isHomeScreen 
          ? (isLightMode 
              ? 'bg-slate-100 sm:border-slate-300/80 rounded-none sm:rounded-[36px]' 
              : 'bg-gradient-to-b from-[#131526] via-[#1C1F37] to-[#252A4A] sm:border-slate-800 rounded-none sm:rounded-[36px]')
          : 'bg-white sm:border-gray-100 rounded-none sm:rounded-[32px]'
      }`}>
        {/* Main app section (full-screen immersive) */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {children}
        </div>
      </div>
    </div>
  );
}
