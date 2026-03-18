"use server";

import { prisma } from "./prisma";
import { revalidatePath } from "next/cache";

const INTERCOM_TOKEN = process.env.INTERCOM_TOKEN;
const INTERCOM_API_URL = "https://api.intercom.io";

const HEADERS = {
  "Authorization": `Bearer ${INTERCOM_TOKEN}`,
  "Accept": "application/json",
  "Content-Type": "application/json",
  "Intercom-Version": "2.11"
};


/**
 * Sincroniza datos reales de Intercom si el TOKEN existe.
 */
export async function syncIntercomData(force = false) {
  if (!INTERCOM_TOKEN) return;

  try {
    // 1. Obtener todos los admins para mapear IDs a nombres
    const adminsResp = await fetch(`${INTERCOM_API_URL}/admins`, { headers: HEADERS });
    const adminsData = await adminsResp.json();
    const adminMap: Record<string, string> = {};
    if (adminsData.admins) {
      adminsData.admins.forEach((admin: any) => {
        adminMap[admin.id] = admin.name;
      });
    }

    // 2. Fetch conversations
    const syncWindowDays = 30;
    const windowAgo = Math.floor(Date.now() / 1000) - (syncWindowDays * 24 * 60 * 60);
    
    const searchBody = {
      query: {
        operator: "AND",
        value: [
          { field: "updated_at", operator: ">", value: windowAgo }
        ]
      },
      pagination: { per_page: 150 }
    };

    const conversationsResp = await fetch(`${INTERCOM_API_URL}/conversations/search`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(searchBody)
    });

    if (!conversationsResp.ok) {
        const error = await conversationsResp.text();
        throw new Error(`Intercom API Error: ${error}`);
    }

    const conversationsData = await conversationsResp.json();
    const conversations = conversationsData.conversations || [];

    // 3. Procesar datos para agregados y persistencia individual
    const dailyMetrics: Record<string, any> = {};
    const heatmapData: Record<string, number> = {};
    const agentStats: Record<string, any> = {};
    const categoryStats: Record<string, Record<string, number>> = {
      'Client': {},
      'Module': {},
      'Type': {}
    };

    const conversationsToSave = conversations.map((conv: any, index: number) => {
      const createdAt = new Date(conv.created_at * 1000);
      const updatedAt = new Date(conv.updated_at * 1000);
      const dateKey = createdAt.toISOString().split('T')[0];
      const dayOfWeek = createdAt.getDay();
      const hour = createdAt.getHours();
      const heatmapKey = `${dayOfWeek}-${hour}`;

      // Extraer campos personalizados (Exactamente como se ve en el nuevo CSV/Imagen)
      const attrs = conv.custom_attributes || {};
      
      // Del CSV: "Clientes"
      const client = attrs['Clientes'] || attrs['Client'] || attrs['Cliente'] || conv.conversation_rating?.company?.name || null;
      
      // Del CSV: "Modulo"
      const module = attrs['Modulo'] || attrs['Module'] || attrs['Modulo'] || null;
      
      // Del CSV: "Tipo de ticket"
      const ticketType = attrs['Tipo de ticket'] || attrs['Ticket type'] || attrs['Ticket Type'] || null;

      // Agregado Diario
      if (!dailyMetrics[dateKey]) {
        dailyMetrics[dateKey] = { 
          totalVolume: 0, 
          totalFRT: 0, 
          frtCount: 0, 
          totalCSAT: 0, 
          csatCount: 0, 
          closedCount: 0,
          totalResolutionTime: 0,
          resolutionCount: 0
        };
      }
      dailyMetrics[dateKey].totalVolume++;
      if (conv.state === 'closed') dailyMetrics[dateKey].closedCount++;
      
      const stats = conv.statistics;
      if (stats?.first_admin_reply_at) {
        const frt = stats.first_admin_reply_at - conv.created_at;
        dailyMetrics[dateKey].totalFRT += frt;
        dailyMetrics[dateKey].frtCount++;
      }

      // Resolution Time
      if (conv.state === 'closed' && stats?.last_close_at) {
        const resTime = stats.last_close_at - conv.created_at;
        dailyMetrics[dateKey].totalResolutionTime += resTime;
        dailyMetrics[dateKey].resolutionCount++;
      }

      const rating = stats?.rating;
      if (rating) {
        dailyMetrics[dateKey].totalCSAT += rating;
        dailyMetrics[dateKey].csatCount++;
      }

      // Mapa de Calor
      heatmapData[heatmapKey] = (heatmapData[heatmapKey] || 0) + 1;

      // Categorías
      if (client) categoryStats['Client'][client] = (categoryStats['Client'][client] || 0) + 1;
      if (module) categoryStats['Module'][module] = (categoryStats['Module'][module] || 0) + 1;
      if (ticketType) categoryStats['Type'][ticketType] = (categoryStats['Type'][ticketType] || 0) + 1;

      // Estadísticas por Agente
      const agentId = conv.admin_assignee_id ? String(conv.admin_assignee_id) : null;
      if (agentId) {
        if (!agentStats[agentId]) {
          agentStats[agentId] = { totalSolved: 0, totalRT: 0, rtCount: 0, totalCSAT: 0, csatCount: 0 };
        }
        if (conv.state === 'closed') agentStats[agentId].totalSolved++;
        if (stats?.first_admin_reply_at) {
            const rt = stats.first_admin_reply_at - conv.created_at;
            agentStats[agentId].totalRT += rt;
            agentStats[agentId].rtCount++;
        }
        if (rating) {
            agentStats[agentId].totalCSAT += rating;
            agentStats[agentId].csatCount++;
        }
      }

      return {
        intercomId: String(conv.id),
        subject: conv.source?.subject || "Sin asunto",
        status: conv.state,
        createdAt,
        updatedAt,
        teammateId: agentId,
        teammateName: (agentId && adminMap[agentId]) || null,
        tags: conv.tags?.tags?.map((t: any) => t.name) || [],
        priority: conv.priority || null,
        firstResponseTime: stats?.first_admin_reply_at ? (stats.first_admin_reply_at - conv.created_at) : null,
        client,
        module,
        ticketType
      };
    });

    // 4. Guardar en Base de Datos en una transacción atómica
    // Si cualquier operación falla, se hace rollback completo (requiere replica set en MongoDB Atlas)
    const heatmapInsert: { dayOfWeek: number; hour: number; count: number }[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmapInsert.push({ dayOfWeek: day, hour: hour, count: heatmapData[`${day}-${hour}`] || 0 });
      }
    }

    const activeDates = Object.keys(dailyMetrics).map(d => new Date(d));
    const metricsInsert = Object.entries(dailyMetrics).map(([date, m]) => ({
      date: new Date(date),
      totalVolume: m.totalVolume,
      avgFirstResponseTime: m.frtCount > 0 ? m.totalFRT / m.frtCount : null,
      closedCount: m.closedCount,
      csatAverage: m.csatCount > 0 ? parseFloat((m.totalCSAT / m.csatCount).toFixed(2)) : null,
    }));

    const categoryInsert: any[] = [];
    Object.entries(categoryStats).forEach(([category, values]) => {
      Object.entries(values).forEach(([value, count]) => {
        categoryInsert.push({ date: new Date(), category, value, count });
      });
    });

    const agentsInsert = Object.entries(agentStats).map(([id, s]) => ({
      intercomId: id,
      name: adminMap[id] || `Agente ${id}`,
      totalSolved: s.totalSolved,
      avgResponseTime: s.rtCount > 0 ? s.totalRT / s.rtCount : null,
      csatScore: s.csatCount > 0 ? parseFloat((s.totalCSAT / s.csatCount).toFixed(2)) : null
    }));

    await prisma.$transaction(async (tx) => {
      // Borrar todo primero (dentro de la transacción — si algo falla, se revierte)
      await tx.intercomConversation.deleteMany({});
      await tx.intercomMetric.deleteMany({});
      await tx.intercomCategoryMetric.deleteMany({});
      await tx.intercomAgent.deleteMany({});
      await tx.intercomHeatmap.deleteMany({});

      // Insertar datos nuevos
      await tx.intercomConversation.createMany({ data: conversationsToSave });
      await tx.intercomHeatmap.createMany({ data: heatmapInsert });
      if (metricsInsert.length > 0) {
        await tx.intercomMetric.createMany({ data: metricsInsert });
      }
      if (categoryInsert.length > 0) {
        await tx.intercomCategoryMetric.createMany({ data: categoryInsert });
      }
      if (agentsInsert.length > 0) {
        await tx.intercomAgent.createMany({ data: agentsInsert });
      }
      await tx.intercomSyncStatus.create({ data: { lastSync: new Date() } });
    });

    revalidatePath('/reports');
    revalidatePath('/');
    return { success: true, message: "Sincronización real completada con éxito" };

  } catch (error) {
    console.error("Intercom Sync Error:", error);
    return { success: false, message: "Error al sincronizar con Intercom" };
  }
}

