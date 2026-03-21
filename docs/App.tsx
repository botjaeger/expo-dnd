import React, { useState, useRef, useCallback, useEffect } from 'react';
import { KanbanDemo } from './KanbanDemo';
import { SettingsDemo } from './SettingsDemo';
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { DragEndEvent, DropEvent } from '../src';

// ── Scroll context — shared between Nav, Sidebar, and App ────────────────────
// We store Y positions of sections so nav/sidebar links can scroll to them.
type ScrollCtx = {
  scrollTo: (y: number) => void;
  scrollToSection: (key: string) => void;
  positions: Record<string, number>;
};

// ── Color palette ──────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  border: '#262626',
  text: '#fafafa',
  muted: '#a1a1aa',
  dim: '#525252',
  accent: '#3b82f6',
  teal: '#14b8a6',
  purple: '#8b5cf6',
  green: '#22c55e',
  orange: '#f97316',
};

// ── Syntax-highlighted code renderer ─────────────────────────────────────────
// Each line is an array of [text, color?] segments.
// Omit color (or pass undefined) to use the default code color.
type Seg = readonly [string, string?];
type CodeLine = readonly Seg[];

function CodeBlock({ lines }: { lines: readonly CodeLine[] }) {
  return (
    <View style={cs.codeBlock}>
      {lines.map((segs, i) => (
        <Text key={i} style={cs.codeLine}>
          {segs.map(([txt, col], j) => (
            <Text key={j} style={[cs.codeText, col != null ? { color: col } : null]}>
              {txt}
            </Text>
          ))}
        </Text>
      ))}
    </View>
  );
}

// Colour aliases — keep these short
const KW   = C.purple;  // keywords: import, from, const, function, return, if, else
const TAG  = C.accent;  // JSX tags / component names
const STR  = C.teal;    // string literals
const PROP = C.muted;   // props / attributes
const CMT  = C.dim;     // comments
const TYP  = C.orange;  // TypeScript types

// ── Code snippets ─────────────────────────────────────────────────────────────
// All string values use double-quote delimiters so that single-quote / backtick
// characters that appear in code samples never conflict with the delimiter.

