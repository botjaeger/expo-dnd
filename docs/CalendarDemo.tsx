import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { DraggableListGroup, AutoDraggableList } from '../src';
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

const EVENT_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f97316', '#14b8a6', '#8b5cf6'];

// ── Types ─────────────────────────────────────────────────────────────────────
interface CalEvent {
  id: string;
  color: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "6:50am"
  title: string;
}

type ViewMode = 'month' | 'week' | 'day';

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

/** Sunday of the week containing date d */
function weekSunday(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

/** Array of 7 Date objects Sun-Sat for the week containing d */
function weekDays(d: Date): Date[] {
  const sun = weekSunday(d);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(sun);
    dd.setDate(sun.getDate() + i);
    return dd;
  });
}

const DAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatMonthYear(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Seed events (fixed to March 2026) ─────────────────────────────────────────
let nextId = 300;
function makeId() {
  return `ev-${nextId++}`;
}

const SEED_EVENTS: CalEvent[] = [
  { id: 'e1',  color: '#3b82f6', date: '2026-03-02', time: '9:00am',  title: 'Sprint planning' },
  { id: 'e2',  color: '#22c55e', date: '2026-03-02', time: '11:00am', title: 'Code review' },
  { id: 'e3',  color: '#f97316', date: '2026-03-03', time: '2:00pm',  title: 'Submit expense report' },
  { id: 'e4',  color: '#3b82f6', date: '2026-03-04', time: '10:00am', title: 'Design sync' },
  { id: 'e5',  color: '#8b5cf6', date: '2026-03-05', time: '12:30pm', title: 'Lunch with Alex' },
  { id: 'e6',  color: '#22c55e', date: '2026-03-09', time: '9:30am',  title: 'Write unit tests' },
  { id: 'e7',  color: '#3b82f6', date: '2026-03-10', time: '3:00pm',  title: 'Client demo' },
  { id: 'e8',  color: '#14b8a6', date: '2026-03-11', time: '6:50am',  title: 'Flight to Taipei' },
  { id: 'e9',  color: '#f97316', date: '2026-03-12', time: '8:00am',  title: 'Weekly report due' },
  { id: 'e10', color: '#22c55e', date: '2026-03-16', time: '1:00pm',  title: 'Deploy to staging' },
  { id: 'e11', color: '#3b82f6', date: '2026-03-17', time: '10:30am', title: 'Retro meeting' },
  { id: 'e12', color: '#8b5cf6', date: '2026-03-20', time: '6:00pm',  title: 'Gym session' },
  { id: 'e13', color: '#14b8a6', date: '2026-03-21', time: '11:00am', title: 'Documentation update' },
  { id: 'e14', color: '#ef4444', date: '2026-03-24', time: '9:00am',  title: 'Morning run' },
  { id: 'e15', color: '#3b82f6', date: '2026-03-25', time: '2:00pm',  title: 'Q2 planning' },
  { id: 'e16', color: '#f97316', date: '2026-03-28', time: '5:00pm',  title: 'Prep for next sprint' },
];

// ── EventBar (small colored pill for month/week cells) ────────────────────────
function EventBar({
  event,
  isDragging,
}: {
  event: CalEvent;
  isDragging: boolean;
}) {
  return (
    <View style={[s.eventBar, { backgroundColor: event.color }, isDragging && s.eventBarDragging]}>
      <Text style={s.eventBarText} numberOfLines={1}>
        {event.time} {event.title}
      </Text>
    </View>
  );
}

// ── EventForm ─────────────────────────────────────────────────────────────────
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
  const [title, setTitle] = useState(initial?.title ?? '');
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [time, setTime] = useState(initial?.time ?? '9:00am');
  const [color, setColor] = useState(initial?.color ?? '#3b82f6');

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    onSubmit({
      color,
      date,
      id: initial?.id ?? makeId(),
      time: time.trim() || '9:00am',
      title: title.trim(),
    });
  }, [initial, color, title, date, time, onSubmit]);

  return (
    <View style={s.form}>
      <Text style={s.formTitle}>{mode === 'add' ? 'New Event' : 'Edit Event'}</Text>

      <Text style={s.formLabel}>Title</Text>
      <TextInput
        style={s.formInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Event title"
        placeholderTextColor={C.dim}
      />

      <Text style={s.formLabel}>Date</Text>
      <TextInput
        style={s.formInput}
        value={date}
        onChangeText={setDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={C.dim}
      />

      <Text style={s.formLabel}>Time</Text>
      <TextInput
        style={s.formInput}
        value={time}
        onChangeText={setTime}
        placeholder="9:00am"
        placeholderTextColor={C.dim}
      />

      <Text style={s.formLabel}>Color</Text>
      <View style={s.colorRow}>
        {EVENT_COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[s.colorDot, { backgroundColor: c }, color === c && s.colorDotSelected]}
            onPress={() => setColor(c)}
            activeOpacity={0.8}
          />
        ))}
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

