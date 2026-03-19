"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface DayData {
  date: string;  // "2026-03-11"
  volume: number;
  frt: number;   // seconds
  csat: number;
}

interface Props {
  data: DayData[];
  volumeTrend?: number; // % WoW change
  frtTrend?: number;
}

const DAY_LABELS: Record<string, string> = {
  "0": "Dom", "1": "Lun", "2": "Mar", "3": "Mié",
  "4": "Jue", "5": "Vie", "6": "Sáb",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return DAY_LABELS[d.getDay().toString()] ?? dateStr.slice(5);
}

export function EfficiencyChart({ data, volumeTrend, frtTrend }: Props) {
  const chartData = data.map((d) => ({
    day: formatDate(d.date),
    recibidos: d.volume,
    frtMin: d.frt > 0 ? Math.round(d.frt / 60) : 0,
  }));

  const totalReceived = data.reduce((s, d) => s + d.volume, 0);
  const avgFrt = data.length > 0
    ? Math.round(data.reduce((s, d) => s + d.frt, 0) / data.length / 60)
    : 0;

  const trendLabel = volumeTrend !== undefined
    ? `${volumeTrend >= 0 ? "+" : ""}${volumeTrend.toFixed(1)}% volumen`
    : null;
  const trendPositive = (volumeTrend ?? 0) <= 0; // less volume = better for support load

  return (
    <Card className="overflow-x-auto">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground tracking-tight uppercase">
              Eficiencia Semanal
            </CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">
              Tickets recibidos por día · FRT promedio (min)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {avgFrt > 0 && (
              <Badge className="bg-secondary/10 text-secondary border-none text-[10px] px-2 py-0">
                FRT avg {avgFrt}m
              </Badge>
            )}
            {trendLabel && (
              <Badge
                className={`border-none text-[10px] px-2 py-0 ${
                  trendPositive
                    ? "bg-success/10 text-success"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {trendLabel}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-[11px] text-muted-foreground">
            Sin datos de métricas aún. Espera la primera sincronización con Intercom.
          </div>
        ) : (
          <div className="h-[200px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  dy={8}
                />
                {/* Left Y: ticket volume */}
                <YAxis
                  yAxisId="vol"
                  orientation="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  width={28}
                />
                {/* Right Y: FRT in minutes */}
                <YAxis
                  yAxisId="frt"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  width={28}
                  unit="m"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: "var(--popover-foreground)",
                  }}
                  formatter={(value: number, name: string) =>
                    name === "FRT (min)" ? [`${value} min`, name] : [value, name]
                  }
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ fontSize: "10px", paddingBottom: "12px" }}
                />
                <Bar
                  yAxisId="vol"
                  dataKey="recibidos"
                  name="Recibidos"
                  fill="#9E77E5"
                  radius={[4, 4, 0, 0]}
                  opacity={0.85}
                  maxBarSize={32}
                />
                <Line
                  yAxisId="frt"
                  type="monotone"
                  dataKey="frtMin"
                  name="FRT (min)"
                  stroke="#67AA09"
                  strokeWidth={2.5}
                  dot={{ fill: "#67AA09", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
