import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
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

// ── Shared types ─────────────────────────────────────────────────────────────
const DRAG_EFFECTS = ['none', 'pickup', 'scaleUp', 'scaleDown', 'bounce'] as const;
type DragEffectOption = (typeof DRAG_EFFECTS)[number];

// ── Shared components ────────────────────────────────────────────────────────

function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.effectPicker}>
      <Text style={s.effectLabel}>{label}</Text>
      <View style={s.effectOptions}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[s.effectBtn, value === opt && s.effectBtnActive]}
            onPress={() => onChange(opt)}
            activeOpacity={0.7}
          >
            <Text style={[s.effectBtnText, value === opt && s.effectBtnTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function ResetButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={s.resetBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.resetText}>{'\u21BB'} Reset</Text>
    </TouchableOpacity>
  );
}

function EventLog({ log, placeholder }: { log: string; placeholder: string }) {
  return (
    <View style={s.logBox}>
      <Text style={s.logText} numberOfLines={3}>
        {log || placeholder}
      </Text>
    </View>
  );
}

function DemoHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <View style={s.demoHeader}>
      <Text style={s.demoTitle}>{title}</Text>
      <Text style={s.demoDesc}>{desc}</Text>
    </View>
  );
}

// ── Insert indicator ─────────────────────────────────────────────────────────
const renderInsertIndicator = (index: number) => (
  <View style={s.insertBar}>
    <View style={s.insertDot} />
    <View style={s.insertLine} />
    <Text style={s.insertLabel}>{index}</Text>
    <View style={s.insertLine} />
    <View style={s.insertDot} />
  </View>
);

// ── Demo selector ────────────────────────────────────────────────────────────
const DEMOS = [
  { key: 'basic', label: 'Drag & Drop' },
  { key: 'sortable', label: 'Sortable' },
  { key: 'cross', label: 'Cross-List' },
  { key: 'variable', label: 'Var Heights' },
  { key: 'hooks', label: 'Hooks' },
] as const;
type DemoKey = (typeof DEMOS)[number]['key'];

// ── Demo 1: Basic Drag & Drop ───────────────────────────────────────────────
const DEMO1_ITEMS = [
  { id: 'item-1', label: 'Apple' },
  { id: 'item-2', label: 'Banana' },
  { id: 'item-3', label: 'Cherry' },
];

