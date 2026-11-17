// app/index.tsx
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { useAuthStore } from '../lib/hooks/useAuth';

export default function Index() {
  const session = useAuthStore((state) => state.session);
  const profile = useAuthStore((state) => state.profile);
  const isRecovering = useAuthStore((state) => state.isRecovering);

  // Signed out: sign in at the portal (one login for every app), then come straight back here
  if (!session && Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.location.replace('/login?next=' + encodeURIComponent('/finance'));
    return null;
  }
  if (!session) return <Redirect href="/(auth)/login" />;

  // Opened from a reset-password email: they choose a new password first.
  if (isRecovering) return <Redirect href="/(auth)/reset-password" />;

  // Session is restored a tick before the profile row arrives; showing a
  // spinner (instead of redirecting to login) is what keeps a page refresh
  // from forcing a fresh sign-in.
  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1d4ed8" />
      </View>
    );
  }

  return <Redirect href="/(store)/company-dashboard" />;
}
