import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { ThemedText } from '@/components/ui/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { Playlist } from '../types';
import { VideoRow } from './video-row';

/** A fila pertence à aula aberta; trocar o id preserva a tela anterior na navegação. */
export function PlaylistQueue({ playlist, videoId }: { playlist: Playlist; videoId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const index = playlist.videos.findIndex((video) => video.id === videoId);
  if (index < 0) return null;
  const next = playlist.videos[index + 1];
  const position = `${index + 1}/${playlist.videos.length}`;
  const close = () => setOpen(false);

  return (
    <>
      <View style={[styles.dock, { paddingBottom: insets.bottom + Spacing.two, backgroundColor: theme.background }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('playlist.upNext')}. ${playlist.title}. ${position}`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.bar, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
          <View style={styles.text}>
            <ThemedText type="small" themeColor="textSecondary">{t('playlist.upNext')} · {playlist.title}</ThemedText>
            <ThemedText type="smallBold" numberOfLines={1}>{next?.title ?? t('playlist.end')}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.position}>{position}</ThemedText>
          <SymbolView name={{ ios: 'chevron.up', android: 'expand_less', web: 'expand_less' }} tintColor={theme.text} size={20} />
        </Pressable>
      </View>
      <Modal
        visible={open}
        presentationStyle="fullScreen"
        animationType={reducedMotion ? 'fade' : 'slide'}
        onRequestClose={close}>
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={close}
          style={[styles.modal, { backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.heading}>
            <View style={styles.text}>
              <ThemedText style={styles.title} accessibilityRole="header">{t('playlist.upNext')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>{playlist.title}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.position}>{position}</ThemedText>
            <IconButton icon={{ ios: 'xmark', android: 'close', web: 'close' }} accessibilityLabel={t('videos.close')} onPress={close} />
          </View>
          <FlatList
            data={playlist.videos}
            extraData={videoId}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <VideoRow
                video={item}
                lesson
                selected={item.id === videoId}
                onPress={() => {
                  close();
                  if (item.id !== videoId) router.setParams({ id: item.id, playlistId: playlist.id });
                }}
              />
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  dock: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  bar: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderRadius: 16 },
  text: { flex: 1, gap: Spacing.one },
  position: { fontVariant: ['tabular-nums'] },
  modal: { flex: 1 },
  heading: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  list: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingBottom: Spacing.four },
});
