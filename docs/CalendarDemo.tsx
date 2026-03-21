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
  SortableList,
} from '../src';
import type { DropEvent } from '../src';

// ── Color palette ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceHigh: '#1c1c1c',
  border: '#262626',
  text: '#fafafa',
  muted: '#a1a1aa',
  dim: '#6b6b6b',
  accent: '#3b82f6',
};

// ── Types ─────────────────────────────────────────────────────────────────────
type EventType = 'meeting' | 'task' | 'reminder' | 'personal';

const EVENT_TYPE_COLORS: Record<EventType, string> = {
  meeting: '#3b82f6',
  personal: '#8b5cf6',
  reminder: '#f97316',
  task: '#22c55e',
};

const EVENT_TYPES: EventType[] = ['meeting', 'task', 'reminder', 'personal'];

interface CalEvent {
  id: string;
  color: string;
  date: string; // YYYY-MM-DD
  description?: string;
  time: string; // HH:MM
  title: string;
  type: EventType;
}

type ViewMode = 'day' | 'month' | 'week';

// ── Date helpers ──────────────────────────────────────────────────────────────
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week containing date d */
function weekMonday(d: Date): Date {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

/** Array of 7 Date objects Mon-Sun for the week containing d */
function weekDays(d: Date): Date[] {
  const mon = weekMonday(d);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    return dd;
  });
}

