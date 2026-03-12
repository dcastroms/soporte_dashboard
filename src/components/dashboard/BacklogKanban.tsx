"use client";

import { useState } from "react";
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateBacklogItemStatus } from "@/lib/actions";
import { toast } from "sonner";
import { MoreVertical, GripVertical } from "lucide-react";

interface BacklogItem {
    id: string;
    title: string;
    type: string;
    assignee: string;
    priority: string;
    status: string;
}

const COLUMNS = [
    { id: "Pendiente", title: "Pendiente", color: "bg-slate-100" },
    { id: "En Progreso", title: "En Progreso", color: "bg-blue-50" },
    { id: "Completado", title: "Completado", color: "bg-emerald-50" },
];

export function BacklogKanban({ items: initialItems }: { items: BacklogItem[] }) {
    const [items, setItems] = useState(initialItems);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'Crítica': return 'text-rose-700 bg-rose-50 border-rose-200';
            case 'Alta': return 'text-orange-700 bg-orange-50 border-orange-200';
            case 'Media': return 'text-amber-700 bg-amber-50 border-amber-200';
            case 'Baja': return 'text-slate-700 bg-slate-50 border-slate-200';
            default: return 'text-slate-700 bg-slate-50 border-slate-200';
        }
    };

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragOver = (event: any) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id;
        const overId = over.id;

        if (activeId === overId) return;

        const activeItem = items.find(i => i.id === activeId);
        const overItem = items.find(i => i.id === overId);

        // Find if dropping over a column or an item
        const isOverAColumn = COLUMNS.some(col => col.id === overId);

        if (isOverAColumn) {
            const newStatus = overId;
            if (activeItem && activeItem.status !== newStatus) {
                setItems(prev => prev.map(item =>
                    item.id === activeId ? { ...item, status: newStatus } : item
                ));
            }
        } else if (overItem && activeItem && activeItem.status !== overItem.status) {
            const newStatus = overItem.status;
            setItems(prev => prev.map(item =>
                item.id === activeId ? { ...item, status: newStatus } : item
            ));
        }
    };

    const handleDragEnd = async (event: any) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeItem = items.find(i => i.id === active.id);
        if (activeItem) {
            try {
                await updateBacklogItemStatus(activeItem.id, activeItem.status);
            } catch (error) {
                toast.error("Error al actualizar estado");
                // Revert local state if needed (fetch items again or maintain original)
            }
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-250px)]">
                {COLUMNS.map((column) => (
                    <KanbanColumn
                        key={column.id}
                        id={column.id}
                        title={column.title}
                        color={column.color}
                        items={items.filter(item => item.status === column.id)}
                        getPriorityColor={getPriorityColor}
                    />
                ))}
            </div>
            <DragOverlay dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                    styles: {
                        active: {
                            opacity: '0.5',
                        },
                    },
                }),
            }}>
                {activeId ? (
                    <KanbanItemCard
                        item={items.find(i => i.id === activeId)!}
                        getPriorityColor={getPriorityColor}
                        isOverlay
                    />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}

function KanbanColumn({ id, title, color, items, getPriorityColor }: any) {
    const { setNodeRef } = useSortable({ id });

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col gap-4 p-4 rounded-xl border border-dashed border-slate-200 ${color} min-h-[500px] h-full`}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-slate-700 uppercase text-xs tracking-widest">{title}</h3>
                <Badge variant="secondary" className="bg-white/50 text-slate-500">{items.length}</Badge>
            </div>

            <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-1 scrollbar-thin">
                <SortableContext items={items.map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
                    {items.map((item: any) => (
                        <KanbanItem key={item.id} item={item} getPriorityColor={getPriorityColor} />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
}

function KanbanItem({ item, getPriorityColor }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <KanbanItemCard item={item} getPriorityColor={getPriorityColor} />
        </div>
    );
}

function KanbanItemCard({ item, getPriorityColor, isOverlay = false }: any) {
    return (
        <Card className={`
            shadow-sm group hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing
            ${item.priority === 'Crítica' && item.status !== 'Completado' ? 'border-l-4 border-l-rose-500' : ''}
            ${isOverlay ? 'shadow-xl rotate-2' : ''}
        `}>
            <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-sm leading-tight text-slate-800">{item.title}</h4>
                    <GripVertical className="h-4 w-4 text-slate-300 flex-shrink-0 group-hover:text-slate-400" />
                </div>

                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={`text-[10px] font-bold ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-white text-slate-500 font-normal">
                        {item.type}
                    </Badge>
                </div>

                <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500 font-medium">{item.assignee}</span>
                    {item.priority === 'Crítica' && item.status !== 'Completado' && (
                        <span className="text-[9px] text-rose-600 font-black animate-pulse">URGENTE</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
