"use client";

import { memo } from "react";
// Removed Card import for borderless telemetry strip design
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface KpiCardProps {
    label: string;
    value: string;
    description: string;
    sparkline?: React.ReactNode;
    info?: string;
    trend?: number;
}

import { TrendingUp, TrendingDown } from "lucide-react";

export const KpiCard = memo(function KpiCard({ label, value, description, sparkline, info, trend }: KpiCardProps) {
    const isPositive = trend && trend > 0;
    const isNegative = trend && trend < 0;

    return (
        <div className="flex flex-row items-center justify-between p-4 py-3 bg-transparent transition-all duration-75 gap-4 overflow-hidden group">
            <div className="flex flex-col justify-center min-w-[120px]">
                <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">{label}</span>
                    {info && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info size={10} className="text-muted-foreground/50 cursor-help hover:text-signal transition-colors" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[200px] text-[10px] leading-tight">
                                    {info}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-mono font-bold tracking-tight text-foreground">{value}</span>
                </div>
                <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-widest mt-1 opacity-70">{description}</span>
            </div>

            <div className="flex-1 h-[40px] opacity-60 group-hover:opacity-100 transition-opacity">
                {sparkline}
            </div>

            <div className="flex flex-col items-end justify-center min-w-[60px]">
                {trend !== undefined && (
                    <div className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${isPositive ? 'text-success bg-success/10' :
                        isNegative ? 'text-destructive bg-destructive/10' :
                            'text-muted-foreground bg-muted'
                        }`}>
                        {isPositive ? <TrendingUp size={10} className="mr-0.5" /> : isNegative ? <TrendingDown size={10} className="mr-0.5" /> : null}
                        {Math.abs(trend % 100).toFixed(1)}%
                    </div>
                )}
            </div>
        </div>
    );
});
