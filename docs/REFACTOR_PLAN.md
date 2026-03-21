# Sortable Refactor Plan: Unified Architecture

## Problem

expo-dnd has two completely separate systems that don't talk to each other:

- **System 1**: `Draggable` / `Droppable` — overlay-based, JS-thread collision, DndContext
- **System 2**: `SortableList` — in-place animation, UI-thread swap detection, own state

This means you can't drag a `Draggable` into a `SortableList`, can't drag a sortable item onto a `Droppable`, and `DraggableList` exists as an awkward third system bridging both.

## Target Architecture (Option B: Shared Context, Separate Gesture Pipelines)

Keep sortable's proven in-place UI-thread animation model, but register sortable items with `DndContext` so both systems see each other.

```
DndProvider (unified context)
├── useDraggable (unchanged — overlay-based)
├── useDroppable (unchanged)
├── SortableContext (NEW — manages positions, registers container as Droppable)
│   └── useSortable (NEW — useDraggable + useDroppable + position tracking)
├── SortableList (refactored — uses SortableContext + useSortable internally)
└── Cross-list = multiple SortableContexts under one DndProvider
```

### Key Design Decisions

1. **In-place animation preserved** for sortable items (no overlay needed, avoids Fabric gesture cancellation)
2. **SortableContext registers its container as a Droppable** — external Draggables can target it
3. **useSortable writes to DndContext.activeId/absoluteX/Y** — external Droppables react to sortable drags
4. **Collision detection stays dual-path**: sortable uses UI-thread midpoint swap, draggable uses JS-thread rect intersection. They share identity via DndContext.
5. **DraggableList/DraggableListGroup removed** — replaced by multiple SortableContexts

### Cross-System Interactions

**Sortable item → external Droppable:**
- `useSortable.onUpdate` writes to `DndContext.absoluteX/Y`
- `useDroppable.isOver` reacts naturally

**External Draggable → SortableList:**
- DndContext collision finds SortableContext's container droppable
- SortableContext computes insertion index from pointer position
- Items shift to preview drop position
- On drop, `SortableContext.onReorder` fires with `source: 'external'`

**Cross-SortableList transfer:**
- Source context detects item left its bounds
- Target context receives drag-over, shifts items
- On drop, both fire `onReorder`

## New API

### SortableContext

```tsx
<SortableContext
  id="my-list"
  items={['id-1', 'id-2', 'id-3']}
  direction="vertical"
  acceptsExternalDrops
  onReorder={({ items, activeId, fromIndex, toIndex, source }) => {
    // source: 'internal' | 'external'
  }}
>
  {children}
</SortableContext>
```

### useSortable

```tsx
const { ref, gesture, animatedStyle, isActive, currentIndex } = useSortable({
  id: 'item-1',
  index: 0,
  size: 60,
});
```

### What Gets Removed

| Current | v1.0 |
|---|---|
| `DraggableList` | Removed — use `SortableList` with `acceptsExternalDrops` |
| `DraggableListGroup` | Removed — use multiple `SortableList`s under one `DndProvider` |
| `AutoDraggableList` | Removed — `SortableList` already auto-measures |
| `FixedSortableItem` | Internal — replaced by `useSortable` |
| `useSortableContainer` | Internal — replaced by `SortableContext` |

## Implementation Phases

### Phase 0: Validate Fabric Risk (1 day)
Spike: write to `DndContext.activeId` from sortable's `onStart` worklet on the UI thread. Test on iOS Fabric. If gesture cancels, need alternative approach.

### Phase 1: SortableContext + useSortable (3-5 days)
- Extract `useSortableContainer` state into `SortableContext` provider
- Extract per-item logic from `SortableItemInner` into `useSortable` hook
- `SortableList` becomes thin wrapper
- No behavior change yet — validates the extraction

### Phase 2: Wire to DndContext (2-3 days)
- `SortableContext` registers container as Droppable
- `useSortable.onStart/onUpdate` writes to DndContext shared values
- External Droppables react to sortable drags
- **Milestone**: drag a sortable item over an external Droppable zone

### Phase 3: Accept External Drops (3-5 days)
- `SortableContext` watches `DndContext.overId` for its container
- Computes insertion index from pointer position
- Shifts items to preview insertion
- `onReorder` with `source: 'external'`
- **Milestone**: drag a Draggable into a SortableList

### Phase 4: Cross-SortableContext Transfers (2-3 days)
- Source context removes item, target context inserts
- Both fire `onReorder`
- Replaces `DraggableListGroup` functionality
- **Milestone**: drag between two SortableLists

### Phase 5: Cleanup + v1.0 (2-3 days)
- Remove `DraggableList`, `DraggableListGroup`, `AutoDraggableList`
- Remove dead internal components
- Migration guide
- Update docs and examples
- Tag v1.0.0

**Total estimate: 2-3 weeks**

## Risks

| Risk | Mitigation |
|---|---|
| Fabric gesture cancellation from DndContext writes | Phase 0 spike validates this first |
| Performance with 100+ items if all register as droppables | Only container registers, not individual items |
| Breaking change for DraggableList users | v1.0 semver bump + migration guide |
| SortableFlatList complexity | Defer to v1.1 |
| Two animation models (overlay vs in-place) | Document when to use each |
