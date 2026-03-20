# expo-dnd

Cross-platform drag and drop for React Native. iOS, Android, and Web.

Built on [Reanimated](https://docs.swmansion.com/react-native-reanimated/) (3+ and 4+) and [Gesture Handler](https://docs.swmansion.com/react-native-gesture-handler/) (2+). All animations run at 60 fps on the UI thread.

**[Documentation & Demos](https://botjaeger.github.io/expo-dnd/)** · **[Try on Device (Expo Go)](https://expo.dev/accounts/jarngotostos/projects/expo-dnd-example)**

## Install

```bash
npx expo install @botjaeger/expo-dnd
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

**Babel plugin** — add to your `babel.config.js`:

```js
// Reanimated 4+ (Expo SDK 54+)
plugins: ['react-native-worklets/plugin']

// Reanimated 3.x (Expo SDK 53 and below)
plugins: ['react-native-reanimated/plugin']
```

> Expo SDK 54+ includes the worklets plugin automatically via `babel-preset-expo`.
>
> Reanimated 4+ also requires `react-native-worklets` — install it with `npx expo install react-native-worklets`.

**Root wrapper** — your app must be wrapped in `GestureHandlerRootView`:

```tsx
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* your app */}
    </GestureHandlerRootView>
  );
}
```

## Quick Start

### Basic Drag & Drop

```tsx
import { DndProvider, Draggable, Droppable } from '@botjaeger/expo-dnd';
import type { DragEndEvent } from '@botjaeger/expo-dnd';

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
import { SortableList } from '@botjaeger/expo-dnd';

function App() {
  const [items, setItems] = useState(ITEMS);

  return (
    <SortableList
      data={items}
      keyExtractor={(item) => item.id}
      direction="vertical"
      dragEffect="pickup"
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text>{item.label}</Text>
        </View>
      )}
      onReorder={(data, event) => {
        setItems(data);
        console.log(`Moved from ${event.fromIndex} to ${event.toIndex}`);
      }}
    />
  );
}
```

No `itemSize` needed. SortableList auto-measures each item after render. Variable heights work seamlessly.

### Cross-List Transfer

```tsx
import { DraggableListGroup, DraggableList } from '@botjaeger/expo-dnd';
import type { DropEvent } from '@botjaeger/expo-dnd';

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
        direction="vertical"
        renderItem={renderItem}
      />
      <DraggableList
        id="done"
        data={doneItems}
        keyExtractor={(item) => item.id}
        itemSize={40}
        direction="vertical"
        renderItem={renderItem}
      />
    </DraggableListGroup>
  );
}
```

Note: `DraggableList` requires `itemSize` (unlike `SortableList` which auto-measures).

### Custom Hooks

Build your own drag-and-drop from scratch:

```tsx
import { DndProvider, useDraggable, useDroppable, useDndContext } from '@botjaeger/expo-dnd';
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
  }, [id, ctx]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref} style={[styles.item, animatedStyle]} onLayout={onLayout}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function MyDropZone({ id, children }) {
  const { ref, isOver, activeStyle, onLayout } = useDroppable({ id, activeEffect: 'bounce' });

  return (
    <Animated.View ref={ref} style={[styles.zone, activeStyle]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}
```

`useDraggable` returns an `animatedStyle` that reduces source opacity during drag (default: 0.4). The visual clone (overlay) is rendered automatically by `DndProvider`.

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
| `DraggableList` | Single list for cross-list drag and drop (requires `itemSize`) |
| `DraggableListGroup` | Coordinates transfers across multiple DraggableLists |

### Hooks

| Hook | Description |
|---|---|
| `useDraggable` | Low-level hook for custom draggable components |
| `useDroppable` | Low-level hook for custom drop zones |
| `useDndContext` | Reads drag state (activeId, isDragging, pointer position, etc.) |

### Customization Props

**`SortableList`** and **`SortableFlatList`**:

| Prop | Description |
|---|---|
| `dragEffect` | Scale effect on pickup: `"pickup"`, `"scaleUp"`, `"scaleDown"`, `"bounce"` |
| `renderInsertIndicator` | Render a custom insertion indicator at the target index |
| `activeDragStyle` | Style for the source item placeholder (SortableFlatList only) |
| `handle` | When true, only a `DragHandle` child can start the drag |

**`DraggableList`**:

| Prop | Description |
|---|---|
| `dragEffect` | Scale effect on pickup |
| `renderInsertIndicator` | Custom insertion indicator |
| `activeDragStyle` | Style for the source item while dragging (default: invisible) |
| `activeContainerStyle` | Style applied to the droppable container on hover |

**`Draggable`**: supports `activeDragStyle` (default: `{ opacity: 0.4 }`) and `dragEffect`.

**`Droppable`**: supports `activeStyle` and `activeEffect` for hover feedback.

### Drag Effects

Scale animation presets applied on pickup:

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

## Example App

**[Try it now in Expo Go](https://expo.dev/accounts/jarngotostos/projects/expo-dnd-example)** — scan the QR code with Expo Go (iOS/Android) to try all 5 demos on your phone.

Or run locally:

```bash
cd example
npm install
npx expo start
```

## Platform Notes

- **iOS/Android**: Native gesture handling via Reanimated worklets
- **Web**: Uses `getBoundingClientRect()` for layout, left-click only, handles scroll offset compensation
- All platforms: Long-press (200ms) to activate drag

## License

MIT