// Demo 1 — Basic Drag & Drop ─────────────────────────────
const BASIC_SETUP: readonly CodeLine[] = [
  [["import ", KW], ["{ DndProvider, Draggable, Droppable }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [["import ", KW], ["type ", KW], ["{ DragEndEvent }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["<", TAG], ["DndProvider", undefined], [" onDragEnd", PROP], ["={handleDragEnd}", undefined], [" dragEffect", PROP], ["=", undefined], ['"bounce"', STR], [">"]],
  [["  <", TAG], ["Draggable", undefined], [" id", PROP], ["=", undefined], ['"item-1"', STR], [" activeDragStyle", PROP], ["={{ opacity: 0.2 }}>"]],
  [["    <", TAG], ["View", undefined], [" style", PROP], ["={styles.card}>"]],
  [["      <", TAG], ["Text", undefined], [">Drag me</", TAG], ["Text", undefined], [">"]],
  [["    </", TAG], ["View", undefined], [">"]],
  [["  </", TAG], ["Draggable", undefined], [">"]],
  [[""]],
  [["  <", TAG], ["Droppable", undefined], [" id", PROP], ["=", undefined], ['"zone-a"', STR], [" activeStyle", PROP], ["={styles.zoneHover}>"]],
  [["    {({ ", undefined], ["isOver", PROP], [" }) => ("]],
  [["      <", TAG], ["View", undefined], [" style", PROP], ["={styles.zone}>"]],
  [["        <", TAG], ["Text", undefined], [">{isOver ? ", undefined], ["'Release!'", STR], [" : ", undefined], ["'Zone A'", STR], ["}</", TAG], ["Text", undefined], [">"]],
  [["      </", TAG], ["View", undefined], [">"]],
  [["    )}"]],
  [["  </", TAG], ["Droppable", undefined], [">"]],
  [["</", TAG], ["DndProvider", undefined], [">"]],
];

const BASIC_CALLBACKS: readonly CodeLine[] = [
  [["const ", KW], ["handleDragEnd = (", undefined], ["event", undefined], [": ", undefined], ["DragEndEvent", TYP], [") => {"]],
  [["  ", undefined], ["const ", KW], ["{ active, over } = event;"]],
  [[""]],
  [["  ", undefined], ["if ", KW], ["(over) {"]],
  [["    ", undefined], ["// item was dropped on a zone", CMT]],
  [["    console.log(`Dropped ${active.id} on ${over.id}`);"]],
  [["  } ", undefined], ["else ", KW], ["{"]],
  [["    ", undefined], ["// released outside any zone — snaps back", CMT]],
  [["    console.log(", undefined], ["'Cancelled'", STR], [");"]],
  [["  }"]],
  [["};"]],
];

const BASIC_FULL: readonly CodeLine[] = [
  [["import ", KW], ["{ useState }", undefined], [" from ", KW], ["'react'", STR]],
  [["import ", KW], ["{ View, Text }", undefined], [" from ", KW], ["'react-native'", STR]],
  [["import ", KW], ["{ DndProvider, Draggable, Droppable }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [["import ", KW], ["type ", KW], ["{ DragEndEvent }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["export ", KW], ["function ", KW], ["BasicExample() {"]],
  [["  ", undefined], ["const ", KW], ["[zone, setZone] = useState<", undefined], ["string | null", TYP], [">(", undefined], ["null", KW], [");"]],
  [[""]],
  [["  ", undefined], ["const ", KW], ["handleDragEnd = (", undefined], ["e", undefined], [": ", undefined], ["DragEndEvent", TYP], [") => {"]],
  [["    setZone(e.over?.id ?? ", undefined], ["null", KW], [");"]],
  [["  };"]],
  [[""]],
  [["  ", undefined], ["return ", KW], ["("]],
  [["    <", TAG], ["DndProvider", undefined], [" onDragEnd", PROP], ["={handleDragEnd}", undefined], [" dragEffect", PROP], ["=", undefined], ['"bounce"', STR], [">"]],
  [["      <", TAG], ["Draggable", undefined], [" id", PROP], ["=", undefined], ['"item-1"', STR], [" activeDragStyle", PROP], ["={{ opacity: 0.2 }}>"]],
  [["        <", TAG], ["View", undefined], [" style", PROP], ["={styles.card}>"]],
  [["          <", TAG], ["Text", undefined], [">Drag me</", TAG], ["Text", undefined], [">"]],
  [["        </", TAG], ["View", undefined], [">"]],
  [["      </", TAG], ["Draggable", undefined], [">"]],
  [["      <", TAG], ["Droppable", undefined], [" id", PROP], ["=", undefined], ['"zone-a"', STR], [" activeStyle", PROP], ["={styles.zoneHover}>"]],
  [["        {({ ", undefined], ["isOver", PROP], [" }) => ("]],
  [["          <", TAG], ["Text", undefined], [">{isOver ? ", undefined], ["'Release!'", STR], [" : ", undefined], ["'Zone A'", STR], ["}</", TAG], ["Text", undefined], [">"]],
  [["        )}"]],
  [["      </", TAG], ["Droppable", undefined], [">"]],
  [["    </", TAG], ["DndProvider", undefined], [">"]],
  [["  );"]],
  [["}"]],
];

// Demo 2 — Sortable List ─────────────────────────────────
const SORT_SETUP: readonly CodeLine[] = [
  [["import ", KW], ["{ SortableList }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["<", TAG], ["SortableList"]],
  [["  ", undefined], ["data", PROP], ["={items}"]],
  [["  ", undefined], ["keyExtractor", PROP], ["={(item) => item.id}"]],
  [["  ", undefined], ["direction", PROP], ["=", undefined], ['"vertical"', STR]],
  [["  ", undefined], ["dragEffect", PROP], ["=", undefined], ['"pickup"', STR]],
  [["  ", undefined], ["activeDragStyle", PROP], ["={{ opacity: 0.3 }}"]],
  [["  ", undefined], ["renderInsertIndicator", PROP], ["={renderIndicator}"]],
  [["  ", undefined], ["renderItem", PROP], ["={renderItem}"]],
  [["  ", undefined], ["onReorder", PROP], ["={handleReorder}"]],
  [["/>"]],
];

const SORT_CALLBACKS: readonly CodeLine[] = [
  [["// onReorder receives the reordered array + event info", CMT]],
  [["const ", KW], ["handleReorder = ("]],
  [["  ", undefined], ["data", undefined], [": ", undefined], ["Item[]", TYP], [","]],
  [["  ", undefined], ["event", undefined], [": { ", undefined], ["fromIndex", PROP], [": ", undefined], ["number", TYP], ["; ", undefined], ["toIndex", PROP], [": ", undefined], ["number", TYP], ["; ", undefined], ["item", PROP], [": ", undefined], ["Item", TYP], [" }"]],
  [[") => {"]],
  [["  setItems(data);", undefined], [" // data is already reordered", CMT]],
  [["};"]],
  [[""]],
  [["// renderItem receives isDragging for ghost styling", CMT]],
  [["const ", KW], ["renderItem = ({ ", undefined], ["item", PROP], [", ", undefined], ["isDragging", PROP], [" }) => ("]],
  [["  <", TAG], ["View", undefined], [" style", PROP], ["={[styles.row, isDragging && { opacity: 0.4 }]}>"]],
  [["    <", TAG], ["Text", undefined], [">⠿ {item.label}</", TAG], ["Text", undefined], [">"]],
  [["  </", TAG], ["View", undefined], [">"]],
  [[");"]],
];

const SORT_FULL: readonly CodeLine[] = [
  [["import ", KW], ["{ useState }", undefined], [" from ", KW], ["'react'", STR]],
  [["import ", KW], ["{ View, Text }", undefined], [" from ", KW], ["'react-native'", STR]],
  [["import ", KW], ["{ SortableList }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["const ", KW], ["ITEMS = ["]],
  [["  { id: ", undefined], ["'1'", STR], [", label: ", undefined], ["'Build UI'", STR], [" },"]],
  [["  { id: ", undefined], ["'2'", STR], [", label: ", undefined], ["'Add gestures'", STR], [" },"]],
  [["  { id: ", undefined], ["'3'", STR], [", label: ", undefined], ["'Animate'", STR], [" },"]],
  [["  { id: ", undefined], ["'4'", STR], [", label: ", undefined], ["'Document'", STR], [" },"]],
  [["  { id: ", undefined], ["'5'", STR], [", label: ", undefined], ["'Ship it'", STR], [" },"]],
  [["]; "]],
  [[""]],
  [["export ", KW], ["function ", KW], ["SortableExample() {"]],
  [["  ", undefined], ["const ", KW], ["[items, setItems] = useState(ITEMS);"]],
  [[""]],
  [["  ", undefined], ["return ", KW], ["("]],
  [["    <", TAG], ["SortableList"]],
  [["      ", undefined], ["data", PROP], ["={items}"]],
  [["      ", undefined], ["keyExtractor", PROP], ["={(item) => item.id}"]],
  [["      ", undefined], ["direction", PROP], ["=", undefined], ['"vertical"', STR]],
  [["      ", undefined], ["dragEffect", PROP], ["=", undefined], ['"pickup"', STR]],
  [["      ", undefined], ["activeDragStyle", PROP], ["={{ opacity: 0.3 }}"]],
  [["      ", undefined], ["renderInsertIndicator", PROP], ["={(idx) => <", undefined], ["Indicator", TAG], [" index={idx} />}"]],
  [["      ", undefined], ["renderItem", PROP], ["={({ item, isDragging }) => ("]],
  [["        <", TAG], ["View", undefined], [" style", PROP], ["={[s.row, isDragging && s.ghost]}>"]],
  [["          <", TAG], ["Text", undefined], [">⠿ {item.label}</", TAG], ["Text", undefined], [">"]],
  [["        </", TAG], ["View", undefined], [">"]],
  [["      )}"]],
  [["      ", undefined], ["onReorder", PROP], ["={(data) => setItems(data)}"]],
  [["    />"]],
  [["  );"]],
  [["}"]],
];

// Demo 3 — Cross-List Transfer ───────────────────────────
const XLIST_SETUP: readonly CodeLine[] = [
  [["import ", KW], ["{ DraggableListGroup, DraggableList }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [["import ", KW], ["type ", KW], ["{ DropEvent }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["<", TAG], ["DraggableListGroup", undefined], [" onDrop", PROP], ["={handleDrop}", undefined], [" dragEffect", PROP], ["=", undefined], ['"scaleUp"', STR], [">"]],
  [["  <", TAG], ["DraggableList"]],
  [["    ", undefined], ["id", PROP], ["=", undefined], ['"todo"', STR]],
  [["    ", undefined], ["data", PROP], ["={todoItems}"]],
  [["    ", undefined], ["keyExtractor", PROP], ["={(item) => item.id}"]],
  [["    ", undefined], ["itemSize", PROP], ["={40}"]],
  [["    ", undefined], ["containerSize", PROP], ["={400}"]],
  [["    ", undefined], ["activeDragStyle", PROP], ["={{ opacity: 0.3 }}"]],
  [["    ", undefined], ["activeContainerStyle", PROP], ["={hoverStyle}"]],
  [["    ", undefined], ["renderInsertIndicator", PROP], ["={renderIndicator}"]],
  [["    ", undefined], ["renderItem", PROP], ["={renderItem}"]],
  [["  />"]],
  [["  <", TAG], ["DraggableList", undefined], [" id", PROP], ["=", undefined], ['"done"', STR], [" ", undefined], ["...", CMT], [" />"]],
  [["</", TAG], ["DraggableListGroup", undefined], [">"]],
];

const XLIST_CALLBACKS: readonly CodeLine[] = [
  [["const ", KW], ["handleDrop = (", undefined], ["event", undefined], [": ", undefined], ["DropEvent", TYP], ["<", undefined], ["Task", TYP], [">) => {"]],
  [["  ", undefined], ["const ", KW], ["{ item, fromListId, fromIndex, toListId, toIndex } = event;"]],
  [[""]],
  [["  ", undefined], ["if ", KW], ["(fromListId === toListId) {"]],
  [["    ", undefined], ["// same-list reorder", CMT]],
  [["    reorder(fromListId, fromIndex, toIndex);"]],
  [["  } ", undefined], ["else ", KW], ["{"]],
  [["    ", undefined], ["// cross-list transfer", CMT]],
  [["    removeFrom(fromListId, fromIndex);"]],
  [["    insertInto(toListId, toIndex, item);"]],
  [["  }"]],
  [["};"]],
];

const XLIST_FULL: readonly CodeLine[] = [
  [["import ", KW], ["{ useState }", undefined], [" from ", KW], ["'react'", STR]],
  [["import ", KW], ["{ View, Text }", undefined], [" from ", KW], ["'react-native'", STR]],
  [["import ", KW], ["{ DraggableListGroup, DraggableList }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [["import ", KW], ["type ", KW], ["{ DropEvent }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["const ", KW], ["hoverStyle = { borderColor: ", undefined], ["'#3b82f6'", STR], [", borderWidth: 1 };"]],
  [[""]],
  [["export ", KW], ["function ", KW], ["KanbanBoard() {"]],
  [["  ", undefined], ["const ", KW], ["[todo, setTodo] = useState(INITIAL_TODO);"]],
  [["  ", undefined], ["const ", KW], ["[done, setDone] = useState(INITIAL_DONE);"]],
  [[""]],
  [["  ", undefined], ["const ", KW], ["handleDrop = (", undefined], ["e", undefined], [": ", undefined], ["DropEvent", TYP], ["<", undefined], ["Task", TYP], [">) => {"]],
  [["    ", undefined], ["if ", KW], ["(e.fromListId !== e.toListId) {"]],
  [["      setTodo(p => p.filter(i => i.id !== e.item.id));"]],
  [["      setDone(p => [...p.slice(0, e.toIndex), e.item, ...p.slice(e.toIndex)]);"]],
  [["    }"]],
  [["  };"]],
  [[""]],
  [["  ", undefined], ["return ", KW], ["("]],
  [["    <", TAG], ["DraggableListGroup", undefined], [" onDrop", PROP], ["={handleDrop}", undefined], [" dragEffect", PROP], ["=", undefined], ['"scaleUp"', STR], [">"]],
  [["      <", TAG], ["DraggableList"]],
  [["        ", undefined], ["id", PROP], ["=", undefined], ['"todo"', STR], [" ", undefined], ["data", PROP], ["={todo}"]],
  [["        ", undefined], ["keyExtractor", PROP], ["={(i) => i.id}"]],
  [["        ", undefined], ["itemSize", PROP], ["={40}", undefined], [" ", undefined], ["containerSize", PROP], ["={400}"]],
  [["        ", undefined], ["activeDragStyle", PROP], ["={{ opacity: 0.3 }}"]],
  [["        ", undefined], ["activeContainerStyle", PROP], ["={hoverStyle}"]],
  [["        ", undefined], ["renderInsertIndicator", PROP], ["={(idx) => <", undefined], ["Indicator", TAG], [" index={idx} />}"]],
  [["        ", undefined], ["renderItem", PROP], ["={({ item }) => ("]],
  [["          <", TAG], ["Text", undefined], [">{item.label}</", TAG], ["Text", undefined], [">"]],
  [["        )}"]],
  [["      />"]],
  [["      <", TAG], ["DraggableList", undefined], [" id", PROP], ["=", undefined], ['"done"', STR], [" ", undefined], ["data", PROP], ["={done}", undefined], [" ", undefined], ["...", CMT], [" />"]],
  [["    </", TAG], ["DraggableListGroup", undefined], [">"]],
  [["  );"]],
  [["}"]],
];

// Demo 4 — Variable Heights ──────────────────────────────
const VARH_SETUP: readonly CodeLine[] = [
  [["import ", KW], ["{ SortableList }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["// Items with different content lengths", CMT]],
  [["const ", KW], ["ITEMS = ["]],
  [["  { id: ", undefined], ["'1'", STR], [", title: ", undefined], ["'Short'", STR], [" },"]],
  [["  { id: ", undefined], ["'2'", STR], [", title: ", undefined], ["'Medium note'", STR], [", body: ", undefined], ["'Extra detail...'", STR], [" },"]],
  [["  { id: ", undefined], ["'3'", STR], [", title: ", undefined], ["'Tall card'", STR], [", body: ", undefined], ["'Multi-line...'", STR], [" },"]],
  [["]; "]],
  [[""]],
  [["<", TAG], ["SortableList"]],
  [["  ", undefined], ["data", PROP], ["={items}"]],
  [["  ", undefined], ["keyExtractor", PROP], ["={(item) => item.id}"]],
  [["  ", undefined], ["direction", PROP], ["=", undefined], ['"vertical"', STR]],
  [["  ", undefined], ["dragEffect", PROP], ["=", undefined], ['"pickup"', STR]],
  [["  ", undefined], ["renderItem", PROP], ["={renderItem}", undefined], [" // heights auto-measured", CMT]],
  [["  ", undefined], ["onReorder", PROP], ["={handleReorder}"]],
  [["/>"]],
];

const VARH_CALLBACKS: readonly CodeLine[] = [
  [["// No itemSize needed — SortableList measures each item", CMT]],
  [["// after render. Different heights are handled automatically.", CMT]],
  [[""]],
  [["const ", KW], ["renderItem = ({ ", undefined], ["item", PROP], [", ", undefined], ["isDragging", PROP], [" }) => ("]],
  [["  <", TAG], ["View", undefined], [" style", PROP], ["={[styles.card, isDragging && styles.ghost]}>"]],
  [["    <", TAG], ["Text", undefined], [" style", PROP], ["={styles.title}>{item.title}</", TAG], ["Text", undefined], [">"]],
  [["    {item.body && ("]],
  [["      <", TAG], ["Text", undefined], [" style", PROP], ["={styles.body}>{item.body}</", TAG], ["Text", undefined], [">"]],
  [["    )}"]],
  [["  </", TAG], ["View", undefined], [">"]],
  [[");"]],
];

const VARH_FULL: readonly CodeLine[] = [
  [["import ", KW], ["{ useState }", undefined], [" from ", KW], ["'react'", STR]],
  [["import ", KW], ["{ View, Text }", undefined], [" from ", KW], ["'react-native'", STR]],
  [["import ", KW], ["{ SortableList }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["const ", KW], ["ITEMS = ["]],
  [["  { id: ", undefined], ["'1'", STR], [", title: ", undefined], ["'Quick note'", STR], [" },"]],
  [["  { id: ", undefined], ["'2'", STR], [", title: ", undefined], ["'With details'", STR], [", body: ", undefined], ["'Extra info here'", STR], [" },"]],
  [["  { id: ", undefined], ["'3'", STR], [", title: ", undefined], ["'Long card'", STR], [", body: ", undefined], ["'Line 1\\nLine 2\\nLine 3'", STR], [" },"]],
  [["  { id: ", undefined], ["'4'", STR], [", title: ", undefined], ["'Another short one'", STR], [" },"]],
  [["]; "]],
  [[""]],
  [["export ", KW], ["function ", KW], ["VariableHeights() {"]],
  [["  ", undefined], ["const ", KW], ["[items, setItems] = useState(ITEMS);"]],
  [[""]],
  [["  ", undefined], ["return ", KW], ["("]],
  [["    <", TAG], ["SortableList"]],
  [["      ", undefined], ["data", PROP], ["={items}"]],
  [["      ", undefined], ["keyExtractor", PROP], ["={(item) => item.id}"]],
  [["      ", undefined], ["direction", PROP], ["=", undefined], ['"vertical"', STR]],
  [["      ", undefined], ["dragEffect", PROP], ["=", undefined], ['"pickup"', STR]],
  [["      ", undefined], ["activeDragStyle", PROP], ["={{ opacity: 0.3 }}"]],
  [["      ", undefined], ["renderItem", PROP], ["={({ item, isDragging }) => ("]],
  [["        <", TAG], ["View", undefined], [" style", PROP], ["={[s.card, isDragging && s.ghost]}>"]],
  [["          <", TAG], ["Text", undefined], [" style", PROP], ["={s.title}>{item.title}</", TAG], ["Text", undefined], [">"]],
  [["          {item.body && <", TAG], ["Text", undefined], [" style", PROP], ["={s.body}>{item.body}</", TAG], ["Text", undefined], [">}"]],
  [["        </", TAG], ["View", undefined], [">"]],
  [["      )}"]],
  [["      ", undefined], ["onReorder", PROP], ["={(data) => setItems(data)}"]],
  [["    />"]],
  [["  );"]],
  [["}"]],
];

// Demo 5 — Custom Hooks ──────────────────────────────────
const HOOKS_SETUP: readonly CodeLine[] = [
  [["import ", KW], ["{ DndProvider, useDraggable, useDroppable, useDndContext }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["function ", KW], ["CustomDraggable", TAG], ["({ id, children }) {"]],
  [["  ", undefined], ["const ", KW], ["ctx = useDndContext();"]],
  [["  ", undefined], ["const ", KW], ["{ ref, gesture, animatedStyle, onLayout } = useDraggable({ id });"]],
  [[""]],
  [["  ", undefined], ["// Register overlay renderer so the clone appears during drag", CMT]],
  [["  ", undefined], ["const ", KW], ["childRef = useRef(children);"]],
  [["  childRef.current = children;"]],
  [["  useEffect(() => {"]],
  [["    ctx.registerDragRenderer(id, () => childRef.current);"]],
  [["    ", undefined], ["return ", KW], ["() => ctx.unregisterDragRenderer(id);"]],
  [["  }, [id]);"]],
  [[""]],
  [["  ", undefined], ["return ", KW], ["("]],
  [["    <", TAG], ["GestureDetector", undefined], [" gesture", PROP], ["={gesture}>"]],
  [["      <", TAG], ["Animated.View", undefined], [" ref", PROP], ["={ref}", undefined], [" style", PROP], ["={animatedStyle}", undefined], [" onLayout", PROP], ["={onLayout}>"]],
  [["        {children}"]],
  [["      </", TAG], ["Animated.View", undefined], [">"]],
  [["    </", TAG], ["GestureDetector", undefined], [">"]],
  [["  );"]],
  [["}"]],
];

const HOOKS_CALLBACKS: readonly CodeLine[] = [
  [["function ", KW], ["CustomDropZone", TAG], ["({ id, children }) {"]],
  [["  ", undefined], ["const ", KW], ["{ ref, isOver, activeStyle, onLayout } = useDroppable({ id });"]],
  [[""]],
  [["  ", undefined], ["return ", KW], ["("]],
  [["    <", TAG], ["Animated.View", undefined], [" ref", PROP], ["={ref}", undefined], [" style", PROP], ["={[styles.zone, activeStyle]}", undefined], [" onLayout", PROP], ["={onLayout}>"]],
  [["      {children}"]],
  [["    </", TAG], ["Animated.View", undefined], [">"]],
  [["  );"]],
  [["}"]],
  [[""]],
  [["function ", KW], ["DragStatus", TAG], ["() {"]],
  [["  ", undefined], ["const ", KW], ["{ activeId, isDragging } = useDndContext();"]],
  [["  ", undefined], ["const ", KW], ["style = useAnimatedStyle(() => ({"]],
  [["    opacity: isDragging.value ? 1 : 0.3,"]],
  [["  }));"]],
  [["  ", undefined], ["return ", KW], ["<", TAG], ["Animated.View", undefined], [" style", PROP], ["={style}><", TAG], ["Text", undefined], [">Dragging...</", TAG], ["Text", undefined], ["></", TAG], ["Animated.View", undefined], [">;"]],
  [["}"]],
];

const HOOKS_FULL: readonly CodeLine[] = [
  [["import ", KW], ["{ DndProvider, useDraggable, useDroppable, useDndContext }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [["import ", KW], ["type ", KW], ["{ DragEndEvent }", undefined], [" from ", KW], ["'@botjaeger/expo-dnd'", STR]],
  [[""]],
  [["// Build your own draggable — full control over rendering", CMT]],
  [["function ", KW], ["MyDraggable({ id, children }) {"]],
  [["  ", undefined], ["const ", KW], ["ctx = useDndContext();"]],
  [["  ", undefined], ["const ", KW], ["{ ref, gesture, animatedStyle, onLayout } = useDraggable({ id });"]],
  [["  ", undefined], ["const ", KW], ["childRef = useRef(children);"]],
  [["  childRef.current = children;"]],
  [["  useEffect(() => {"]],
  [["    ctx.registerDragRenderer(id, () => childRef.current);"]],
  [["    ", undefined], ["return ", KW], ["() => ctx.unregisterDragRenderer(id);"]],
  [["  }, [id]);"]],
  [["  ", undefined], ["return ", KW], ["("]],
  [["    <", TAG], ["GestureDetector", undefined], [" gesture", PROP], ["={gesture}>"]],
  [["      <", TAG], ["Animated.View", undefined], [" ref", PROP], ["={ref}", undefined], [" style", PROP], ["={animatedStyle}", undefined], [" onLayout", PROP], ["={onLayout}>"]],
  [["        {children}"]],
  [["      </", TAG], ["Animated.View", undefined], [">"]],
  [["    </", TAG], ["GestureDetector", undefined], [">"]],
  [["  );"]],
  [["}"]],
  [[""]],
  [["// Build your own droppable — isOver drives custom visuals", CMT]],
  [["function ", KW], ["MyDropZone({ id, children }) {"]],
  [["  ", undefined], ["const ", KW], ["{ ref, isOver, activeStyle, onLayout } = useDroppable({ id });"]],
  [["  ", undefined], ["return ", KW], ["("]],
  [["    <", TAG], ["Animated.View", undefined], [" ref", PROP], ["={ref}", undefined], [" style", PROP], ["={[s.zone, activeStyle]}", undefined], [" onLayout", PROP], ["={onLayout}>"]],
  [["      {children}"]],
  [["    </", TAG], ["Animated.View", undefined], [">"]],
  [["  );"]],
  [["}"]],
];

// ── Code tab switcher ─────────────────────────────────────────────────────────
type Tab = 'Setup' | 'Callbacks' | 'Full';
const TAB_KEYS: Tab[] = ['Setup', 'Callbacks', 'Full'];

function codeLinesAsText(lines: readonly CodeLine[]): string {
  return lines.map(segs => segs.map(([txt]) => txt).join('')).join('\n');
}

function CodeTabs({ tabs }: { tabs: Record<Tab, readonly CodeLine[]> }) {
  const [active, setActive] = useState<Tab>('Setup');
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const text = codeLinesAsText(tabs[active]);
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }, [active, tabs]);

  return (
    <View style={cs.codeTabs}>
      <View style={cs.tabBar}>
        {TAB_KEYS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[cs.tabBtn, active === t && cs.tabBtnActive]}
            onPress={() => setActive(t)}
            activeOpacity={0.7}
          >
            <Text style={[cs.tabBtnText, active === t && cs.tabBtnTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={cs.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
          <Text style={[cs.copyBtnText, copied && { color: C.green }]}>{copied ? '✓ Copied' : '⎘ Copy'}</Text>
        </TouchableOpacity>
      </View>
      <CodeBlock lines={tabs[active]} />
    </View>
  );
}

// ── Reset button ─────────────────────────────────────────────────────────────

function ResetButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={cs.resetBtn} onPress={onPress} activeOpacity={0.7}>
      <Text style={cs.resetBtnText}>{'\u21BB'} Reset</Text>
    </TouchableOpacity>
  );
}

// ── Option pickers ───────────────────────────────────────────────────────────

const DRAG_EFFECTS = ['none', 'pickup', 'scaleUp', 'scaleDown', 'bounce'] as const;
type DragEffectOption = (typeof DRAG_EFFECTS)[number];

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
    <View style={cs.effectPicker}>
      <Text style={cs.effectLabel}>{label}</Text>
      <View style={cs.effectOptions}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[cs.effectBtn, value === opt && cs.effectBtnActive]}
            onPress={() => onChange(opt)}
            activeOpacity={0.7}
          >
            <Text style={[cs.effectBtnText, value === opt && cs.effectBtnTextActive]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Interactive demo panels ───────────────────────────────────────────────────

// Demo 1: Basic Drag & Drop
const DEMO1_ITEMS = [
  { id: 'item-1', label: 'Apple' },
  { id: 'item-2', label: 'Banana' },
  { id: 'item-3', label: 'Cherry' },
];

function Demo1Panel() {
  const [status, setStatus] = useState('');
  const [effect, setEffect] = useState<DragEffectOption>('bounce');
  // Track which zone each item is in: null = unplaced
  const [placements, setPlacements] = useState<Record<string, string | null>>({
    'item-1': null, 'item-2': null, 'item-3': null,
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (event.over) {
      setPlacements(prev => ({ ...prev, [event.active.id]: event.over!.id }));
      setStatus(prev => `Dropped ${event.active.id} on ${event.over!.id}` + (prev ? '\n' + prev : ''));
    } else {
      setStatus(prev => 'Released outside — item returned' + (prev ? '\n' + prev : ''));
    }
  }, []);

  const unplacedItems = DEMO1_ITEMS.filter(item => placements[item.id] === null);
  const zoneAItems = DEMO1_ITEMS.filter(item => placements[item.id] === 'zone-a');
  const zoneBItems = DEMO1_ITEMS.filter(item => placements[item.id] === 'zone-b');

  return (
    <View style={cs.demo1Wrap}>
      <DndProvider onDragEnd={handleDragEnd} dragEffect={effect === 'none' ? undefined : effect}>
        {/* Items tray */}
        <View style={cs.demo1Tray}>
          <Text style={cs.demo1TrayLabel}>Items</Text>
          <View style={cs.demo1TrayItems}>
            {unplacedItems.length > 0 ? unplacedItems.map(item => (
              <Draggable key={item.id} id={item.id} activeDragStyle={{ opacity: 0.2 }}>
                <View style={cs.demo1Item}>
                  <Text style={cs.demo1ItemText}>{item.label}</Text>
                </View>
              </Draggable>
            )) : (
              <Text style={cs.demo1EmptyHint}>all items placed</Text>
            )}
          </View>
        </View>

        {/* Drop zones */}
        <View style={cs.demo1Zones}>
          <View style={cs.demo1ZoneBorder}>
            <Droppable id="zone-a" style={cs.demo1ZoneFill} activeStyle={cs.demo1ZoneActive} activeEffect="bounce">
              {({ isOver }) => (
                <>
                  <Text style={[cs.demo1ZoneLabel, isOver && cs.demo1ZoneLabelActive]}>Zone A</Text>
                  {zoneAItems.length > 0 ? (
                    <View style={cs.demo1ZoneItems}>
                      {zoneAItems.map(item => (
                        <Draggable key={item.id} id={item.id} activeDragStyle={{ opacity: 0.2 }}>
                          <View style={cs.demo1Item}>
                            <Text style={cs.demo1ItemText}>{item.label}</Text>
                          </View>
                        </Draggable>
                      ))}
                    </View>
                  ) : (
                    <Text style={cs.demo1ZoneHint}>{isOver ? 'release to drop' : 'drop here'}</Text>
                  )}
                </>
              )}
            </Droppable>
          </View>
          <View style={cs.demo1ZoneBorder}>
            <Droppable id="zone-b" style={cs.demo1ZoneFill} activeStyle={cs.demo1ZoneActive} activeEffect="bounce">
              {({ isOver }) => (
                <>
                  <Text style={[cs.demo1ZoneLabel, isOver && cs.demo1ZoneLabelActive]}>Zone B</Text>
                  {zoneBItems.length > 0 ? (
                    <View style={cs.demo1ZoneItems}>
                      {zoneBItems.map(item => (
                        <Draggable key={item.id} id={item.id} activeDragStyle={{ opacity: 0.2 }}>
                          <View style={cs.demo1Item}>
                            <Text style={cs.demo1ItemText}>{item.label}</Text>
                          </View>
                        </Draggable>
                      ))}
                    </View>
                  ) : (
                    <Text style={cs.demo1ZoneHint}>{isOver ? 'release to drop' : 'drop here'}</Text>
                  )}
                </>
              )}
            </Droppable>
          </View>
        </View>
      </DndProvider>

      <OptionPicker label="dragEffect" options={DRAG_EFFECTS} value={effect} onChange={setEffect} />

      <View style={cs.demo1Log}>
        <View style={cs.logRow}>
          <Text style={[cs.demo1LogText, { flex: 1 }]}>
            {status || '// drag items onto zones — onDragEnd fires with active + over IDs'}
          </Text>
          <ResetButton onPress={() => { setPlacements({ 'item-1': null, 'item-2': null, 'item-3': null }); setStatus(''); }} />
        </View>
      </View>
    </View>
  );
}

// Demo 2: Sortable List
interface SortItem { id: string; label: string; }

const INITIAL_SORT_ITEMS: SortItem[] = [
  { id: '1', label: 'Build UI components' },
  { id: '2', label: 'Add gesture handling' },
  { id: '3', label: 'Implement animations' },
  { id: '4', label: 'Write documentation' },
  { id: '5', label: 'Ship to npm' },
];

const sortInsertIndicator = (index: number) => (
  <View style={cs.sortInsertBar}>
    <View style={cs.sortInsertDot} />
    <View style={cs.sortInsertLine} />
    <Text style={cs.sortInsertLabel}>{index}</Text>
    <View style={cs.sortInsertLine} />
    <View style={cs.sortInsertDot} />
  </View>
);

function Demo2Panel() {
  const [items, setItems] = useState(INITIAL_SORT_ITEMS);
  const [log, setLog] = useState('');
  const [effect, setEffect] = useState<DragEffectOption>('pickup');

  return (
    <View style={cs.demoContent}>
      <SortableList
        data={items}
        keyExtractor={(item) => item.id}
        direction="vertical"
        activeDragStyle={{ opacity: 0.3 }}
        renderInsertIndicator={sortInsertIndicator}
        dragEffect={effect === 'none' ? undefined : effect}
        renderItem={({ item, isDragging }) => (
          <View style={[cs.sortRow, isDragging && { opacity: 0.4 }]}>
            <Text style={cs.sortGrip}>{'\u2807'}</Text>
            <Text style={cs.sortLabel}>{item.label}</Text>
          </View>
        )}
        onReorder={(data, event) => {
          setItems(data);
          setLog(prev => `Moved "${data[event.toIndex].label}" from ${event.fromIndex} → ${event.toIndex}` + (prev ? '\n' + prev : ''));
        }}
      />
      <OptionPicker label="dragEffect" options={DRAG_EFFECTS} value={effect} onChange={setEffect} />
      <View style={cs.demo1Log}>
        <View style={cs.logRow}>
          <Text style={[cs.demo1LogText, { flex: 1 }]}>
            {log || '// long-press to reorder — items animate into place with spring physics'}
          </Text>
          <ResetButton onPress={() => { setItems(INITIAL_SORT_ITEMS); setLog(''); }} />
        </View>
      </View>
    </View>
  );
}

// Demo 3: Cross-List Transfer
interface TaskItem { id: string; label: string; }

const INITIAL_TODO: TaskItem[] = [
  { id: 't1', label: 'Design system' },
  { id: 't2', label: 'API layer' },
  { id: 't3', label: 'Testing' },
  { id: 't4', label: 'Documentation' },
  { id: 't5', label: 'Auth module' },
  { id: 't6', label: 'Error handling' },
  { id: 't7', label: 'Logging' },
  { id: 't8', label: 'Caching layer' },
  { id: 't9', label: 'Rate limiting' },
  { id: 't10', label: 'Monitoring' },
  { id: 't11', label: 'Search index' },
  { id: 't12', label: 'Webhooks' },
];
const INITIAL_DONE: TaskItem[] = [
  { id: 'd1', label: 'Project setup' },
  { id: 'd2', label: 'CI pipeline' },
  { id: 'd3', label: 'Linting' },
  { id: 'd4', label: 'Docker config' },
  { id: 'd5', label: 'DB migrations' },
  { id: 'd6', label: 'Env management' },
  { id: 'd7', label: 'Git hooks' },
  { id: 'd8', label: 'Code review' },
];

const activeContainerStyle = {
  borderWidth: 1,
  borderColor: C.accent,
  backgroundColor: 'rgba(59, 130, 246, 0.06)',
  borderRadius: 6,
};

const activeDragStyle = { opacity: 0.3 };

const renderInsertIndicator = (index: number) => (
  <View style={cs.xInsertBar}>
    <View style={cs.xInsertDot} />
    <View style={cs.xInsertLine} />
    <Text style={cs.xInsertLabel}>{index}</Text>
    <View style={cs.xInsertLine} />
    <View style={cs.xInsertDot} />
  </View>
);

function Demo3Panel({ isNarrow }: { isNarrow: boolean }) {
  const [todo, setTodo] = useState(INITIAL_TODO);
  const [done, setDone] = useState(INITIAL_DONE);
  const [status, setStatus] = useState('');
  const [effect, setEffect] = useState<DragEffectOption>('scaleUp');

  const handleDrop = useCallback((event: DropEvent<TaskItem>) => {
    const { item, fromListId, fromIndex, toListId, toIndex } = event;
    if (fromListId === toListId) {
      const setter = fromListId === 'todo' ? setTodo : setDone;
      setter((prev) => {
        const next = [...prev];
        next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        return next;
      });
      setStatus(prev => `Reordered in ${fromListId}` + (prev ? '\n' + prev : ''));
    } else {
      (fromListId === 'todo' ? setTodo : setDone)((prev) => prev.filter((i) => i.id !== item.id));
      (toListId === 'todo' ? setTodo : setDone)((prev) => [
        ...prev.slice(0, toIndex), item, ...prev.slice(toIndex),
      ]);
      setStatus(prev => `Moved "${item.label}" → ${toListId}` + (prev ? '\n' + prev : ''));
    }
  }, []);

  const renderItem = useCallback(
    ({ item, isDragging }: { item: TaskItem; isDragging: boolean }) => (
      <View style={[cs.xItem, isDragging && { opacity: 0.4 }]}>
        <Text style={cs.xItemText}>{item.label}</Text>
      </View>
    ), []
  );

  return (
    <View style={cs.demoContent}>
      <DraggableListGroup onDrop={handleDrop} dragEffect={effect === 'none' ? undefined : effect}>
        <View style={[cs.xCols, isNarrow && cs.xColsNarrow]}>
          <View style={cs.xCol}>
            <Text style={cs.xColTitle}>To Do <Text style={cs.xColBadge}>fixed 400px</Text></Text>
            <DraggableList
              id="todo"
              data={todo}
              keyExtractor={(item) => item.id}
              itemSize={40}
              containerSize={400}
              direction="vertical"
              renderItem={renderItem}
              activeContainerStyle={activeContainerStyle}
              activeDragStyle={activeDragStyle}
              renderInsertIndicator={renderInsertIndicator}

            />
          </View>
          <View style={[cs.xDivider, isNarrow && cs.xDividerNarrow]} />
          <View style={cs.xCol}>
            <Text style={cs.xColTitle}>Done</Text>
            <DraggableList
              id="done"
              data={done}
              keyExtractor={(item) => item.id}
              itemSize={40}
              direction="vertical"
              renderItem={renderItem}
              activeContainerStyle={activeContainerStyle}
              activeDragStyle={activeDragStyle}
              renderInsertIndicator={renderInsertIndicator}

            />
          </View>
        </View>
      </DraggableListGroup>
      <OptionPicker label="dragEffect" options={DRAG_EFFECTS} value={effect} onChange={setEffect} />
      <View style={cs.demo1Log}>
        <View style={cs.logRow}>
          <Text style={[cs.demo1LogText, { flex: 1 }]}>
            {status || '// drag between lists — DraggableListGroup fires onDrop'}
          </Text>
          <ResetButton onPress={() => { setTodo(INITIAL_TODO); setDone(INITIAL_DONE); setStatus(''); }} />
        </View>
      </View>
    </View>
  );
}

// Demo 4: Variable Heights
interface VarItem { id: string; title: string; body?: string; }

const INITIAL_VAR_ITEMS: VarItem[] = [
  { id: 'v1', title: 'Quick note' },
  { id: 'v2', title: 'With details', body: 'Some extra context about this item that takes more space.' },
  { id: 'v3', title: 'Tall card', body: 'Line one of the description.\nLine two with more info.\nLine three wraps further.' },
  { id: 'v4', title: 'Another short one' },
  { id: 'v5', title: 'Medium card', body: 'A brief description here.' },
  { id: 'v6', title: 'Tiny' },
];

function Demo4Panel() {
  const [items, setItems] = useState(INITIAL_VAR_ITEMS);
  const [log, setLog] = useState('');
  const [effect, setEffect] = useState<DragEffectOption>('pickup');

  return (
    <View style={cs.demoContent}>
      <SortableList
        data={items}
        keyExtractor={(item) => item.id}
        direction="vertical"
        activeDragStyle={{ opacity: 0.3 }}
        dragEffect={effect === 'none' ? undefined : effect}
        renderItem={({ item, isDragging }) => (
          <View style={[cs.varCard, isDragging && { opacity: 0.4 }]}>
            <Text style={cs.varTitle}>{item.title}</Text>
            {item.body && <Text style={cs.varBody}>{item.body}</Text>}
          </View>
        )}
        onReorder={(data, event) => {
          setItems(data);
          setLog(prev => `Moved "${data[event.toIndex].title}" from ${event.fromIndex} → ${event.toIndex}` + (prev ? '\n' + prev : ''));
        }}
      />
      <OptionPicker label="dragEffect" options={DRAG_EFFECTS} value={effect} onChange={setEffect} />
      <View style={cs.demo1Log}>
        <View style={cs.logRow}>
          <Text style={[cs.demo1LogText, { flex: 1 }]}>
            {log || '// no itemSize needed — each item is measured after render'}
          </Text>
          <ResetButton onPress={() => { setItems(INITIAL_VAR_ITEMS); setLog(''); }} />
        </View>
      </View>
    </View>
  );
}

// Demo 5: Custom Hooks

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
      <Animated.View ref={ref as any} style={[cs.demo5Item, animatedStyle] as any} onLayout={onLayout}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function CustomDropZone({ id, label, items }: { id: string; label: string; items: string[] }) {
  const { ref, isOver, activeStyle, onLayout } = useDroppable({ id, activeEffect: 'bounce' });

  return (
    <Animated.View ref={ref as any} style={[cs.demo5Zone, activeStyle] as any} onLayout={onLayout}>
      <Text style={cs.demo5ZoneLabel}>{label}</Text>
      {items.length > 0 ? (
        <View style={{ gap: 4 }}>
          {items.map(item => (
            <View key={item} style={cs.demo5Dropped}>
              <Text style={cs.demo5DroppedText}>{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={cs.demo5ZoneHint}>drop here</Text>
      )}
    </Animated.View>
  );
}

function DragStatusIndicator() {
  const { isDragging } = useDndContext();
  const style = useAnimatedStyle(() => ({
    opacity: isDragging.value ? 1 : 0.3,
  }));

  return (
    <Animated.View style={[cs.demo5Status, style] as any}>
      <Text style={cs.demo5StatusText}>{'\u25CF'} drag active</Text>
    </Animated.View>
  );
}

const DEMO5_ITEMS = ['Alpha', 'Beta', 'Gamma'];

function Demo5Panel() {
  const [status, setStatus] = useState('');
  const [placed, setPlaced] = useState<Record<string, string | null>>({
    Alpha: null, Beta: null, Gamma: null,
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    if (event.over) {
      setPlaced(prev => ({ ...prev, [event.active.id]: event.over!.id }));
      setStatus(prev => `${event.active.id} → ${event.over!.id}` + (prev ? '\n' + prev : ''));
    }
  }, []);

  const unplaced = DEMO5_ITEMS.filter(id => placed[id] === null);

  return (
    <View style={cs.demoContent}>
      <DndProvider onDragEnd={handleDragEnd} dragEffect="bounce">
        <DragStatusIndicator />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {unplaced.map(id => (
            <CustomDraggableItem key={id} id={id}>
              <Text style={cs.demo5ItemText}>{id}</Text>
            </CustomDraggableItem>
          ))}
          {unplaced.length === 0 && <Text style={cs.demo1EmptyHint}>all placed</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CustomDropZone id="left" label="Left" items={DEMO5_ITEMS.filter(i => placed[i] === 'left')} />
          <CustomDropZone id="right" label="Right" items={DEMO5_ITEMS.filter(i => placed[i] === 'right')} />
        </View>
      </DndProvider>
      <View style={cs.demo1Log}>
        <View style={cs.logRow}>
          <Text style={[cs.demo1LogText, { flex: 1 }]}>
            {status || '// built with useDraggable + useDroppable + useDndContext hooks'}
          </Text>
          <ResetButton onPress={() => { setPlaced({ Alpha: null, Beta: null, Gamma: null }); setStatus(''); }} />
        </View>
      </View>
    </View>
  );
}

// ── Demo block ────────────────────────────────────────────────────────────────
function DemoBlock({
  num,
  title,
  desc,
  tabs,
  panel,
  isNarrow,
}: {
  num: string;
  title: string;
  desc: string;
  tabs: Record<Tab, readonly CodeLine[]>;
  panel: React.ReactNode;
  isNarrow: boolean;
}) {
  return (
    <View style={cs.demoBlock}>
      <Text style={cs.demoNum}>{num}</Text>
      <Text style={cs.demoTitle}>{title}</Text>
      <Text style={cs.demoDesc}>{desc}</Text>
      <View style={[cs.demoPanelRow, isNarrow && cs.demoPanelRowNarrow]}>
        <View style={[cs.demoPanelBox, isNarrow && cs.demoPanelBoxNarrow]}>
          {panel}
        </View>
        <View style={cs.demoCodeBox}>
          <CodeTabs tabs={tabs} />
        </View>
      </View>
    </View>
  );
}

// ── API Reference components ──────────────────────────────────────────────────
type PropRow = readonly [string, string, boolean, string];

function ApiSection({
  name,
  desc,
  props,
  isNarrow,
}: {
  name: string;
  desc: string;
  props: readonly PropRow[];
  isNarrow: boolean;
}) {
  return (
    <View style={as.apiItem}>
      <Text style={as.apiName}>{name}</Text>
      <Text style={as.apiDesc}>{desc}</Text>
      <View style={as.table}>
        <View style={[as.row, as.headerRow]}>
          <Text style={[as.cell, as.hText, as.cProp]}>Prop</Text>
          {!isNarrow && <Text style={[as.cell, as.hText, as.cType]}>Type</Text>}
          <Text style={[as.cell, as.hText, as.cReq]}>Req</Text>
          <Text style={[as.cell, as.hText, as.cDesc]}>Description</Text>
        </View>
        {props.map(([prop, type, req, description], i) => (
          <View key={prop} style={[as.row, i < props.length - 1 && as.rowBorder]}>
            <Text style={[as.cell, as.propName, as.cProp]}>{prop}</Text>
            {!isNarrow && <Text style={[as.cell, as.propType, as.cType]}>{type}</Text>}
            <Text style={[as.cell, req ? as.propYes : as.propNo, as.cReq]}>
              {req ? 'yes' : '\u2014'}
            </Text>
            <Text style={[as.cell, as.propDesc, as.cDesc]}>
              {isNarrow ? `${description} (${type})` : description}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function DragEffectsSection() {
  const rows: readonly [string, string, string][] = [
    ['pickup',    '1.03\u00D7', 'Subtle lift, snappy feel'],
    ['scaleUp',   '1.08\u00D7', 'Noticeable scale up'],
    ['scaleDown', '0.95\u00D7', 'Shrinks when grabbed'],
    ['bounce',    '1.05\u00D7', 'Bouncy pickup with overshoot'],
  ];
  return (
    <View style={as.apiItem}>
      <Text style={as.apiName}>Drag Effects</Text>
      <Text style={as.apiDesc}>
        {'Scale animation presets for the drag overlay. Pass as a string to dragEffect or import '}
        <Text style={{ color: C.teal, fontFamily: 'monospace' }}>dragEffects</Text>
        {' for custom configs.'}
      </Text>
      <View style={as.table}>
        <View style={[as.row, as.headerRow]}>
          <Text style={[as.cell, as.hText, { flex: 0.8 }]}>Preset</Text>
          <Text style={[as.cell, as.hText, { flex: 0.6 }]}>Scale</Text>
          <Text style={[as.cell, as.hText, { flex: 1.5 }]}>Feel</Text>
        </View>
        {rows.map(([name, scale, desc], i) => (
          <View key={name} style={[as.row, i < rows.length - 1 && as.rowBorder]}>
            <Text style={[as.cell, as.propName, { flex: 0.8 }]}>{name}</Text>
            <Text style={[as.cell, as.propType, { flex: 0.6 }]}>{scale}</Text>
            <Text style={[as.cell, as.propDesc, { flex: 1.5 }]}>{desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CollisionSection() {
  const rows: readonly [string, string][] = [
    ['rectIntersection', 'Default algorithm \u2014 prefers center-point containment, falls back to overlap ratio (\u226510%)'],
    ['CollisionDetectionAlgorithm', 'Type: (draggable, droppables) => CollisionResult | null'],
    ['CollisionResult', 'Type: { id: string, data?: unknown }'],
  ];
  return (
    <View style={as.apiItem}>
      <Text style={as.apiName}>Collision Detection</Text>
      <Text style={as.apiDesc}>Built-in algorithm and types for custom collision strategies.</Text>
      <View style={as.table}>
        <View style={[as.row, as.headerRow]}>
          <Text style={[as.cell, as.hText, { flex: 1 }]}>Export</Text>
          <Text style={[as.cell, as.hText, { flex: 2 }]}>Description</Text>
        </View>
        {rows.map(([name, desc], i) => (
          <View key={name} style={[as.row, i < rows.length - 1 && as.rowBorder]}>
            <Text style={[as.cell, as.propName, { flex: 1 }]}>{name}</Text>
            <Text style={[as.cell, as.propDesc, { flex: 2 }]}>{desc}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EventTypesSection() {
  const rows: readonly [string, string][] = [
    ['DragStartEvent', '{ active: { id: string, data?: unknown } }'],
    ['DragMoveEvent',  '{ active: { id, data? }, translation: { x, y }, absoluteX, absoluteY }'],
    ['DragOverEvent',  '{ active: { id, data? }, over: { id, data? } | null }'],
    ['DragEndEvent',   '{ active: { id, data? }, over: { id, data? } | null }'],
    ['DropEvent<T>',   '{ item: T, fromListId: string, fromIndex: number, toListId: string, toIndex: number }'],
  ];
  return (
    <View style={as.apiItem}>
      <Text style={as.apiName}>Event Types</Text>
      <Text style={as.apiDesc}>TypeScript types for all drag lifecycle events.</Text>
      <View style={as.table}>
        <View style={[as.row, as.headerRow]}>
          <Text style={[as.cell, as.hText, { flex: 1 }]}>Type</Text>
          <Text style={[as.cell, as.hText, { flex: 2 }]}>Shape</Text>
        </View>
        {rows.map(([name, shape], i) => (
          <View key={name} style={[as.row, i < rows.length - 1 && as.rowBorder]}>
            <Text style={[as.cell, as.propName, { flex: 1 }]}>{name}</Text>
            <Text style={[as.cell, as.propType, { flex: 2, fontSize: 11 }]}>{shape}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── CTA button ────────────────────────────────────────────────────────────────
function CtaButton({ label, href, primary, onPress }: { label: string; href?: string; primary?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={[hs.ctaBtn, primary ? hs.ctaBtnPrimary : hs.ctaBtnSecondary]}
      onPress={onPress ?? (() => href && Linking.openURL(href))}
      activeOpacity={0.75}
    >
      <Text style={[hs.ctaBtnText, primary ? hs.ctaBtnTextPrimary : hs.ctaBtnTextSecondary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function Nav({ isNarrow, ctx, onKanban }: { isNarrow: boolean; ctx: ScrollCtx; onKanban?: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const goExamples = () => { ctx.scrollTo(ctx.positions.examples ?? 0); setMenuOpen(false); };
  const goApi = () => { ctx.scrollTo(ctx.positions.api ?? 0); setMenuOpen(false); };
  const goKanban = () => { setMenuOpen(false); onKanban?.(); };

  return (
    <View style={ns.nav}>
      <View style={ns.navInner}>
        <View style={ns.logoRow}>
          <Text style={ns.logo}>expo-dnd</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://github.com/botjaeger/expo-dnd')}
            activeOpacity={0.7}
          >
            <Image
              source={{ uri: 'https://img.shields.io/github/stars/botjaeger/expo-dnd?style=flat&color=3b82f6&labelColor=141414' }}
              style={ns.starBadge}
            />
          </TouchableOpacity>
        </View>

        {isNarrow ? (
          <>
            <TouchableOpacity
              style={ns.hamburger}
              onPress={() => setMenuOpen((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={ns.hamburgerLine} />
              <View style={ns.hamburgerLine} />
              <View style={ns.hamburgerLine} />
            </TouchableOpacity>
            {menuOpen && (
              <View style={ns.mobileMenu}>
                <TouchableOpacity onPress={goExamples}><Text style={ns.navLink}>Examples</Text></TouchableOpacity>
                <TouchableOpacity onPress={goApi}><Text style={ns.navLink}>API</Text></TouchableOpacity>
                <TouchableOpacity
                  style={ns.navBtnBorder}
                  onPress={() => Linking.openURL('https://github.com/botjaeger/expo-dnd')}
                  activeOpacity={0.7}
                >
                  <Text style={ns.navBtnBorderText}>GitHub</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={ns.navBtnFill}
                  onPress={() => Linking.openURL('https://www.npmjs.com/package/@botjaeger/expo-dnd')}
                  activeOpacity={0.7}
                >
                  <Text style={ns.navBtnFillText}>npm</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={ns.navRight}>
            <TouchableOpacity onPress={goExamples}><Text style={ns.navLink}>Examples</Text></TouchableOpacity>
            <TouchableOpacity onPress={goApi}><Text style={ns.navLink}>API</Text></TouchableOpacity>
            <TouchableOpacity onPress={goKanban}><Text style={[ns.navLink, ns.navLinkAccent]}>Kanban</Text></TouchableOpacity>
            <TouchableOpacity
              style={ns.navBtnBorder}
              onPress={() => Linking.openURL('https://github.com/botjaeger/expo-dnd')}
              activeOpacity={0.7}
            >
              <Text style={ns.navBtnBorderText}>GitHub</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={ns.navBtnFill}
              onPress={() => Linking.openURL('https://www.npmjs.com/package/@botjaeger/expo-dnd')}
              activeOpacity={0.7}
            >
              <Text style={ns.navBtnFillText}>npm</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ── API Sidebar (desktop only) ───────────────────────────────────────────────
const SIDEBAR_ITEMS = [
  { group: 'Components', items: ['DndProvider', 'Draggable', 'DragHandle', 'Droppable', 'SortableList', 'SortableFlatList', 'DraggableList', 'DraggableListGroup'] },
  { group: 'Hooks', items: ['useDraggable', 'useDroppable', 'useDndContext'] },
  { group: 'Other', items: ['Event Types', 'Collision Detection', 'Drag Effects'] },
];

function ApiSidebar({ ctx, activeItem, onSelect }: { ctx: ScrollCtx; activeItem: string; onSelect: (item: string) => void }) {
  return (
    <View style={ss.sidebar}>
      {SIDEBAR_ITEMS.map((group) => (
        <View key={group.group} style={ss.sidebarGroup}>
          <Text style={ss.sidebarGroupLabel}>{group.group.toUpperCase()}</Text>
          {group.items.map((item) => (
            <TouchableOpacity
              key={item}
              onPress={() => { onSelect(item); ctx.scrollToSection(`api-${item}`); }}
              activeOpacity={0.7}
            >
              <View style={[ss.sidebarItem, activeItem === item && ss.sidebarItemActive]}>
                <Text style={[ss.sidebarItemText, activeItem === item && ss.sidebarItemTextActive]}>
                  {item}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { width } = useWindowDimensions();
  const isNarrow = width < 768;
  const [page, setPage] = useState<'docs' | 'kanban' | 'settings'>('docs');

  const scrollRef = useRef<ScrollView>(null);
  const positionsRef = useRef<Record<string, number>>({});
  const [activeApiItem, setActiveApiItem] = useState('DndProvider');

  const scrollTo = useCallback((y: number) => {
    scrollRef.current?.scrollTo({ y: y - NAV_HEIGHT - 16, animated: true });
  }, []);

  // Store refs to each tracked section so we can measure on demand
  const sectionRefs = useRef<Record<string, View | null>>({});
  const trackRef = useCallback((key: string) => (ref: View | null) => {
    sectionRefs.current[key] = ref;
  }, []);

  // Measure a section's position relative to the ScrollView and scroll to it
  const scrollToSection = useCallback((key: string) => {
    const node = sectionRefs.current[key];
    const sv = scrollRef.current;
    if (!node || !sv) return;

    if (Platform.OS === 'web') {
      // On web: get both rects and compute offset within scroll container
      const nodeEl = (node as any) as HTMLElement;
      const svEl = (sv as any).getScrollableNode?.() || (sv as any)._listRef?.getScrollableNode?.();
      if (nodeEl && svEl) {
        const nodeRect = nodeEl.getBoundingClientRect();
        const svRect = svEl.getBoundingClientRect();
        const scrollTop = svEl.scrollTop || 0;
        const y = nodeRect.top - svRect.top + scrollTop;
        sv.scrollTo({ y: y - NAV_HEIGHT - 16, animated: true });
        return;
      }
    }
    // Fallback
    (node as any).measureLayout?.(sv, (_x: number, y: number) => {
      sv.scrollTo({ y: y - NAV_HEIGHT - 16, animated: true });
    });
  }, []);

  const ctx: ScrollCtx = { scrollTo, scrollToSection, positions: positionsRef.current };

  // Keep trackLayout for non-sidebar sections (examples, api markers)
  const trackLayout = useCallback((key: string) => (e: LayoutChangeEvent) => {
    positionsRef.current[key] = e.nativeEvent.layout.y;
  }, []);


  if (page === 'kanban') {
    return (
      <GestureHandlerRootView style={gs.root}>
        <StatusBar style="light" />
        <KanbanDemo onBack={() => setPage('docs')} />
      </GestureHandlerRootView>
    );
  }

  if (page === 'settings') {
    return (
      <GestureHandlerRootView style={gs.root}>
        <StatusBar style="light" />
        <SettingsDemo onBack={() => setPage('docs')} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={gs.root}>
      <StatusBar style="light" />

      <Nav isNarrow={isNarrow} ctx={ctx} onKanban={() => setPage('kanban')} />

      <ScrollView
        ref={scrollRef}
        style={gs.scroll}
        contentContainerStyle={[gs.content, isNarrow && gs.contentNarrow]}
      >
        <View style={gs.navSpacer} />

        {/* ── Hero ────────────────────────────────── */}
        <View style={hs.hero}>
          <Text style={hs.heroLabel}>expo-dnd</Text>
          <Text style={[hs.heroTitle, isNarrow && hs.heroTitleNarrow]}>
            {'Drag\u00A0& drop powered by UI\u2011thread animations.'}
          </Text>
          <Text style={hs.heroPlatforms}>{'iOS \u00B7 Android \u00B7 Web'}</Text>

          <View style={hs.whyList}>
            <Text style={hs.whyItem}>
              <Text style={hs.whyBullet}>{'\u25B8 '}</Text>
              Gestures and animations on the <Text style={hs.whyBold}>UI thread</Text> via Reanimated worklets {'\u2014'} no JS bridge during drag
            </Text>
            <Text style={hs.whyItem}>
              <Text style={hs.whyBullet}>{'\u25B8 '}</Text>
              <Text style={hs.whyBold}>Auto-measuring</Text> sortable lists {'\u2014'} variable heights work without configuration
            </Text>
            <Text style={hs.whyItem}>
              <Text style={hs.whyBullet}>{'\u25B8 '}</Text>
              <Text style={hs.whyBold}>Cross-list transfers</Text>, collision detection, auto-scroll, drag handles, and custom hooks
            </Text>
            <Text style={hs.whyItem}>
              <Text style={hs.whyBullet}>{'\u25B8 '}</Text>
              Works with <Text style={hs.whyBold}>Expo</Text> and bare React Native {'\u2014'} Fabric and New Architecture supported
            </Text>
          </View>

          <View style={hs.installBlock}>
            <Text style={hs.installText}>
              <Text style={hs.installPrefix}>{'$ '}</Text>
              npx expo install @botjaeger/expo-dnd
            </Text>
          </View>

          <Text style={hs.prereqLabel}>Prerequisites</Text>
          <View style={hs.installBlock}>
            <Text style={hs.installText}>
              <Text style={hs.installPrefix}>{'$ '}</Text>
              npx expo install react-native-reanimated react-native-gesture-handler react-native-worklets
            </Text>
          </View>
          <Text style={hs.prereqNote}>
            Reanimated 4+ uses{' '}
            <Text style={hs.qrLink} onPress={() => Linking.openURL('https://docs.swmansion.com/react-native-worklets/docs')}>
              react-native-worklets
            </Text>
            . Add the Babel plugin to your config:
          </Text>
          <View style={hs.installBlock}>
            <Text style={hs.installText}>
              plugins: [<Text style={hs.installHighlight}>'react-native-worklets/plugin'</Text>]
            </Text>
          </View>
          <Text style={hs.prereqNote}>
            Expo SDK 54+ includes the plugin automatically via babel-preset-expo.
            {'\n'}Reanimated 3.x users: use <Text style={hs.installHighlight}>'react-native-reanimated/plugin'</Text> instead.
          </Text>

          <View style={[hs.ctaRow, isNarrow && hs.ctaRowNarrow]}>
            <CtaButton primary label="Get Started" onPress={() => scrollTo(positionsRef.current.examples ?? 0)} />
            <CtaButton label="View on GitHub" href="https://github.com/botjaeger/expo-dnd" />
          </View>

          <View style={hs.qrBlock}>
            <Image source={require('./assets/expo-go-qr.png')} style={hs.qrImage} />
            <View style={hs.qrInfo}>
              <Text style={hs.qrTitle}>Try on device</Text>
              <Text style={hs.qrDesc}>
                Scan with{' '}
                <Text
                  style={hs.qrLink}
                  onPress={() => Linking.openURL('https://expo.dev/go')}
                >
                  Expo Go
                </Text>
                {' '}to run the example app on your phone.
              </Text>
            </View>
          </View>

          <View style={hs.tags}>
            {['Reanimated 3+', 'Gesture Handler 2+', 'Web', 'TypeScript', 'Sortable', 'Cross-list'].map((tag) => (
              <View key={tag} style={hs.tag}>
                <Text style={hs.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Interactive Examples ─────────────────── */}
        <View onLayout={trackLayout('examples')}>
          <Text style={gs.sectionMarker}>{'// interactive examples'}</Text>
        </View>

        <DemoBlock
          num="01"
          title="Drag & Drop"
          desc="Long-press to pick up, drag onto a zone. Collision detection uses center-point check with intersection ratio fallback. Items spring back if released outside all zones."
          panel={<Demo1Panel />}
          tabs={{ Setup: BASIC_SETUP, Callbacks: BASIC_CALLBACKS, Full: BASIC_FULL }}
          isNarrow={isNarrow}
        />

        <DemoBlock
          num="02"
          title="Reorder List"
          desc="Long-press to reorder. Positions animate on the UI thread via shared values. No itemSize needed — heights are auto-measured after render."
          panel={<Demo2Panel />}
          tabs={{ Setup: SORT_SETUP, Callbacks: SORT_CALLBACKS, Full: SORT_FULL }}
          isNarrow={isNarrow}
        />

        <DemoBlock
          num="03"
          title="Move Between Lists"
          desc="Drag items between independent lists. DraggableListGroup coordinates source/target tracking, insertion indices, and auto-scroll across lists."
          panel={<Demo3Panel isNarrow={isNarrow} />}
          tabs={{ Setup: XLIST_SETUP, Callbacks: XLIST_CALLBACKS, Full: XLIST_FULL }}
          isNarrow={isNarrow}
        />

        <DemoBlock
          num="04"
          title="Mixed Heights"
          desc="Each item is measured via onLayout after first render. Prefix sums track positions for O(log n) index lookup during drag. No manual sizing."
          panel={<Demo4Panel />}
          tabs={{ Setup: VARH_SETUP, Callbacks: VARH_CALLBACKS, Full: VARH_FULL }}
          isNarrow={isNarrow}
        />

        <DemoBlock
          num="05"
          title="Build Your Own"
          desc="useDraggable, useDroppable, and useDndContext give you the gesture, collision, and overlay primitives. You control the rendering."
          panel={<Demo5Panel />}
          tabs={{ Setup: HOOKS_SETUP, Callbacks: HOOKS_CALLBACKS, Full: HOOKS_FULL }}
          isNarrow={isNarrow}
        />

        {/* ── Complex Examples ─────────────────────── */}
        <Text style={gs.sectionMarker}>{'// complex examples'}</Text>

        <View style={[gs.complexSection, !isNarrow && gs.complexSectionRow]}>
          <TouchableOpacity
            style={gs.complexCard}
            onPress={() => setPage('kanban')}
            activeOpacity={0.8}
          >
            <View style={gs.complexCardInner}>
              <View style={gs.complexCardHeader}>
                <Text style={gs.complexCardIcon}>{'\u2630'}</Text>
                <View style={gs.complexCardBadge}>
                  <Text style={gs.complexCardBadgeText}>Cross-list</Text>
                </View>
              </View>
              <Text style={gs.complexCardTitle}>Kanban Board</Text>
              <Text style={gs.complexCardDesc}>
                Multi-column task board with drag between columns, tap-to-edit cards,
                and auto-measuring heights. Built with DraggableListGroup.
              </Text>
              <Text style={gs.complexCardLink}>Open demo {'\u2192'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={gs.complexCard}
            onPress={() => setPage('settings')}
            activeOpacity={0.8}
          >
            <View style={gs.complexCardInner}>
              <View style={gs.complexCardHeader}>
                <Text style={gs.complexCardIcon}>{'\uD83D\uDCCA'}</Text>
                <View style={gs.complexCardBadge}>
                  <Text style={gs.complexCardBadgeText}>Sortable</Text>
                </View>
              </View>
              <Text style={gs.complexCardTitle}>Dashboard Widgets</Text>
              <Text style={gs.complexCardDesc}>
                Monitoring dashboard with draggable widget cards. Reorder priority,
                hide/show widgets, sparkline charts. Built with SortableList.
              </Text>
              <Text style={gs.complexCardLink}>Open demo {'\u2192'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── API Reference ────────────────────────── */}
        <View onLayout={trackLayout('api')}>
          <Text style={gs.sectionMarker}>{'// api reference'}</Text>
        </View>

        <View style={!isNarrow ? ss.apiLayout : undefined}>
          {/* Sticky sidebar — desktop only */}
          {!isNarrow && <ApiSidebar ctx={ctx} activeItem={activeApiItem} onSelect={setActiveApiItem} />}

          <View style={!isNarrow ? ss.apiContent : undefined}>

        <Text style={as.groupLabel}>Components</Text>

        <View ref={trackRef('api-DndProvider')}>
        <ApiSection
          isNarrow={isNarrow}
          name="DndProvider"
          desc="Wraps your component tree to enable drag and drop. All Draggable and Droppable components must be descendants."
          props={[
            ['children',    'ReactNode',                     true,  'Child components that use drag and drop'],
            ['onDragStart', '(event: DragStartEvent) => void', false, 'Called when a drag begins'],
            ['onDragMove',  '(event: DragMoveEvent) => void', false, 'Called on every pointer move during drag'],
            ['onDragOver',  '(event: DragOverEvent) => void', false, 'Called when the pointer enters or leaves a droppable'],
            ['onDragEnd',   '(event: DragEndEvent) => void', false, 'Called when the item is released'],
            ['dragEffect',  'DragEffect | DragEffectConfig', false, 'Scale effect for the drag overlay. Preset: "pickup" | "scaleUp" | "scaleDown" | "bounce". Overridable per item.'],
          ]}
        />
        </View>

        <View ref={trackRef('api-Draggable')}>
        <ApiSection
          isNarrow={isNarrow}
          name="Draggable"
          desc="Makes its children draggable. The source element fades during drag while a floating clone follows the pointer."
          props={[
            ['children',        'ReactNode', true,  'Content to make draggable'],
            ['id',              'string',    true,  'Unique identifier used in drag events'],
            ['data',            'unknown',   false, 'Arbitrary payload forwarded in drag events'],
            ['disabled',        'boolean',   false, 'Prevents dragging when true'],
            ['handle',          'boolean',   false, 'When true, only a child DragHandle can start the drag'],
            ['style',           'ViewStyle', false, 'Style applied to the wrapping Animated.View'],
            ['activeDragStyle', 'ViewStyle', false, 'Style applied to the source element while dragging. Default: { opacity: 0.4 }'],
            ['dragEffect',     'DragEffect | DragEffectConfig', false, 'Scale effect for this item\u2019s overlay. Overrides provider-level effect.'],
          ]}
        />
        </View>

        <View ref={trackRef('api-DragHandle')}>
        <ApiSection
          isNarrow={isNarrow}
          name="DragHandle"
          desc="Designates a child as the drag trigger. Must be inside a Draggable with handle={true}."
          props={[
            ['children', 'ReactElement', true, 'The element that initiates the drag gesture'],
          ]}
        />
        </View>

        <View ref={trackRef('api-Droppable')}>
        <ApiSection
          isNarrow={isNarrow}
          name="Droppable"
          desc="Creates a drop zone. Accepts static children or a render prop that receives { isOver } for hover feedback."
          props={[
            ['id',           'string',                          true,  'Unique identifier used in drag events'],
            ['children',     'ReactNode | ({ isOver }) => ReactNode', true,  'Static children or render prop for hover feedback'],
            ['data',         'unknown',                         false, 'Arbitrary payload forwarded in drag events'],
            ['disabled',     'boolean',                         false, 'Excludes this zone from collision detection'],
            ['style',        'ViewStyle',                       false, 'Style applied to the wrapping Animated.View'],
            ['activeStyle',  'ViewStyle',                       false, 'Style applied when a draggable is hovering (e.g. border, background)'],
            ['activeEffect', 'DragEffect | DragEffectConfig',   false, 'Animated scale effect on hover. Works with activeStyle.'],
          ]}
        />
        </View>

        <View ref={trackRef('api-SortableList')}>
        <ApiSection
          isNarrow={isNarrow}
          name="SortableList"
          desc="Auto-measuring sortable list. No itemSize needed \u2014 items are measured after render. Handles uniform and variable heights."
          props={[
            ['data',                  'T[]',                                       true,  'Array of items to render'],
            ['renderItem',            '({ item, index, isDragging }) => ReactNode', true,  'Render function for each item'],
            ['onReorder',             '(data, event) => void',                     true,  'Called with reordered array and { fromIndex, toIndex, item }'],
            ['keyExtractor',          '(item) => string',                          true,  'Returns a unique key per item'],
            ['id',                    'string',                                    false, 'Zone identifier (default: "default")'],
            ['direction',             '"horizontal" | "vertical"',                 false, 'Layout axis (default: "horizontal")'],
            ['containerSize',         'number',                                    false, 'Fixed size to enable scroll mode with auto-scroll'],
            ['autoScrollThreshold',   'number',                                    false, 'Pixels from edge that triggers auto-scroll (default: 80)'],
            ['handle',                'boolean',                                   false, 'Only DragHandle children can start drag'],
            ['activeDragStyle',       'ViewStyle',                                 false, 'Style for the source item while dragging (default: invisible)'],
            ['renderInsertIndicator', '(index) => ReactNode',                      false, 'Render insertion indicator at target index. Return null to hide.'],
            ['dragEffect',            'DragEffect | DragEffectConfig',             false, 'Scale effect for the overlay: "pickup" | "scaleUp" | "scaleDown" | "bounce"'],
            ['onDragStart',           '(id, index) => void',                       false, 'Called when drag begins'],
            ['onDragMove',            '(id, overIndex, position) => void',         false, 'Called during drag with position info'],
            ['onDragEnd',             '(id, fromIndex, toIndex) => void',          false, 'Called when drag ends'],
            ['style',                 'ViewStyle',                                 false, 'Style applied to the list container'],
          ]}
        />
        </View>

        <View ref={trackRef('api-SortableFlatList')}>
        <ApiSection
          isNarrow={isNarrow}
          name="SortableFlatList"
          desc="FlatList-backed sortable with virtualization. Requires explicit itemSize. Use for large datasets."
          props={[
            ['data',                  'T[]',                                       true,  'Array of items to render'],
            ['renderItem',            '({ item, index, isDragging }) => ReactNode', true,  'Render function for each item'],
            ['onReorder',             '(data, event) => void',                     true,  'Called with reordered array and { fromIndex, toIndex, item }'],
            ['keyExtractor',          '(item) => string',                          true,  'Returns a unique key per item'],
            ['itemSize',              'number | (index) => number',                true,  'Item size along the drag axis (height or width)'],
            ['id',                    'string',                                    false, 'Zone identifier (default: "default")'],
            ['direction',             '"horizontal" | "vertical"',                 false, 'Layout axis (default: "horizontal")'],
            ['containerSize',         'number',                                    false, 'Fixed size to enable scroll mode with auto-scroll'],
            ['autoScrollThreshold',   'number',                                    false, 'Pixels from edge that triggers auto-scroll (default: 80)'],
            ['handle',                'boolean',                                   false, 'Only DragHandle children can start drag'],
            ['activeDragStyle',       'ViewStyle',                                 false, 'Style for the source item while dragging (default: invisible)'],
            ['renderInsertIndicator', '(index) => ReactNode',                      false, 'Render insertion indicator at target index. Return null to hide.'],
            ['dragEffect',            'DragEffect | DragEffectConfig',             false, 'Scale effect for the overlay: "pickup" | "scaleUp" | "scaleDown" | "bounce"'],
            ['onDragStart',           '(id, index) => void',                       false, 'Called when drag begins'],
            ['onDragMove',            '(id, overIndex, position) => void',         false, 'Called during drag with position info'],
            ['onDragEnd',             '(id, fromIndex, toIndex) => void',          false, 'Called when drag ends'],
            ['style',                 'ViewStyle',                                 false, 'Style applied to the FlatList container'],
          ]}
        />
        </View>

        <View ref={trackRef('api-DraggableList')}>
        <ApiSection
          isNarrow={isNarrow}
          name="DraggableList"
          desc="Single list within a DraggableListGroup. Supports reorder within and transfer between lists."
          props={[
            ['id',                    'string',                              true,  'List identifier used in DropEvent'],
            ['data',                  'T[]',                                 true,  'Array of items'],
            ['renderItem',            '({ item, index, isDragging }) => ReactNode', true, 'Render function for each item'],
            ['keyExtractor',          '(item) => string',                    true,  'Returns a unique key per item'],
            ['itemSize',              'number | (index) => number',          true,  'Item size along the drag axis (height or width)'],
            ['direction',             '"horizontal" | "vertical"',           false, 'Drag axis (default: "vertical")'],
            ['containerSize',         'number',                              false, 'Fixed size to enable scroll mode with auto-scroll'],
            ['autoScrollThreshold',   'number',                              false, 'Pixels from edge that triggers auto-scroll (default: 80)'],
            ['handle',                'boolean',                             false, 'Only DragHandle children can start drag'],
            ['activeContainerStyle',  'ViewStyle',                           false, 'Style applied to this list when a draggable hovers over it'],
            ['activeDragStyle',       'ViewStyle',                           false, 'Style for the source item while dragging (default: invisible)'],
            ['renderInsertIndicator', '(index) => ReactNode',                false, 'Render insertion indicator at target index. Return null to hide.'],
            ['dragEffect',            'DragEffect | DragEffectConfig',       false, 'Scale effect for items in this list. Overrides group-level effect.'],
            ['style',                 'ViewStyle',                           false, 'Style applied to the list container'],
          ]}
        />
        </View>

        <View ref={trackRef('api-DraggableListGroup')}>
        <ApiSection
          isNarrow={isNarrow}
          name="DraggableListGroup"
          desc="Coordinates drag and drop across child DraggableList components. Fires onDrop on transfer or reorder."
          props={[
            ['children',   'ReactNode',                      true,  'DraggableList components'],
            ['onDrop',     '(event: DropEvent<T>) => void',  true,  'Called with { item, fromListId, fromIndex, toListId, toIndex }'],
            ['dragEffect', 'DragEffect | DragEffectConfig',  false, 'Default scale effect for all lists. Overridable per list or per item.'],
          ]}
        />
        </View>

        <Text style={as.groupLabel}>Hooks</Text>

        <View ref={trackRef('api-useDraggable')}>
        <ApiSection
          isNarrow={isNarrow}
          name="useDraggable"
          desc="Low-level hook for custom draggable components. Must be inside a DndProvider. You must also call ctx.registerDragRenderer(id, renderer) for the overlay clone to appear."
          props={[
            ['id',              'string',    true,  'Unique identifier'],
            ['data',            'unknown',   false, 'Payload forwarded in drag events'],
            ['disabled',        'boolean',   false, 'Prevents dragging when true'],
            ['activeDragStyle', 'ViewStyle', false, 'Style for source element while dragging (default: { opacity: 0.4 })'],
          ]}
        />
        <ApiSection
          isNarrow={isNarrow}
          name="useDraggable Returns"
          desc="Wire these into your component: ref + onLayout on the View, gesture on GestureDetector, animatedStyle on the Animated.View."
          props={[
            ['ref',           'AnimatedRef<View>',    true, 'Attach to the draggable Animated.View'],
            ['gesture',       'GestureType',          true, 'Pass to GestureDetector'],
            ['isDragging',    'SharedValue<boolean>', true, 'True while this item is being dragged'],
            ['animatedStyle', 'AnimatedStyle',        true, 'Applies ghost opacity during drag'],
            ['onLayout',      '(event) => void',      true, 'Attach to the View for layout measurement'],
          ]}
        />
        </View>

        <View ref={trackRef('api-useDroppable')}>
        <ApiSection
          isNarrow={isNarrow}
          name="useDroppable"
          desc="Low-level hook for custom drop zones. Must be inside a DndProvider."
          props={[
            ['id',           'string',                       true,  'Unique identifier'],
            ['data',         'unknown',                      false, 'Payload forwarded in drag events'],
            ['disabled',     'boolean',                      false, 'Excludes from collision detection'],
            ['activeEffect', 'DragEffect | DragEffectConfig', false, 'Scale effect when a draggable hovers'],
          ]}
        />
        <ApiSection
          isNarrow={isNarrow}
          name="useDroppable Returns"
          desc="Wire ref + onLayout into your View. Read isOver for hover state. Apply activeStyle for default hover visuals."
          props={[
            ['ref',         'AnimatedRef<View>',    true, 'Attach to the droppable Animated.View'],
            ['isOver',      'SharedValue<boolean>', true, 'True when a draggable is hovering over this zone'],
            ['activeStyle', 'AnimatedStyle',        true, 'Default hover feedback (border, background, scale)'],
            ['onLayout',    '(event) => void',      true, 'Attach to the View for layout measurement'],
          ]}
        />
        </View>

        <View ref={trackRef('api-useDndContext')}>
        <ApiSection
          isNarrow={isNarrow}
          name="useDndContext"
          desc="Reads drag state from the nearest DndProvider. All values are Reanimated shared values \u2014 use in useAnimatedStyle or useAnimatedReaction."
          props={[
            ['activeId',   'SharedValue<string | null>', true, 'ID of the item being dragged, or null'],
            ['overId',     'SharedValue<string | null>', true, 'ID of the hovered droppable, or null'],
            ['isDragging', 'SharedValue<boolean>',       true, 'True while any drag is active'],
            ['translateX', 'SharedValue<number>',        true, 'Cumulative drag translation (X)'],
            ['translateY', 'SharedValue<number>',        true, 'Cumulative drag translation (Y)'],
            ['absoluteX',  'SharedValue<number>',        true, 'Pointer X position (viewport-relative)'],
            ['absoluteY',  'SharedValue<number>',        true, 'Pointer Y position (viewport-relative)'],
          ]}
        />
        </View>

        <Text style={as.groupLabel}>Other</Text>

        <View ref={trackRef('api-Event Types')}><EventTypesSection /></View>
        <View ref={trackRef('api-Collision Detection')}><CollisionSection /></View>
        <View ref={trackRef('api-Drag Effects')}><DragEffectsSection /></View>

          </View>{/* close apiContent */}
        </View>{/* close apiLayout */}

        {/* ── Footer ──────────────────────────────── */}
        <View style={gs.footer}>
          <Text style={gs.footerText}>expo-dnd{'\u00A0'}{'\u00B7'}{'\u00A0'}MIT License</Text>
          <View style={gs.footerLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://github.com/botjaeger/expo-dnd')}>
              <Text style={gs.footerLink}>GitHub</Text>
            </TouchableOpacity>
            <Text style={gs.footerSep}>{'\u00B7'}</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://www.npmjs.com/package/@botjaeger/expo-dnd')}>
              <Text style={gs.footerLink}>npm</Text>
            </TouchableOpacity>
            <Text style={gs.footerSep}>{'\u00B7'}</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://github.com/botjaeger/expo-dnd/issues')}>
              <Text style={gs.footerLink}>Issues</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

// ── Styles: Nav ────────────────────────────────────────────────────────────────
const NAV_HEIGHT = 52;

const ns = StyleSheet.create({
  nav: {
    height: NAV_HEIGHT,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    // On web: position fixed via style override below
    ...(Platform.OS === 'web'
      ? ({
          position: 'fixed' as any,
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        } as any)
      : {
          zIndex: 100,
        }),
  },
  navInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    letterSpacing: 0.5,
  },
  starBadge: {
    width: 70,
    height: 20,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navLink: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.muted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navLinkAccent: {
    color: C.accent,
    fontWeight: '600',
  },
  navBtnBorder: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 4,
  },
  navBtnBorderText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    color: C.text,
  },
  navBtnFill: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  navBtnFillText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  // Hamburger
  hamburger: {
    gap: 4,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerLine: {
    width: 20,
    height: 2,
    backgroundColor: C.muted,
    borderRadius: 1,
  },
  // Mobile dropdown
  mobileMenu: {
    position: 'absolute',
    top: NAV_HEIGHT,
    left: 0,
    right: 0,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
    zIndex: 200,
  },
});

// ── Styles: Global ─────────────────────────────────────────────────────────────
const gs = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 48,
    paddingBottom: 80,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  contentNarrow: { paddingHorizontal: 20 },
  // Spacer so content clears the fixed nav on web; on native the nav is in-flow
  navSpacer: {
    height: Platform.OS === 'web' ? NAV_HEIGHT : 0,
  },
  sectionMarker: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.dim,
    marginTop: 64,
    marginBottom: 48,
  },
  // Complex examples section
  complexSection: {
    marginBottom: 48,
    gap: 16,
  },
  complexSectionRow: {
    flexDirection: 'row',
  },
  complexCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    maxWidth: 400,
  },
  complexCardInner: {
    padding: 24,
  },
  complexCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  complexCardIcon: {
    fontSize: 20,
    color: C.accent,
  },
  complexCardBadge: {
    backgroundColor: C.accent + '18',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  complexCardBadgeText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: C.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  complexCardTitle: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
  },
  complexCardDesc: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
    lineHeight: 20,
    marginBottom: 16,
  },
  complexCardLink: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600',
    color: C.accent,
  },
  footer: {
    marginTop: 64,
    paddingTop: 32,
    paddingBottom: 48,
    borderTopWidth: 1,
    borderTopColor: C.border,
    alignItems: 'center',
    gap: 12,
  },
  footerText: { fontSize: 13, color: C.dim },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerLink: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
    textDecorationLine: 'underline',
  },
  footerSep: { fontSize: 12, color: C.dim },
});

// ── Styles: Hero ───────────────────────────────────────────────────────────────
const hs = StyleSheet.create({
  hero: { paddingTop: 96, paddingBottom: 72 },
  heroLabel: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.muted,
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 48,
    fontWeight: '800',
    color: C.text,
    lineHeight: 56,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  heroTitleNarrow: { fontSize: 32, lineHeight: 40 },
  heroPlatforms: {
    fontSize: 15,
    fontWeight: '500',
    color: C.muted,
    marginBottom: 20,
    letterSpacing: 2,
  },
  heroDesc: {
    fontSize: 15,
    color: C.muted,
    lineHeight: 26,
    marginBottom: 36,
    maxWidth: 520,
  },
  whyList: {
    marginBottom: 36,
    maxWidth: 580,
    gap: 10,
  },
  whyItem: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.muted,
    lineHeight: 20,
  },
  whyBullet: {
    color: C.accent,
  },
  whyBold: {
    color: C.text,
    fontWeight: '600',
  },
  installBlock: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignSelf: 'flex-start',
    marginBottom: 28,
  },
  installText: { fontFamily: 'monospace', fontSize: 14, color: C.text },
  installPrefix: { color: C.dim },
  installHighlight: { color: C.accent },
  prereqLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  prereqNote: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
    lineHeight: 20,
    marginBottom: 16,
    maxWidth: 520,
  },
  ctaRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  ctaRowNarrow: { flexDirection: 'column' },
  qrBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  qrImage: { width: 100, height: 100, borderRadius: 6 },
  qrInfo: { flexShrink: 1 },
  qrTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: C.text,
    marginBottom: 6,
  },
  qrDesc: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
    lineHeight: 18,
  },
  qrLink: {
    color: C.accent,
    textDecorationLine: 'underline',
  },
  ctaBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  ctaBtnPrimary: { backgroundColor: C.accent },
  ctaBtnSecondary: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  ctaBtnText: { fontSize: 14, fontWeight: '600' },
  ctaBtnTextPrimary: { color: '#ffffff' },
  ctaBtnTextSecondary: { color: C.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

// ── Styles: Code & Demo ────────────────────────────────────────────────────────
const cs = StyleSheet.create({
  // Tab bar
  codeTabs: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: { borderBottomColor: C.accent },
  tabBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.dim,
    fontWeight: '600',
  },
  tabBtnTextActive: { color: C.accent },
  copyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  copyBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
  },

  // Code block
  codeBlock: { backgroundColor: C.bg, padding: 20, minHeight: 200 },
  codeLine: { minHeight: 20 },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 20,
    color: C.text,
  },

  // Demo structure
  demoBlock: { marginBottom: 72 },
  demoNum: { fontFamily: 'monospace', fontSize: 12, color: C.dim, marginBottom: 8 },
  demoTitle: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 10 },
  demoDesc: {
    fontSize: 15,
    color: C.muted,
    lineHeight: 24,
    marginBottom: 28,
    maxWidth: 600,
  },
  demoPanelRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
  },
  demoPanelRowNarrow: { flexDirection: 'column' },
  demoPanelBox: {
    flex: 1,
    backgroundColor: C.surface,
    borderRightWidth: 1,
    borderRightColor: C.border,
    padding: 24,
    minHeight: 340,
  },
  demoPanelBoxNarrow: {
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  demoCodeBox: { flex: 1 },

  // Demo panel content (shared)
  demoContent: { flex: 1 },
  demoCaption: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
    marginTop: 16,
    lineHeight: 16,
  },
  demoStatus: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.accent,
    marginTop: 16,
  },

  // Demo 1 — structured layout: tray → zones → log
  demo1Wrap: {
    flex: 1,
    justifyContent: 'space-between',
  },
  // Items tray
  demo1Tray: {
    marginBottom: 20,
  },
  demo1TrayLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  demo1TrayItems: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  demo1EmptyHint: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
    fontStyle: 'italic',
  },
  // Shared drag item chip
  demo1Item: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  demo1ItemText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.text,
  },
  // Drop zones
  demo1Zones: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  demo1ZoneBorder: {
    flex: 1,
    minHeight: 140,
    borderWidth: 1.5,
    borderStyle: 'dashed' as any,
    borderColor: C.border,
    borderRadius: 8,
  },
  demo1ZoneFill: {
    flex: 1,
    padding: 12,
  },
  demo1ZoneActive: {
    borderWidth: 1,
    borderColor: C.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  demo1ZoneLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  demo1ZoneLabelActive: { color: C.accent },
  demo1ZoneHint: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
  },
  demo1ZoneItems: {
    gap: 6,
  },
  // Event log
  demo1Log: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    maxHeight: 64,
    overflow: 'hidden',
  },
  demo1LogText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
    color: C.dim,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  resetBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.dim,
  },

  // Demo 2 — Sortable rows
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 6,
  },
  sortGrip: { fontSize: 14, color: C.dim },
  sortLabel: { fontFamily: 'monospace', fontSize: 13, color: C.text, flex: 1 },
  sortInsertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 0,
    overflow: 'visible',
    marginTop: -1,
  },
  sortInsertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.purple,
  },
  sortInsertLine: {
    flex: 1,
    height: 2,
    backgroundColor: C.purple,
  },
  sortInsertLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    color: C.purple,
    paddingHorizontal: 4,
  },

  // Demo 4 — Variable heights
  varCard: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 12,
    marginBottom: 6,
  },
  varTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },
  varBody: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.muted,
    marginTop: 6,
    lineHeight: 16,
  },

  // Demo 5 — Custom hooks
  demo5Item: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demo5ItemText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    color: C.accent,
  },
  demo5Zone: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    borderStyle: 'dashed' as any,
    padding: 12,
    minHeight: 80,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  demo5ZoneLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  demo5ZoneLabelActive: {
    color: C.accent,
  },
  demo5ZoneHint: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
  },
  demo5Dropped: {
    backgroundColor: C.surface,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  demo5DroppedText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.text,
  },
  demo5Status: {
    marginBottom: 10,
  },
  demo5StatusText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.green,
  },

  // Demo 3 — Two-column transfer
  xCols: { flexDirection: 'row', gap: 16 },
  xColsNarrow: { flexDirection: 'column' },
  xCol: { flex: 1, gap: 6 },
  xDivider: { width: 1, backgroundColor: C.border },
  xDividerNarrow: { width: '100%', height: 1, marginVertical: 4 },
  xColTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  xColBadge: {
    fontSize: 9,
    fontWeight: '400',
    color: C.accent,
    textTransform: 'none',
    letterSpacing: 0,
  },
  xItem: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  xItemDone: { borderColor: '#22c55e44', backgroundColor: '#22c55e0a' },
  xItemText: { fontFamily: 'monospace', fontSize: 12, color: C.text },
  xItemTextDone: { color: C.green },
  xInsertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 0,
    overflow: 'visible',
    marginTop: -1,
  },
  xInsertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  xInsertLine: {
    flex: 1,
    height: 2,
    backgroundColor: C.accent,
  },
  xInsertLabel: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '700',
    color: C.accent,
    paddingHorizontal: 4,
  },

  // Effect picker
  effectPicker: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  effectLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  effectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  effectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.bg,
  },
  effectBtnActive: {
    borderColor: C.accent,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  effectBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
  },
  effectBtnTextActive: {
    color: C.accent,
    fontWeight: '600',
  },
});

// ── Styles: Sidebar & API Layout ──────────────────────────────────────────────
const ss = StyleSheet.create({
  apiLayout: {
    flexDirection: 'row',
    gap: 48,
    alignItems: 'flex-start',
  },
  apiContent: {
    flex: 1,
    minWidth: 0,
  },
  sidebar: {
    width: 220,
    flexShrink: 0,
    ...(Platform.OS === 'web'
      ? ({
          position: 'sticky' as any,
          top: NAV_HEIGHT + 24,
        } as any)
      : {}),
  },
  sidebarGroup: {
    marginBottom: 24,
  },
  sidebarGroupLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  sidebarItem: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'transparent',
  },
  sidebarItemActive: {
    borderLeftColor: C.accent,
  },
  sidebarItemText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.muted,
  },
  sidebarItemTextActive: {
    color: C.text,
  },
});

// ── Styles: API Reference ──────────────────────────────────────────────────────
const as = StyleSheet.create({
  groupLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 24,
    marginTop: 8,
  },
  apiItem: { marginBottom: 52 },
  apiName: {
    fontFamily: 'monospace',
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
    marginBottom: 8,
  },
  apiDesc: {
    fontSize: 15,
    color: C.muted,
    lineHeight: 24,
    marginBottom: 16,
  },
  table: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: C.surface,
  },
  row: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  headerRow: {
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingVertical: 8,
  },
  cell: { paddingRight: 8 },
  hText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cProp: { flex: 0.9 },
  cType: { flex: 1.2 },
  cReq:  { width: 36 },
  cDesc: { flex: 1.5 },
  propName: { fontFamily: 'monospace', fontSize: 13, color: C.text },
  propType: { fontFamily: 'monospace', fontSize: 12, color: C.teal },
  propYes:  { fontFamily: 'monospace', fontSize: 11, color: C.green },
  propNo:   { fontFamily: 'monospace', fontSize: 11, color: C.dim },
  propDesc: { fontSize: 12, color: C.muted, lineHeight: 18 },
});
