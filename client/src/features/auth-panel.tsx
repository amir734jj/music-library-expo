import { useState } from 'react';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
  const theme = useTheme();
  const { desktopLogLocation, enterOfflineMode, exitOfflineMode, offlineModeSupported, sessionStatus, signIn, signOut, signUp, user } = useApp();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>('login');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const canSubmit = Boolean(email.trim()) && password.length > 0 && (
    mode === 'login' || (password.length >= 8 && password === passwordConfirmation)
  );
  const inputStyle = [styles.input, { backgroundColor: theme.background, color: theme.text }];

  if (sessionStatus === 'restoring') {
    return <ThemedText themeColor="textSecondary">Restoring your session...</ThemedText>;
  }

  if (sessionStatus === 'offline') {
    return <ThemedView type="backgroundElement" style={styles.panel}><ThemedText style={styles.name}>Offline mode</ThemedText><ThemedText themeColor="textSecondary">Only recordings cached on this device are available.</ThemedText><ActionButton label="Return to sign in" onPress={() => { exitOfflineMode(); router.replace('/account'); }} /></ThemedView>;
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
        <ThemedText themeColor="textSecondary">Your account is active and synchronized with this device.</ThemedText>
        {desktopLogLocation && <ThemedText selectable style={styles.logLocation} themeColor="textSecondary">Log file: {desktopLogLocation}</ThemedText>}
        <ActionButton danger label="Sign out of Music Library" onPress={() => void signOut()} />
      </ThemedView>
    );
  }

  async function submit(): Promise<void> {
    setSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      if (mode === 'login') {
        await signIn({ email: email.trim(), password });
      } else {
        if (password !== passwordConfirmation) throw new Error('Passwords do not match.');
        const registeredUser = await signUp({ displayName: displayName.trim() || null, email: email.trim(), password, passwordConfirmation });
        setMode('login');
        setPassword('');
        setPasswordConfirmation('');
        setStatus(registeredUser.isActive
          ? 'Account created. Sign in to continue.'
          : 'Account created. An administrator must enable it before you can sign in.');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <SegmentControl options={modes} onChange={(nextMode) => { setMode(nextMode); setError(null); setStatus(null); }} value={mode} />
      {mode === 'register' && <ThemedText themeColor="textSecondary">The first account becomes the administrator. Later accounts require administrator approval.</ThemedText>}
      {mode === 'register' && <TextInput autoCapitalize="words" onChangeText={setDisplayName} placeholder="Display name (optional)" placeholderTextColor={theme.textSecondary} style={inputStyle} value={displayName} />}
      <TextInput autoCapitalize="none" autoComplete="email" inputMode="email" onChangeText={setEmail} placeholder="Email" placeholderTextColor={theme.textSecondary} style={inputStyle} value={email} />
      <TextInput autoCapitalize="none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChangeText={setPassword} placeholder="Password" placeholderTextColor={theme.textSecondary} secureTextEntry style={inputStyle} value={password} />
      {mode === 'register' && <TextInput autoCapitalize="none" autoComplete="new-password" onChangeText={setPasswordConfirmation} placeholder="Confirm password" placeholderTextColor={theme.textSecondary} secureTextEntry style={inputStyle} value={passwordConfirmation} />}
      {mode === 'register' && <ThemedText style={styles.requirement} themeColor="textSecondary">Use at least 8 characters.</ThemedText>}
      {status && <ThemedText style={styles.status}>{status}</ThemedText>}
      {error && <ThemedText style={styles.error}>{error}</ThemedText>}
      {desktopLogLocation && <ThemedText selectable style={styles.logLocation} themeColor="textSecondary">Log file: {desktopLogLocation}</ThemedText>}
      <ActionButton disabled={submitting || !canSubmit} label={submitting ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'} onPress={() => void submit()} />
      {offlineModeSupported && <ActionButton label="Continue offline" quiet onPress={() => void enterOfflineMode().then(() => router.replace('/explore'))} />}
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
  logLocation: { fontSize: 12 },
  name: { fontSize: 18, fontWeight: '800' },
  panel: { gap: Spacing.three, padding: Spacing.four },
  requirement: { fontSize: 12 },
  role: { backgroundColor: '#DDE9E2', borderRadius: 3, color: Palette.accentStrong, fontSize: 12, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4 },
  roles: { flexDirection: 'row', gap: Spacing.two },
  status: { backgroundColor: '#DDE9E2', color: Palette.accentStrong, fontSize: 13, padding: Spacing.three },
});