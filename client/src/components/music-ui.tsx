import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ScreenHeader({ eyebrow, title, trailing }: { eyebrow: string; title: string; trailing?: ReactNode }) {
  return <View style={styles.screenHeader}><View style={styles.headerCopy}><ThemedText style={styles.eyebrow}>{eyebrow}</ThemedText><ThemedText style={styles.screenTitle}>{title}</ThemedText></View>{trailing}</View>;
}

export function SectionHeader({ count, title }: { count?: number; title: string }) {
  return <View style={styles.sectionHeader}><ThemedText style={styles.sectionTitle}>{title}</ThemedText>{count !== undefined && <ThemedText themeColor="textSecondary">{count}</ThemedText>}</View>;
}

export function SearchField({ onChangeText, placeholder, value }: { onChangeText(value: string): void; placeholder: string; value: string }) {
  const theme = useTheme();
  return <TextInput accessibilityLabel={placeholder} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={theme.textSecondary} returnKeyType="search" style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]} value={value} />;
}

export function SegmentControl<T extends string>({ options, onChange, value }: { options: readonly { label: string; value: T }[]; onChange(value: T): void; value: T }) {
  return <ThemedView type="backgroundElement" style={styles.segments}>{options.map((option) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: value === option.value }} key={option.value} onPress={() => onChange(option.value)} style={[styles.segment, value === option.value && styles.segmentActive]}><ThemedText style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</ThemedText></Pressable>)}</ThemedView>;
}

export function ActionButton({ danger, disabled, label, onPress, quiet }: { danger?: boolean; disabled?: boolean; label: string; onPress(): void; quiet?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, quiet && styles.buttonQuiet, danger && styles.buttonDanger, disabled && styles.disabled, pressed && styles.pressed]}><ThemedText style={[styles.buttonText, quiet && styles.buttonQuietText]}>{label}</ThemedText></Pressable>;
}

export function Row({ children, onPress, selected, style }: PropsWithChildren<{ onPress?: () => void; selected?: boolean; style?: ViewStyle }>) {
  const content = <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={[styles.row, style]}>{children}</ThemedView>;
  return onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content;
}

export function EmptyState({ children }: PropsWithChildren) {
  return <ThemedText style={styles.empty} themeColor="textSecondary">{children}</ThemedText>;
}

export function LoadingState() {
  return <ActivityIndicator color={Palette.accent} style={styles.loading} />;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: Palette.accent, borderRadius: 4, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14 },
  buttonDanger: { backgroundColor: Palette.danger },
  buttonQuiet: { backgroundColor: 'transparent', borderColor: Palette.line, borderWidth: 1 },
  buttonQuietText: { color: Palette.accentStrong },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  empty: { paddingVertical: Spacing.five, textAlign: 'center' },
  eyebrow: { color: Palette.accent, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  headerCopy: { flex: 1, gap: 3 },
  loading: { marginVertical: Spacing.five },
  pressed: { opacity: 0.72 },
  row: { borderBottomColor: Palette.line, borderBottomWidth: StyleSheet.hairlineWidth, gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  screenHeader: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  screenTitle: { fontFamily: 'Georgia', fontSize: 30, fontWeight: '700', letterSpacing: 0, lineHeight: 36 },
  search: { borderColor: Palette.line, borderRadius: 4, borderWidth: 1, fontSize: 16, minHeight: 46, paddingHorizontal: 14 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.three },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  segment: { alignItems: 'center', borderRadius: 3, flex: 1, minHeight: 38, justifyContent: 'center', paddingHorizontal: Spacing.two },
  segmentActive: { backgroundColor: Palette.accent },
  segmentText: { fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: '#FFFFFF' },
  segments: { borderColor: Palette.line, borderRadius: 5, borderWidth: 1, flexDirection: 'row', padding: 3 },
});