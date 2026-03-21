import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SortableList } from '../src';

// ── Color palette ────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0a0a',
  surface: '#141414',
  surfaceHigh: '#1c1c1c',
  border: '#262626',
  text: '#fafafa',
  muted: '#a1a1aa',
  dim: '#6b6b6b',
  accent: '#3b82f6',
  green: '#22c55e',
  orange: '#f97316',
  red: '#ef4444',
  purple: '#8b5cf6',
  teal: '#14b8a6',
};

// ── Types ────────────────────────────────────────────────────────────────────
interface Widget {
  id: string;
  title: string;
  value: string;
  change: string;
  changeUp: boolean;
  color: string;
  chartData: number[];
  visible: boolean;
}

// ── Seed data ────────────────────────────────────────────────────────────────
const INIT_WIDGETS: Widget[] = [
  { id: 'w1', title: 'Total Revenue', value: '$48,290', change: '+12.5%', changeUp: true, color: C.green, chartData: [20, 35, 28, 45, 38, 52, 48, 60, 55, 72], visible: true },
  { id: 'w2', title: 'Active Users', value: '2,847', change: '+8.1%', changeUp: true, color: C.accent, chartData: [40, 42, 38, 50, 48, 55, 52, 58, 60, 65], visible: true },
  { id: 'w3', title: 'Error Rate', value: '0.24%', change: '-0.08%', changeUp: false, color: C.red, chartData: [12, 15, 10, 8, 12, 6, 8, 5, 4, 3], visible: true },
  { id: 'w4', title: 'Avg Response', value: '142ms', change: '-18ms', changeUp: false, color: C.teal, chartData: [200, 180, 190, 160, 170, 155, 150, 148, 145, 142], visible: true },
  { id: 'w5', title: 'Deployments', value: '34', change: '+6', changeUp: true, color: C.purple, chartData: [2, 4, 3, 5, 4, 6, 3, 5, 7, 4], visible: true },
  { id: 'w6', title: 'API Calls', value: '1.2M', change: '+22%', changeUp: true, color: C.orange, chartData: [600, 700, 650, 800, 750, 900, 850, 1000, 950, 1100], visible: true },
  { id: 'w7', title: 'Uptime', value: '99.98%', change: '+0.01%', changeUp: true, color: C.green, chartData: [99, 99, 100, 99, 100, 100, 99, 100, 100, 100], visible: true },
  { id: 'w8', title: 'Open Issues', value: '12', change: '+3', changeUp: true, color: C.red, chartData: [5, 8, 6, 10, 7, 9, 11, 8, 10, 12], visible: false },
];

// ── Mini sparkline chart ─────────────────────────────────────────────────────
function Sparkline({ data, color, width = 120, height = 32 }: { data: number[]; color: string; width?: number; height?: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {data.map((val, i) => {
        const h = ((val - min) / range) * height * 0.85 + height * 0.15;
        const isLast = i === data.length - 1;
        return (
          <View
            key={i}
            style={{
              flex: 1,
              height: h,
              backgroundColor: isLast ? color : color + '40',
              borderRadius: 2,
            }}
          />
        );
      })}
    </View>
  );
}

