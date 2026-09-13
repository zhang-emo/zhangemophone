const fs = require('fs');
let code = fs.readFileSync('src/components/ImageCropModal.tsx', 'utf8');

// replace bg-black/80 with bg-slate-900/50 (lighter backdrop)
code = code.replace(/bg-black\/80 backdrop-blur-sm/g, 'bg-slate-900/60 backdrop-blur-sm');

// replace modal background
code = code.replace(/bg-slate-900 border border-slate-800 text-white/g, 'bg-white border border-slate-200 text-slate-800');

// header border
code = code.replace(/border-b border-slate-800/g, 'border-b border-slate-100');

// text colors
code = code.replace(/text-slate-100/g, 'text-slate-800');
code = code.replace(/hover:bg-slate-800 text-slate-400 hover:text-white/g, 'hover:bg-slate-100 text-slate-500 hover:text-slate-800');

// Image viewport container
code = code.replace(/bg-slate-950 rounded-2xl overflow-hidden cursor-move flex items-center justify-center border border-slate-800\/80/g, 'bg-slate-50 rounded-2xl overflow-hidden cursor-move flex items-center justify-center border border-slate-200');

// The zoom input
code = code.replace(/bg-slate-800 rounded-lg cursor-pointer/g, 'bg-slate-200 rounded-lg cursor-pointer');
code = code.replace(/accent-amber-400/g, 'accent-indigo-500');

// The rotate button
code = code.replace(/bg-slate-800\/80 hover:bg-slate-800 text-slate-200/g, 'bg-slate-100 hover:bg-slate-200 text-slate-700');

// Text color for zoom icons and reset button
code = code.replace(/text-slate-400/g, 'text-slate-500');
code = code.replace(/hover:text-white/g, 'hover:text-slate-900');

// Cancel button
code = code.replace(/bg-slate-800 hover:bg-slate-700 text-slate-300/g, 'bg-slate-100 hover:bg-slate-200 text-slate-600');

// Save button (keep it yellow or maybe primary button color)
// Let's keep it amber/yellow or make it dark like other main buttons
code = code.replace(/bg-amber-400 hover:bg-amber-300 text-amber-950/g, 'bg-slate-900 hover:bg-slate-800 text-white');

fs.writeFileSync('src/components/ImageCropModal.tsx', code);
