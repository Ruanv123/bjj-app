import { Tabs } from 'expo-router/js-tabs';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { useUnreadTotal } from '@/features/chat/hooks';
import { useInboxRealtime } from '@/features/chat/realtime';
import { useNotificationNavigation, usePushRegistration } from '@/features/notifications/hooks';
import { formatUnread } from '@/features/chat/format';
import { useTheme } from '@/hooks/use-theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type TabIconSet = { outline: SymbolName; filled: SymbolName };

const ICONS = {
  home: {
    outline: { ios: 'house', android: 'home', web: 'home' },
    filled: { ios: 'house.fill', android: 'home', web: 'home' },
  },
  videos: {
    outline: { ios: 'play.rectangle', android: 'ondemand_video', web: 'ondemand_video' },
    filled: { ios: 'play.rectangle.fill', android: 'ondemand_video', web: 'ondemand_video' },
  },
  chat: {
    outline: { ios: 'bubble.left.and.bubble.right', android: 'forum', web: 'forum' },
    filled: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' },
  },
  notifications: {
    outline: { ios: 'bell', android: 'notifications', web: 'notifications' },
    filled: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  },
  profile: {
    outline: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
    filled: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
  },
} satisfies Record<string, TabIconSet>;

/**
 * Abas em JS (em vez de NativeTabs) para ter uma barra sólida, em fluxo:
 * o conteúdo termina acima dela em vez de rolar por baixo (no iOS 26+ a
 * barra nativa é sempre translúcida — Liquid Glass).
 */
export default function AppTabs() {
  const { t } = useTranslation();
  const theme = useTheme();
  const unread = useUnreadTotal();
  // Mantém a lista de DMs (e o badge) atualizada em qualquer aba.
  useInboxRealtime();
  usePushRegistration();
  useNotificationNavigation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
        sceneStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icons={ICONS.home} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="videos"
        options={{
          title: t('tabs.videos'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icons={ICONS.videos} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          tabBarBadge: unread > 0 ? formatUnread(unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.primary, color: theme.onPrimary },
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icons={ICONS.chat} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: t('tabs.notifications'),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icons={ICONS.notifications} focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('settings.title'),
          tabBarLabel: t('tabs.profile'),
          // Esta aba é a tela de Configurações, com cabeçalho centralizado.
          headerShown: true,
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.groupedBackground },
          headerTintColor: theme.text,
          sceneStyle: { backgroundColor: theme.groupedBackground },
          tabBarIcon: ({ focused, color }) => (
            <TabIcon icons={ICONS.profile} focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

type TabIconProps = {
  icons: TabIconSet;
  focused: boolean;
  color: ComponentProps<typeof SymbolView>['tintColor'];
};

function TabIcon({ icons, focused, color }: TabIconProps) {
  return <SymbolView name={focused ? icons.filled : icons.outline} tintColor={color} size={24} />;
}
