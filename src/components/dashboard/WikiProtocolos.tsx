"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ChevronDown, ChevronRight, BookOpen, Shield, Phone,
    AlertTriangle, AlertCircle, Info, HelpCircle, Users
} from "lucide-react";
import { INCIDENT_PROTOCOL } from "@/lib/onboardingConfig";
import { toast } from "sonner";

// ===== REAL MEDIASTREAM PROTOCOL DATA =====

const TICKET_CLASSIFICATIONS = [
    {
        color: "red",
        priority: 1,
        owner: "Mediastream",
        situations: [
            "Señal Live, Live Editor, Publicidad o VMS con caída completa",
            "Todas las señales live caídas de clientes Mediastream",
            "Ningún cliente puede hacer upload de medias",
            "Señal Live caída en evento importante (partido de fútbol, elecciones, noticia importante)",
            "OTT caída",
            "Problemas con Restreaming de varios clientes",
        ],
        escalateAfter: "Inmediato (0-5 min dependiendo del caso)",
        methods: ["1. Slack", "2. Teléfono"],
        note: "Notificar inmediatamente cuando hay cliente en rojo. Alertar cuando no hay solución.",
    },
    {
        color: "yellow",
        priority: 2,
        owner: "Mediastream",
        situations: [
            "Falla en proveedor de pago P2P/Stripe (a más de 3 días de un partido importante). Verificar: status.stripe.com / status.placetopay.com",
            "Incidencias menores en clientes tipo C que NO afecten señales live, VOD, publicidad, analíticas o pagos",
            "Incidencias en entornos no productivos (ej: ambiente DEV caído)",
        ],
        escalateAfter: "Solo en horario hábil (Lun–Vie, 9:00–19:00 SCL)",
        methods: ["Slack"],
        note: "Validar que existe incidencia por parte del equipo. Intentar resolver con la base de conocimiento antes de escalar.",
    },
    {
        color: "blue",
        priority: 3,
        owner: "Cliente",
        situations: [
            "Problema propio del cliente en su entorno o infraestructura",
        ],
        escalateAfter: "Cuando hay certeza absoluta que es problema del cliente (tras revisar docs internas y consultar al equipo)",
        methods: ["Slack: #dudas_soporte"],
        note: "Nunca decirle al cliente que el problema es suyo sin certeza absoluta. Si no se puede demostrar, escalar a #dudas_soporte y documentar.",
    },
    {
        color: "green",
        priority: 3,
        owner: "Mediastream",
        situations: [
            "Consulta de cliente sobre servicios o nuevos features",
        ],
        escalateAfter: "Cuando no puedo resolver revisando docs internas y preguntando al equipo",
        methods: ["Slack: #dudas_soporte"],
        note: "Resolver dentro del equipo con la base de conocimiento (Confluence). Quien consulta debe documentar para evitar escalar en el futuro.",
    },
];

const ESCALATION_BY_CLIENT_TYPE = [
    { type: "Tipo A", rule: "Apenas pase a Rojo" },
    { type: "Tipo B", rule: "Cuando pasa a Rojo y han pasado más de 10 minutos sin solución" },
    { type: "Tipo C", rule: "Cuando pasa a Rojo y han pasado más de 15 minutos sin solución" },
];

const ESCALATION_CHAIN = [
    {
        level: 1,
        management: "Comenzar con @Dario por canal #platform_clientes. Si en 2 min no responde → llamar al celular. Esperar 2 min y si no hay respuesta → escalar.",
        technical: "Por #platform_clientes, mención al líder del equipo del producto fallando:\n• Sistemas/CDN → Guardia Sistemas (Nico/Gonzalo) — correo guardia. Si en 5 min no responden → llamar.\n• OTT → Alejandro Jil +56 9 77081635, fallback Fernando Cheong\n• Platform → Carlos Ruiz, fallback Marco Godoy\n• Analíticas → Javiera Mella +56 9 56693750",
    },
    {
        level: 2,
        management: "Si Dario no responde → @fcheong. Si en 2 min no responde → llamar al celular.",
        technical: "Se escala a Fernando Cheong por Slack y posterior al celular: +1 786 907 0761",
    },
    {
        level: 3,
        management: "Si Fernando no responde → @lucho. Si en 2 min no responde → llamar al celular.",
        technical: "Si escala 2 no responde → contactar @lucho y posterior al celular: +1 786 569 4141",
    },
];

