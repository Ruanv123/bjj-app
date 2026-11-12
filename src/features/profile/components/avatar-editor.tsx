import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { chooseOption } from '@/lib/choose';
import { confirmDestructive } from '@/lib/confirm';

import { useDisplayProfile, useRemoveAvatar, useUploadAvatar } from '../hooks';
import { PermissionDeniedError, pickSquareImage, type ImageSource } from '../pick-image';

const SIZE = 112;

export function AvatarEditor() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { name, avatarUrl, customAvatarPath } = useDisplayProfile();
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const busy = upload.isPending || remove.isPending;

  async function handleChange() {
    const source = await chooseOption<ImageSource>({
      title: t('account.choosePhotoTitle'),
      cancelLabel: t('account.cancel'),
      choices: [
        { label: t('account.fromLibrary'), value: 'library' },
        { label: t('account.fromCamera'), value: 'camera' },
      ],
    });
    if (!source) return;

    try {
      const uri = await pickSquareImage(source);
      if (!uri) return;
      upload.mutate(uri, { onError: () => showAlert(t('account.uploadError')) });
    } catch (error) {
      showAlert(
        error instanceof PermissionDeniedError ? t('account.cameraDenied') : t('account.uploadError')
      );
    }
  }

  async function handleRemove() {
    const confirmed = await confirmDestructive({
      title: t('account.removePhoto'),
      confirmLabel: t('account.removePhoto'),
      cancelLabel: t('account.cancel'),
    });
    if (confirmed) remove.mutate(undefined, { onError: () => showAlert(t('account.genericError')) });
  }

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('account.changePhoto')}
        disabled={busy}
        onPress={handleChange}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <Avatar name={name ?? '?'} url={avatarUrl} size={SIZE} />
        {busy ? (
          <View style={[styles.overlay, { borderRadius: SIZE / 2 }]}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
        <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.groupedBackground }]}>
          <SymbolView
            name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
            tintColor={theme.onPrimary}
            size={16}
          />
        </View>
      </Pressable>

      <View style={styles.links}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={handleChange} hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {t('account.changePhoto')}
          </ThemedText>
        </Pressable>
        {customAvatarPath ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={handleRemove} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.danger }}>
              {t('account.removePhoto')}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  links: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
});
