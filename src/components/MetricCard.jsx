import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function MetricCard({ title, value, change, isPositive, icon: Icon, color = 'indigo', sparklineData = [] }) {
  // Color configuration mapping
  const colorMap = {
    indigo: {
      text: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/10',
      glow: 'glow-indigo',
      line: '#6366f1',
      fill: 'rgba(99, 102, 241, 0.05)'
    },
    emerald: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/10',
      glow: 'glow-emerald',
      line: '#10b981',
      fill: 'rgba(16, 185, 129, 0.05)'
    },
    purple: {
      text: 'text-violet-400',
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/10',
      glow: 'glow-purple',
      line: '#8b5cf6',
      fill: 'rgba(139, 92, 246, 0.05)'
    }
  };

  const activeColors = colorMap[color] || colorMap.indigo;

  // Generate SVG path for sparkline
  const generateSparklinePath = (data) => {
    if (!data || data.length < 2) return '';
    const width = 120;
    const height = 40;
    const minX = 0;
    const maxX = data.length - 1;
    const minY = Math.min(...data);
    const maxY = Math.max(...data);
    const rangeY = maxY - minY === 0 ? 1 : maxY - minY;

    return data.map((val, i) => {
      const x = (i / maxX) * width;
      const y = height - ((val - minY) / rangeY) * (height - 8) - 4; // Add padding
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  const sparklinePath = generateSparklinePath(sparklineData);

  return (
    <div className={`p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl flex flex-col justify-between hover:border-zinc-700 transition-all duration-300 relative group overflow-hidden ${activeColors.glow}`}>
      
      {/* Light glow pattern inside */}
      <div className={`absolute -right-10 -top-10 w-24 h-24 rounded-full blur-3xl opacity-10 group-hover:opacity-20 transition-opacity duration-300 ${color === 'indigo' ? 'bg-indigo-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-violet-500'}`} />

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold text-zinc-400 font-sans">{title}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${activeColors.border} ${activeColors.bg}`}>
          <Icon className={`w-5 h-5 ${activeColors.text}`} />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <h3 className="text-2xl font-black text-white font-sans tracking-tight leading-none">
            {value}
          </h3>
          <div className="mt-2 flex items-center gap-1">
            <span className={`inline-flex items-center text-xs font-bold font-sans px-1.5 py-0.5 rounded
              ${isPositive 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-red-500/10 text-red-400'}`}
            >
              {isPositive ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
              {change}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium font-sans">vs. mes ant.</span>
          </div>
        </div>

        {/* Sparkline Graphic */}
        {sparklineData.length > 0 && (
          <div className="w-[120px] h-[40px] opacity-75 group-hover:opacity-100 transition-opacity duration-300 self-end mb-1">
            <svg viewBox="0 0 120 40" className="w-full h-full overflow-visible">
              {/* Path Fill underneath */}
              <path
                d={`${sparklinePath} L 120 40 L 0 40 Z`}
                fill={activeColors.fill}
                stroke="none"
              />
              {/* Path Line */}
              <path
                d={sparklinePath}
                fill="none"
                stroke={activeColors.line}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