function Demo1() {
  const [placements, setPlacements] = useState<Record<string, string | null>>({
    'item-1': null, 'item-2': null, 'item-3': null,
  });
  const [log, setLog] = useState('');
  const [effect, setEffect] = useState<DragEffectOption>('bounce');

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (event.over) {
      setPlacements(prev => ({ ...prev, [event.active.id]: event.over!.id }));
      setLog(prev => `Dropped ${event.active.id} on ${event.over!.id}` + (prev ? '\n' + prev : ''));
    } else {
      setLog(prev => 'Released outside — item returned' + (prev ? '\n' + prev : ''));
    }
  }, []);

  const unplaced = DEMO1_ITEMS.filter(i => placements[i.id] === null);
  const zoneA = DEMO1_ITEMS.filter(i => placements[i.id] === 'zone-a');
  const zoneB = DEMO1_ITEMS.filter(i => placements[i.id] === 'zone-b');

  const reset = useCallback(() => {
    setPlacements({ 'item-1': null, 'item-2': null, 'item-3': null });
    setLog('');
  }, []);

  return (
    <View style={s.demoWrap}>
      <DemoHeader
        title="Basic Drag & Drop"
        desc="Drag items onto zones. Items snap back if released outside."
      />
      <DndProvider onDragEnd={handleDragEnd} dragEffect={effect === 'none' ? undefined : effect}>
        <Text style={s.label}>Items</Text>
        <View style={s.row}>
          {unplaced.map(item => (
            <Draggable key={item.id} id={item.id} activeDragStyle={{ opacity: 0.2 }}>
              <View style={s.chip}>
                <Text style={s.chipText}>{item.label}</Text>
              </View>
            </Draggable>
          ))}
          {unplaced.length === 0 && <Text style={s.hint}>all items placed</Text>}
        </View>

        <View style={s.zonesRow}>
          {(['zone-a', 'zone-b'] as const).map((zoneId, i) => {
            const items = i === 0 ? zoneA : zoneB;
            return (
              <Droppable key={zoneId} id={zoneId} activeStyle={s.zoneActive} activeEffect="bounce">
                {({ isOver }) => (
                  <View style={s.zone}>
                    <Text style={[s.zoneLabel, isOver && { color: C.accent }]}>
                      {i === 0 ? 'Zone A' : 'Zone B'}
                    </Text>
                    {items.length > 0 ? (
                      items.map(item => (
                        <Draggable key={item.id} id={item.id} activeDragStyle={{ opacity: 0.2 }}>
                          <View style={s.zoneItem}>
                            <Text style={s.zoneItemText}>{item.label}</Text>
                          </View>
                        </Draggable>
                      ))
                    ) : (
                      <Text style={s.hint}>{isOver ? 'release to drop' : 'drop here'}</Text>
                    )}
                  </View>
                )}
              </Droppable>
            );
          })}
        </View>
      </DndProvider>

      <OptionPicker label="dragEffect" options={DRAG_EFFECTS} value={effect} onChange={setEffect} />
      <EventLog log={log} placeholder="// drag items onto zones — onDragEnd fires" />
      <ResetButton onPress={reset} />
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
  const [log, setLog] = useState('');
  const [effect, setEffect] = useState<DragEffectOption>('pickup');

  return (
    <View style={s.demoWrap}>
      <DemoHeader
        title="Sortable List"
        desc="Long-press to reorder. Items animate into place with spring physics."
      />
      <DndProvider>
        <SortableList
          data={items}
          keyExtractor={(item) => item.id}
          direction="vertical"
          dragEffect={effect === 'none' ? undefined : effect}
          activeDragStyle={{ opacity: 0.3 }}
          renderInsertIndicator={renderInsertIndicator}
          renderItem={({ item, isDragging }) => (
            <View style={[s.sortRow, isDragging && { opacity: 0.4 }]}>
              <Text style={s.grip}>{'\u2807'}</Text>
              <Text style={s.sortLabel}>{item.label}</Text>
            </View>
          )}
          onReorder={(data, event) => {
            setItems(data);
            setLog(prev =>
              `Moved "${data[event.toIndex].label}" ${event.fromIndex} → ${event.toIndex}` +
              (prev ? '\n' + prev : '')
            );
          }}
        />
        <Droppable id="spike-zone" activeEffect="bounce">
          {({ isOver }) => (
            <View style={[s.zone, { marginTop: 12 }]}>
              <Text style={s.zoneLabel}>
                {isOver ? 'SORTABLE ITEM DETECTED!' : 'Spike: drag sortable item here'}
              </Text>
            </View>
          )}
        </Droppable>
      </DndProvider>
      <OptionPicker label="dragEffect" options={DRAG_EFFECTS} value={effect} onChange={setEffect} />
      <EventLog log={log} placeholder="// long-press to reorder — onReorder fires" />
      <ResetButton onPress={() => { setItems(SORT_ITEMS); setLog(''); }} />
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
  { id: 't6', label: 'Database schema' },
  { id: 't7', label: 'Caching layer' },
  { id: 't8', label: 'Rate limiting' },
  { id: 't9', label: 'Logging setup' },
  { id: 't10', label: 'Monitoring' },
  { id: 't11', label: 'Load testing' },
  { id: 't12', label: 'Docs site' },
  { id: 't13', label: 'SDK wrapper' },
  { id: 't14', label: 'Webhook system' },
  { id: 't15', label: 'Search indexing' },
];
const INIT_DONE: TaskItem[] = [
  { id: 'd1', label: 'Project setup' },
  { id: 'd2', label: 'CI pipeline' },
  { id: 'd3', label: 'Linting config' },
  { id: 'd4', label: 'Type definitions' },
  { id: 'd5', label: 'Deploy scripts' },
];

const xActiveContainerStyle = {
  borderWidth: 1,
  borderColor: C.accent,
  backgroundColor: 'rgba(59, 130, 246, 0.06)',
  borderRadius: 6,
};

function Demo3() {
  const [todo, setTodo] = useState(INIT_TODO);
  const [done, setDone] = useState(INIT_DONE);
  const [log, setLog] = useState('');
  const [effect, setEffect] = useState<DragEffectOption>('scaleUp');

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
      setLog(prev => `Reordered in ${fromListId}` + (prev ? '\n' + prev : ''));
    } else {
      (fromListId === 'todo' ? setTodo : setDone)(prev => prev.filter(i => i.id !== item.id));
      (toListId === 'todo' ? setTodo : setDone)(prev => [
        ...prev.slice(0, toIndex), item, ...prev.slice(toIndex),
      ]);
      setLog(prev => `Moved "${item.label}" → ${toListId}` + (prev ? '\n' + prev : ''));
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
      <DemoHeader
        title="Cross-List Transfer"
        desc="Drag between lists to transfer, or within a list to reorder."
      />
      <DraggableListGroup onDrop={handleDrop} dragEffect={effect === 'none' ? undefined : effect}>
        <View style={s.xCols}>
          <View style={s.xCol}>
            <Text style={s.xColTitle}>To Do</Text>
            <DraggableList
              id="todo"
              data={todo}
              keyExtractor={(i) => i.id}
              itemSize={40}
              containerSize={400}
              direction="vertical"
              renderItem={renderItem}
              activeContainerStyle={xActiveContainerStyle}
              activeDragStyle={{ opacity: 0.3 }}
              renderInsertIndicator={renderInsertIndicator}
            />
          </View>
          <View style={s.xDivider} />
          <View style={s.xCol}>
            <Text style={s.xColTitle}>Done</Text>
            <DraggableList
              id="done"
              data={done}
              keyExtractor={(i) => i.id}
              itemSize={40}
              containerSize={400}
              direction="vertical"
              renderItem={renderItem}
              activeContainerStyle={xActiveContainerStyle}
              activeDragStyle={{ opacity: 0.3 }}
              renderInsertIndicator={renderInsertIndicator}
            />
          </View>
        </View>
      </DraggableListGroup>
      <OptionPicker label="dragEffect" options={DRAG_EFFECTS} value={effect} onChange={setEffect} />
      <EventLog log={log} placeholder="// drag between lists — onDrop fires" />
      <ResetButton onPress={() => { setTodo(INIT_TODO); setDone(INIT_DONE); setLog(''); }} />
    </View>
  );
}

