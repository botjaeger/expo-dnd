import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import {
  DraggableListGroup,
  AutoDraggableList,
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

// ── Edit Card Form ───────────────────────────────────────────────────────────
function EditCardForm({ card, onSave, onDelete, onCancel }: {
  card: KanbanCard;
  onSave: (updated: KanbanCard) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [tagIdx, setTagIdx] = useState(() =>
    TAG_PRESETS.findIndex(t => t.label === card.tag?.label) ?? 0
  );
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.desc ?? '');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      ...card,
      title: title.trim(),
      desc: desc.trim() || undefined,
      tag: TAG_PRESETS[tagIdx],
    });
  };

  return (
    <View style={s.addForm}>
      <Text style={s.addFormTitle}>Edit Card</Text>

      <Text style={s.addLabel}>Type</Text>
      <View style={s.addOptions}>
        {TAG_PRESETS.map((tag, i) => (
          <TouchableOpacity
            key={tag.label}
            style={[s.addOption, tagIdx === i && { borderColor: tag.color, backgroundColor: tag.color + '18' }]}
            onPress={() => setTagIdx(i)}
            activeOpacity={0.7}
          >
            <Text style={[s.addOptionText, tagIdx === i && { color: tag.color }]}>{tag.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.addLabel}>Title</Text>
      <TextInput
        style={s.addInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Card title"
        placeholderTextColor={C.dim}
      />

      <Text style={s.addLabel}>Description (optional)</Text>
      <TextInput
        style={[s.addInput, s.addInputMulti]}
        value={desc}
        onChangeText={setDesc}
        placeholder="Brief description"
        placeholderTextColor={C.dim}
        multiline
        numberOfLines={2}
      />

      <View style={s.addActions}>
        <TouchableOpacity style={s.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
          <Text style={s.deleteText}>Delete</Text>
        </TouchableOpacity>
        <View style={s.addActionsSpacer} />
        <TouchableOpacity style={s.addCancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={s.addCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.addSubmitBtn, !title.trim() && s.addSubmitBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.7}
          disabled={!title.trim()}
        >
          <Text style={s.addSubmitText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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

// ── Tag presets ──────────────────────────────────────────────────────────────
const TAG_PRESETS = [
  { label: 'Feature', color: C.accent },
  { label: 'Bug', color: C.red },
  { label: 'Docs', color: C.teal },
  { label: 'Design', color: C.purple },
  { label: 'Perf', color: C.orange },
  { label: 'Release', color: C.green },
] as const;

const COLUMN_OPTIONS: { id: ColumnId; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'progress', label: 'In Progress' },
  { id: 'done', label: 'Done' },
];

// ── Add Card Form ────────────────────────────────────────────────────────────
let nextId = 100;

function AddCardForm({ onAdd, onCancel }: {
  onAdd: (column: ColumnId, card: KanbanCard) => void;
  onCancel: () => void;
}) {
  const [column, setColumn] = useState<ColumnId>('todo');
  const [tagIdx, setTagIdx] = useState(0);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    const card: KanbanCard = {
      id: `new-${nextId++}`,
      title: title.trim(),
      desc: desc.trim() || undefined,
      tag: TAG_PRESETS[tagIdx],
    };
    onAdd(column, card);
  };

  return (
    <View style={s.addForm}>
      <Text style={s.addFormTitle}>Add Card</Text>

      <Text style={s.addLabel}>Column</Text>
      <View style={s.addOptions}>
        {COLUMN_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            style={[s.addOption, column === opt.id && s.addOptionActive]}
            onPress={() => setColumn(opt.id)}
            activeOpacity={0.7}
          >
            <Text style={[s.addOptionText, column === opt.id && s.addOptionTextActive]}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.addLabel}>Type</Text>
      <View style={s.addOptions}>
        {TAG_PRESETS.map((tag, i) => (
          <TouchableOpacity
            key={tag.label}
            style={[s.addOption, tagIdx === i && { borderColor: tag.color, backgroundColor: tag.color + '18' }]}
            onPress={() => setTagIdx(i)}
            activeOpacity={0.7}
          >
            <Text style={[s.addOptionText, tagIdx === i && { color: tag.color }]}>{tag.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.addLabel}>Title</Text>
      <TextInput
        style={s.addInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Card title"
        placeholderTextColor={C.dim}
      />

      <Text style={s.addLabel}>Description (optional)</Text>
      <TextInput
        style={[s.addInput, s.addInputMulti]}
        value={desc}
        onChangeText={setDesc}
        placeholder="Brief description"
        placeholderTextColor={C.dim}
        multiline
        numberOfLines={2}
      />

      <View style={s.addActions}>
        <TouchableOpacity style={s.addCancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={s.addCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.addSubmitBtn, !title.trim() && s.addSubmitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.7}
          disabled={!title.trim()}
        >
          <Text style={s.addSubmitText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCard, setEditingCard] = useState<{ card: KanbanCard; columnId: ColumnId } | null>(null);

  const handleTapCard = useCallback((card: KanbanCard) => {
    // Find which column this card is in
    if (todo.find(c => c.id === card.id)) setEditingCard({ card, columnId: 'todo' });
    else if (progress.find(c => c.id === card.id)) setEditingCard({ card, columnId: 'progress' });
    else if (done.find(c => c.id === card.id)) setEditingCard({ card, columnId: 'done' });
  }, [todo, progress, done]);

  const handleSaveCard = useCallback((updated: KanbanCard) => {
    if (!editingCard) return;
    const list = getList(editingCard.columnId).map(c => c.id === updated.id ? updated : c);
    setList(editingCard.columnId, list);
    setEditingCard(null);
  }, [editingCard, getList, setList]);

  const handleDeleteCard = useCallback(() => {
    if (!editingCard) return;
    setList(editingCard.columnId, getList(editingCard.columnId).filter(c => c.id !== editingCard.card.id));
    setEditingCard(null);
  }, [editingCard, getList, setList]);

  const renderCard = useCallback(({ item, isDragging }: { item: KanbanCard; isDragging: boolean }) => (
    <TouchableOpacity
      onPress={() => handleTapCard(item)}
      activeOpacity={0.8}
      delayLongPress={200}
    >
      <View style={[s.card, isDragging && s.cardDragging]}>
        {item.tag && (
          <View style={[s.tag, { backgroundColor: item.tag.color + '18', borderColor: item.tag.color + '40' }]}>
            <Text style={[s.tagText, { color: item.tag.color }]}>{item.tag.label}</Text>
          </View>
        )}
        <Text style={s.cardTitle}>{item.title}</Text>
        {item.desc && <Text style={s.cardDesc}>{item.desc}</Text>}
      </View>
    </TouchableOpacity>
  ), [handleTapCard]);

  const handleAddCard = useCallback((column: ColumnId, card: KanbanCard) => {
    const list = [...getList(column), card];
    setList(column, list);
    setShowAddForm(false);
  }, [getList, setList]);

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
        <View style={s.headerRight}>
          <TouchableOpacity onPress={() => setShowAddForm(v => !v)} activeOpacity={0.7}>
            <Text style={s.addBtn}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
            <Text style={s.resetBtn}>{'\u21BB'} Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={s.subtitle}>
        Drag cards between columns to move them. Long-press to pick up, drop to place.
      </Text>

      {showAddForm && (
        <View style={s.addFormWrap}>
          <AddCardForm onAdd={handleAddCard} onCancel={() => setShowAddForm(false)} />
        </View>
      )}

      {editingCard && (
        <View style={s.addFormWrap}>
          <EditCardForm
            key={editingCard.card.id}
            card={editingCard.card}
            onSave={handleSaveCard}
            onDelete={handleDeleteCard}
            onCancel={() => setEditingCard(null)}
          />
        </View>
      )}

      {/* Board */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <DraggableListGroup onDrop={handleDrop} dragEffect="pickup">
          <View style={[s.board, isNarrow && s.boardNarrow]}>
            {/* To Do */}
            <View style={[s.column, isNarrow && s.columnNarrow]}>
              <ColumnHeader title="To Do" count={todo.length} color={C.accent} />
              <AutoDraggableList
                id="todo"
                data={todo}
                keyExtractor={(i) => i.id}
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
              <AutoDraggableList
                id="progress"
                data={progress}
                keyExtractor={(i) => i.id}
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
              <AutoDraggableList
                id="done"
                data={done}
                keyExtractor={(i) => i.id}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  addBtn: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    color: C.accent,
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
    marginBottom: 6,
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

  // Add card form
  addFormWrap: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  addForm: {
    backgroundColor: C.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
  },
  addFormTitle: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginBottom: 16,
  },
  addLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  addOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  addOption: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    minHeight: 44,
    justifyContent: 'center',
  },
  addOptionActive: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  addOptionText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.muted,
  },
  addOptionTextActive: {
    color: C.accent,
    fontWeight: '600',
  },
  addInput: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.text,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  addInputMulti: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  deleteBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.red + '40',
    minHeight: 44,
    justifyContent: 'center',
  },
  deleteText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.red,
  },
  addActionsSpacer: {
    flex: 1,
  },
  addCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  addCancelText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.dim,
  },
  addSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: C.accent,
    minHeight: 44,
    justifyContent: 'center',
  },
  addSubmitBtnDisabled: {
    opacity: 0.4,
  },
  addSubmitText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    color: C.textInverse,
  },
});
