const fs = require('fs');
let code = fs.readFileSync('src/components/FreeCropModal.tsx', 'utf8');

// replace bg-black/90 with bg-slate-900/60
code = code.replace(/bg-black\/90 backdrop-blur-md/g, 'bg-slate-900/60 backdrop-blur-sm');

// replace modal background
code = code.replace(/bg-slate-900 border border-slate-800 text-white/g, 'bg-white border border-slate-200 text-slate-800');
code = code.replace(/border-b border-slate-800/g, 'border-b border-slate-100');
code = code.replace(/text-slate-100/g, 'text-slate-800');
code = code.replace(/hover:bg-slate-800 text-slate-400 hover:text-white/g, 'hover:bg-slate-100 text-slate-500 hover:text-slate-800');

// Image viewport container
code = code.replace(/bg-slate-950 rounded-2xl overflow-hidden cursor-move flex items-center justify-center border border-slate-800/g, 'bg-slate-50 rounded-2xl overflow-hidden cursor-move flex items-center justify-center border border-slate-200');

// Controls
code = code.replace(/bg-slate-800 rounded-lg cursor-pointer/g, 'bg-slate-200 rounded-lg cursor-pointer');
code = code.replace(/accent-amber-400/g, 'accent-indigo-500');
code = code.replace(/bg-slate-800 hover:bg-slate-700 text-slate-200/g, 'bg-slate-100 hover:bg-slate-200 text-slate-700');
code = code.replace(/text-slate-400/g, 'text-slate-500');
code = code.replace(/hover:text-white/g, 'hover:text-slate-900');
code = code.replace(/bg-slate-800 hover:bg-slate-700 text-slate-300/g, 'bg-slate-100 hover:bg-slate-200 text-slate-600');
code = code.replace(/bg-amber-400 hover:bg-amber-300 text-amber-950/g, 'bg-slate-900 hover:bg-slate-800 text-white');
code = code.replace(/text-amber-400/g, 'text-indigo-500');

fs.writeFileSync('src/components/FreeCropModal.tsx', code);
