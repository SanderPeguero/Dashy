import React, { useState, useRef } from 'react';
import { TrendingUp, Calendar, ArrowRight } from 'lucide-react';

export default function AnalyticsChart() {
  const [activeDataset, setActiveDataset] = useState('revenue'); // revenue | visits
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const datasets = {
    revenue: {
      label: 'Ingresos',
      color: '#6366f1', // Indigo
      gradientId: 'revGradient',
      data: [12200, 15300, 13400, 18200, 21200, 19800, 24500, 28300, 26100, 31000, 34500, 39200],
      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      format: (val) => `$${val.toLocaleString()}`
    },
    visits: {
      label: 'Visitas Únicas',
      color: '#10b981', // Emerald
      gradientId: 'visitGradient',
      data: [3500, 4200, 3900, 5100, 6800, 7200, 6900, 8100, 8500, 9300, 10200, 11500],
      labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
      format: (val) => `${val.toLocaleString()} visitas`
    }
  };

  const activeData = datasets[activeDataset];
  const chartHeight = 220;
  const chartWidth = 580;
  const paddingX = 40;
  const paddingY = 20;

  const dataMax = Math.max(...activeData.data);
  const dataMin = Math.min(...activeData.data) * 0.9; // add offset below
  const yRange = dataMax - dataMin;

  // Map coordinates
  const points = activeData.data.map((val, i) => {
    const x = paddingX + (i / (activeData.data.length - 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - ((val - dataMin) / yRange) * (chartHeight - paddingY * 2);
    return { x, y, value: val, label: activeData.labels[i] };
  });

  // SVG paths
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`;

  // Handle cursor tracking
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Find closest data point
    let closestIndex = 0;
    let minDistance = Infinity;

    points.forEach((p, idx) => {
      const distance = Math.abs(p.x - mouseX);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = idx;
      }
    });

    setHoveredIndex(closestIndex);
    
    // Position tooltip relative to container
    setTooltipPos({
      x: points[closestIndex].x,
      y: points[closestIndex].y - 12
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  // Generate grid values for Y axis
  const gridCount = 4;
  const yGridValues = Array.from({ length: gridCount }).map((_, i) => {
    const val = dataMin + (i / (gridCount - 1)) * yRange;
    const y = chartHeight - paddingY - (i / (gridCount - 1)) * (chartHeight - paddingY * 2);
    return { val, y };
  });

  return (
    <div className="p-6 bg-[#121214]/60 backdrop-blur-xl border border-[#222226] rounded-2xl glow-indigo hover:border-zinc-700 transition-all duration-300 flex flex-col justify-between h-[360px] overflow-hidden">
      
      {/* Header of Chart */}
      <div className="flex items-center justify-between border-b border-[#222226] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/15">
              Rendimiento
            </span>
            <span className="text-xs text-zinc-500 font-medium flex items-center gap-1 font-sans">
              <Calendar className="w-3.5 h-3.5" /> Anual
            </span>
          </div>
          <h3 className="text-lg font-bold text-white font-sans mt-1">Tendencias de Rendimiento</h3>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-[#18181b] border border-[#222226] p-1 rounded-xl">
          <button
            onClick={() => setActiveDataset('revenue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer
              ${activeDataset === 'revenue' 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20' 
                : 'text-zinc-400 hover:text-white'}`}
          >
            Ingresos
          </button>
          <button
            onClick={() => setActiveDataset('visits')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold font-sans transition-all cursor-pointer
              ${activeDataset === 'visits' 
                ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' 
                : 'text-zinc-400 hover:text-white'}`}
          >
            Visitas
          </button>
        </div>
      </div>

      {/* SVG Container */}
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative flex-1 mt-4 cursor-crosshair select-none"
      >
        <svg 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
          className="w-full h-full overflow-visible"
        >
          {/* Gradients */}
          <defs>
            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.00"/>
            </linearGradient>
            <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25"/>
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0"/>
            </linearGradient>
          </defs>

          {/* Grid lines (horizontal) */}
          {yGridValues.map((g, i) => (
            <g key={i}>
              <line
                x1={paddingX}
                y1={g.y}
                x2={chartWidth - paddingX}
                y2={g.y}
                stroke="#222226"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={paddingX - 10}
                y={g.y + 4}
                fill="#71717a"
                fontSize="10"
                textAnchor="end"
                fontFamily="sans-serif"
                fontWeight="500"
              >
                {activeDataset === 'revenue' 
                  ? `$${Math.round(g.val / 1000)}k` 
                  : Math.round(g.val).toLocaleString()}
              </text>
            </g>
          ))}

          {/* Vertical cursor guideline */}
          {hoveredIndex !== null && (
            <line
              x1={points[hoveredIndex].x}
              y1={paddingY}
              x2={points[hoveredIndex].x}
              y2={chartHeight - paddingY}
              stroke="#3f3f46"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
          )}

          {/* Gradient Area */}
          <path
            d={areaPath}
            fill={`url(#${activeData.gradientId})`}
            className="transition-all duration-500 ease-in-out"
          />

          {/* Outline Line */}
          <path
            d={linePath}
            fill="none"
            stroke={activeData.color}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-500 ease-in-out"
          />

          {/* Horizontal Labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={chartHeight - 4}
              fill={hoveredIndex === i ? '#ffffff' : '#71717a'}
              fontSize="10"
              fontWeight={hoveredIndex === i ? 'bold' : '500'}
              textAnchor="middle"
              className="transition-colors duration-150"
            >
              {p.label}
            </text>
          ))}

          {/* Interactivity Dots */}
          {points.map((p, i) => {
            const isHovered = hoveredIndex === i;
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={isHovered ? 6 : 4}
                fill="#121214"
                stroke={isHovered ? '#ffffff' : activeData.color}
                strokeWidth={isHovered ? 3 : 2}
                className="transition-all duration-150"
              />
            );
          })}
        </svg>

        {/* Tooltip Overlay */}
        {hoveredIndex !== null && (
          <div 
            className="absolute z-10 p-3 bg-zinc-950 border border-zinc-800 rounded-xl shadow-xl flex flex-col pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all duration-100 ease-out"
            style={{ 
              left: `${(tooltipPos.x / chartWidth) * 100}%`, 
              top: `${(tooltipPos.y / chartHeight) * 100}%` 
            }}
          >
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider font-sans">
              {points[hoveredIndex].label}
            </span>
            <span className="text-sm font-black text-white mt-0.5 font-sans">
              {activeData.format(points[hoveredIndex].value)}
            </span>
            <span className="text-[9px] text-emerald-400 font-semibold flex items-center mt-1 font-sans">
              <TrendingUp className="w-2.5 h-2.5 mr-0.5" /> +8.4% de tendencia
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
