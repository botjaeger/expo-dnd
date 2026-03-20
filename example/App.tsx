import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import {
  DndProvider,
  Draggable,
  Droppable,
  SortableList,
  DraggableListGroup,
  DraggableList,
  useDraggable,
  useDroppable,
  useDndContext,
} from '../src';
import type { DragEndEvent, DropEvent } from '../src';

// ── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#262626',
  text: '#fafafa',
  muted: '#a1a1aa',
  dim: '#525252',
  accent: '#3b82f6',
  green: '#22c55e',
  purple: '#8b5cf6',
  orange: '#f97316',
  teal: '#14b8a6',
};

// ── Demo selector ────────────────────────────────────────────────────────────
const DEMOS = [
  'Drag & Drop',
  'Sortable',
  'Cross-List',
  'Variable Heights',
  'Custom Hooks',
] as const;
type DemoName = (typeof DEMOS)[number];

// ── Demo 1: Basic Drag & Drop ───────────────────────────────────────────────
const DEMO1_ITEMS = [
  { id: 'item-1', label: 'Apple', emoji: '🍎' },
  { id: 'item-2', label: 'Banana', emoji: '🍌' },
  { id: 'item-3', label: 'Cherry', emoji: '🍒' },
];

function Demo1() {
  const [placements, setPlacements] = useState<Record<string, string | null>>({
    'item-1': null, 'item-2': null, 'item-3': null,
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (event.over) {
      setPlacements(prev => ({ ...prev, [event.active.id]: event.over!.id }));
    }
  }, []);

  const unplaced = DEMO1_ITEMS.filter(i => placements[i.id] === null);
  const zoneA = DEMO1_ITEMS.filter(i => placements[i.id] === 'zone-a');
  const zoneB = DEMO1_ITEMS.filter(i => placements[i.id] === 'zone-b');

  return (
    <View style={s.demoWrap}>
      <DndProvider onDragEnd={handleDragEnd} dragEffect="bounce">
        <Text style={s.label}>Items</Text>
        <View style={s.row}>
          {unplaced.map(item => (
            <Draggable key={item.id} id={item.id} activeDragStyle={{ opacity: 0.2 }}>
              <View style={s.chip}>
                <Text style={s.chipText}>{item.emoji} {item.label}</Text>
              </View>
            </Draggable>
          ))}
          {unplaced.length === 0 && <Text style={s.hint}>all placed</Text>}
        </View>

        <View style={s.zonesRow}>
          {(['zone-a', 'zone-b'] as const).map((zoneId, i) => {
            const items = i === 0 ? zoneA : zoneB;
            return (
              <Droppable key={zoneId} id={zoneId} activeStyle={s.zoneActive} activeEffect="pickup">
                {({ isOver }) => (
                  <View style={s.zone}>
                    <Text style={[s.zoneLabel, isOver && { color: C.accent }]}>
                      {i === 0 ? 'Zone A' : 'Zone B'}
                    </Text>
                    {items.length > 0 ? (
                      items.map(item => (
                        <View key={item.id} style={s.zoneItem}>
                          <Text style={s.zoneItemText}>{item.emoji} {item.label}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={s.hint}>{isOver ? 'release!' : 'drop here'}</Text>
                    )}
                  </View>
                )}
              </Droppable>
            );
          })}
        </View>
      </DndProvider>
      <TouchableOpacity style={s.resetBtn} onPress={() => setPlacements({ 'item-1': null, 'item-2': null, 'item-3': null })}>
        <Text style={s.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Demo 2: Sortable List ───────────────────────────────────────────────────
interface SortItem { id: string; label: string }

const SORT_ITEMS: SortItem[] = [
  { id: '1', label: 'Build UI components' },
  { id: '2', label: 'Add gesture handling' },
  { id: '3', label: 'Implement animations' },
  { id: '4', label: 'Write documentation' },
  { id: '5', label: 'Ship to npm' },
];

function Demo2() {
  const [items, setItems] = useState(SORT_ITEMS);

  return (
    <View style={s.demoWrap}>
      <SortableList
        data={items}
        keyExtractor={(item) => item.id}
        direction="vertical"
        dragEffect="pickup"
        activeDragStyle={{ opacity: 0.3 }}
        renderItem={({ item, isDragging }) => (
          <View style={[s.sortRow, isDragging && { opacity: 0.4 }]}>
            <Text style={s.grip}>{'\u2807'}</Text>
            <Text style={s.sortLabel}>{item.label}</Text>
          </View>
        )}
        onReorder={(data) => setItems(data)}
      />
      <TouchableOpacity style={s.resetBtn} onPress={() => setItems(SORT_ITEMS)}>
        <Text style={s.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Demo 3: Cross-List ──────────────────────────────────────────────────────
interface TaskItem { id: string; label: string }

const INIT_TODO: TaskItem[] = [
  { id: 't1', label: 'Design system' },
  { id: 't2', label: 'API layer' },
  { id: 't3', label: 'Testing' },
  { id: 't4', label: 'Auth module' },
  { id: 't5', label: 'Error handling' },
];
const INIT_DONE: TaskItem[] = [
  { id: 'd1', label: 'Project setup' },
  { id: 'd2', label: 'CI pipeline' },
];

function Demo3() {
  const [todo, setTodo] = useState(INIT_TODO);
  const [done, setDone] = useState(INIT_DONE);

  const handleDrop = useCallback((event: DropEvent<TaskItem>) => {
    const { item, fromListId, fromIndex, toListId, toIndex } = event;
    if (fromListId === toListId) {
      const setter = fromListId === 'todo' ? setTodo : setDone;
      setter(prev => {
        const next = [...prev];
        next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        return next;
      });
    } else {
      (fromListId === 'todo' ? setTodo : setDone)(prev => prev.filter(i => i.id !== item.id));
      (toListId === 'todo' ? setTodo : setDone)(prev => [
        ...prev.slice(0, toIndex), item, ...prev.slice(toIndex),
      ]);
    }
  }, []);

  const renderItem = useCallback(
    ({ item, isDragging }: { item: TaskItem; isDragging: boolean }) => (
      <View style={[s.xItem, isDragging && { opacity: 0.4 }]}>
        <Text style={s.xItemText}>{item.label}</Text>
      </View>
    ), []
  );

  return (
    <View style={s.demoWrap}>
      <DraggableListGroup onDrop={handleDrop} dragEffect="scaleUp">
        <View style={s.xCols}>
          <View style={s.xCol}>
            <Text style={s.label}>To Do</Text>
            <DraggableList
              id="todo"
              data={todo}
              keyExtractor={(i) => i.id}
              itemSize={40}
              direction="vertical"
              renderItem={renderItem}
              activeDragStyle={{ opacity: 0.3 }}
            />
          </View>
          <View style={s.xDivider} />
          <View style={s.xCol}>
            <Text style={s.label}>Done</Text>
            <DraggableList
              id="done"
              data={done}
              keyExtractor={(i) => i.id}
              itemSize={40}
              direction="vertical"
              renderItem={renderItem}
              activeDragStyle={{ opacity: 0.3 }}
            />
          </View>
        </View>
      </DraggableListGroup>
      <TouchableOpacity style={s.resetBtn} onPress={() => { setTodo(INIT_TODO); setDone(INIT_DONE); }}>
        <Text style={s.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Demo 4: Variable Heights ────────────────────────────────────────────────
interface VarItem { id: string; title: string; body?: string }

const VAR_ITEMS: VarItem[] = [
  { id: 'v1', title: 'Quick note' },
  { id: 'v2', title: 'With details', body: 'Some extra context about this item.' },
  { id: 'v3', title: 'Tall card', body: 'Line one.\nLine two.\nLine three.' },
  { id: 'v4', title: 'Another short one' },
  { id: 'v5', title: 'Medium card', body: 'A brief description.' },
];

function Demo4() {
  const [items, setItems] = useState(VAR_ITEMS);

  return (
    <View style={s.demoWrap}>
      <SortableList
        data={items}
        keyExtractor={(item) => item.id}
        direction="vertical"
        dragEffect="pickup"
        activeDragStyle={{ opacity: 0.3 }}
        renderItem={({ item, isDragging }) => (
          <View style={[s.varCard, isDragging && { opacity: 0.4 }]}>
            <Text style={s.varTitle}>{item.title}</Text>
            {item.body && <Text style={s.varBody}>{item.body}</Text>}
          </View>
        )}
        onReorder={(data) => setItems(data)}
      />
      <TouchableOpacity style={s.resetBtn} onPress={() => setItems(VAR_ITEMS)}>
        <Text style={s.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Demo 5: Custom Hooks ────────────────────────────────────────────────────
function CustomDraggableItem({ id, children }: { id: string; children: React.ReactNode }) {
  const ctx = useDndContext();
  const { ref, gesture, animatedStyle, onLayout } = useDraggable({ id });
  const childRef = useRef(children);
  childRef.current = children;

  useEffect(() => {
    ctx.registerDragRenderer(id, () => childRef.current);
    return () => ctx.unregisterDragRenderer(id);
  }, [id, ctx]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View ref={ref as any} style={[s.hookItem, animatedStyle] as any} onLayout={onLayout}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function CustomDropZone({ id, label, items }: { id: string; label: string; items: string[] }) {
  const { ref, isOver, activeStyle, onLayout } = useDroppable({ id, activeEffect: 'bounce' });
  return (
    <Animated.View ref={ref as any} style={[s.hookZone, activeStyle] as any} onLayout={onLayout}>
      <Text style={s.hookZoneLabel}>{label}</Text>
      {items.length > 0
        ? items.map(i => <Text key={i} style={s.hookDropped}>{i}</Text>)
        : <Text style={s.hint}>drop here</Text>
      }
    </Animated.View>
  );
}

function DragIndicator() {
  const { isDragging } = useDndContext();
  const style = useAnimatedStyle(() => ({ opacity: isDragging.value ? 1 : 0.3 }));
  return (
    <Animated.View style={style}>
      <Text style={s.indicator}>{'\u25CF'} drag active</Text>
    </Animated.View>
  );
}

const HOOK_ITEMS = ['Alpha', 'Beta', 'Gamma'];

function Demo5() {
  const [placed, setPlaced] = useState<Record<string, string | null>>({
    Alpha: null, Beta: null, Gamma: null,
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (event.over) {
      setPlaced(prev => ({ ...prev, [event.active.id]: event.over!.id }));
    }
  }, []);

  const unplaced = HOOK_ITEMS.filter(id => placed[id] === null);

  return (
    <View style={s.demoWrap}>
      <DndProvider onDragEnd={handleDragEnd} dragEffect="bounce">
        <DragIndicator />
        <View style={[s.row, { marginVertical: 12 }]}>
          {unplaced.map(id => (
            <CustomDraggableItem key={id} id={id}>
              <Text style={s.hookItemText}>{id}</Text>
            </CustomDraggableItem>
          ))}
          {unplaced.length === 0 && <Text style={s.hint}>all placed</Text>}
        </View>
        <View style={s.zonesRow}>
          <CustomDropZone id="left" label="Left" items={HOOK_ITEMS.filter(i => placed[i] === 'left')} />
          <CustomDropZone id="right" label="Right" items={HOOK_ITEMS.filter(i => placed[i] === 'right')} />
        </View>
      </DndProvider>
      <TouchableOpacity style={s.resetBtn} onPress={() => setPlaced({ Alpha: null, Beta: null, Gamma: null })}>
        <Text style={s.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState<DemoName>('Drag & Drop');

  return (
    <GestureHandlerRootView style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe}>
        <Text style={s.title}>expo-dnd</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={s.tabsContent}>
          {DEMOS.map(name => (
            <TouchableOpacity key={name} onPress={() => setActive(name)} activeOpacity={0.7}>
              <View style={[s.tab, active === name && s.tabActive]}>
                <Text style={[s.tabText, active === name && s.tabTextActive]}>{name}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={s.contentWrap}>
          {active === 'Drag & Drop' && <Demo1 />}
          {active === 'Sortable' && <Demo2 />}
          {active === 'Cross-List' && <Demo3 />}
          {active === 'Variable Heights' && <Demo4 />}
          {active === 'Custom Hooks' && <Demo5 />}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  title: { fontFamily: 'monospace', fontSize: 20, fontWeight: '800', color: C.text, paddingHorizontal: 16, paddingTop: 12 },
  tabs: { maxHeight: 44, marginTop: 12 },
  tabsContent: { paddingHorizontal: 12, gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.surface },
  tabActive: { backgroundColor: C.accent },
  tabText: { fontFamily: 'monospace', fontSize: 12, color: C.muted },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  content: { flex: 1 },
  contentWrap: { flex: 1, padding: 16 },
  contentInner: { padding: 16 },
  demoWrap: { flex: 1 },

  // Shared
  label: { fontFamily: 'monospace', fontSize: 11, fontWeight: '600', color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  hint: { fontFamily: 'monospace', fontSize: 12, color: C.dim },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resetBtn: { marginTop: 20, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  resetText: { fontFamily: 'monospace', fontSize: 12, color: C.dim },

  // Demo 1
  chip: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontFamily: 'monospace', fontSize: 13, color: C.text },
  zonesRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  zone: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, minHeight: 100 },
  zoneActive: { borderColor: C.accent, backgroundColor: 'rgba(59,130,246,0.06)' },
  zoneLabel: { fontFamily: 'monospace', fontSize: 11, fontWeight: '600', color: C.dim, textTransform: 'uppercase', marginBottom: 8 },
  zoneItem: { backgroundColor: C.surface, borderRadius: 6, padding: 8, marginBottom: 4 },
  zoneItemText: { fontFamily: 'monospace', fontSize: 12, color: C.text },

  // Demo 2
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6 },
  grip: { fontSize: 16, color: C.dim },
  sortLabel: { fontFamily: 'monospace', fontSize: 13, color: C.text, flex: 1 },

  // Demo 3
  xCols: { flexDirection: 'row', gap: 12 },
  xCol: { flex: 1, gap: 4 },
  xDivider: { width: 1, backgroundColor: C.border },
  xItem: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9 },
  xItemText: { fontFamily: 'monospace', fontSize: 12, color: C.text },

  // Demo 4
  varCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, marginBottom: 6 },
  varTitle: { fontFamily: 'monospace', fontSize: 13, fontWeight: '600', color: C.text },
  varBody: { fontFamily: 'monospace', fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 16 },

  // Demo 5
  hookItem: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  hookItemText: { fontFamily: 'monospace', fontSize: 13, fontWeight: '600', color: C.accent },
  hookZone: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, borderStyle: 'dashed', padding: 14, minHeight: 80, alignItems: 'center' },
  hookZoneLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '600', color: C.dim, textTransform: 'uppercase', marginBottom: 8 },
  hookDropped: { fontFamily: 'monospace', fontSize: 12, color: C.text, backgroundColor: C.surface, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4 },
  indicator: { fontFamily: 'monospace', fontSize: 11, color: C.green, marginBottom: 4 },
});
