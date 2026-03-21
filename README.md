<h1 align="center">expo-dnd</h1>

<p align="center">
  <i>Cross-platform drag and drop for React Native — iOS, Android, and Web</i>
</p>

<p align="center">
  <i>UI-thread animations, sortable lists, cross-list transfers, and collision detection out of the box</i>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@botjaeger/expo-dnd"><img src="https://badge.fury.io/js/%40botjaeger%2Fexpo-dnd.svg" alt="npm version" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript" /></a>
  <a href="https://reactnative.dev/"><img src="https://img.shields.io/badge/React%20Native-0.72+-green.svg" alt="React Native" /></a>
</p>

<p align="center">
  <a href="https://botjaeger.github.io/expo-dnd/"><img src="https://img.shields.io/badge/📖%20Documentation-4f46e5?style=for-the-badge&logo=gitbook&logoColor=white&labelColor=1e293b&color=3b82f6" alt="Documentation" /></a>
  <a href="https://www.npmjs.com/package/@botjaeger/expo-dnd"><img src="https://img.shields.io/badge/📦%20View%20on%20NPM-cb3837?style=for-the-badge&logo=npm&logoColor=white&labelColor=1e293b" alt="NPM Package" /></a>
</p>

---

## Why expo-dnd?

Most React Native drag-and-drop libraries are either unmaintained, web-first ports that fight the platform, or missing the features you actually need. expo-dnd is different — it's **built from scratch for React Native** with a two-thread architecture: gestures and animations run entirely on the **UI thread** via Reanimated worklets, while React handles state on the JS thread. No bridge bottleneck, no dropped frames.

The API covers the full spectrum — from dropping items onto zones to reordering sortable lists to transferring items across multiple lists — with **one consistent pattern**. Add `itemSize` for fixed layouts, or skip it and let the library auto-measure. It just works.

## Features

- **60fps UI-Thread Animations** – All gesture handling and animations run on the UI thread via Reanimated worklets. No JS bridge round-trips during drag.
- **Fabric & New Architecture** – Tested on Fabric with iOS and Android. In-place sortable animations avoid the Fabric gesture cancellation issue.
- **Works with Expo** – Compatible with Expo managed workflow. Requires peer dependencies (Reanimated + Gesture Handler) installed separately.
- **Auto-Measuring Sortable Lists** – `SortableList` measures item heights automatically. Variable heights work without configuration.
- **Cross-List Transfers** – `DraggableListGroup` + `DraggableList` enables drag between multiple lists with insertion indicators.
- **Collision Detection** – Center-point check against droppables, with intersection ratio fallback (10% threshold). Smallest-area preference for overlapping zones.
- **Auto-Scroll** – Edge-triggered scroll in scroll-mode lists. Gated by item boundary crossing to prevent false triggers.
- **Drag Effects** – Scale presets (`pickup`, `scaleUp`, `scaleDown`, `bounce`) with spring physics, or pass a custom `{ scale, spring }` config.
- **Drag Handles** – `<DragHandle>` restricts drag initiation to a specific child element.
- **Custom Hooks** – `useDraggable`, `useDroppable`, `useDndContext` for building custom drag interactions from scratch.
- **TypeScript** – Full type definitions for all components, hooks, events, and configs.
- **Cross-Platform** – iOS, Android, and Web from one codebase. Web uses `getBoundingClientRect()` for measurement and left-click-only activation.

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

### Auto-Measuring Cross-List Transfer

Use `AutoDraggableList` instead of `DraggableList` when item heights vary — it auto-measures like `SortableList`:

```tsx
import { DraggableListGroup, AutoDraggableList } from '@botjaeger/expo-dnd';

<DraggableListGroup onDrop={handleDrop}>
  <AutoDraggableList id="todo" data={todoItems} keyExtractor={(item) => item.id} renderItem={renderItem} direction="vertical" />
  <AutoDraggableList id="done" data={doneItems} keyExtractor={(item) => item.id} renderItem={renderItem} direction="vertical" />
</DraggableListGroup>
```

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
| `DragHandle` | Restricts drag to a specific child. Parent must have `handle` prop. |
| `Droppable` | Creates a drop zone with hover feedback |
| `SortableList` | Auto-measuring sortable list (no `itemSize` needed) |
| `SortableFlatList` | FlatList-backed sortable for large datasets (requires `itemSize`) |
| `DraggableList` | Single list for cross-list drag and drop (requires `itemSize`) |
| `AutoDraggableList` | Auto-measuring version of DraggableList (no `itemSize` needed) |
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

**`DndProvider`**:

| Prop | Description |
|---|---|
| `style` | Custom style for the provider container |

### Interaction Props

All list components (`SortableList`, `SortableFlatList`, `DraggableList`, `AutoDraggableList`) support:

| Prop | Description |
|---|---|
| `onItemPress` | Called on tap/click (not after drag). Receives `(item, index)`. |
| `longPressDuration` | Milliseconds before drag activates (default: 200) |

`Draggable` and `useDraggable` support:

| Prop | Description |
|---|---|
| `onPress` | Called on tap/click (not after drag) |
| `longPressDuration` | Milliseconds before drag activates (default: 200) |

### Drag Handles

Use `DragHandle` to restrict dragging to a specific area. The parent `Draggable` (or list component) must have `handle` set to `true`:

```tsx
<SortableList handle renderItem={({ item }) => (
  <View style={styles.row}>
    <DragHandle>
      <View style={styles.grip}>
        <Text>⠿</Text>
      </View>
    </DragHandle>
    <Text>{item.label}</Text>
  </View>
)} />
```

Without the `handle` prop on the parent, `DragHandle` renders passively with no drag behavior.

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

Scan with [Expo Go](https://expo.dev/go) to try all 5 demos on your phone:

<a href="https://expo.dev/accounts/jarngotostos/projects/expo-dnd-example">
  <img src="https://qr.expo.dev/eas-update?projectId=cd6c8cd2-7c32-439a-a2f9-06e785c221d0&runtimeVersion=1.0.0&channel=preview&appScheme=exp" width="160" alt="Expo Go QR Code" />
</a>

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

### Reduced Motion

The library respects the device's reduced motion preference when configured:

```tsx
import { setReducedMotion } from '@botjaeger/expo-dnd';

// Call at app startup
setReducedMotion(true); // All animations become instant (duration: 0)
```

Use `isReducedMotion()` to check the current state.

## License

MIT