async function generateMockIntercomData() {
  // Limpiar antes de generar mock
  await prisma.intercomMetric.deleteMany({});
  await prisma.intercomHeatmap.deleteMany({});
  await prisma.intercomAgent.deleteMany({});

  const metrics = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    metrics.push({
      date,
      totalVolume: Math.floor(Math.random() * 50) + 20,
      avgFirstResponseTime: Math.floor(Math.random() * 3600) + 600,
      medianResponseTime: Math.floor(Math.random() * 7200) + 1200,
      closedCount: Math.floor(Math.random() * 40) + 15,
      csatAverage: parseFloat((Math.random() * 1 + 4).toFixed(2)),
    });
  }

  await prisma.intercomMetric.createMany({ data: metrics });

  const heatmapData = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      let base = 2;
      if (hour >= 9 && hour <= 18) base = Math.floor(Math.random() * 15) + 10;
      else if (hour > 18 || hour < 9) base = Math.floor(Math.random() * 5);
      if (day === 0 || day === 6) base = Math.floor(base * 0.3);
      heatmapData.push({ dayOfWeek: day, hour: hour, count: base });
    }
  }
  await prisma.intercomHeatmap.createMany({ data: heatmapData });

  const agents = [
    { name: "Andrés Castro", id: "agent_1" },
    { name: "Maria Jose", id: "agent_2" },
    { name: "Carlos Ruiz", id: "agent_3" },
    { name: "Lucia Gomez", id: "agent_4" }
  ];

  const finalAgents = agents.map(agent => ({
    intercomId: agent.id,
    name: agent.name,
    totalSolved: Math.floor(Math.random() * 200) + 50,
    avgResponseTime: Math.floor(Math.random() * 1800) + 300,
    csatScore: parseFloat((Math.random() * 0.8 + 4.2).toFixed(2))
  }));

  await prisma.intercomAgent.createMany({ data: finalAgents });

  revalidatePath('/reports');
  revalidatePath('/');
  return { success: true, message: "Datos avanzados generados correctamente" };
}

