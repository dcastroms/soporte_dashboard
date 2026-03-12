"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface RoadmapDonutProps {
    progress: number;
}

export function RoadmapDonut({ progress }: RoadmapDonutProps) {
    const data = [
        { value: progress, color: '#67AA09' },
        { value: 100 - progress, color: 'var(--muted)' }
    ];

    return (
        <div className="h-20 w-20 relative shrink-0">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={38}
                        startAngle={90}
                        endAngle={450}
                        dataKey="value"
                        stroke="none"
                    >
                        <Cell fill="#67AA09" />
                        <Cell fill="var(--muted)" />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-foreground">{progress}%</span>
            </div>
        </div>
    );
}
