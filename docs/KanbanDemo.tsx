import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import {
  DraggableListGroup,
  DraggableList,
} from '../src';
import type { DropEvent } from '../src';

// ── Color palette (matches docs/App.tsx) ─────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceHigh: '#1c1c1c',
  border: '#262626',
  text: '#fafafa',
  textInverse: '#ffffff',
  muted: '#a1a1aa',
  dim: '#6b6b6b',
  accent: '#3b82f6',
  accentBg: 'rgba(59, 130, 246, 0.06)',
  green: '#22c55e',
  purple: '#8b5cf6',
  orange: '#f97316',
  teal: '#14b8a6',
  red: '#ef4444',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface KanbanCard {
  id: string;
  title: string;
  desc?: string;
  tag?: { label: string; color: string };
}

type ColumnId = 'todo' | 'progress' | 'done';

// ── Seed data ────────────────────────────────────────────────────────────────
const INIT_TODO: KanbanCard[] = [
  { id: 'k1', title: 'Design token system', desc: 'Extract colors, spacing, and typography into shared tokens.', tag: { label: 'Design', color: C.purple } },
  { id: 'k2', title: 'Add haptic feedback', tag: { label: 'Feature', color: C.accent } },
  { id: 'k3', title: 'Write migration guide', desc: 'Document breaking changes from v0.2 to v0.3.', tag: { label: 'Docs', color: C.teal } },
  { id: 'k4', title: 'Benchmark drag perf', tag: { label: 'Perf', color: C.orange } },
];

const INIT_PROGRESS: KanbanCard[] = [
  { id: 'k5', title: 'Fix iOS gesture cancel', desc: 'Fabric commits during drag cause gesture recognizer to cancel.', tag: { label: 'Bug', color: C.red } },
  { id: 'k6', title: 'Auto-scroll gating', tag: { label: 'Feature', color: C.accent } },
];

const INIT_DONE: KanbanCard[] = [
  { id: 'k7', title: 'Sortable list rewrite', desc: 'In-place drag animation, no overlay.', tag: { label: 'Feature', color: C.accent } },
  { id: 'k8', title: 'Cross-list transfers', tag: { label: 'Feature', color: C.accent } },
  { id: 'k9', title: 'Publish to npm', tag: { label: 'Release', color: C.green } },
];

// ── Card renderer ────────────────────────────────────────────────────────────
const renderCard = ({ item, isDragging }: { item: KanbanCard; isDragging: boolean }) => (
  <View style={[s.card, isDragging && s.cardDragging]}>
    {item.tag && (
      <View style={[s.tag, { backgroundColor: item.tag.color + '18', borderColor: item.tag.color + '40' }]}>
        <Text style={[s.tagText, { color: item.tag.color }]}>{item.tag.label}</Text>
      </View>
    )}
    <Text style={s.cardTitle}>{item.title}</Text>
    {item.desc && <Text style={s.cardDesc}>{item.desc}</Text>}
  </View>
);

// ── Insertion indicator ──────────────────────────────────────────────────────
const renderInsertIndicator = () => (
  <View style={s.insertBar}>
    <View style={s.insertDot} />
    <View style={s.insertLine} />
    <View style={s.insertDot} />
  </View>
);

// ── Column header ────────────────────────────────────────────────────────────
function ColumnHeader({ title, count, color }: { title: string; count: number; color: string }) {
  return (
    <View style={s.colHeader}>
      <View style={[s.colDot, { backgroundColor: color }]} />
      <Text style={s.colTitle}>{title}</Text>
      <View style={s.colCount}>
        <Text style={s.colCountText}>{count}</Text>
      </View>
    </View>
  );
}

// ── Active container style ───────────────────────────────────────────────────
const activeContainerStyle = {
  borderColor: C.accent,
  backgroundColor: C.accentBg,
};