export async function getIntercomMetrics(limit: number = 30, filters?: { agentId?: string; category?: string }) {
  // If no filters, return pre-calculated global metrics
  if (!filters?.agentId && !filters?.category) {
    const metrics = await prisma.intercomMetric.findMany({
      orderBy: { date: 'desc' },
      take: limit
    });
    return metrics.reverse();
  }

  // If filters exist, we must aggregate from conversations on the fly
  // Note: This is computationally more expensive but necessary for filtering
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - limit);
  startDate.setHours(0, 0, 0, 0);

  const whereClause: any = {
    createdAt: { gte: startDate }
  };

  if (filters.agentId && filters.agentId !== 'all') {
    whereClause.teammateId = filters.agentId;
  }

  // Category filtering logic (Module, Client, or Type usually)
  // We check against all 3 fields for now for flexibility
  if (filters.category && filters.category !== 'all') {
    whereClause.OR = [
        { module: filters.category },
        { client: filters.category },
        { ticketType: filters.category }
    ];
  }

  const conversations = await prisma.intercomConversation.findMany({
    where: whereClause,
    select: {
      createdAt: true,
      firstResponseTime: true,
      status: true,
      // We would need CSAT rating stored on conversation level for accurate avg
      // Assuming we can derive basic volume stats
    }
  });

  // Group by day
  const dailyMap: Record<string, any> = {};
  
  // Initialize map for all days
  for (let d = 0; d < limit; d++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d);
      const dateKey = date.toISOString().split('T')[0];
      dailyMap[dateKey] = {
          date,
          totalVolume: 0,
          totalFRT: 0,
          frtCount: 0,
          closedCount: 0,
          csatAverage: 0 // We might not have granular CSAT on this table yet, keeping 0 or mocking
      };
  }

  conversations.forEach(conv => {
      const dateKey = conv.createdAt.toISOString().split('T')[0];
      if (dailyMap[dateKey]) {
          dailyMap[dateKey].totalVolume++;
          if (conv.status === 'closed') dailyMap[dateKey].closedCount++;
          if (conv.firstResponseTime) {
              dailyMap[dateKey].totalFRT += conv.firstResponseTime;
              dailyMap[dateKey].frtCount++;
          }
      }
  });

  const result = Object.values(dailyMap).map((d: any) => ({
      ...d,
      avgFirstResponseTime: d.frtCount > 0 ? d.totalFRT / d.frtCount : null,
      // CSAT logic would go here if available
  }));

  return result;
}

