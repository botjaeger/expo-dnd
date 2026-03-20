# expo-dnd

Cross-platform drag and drop for React Native. iOS, Android, and Web.

Built on [Reanimated 3](https://docs.swmansion.com/react-native-reanimated/) and [Gesture Handler 2](https://docs.swmansion.com/react-native-gesture-handler/). All animations run at 60 fps on the UI thread.

## Install

```bash
npm install expo-dnd
```

**Peer dependencies** (must be installed separately):

```bash
npx expo install react-native-reanimated react-native-gesture-handler
```

| Dependency | Version |
|---|---|
| `react` | >= 18.0.0 |
| `react-native` | >= 0.72.0 |
| `react-native-reanimated` | >= 3.0.0 |
| `react-native-gesture-handler` | >= 2.10.0 |

## Quick Start

### Basic Drag & Drop

```tsx
import { DndProvider, Draggable, Droppable } from 'expo-dnd';
import type { DragEndEvent } from 'expo-dnd';

function App() {
  const handleDragEnd = (event: DragEndEvent) => {
    if (event.over) {
      console.log(`Dropped ${event.active.id} on ${event.over.id}`);
    }
  };

  return (
    <DndProvider onDragEnd={handleDragEnd} dragEffect="bounce">
      <Draggable id="item-1">
        <View style={styles.card}>
          <Text>Drag me</Text>
        </View>
      </Draggable>

      <Droppable id="zone-a" activeEffect="bounce">
        {({ isOver }) => (
          <View style={[styles.zone, isOver && styles.active]}>
            <Text>{isOver ? 'Release!' : 'Drop here'}</Text>
          </View>
        )}
      </Droppable>
    </DndProvider>
  );
}
```

### Sortable List

```tsx
import { SortableList } from 'expo-dnd';

function App() {
  const [items, setItems] = useState(ITEMS);

  return (
    <SortableList
      data={items}
      keyExtractor={(item) => item.id}
      direction="vertical"
      dragEffect="pickup"
      activeDragStyle={{ opacity: 0.3 }}
      renderItem={({ item, isDragging }) => (
        <View style={[styles.row, isDragging && styles.ghost]}>
          <Text>{item.label}</Text>
        </View>
      )}
      onReorder={(data) => setItems(data)}
    />
  );
}
```

No `itemSize` needed. SortableList auto-measures each item after render. Variable heights work seamlessly.

### Cross-List Transfer

```tsx
import { DraggableListGroup, DraggableList } from 'expo-dnd';
import type { DropEvent } from 'expo-dnd';

function App() {
  const handleDrop = (event: DropEvent<Item>) => {
    const { item, fromListId, fromIndex, toListId, toIndex } = event;
    // Move item between lists
  };

  return (
    <DraggableListGroup onDrop={handleDrop} dragEffect="scaleUp">
      <DraggableList
        id="todo"
        data={todoItems}
        keyExtractor={(item) => item.id}
        itemSize={40}
        renderItem={renderItem}
      />
      <DraggableList
        id="done"
        data={doneItems}
        keyExtractor={(item) => item.id}
        itemSize={40}
        renderItem={renderItem}
      />
    </DraggableListGroup>
  );
}
```

### Custom Hooks

Build your own drag-and-drop from scratch:

```tsx
import { DndProvider, useDraggable, useDroppable, useDndContext } from 'expo-dnd';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

function MyDraggable({ id, children }) {
  const ctx = useDndContext();
  const { ref, gesture, animatedStyle, onLayout } = useDraggable({ id });

  // Register overlay renderer so the clone appears during drag
  const childRef = useRef(children);
  childRef.current = children;
  useEffect(() => {
    ctx.registerDragRenderer(id, () => childRef.current);
    return () => ctx.unregisterDragRenderer(id);
  }, [id]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref} style={animatedStyle} onLayout={onLayout}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function MyDropZone({ id, children }) {
  const { ref, isOver, activeStyle, onLayout } = useDroppable({ id });

  return (
    <Animated.View ref={ref} style={[styles.zone, activeStyle]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}
```

## API

### Components

| Component | Description |
|---|---|
| `DndProvider` | Wraps your tree to enable drag and drop |
| `Draggable` | Makes children draggable with long-press activation |
| `DragHandle` | Restricts drag initiation to a specific child element |
| `Droppable` | Creates a drop zone with hover feedback |
| `SortableList` | Auto-measuring sortable list (no `itemSize` needed) |
| `SortableFlatList` | FlatList-backed sortable for large datasets (requires `itemSize`) |
| `DraggableList` | Single list for cross-list drag and drop |
| `DraggableListGroup` | Coordinates transfers across multiple DraggableLists |

### Hooks

| Hook | Description |
|---|---|
| `useDraggable` | Low-level hook for custom draggable components |
| `useDroppable` | Low-level hook for custom drop zones |
| `useDndContext` | Reads drag state (activeId, isDragging, pointer position, etc.) |

### Customization Props

All list components (`SortableList`, `SortableFlatList`, `DraggableList`) support:

| Prop | Description |
|---|---|
| `activeDragStyle` | Style for the source item while dragging (default: invisible) |
| `renderInsertIndicator` | Render a custom insertion indicator at the target index |
| `dragEffect` | Scale effect for the overlay: `"pickup"`, `"scaleUp"`, `"scaleDown"`, `"bounce"` |

`Draggable` supports `activeDragStyle` (default: `{ opacity: 0.4 }`) and `dragEffect`.

`Droppable` supports `activeStyle` and `activeEffect` for hover feedback.

### Drag Effects

Scale animation presets applied to the drag overlay on pickup:

| Preset | Scale | Feel |
|---|---|---|
| `pickup` | 1.03x | Subtle lift |
| `scaleUp` | 1.08x | Noticeable scale up |
| `scaleDown` | 0.95x | Shrinks when grabbed |
| `bounce` | 1.05x | Bouncy with overshoot |

Pass as a string or custom config:

```tsx
// String preset
<DndProvider dragEffect="bounce">

// Custom config
<DndProvider dragEffect={{ scale: 1.15, spring: { damping: 6, stiffness: 150, mass: 0.5 } }}>
```

### Event Types

| Type | Shape |
|---|---|
| `DragStartEvent` | `{ active: { id, data? } }` |
| `DragMoveEvent` | `{ active: { id, data? }, translation: { x, y }, absoluteX, absoluteY }` |
| `DragOverEvent` | `{ active: { id, data? }, over: { id, data? } \| null }` |
| `DragEndEvent` | `{ active: { id, data? }, over: { id, data? } \| null }` |
| `DropEvent<T>` | `{ item: T, fromListId, fromIndex, toListId, toIndex }` |

## Platform Notes

- **iOS/Android**: Native gesture handling via Reanimated worklets
- **Web**: Uses `getBoundingClientRect()` for layout, left-click only, handles scroll offset compensation
- All platforms: Long-press (200ms) to activate drag

## License

MIT
