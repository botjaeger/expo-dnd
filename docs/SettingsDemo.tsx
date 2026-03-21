import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
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
};

// ── Types ────────────────────────────────────────────────────────────────────
interface SettingItem {
  id: string;
  icon: string;
  label: string;
  desc: string;
  enabled: boolean;
}

// ── Seed data ────────────────────────────────────────────────────────────────
const INIT_SETTINGS: SettingItem[] = [
  { id: 's1', icon: '\uD83D\uDD14', label: 'Push Notifications', desc: 'Alerts for new messages and updates', enabled: true },
  { id: 's2', icon: '\uD83C\uDF19', label: 'Dark Mode', desc: 'Use dark theme throughout the app', enabled: true },
  { id: 's3', icon: '\uD83D\uDD12', label: 'Biometric Login', desc: 'Face ID or fingerprint to unlock', enabled: false },
  { id: 's4', icon: '\uD83D\uDCCD', label: 'Location Services', desc: 'Allow access to your location', enabled: true },
  { id: 's5', icon: '\uD83D\uDCF7', label: 'Camera Access', desc: 'Allow access to your camera', enabled: false },
  { id: 's6', icon: '\u2601\uFE0F', label: 'Auto Backup', desc: 'Backup data to cloud daily', enabled: true },
  { id: 's7', icon: '\uD83D\uDD0A', label: 'Sound Effects', desc: 'Play sounds for interactions', enabled: false },
  { id: 's8', icon: '\uD83D\uDCCA', label: 'Analytics', desc: 'Share anonymous usage data', enabled: false },
];

// ── Settings Demo ────────────────────────────────────────────────────────────
export function SettingsDemo({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState(INIT_SETTINGS);

  const toggleSetting = useCallback((id: string) => {
    setSettings(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  }, []);

  const handleReset = useCallback(() => {
    setSettings(INIT_SETTINGS);
  }, []);

  const enabledCount = settings.filter(s => s.enabled).length;

  const renderItem = useCallback(({ item }: { item: SettingItem; index: number; isDragging: boolean }) => (
    <View style={s.row}>
      <Text style={s.grip}>{'\u2807'}</Text>
      <Text style={s.icon}>{item.icon}</Text>
      <View style={s.rowContent}>
        <Text style={s.rowLabel}>{item.label}</Text>
        <Text style={s.rowDesc}>{item.desc}</Text>
      </View>
      <Switch
        value={item.enabled}
        onValueChange={() => toggleSetting(item.id)}
        trackColor={{ false: C.border, true: C.accent + '80' }}
        thumbColor={item.enabled ? C.accent : C.dim}
      />
    </View>
  ), [toggleSetting]);

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
            <Text style={s.backBtn}>{'\u2190'} Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Settings</Text>
        </View>
        <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
          <Text style={s.resetBtn}>{'\u21BB'} Reset</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.subtitle}>
        Long-press to reorder. Toggle switches work independently of drag.
      </Text>

      <View style={s.stats}>
        <Text style={s.statsText}>
          {enabledCount} of {settings.length} enabled
        </Text>
      </View>

      {/* Settings list */}
      <View style={s.listWrap}>
        <SortableList
          data={settings}
          keyExtractor={(item) => item.id}
          direction="vertical"
          dragEffect="pickup"
          renderItem={renderItem}
          renderInsertIndicator={() => (
            <View style={s.insertBar}>
              <View style={s.insertDot} />
              <View style={s.insertLine} />
              <View style={s.insertDot} />
            </View>
          )}
          onReorder={(data) => setSettings(data)}
        />
      </View>
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
    marginBottom: 12,
  },
  stats: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  statsText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: C.dim,
  },

  // List
  listWrap: {
    paddingHorizontal: 24,
    maxWidth: 500,
  },
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
  icon: {
    fontSize: 20,
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
    backgroundColor: C.accent,
  },
  insertLine: {
    flex: 1,
    height: 2,
    backgroundColor: C.accent,
  },
});
