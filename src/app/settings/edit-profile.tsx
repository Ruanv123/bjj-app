import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Button } from '@/components/ui/button';
import { GroupedScreen } from '@/components/ui/grouped-screen';
import { ThemedText } from '@/components/ui/themed-text';
import { useUser } from '@/features/auth/auth-provider';
import { AvatarEditor } from '@/features/profile/components/avatar-editor';
import { ProfileForm } from '@/features/profile/components/profile-form';
import { emptyProfileDetails } from '@/features/profile/details';
import { useDisplayProfile, useProfile } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const user = useUser();
  const theme = useTheme();
  const { name } = useDisplayProfile();
  const profile = useProfile();
  const data = profile.data;
  const initial = data
    ? {
        displayName: data.displayName ?? name ?? '',
        bio: data.bio,
        instagram: data.instagram,
        belt: data.belt,
        beltDegree: data.beltDegree,
        disciplines: data.disciplines,
        competitions: data.competitions,
      }
    : emptyProfileDetails(name ?? '');

  return (
    <GroupedScreen>
      <Stack.Screen options={{ title: t('settings.editProfile') }} />
      {!user ? (
        <ThemedText>{t('athlete.signIn')}</ThemedText>
      ) : profile.isPending ? (
        <ActivityIndicator color={theme.primary} />
      ) : profile.isError ? (
        <>
          <ThemedText>{t('athlete.loadError')}</ThemedText>
          <Button
            label={t('browse.retry')}
            onPress={() => {
              void profile.refetch();
            }}
          />
        </>
      ) : (
        <>
          <AvatarEditor />
          <ProfileForm key={user.id} initial={initial} />
        </>
      )}
    </GroupedScreen>
  );
}
