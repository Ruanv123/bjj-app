import * as Linking from 'expo-linking';
import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

import { useIsSaved, useToggleSave } from '../hooks';
import type { Video } from '../types';

export function VideoActions({ video }: { video: Video }) {
  const { t } = useTranslation();
  const user = useUser();
  const { data: isSaved = false } = useIsSaved(video.id);
  const toggleSave = useToggleSave(video.id);

  function handleSave() {
    if (!user) {
      showAlert(t('videos.signInToSave'));
      return;
    }
    toggleSave.mutate(!isSaved, {
      onError: () => showAlert(t('videos.saveError')),
    });
  }

  async function handleShare() {
    const url = Linking.createURL(`/video/${video.id}`);
    await Share.share({
      title: video.title,
      message: t('videos.shareMessage', { title: video.title, url }),
      url, // iOS usa este campo separado
    });
  }

  return (
    <View style={styles.row}>
      <ActionButton
        icon={
          isSaved
            ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }
            : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }
        }
        label={isSaved ? t('videos.saved') : t('videos.save')}
        selected={isSaved}
        onPress={handleSave}
      />
      <ActionButton
        icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
        label={t('videos.share')}
        onPress={handleShare}
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  selected = false,
  onPress,
}: {
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const color = selected ? theme.primary : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 },
      ]}>
      <SymbolView name={icon} tintColor={color} size={18} />
      <ThemedText type="smallBold" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
    paddingHorizontal: Spacing.three,
    height: 38,
    borderRadius: 999,
  },
});