const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonthYear(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortDate(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

// ── Seed events ───────────────────────────────────────────────────────────────
let nextId = 200;

function makeId() {
  return `ev-${nextId++}`;
}

function buildSeedEvents(): CalEvent[] {
  const today = new Date();
  const mon = weekMonday(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    return toYMD(dd);
  });

  return [
    { id: 'e1', type: 'meeting', color: EVENT_TYPE_COLORS.meeting, date: days[0], time: '09:00', title: 'Sprint planning', description: 'Q2 sprint kick-off with engineering' },
    { id: 'e2', type: 'task', color: EVENT_TYPE_COLORS.task, date: days[0], time: '11:00', title: 'Code review', description: 'Review drag-and-drop PR' },
    { id: 'e3', type: 'reminder', color: EVENT_TYPE_COLORS.reminder, date: days[0], time: '14:00', title: 'Submit expense report' },
    { id: 'e4', type: 'meeting', color: EVENT_TYPE_COLORS.meeting, date: days[1], time: '10:00', title: 'Design sync', description: 'Discuss new calendar UI' },
    { id: 'e5', type: 'personal', color: EVENT_TYPE_COLORS.personal, date: days[1], time: '12:30', title: 'Lunch with Alex' },
    { id: 'e6', type: 'task', color: EVENT_TYPE_COLORS.task, date: days[2], time: '09:30', title: 'Write unit tests' },
    { id: 'e7', type: 'meeting', color: EVENT_TYPE_COLORS.meeting, date: days[2], time: '15:00', title: 'Client demo', description: 'Show new features to Acme Corp' },
    { id: 'e8', type: 'reminder', color: EVENT_TYPE_COLORS.reminder, date: days[3], time: '08:00', title: 'Weekly report due' },
    { id: 'e9', type: 'task', color: EVENT_TYPE_COLORS.task, date: days[3], time: '13:00', title: 'Deploy to staging', description: 'Push release candidate' },
    { id: 'e10', type: 'personal', color: EVENT_TYPE_COLORS.personal, date: days[4], time: '18:00', title: 'Gym session' },
    { id: 'e11', type: 'meeting', color: EVENT_TYPE_COLORS.meeting, date: days[4], time: '10:30', title: 'Retro meeting', description: 'End of sprint retrospective' },
    { id: 'e12', type: 'task', color: EVENT_TYPE_COLORS.task, date: days[5], time: '11:00', title: 'Documentation update' },
    { id: 'e13', type: 'personal', color: EVENT_TYPE_COLORS.personal, date: days[6], time: '09:00', title: 'Morning run' },
    { id: 'e14', type: 'reminder', color: EVENT_TYPE_COLORS.reminder, date: days[6], time: '17:00', title: 'Prep for next week' },
  ];
}

// ── EventCard ─────────────────────────────────────────────────────────────────
function EventCard({
  event,
  isDragging,
  onPress,
}: {
  event: CalEvent;
  isDragging: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={[s.eventCard, isDragging && s.eventCardDragging]}
    >
      <View style={[s.eventBorder, { backgroundColor: event.color }]} />
      <View style={s.eventBody}>
        <Text style={s.eventTime}>{event.time}</Text>
        <Text style={s.eventTitle} numberOfLines={1}>{event.title}</Text>
        {event.description ? (
          <Text style={s.eventDesc} numberOfLines={1}>{event.description}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ── EventForm (add + edit) ────────────────────────────────────────────────────
function EventForm({
  initial,
  defaultDate,
  mode,
  onCancel,
  onDelete,
  onSubmit,
}: {
  initial?: CalEvent;
  defaultDate: string;
  mode: 'add' | 'edit';
  onCancel: () => void;
  onDelete?: () => void;
  onSubmit: (ev: CalEvent) => void;
}) {
  const [type, setType] = useState<EventType>(initial?.type ?? 'meeting');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [time, setTime] = useState(initial?.time ?? '09:00');

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    onSubmit({
      color: EVENT_TYPE_COLORS[type],
      date,
      description: description.trim() || undefined,
      id: initial?.id ?? makeId(),
      time,
      title: title.trim(),
      type,
    });
  }, [initial, type, title, description, date, time, onSubmit]);

  return (
    <View style={s.form}>
      <Text style={s.formTitle}>{mode === 'add' ? 'New Event' : 'Edit Event'}</Text>

      <Text style={s.formLabel}>Type</Text>
      <View style={s.formOptions}>
        {EVENT_TYPES.map((t) => {
          const active = type === t;
          const color = EVENT_TYPE_COLORS[t];
          return (
            <TouchableOpacity
              key={t}
              style={[s.formOption, active && { borderColor: color, backgroundColor: color + '22' }]}
              onPress={() => setType(t)}
              activeOpacity={0.7}
            >
              <Text style={[s.formOptionText, active && { color }]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={s.formLabel}>Title</Text>
      <TextInput
        style={s.formInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Event title"
        placeholderTextColor={C.dim}
      />

      <Text style={s.formLabel}>Description (optional)</Text>
      <TextInput
        style={[s.formInput, s.formInputMulti]}
        value={description}
        onChangeText={setDescription}
        placeholder="Brief description"
        placeholderTextColor={C.dim}
        multiline
        numberOfLines={2}
      />

      <View style={s.formRow}>
        <View style={s.formHalf}>
          <Text style={s.formLabel}>Date</Text>
          <TextInput
            style={s.formInput}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.dim}
          />
        </View>
        <View style={s.formHalf}>
          <Text style={s.formLabel}>Time</Text>
          <TextInput
            style={s.formInput}
            value={time}
            onChangeText={setTime}
            placeholder="HH:MM"
            placeholderTextColor={C.dim}
          />
        </View>
      </View>

      <View style={s.formActions}>
        {mode === 'edit' && onDelete && (
          <TouchableOpacity style={s.deleteBtn} onPress={onDelete} activeOpacity={0.7}>
            <Text style={s.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        )}
        <View style={s.formActionsSpacer} />
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.submitBtn, !title.trim() && s.submitBtnDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.7}
          disabled={!title.trim()}
        >
          <Text style={s.submitBtnText}>{mode === 'add' ? 'Add' : 'Save'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── DayView ────────────────────────────────────────────────────────────────────
function DayView({
  date,
  events,
  onEditEvent,
  onReorder,
}: {
  date: string;
  events: CalEvent[];
  onEditEvent: (ev: CalEvent) => void;
  onReorder: (next: CalEvent[]) => void;
}) {
  const dayEvents = events
    .filter((e) => e.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));

  const handleReorder = useCallback(
    (data: CalEvent[]) => {
      onReorder(data);
    },
    [onReorder]
  );

  if (dayEvents.length === 0) {
    return (
      <View style={s.emptyDay}>
        <Text style={s.emptyDayText}>No events. Tap + to add one.</Text>
      </View>
    );
  }

  return (
    <View style={s.dayView}>
      <SortableList
        data={dayEvents}
        keyExtractor={(item) => item.id}
        direction="vertical"
        activeDragStyle={{ opacity: 0.3 }}
        renderItem={({ item, isDragging }) => (
          <EventCard
            event={item}
            isDragging={isDragging}
            onPress={() => onEditEvent(item)}
          />
        )}
        onReorder={(data) => handleReorder(data)}
      />
    </View>
  );
}

// ── WeekView ───────────────────────────────────────────────────────────────────
const activeColumnStyle = {
  borderColor: C.accent,
  backgroundColor: 'rgba(59, 130, 246, 0.06)',
};

const renderInsertIndicator = () => (
  <View style={s.insertBar}>
    <View style={s.insertDot} />
    <View style={s.insertLine} />
    <View style={s.insertDot} />
  </View>
);

function WeekView({
  events,
  onDrop,
  onEditEvent,
  weekDate,
}: {
  events: CalEvent[];
  onDrop: (event: DropEvent<CalEvent>) => void;
  onEditEvent: (ev: CalEvent) => void;
  weekDate: Date;
}) {
  const days = weekDays(weekDate);

  const renderItem = useCallback(
    ({ item, isDragging }: { item: CalEvent; isDragging: boolean }) => (
      <EventCard
        event={item}
        isDragging={isDragging}
        onPress={() => onEditEvent(item)}
      />
    ),
    [onEditEvent]
  );

  return (
    <DraggableListGroup<CalEvent> onDrop={onDrop} dragEffect="pickup">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.weekGrid}>
          {days.map((day, i) => {
            const ymd = toYMD(day);
            const dayEvents = events
              .filter((e) => e.date === ymd)
              .sort((a, b) => a.time.localeCompare(b.time));
            const isToday = ymd === toYMD(new Date());
            return (
              <View key={ymd} style={s.weekCol}>
                <View style={[s.weekColHeader, isToday && s.weekColHeaderToday]}>
                  <Text style={[s.weekDayName, isToday && s.weekDayNameToday]}>
                    {DAY_NAMES_SHORT[i]}
                  </Text>
                  <Text style={[s.weekDayNum, isToday && s.weekDayNumToday]}>
                    {day.getDate()}
                  </Text>
                </View>
                <View style={s.weekColBody}>
                  <AutoDraggableList<CalEvent>
                    id={ymd}
                    data={dayEvents}
                    keyExtractor={(item) => item.id}
                    direction="vertical"
                    activeDragStyle={{ opacity: 0.3 }}
                    activeContainerStyle={activeColumnStyle}
                    renderInsertIndicator={renderInsertIndicator}
                    renderItem={renderItem}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </DraggableListGroup>
  );
}

// ── MonthView ──────────────────────────────────────────────────────────────────
function MonthView({
  events,
  monthDate,
  onSelectDay,
}: {
  events: CalEvent[];
  monthDate: Date;
  onSelectDay: (date: string) => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const today = toYMD(new Date());

  // First day of month
  const firstDay = new Date(year, month, 1);
  // Monday-based offset: 0=Mon … 6=Sun
  const firstDow = firstDay.getDay(); // 0=Sun
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build 6 rows x 7 cols grid; null = padding cell
  const cells: Array<number | null> = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  // Group events by date
  const eventsByDate = events.reduce<Record<string, CalEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});

  const rows: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <View style={s.monthView}>
      {/* Day-of-week headers */}
      <View style={s.monthHeaderRow}>
        {DAY_NAMES_SHORT.map((d) => (
          <View key={d} style={s.monthHeaderCell}>
            <Text style={s.monthHeaderText}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Weeks */}
      {rows.map((row, ri) => (
        <View key={ri} style={s.monthRow}>
          {row.map((dayNum, ci) => {
            if (dayNum === null) {
              return <View key={ci} style={s.monthCell} />;
            }
            const ymd = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const evs = eventsByDate[ymd] ?? [];
            const isToday = ymd === today;
            return (
              <TouchableOpacity
                key={ci}
                style={[s.monthCell, s.monthCellActive, isToday && s.monthCellToday]}
                onPress={() => onSelectDay(ymd)}
                activeOpacity={0.7}
              >
                <Text style={[s.monthDayNum, isToday && s.monthDayNumToday]}>{dayNum}</Text>
                <View style={s.monthDots}>
                  {evs.slice(0, 4).map((ev) => (
                    <View key={ev.id} style={[s.monthDot, { backgroundColor: ev.color }]} />
                  ))}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── CalendarDemo ───────────────────────────────────────────────────────────────
export function CalendarDemo({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 768;

  const [events, setEvents] = useState<CalEvent[]>(buildSeedEvents);
  const [view, setView] = useState<ViewMode>('week');
  const [navDate, setNavDate] = useState(new Date());

  // Selected day for day view
  const [selectedDay, setSelectedDay] = useState(() => toYMD(new Date()));

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    setNavDate((d) => {
      const next = new Date(d);
      if (view === 'day') next.setDate(next.getDate() - 1);
      else if (view === 'week') next.setDate(next.getDate() - 7);
      else next.setMonth(next.getMonth() - 1);
      return next;
    });
  }, [view]);

  const handleNext = useCallback(() => {
    setNavDate((d) => {
      const next = new Date(d);
      if (view === 'day') next.setDate(next.getDate() + 1);
      else if (view === 'week') next.setDate(next.getDate() + 7);
      else next.setMonth(next.getMonth() + 1);
      return next;
    });
  }, [view]);

  const handleViewChange = useCallback((v: ViewMode) => {
    setView(v);
    if (v === 'day') {
      setSelectedDay(toYMD(navDate));
    }
  }, [navDate]);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const handleAddEvent = useCallback((ev: CalEvent) => {
    setEvents((prev) => [...prev, ev]);
    setFormVisible(false);
  }, []);

  const handleEditEvent = useCallback((ev: CalEvent) => {
    setEditingEvent(ev);
    setFormVisible(true);
  }, []);

  const handleSaveEdit = useCallback((ev: CalEvent) => {
    setEvents((prev) => prev.map((e) => (e.id === ev.id ? ev : e)));
    setFormVisible(false);
    setEditingEvent(null);
  }, []);

  const handleDeleteEvent = useCallback(() => {
    if (!editingEvent) return;
    setEvents((prev) => prev.filter((e) => e.id !== editingEvent.id));
    setFormVisible(false);
    setEditingEvent(null);
  }, [editingEvent]);

  const handleCancelForm = useCallback(() => {
    setFormVisible(false);
    setEditingEvent(null);
  }, []);

  // ── Day view reorder ─────────────────────────────────────────────────────────
  const handleDayReorder = useCallback(
    (reordered: CalEvent[]) => {
      // Replace events for this day, preserve the rest
      const others = events.filter((e) => e.date !== selectedDay);
      setEvents([...others, ...reordered]);
    },
    [events, selectedDay]
  );

  // ── Week view drop (cross-list) ──────────────────────────────────────────────
  const handleWeekDrop = useCallback(
    (dropEvent: DropEvent<CalEvent>) => {
      const { item, fromListId, fromIndex, toListId, toIndex } = dropEvent;
      if (fromListId === toListId) {
        // Same-day reorder
        setEvents((prev) => {
          const dayEvs = prev
            .filter((e) => e.date === fromListId)
            .sort((a, b) => a.time.localeCompare(b.time));
          const others = prev.filter((e) => e.date !== fromListId);
          const next = [...dayEvs];
          next.splice(fromIndex, 1);
          next.splice(toIndex, 0, item);
          return [...others, ...next];
        });
      } else {
        // Cross-day transfer: update event's date
        setEvents((prev) => {
          const updated = prev.map((e) =>
            e.id === item.id ? { ...e, date: toListId } : e
          );
          return updated;
        });
      }
    },
    []
  );

  // ── Month day select ─────────────────────────────────────────────────────────
  const handleMonthSelectDay = useCallback((date: string) => {
    setSelectedDay(date);
    setNavDate(parseYMD(date));
    setView('day');
  }, []);

  // ── Title display ────────────────────────────────────────────────────────────
  let navTitle = '';
  if (view === 'day') {
    navTitle = formatShortDate(parseYMD(selectedDay));
  } else if (view === 'week') {
    const days = weekDays(navDate);
    const start = days[0];
    const end = days[6];
    navTitle = `${MONTH_NAMES[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
  } else {
    navTitle = formatMonthYear(navDate);
  }

  const defaultFormDate =
    view === 'day' ? selectedDay : toYMD(navDate);

  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={[s.topBar, isNarrow && s.topBarNarrow]}>
        <View style={s.topLeft}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Text style={s.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.appTitle}>Calendar</Text>
        </View>

        <View style={[s.navRow, isNarrow && s.navRowNarrow]}>
          <TouchableOpacity style={s.navArrow} onPress={handlePrev} activeOpacity={0.7}>
            <Text style={s.navArrowText}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={s.navTitle} numberOfLines={1}>{navTitle}</Text>
          <TouchableOpacity style={s.navArrow} onPress={handleNext} activeOpacity={0.7}>
            <Text style={s.navArrowText}>{'›'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.topRight}>
          <View style={s.viewTabs}>
            {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
              <TouchableOpacity
                key={v}
                style={[s.viewTab, view === v && s.viewTabActive]}
                onPress={() => handleViewChange(v)}
                activeOpacity={0.7}
              >
                <Text style={[s.viewTabText, view === v && s.viewTabTextActive]}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={s.addBtn} onPress={() => { setEditingEvent(null); setFormVisible(true); }} activeOpacity={0.7}>
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content */}
      <ScrollView
        style={s.content}
        contentContainerStyle={s.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {view === 'day' && (
          <DayView
            date={selectedDay}
            events={events}
            onEditEvent={handleEditEvent}
            onReorder={handleDayReorder}
          />
        )}
        {view === 'week' && (
          <WeekView
            events={events}
            onDrop={handleWeekDrop}
            onEditEvent={handleEditEvent}
            weekDate={navDate}
          />
        )}
        {view === 'month' && (
          <MonthView
            events={events}
            monthDate={navDate}
            onSelectDay={handleMonthSelectDay}
          />
        )}

        {/* Form */}
        {formVisible && (
          <EventForm
            initial={editingEvent ?? undefined}
            defaultDate={defaultFormDate}
            mode={editingEvent ? 'edit' : 'add'}
            onCancel={handleCancelForm}
            onDelete={editingEvent ? handleDeleteEvent : undefined}
            onSubmit={editingEvent ? handleSaveEdit : handleAddEvent}
          />
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Root
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
    flexWrap: 'wrap',
    gap: 8,
  },
  topBarNarrow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  backBtnText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.accent,
  },
  appTitle: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '800',
    color: C.text,
  },

  // Navigation row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navRowNarrow: {
    alignSelf: 'stretch',
  },
  navArrow: {
    minHeight: 44,
    minWidth: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
  },
  navArrowText: {
    fontFamily: 'monospace',
    fontSize: 18,
    color: C.muted,
  },
  navTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
    minWidth: 160,
    textAlign: 'center',
  },

  // View tabs
  viewTabs: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  viewTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  viewTabActive: {
    backgroundColor: C.accent,
  },
  viewTabText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.muted,
  },
  viewTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // Add button
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: C.accent,
  },
  addBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 48,
  },

  // Day view
  dayView: {
    gap: 4,
  },
  emptyDay: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyDayText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.dim,
  },

  // Event card
  eventCard: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden',
    minHeight: 56,
  },
  eventCardDragging: {
    opacity: 0.4,
  },
  eventBorder: {
    width: 4,
  },
  eventBody: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  eventTime: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.dim,
  },
  eventTitle: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },
  eventDesc: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.muted,
  },

  // Week view
  weekGrid: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: C.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  weekCol: {
    width: 140,
    backgroundColor: C.bg,
  },
  weekColHeader: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  weekColHeaderToday: {
    backgroundColor: C.accent + '22',
  },
  weekDayName: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekDayNameToday: {
    color: C.accent,
  },
  weekDayNum: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '800',
    color: C.muted,
    marginTop: 2,
  },
  weekDayNumToday: {
    color: C.accent,
  },
  weekColBody: {
    padding: 6,
    minHeight: 120,
  },

  // Insert indicator
  insertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 10,
    marginVertical: 2,
    paddingHorizontal: 4,
  },
  insertDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.accent,
  },
  insertLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: C.accent,
  },

  // Month view
  monthView: {
    gap: 1,
    backgroundColor: C.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  monthHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
  },
  monthHeaderCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  monthHeaderText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  monthRow: {
    flexDirection: 'row',
    gap: 1,
    backgroundColor: C.border,
  },
  monthCell: {
    flex: 1,
    minHeight: 64,
    backgroundColor: C.bg,
    padding: 6,
  },
  monthCellActive: {
    backgroundColor: C.surface,
  },
  monthCellToday: {
    backgroundColor: C.accent + '18',
  },
  monthDayNum: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
    color: C.muted,
  },
  monthDayNumToday: {
    color: C.accent,
    fontWeight: '800',
  },
  monthDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: 4,
  },
  monthDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Form
  form: {
    marginTop: 20,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 16,
  },
  formTitle: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    marginBottom: 14,
  },
  formLabel: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 12,
  },
  formOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  formOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceHigh,
    minHeight: 32,
    justifyContent: 'center',
  },
  formOptionText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.muted,
  },
  formInput: {
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.text,
    minHeight: 44,
  },
  formInputMulti: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formHalf: {
    flex: 1,
  },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  formActionsSpacer: {
    flex: 1,
  },

  // Form buttons
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceHigh,
  },
  cancelBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
  },
  submitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: C.accent,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