// ── Demo 4: Variable Heights ────────────────────────────────────────────────
interface VarItem { id: string; title: string; body?: string }

const VAR_ITEMS: VarItem[] = [
  { id: 'v1', title: 'Quick note' },
  { id: 'v2', title: 'With details', body: 'Some extra context about this item that takes more space.' },
  { id: 'v3', title: 'Tall card', body: 'Line one of the description.\nLine two with more info.\nLine three wraps further.' },
  { id: 'v4', title: 'Another short one' },
  { id: 'v5', title: 'Medium card', body: 'A brief description here.' },
  { id: 'v6', title: 'Tiny' },
];

function Demo4() {
  const [items, setItems] = useState(VAR_ITEMS);
  const [log, setLog] = useState('');
  const [effect, setEffect] = useState<DragEffectOption>('pickup');

  return (
    <View style={s.demoWrap}>
      <DemoHeader
        title="Variable Heights"
        desc="No itemSize needed — each item is measured after render."
      />
      <SortableList
        data={items}
        keyExtractor={(item) => item.id}
        direction="vertical"
        dragEffect={effect === 'none' ? undefined : effect}
        activeDragStyle={{ opacity: 0.3 }}
        renderItem={({ item, isDragging }) => (
          <View style={[s.varCard, isDragging && { opacity: 0.4 }]}>
            <Text style={s.varTitle}>{item.title}</Text>
            {item.body && <Text style={s.varBody}>{item.body}</Text>}
          </View>
        )}
        onReorder={(data, event) => {
          setItems(data);
          setLog(prev =>
            `Moved "${data[event.toIndex].title}" ${event.fromIndex} → ${event.toIndex}` +
            (prev ? '\n' + prev : '')
          );
        }}
      />
      <OptionPicker label="dragEffect" options={DRAG_EFFECTS} value={effect} onChange={setEffect} />
      <EventLog log={log} placeholder="// auto-measured heights — no itemSize prop" />
      <ResetButton onPress={() => { setItems(VAR_ITEMS); setLog(''); }} />
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
    <GestureDetector gesture={gesture as any}>
      <Animated.View ref={ref as any} style={[s.hookItem, animatedStyle] as any} onLayout={onLayout as any}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function CustomDropZone({ id, label, items }: { id: string; label: string; items: string[] }) {
  const { ref, isOver, activeStyle, onLayout } = useDroppable({ id, activeEffect: 'bounce' });
  return (
    <Animated.View ref={ref as any} style={[s.hookZone, activeStyle] as any} onLayout={onLayout as any}>
      <Text style={s.hookZoneLabel}>{label}</Text>
      {items.length > 0 ? (
        <View style={{ gap: 4 }}>
          {items.map(i => (
            <View key={i} style={s.hookDropped}>
              <Text style={s.hookDroppedText}>{i}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={s.hint}>drop here</Text>
      )}
    </Animated.View>
  );
}

function DragIndicator() {
  const { isDragging } = useDndContext();
  const style = useAnimatedStyle(() => ({ opacity: isDragging.value ? 1 : 0.3 }));
  return (
    <Animated.View style={[s.indicatorWrap, style] as any}>
      <Text style={s.indicator}>{'\u25CF'} drag active</Text>
    </Animated.View>
  );
}

const HOOK_ITEMS = ['Alpha', 'Beta', 'Gamma'];

function Demo5() {
  const [placed, setPlaced] = useState<Record<string, string | null>>({
    Alpha: null, Beta: null, Gamma: null,
  });
  const [log, setLog] = useState('');

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (event.over) {
      setPlaced(prev => ({ ...prev, [event.active.id]: event.over!.id }));
      setLog(prev => `${event.active.id} → ${event.over!.id}` + (prev ? '\n' + prev : ''));
    }
  }, []);

  const unplaced = HOOK_ITEMS.filter(id => placed[id] === null);

  return (
    <View style={s.demoWrap}>
      <DemoHeader
        title="Custom Hooks"
        desc="Built with useDraggable + useDroppable + useDndContext hooks."
      />
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
      <EventLog log={log} placeholder="// useDraggable + useDroppable + useDndContext" />
      <ResetButton onPress={() => { setPlaced({ Alpha: null, Beta: null, Gamma: null }); setLog(''); }} />
    </View>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState<DemoKey>('basic');

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={s.root}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>expo-dnd</Text>
          <Text style={s.subtitle}>demo</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tabs}
          contentContainerStyle={s.tabsContent}
        >
          {DEMOS.map(({ key, label }) => (
            <TouchableOpacity key={key} onPress={() => setActive(key)} activeOpacity={0.7}>
              <View style={[s.tab, active === key && s.tabActive]}>
                <Text style={[s.tabText, active === key && s.tabTextActive]}>{label}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={s.contentWrap}>
          <ScrollView
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {active === 'basic' && <Demo1 />}
            {active === 'sortable' && <Demo2 />}
            {active === 'cross' && <Demo3 />}
            {active === 'variable' && <Demo4 />}
            {active === 'hooks' && <Demo5 />}
          </ScrollView>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontFamily: 'monospace', fontSize: 20, fontWeight: '800', color: C.text },
  subtitle: { fontFamily: 'monospace', fontSize: 13, color: C.dim },

  // Tabs
  tabs: { maxHeight: 44, marginTop: 12 },
  tabsContent: { paddingHorizontal: 12, gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: C.surface },
  tabActive: { backgroundColor: C.accent },
  tabText: { fontFamily: 'monospace', fontSize: 12, color: C.muted },
  tabTextActive: { color: '#fff', fontWeight: '600' },

  // Content
  contentWrap: { flex: 1, overflow: 'visible' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  demoWrap: {},

  // Demo header
  demoHeader: { marginBottom: 16 },
  demoTitle: { fontFamily: 'monospace', fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 4 },
  demoDesc: { fontFamily: 'monospace', fontSize: 12, color: C.muted, lineHeight: 18 },

  // Shared
  label: { fontFamily: 'monospace', fontSize: 11, fontWeight: '600', color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  hint: { fontFamily: 'monospace', fontSize: 12, color: C.dim },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // Reset button
  resetBtn: { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  resetText: { fontFamily: 'monospace', fontSize: 11, color: C.dim },

  // Event log
  logBox: { marginTop: 12, backgroundColor: C.surface, borderRadius: 6, padding: 10, borderWidth: 1, borderColor: C.border },
  logText: { fontFamily: 'monospace', fontSize: 11, color: C.dim, lineHeight: 16 },

  // Effect picker
  effectPicker: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  effectLabel: { fontFamily: 'monospace', fontSize: 10, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 },
  effectOptions: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  effectBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  effectBtnActive: { backgroundColor: C.accent, borderColor: C.accent },
  effectBtnText: { fontFamily: 'monospace', fontSize: 10, color: C.muted },
  effectBtnTextActive: { color: '#fff', fontWeight: '600' },

  // Insert indicator
  insertBar: { flexDirection: 'row', alignItems: 'center', height: 12, marginVertical: 2, paddingHorizontal: 4 },
  insertDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accent },
  insertLine: { flex: 1, height: 2, backgroundColor: C.accent },
  insertLabel: { fontFamily: 'monospace', fontSize: 9, color: C.accent, fontWeight: '700', marginHorizontal: 4 },

  // Demo 1 — Basic Drag & Drop
  chip: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { fontFamily: 'monospace', fontSize: 13, color: C.text },
  zonesRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  zone: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 14, minHeight: 100 },
  zoneActive: { borderColor: C.accent, backgroundColor: 'rgba(59,130,246,0.06)' },
  zoneLabel: { fontFamily: 'monospace', fontSize: 11, fontWeight: '600', color: C.dim, textTransform: 'uppercase', marginBottom: 8 },
  zoneItem: { backgroundColor: C.surface, borderRadius: 6, padding: 8, marginBottom: 4 },
  zoneItemText: { fontFamily: 'monospace', fontSize: 12, color: C.text },

  // Demo 2 — Sortable
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 6 },
  grip: { fontSize: 16, color: C.dim },
  sortLabel: { fontFamily: 'monospace', fontSize: 13, color: C.text, flex: 1 },

  // Demo 3 — Cross-List
  xCols: { flexDirection: 'row', gap: 12 },
  xCol: { flex: 1 },
  xColTitle: { fontFamily: 'monospace', fontSize: 11, fontWeight: '600', color: C.dim, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  xDivider: { width: 1, backgroundColor: C.border },
  xItem: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 9 },
  xItemText: { fontFamily: 'monospace', fontSize: 12, color: C.text },

  // Demo 4 — Variable Heights
  varCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, marginBottom: 6 },
  varTitle: { fontFamily: 'monospace', fontSize: 13, fontWeight: '600', color: C.text },
  varBody: { fontFamily: 'monospace', fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 16 },

  // Demo 5 — Custom Hooks
  hookItem: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  hookItemText: { fontFamily: 'monospace', fontSize: 13, fontWeight: '600', color: C.accent },
  hookZone: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 10, borderStyle: 'dashed', padding: 14, minHeight: 80, alignItems: 'center' },
  hookZoneLabel: { fontFamily: 'monospace', fontSize: 10, fontWeight: '600', color: C.dim, textTransform: 'uppercase', marginBottom: 8 },
  hookDropped: { backgroundColor: C.surface, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4 },
  hookDroppedText: { fontFamily: 'monospace', fontSize: 12, color: C.text },
  indicatorWrap: { marginBottom: 4 },
  indicator: { fontFamily: 'monospace', fontSize: 11, color: C.green },
});