const CONTACTS = [
    { name: "Marco Godoy", team: "Platform", phone: "+56 971 030 481" },
    { name: "Fernando Cheong", team: "General", phone: "+1 786 907 0761" },
    { name: "Guardia Sistemas", team: "Sistemas", phone: "+56 968 487 666" },
    { name: "Nicolás Quiñones", team: "Sistemas", phone: "+56 969 098 380" },
    { name: "Luis Ahumada", team: "General", phone: "+1 786 569 4141" },
    { name: "Darío Castro", team: "Soporte", phone: "+57 320 961 8316" },
];

// ===== UI HELPERS =====

const COLOR_MAP = {
    red: {
        badge: "bg-destructive/15 text-destructive border-destructive/30",
        header: "border-l-2 border-destructive",
        dot: "bg-destructive",
        label: "🔴 ROJO — P1",
    },
    yellow: {
        badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        header: "border-l-2 border-amber-500",
        dot: "bg-amber-500",
        label: "🟡 AMARILLO — P2",
    },
    blue: {
        badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
        header: "border-l-2 border-blue-500",
        dot: "bg-blue-500",
        label: "🔵 AZUL — P3 (Cliente)",
    },
    green: {
        badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        header: "border-l-2 border-emerald-500",
        dot: "bg-emerald-500",
        label: "🟢 VERDE — Consulta",
    },
};

type TabType = "classification" | "escalation" | "contacts";

