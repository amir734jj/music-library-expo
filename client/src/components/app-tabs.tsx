import { UserRole } from '@music-library/core';
import { Tabs } from 'expo-router';
import { Image } from 'react-native';

import { Colors } from '@/constants/theme';
import { useApp } from '@/providers/app-provider';
import { useThemePreference } from '@/providers/theme-provider';

export default function AppTabs() {
  const { scheme } = useThemePreference();
  const colors = Colors[scheme];
  const { sessionStatus, user } = useApp();
  const isAdmin = user?.roles.includes(UserRole.Admin) ?? false;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.backgroundElement },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          href: sessionStatus === 'offline' ? null : '/',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('@/assets/images/tabIcons/home.png')}
              style={{ height: size, tintColor: color, width: size }}
            />
          ),
          title: 'Discover',
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('@/assets/images/tabIcons/explore.png')}
              style={{ height: size, tintColor: color, width: size }}
            />
          ),
          title: 'Library',
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{ href: isAdmin ? '/admin' : null, title: 'Admin' }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: sessionStatus === 'anonymous' || sessionStatus === 'offline' ? 'Sign in' : 'Account',
        }}
      />
    </Tabs>
  );
}