// ── Dashboard Demo ───────────────────────────────────────────────────────────
export function SettingsDemo({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 768;

  const [widgets, setWidgets] = useState(INIT_WIDGETS);
  const [editMode, setEditMode] = useState(false);

  const visibleWidgets = widgets.filter(w => w.visible);
  const hiddenWidgets = widgets.filter(w => !w.visible);

  const toggleVisibility = useCallback((id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  }, []);

  const handleReset = useCallback(() => {
    setWidgets(INIT_WIDGETS);
  }, []);

  const renderWidget = useCallback(({ item }: { item: Widget; index: number; isDragging: boolean }) => (
    <View style={s.widget}>
      <View style={s.widgetHeader}>
        {editMode && <Text style={s.grip}>{'\u2807'}</Text>}
        <Text style={s.widgetTitle}>{item.title}</Text>
        {editMode && (
          <TouchableOpacity onPress={() => toggleVisibility(item.id)} activeOpacity={0.7}>
            <Text style={s.hideBtn}>{'\u2212'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={s.widgetBody}>
        <View style={s.widgetStats}>
          <Text style={s.widgetValue}>{item.value}</Text>
          <View style={[s.changeBadge, { backgroundColor: (item.changeUp ? C.green : C.red) + '18' }]}>
            <Text style={[s.changeText, { color: item.changeUp ? C.green : C.red }]}>
              {item.change}
            </Text>
          </View>
        </View>
        <Sparkline data={item.chartData} color={item.color} />
      </View>
    </View>
  ), [editMode, toggleVisibility]);

  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <Text style={s.backBtn}>{'\u2190'} Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={s.topTitle}>Dashboard</Text>
            <Text style={s.topSubtitle}>{visibleWidgets.length} widgets visible</Text>
          </View>
        </View>
        <View style={s.topBarRight}>
          <TouchableOpacity
            style={[s.editToggle, editMode && s.editToggleActive]}
            onPress={() => setEditMode(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={[s.editToggleText, editMode && s.editToggleTextActive]}>
              {editMode ? 'Done' : 'Customize'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
            <Text style={s.resetBtn}>{'\u21BB'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={[s.scrollContent, isNarrow && s.scrollContentNarrow]}>
        {editMode ? (
          <>
            <Text style={s.sectionLabel}>Visible widgets</Text>
            <Text style={s.sectionHint}>Long-press to reorder. Tap {'\u2212'} to hide.</Text>
            <View style={s.listWrap}>
              <SortableList
                data={visibleWidgets}
                keyExtractor={(w) => w.id}
                direction="vertical"
                dragEffect="pickup"
                renderItem={renderWidget}
                renderInsertIndicator={() => (
                  <View style={s.insertBar}>
                    <View style={s.insertDot} />
                    <View style={s.insertLine} />
                    <View style={s.insertDot} />
                  </View>
                )}
                onReorder={(data) => {
                  setWidgets(prev => {
                    const hidden = prev.filter(w => !w.visible);
                    return [...data, ...hidden];
                  });
                }}
              />
            </View>

            {hiddenWidgets.length > 0 && (
              <>
                <Text style={[s.sectionLabel, { marginTop: 32 }]}>Hidden widgets</Text>
                <Text style={s.sectionHint}>Tap + to add back to dashboard.</Text>
                {hiddenWidgets.map(w => (
                  <TouchableOpacity
                    key={w.id}
                    style={s.hiddenWidget}
                    onPress={() => toggleVisibility(w.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[s.hiddenDot, { backgroundColor: w.color }]} />
                    <Text style={s.hiddenLabel}>{w.title}</Text>
                    <Text style={s.addBtn}>+</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <Text style={s.sectionLabel}>Overview</Text>
            <View style={[s.grid, isNarrow && s.gridNarrow]}>
              {visibleWidgets.map(w => (
                <View key={w.id} style={[s.gridWidget, isNarrow && s.gridWidgetNarrow]}>
                  <View style={s.widgetHeader}>
                    <Text style={s.widgetTitle}>{w.title}</Text>
                  </View>
                  <View style={s.widgetBody}>
                    <View style={s.widgetStats}>
                      <Text style={s.widgetValue}>{w.value}</Text>
                      <View style={[s.changeBadge, { backgroundColor: (w.changeUp ? C.green : C.red) + '18' }]}>
                        <Text style={[s.changeText, { color: w.changeUp ? C.green : C.red }]}>
                          {w.change}
                        </Text>
                      </View>
                    </View>
                    <Sparkline data={w.chartData} color={w.color} width={isNarrow ? 100 : 140} height={36} />
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
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

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.accent,
  },
  topTitle: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
  },
  topSubtitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
    marginTop: 2,
  },
  editToggle: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  editToggleActive: {
    borderColor: C.accent,
    backgroundColor: C.accent + '18',
  },
  editToggleText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
  },
  editToggleTextActive: {
    color: C.accent,
    fontWeight: '600',
  },
  resetBtn: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: C.dim,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 32,
    maxWidth: 900,
  },
  scrollContentNarrow: {
    padding: 16,
  },

  // Section
  sectionLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sectionHint: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.dim,
    marginBottom: 16,
  },

  // Edit mode list
  listWrap: {
    maxWidth: 600,
  },

  // Widget card (used in both edit and grid modes)
  widget: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
  },
  widgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  widgetTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
    flex: 1,
  },
  grip: {
    fontSize: 18,
    color: C.dim,
  },
  hideBtn: {
    fontSize: 18,
    fontWeight: '700',
    color: C.dim,
    width: 28,
    height: 28,
    textAlign: 'center',
    lineHeight: 28,
    borderRadius: 14,
    backgroundColor: C.surfaceHigh,
  },
  widgetBody: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  widgetStats: {
    gap: 8,
  },
  widgetValue: {
    fontFamily: 'monospace',
    fontSize: 24,
    fontWeight: '700',
    color: C.text,
  },
  changeBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  changeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '600',
  },

  // Grid mode (view)
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridNarrow: {
    flexDirection: 'column',
  },
  gridWidget: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 16,
    width: '48.5%' as any,
  },
  gridWidgetNarrow: {
    width: '100%' as any,
    marginBottom: 8,
  },

  // Hidden widget row
  hiddenWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    borderStyle: 'dashed' as any,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 6,
    gap: 10,
    opacity: 0.6,
    maxWidth: 600,
  },
  hiddenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hiddenLabel: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.muted,
    flex: 1,
  },
  addBtn: {
    fontSize: 18,
    fontWeight: '700',
    color: C.accent,
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
