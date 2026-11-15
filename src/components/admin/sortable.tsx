"use client";

import { useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/app/actions/admin-shared";

const instructions: ScreenReaderInstructions = {
  draggable: "Pour déplacer cet élément, appuie sur Espace ou Entrée, utilise les flèches haut et bas, puis Espace ou Entrée pour le déposer. Échap annule.",
};

function announcements(label: (id: string) => string, index: (id: string) => number): Announcements {
  return {
    onDragStart: ({ active }) => `${label(String(active.id))} saisi, position ${index(String(active.id)) + 1}.`,
    onDragOver: ({ active, over }) => (over ? `${label(String(active.id))} au-dessus de la position ${index(String(over.id)) + 1}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${label(String(active.id))} déposé en position ${index(String(over.id)) + 1}.` : `${label(String(active.id))} déposé.`),
    onDragCancel: ({ active }) => `Déplacement de ${label(String(active.id))} annulé.`,
  };
}

export type DragHandleProps = { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined; label: string };

export function DragHandle({ handle, className }: { handle: DragHandleProps; className?: string }) {
  return (
    <button
      type="button"
      {...handle.attributes}
      {...handle.listeners}
      aria-label={`Déplacer : ${handle.label}`}
      className={cn(
        "grid size-8 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 active:cursor-grabbing",
        className,
      )}
    >
      <GripVertical className="size-4" />
    </button>
  );
}

function SortableRow({ id, label, children, className }: { id: string; label: string; children: (h: DragHandleProps) => React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-90 shadow-lg", className)}
    >
      {children({ attributes: attributes as unknown as Record<string, unknown>, listeners: listeners as Record<string, unknown> | undefined, label })}
    </li>
  );
}

/** Controlled sortable list: the parent owns the order (used by the lesson editor). */
export function SortableList<T>({
  items,
  getId,
  getLabel,
  onMove,
  children,
  className,
  itemClassName,
}: {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T, index: number) => string;
  onMove: (from: number, to: number) => void;
  children: (item: T, index: number, handle: DragHandleProps) => React.ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const index = (id: string) => ids.indexOf(id);
  const label = (id: string) => {
    const i = index(id);
    return i >= 0 ? getLabel(items[i], i) : "élément";
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = index(String(active.id));
    const to = index(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements: announcements(label, index), screenReaderInstructions: instructions }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item, i) => (
            <SortableRow key={ids[i]} id={ids[i]} label={getLabel(item, i)} className={itemClassName}>
              {(h) => children(item, i, h)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/**
 * Sortable list persisted on the server: reorders optimistically and calls `save(ids)`;
 * reverts on failure. Resyncs when the server sends a new list.
 */
export function PersistedSortable<T extends { id: string }>({
  items,
  getLabel,
  save,
  children,
  className,
  itemClassName,
}: {
  items: T[];
  getLabel: (item: T, index: number) => string;
  save: (ids: string[]) => Promise<ActionResult<unknown>>;
  children: (item: T, index: number, handle: DragHandleProps) => React.ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  const [source, setSource] = useState(items);
  const [order, setOrder] = useState(items);
  if (source !== items) {
    setSource(items);
    setOrder(items);
  }
  return (
    <SortableList
      items={order}
      getId={(x) => x.id}
      getLabel={getLabel}
      className={className}
      itemClassName={itemClassName}
      onMove={(from, to) => {
        const before = order;
        const next = arrayMove(order, from, to);
        setOrder(next);
        save(next.map((x) => x.id)).then(
          (r) => {
            if (!r.ok) {
              toast.error(r.error);
              setOrder(before);
            } else toast.success("Ordre enregistré");
          },
          () => {
            toast.error("Erreur réseau : ordre non enregistré.");
            setOrder(before);
          },
        );
      }}
    >
      {children}
    </SortableList>
  );
}

export { arrayMove };
