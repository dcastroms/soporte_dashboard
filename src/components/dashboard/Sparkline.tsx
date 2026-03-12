"use client";

import {
    AreaChart,
    Area,
    ResponsiveContainer
} from 'recharts';

interface SparklineProps {
    data: any[];
    dataKey: string;
    color: string;
}

export function Sparkline({ data, dataKey, color }: SparklineProps) {
    return (
        <div className="h-[40px] w-[80px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey={dataKey}
                        stroke={color}
                        fillOpacity={1}
                        fill={`url(#color-${dataKey})`}
                        strokeWidth={2}
                        isAnimationActive={false}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