export function WikiProtocolos() {
    const [openIdx, setOpenIdx] = useState<number | null>(0);
    const [showIncidentGuide, setShowIncidentGuide] = useState(false);
    const [tab, setTab] = useState<TabType>("classification");

    const handleShiftHelp = () => {
        setShowIncidentGuide(true);
        toast.info("Guía de incidente crítico activada", { description: "Sigue los 3 pasos en orden." });
    };

    return (
        <Card className="card-neumorphic border-none bg-card h-full flex flex-col">
            <CardHeader className="pb-2 px-4 shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-foreground">
                        <BookOpen size={14} className="text-[#9E77E5]" />
                        Protocolos Mediastream
                    </CardTitle>
                    <Button
                        size="sm"
                        onClick={handleShiftHelp}
                        className="h-7 text-[10px] px-2.5 gap-1.5 bg-gradient-to-r from-[#67AA09] to-[#9E77E5] text-white border-none hover:opacity-90 font-bold"
                    >
                        <Shield size={11} />
                        Ayuda de Turno
                    </Button>
                </div>

                {/* Tab navigation */}
                <div className="flex gap-1 mt-2">
                    {([
                        { id: "classification", label: "Clasificación", icon: AlertTriangle },
                        { id: "escalation", label: "Escalamiento", icon: AlertCircle },
                        { id: "contacts", label: "Contactos", icon: Phone },
                    ] as const).map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg border transition-all ${tab === id
                                    ? "bg-[#9E77E5]/15 text-[#9E77E5] border-[#9E77E5]/30"
                                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                                }`}
                        >
                            <Icon size={9} />
                            {label}
                        </button>
                    ))}
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 flex-1 overflow-hidden flex flex-col gap-2">
                {/* Incident guide panel */}
                {showIncidentGuide && (
                    <div className="rounded-xl border border-[#67AA09]/30 bg-[#67AA09]/5 p-3 space-y-2 shrink-0">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-black text-[#67AA09] uppercase tracking-wider">⚡ Guía: Incidente Crítico — 3 pasos</p>
                            <button onClick={() => setShowIncidentGuide(false)} className="text-[9px] text-muted-foreground hover:text-foreground">✕</button>
                        </div>
                        {INCIDENT_PROTOCOL.map((step) => (
                            <div key={step.step} className="flex gap-2">
                                <span className="text-[10px] font-black text-[#67AA09] shrink-0">{step.step}.</span>
                                <div>
                                    <p className="text-[10px] font-bold text-foreground">{step.action}</p>
                                    <p className="text-[9px] text-muted-foreground">{step.detail}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <ScrollArea className="flex-1">
                    <div className="space-y-2 pr-1">

                        {/* === CLASSIFICATION TAB === */}
                        {tab === "classification" && TICKET_CLASSIFICATIONS.map((cls, i) => {
                            const style = COLOR_MAP[cls.color as keyof typeof COLOR_MAP];
                            const isOpen = openIdx === i;
                            return (
                                <div key={i} className={`rounded-xl border overflow-hidden ${isOpen ? "border-[#9E77E5]/20" : "border-border"}`}>
                                    <button
                                        onClick={() => setOpenIdx(isOpen ? null : i)}
                                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors ${style.header}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`h-2 w-2 rounded-full shrink-0 ${style.dot}`} />
                                            <span className="text-[10px] font-bold text-foreground">{style.label}</span>
                                            <Badge className={`text-[7px] h-4 px-1 border ${style.badge}`}>
                                                Owner: {cls.owner}
                                            </Badge>
                                        </div>
                                        {isOpen ? <ChevronDown size={11} className="text-muted-foreground shrink-0" /> : <ChevronRight size={11} className="text-muted-foreground shrink-0" />}
                                    </button>

                                    {isOpen && (
                                        <div className="px-3 pb-3 pt-2 border-t border-border/50 bg-muted/5 space-y-2 animate-in slide-in-from-top-1">
                                            <div>
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">Situaciones</p>
                                                <ul className="space-y-1">
                                                    {cls.situations.map((s, j) => (
                                                        <li key={j} className="flex gap-1.5 text-[10px]">
                                                            <span className="shrink-0 text-[#9E77E5] font-bold">•</span>
                                                            <span className="text-foreground/80">{s}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                                                <div>
                                                    <p className="text-[8px] font-black text-muted-foreground uppercase mb-0.5">¿Cuándo escalar?</p>
                                                    <p className="text-[9px] text-foreground">{cls.escalateAfter}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-black text-muted-foreground uppercase mb-0.5">Método</p>
                                                    {cls.methods.map((m, k) => (
                                                        <p key={k} className="text-[9px] font-bold text-foreground">{m}</p>
                                                    ))}
                                                </div>
                                            </div>
                                            {cls.note && (
                                                <div className="flex gap-1.5 text-[9px] bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
                                                    <Info size={10} className="text-amber-500 shrink-0 mt-0.5" />
                                                    <span className="text-foreground/70">{cls.note}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* === ESCALATION TAB === */}
                        {tab === "escalation" && (
                            <div className="space-y-3">
                                <div>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1.5">Criterio por Tipo de Cliente</p>
                                    <div className="space-y-1.5">
                                        {ESCALATION_BY_CLIENT_TYPE.map((e) => (
                                            <div key={e.type} className="flex items-start gap-2 p-2 rounded-lg border border-border bg-muted/20">
                                                <Badge className="text-[8px] h-5 px-1.5 bg-[#9E77E5]/15 text-[#9E77E5] border-[#9E77E5]/20 shrink-0 font-bold">
                                                    {e.type}
                                                </Badge>
                                                <span className="text-[10px] text-foreground">{e.rule}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1.5">Cadena de Escalamiento</p>
                                    <div className="space-y-2">
                                        {ESCALATION_CHAIN.map((e) => (
                                            <div key={e.level} className={`p-2.5 rounded-xl border ${e.level === 1 ? "border-destructive/20 bg-destructive/5" : e.level === 2 ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-muted/20"}`}>
                                                <p className="text-[9px] font-black uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                                    <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-black text-white ${e.level === 1 ? "bg-destructive" : e.level === 2 ? "bg-amber-500" : "bg-muted-foreground"}`}>
                                                        {e.level}
                                                    </span>
                                                    Escala {e.level}
                                                </p>
                                                <p className="text-[9px] text-muted-foreground font-bold mb-0.5">Manejo de cliente:</p>
                                                <p className="text-[9px] text-foreground/80 mb-1.5">{e.management}</p>
                                                <p className="text-[9px] text-muted-foreground font-bold mb-0.5">Solución técnica:</p>
                                                <p className="text-[9px] text-foreground/80 whitespace-pre-line">{e.technical}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === CONTACTS TAB === */}
                        {tab === "contacts" && (
                            <div className="space-y-1.5">
                                {CONTACTS.map((c) => (
                                    <div key={c.name} className="flex items-center justify-between p-2.5 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                                        <div>
                                            <p className="text-[11px] font-bold text-foreground">{c.name}</p>
                                            <Badge className="text-[8px] h-4 px-1.5 bg-[#9E77E5]/10 text-[#9E77E5] border-none">{c.team}</Badge>
                                        </div>
                                        <a
                                            href={`tel:${c.phone.replace(/\s/g, "")}`}
                                            className="flex items-center gap-1.5 text-[10px] font-bold text-foreground hover:text-primary transition-colors"
                                        >
                                            <Phone size={11} className="text-muted-foreground" />
                                            {c.phone}
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