export async function getTrendMetrics(days: number = 7) {
  const metrics = await prisma.intercomMetric.findMany({
    orderBy: { date: 'desc' },
    take: days * 2
  });
  
  const currentPeriod = metrics.slice(0, days);
  const previousPeriod = metrics.slice(days, days * 2);

  const calculateAvg = (arr: any[], key: string) => {
    if (arr.length === 0) return 0;
    const sum = arr.reduce((acc, curr: any) => acc + (curr[key] || 0), 0);
    return sum / arr.length;
  };

  const currentVolume = currentPeriod.reduce((acc, curr) => acc + curr.totalVolume, 0);
  const prevVolume = previousPeriod.reduce((acc, curr) => acc + curr.totalVolume, 0);
  const volumeChange = prevVolume > 0 ? ((currentVolume - prevVolume) / prevVolume) * 100 : 0;

  const currentCsat = calculateAvg(currentPeriod, 'csatAverage');
  const prevCsat = calculateAvg(previousPeriod, 'csatAverage');
  const csatChange = prevCsat > 0 ? ((currentCsat - prevCsat) / prevCsat) * 100 : 0;

  const currentFrt = calculateAvg(currentPeriod, 'avgFirstResponseTime');
  const prevFrt = calculateAvg(previousPeriod, 'avgFirstResponseTime');
  const frtChange = prevFrt > 0 ? ((currentFrt - prevFrt) / prevFrt) * 100 : 0;

  return {
    chartData: [...metrics].slice(0, days).reverse().map(m => ({
      date: m.date.toISOString().split('T')[0],
      volume: m.totalVolume,
      csat: m.csatAverage || 0,
      frt: m.avgFirstResponseTime || 0
    })),
    trends: {
      volume: volumeChange,
      csat: csatChange,
      frt: frtChange
    }
  };
}

export async function getIntercomHeatmap() {
  return await prisma.intercomHeatmap.findMany({
    orderBy: [{ dayOfWeek: 'asc' }, { hour: 'asc' }]
  });
}

export async function getIntercomAgents() {
  return await prisma.intercomAgent.findMany({
    orderBy: { totalSolved: 'desc' }
  });
}

export async function getIntercomCategoryMetrics() {
  return await prisma.intercomCategoryMetric.findMany({
    orderBy: { count: 'desc' }
  });
}

export async function getAgentDailyMetrics(agentName: string) {
  // Mock o Real dependiendo del token
  if (!INTERCOM_TOKEN) {
    return {
      volume: Math.floor(Math.random() * 15) + 5,
      firstResponseTime: '2m 30s',
      csat: '4.8/5'
    };
  }

  // Lógica real simplificada (buscamos ID de admin primero)
  try {
    const adminsResp = await fetch(`${INTERCOM_API_URL}/admins`, { headers: HEADERS });
    const adminsData = await adminsResp.json();
    const admin = adminsData.admins.find((a: any) => a.name === agentName || a.email === agentName);
    
    if (!admin) return null;

    // Buscar conversaciones cerradas hoy por este admin
    // Nota: Esto es complejo en API directa, por ahora retornamos datos simulados 
    // pero basados en la realidad (si quisieramos implementar full seria una query pesada)
    // Para MVP usaremos una aproximación o datos reales si tenemos la DB sincronizada.
    
    // Usamos nuestra DB local si está sincronizada
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const stats = await prisma.intercomConversation.aggregate({
      where: {
        teammateName: agentName,
        updatedAt: { gte: today },
        status: 'closed'
      },
      _count: true
    });

    return {
      volume: stats._count,
      firstResponseTime: 'N/A', // Difícil de calcular al vuelo sin historial
      csat: 'N/A' 
    };

  } catch (error) {
    console.error("Error fetching agent metrics", error);
    return null;
  }
}

