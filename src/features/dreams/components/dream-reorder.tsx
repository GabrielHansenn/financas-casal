"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { reorderDreams } from "../actions";
import type { DreamItem } from "../types";
import { DreamCover } from "./dream-cover";

function SortableTile({ dream, index }: { dream: DreamItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dream.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "relative touch-manipulation overflow-hidden rounded-xl border bg-card select-none",
        isDragging && "z-10 scale-105 shadow-lg ring-2 ring-primary",
      )}
      {...attributes}
      {...listeners}
      aria-label={`${index + 1}. ${dream.title}. Use espaço para pegar e as setas para mover.`}
    >
      <DreamCover
        url={dream.coverUrl}
        category={dream.category}
        alt=""
        className="pointer-events-none aspect-square"
        placeholderClassName="aspect-square"
      />
      <div className="flex items-center gap-1 p-2 text-xs font-medium">
        <GripVerticalIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{dream.title}</span>
      </div>
    </li>
  );
}

/**
 * Reorder mode: a uniform grid (drag & drop is unreliable inside a masonry layout).
 * Touch needs a short press before dragging, so scrolling the page keeps working.
 */
export function DreamReorder({
  workspaceId,
  dreams,
  onDone,
}: {
  workspaceId: string;
  dreams: DreamItem[];
  onDone: () => void;
}) {
  const [items, setItems] = useState(dreams);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const from = current.findIndex((d) => d.id === active.id);
      const to = current.findIndex((d) => d.id === over.id);
      return arrayMove(current, from, to);
    });
  };

  const save = () =>
    startTransition(async () => {
      const result = await reorderDreams({ workspaceId, ids: items.map((d) => d.id) });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Ordem salva");
      onDone();
    });

  const changed = items.some((d, i) => d.id !== dreams[i]?.id);

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Arraste para reorganizar. No celular, segure o sonho por um instante antes de arrastar.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((d) => d.id)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {items.map((dream, index) => (
              <SortableTile key={dream.id} dream={dream} index={index} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex justify-end gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur md:bottom-4">
        <Button variant="ghost" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button onClick={save} disabled={pending || !changed}>
          {pending ? "Salvando…" : "Salvar ordem"}
        </Button>
      </div>
    </div>
  );
}
