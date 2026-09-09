import { UserRole, type GlobalConfigModel, type ProbeStatusSummary, type TrendingCacheStatusSummary, type UserResponse } from '@music-library/core';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';

import { ActionButton, EmptyState, LoadingState, Row, SearchField, SectionHeader, SegmentControl } from '@/components/music-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/services/api';

type AdminMode = 'config' | 'probes' | 'users';
const modes = [{ label: 'Probes', value: 'probes' }, { label: 'Users', value: 'users' }, { label: 'Configuration', value: 'config' }] as const;

function configLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

export function AdminPanel() {
  const theme = useTheme();
  const [cache, setCache] = useState<TrendingCacheStatusSummary | null>(null);
  const [config, setConfig] = useState<GlobalConfigModel | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<AdminMode>('probes');
  const [page, setPage] = useState(1);
  const [probes, setProbes] = useState<ProbeStatusSummary | null>(null);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [users, setUsers] = useState<UserResponse[]>([]);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [configRow, cacheRow, probeRows, userRows] = await Promise.all([
        api.adminConfig(), api.cacheStatus(), api.probeStatus(query, page, 25), api.adminUsers(),
      ]);
      setConfig(configRow);
      setConfigValues(Object.fromEntries(Object.entries(configRow).map(([key, value]) => [key, String(value)])));
      setCache(cacheRow);
      setProbes(probeRows);
      setUsers(userRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load administration data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [page]);

  async function updateUser(user: UserResponse, changes: Partial<{ displayName: string | null; isActive: boolean; role: typeof UserRole.Admin | typeof UserRole.User | null }>): Promise<void> {
    await api.updateAdminUser(user.id, {
      displayName: changes.displayName === undefined ? user.displayName : changes.displayName,
      isActive: changes.isActive ?? user.isActive,
      role: changes.role === undefined ? user.roles[0] ?? null : changes.role,
    });
    await load();
  }

  async function saveConfig(): Promise<void> {
    await api.updateAdminConfig({ values: configValues });
    setResult('Configuration saved.');
    await load();
  }

  async function runImport(): Promise<void> {
    const summary = await api.importStations();
    setResult(`Import complete: ${summary.created} created, ${summary.updated} updated, ${summary.rejected} rejected.`);
    await load();
  }

  if (loading && !probes) return <LoadingState />;

  return (
    <View style={styles.container}>
      <SegmentControl options={modes} onChange={setMode} value={mode} />
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      {result && <ThemedText style={styles.result}>{result}</ThemedText>}

      {mode === 'probes' && <>
        <View style={styles.metrics}>
          <Metric label="Probe workers" value={String(probes?.activeProbeCount ?? 0)} />
          <Metric label="Enabled stations" value={String(probes?.enabledStationCount ?? 0)} />
          <Metric label="Cached tracks" value={String(cache?.songCount ?? 0)} />
          <Metric label="Cache size" value={`${((cache?.sizeBytes ?? 0) / 1_048_576).toFixed(1)} MB`} />
        </View>
        <ThemedView type="backgroundElement" style={styles.toolbar}>
          <View style={styles.toolbarCopy}><ThemedText style={styles.toolbarTitle}>Directory and probe controls</ThemedText><ThemedText themeColor="textSecondary">Last batch {probes?.lastBatchCompletedAt ? new Date(probes.lastBatchCompletedAt).toLocaleString() : 'has not completed'}</ThemedText></View>
          <View style={styles.actions}><ActionButton label="Import directory" onPress={() => void runImport()} /><ActionButton label="Enable all" quiet onPress={() => void api.updateAllStationProbes({ isProbeEnabled: true }).then(load)} /><ActionButton label="Disable all" quiet onPress={() => void api.updateAllStationProbes({ isProbeEnabled: false }).then(load)} /><ActionButton danger label="Clear cache" onPress={() => void api.clearCache().then(load)} /></View>
        </ThemedView>
        <SearchField onChangeText={setQuery} placeholder="Filter probe status" value={query} />
        <ActionButton label="Apply filter" quiet onPress={() => { setPage(1); void load(); }} />
        <SectionHeader count={probes?.matchingStationCount} title="Station probes" />
        {probes?.stations.length === 0 && <EmptyState>No stations match this filter.</EmptyState>}
        {probes?.stations.map((station) => <Row key={station.id}><View style={styles.userRow}><View style={styles.copy}><ThemedText style={styles.rowTitle}>{station.name}</ThemedText><ThemedText themeColor="textSecondary">{station.isProbing ? 'Probing now' : station.lastMetadataAt ? `Metadata ${new Date(station.lastMetadataAt).toLocaleString()}` : 'No metadata yet'}  |  {station.consecutiveProbeFailures} failures</ThemedText></View><View style={styles.switchGroup}><ThemedText>{station.isProbeEnabled ? 'Enabled' : 'Disabled'}</ThemedText><Switch onValueChange={(isProbeEnabled) => void api.updateStationProbe(station.id, { isProbeEnabled }).then(load)} thumbColor="#FFFFFF" trackColor={{ false: '#A9AEA9', true: Palette.accent }} value={station.isProbeEnabled} /></View></View></Row>)}
        <View style={styles.pagination}><ActionButton disabled={page <= 1} label="Previous" quiet onPress={() => setPage((value) => value - 1)} /><ThemedText>Page {probes?.page ?? page}</ThemedText><ActionButton disabled={!probes || probes.page * probes.pageSize >= probes.matchingStationCount} label="Next" quiet onPress={() => setPage((value) => value + 1)} /></View>
      </>}

      {mode === 'users' && <>
        <SectionHeader count={users.length} title="Registered users" />
        {users.map((account) => <Row key={account.id}><View style={styles.userRow}><View style={styles.copy}><ThemedText style={styles.rowTitle}>{account.displayName || account.email}</ThemedText><ThemedText themeColor="textSecondary">{account.email}  |  {account.roles.join(', ') || 'No role'}</ThemedText></View><View style={styles.switchGroup}><ThemedText>{account.isActive ? 'Active' : 'Inactive'}</ThemedText><Switch onValueChange={(isActive) => void updateUser(account, { isActive })} thumbColor="#FFFFFF" trackColor={{ false: '#A9AEA9', true: Palette.accent }} value={account.isActive} /></View></View><View style={styles.actions}><ActionButton label="Make admin" quiet disabled={account.roles.includes(UserRole.Admin)} onPress={() => void updateUser(account, { role: UserRole.Admin })} /><ActionButton label="Make user" quiet disabled={account.roles.includes(UserRole.User) && !account.roles.includes(UserRole.Admin)} onPress={() => void updateUser(account, { role: UserRole.User })} /><ActionButton danger label="Delete" onPress={() => void api.deleteAdminUser(account.id).then(load)} /></View></Row>)}
      </>}

      {mode === 'config' && config && <>
        <SectionHeader title="Global configuration" />
        <ThemedView type="backgroundElement" style={styles.configGrid}>
          {Object.keys(config).map((key) => <View key={key} style={styles.field}><ThemedText style={styles.fieldLabel}>{configLabel(key)}</ThemedText><TextInput autoCapitalize="none" onChangeText={(value) => setConfigValues((current) => ({ ...current, [key]: value }))} placeholderTextColor={theme.textSecondary} style={[styles.input, { color: theme.text }]} value={configValues[key] ?? ''} /></View>)}
        </ThemedView>
        <ActionButton label="Save configuration" onPress={() => void saveConfig()} />
      </>}
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <ThemedView type="backgroundElement" style={styles.metric}><ThemedText style={styles.metricValue}>{value}</ThemedText><ThemedText style={styles.metricLabel} themeColor="textSecondary">{label}</ThemedText></ThemedView>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  configGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, padding: Spacing.four },
  container: { gap: Spacing.three },
  copy: { flex: 1, minWidth: 180 },
  error: { color: Palette.danger },
  field: { flex: 1, gap: 6, minWidth: 260 },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  input: { borderBottomColor: Palette.line, borderBottomWidth: 1, fontSize: 15, minHeight: 40, paddingHorizontal: Spacing.two },
  metric: { flex: 1, minWidth: 130, padding: Spacing.three },
  metricLabel: { fontSize: 12 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  metricValue: { fontFamily: 'Georgia', fontSize: 24, fontWeight: '700' },
  pagination: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.three },
  result: { backgroundColor: '#DDE9E2', color: Palette.accentStrong, padding: Spacing.three },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  switchGroup: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  toolbar: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three, justifyContent: 'space-between', padding: Spacing.three },
  toolbarCopy: { flex: 1, minWidth: 220 },
  toolbarTitle: { fontSize: 15, fontWeight: '800' },
  userRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});