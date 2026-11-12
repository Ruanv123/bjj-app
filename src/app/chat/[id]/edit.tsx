import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, StyleSheet, TextInput, View } from 'react-native';

import { ActionSheet, type ActionSheetAction } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { GroupedScreen } from '@/components/ui/grouped-screen';
import { SettingsSection, SettingsSwitchRow } from '@/components/ui/settings-list';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import type { CommunityImageKind } from '@/features/chat/api';
import { CommunityBanner } from '@/features/chat/components/community-banner';
import { useCommunityImage, useConversation, useUpdateCommunity } from '@/features/chat/hooks';
import { pickCommunityImage } from '@/features/chat/pick-community-image';
import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_NAME_MAX,
  COMMUNITY_NAME_MIN,
  isModerator,
  type Conversation,
} from '@/features/chat/types';
import { PermissionDeniedError, type ImageSource } from '@/features/profile/pick-image';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

export default function EditCommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: info, isPending } = useConversation(id);

  if (isPending || !info) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.groupedBackground }]}>
        <Stack.Screen options={{ title: t('chat.editCommunity') }} />
        {isPending ? <ActivityIndicator /> : <ThemedText>{t('chat.notFound')}</ThemedText>}
      </View>
    );
  }
  if (info.kind !== 'community' || !isModerator(info.myRole)) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.groupedBackground }]}>
        <Stack.Screen options={{ title: t('chat.editCommunity') }} />
        <ThemedText themeColor="textSecondary">{t('chat.onlyAdminsCanEdit')}</ThemedText>
      </View>
    );
  }
  // Formulário separado: o estado inicial vem dos dados já carregados.
  return <EditCommunityForm key={info.communityId} info={info} />;
}

function EditCommunityForm({ info }: { info: Conversation }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [name, setName] = useState(info.title);
  const [description, setDescription] = useState(info.description);
  const [isPrivate, setIsPrivate] = useState(info.isPrivate);
  const [imageMenu, setImageMenu] = useState<CommunityImageKind | null>(null);

  const update = useUpdateCommunity();
  const image = useCommunityImage(info.communityId);
  const isOwner = info.myRole === 'owner';

  const trimmedName = name.trim();
  const changed =
    trimmedName !== info.title ||
    description.trim() !== info.description ||
    isPrivate !== info.isPrivate;

  const busyKind = image.upload.isPending
    ? image.upload.variables?.kind
    : image.remove.isPending
      ? image.remove.variables
      : null;

  const inputStyle = [
    styles.input,
    { backgroundColor: theme.card, color: theme.text },
    Platform.select({ web: { outlineWidth: 0 } }),
  ];

  async function pick(kind: CommunityImageKind, source: ImageSource) {
    // No iOS, abrir o seletor enquanto o menu (Modal) ainda está fechando falha em silêncio.
    if (Platform.OS === 'ios') await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      const picked = await pickCommunityImage(kind, source);
      if (!picked) return;
      image.upload.mutate(
        { kind, image: picked },
        { onError: () => showAlert(t('chat.imageUploadError')) }
      );
    } catch (error) {
      showAlert(
        error instanceof PermissionDeniedError ? t('account.cameraDenied') : t('chat.imageUploadError')
      );
    }
  }

  function imageActions(kind: CommunityImageKind): ActionSheetAction[] {
    const hasImage = kind === 'avatar' ? !!info.avatarUrl : !!info.bannerUrl;
    const actions: ActionSheetAction[] = [
      {
        key: 'library',
        label: t('account.fromLibrary'),
        icon: { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' },
        onPress: () => pick(kind, 'library'),
      },
    ];
    if (Platform.OS !== 'web') {
      actions.push({
        key: 'camera',
        label: t('account.fromCamera'),
        icon: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
        onPress: () => pick(kind, 'camera'),
      });
    }
    if (hasImage) {
      actions.push({
        key: 'remove',
        label: kind === 'avatar' ? t('chat.removePhoto') : t('chat.removeBanner'),
        icon: { ios: 'trash', android: 'delete', web: 'delete' },
        destructive: true,
        onPress: () =>
          image.remove.mutate(kind, { onError: () => showAlert(t('chat.imageUploadError')) }),
      });
    }
    return actions;
  }

  function handleSave() {
    if (trimmedName.length < COMMUNITY_NAME_MIN) {
      showAlert(t('chat.nameTooShort', { min: COMMUNITY_NAME_MIN }));
      return;
    }
    update.mutate(
      {
        communityId: info.communityId!,
        name: trimmedName,
        description: description.trim(),
        isPrivate,
      },
      {
        onSuccess: () => router.back(),
        onError: () => showAlert(t('chat.updateCommunityError')),
      }
    );
  }

  return (
    <GroupedScreen>
      <Stack.Screen options={{ title: t('chat.editCommunity') }} />

      <CommunityBanner
        name={trimmedName || info.title}
        avatarUrl={info.avatarUrl}
        bannerUrl={info.bannerUrl}
        onEditBanner={() => setImageMenu('banner')}
        onEditAvatar={() => setImageMenu('avatar')}
        bannerBusy={busyKind === 'banner'}
        avatarBusy={busyKind === 'avatar'}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.imageHint}>
        {t('chat.imagesHint')}
      </ThemedText>

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
          {t('chat.communityName')}
        </ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('chat.communityNamePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          maxLength={COMMUNITY_NAME_MAX}
          autoCapitalize="sentences"
          editable={!update.isPending}
          accessibilityLabel={t('chat.communityName')}
          style={inputStyle}
        />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.label}>
            {t('chat.communityDescription')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {description.length}/{COMMUNITY_DESCRIPTION_MAX}
          </ThemedText>
        </View>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t('chat.communityDescriptionPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          maxLength={COMMUNITY_DESCRIPTION_MAX}
          multiline
          editable={!update.isPending}
          accessibilityLabel={t('chat.communityDescription')}
          style={[inputStyle, styles.multiline]}
        />
      </View>

      {isOwner ? (
        <SettingsSection>
          <SettingsSwitchRow
            icon={{ ios: 'lock', android: 'lock', web: 'lock' }}
            label={t('chat.privateCommunity')}
            description={t('chat.privateCommunityHint')}
            value={isPrivate}
            onValueChange={setIsPrivate}
            disabled={update.isPending}
          />
        </SettingsSection>
      ) : null}

      <Button
        label={t('chat.saveChanges')}
        loading={update.isPending}
        disabled={!changed || trimmedName.length === 0}
        onPress={handleSave}
      />

      <ActionSheet
        visible={!!imageMenu}
        title={imageMenu === 'banner' ? t('chat.communityBanner') : t('chat.communityPhoto')}
        actions={imageMenu ? imageActions(imageMenu) : []}
        cancelLabel={t('chat.cancel')}
        onClose={() => setImageMenu(null)}
      />
    </GroupedScreen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  imageHint: {
    textAlign: 'center',
    marginTop: -Spacing.two,
  },
  field: {
    gap: Spacing.two,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: Spacing.one,
  },
  label: {
    paddingHorizontal: Spacing.one,
  },
  input: {
    height: 52,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  multiline: {
    height: 120,
    paddingTop: Spacing.three,
    textAlignVertical: 'top',
  },
});
