"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Trophy, Activity, AlertOctagon, Crosshair,
    TrendingUp, TrendingDown, Pencil, Check, X, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface KpiRow {
    label: string;
    current: number;
    previous: number;
    unit: string;
    inverse?: boolean;  // lower is better
}

interface WeeklyHealthProps {
    // Section 1 – Business impact (static, editable)
    initialImpacts?: string[];
    // Section 2 – Operational metrics (auto from Intercom)
    kpiRows?: KpiRow[];
    // Section 3 – Blockers (editable from dashboard)
    initialBlockers?: string[];
    // Section 4 – Next week focus (editable)
    initialFocus?: string[];
    // Week label
    weekLabel?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(current: number, previous: number): number {
    if (!previous) return 0;
    return ((current - previous) / previous) * 100;
}

function DeltaBadge({ delta, inverse }: { delta: number; inverse?: boolean }) {
    if (Math.abs(delta) < 0.5) return <span className="text-[9px] text-muted-foreground">—</span>;
    const positive = inverse ? delta < 0 : delta > 0;
    return (
        <span className={`flex items-center gap-0.5 text-[9px] font-bold ${positive ? "text-emerald-500" : "text-destructive"}`}>
            {positive ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {Math.abs(delta).toFixed(1)}%
        </span>
    );
}

function SectionHeader({ icon: Icon, title, color, expanded, onToggle }: {
    icon: any; title: string; color: string; expanded: boolean; onToggle: () => void;
}) {
    return (
        <button
            onClick={onToggle}
            className="flex items-center justify-between w-full group"
        >
            <div className="flex items-center gap-2">
                <Icon size={13} className={color} />
                <p className={`text-[10px] font-black uppercase tracking-widest ${color}`}>{title}</p>
            </div>
            {expanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
        </button>
    );
}

function EditableList({
    items, onSave, placeholder, addLabel
}: {
    items: string[]; onSave: (items: string[]) => void; placeholder: string; addLabel: string;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(items.join("\n"));

    const handleSave = () => {
        const parsed = draft.split("\n").map(s => s.trim()).filter(Boolean);
        onSave(parsed);
        setEditing(false);
        toast.success("Actualizado");
    };

    if (editing) {
        return (
            <div className="space-y-2">
                <Textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder={placeholder}
                    className="text-[10px] min-h-[80px] resize-none border-[#9E77E5]/30 focus:border-[#9E77E5]"
                    autoFocus
                />
                <div className="flex gap-1.5">
                    <Button size="sm" className="h-6 text-[9px] px-2 gap-1 bg-[#67AA09] hover:bg-[#67AA09]/80" onClick={handleSave}>
                        <Check size={9} /> Guardar
                    </Button>
                    <Button size="sm" variant="outline" className="h-6 text-[9px] px-2 gap-1" onClick={() => setEditing(false)}>
                        <X size={9} /> Cancelar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {items.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic">{placeholder}</p>
            ) : items.map((item, i) => (
                <div key={i} className="flex items-start gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-current mt-1.5 shrink-0 opacity-50" />
                    <p className="text-[10px] text-foreground leading-relaxed">{item}</p>
                </div>
            ))}
            <Button size="sm" variant="ghost" className="h-5 text-[9px] px-1 gap-1 text-muted-foreground hover:text-[#9E77E5] mt-1" onClick={() => setEditing(true)}>
                <Pencil size={9} /> {addLabel}
            </Button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WeeklyHealth({
    initialImpacts = [
        "Integración SSE en tiempo real operativa",
        "Módulo de protocolos de escalamiento publicado",
        "Notificaciones Slack automáticas en entregas de turno",
    ],
    kpiRows = [],
    initialBlockers = ["Sin bloqueos críticos esta semana"],
    initialFocus = [
        "Onboarding de nuevos agentes al dashboard",
        "Carga de macros para nueva temporada Copa del Rey",
        "Revisión de flujos de escalamiento P1",
    ],
    weekLabel,
}: WeeklyHealthProps) {

    const [impacts, setImpacts] = useState<string[]>(initialImpacts);
    const [blockers, setBlockers] = useState<string[]>(initialBlockers);
    const [focus, setFocus] = useState<string[]>(initialFocus);

    // Collapsible state per section
    const [open, setOpen] = useState({ impacts: true, metrics: true, blockers: true, focus: true });
    const toggle = (key: keyof typeof open) => setOpen(p => ({ ...p, [key]: !p[key] }));

    const week = weekLabel ?? (() => {
        const now = new Date();
        const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1);
        const end = new Date(start); end.setDate(start.getDate() + 6);
        return `${start.getDate()}/${start.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`;
    })();

    return (
        <Card className="card-neumorphic border-none">
            <CardHeader className="pb-3 px-5">
                <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                    <Activity size={14} className="text-[#67AA09]" />
                    Informe Ejecutivo Semanal
                </CardTitle>
                <CardDescription className="text-[11px]">Semana {week} · Gestión de Operaciones Mediastream</CardDescription>
            </CardHeader>

            <CardContent className="px-5 pb-5 space-y-4">

                {/* ── SECCIÓN 1: IMPACTO DE NEGOCIO ── */}
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                    <SectionHeader icon={Trophy} title="1. Impacto Semanal (Logros)" color="text-emerald-500" expanded={open.impacts} onToggle={() => toggle("impacts")} />
                    {open.impacts && (
                        <EditableList
                            items={impacts}
                            onSave={setImpacts}
                            placeholder="Escribe un logro por línea..."
                            addLabel="Agregar logro"
                        />
                    )}
                </div>

                {/* ── SECCIÓN 2: SALUD OPERATIVA ── */}
                <div className="rounded-2xl border border-[#9E77E5]/20 bg-[#9E77E5]/5 p-4 space-y-3">
                    <SectionHeader icon={Activity} title="2. Salud Operativa (Métricas)" color="text-[#9E77E5]" expanded={open.metrics} onToggle={() => toggle("metrics")} />
                    {open.metrics && (
                        kpiRows.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic">Sincroniza Intercom para ver métricas en tiempo real.</p>
                        ) : (
                            <div className="rounded-xl overflow-hidden border border-[#9E77E5]/20">
                                <div className="grid grid-cols-4 bg-[#9E77E5]/10 px-3 py-1.5 text-[8px] font-black uppercase text-muted-foreground">
                                    <span className="col-span-1">Métrica</span>
                                    <span className="text-center">Esta semana</span>
                                    <span className="text-center">Sem. anterior</span>
                                    <span className="text-center">Variación</span>
                                </div>
                                {kpiRows.map((row, i) => {
                                    const delta = pct(row.current, row.previous);
                                    return (
                                        <div key={i} className="grid grid-cols-4 px-3 py-2 border-t border-[#9E77E5]/10 text-[10px] hover:bg-[#9E77E5]/5 transition-colors">
                                            <span className="font-bold text-foreground col-span-1">{row.label}</span>
                                            <span className="text-center text-foreground">{row.current.toFixed(1)}{row.unit}</span>
                                            <span className="text-center text-muted-foreground">{row.previous.toFixed(1)}{row.unit}</span>
                                            <span className="flex justify-center"><DeltaBadge delta={delta} inverse={row.inverse} /></span>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>

                {/* ── SECCIÓN 3: BLOQUEOS CRÍTICOS ── */}
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-3">
                    <SectionHeader icon={AlertOctagon} title="3. Bloqueos Críticos (Escalaciones)" color="text-destructive" expanded={open.blockers} onToggle={() => toggle("blockers")} />
                    {open.blockers && (
                        <EditableList
                            items={blockers}
                            onSave={setBlockers}
                            placeholder="Describe un bloqueo o escalación crítica por línea..."
                            addLabel="Registrar bloqueo"
                        />
                    )}
                </div>

                {/* ── SECCIÓN 4: FOCO PRÓXIMA SEMANA ── */}
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                    <SectionHeader icon={Crosshair} title="4. Foco de la Próxima Semana" color="text-amber-600" expanded={open.focus} onToggle={() => toggle("focus")} />
                    {open.focus && (
                        <EditableList
                            items={focus}
                            onSave={setFocus}
                            placeholder="Escribe una prioridad por línea..."
                            addLabel="Agregar prioridad"
                        />
                    )}
                </div>

            </CardContent>
        </Card>
    );
}
