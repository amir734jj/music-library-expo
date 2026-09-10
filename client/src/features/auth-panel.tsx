import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ActionButton, SegmentControl } from '@/components/music-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Palette, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useApp } from '@/providers/app-provider';

type AuthMode = 'login' | 'register';
const modes = [{ label: 'Sign in', value: 'login' }, { label: 'Create account', value: 'register' }] as const;

export function AuthPanel() {
  const theme = useTheme();
  const { sessionStatus, signIn, signOut, signUp, user } = useApp();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>('login');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = Boolean(email.trim()) && password.length > 0 && (
    mode === 'login' || (password.length >= 8 && password === passwordConfirmation)
  );
  const inputStyle = [styles.input, { backgroundColor: theme.background, color: theme.text }];

  if (sessionStatus === 'restoring') {
    return <ThemedText themeColor="textSecondary">Restoring your session...</ThemedText>;
  }

  if (user) {
    return (
      <ThemedView type="backgroundElement" style={styles.panel}>
        <View style={styles.identity}>
          <View style={styles.avatar}><ThemedText style={styles.avatarText}>{(user.displayName || user.email)[0].toUpperCase()}</ThemedText></View>
          <View style={styles.copy}>
            <ThemedText style={styles.name}>{user.displayName || 'Music listener'}</ThemedText>
            <ThemedText themeColor="textSecondary">{user.email}</ThemedText>
          </View>
        </View>
        <View style={styles.roles}>{user.roles.map((role) => <ThemedText key={role} style={styles.role}>{role}</ThemedText>)}</View>
        <ActionButton label="Sign out" onPress={() => void signOut()} quiet />
      </ThemedView>
    );
  }

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'login') {
        await signIn({ email: email.trim(), password });
      } else {
        if (password !== passwordConfirmation) throw new Error('Passwords do not match.');
        await signUp({ displayName: displayName.trim() || null, email: email.trim(), password, passwordConfirmation });
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <SegmentControl options={modes} onChange={setMode} value={mode} />
      {mode === 'register' && <TextInput autoCapitalize="words" onChangeText={setDisplayName} placeholder="Display name (optional)" placeholderTextColor={theme.textSecondary} style={inputStyle} value={displayName} />}
      <TextInput autoCapitalize="none" autoComplete="email" inputMode="email" onChangeText={setEmail} placeholder="Email" placeholderTextColor={theme.textSecondary} style={inputStyle} value={email} />
      <TextInput autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChangeText={setPassword} placeholder="Password" placeholderTextColor={theme.textSecondary} secureTextEntry style={inputStyle} value={password} />
      {mode === 'register' && <TextInput autoCapitalize="none" autoComplete="new-password" onChangeText={setPasswordConfirmation} placeholder="Confirm password" placeholderTextColor={theme.textSecondary} secureTextEntry style={inputStyle} value={passwordConfirmation} />}
      {mode === 'register' && <ThemedText style={styles.requirement} themeColor="textSecondary">Use at least 8 characters.</ThemedText>}
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      <ActionButton disabled={submitting || !canSubmit} label={submitting ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'} onPress={() => void submit()} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: Palette.gold, borderRadius: 4, height: 46, justifyContent: 'center', width: 46 },
  avatarText: { color: Palette.ink, fontSize: 18, fontWeight: '900' },
  copy: { flex: 1 },
  error: { color: Palette.danger, fontSize: 13 },
  identity: { alignItems: 'center', flexDirection: 'row', gap: Spacing.three },
  input: { borderColor: Palette.line, borderRadius: 4, borderWidth: 1, fontSize: 16, minHeight: 46, paddingHorizontal: 14 },
  name: { fontSize: 18, fontWeight: '800' },
  panel: { gap: Spacing.three, padding: Spacing.four },
  requirement: { fontSize: 12 },
  role: { backgroundColor: '#DDE9E2', borderRadius: 3, color: Palette.accentStrong, fontSize: 12, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4 },
  roles: { flexDirection: 'row', gap: Spacing.two },
});