// ── Kanban Board ─────────────────────────────────────────────────────────────
export function KanbanDemo({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 768;

  const [todo, setTodo] = useState(INIT_TODO);
  const [progress, setProgress] = useState(INIT_PROGRESS);
  const [done, setDone] = useState(INIT_DONE);

  const getList = useCallback((id: ColumnId) => {
    if (id === 'todo') return todo;
    if (id === 'progress') return progress;
    return done;
  }, [todo, progress, done]);

  const setList = useCallback((id: ColumnId, data: KanbanCard[]) => {
    if (id === 'todo') setTodo(data);
    else if (id === 'progress') setProgress(data);
    else setDone(data);
  }, []);

  const handleDrop = useCallback((event: DropEvent<KanbanCard>) => {
    const { item, fromListId, fromIndex, toListId, toIndex } = event;
    const from = fromListId as ColumnId;
    const to = toListId as ColumnId;

    if (from === to) {
      // Reorder within same column
      const list = [...getList(from)];
      list.splice(fromIndex, 1);
      list.splice(toIndex, 0, item);
      setList(from, list);
    } else {
      // Transfer between columns
      setList(from, getList(from).filter(i => i.id !== item.id));
      const target = [...getList(to)];
      target.splice(toIndex, 0, item);
      setList(to, target);
    }
  }, [getList, setList]);

  const handleReset = useCallback(() => {
    setTodo(INIT_TODO);
    setProgress(INIT_PROGRESS);
    setDone(INIT_DONE);
  }, []);

  const ITEM_SIZE = 100;

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <Text style={s.backBtn}>{'\u2190'} Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Kanban Board</Text>
        </View>
        <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
          <Text style={s.resetBtn}>{'\u21BB'} Reset</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.subtitle}>
        Drag cards between columns to move them. Long-press to pick up, drop to place.
      </Text>

      {/* Board */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <DraggableListGroup onDrop={handleDrop} dragEffect="pickup">
          <View style={[s.board, isNarrow && s.boardNarrow]}>
            {/* To Do */}
            <View style={[s.column, isNarrow && s.columnNarrow]}>
              <ColumnHeader title="To Do" count={todo.length} color={C.accent} />
              <DraggableList
                id="todo"
                data={todo}
                keyExtractor={(i) => i.id}
                itemSize={ITEM_SIZE}
                containerSize={isNarrow ? 300 : 400}
                direction="vertical"
                renderItem={renderCard}
                activeContainerStyle={activeContainerStyle}
                activeDragStyle={{ opacity: 0.3 }}
                renderInsertIndicator={renderInsertIndicator}
              />
            </View>

            {/* In Progress */}
            <View style={[s.column, isNarrow && s.columnNarrow]}>
              <ColumnHeader title="In Progress" count={progress.length} color={C.orange} />
              <DraggableList
                id="progress"
                data={progress}
                keyExtractor={(i) => i.id}
                itemSize={ITEM_SIZE}
                containerSize={isNarrow ? 300 : 400}
                direction="vertical"
                renderItem={renderCard}
                activeContainerStyle={activeContainerStyle}
                activeDragStyle={{ opacity: 0.3 }}
                renderInsertIndicator={renderInsertIndicator}
              />
            </View>

            {/* Done */}
            <View style={[s.column, isNarrow && s.columnNarrow]}>
              <ColumnHeader title="Done" count={done.length} color={C.green} />
              <DraggableList
                id="done"
                data={done}
                keyExtractor={(i) => i.id}
                itemSize={ITEM_SIZE}
                containerSize={isNarrow ? 300 : 400}
                direction="vertical"
                renderItem={renderCard}
                activeContainerStyle={activeContainerStyle}
                activeDragStyle={{ opacity: 0.3 }}
                renderInsertIndicator={renderInsertIndicator}
              />
            </View>
          </View>
        </DraggableListGroup>
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.accent,
  },
  title: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  resetBtn: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.dim,
  },
  subtitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  // Board layout
  board: {
    flexDirection: 'row',
    gap: 16,
  },
  boardNarrow: {
    flexDirection: 'column',
  },
  column: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  columnNarrow: {
    flex: 0,
  },

  // Column header
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  colDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  colTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    flex: 1,
  },
  colCount: {
    backgroundColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  colCountText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.muted,
  },

  // Card
  card: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
  },
  cardDragging: {
    opacity: 0.4,
  },
  cardTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    lineHeight: 18,
  },
  cardDesc: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.muted,
    marginTop: 6,
    lineHeight: 16,
  },

  // Tag
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  tagText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
  },

  // Insert indicator
  insertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 8,
    marginVertical: 2,
    paddingHorizontal: 4,
  },
  insertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  insertLine: {
    flex: 1,
    height: 2,
    backgroundColor: C.accent,
  },
});
