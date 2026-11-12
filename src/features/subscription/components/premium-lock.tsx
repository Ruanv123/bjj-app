import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import type { Video } from '@/features/videos/types';
import { showAlert } from '@/lib/alert';
import { getErrorMessage } from '@/lib/errors';

import { refreshPremiumAccess } from '../api';
import { Placements } from '../config';
import { useSubscription } from '../context';

/** Ocupa o lugar do player quando o vídeo é premium e o usuário não tem acesso. */
export function PremiumLock({ video }: { video: Video }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isEnabled, showPaywall } = useSubscription();

  // Roda quando o Superwall libera o usuário (acabou de assinar ou já assinava):
  // sincroniza no servidor e busca de novo a URL do vídeo.
  const refresh = useMutation({
    mutationFn: () => refreshPremiumAccess(queryClient),
    onError: (error) =>
      showAlert(t('subscription.unlockError'), getErrorMessage(error, t('common.tryAgain'))),
  });

  function handleUnlock() {
    void showPaywall(Placements.premiumContent, {
      params: { video_id: video.id },
      onUnlocked: () => refresh.mutate(),
    });
  }

  return (
    <View style={styles.frame}>
      <Image
        source={{ uri: video.thumbnailUrl }}
        blurRadius={24}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.overlay}>
        <SymbolView
          name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
          tintColor="#ffffff"
          size={28}
        />
        <ThemedText style={styles.title}>{t('subscription.lockedTitle')}</ThemedText>
        <ThemedText type="small" style={styles.message}>
          {isEnabled ? t('subscription.lockedMessage') : t('subscription.unavailableMessage')}
        </ThemedText>
        {isEnabled ? (
          <View style={styles.button}>
            <Button
              label={t('subscription.unlock')}
              loading={refresh.isPending}
              onPress={handleUnlock}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 700,
    marginTop: Spacing.one,
  },
  message: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.two,
    minWidth: 200,
  },
});
