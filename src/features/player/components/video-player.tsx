import { useEvent } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer as ExpoVideoPlayer } from 'expo-video';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ActionSheet } from '@/components/ui/action-sheet';
import { ThemedText } from '@/components/ui/themed-text';
import type { Video } from '@/features/videos/types';

/**
 * Player com:
 * - reprodução em segundo plano + controles na tela de bloqueio/notificação;
 * - Picture in Picture (manual pelo botão do player e automático ao sair do app);
 * - tela cheia na horizontal pelo botão de tela cheia do próprio player.
 * Requer o plugin `expo-video` com supportsBackgroundPlayback/supportsPictureInPicture
 * (app.json) e um development build.
 */
export function VideoPlayer({ video, url }: { video: Video; url: string }) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState<'speed' | 'quality' | null>(null);
  const [quality, setQuality] = useState<number | null>(null);

  const player = useVideoPlayer(
    {
      uri: url,
      metadata: { title: video.title, artist: video.channel, artwork: video.thumbnailUrl },
    },
    (p) => {
      p.staysActiveInBackground = true;
      p.showNowPlayingNotification = true;
      p.play();
    }
  );

  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { playbackRate } = useEvent(player, 'playbackRateChange', {
    playbackRate: player.playbackRate,
  });
  const source = useEvent(player, 'sourceLoad');
  const tracks = source?.availableVideoTracks ?? player.availableVideoTracks ?? [];
  const resolutions = Array.from(
    new Map(
      tracks
        .filter((track) => track.size.height > 0 && track.size.width > 0 && track.isSupported !== false)
        .map((track) => [track.size.height, track.size] as const)
    ).entries()
  ).sort(([a], [b]) => b - a);
  const canChooseQuality = Platform.OS !== 'web' && resolutions.length > 1;

  return (
    <View>
      <View style={styles.frame}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
          buttonOptions={{ showSettings: false }}
          allowsPictureInPicture
          startsPictureInPictureAutomatically
          // Igual ao YouTube: o botão de tela cheia do player deita o vídeo;
          // girar o celular de volta para "em pé" sai da tela cheia.
          fullscreenOptions={{ enable: true, orientation: 'landscape', autoExitOnRotate: true }}
          onFullscreenEnter={lockWebLandscape}
          onFullscreenExit={unlockWebOrientation}
        />
        {status === 'error' ? (
          <View style={styles.error} pointerEvents="none">
            <ThemedText style={styles.errorText}>{t('videos.playerError')}</ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.settings}>
        <Pressable accessibilityRole="button" onPress={() => setMenu('speed')} style={styles.setting}>
          <ThemedText style={styles.settingText}>{t('videos.playbackSpeed')}: {playbackRate}×</ThemedText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setMenu('quality')} style={styles.setting}>
          <ThemedText style={styles.settingText}>
            {t('videos.quality')}: {quality === null ? t('videos.automatic') : `${quality}p`}
          </ThemedText>
        </Pressable>
      </View>
      <ActionSheet
        visible={menu !== null}
        title={menu === 'speed' ? t('videos.playbackSpeed') : canChooseQuality ? t('videos.quality') : t('videos.qualityUnavailable')}
        cancelLabel={t('videos.cancelPlayer')}
        onClose={() => setMenu(null)}
        actions={menu === 'speed'
          ? [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => ({
              key: String(rate), label: `${rate === playbackRate ? '✓  ' : ''}${rate}×`,
              onPress: () => setPlaybackRate(player, rate),
            }))
          : canChooseQuality ? [
              { key: 'auto', label: `${quality === null ? '✓  ' : ''}${t('videos.automatic')}`, onPress: () => { setMaxResolution(player, null); setQuality(null); } },
              ...resolutions.map(([height, size]) => ({
                key: String(height), label: `${quality === height ? '✓  ' : ''}${height}p`,
                onPress: () => { setMaxResolution(player, size); setQuality(height); },
              })),
            ] : []}
      />
    </View>
  );
}

function setPlaybackRate(player: ExpoVideoPlayer, rate: number) {
  player.playbackRate = rate;
}

function setMaxResolution(player: ExpoVideoPlayer, size: ExpoVideoPlayer['maxResolution']) {
  player.maxResolution = size;
}

// Na web (navegador do celular) pedimos a orientação deitada ao entrar em tela cheia.
// iOS e Android fazem isso nativamente via `fullscreenOptions.orientation`.
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

function lockWebLandscape() {
  if (Platform.OS !== 'web') return;
  const orientation = globalThis.screen?.orientation as LockableOrientation | undefined;
  orientation?.lock?.('landscape').catch(() => {
    // Desktop e Safari não permitem travar a orientação: ignoramos.
  });
}

function unlockWebOrientation() {
  if (Platform.OS !== 'web') return;
  globalThis.screen?.orientation?.unlock?.();
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  settings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#161616',
  },
  setting: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  settingText: { color: '#fff', fontSize: 13 },
  error: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  errorText: {
    color: '#fff',
    textAlign: 'center',
  },
});