// ── Insert indicator ──────────────────────────────────────────────────────────
const renderInsertIndicator = () => (
  <View style={s.insertBar}>
    <View style={s.insertDot} />
    <View style={s.insertLine} />
    <View style={s.insertDot} />
  </View>
);

const activeContainerStyle = {
  borderColor: C.accent,
  backgroundColor: 'rgba(59, 130, 246, 0.06)',
};

// ── MonthView ──────────────────────────────────────────────────────────────────
function MonthView({
  events,
  monthDate,
  onDrop,
  onAddForDate,
}: {
  events: CalEvent[];
  monthDate: Date;
  onDrop: (event: DropEvent<CalEvent>) => void;
  onAddForDate: (date: string) => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const today = toYMD(new Date());

  // Build Sun-based grid
  const firstDay = new Date(year, month, 1);
  const firstDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Cells: null=pad, positive=current month, negative=adjacent month day
  // We'll store {day, month, year, isCurrentMonth} objects
  type Cell = { day: number; month: number; year: number; isCurrent: boolean } | null;

  const cells: Cell[] = [];

  // Prev month padding
  const prevMonthDate = new Date(year, month - 1, 1);
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrevMonth - i,
      month: prevMonthDate.getMonth(),
      year: prevMonthDate.getFullYear(),
      isCurrent: false,
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, isCurrent: true });
  }

  // Next month padding
  const nextMonthDate = new Date(year, month + 1, 1);
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      day: nextDay++,
      month: nextMonthDate.getMonth(),
      year: nextMonthDate.getFullYear(),
      isCurrent: false,
    });
  }

  // Group events by date
  const eventsByDate = events.reduce<Record<string, CalEvent[]>>((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});

  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  const renderItem = useCallback(
    ({ item, isDragging }: { item: CalEvent; isDragging: boolean }) => (
      <EventBar event={item} isDragging={isDragging} />
    ),
    []
  );

  return (
    <View style={s.monthViewWrap}>
    <DraggableListGroup<CalEvent> onDrop={onDrop} dragEffect="pickup">
      <View style={s.monthView}>
        {/* Day-of-week headers */}
        <View style={s.monthHeaderRow}>
          {DAY_HEADERS.map((d) => (
            <View key={d} style={s.monthHeaderCell}>
              <Text style={s.monthHeaderText}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Week rows */}
        {rows.map((row, ri) => (
          <View key={ri} style={s.monthRow}>
            {row.map((cell, ci) => {
              if (!cell) return <View key={ci} style={s.monthCell} />;
              const ymd = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
              const dayEvs = eventsByDate[ymd] ?? [];
              const isToday = ymd === today;
              const isCurrent = cell.isCurrent;

              return (
                <View
                  key={ci}
                  style={[s.monthCell, isCurrent && s.monthCellCurrent]}
                >
                  {/* Day number row */}
                  <View style={s.monthCellTop}>
                    <View style={[s.dayNumWrap, isToday && s.dayNumWrapToday]}>
                      <Text style={[s.monthDayNum, !isCurrent && s.monthDayNumDim, isToday && s.monthDayNumToday]}>
                        {cell.day}
                      </Text>
                    </View>
                    {isCurrent && (
                      <TouchableOpacity
                        style={s.addDayBtn}
                        onPress={() => onAddForDate(ymd)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <Text style={s.addDayBtnText}>+</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Event bars (draggable) */}
                  <AutoDraggableList<CalEvent>
                    id={ymd}
                    data={dayEvs}
                    keyExtractor={(item) => item.id}
                    itemSize={26}
                    direction="vertical"
                    activeDragStyle={{ opacity: 0.3 }}
                    activeContainerStyle={activeContainerStyle}
                    renderInsertIndicator={renderInsertIndicator}
                    renderItem={renderItem}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </DraggableListGroup>
    </View>
  );
}

// ── WeekView ───────────────────────────────────────────────────────────────────
function WeekView({
  events,
  weekDate,
  onDrop,
  onAddForDate,
}: {
  events: CalEvent[];
  weekDate: Date;
  onDrop: (event: DropEvent<CalEvent>) => void;
  onAddForDate: (date: string) => void;
}) {
  const days = weekDays(weekDate);
  const today = toYMD(new Date());

  const renderItem = useCallback(
    ({ item, isDragging }: { item: CalEvent; isDragging: boolean }) => (
      <EventBar event={item} isDragging={isDragging} />
    ),
    []
  );

  return (
    <View style={s.weekViewWrap}>
    <DraggableListGroup<CalEvent> onDrop={onDrop} dragEffect="pickup">
      <View style={s.weekContainer}>
        {/* Day headers row */}
        <View style={s.weekHeaderRow}>
          {days.map((day, i) => {
            const ymd = toYMD(day);
            const isToday = ymd === today;
            return (
              <View key={ymd} style={s.weekHeaderCell}>
                <Text style={[s.weekHeaderDay, isToday && s.weekHeaderDayToday]}>
                  {DAY_HEADERS[i]}
                </Text>
                <View style={[s.weekDayNumWrap, isToday && s.weekDayNumWrapToday]}>
                  <Text style={[s.weekDayNum, isToday && s.weekDayNumToday]}>
                    {day.getDate()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Event columns */}
        <View style={[s.weekColsRow, { flex: 1 }]}>
          {days.map((day, _i) => {
            const ymd = toYMD(day);
            const dayEvs = events.filter((e) => e.date === ymd);
            return (
              <View key={ymd} style={s.weekCol}>
                <AutoDraggableList<CalEvent>
                  id={ymd}
                  data={dayEvs}
                  keyExtractor={(item) => item.id}
                  itemSize={28}
                  direction="vertical"
                  activeDragStyle={{ opacity: 0.3 }}
                  activeContainerStyle={activeContainerStyle}
                  renderInsertIndicator={renderInsertIndicator}
                  renderItem={renderItem}
                />
                <TouchableOpacity
                  style={s.weekAddBtn}
                  onPress={() => onAddForDate(ymd)}
                  activeOpacity={0.7}
                >
                  <Text style={s.weekAddBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>
    </DraggableListGroup>
    </View>
  );
}

// ── DayView ────────────────────────────────────────────────────────────────────
function DayView({
  events,
  dayDate,
  onAddForDate,
}: {
  events: CalEvent[];
  dayDate: Date;
  onAddForDate: (date: string) => void;
}) {
  const ymd = toYMD(dayDate);
  const dayEvents = events.filter((e) => e.date === ymd);

  // Time slots from 8am to 8pm
  const timeSlots = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 8;
    const ampm = hour >= 12 ? 'pm' : 'am';
    const h = hour > 12 ? hour - 12 : hour;
    return `${h}:00${ampm}`;
  });

  return (
    <View style={s.dayView}>
      {timeSlots.map((slot) => {
        const slotEvents = dayEvents.filter((e) => {
          const eventHour = parseInt(e.time);
          const isPM = e.time.toLowerCase().includes('pm');
          const hour24 = isPM && eventHour !== 12 ? eventHour + 12 : eventHour;
          const slotHour = parseInt(slot);
          const slotIsPM = slot.includes('pm');
          const slotHour24 = slotIsPM && slotHour !== 12 ? slotHour + 12 : slotHour;
          return hour24 === slotHour24;
        });

        return (
          <View key={slot} style={s.timeSlotRow}>
            <Text style={s.timeSlotLabel}>{slot}</Text>
            <View style={s.timeSlotContent}>
              {slotEvents.map((ev) => (
                <View key={ev.id} style={[s.dayEvent, { backgroundColor: ev.color }]}>
                  <Text style={s.dayEventText}>{ev.title}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      <TouchableOpacity style={s.dayAddBtn} onPress={() => onAddForDate(ymd)} activeOpacity={0.7}>
        <Text style={s.dayAddBtnText}>+ Add event</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── CalendarDemo ───────────────────────────────────────────────────────────────
export function CalendarDemo({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 768;

  const [events, setEvents] = useState<CalEvent[]>(SEED_EVENTS);
  const [view, setView] = useState<ViewMode>('month');
  // Start on March 2026 to match seed events
  const [navDate, setNavDate] = useState(() => new Date(2026, 2, 1));

  // Form state
  const [formVisible, setFormVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);
  const [formDefaultDate, setFormDefaultDate] = useState(() => toYMD(new Date(2026, 2, 21)));

  // ── Navigation ──────────────────────────────────────────────────────────────
  const handlePrev = useCallback(() => {
    setNavDate((d) => {
      const next = new Date(d);
      if (view === 'week') next.setDate(next.getDate() - 7);
      else if (view === 'day') next.setDate(next.getDate() - 1);
      else next.setMonth(next.getMonth() - 1);
      return next;
    });
  }, [view]);

  const handleNext = useCallback(() => {
    setNavDate((d) => {
      const next = new Date(d);
      if (view === 'week') next.setDate(next.getDate() + 7);
      else if (view === 'day') next.setDate(next.getDate() + 1);
      else next.setMonth(next.getMonth() + 1);
      return next;
    });
  }, [view]);

  const handleToday = useCallback(() => {
    setNavDate(new Date());
  }, []);

  // ── CRUD ────────────────────────────────────────────────────────────────────
  const openAdd = useCallback((date: string) => {
    setFormDefaultDate(date);
    setEditingEvent(null);
    setFormVisible(true);
  }, []);

  const handleAddEvent = useCallback((ev: CalEvent) => {
    setEvents((prev) => [...prev, ev]);
    setFormVisible(false);
  }, []);

  const handleEditEvent = useCallback((ev: CalEvent) => {
    setEditingEvent(ev);
    setFormDefaultDate(ev.date);
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

  // ── Cross-list drop handler ──────────────────────────────────────────────────
  const handleDrop = useCallback((dropEvent: DropEvent<CalEvent>) => {
    const { item, fromListId, fromIndex, toListId, toIndex } = dropEvent;
    if (fromListId === toListId) {
      // Same-day reorder — preserve order of other days, splice within this day
      setEvents((prev) => {
        const dayEvs = prev.filter((e) => e.date === fromListId);
        const others = prev.filter((e) => e.date !== fromListId);
        const next = [...dayEvs];
        next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        return [...others, ...next];
      });
    } else {
      // Cross-day transfer: remove from source, insert at toIndex in target day
      setEvents((prev) => {
        const without = prev.filter((e) => e.id !== item.id);
        const targetDayEvs = without.filter((e) => e.date === toListId);
        const others = without.filter((e) => e.date !== toListId);
        const updatedItem = { ...item, date: toListId };
        targetDayEvs.splice(toIndex, 0, updatedItem);
        return [...others, ...targetDayEvs];
      });
    }
  }, []);

  // ── Title ────────────────────────────────────────────────────────────────────
  let navTitle = '';
  if (view === 'week') {
    const days = weekDays(navDate);
    const start = days[0];
    const end = days[6];
    if (start.getMonth() === end.getMonth()) {
      navTitle = `${MONTH_NAMES[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
    } else {
      navTitle = `${MONTH_NAMES[start.getMonth()].slice(0, 3)} ${start.getDate()} – ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getDate()}, ${end.getFullYear()}`;
    }
  } else if (view === 'day') {
    navTitle = `${MONTH_NAMES[navDate.getMonth()]} ${navDate.getDate()}, ${navDate.getFullYear()}`;
  } else {
    navTitle = formatMonthYear(navDate);
  }

  return (
    <View style={s.root}>
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <View style={[s.topBar, isNarrow && s.topBarNarrow]}>
        {/* Left: back + title */}
        <View style={s.topLeft}>
          <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
            <Text style={s.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.appTitle}>Calendar</Text>
        </View>

        {/* Center: today + nav arrows + month/week title */}
        <View style={[s.navRow, isNarrow && s.navRowNarrow]}>
          <TouchableOpacity style={s.todayBtn} onPress={handleToday} activeOpacity={0.7}>
            <Text style={s.todayBtnText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.navArrow} onPress={handlePrev} activeOpacity={0.7}>
            <Text style={s.navArrowText}>{'‹'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.navArrow} onPress={handleNext} activeOpacity={0.7}>
            <Text style={s.navArrowText}>{'›'}</Text>
          </TouchableOpacity>
          <Text style={s.navTitle} numberOfLines={1}>{navTitle}</Text>
        </View>

        {/* Right: month/week toggle + add */}
        <View style={s.topRight}>
          <View style={s.viewTabs}>
            {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
              <TouchableOpacity
                key={v}
                style={[s.viewTab, view === v && s.viewTabActive]}
                onPress={() => setView(v)}
                activeOpacity={0.7}
              >
                <Text style={[s.viewTabText, view === v && s.viewTabTextActive]}>
                  {v === 'month' ? 'Month' : v === 'week' ? 'Week' : 'Day'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => {
              setEditingEvent(null);
              setFormDefaultDate(toYMD(navDate));
              setFormVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={s.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <View style={s.content}>
        {view === 'month' && (
          <MonthView
            events={events}
            monthDate={navDate}
            onDrop={handleDrop}
            onAddForDate={openAdd}
          />
        )}
        {view === 'week' && (
          <WeekView
            events={events}
            weekDate={navDate}
            onDrop={handleDrop}
            onAddForDate={openAdd}
          />
        )}
        {view === 'day' && (
          <DayView
            events={events}
            dayDate={navDate}
            onAddForDate={openAdd}
          />
        )}

        {/* ── Event form ─────────────────────────────────────────────────── */}
        {formVisible && (
          <EventForm
            initial={editingEvent ?? undefined}
            defaultDate={formDefaultDate}
            mode={editingEvent ? 'edit' : 'add'}
            onCancel={handleCancelForm}
            onDelete={editingEvent ? handleDeleteEvent : undefined}
            onSubmit={editingEvent ? handleSaveEdit : handleAddEvent}
          />
        )}
      </View>
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
    minHeight: 36,
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
    gap: 6,
  },
  navRowNarrow: {
    alignSelf: 'stretch',
  },
  todayBtn: {
    height: 32,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceHigh,
  },
  todayBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
  },
  navArrow: {
    height: 32,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  navArrowText: {
    fontFamily: 'monospace',
    fontSize: 20,
    color: C.muted,
    lineHeight: 24,
  },
  navTitle: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: C.text,
    minWidth: 160,
  },

  // View tabs
  viewTabs: {
    flexDirection: 'row',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  viewTab: {
    paddingHorizontal: 14,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.surface,
  },
  viewTabActive: {
    backgroundColor: C.accent,
  },
  viewTabText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
  },
  viewTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  // Add button
  addBtn: {
    height: 32,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: 6,
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
    flexGrow: 1,
    paddingBottom: 48,
  },

  // Event bar (small pill)
  eventBar: {
    height: 22,
    borderRadius: 3,
    marginBottom: 2,
    paddingHorizontal: 5,
    justifyContent: 'center',
  },
  eventBarDragging: {
    opacity: 0.35,
  },
  eventBarText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '500',
    color: '#fff',
  },

  // Insert indicator
  insertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 8,
    marginVertical: 1,
    paddingHorizontal: 2,
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
  monthViewWrap: {
    flex: 1,
  },
  monthView: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: C.border,
    flex: 1,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.surface,
  },
  monthHeaderCell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  monthHeaderText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: C.dim,
    letterSpacing: 0.8,
  },
  monthRow: {
    flexDirection: 'row',
    flex: 1,
  },
  monthCell: {
    flex: 1,
    minHeight: 96,
    backgroundColor: C.bg,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: C.border,
    padding: 4,
  },
  monthCellCurrent: {
    backgroundColor: C.surface,
  },
  monthCellTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  dayNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumWrapToday: {
    backgroundColor: C.accent,
  },
  monthDayNum: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '500',
    color: C.muted,
  },
  monthDayNumDim: {
    color: C.dim,
  },
  monthDayNumToday: {
    color: '#fff',
    fontWeight: '700',
  },
  addDayBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: C.surfaceHigh,
  },
  addDayBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.dim,
    lineHeight: 16,
  },

  // Week view
  weekViewWrap: {
    flex: 1,
  },
  weekContainer: {
    flex: 1,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  weekHeaderCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: C.border,
  },
  weekHeaderDay: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '600',
    color: C.dim,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  weekHeaderDayToday: {
    color: C.accent,
  },
  weekDayNumWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  weekDayNumWrapToday: {
    backgroundColor: C.accent,
  },
  weekDayNum: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: C.muted,
  },
  weekDayNumToday: {
    color: '#fff',
  },
  weekColsRow: {
    flexDirection: 'row',
    backgroundColor: C.border,
    gap: 1,
  },
  weekCol: {
    flex: 1,
    backgroundColor: C.surface,
    padding: 6,
    minHeight: 200,
  },
  weekAddBtn: {
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
  },
  weekAddBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.dim,
  },

  // Form
  form: {
    marginTop: 20,
    marginHorizontal: 0,
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
    minHeight: 40,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotSelected: {
    borderColor: '#fff',
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
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
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
    minHeight: 36,
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
    minHeight: 36,
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

  // Day view
  dayView: {
    flex: 1,
    paddingVertical: 8,
  },
  timeSlotRow: {
    flexDirection: 'row',
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  timeSlotLabel: {
    width: 70,
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
    paddingTop: 4,
    paddingLeft: 12,
    textAlign: 'right',
    paddingRight: 12,
  },
  timeSlotContent: {
    flex: 1,
    borderLeftWidth: 1,
    borderLeftColor: C.border,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2,
  },
  dayEvent: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dayEventText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '500',
    color: '#fff',
  },
  dayAddBtn: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  dayAddBtnText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.accent,
  },
});
