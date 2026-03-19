/**
 * Lista canónica de módulos del sistema.
 * Usada en: Sidebar, middleware, admin de permisos.
 * Los admins siempre tienen acceso a todo — los permisos solo aplican a rol USER.
 */
export const MODULES = [
  { href: "/",           label: "Dashboard" },
  { href: "/chat",       label: "Chat Proxy" },
  { href: "/reports",    label: "Reportes" },
  { href: "/clients",    label: "CS Intelligence" },
  { href: "/tracking",   label: "Seguimiento Semanal" },
  { href: "/roadmap",    label: "Roadmap · OKRs" },
  { href: "/shifts",     label: "Turnos" },
  { href: "/events",     label: "Calendario" },
  { href: "/handovers",  label: "Entregas de Turno" },
  { href: "/knowledge",  label: "Base de Conocimiento" },
  { href: "/ai-config",  label: "Config IA" },
] as const;

export type ModuleHref = typeof MODULES[number]["href"];
