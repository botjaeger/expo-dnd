import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
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
interface SettingItem {
  id: string;
  icon: string;
  label: string;
  desc: string;
  enabled: boolean;
  category: string;
}

// ── Seed data ────────────────────────────────────────────────────────────────
const INIT_NOTIFICATIONS: SettingItem[] = [
  { id: 'n1', icon: '\uD83D\uDD14', label: 'Push Notifications', desc: 'Alerts for new messages and updates', enabled: true, category: 'notifications' },
  { id: 'n2', icon: '\uD83D\uDCE7', label: 'Email Digests', desc: 'Daily summary of activity', enabled: false, category: 'notifications' },
  { id: 'n3', icon: '\uD83D\uDD0A', label: 'Sound Effects', desc: 'Play sounds for interactions', enabled: true, category: 'notifications' },
  { id: 'n4', icon: '\uD83D\uDCAC', label: 'In-App Messages', desc: 'Show banners inside the app', enabled: true, category: 'notifications' },
];

const INIT_PRIVACY: SettingItem[] = [
  { id: 'p1', icon: '\uD83D\uDD12', label: 'Biometric Login', desc: 'Face ID or fingerprint to unlock', enabled: false, category: 'privacy' },
  { id: 'p2', icon: '\uD83D\uDCCD', label: 'Location Services', desc: 'Allow access to your location', enabled: true, category: 'privacy' },
  { id: 'p3', icon: '\uD83D\uDCF7', label: 'Camera Access', desc: 'Allow access to your camera', enabled: false, category: 'privacy' },
  { id: 'p4', icon: '\uD83D\uDCCA', label: 'Analytics', desc: 'Share anonymous usage data', enabled: false, category: 'privacy' },
  { id: 'p5', icon: '\uD83D\uDDC2\uFE0F', label: 'Data Export', desc: 'Allow exporting personal data', enabled: true, category: 'privacy' },
];

const INIT_APPEARANCE: SettingItem[] = [
  { id: 'a1', icon: '\uD83C\uDF19', label: 'Dark Mode', desc: 'Use dark theme throughout the app', enabled: true, category: 'appearance' },
  { id: 'a2', icon: '\uD83D\uDD24', label: 'Large Text', desc: 'Increase font size for readability', enabled: false, category: 'appearance' },
  { id: 'a3', icon: '\u2728', label: 'Animations', desc: 'Enable UI transitions and effects', enabled: true, category: 'appearance' },
  { id: 'a4', icon: '\u2601\uFE0F', label: 'Auto Backup', desc: 'Backup data to cloud daily', enabled: true, category: 'appearance' },
];

type SectionId = 'notifications' | 'privacy' | 'appearance';

const SECTIONS: { id: SectionId; label: string; icon: string; color: string }[] = [
  { id: 'notifications', label: 'Notifications', icon: '\uD83D\uDD14', color: C.accent },
  { id: 'privacy', label: 'Privacy & Security', icon: '\uD83D\uDD12', color: C.green },
  { id: 'appearance', label: 'Appearance', icon: '\uD83C\uDFA8', color: C.purple },
];