export async function getAgentStatus(agentName: string) {
  if (!INTERCOM_TOKEN) return { status: 'away', message: 'Mock Status' };

  try {
    const adminsResp = await fetch(`${INTERCOM_API_URL}/admins`, { headers: HEADERS });
    const adminsData = await adminsResp.json();
    const admin = adminsData.admins.find((a: any) => a.name === agentName || a.email === agentName); // Buscar por nombre o email

    if (!admin) return null;
    
    // La API de admins retorna el "away_mode_enabled"
    return {
      isAway: admin.away_mode_enabled,
      status: admin.away_mode_enabled ? 'Ausente' : 'Online'
    };
  } catch (error) {
    return null;
  }
}

export async function getAllOpenConversations() {
  if (!INTERCOM_TOKEN) return [
      { id: '123', subject: 'Problema con Login (Mock)', url: '#', assignee: 'Dario' },
      { id: '124', subject: 'Error en pago (Mock)', url: '#', assignee: 'Unassigned' },
      { id: '125', subject: 'Feature Request (Mock)', url: '#', assignee: 'Maria' }
  ];

  try {
      // Buscar TODAS las conversaciones abiertas
      const searchBody = {
          query: {
              operator: "AND",
              value: [
                  { field: "state", operator: "=", value: "open" }
              ]
          },
          pagination: { "per_page": 20 }, // Traemos las 20 más recientes
          sort: { field: "updated_at", order: "desc" }
      };

      const resp = await fetch(`${INTERCOM_API_URL}/conversations/search`, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify(searchBody)
      });
      
      const data = await resp.json();
      
      // 1. Obtener lista de admins para mapear IDs a Nombres
      let adminMap: Record<string, string> = {};
      try {
        const adminsResp = await fetch(`${INTERCOM_API_URL}/admins`, { headers: HEADERS });
        if (adminsResp.ok) {
            const adminsData = await adminsResp.json();
            (adminsData.admins || []).forEach((a: any) => {
                adminMap[a.id] = a.name || a.email;
            });
        }
      } catch (e) {
        console.error("Error fetching admins for map", e);
      }
      
      return (data.conversations || []).map((c: any) => {
          // Limpiar asunto de HTML Tags
          let rawSubject = c.source?.subject || "";
          rawSubject = rawSubject.replace(/<[^>]*>?/gm, '');
          let subject = rawSubject.trim();

          if (!subject || subject === "Sin asunto") {
               const author = c.source?.author;
               const userLabel = author?.email || author?.name || "Usuario desconocido";
               let bodySnippet = c.source?.body || "";
               bodySnippet = bodySnippet.replace(/<[^>]*>?/gm, '').substring(0, 50);
               subject = bodySnippet ? `${userLabel}: ${bodySnippet}...` : `Ticket de ${userLabel}`;
          }

          // Custom attributes for client label
          const attrs = c.custom_attributes || {};
          const client = attrs['Clientes'] || attrs['Client'] || attrs['Cliente'] || null;

          // Tags as array of names
          const tags: string[] = (c.tags?.tags || []).map((t: any) => t.name as string);

          // Is VIP? (Enterprise/VIP tag or priority)
          const isVip = tags.some((t: string) =>
            ['vip', 'enterprise', 'priority', 'VIP', 'Enterprise'].includes(t)
          ) || c.priority === 'priority';

          return {
              id: c.id,
              subject,
              url: `https://app.intercom.com/a/inbox/here/inbox/conversation/${c.id}`,
              assignee: c.admin_assignee_id ? (adminMap[c.admin_assignee_id] || "Agente Desconocido") : "Sin asignar",
              client,
              tags,
              isVip,
              priority: c.priority || null,
              createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
              updatedAt: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : null,
          };
      });


  } catch (error) {
    console.error("Error fetching open tickets", error);
    return [];
  }
}

