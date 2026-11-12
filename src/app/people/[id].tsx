import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { GroupedScreen } from '@/components/ui/grouped-screen';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { FeedTabs } from '@/features/feed/components/feed-tabs';
import { Timeline } from '@/features/feed/components/timeline';
import { SocialProfileBar } from '@/features/feed/components/social-profile-bar';
import { useOpenDm } from '@/features/chat/hooks';
import { chatErrorCode } from '@/features/chat/types';
import { isProfileId } from '@/features/profile/api';
import { AthleteProfileDetails } from '@/features/profile/components/athlete-profile';
import { BeltBadge } from '@/features/profile/components/belt-badge';
import { usePublicProfile } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [tab, setTab] = useState<'posts' | 'about'>('posts');
  const theme = useTheme();
  const user = useUser();
  const query = usePublicProfile(id);
  const openDm = useOpenDm();
  const profile = query.data;
  const own = user?.id === id;
  const loading = !!user && isProfileId(id) && query.isPending;

  function sendMessage() {
    if (!profile || own || openDm.isPending) return;
    openDm.mutate(profile.id, {
      onSuccess: (conversationId) =>
        router.navigate({ pathname: '/chat/[id]', params: { id: conversationId } }),
      onError: (error) =>
        showAlert(chatErrorCode(error) === 'blocked' ? t('chat.dmBlocked') : t('chat.openDmError')),
    });
  }

  const identity = profile ? (
    <View style={[styles.identity, { backgroundColor: theme.card }]}>
      <Avatar
        name={profile.displayName ?? t('profile.defaultName')}
        url={profile.avatarUrl}
        size={88}
      />
      <ThemedText accessibilityRole="header" style={styles.name}>
        {profile.displayName ?? t('profile.defaultName')}
      </ThemedText>
      {profile.belt ? (
        <BeltBadge belt={profile.belt} degree={profile.beltDegree} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('socialProfile.noGraduation')}
        </ThemedText>
      )}
      {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}
      <SocialProfileBar userId={profile.id} own={own} />
      <View style={styles.action}>
        {own ? (
          <Button
            label={t('settings.editProfile')}
            variant="outline"
            onPress={() => router.push('/settings/edit-profile')}
          />
        ) : (
          <Button
            label={t('chat.sendMessage')}
            variant="outline"
            loading={openDm.isPending}
            onPress={sendMessage}
          />
        )}
      </View>
      <FeedTabs
        options={[
          { value: 'posts', label: t('feed.posts') },
          { value: 'about', label: t('feed.about') },
        ]}
        value={tab}
        onChange={setTab}
      />
    </View>
  ) : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen
        options={{
          title: t('socialProfile.title'),
          headerStyle: { backgroundColor: theme.background },
        }}
      />
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator
            accessibilityLabel={t('socialProfile.loading')}
            color={theme.primary}
          />
        ) : query.isError ? (
          <View style={styles.state}>
            <ThemedText>{t('socialProfile.loadError')}</ThemedText>
            <Button
              label={t('browse.retry')}
              variant="outline"
              onPress={() => {
                void query.refetch();
              }}
            />
          </View>
        ) : !profile ? (
          <View style={styles.state}>
            <ThemedText style={styles.stateTitle}>{t('socialProfile.unavailable')}</ThemedText>
            <ThemedText themeColor="textSecondary">{t('socialProfile.unavailableHint')}</ThemedText>
          </View>
        ) : tab === 'posts' ? (
          <Timeline
            filter={{ authorId: profile.id }}
            header={identity ?? undefined}
            empty={t('feed.noAuthorPosts')}
          />
        ) : (
          <GroupedScreen>
            {identity}
            <AthleteProfileDetails profile={profile} showBelt={false} />
          </GroupedScreen>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  identity: { padding: Spacing.four, gap: Spacing.three, alignItems: 'flex-start' },
  name: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  action: { alignSelf: 'stretch' },
  state: { gap: Spacing.three, padding: Spacing.four },
  stateTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
});
