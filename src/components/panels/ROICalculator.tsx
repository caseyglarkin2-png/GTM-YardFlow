import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from "recharts";
import { useROICalculator } from "@/hooks/useROICalculator";
import { ROI_DEFAULTS } from "@/config/roiDefaults";

const ROICalculator = () => {
  const {
    facilities,
    setFacilities,
    marginPerFacility,
    setMarginPerFacility,
    networkEfficiencyGain,
    setNetworkEfficiencyGain,
    chartData: data,
    totalROI,
    resetToDefaults
  } = useROICalculator();

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val}`;
  };

  return (
    <Card className="w-full max-w-4xl bg-slate-50">
      <CardHeader>
        <CardTitle className="text-2xl font-bold flex justify-between items-center">
          <span>YardFlow Value Logic</span>
          <span className="text-emerald-600 text-3xl">
            {formatCurrency(totalROI)} <span className="text-sm text-slate-500 font-normal">/ yr</span>
          </span>
          <button 
            onClick={resetToDefaults}
            className="text-xs text-slate-400 font-normal hover:text-slate-600 underline ml-4"
          >
            Reset
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-700">
              Facility Network Size
            </label>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-slate-800 w-16">{facilities}</span>
              <Slider
                value={[facilities]}
                onValueChange={(vals) => setFacilities(vals[0])}
                min={ROI_DEFAULTS.LIMITS.FACILITIES.MIN}
                max={ROI_DEFAULTS.LIMITS.FACILITIES.MAX}
                step={ROI_DEFAULTS.LIMITS.FACILITIES.STEP}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-slate-500">Distribution Centers / Plants</p>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-700">
              Avg. Margin / Facility
            </label>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-slate-800 w-20">
                {formatCurrency(marginPerFacility)}
              </span>
              <Slider
                value={[marginPerFacility]}
                onValueChange={(vals) => setMarginPerFacility(vals[0])}
                min={ROI_DEFAULTS.LIMITS.MARGIN.MIN}
                max={ROI_DEFAULTS.LIMITS.MARGIN.MAX}
                step={ROI_DEFAULTS.LIMITS.MARGIN.STEP}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-slate-500">Revenue - COGS per site</p>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-700">
              Network Efficiency Gain
            </label>
            <div className="flex items-center gap-4">
              <span className="text-2xl font-bold text-blue-600 w-16">
                {networkEfficiencyGain}%
              </span>
              <Slider
                value={[networkEfficiencyGain]}
                onValueChange={(vals) => setNetworkEfficiencyGain(vals[0])}
                min={ROI_DEFAULTS.LIMITS.EFFICIENCY.MIN}
                max={ROI_DEFAULTS.LIMITS.EFFICIENCY.MAX}
                step={ROI_DEFAULTS.LIMITS.EFFICIENCY.STEP}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-slate-500">Volume throughput increase</p>
          </div>
        </div>

        {/* Visualizer */}
        <div className="h-96 w-full mt-8">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <XAxis type="number" tickFormatter={formatCurrency} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: any) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={40}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Narrative */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-center">
          {data.map((item, idx) => (
            <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-100">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">{item.name}</div>
              <div className="font-semibold text-slate-700">{formatCurrency(item.value)}</div>
              <div className="text-xs text-slate-400 mt-1 italic">{item.description}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ROICalculator;