export async function getConversationDetail(id: string): Promise<import("@/types/chat").ChatConversationDetail | null> {
  if (!INTERCOM_TOKEN) return null;

  try {
    const resp = await fetch(`${INTERCOM_API_URL}/conversations/${id}`, {
      headers: HEADERS,
    });
    if (!resp.ok) return null;
    const c = await resp.json();

    // Subject
    let subject = (c.source?.subject || "").replace(/<[^>]*>?/gm, "").trim();
    if (!subject) {
      const author = c.source?.author;
      const snippet = (c.source?.body || "").replace(/<[^>]*>?/gm, "").substring(0, 50);
      subject = snippet ? `${author?.name || "Usuario"}: ${snippet}...` : `Ticket de ${author?.name || "Usuario"}`;
    }

    // Admins map
    const adminMap: Record<string, string> = {};
    try {
      const adminsResp = await fetch(`${INTERCOM_API_URL}/admins`, { headers: HEADERS });
      if (adminsResp.ok) {
        const adminsData = await adminsResp.json();
        (adminsData.admins || []).forEach((a: { id: string; name?: string; email?: string }) => {
          adminMap[a.id] = a.name || a.email || "";
        });
      }
    } catch {}

    const attrs = c.custom_attributes || {};
    const client = attrs["Clientes"] || attrs["Client"] || attrs["Cliente"] || null;
    const tags: string[] = (c.tags?.tags || []).map((t: { name: string }) => t.name);
    const isVip =
      tags.some((t) => ["vip", "enterprise", "priority", "VIP", "Enterprise"].includes(t)) ||
      c.priority === "priority";

    // Build message list from source + conversation_parts
    const messages: import("@/types/chat").ChatMessage[] = [];

    if (c.source) {
      messages.push({
        id: c.source.id || "source",
        author: c.source.author?.name || c.source.author?.email || "Usuario",
        authorType: c.source.author?.type === "admin" ? "admin" : "user",
        body: c.source.body || "",
        createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : "",
        isNote: false,
      });
    }

    const parts: { id: string; body: string; part_type: string; author?: { name?: string; email?: string; type?: string }; created_at?: number; attachments?: { url: string; name: string; content_type?: string; filesize?: number }[] }[] = c.conversation_parts?.conversation_parts || [];
    for (const part of parts) {
      if ((!part.body && !part.attachments?.length) || part.part_type === "close" || part.part_type === "open") continue;
      messages.push({
        id: part.id,
        author: part.author?.name || part.author?.email || "Sistema",
        authorType:
          part.author?.type === "admin" ? "admin" : part.author?.type === "bot" ? "bot" : "user",
        body: part.body || "",
        createdAt: part.created_at ? new Date(part.created_at * 1000).toISOString() : "",
        isNote: part.part_type === "note",
        attachments: (part.attachments || []).map((a) => ({
          url: a.url,
          name: a.name,
          contentType: a.content_type,
          fileSize: a.filesize,
        })),
      });
    }

    return {
      id: c.id,
      subject,
      assignee: c.admin_assignee_id
        ? adminMap[c.admin_assignee_id] || "Agente Desconocido"
        : "Sin asignar",
      client,
      tags,
      isVip,
      priority: c.priority || null,
      createdAt: c.created_at ? new Date(c.created_at * 1000).toISOString() : null,
      updatedAt: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : null,
      url: `https://app.intercom.com/a/inbox/here/inbox/conversation/${c.id}`,
      messages,
      sourceType: c.source?.type || null,
    };
  } catch (error) {
    console.error("Error fetching conversation detail", error);
    return null;
  }
}

/**
 * Busca conversaciones cerradas (resueltas) en un rango de fechas.
 * Usa el endpoint POST /conversations/search de Intercom API v2.11.
 * Retorna array de IDs de conversación para procesar en batch.
 */
export async function searchClosedConversations(
  from: Date,
  to: Date,
  page = 1
): Promise<{ ids: string[]; totalPages: number }> {
  if (!INTERCOM_TOKEN) return { ids: [], totalPages: 0 };

  const resp = await fetch(`${INTERCOM_API_URL}/conversations/search`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: {
        operator: "AND",
        value: [
          { field: "state", operator: "=", value: "resolved" },
          { field: "updated_at", operator: ">", value: Math.floor(from.getTime() / 1000) },
          { field: "updated_at", operator: "<", value: Math.floor(to.getTime() / 1000) },
        ],
      },
      pagination: { per_page: 20, page },
    }),
  });

  if (!resp.ok) return { ids: [], totalPages: 0 };

  const data = await resp.json();
  const ids: string[] = (data.conversations || []).map((c: { id: string }) => c.id);
  const total = data.total_count || 0;
  const totalPages = Math.ceil(total / 20);

  return { ids, totalPages };
}