// ── Settings Demo ────────────────────────────────────────────────────────────
export function SettingsDemo({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 768;

  const [activeSection, setActiveSection] = useState<SectionId>('notifications');
  const [notifications, setNotifications] = useState(INIT_NOTIFICATIONS);
  const [privacy, setPrivacy] = useState(INIT_PRIVACY);
  const [appearance, setAppearance] = useState(INIT_APPEARANCE);

  const getList = (id: SectionId) => {
    if (id === 'notifications') return notifications;
    if (id === 'privacy') return privacy;
    return appearance;
  };
  const setList = (id: SectionId, data: SettingItem[]) => {
    if (id === 'notifications') setNotifications(data);
    else if (id === 'privacy') setPrivacy(data);
    else setAppearance(data);
  };

  const activeList = getList(activeSection);
  const activeInfo = SECTIONS.find(s => s.id === activeSection)!;
  const enabledCount = activeList.filter(s => s.enabled).length;

  const toggleSetting = useCallback((id: string) => {
    setNotifications(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
    setPrivacy(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
    setAppearance(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }, []);

  const handleReset = useCallback(() => {
    setNotifications(INIT_NOTIFICATIONS);
    setPrivacy(INIT_PRIVACY);
    setAppearance(INIT_APPEARANCE);
  }, []);

  const renderItem = useCallback(({ item }: { item: SettingItem; index: number; isDragging: boolean }) => (
    <View style={s.row}>
      <Text style={s.grip}>{'\u2807'}</Text>
      <View style={[s.iconWrap, { backgroundColor: activeInfo.color + '18' }]}>
        <Text style={s.icon}>{item.icon}</Text>
      </View>
      <View style={s.rowContent}>
        <Text style={s.rowLabel}>{item.label}</Text>
        <Text style={s.rowDesc}>{item.desc}</Text>
      </View>
      <Switch
        value={item.enabled}
        onValueChange={() => toggleSetting(item.id)}
        trackColor={{ false: C.border, true: activeInfo.color + '80' }}
        thumbColor={item.enabled ? activeInfo.color : C.dim}
      />
    </View>
  ), [toggleSetting, activeInfo.color]);

  // ── Sidebar ──
  const sidebar = (
    <View style={[s.sidebar, isNarrow && s.sidebarNarrow]}>
      <View style={s.sidebarHeader}>
        <Text style={s.sidebarTitle}>Settings</Text>
        <Text style={s.sidebarSubtitle}>Drag to prioritize</Text>
      </View>
      {SECTIONS.map((section) => {
        const isActive = activeSection === section.id;
        const list = getList(section.id);
        const enabled = list.filter(s => s.enabled).length;
        return (
          <TouchableOpacity
            key={section.id}
            style={[s.sidebarItem, isActive && s.sidebarItemActive]}
            onPress={() => setActiveSection(section.id)}
            activeOpacity={0.7}
          >
            <View style={[s.sidebarDot, { backgroundColor: section.color }]} />
            <View style={s.sidebarItemContent}>
              <Text style={[s.sidebarItemLabel, isActive && s.sidebarItemLabelActive]}>
                {section.label}
              </Text>
              <Text style={s.sidebarItemMeta}>
                {enabled}/{list.length} enabled
              </Text>
            </View>
            {isActive && <Text style={[s.sidebarArrow, { color: section.color }]}>{'\u25B8'}</Text>}
          </TouchableOpacity>
        );
      })}

      <View style={s.sidebarFooter}>
        <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
          <Text style={s.resetBtn}>{'\u21BB'} Reset all</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Main content ──
  const content = (
    <View style={s.content}>
      <View style={s.contentHeader}>
        <View style={s.contentTitleRow}>
          <View style={[s.contentDot, { backgroundColor: activeInfo.color }]} />
          <Text style={s.contentTitle}>{activeInfo.label}</Text>
        </View>
        <View style={s.badge}>
          <Text style={[s.badgeText, { color: activeInfo.color }]}>{enabledCount}/{activeList.length}</Text>
        </View>
      </View>

      <Text style={s.contentSubtitle}>
        Long-press any row to reorder. Toggle switches work independently.
      </Text>

      <SortableList
        data={activeList}
        keyExtractor={(item) => item.id}
        direction="vertical"
        dragEffect="pickup"
        renderItem={renderItem}
        renderInsertIndicator={() => (
          <View style={s.insertBar}>
            <View style={[s.insertDot, { backgroundColor: activeInfo.color }]} />
            <View style={[s.insertLine, { backgroundColor: activeInfo.color }]} />
            <View style={[s.insertDot, { backgroundColor: activeInfo.color }]} />
          </View>
        )}
        onReorder={(data) => setList(activeSection, data)}
      />
    </View>
  );

  return (
    <View style={s.root}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <Text style={s.backBtn}>{'\u2190'} Back</Text>
        </TouchableOpacity>
        {isNarrow && <Text style={s.topBarTitle}>Settings</Text>}
      </View>

      {isNarrow ? (
        <ScrollView style={s.scrollFull}>
          {/* Horizontal section tabs on mobile */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mobileTabs} contentContainerStyle={s.mobileTabsContent}>
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.id;
              return (
                <TouchableOpacity
                  key={section.id}
                  style={[s.mobileTab, isActive && { borderColor: section.color, backgroundColor: section.color + '12' }]}
                  onPress={() => setActiveSection(section.id)}
                  activeOpacity={0.7}
                >
                  <Text style={s.mobileTabIcon}>{section.icon}</Text>
                  <Text style={[s.mobileTabText, isActive && { color: section.color }]}>{section.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={s.mobileContent}>{content}</View>
          <View style={s.mobileReset}>
            <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
              <Text style={s.resetBtn}>{'\u21BB'} Reset all</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <View style={s.layout}>
          {sidebar}
          <ScrollView style={s.scrollContent}>{content}</ScrollView>
        </View>
      )}
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
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 16,
  },
  backBtn: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.accent,
  },
  topBarTitle: {
    fontFamily: 'monospace',
    fontSize: 15,
    fontWeight: '700',
    color: C.text,
  },

  // Desktop layout
  layout: {
    flex: 1,
    flexDirection: 'row',
  },

  // Sidebar
  sidebar: {
    width: 260,
    borderRightWidth: 1,
    borderRightColor: C.border,
    backgroundColor: C.surface,
    paddingTop: 24,
  },
  sidebarNarrow: {
    width: '100%' as any,
    borderRightWidth: 0,
  },
  sidebarHeader: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sidebarTitle: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  sidebarSubtitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  sidebarItemActive: {
    backgroundColor: C.surfaceHigh,
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
  },
  sidebarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sidebarItemContent: {
    flex: 1,
  },
  sidebarItemLabel: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: C.muted,
  },
  sidebarItemLabelActive: {
    color: C.text,
    fontWeight: '600',
  },
  sidebarItemMeta: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: C.dim,
    marginTop: 2,
  },
  sidebarArrow: {
    fontSize: 12,
  },
  sidebarFooter: {
    paddingHorizontal: 20,
    paddingTop: 24,
    marginTop: 'auto' as any,
    paddingBottom: 24,
  },
  resetBtn: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.dim,
  },

  // Mobile tabs
  mobileTabs: {
    maxHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  mobileTabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  mobileTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  mobileTabIcon: {
    fontSize: 14,
  },
  mobileTabText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.muted,
  },
  mobileContent: {
    padding: 16,
  },
  mobileReset: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Content area
  scrollFull: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  content: {
    padding: 32,
    maxWidth: 600,
  },
  contentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  contentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  contentTitle: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  badge: {
    backgroundColor: C.surfaceHigh,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '600',
  },
  contentSubtitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: C.dim,
    marginBottom: 24,
  },

  // Setting row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 12,
  },
  grip: {
    fontSize: 18,
    color: C.dim,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '600',
    color: C.text,
    marginBottom: 2,
  },
  rowDesc: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.muted,
    lineHeight: 16,
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
  },
  insertLine: {
    flex: 1,
    height: 2,
  },
});
