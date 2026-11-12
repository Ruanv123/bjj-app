import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { GroupedScreen } from '@/components/ui/grouped-screen';
import { SettingsRow, SettingsSection } from '@/components/ui/settings-list';
import { useUser } from '@/features/auth/auth-provider';
import { useSignOut } from '@/features/auth/hooks';
import { AthleteProfile } from '@/features/profile/components/athlete-profile';
import { ProfileCard } from '@/features/profile/components/profile-card';
import { SubscriptionSection } from '@/features/subscription/components/subscription-section';
import { getProviderName } from '@/features/profile/utils';
import { showAlert } from '@/lib/alert';
import { confirmDestructive } from '@/lib/confirm';
import { getErrorMessage } from '@/lib/errors';
import { languageNames } from '@/lib/i18n';
import { usePreferences } from '@/stores/preferences';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const user = useUser();
  const signOut = useSignOut();
  const language = usePreferences((s) => s.language);
  const colorScheme = usePreferences((s) => s.colorScheme);

  const provider = getProviderName(user);
  const version = Constants.expoConfig?.version;

  async function handleSignOut() {
    const confirmed = await confirmDestructive({
      title: t('settings.signOutConfirm'),
      confirmLabel: t('settings.signOut'),
      cancelLabel: t('settings.cancel'),
    });
    if (!confirmed) return;
    signOut.mutate(undefined, {
      onError: (error) =>
        showAlert(t('profile.signOutError'), getErrorMessage(error, t('common.tryAgain'))),
    });
  }

  return (
    <GroupedScreen>
      <ProfileCard onEdit={() => router.push('/settings/edit-profile')} />
      <AthleteProfile />
      {user ? (
        <SettingsSection>
          <SettingsRow
            icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
            label={t('socialProfile.preview')}
            onPress={() => router.push({ pathname: '/people/[id]', params: { id: user.id } })}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection title={t('settings.sectionAccount')}>
        <SettingsRow
          icon={{
            ios: 'bookmark',
            android: 'bookmark_border',
            web: 'bookmark_border',
          }}
          label={t('settings.savedVideos')}
          onPress={() => router.push('/saved')}
        />
        {user ? (
          <SettingsRow
            icon={{
              ios: 'person.crop.circle',
              android: 'account_circle',
              web: 'account_circle',
            }}
            label={t('account.title')}
            value={provider ?? undefined}
            onPress={() => router.push('/settings/account')}
          />
        ) : null}
      </SettingsSection>

      <SubscriptionSection />

      <SettingsSection title={t('settings.sectionGeneral')}>
        <SettingsRow
          icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
          label={t('settings.notifications')}
          onPress={() => router.navigate('/notifications')}
        />
        <SettingsRow
          icon={{ ios: 'hand.raised', android: 'block', web: 'block' }}
          label={t('chat.blockedUsers')}
          onPress={() => router.push('/settings/blocked-users')}
        />
        <SettingsRow
          icon={{ ios: 'globe', android: 'language', web: 'language' }}
          label={t('settings.language')}
          value={language ? languageNames[language] : t('settings.system')}
          onPress={() => router.push('/settings/language')}
        />
        <SettingsRow
          icon={{
            ios: 'circle.lefthalf.filled',
            android: 'contrast',
            web: 'contrast',
          }}
          label={t('settings.appearance')}
          value={t(`settings.${colorScheme}`)}
          onPress={() => router.push('/settings/appearance')}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.sectionAbout')}>
        <SettingsRow
          icon={{ ios: 'info.circle', android: 'info', web: 'info' }}
          label={t('settings.version')}
          value={version}
        />
      </SettingsSection>

      <SettingsSection>
        <SettingsRow
          icon={{
            ios: 'rectangle.portrait.and.arrow.right',
            android: 'logout',
            web: 'logout',
          }}
          label={t('settings.signOut')}
          destructive
          onPress={handleSignOut}
        />
      </SettingsSection>
    </GroupedScreen>
  );
}
