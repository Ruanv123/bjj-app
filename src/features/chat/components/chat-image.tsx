import { Image } from 'expo-image';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { useChatImageUrl } from '../hooks';
import type { Attachment } from '../types';

const MAX_WIDTH = 240;
const MAX_HEIGHT = 320;

function fitSize(attachment: Attachment) {
  const width = attachment.width ?? MAX_WIDTH;
  const height = attachment.height ?? MAX_WIDTH;
  const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

type Props = {
  attachment: Attachment;
  /** Imagem local enquanto o envio não termina (ou até a remota carregar). */
  localUri?: string;
};

/** Imagem do chat: bucket privado, então usa URL assinada; toque abre em tela cheia. */
export function ChatImage({ attachment, localUri }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [viewerOpen, setViewerOpen] = useState(false);
  const signed = useChatImageUrl(attachment.path || null);
  const size = fitSize(attachment);

  // `cacheKey` pelo caminho: a URL assinada muda a cada renovação, o arquivo não.
  const source = signed.data
    ? { uri: signed.data, cacheKey: attachment.path }
    : localUri
      ? { uri: localUri }
      : null;

  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel={t('chat.openImage')}
        disabled={!source}
        onPress={() => setViewerOpen(true)}
        style={[styles.frame, size, { backgroundColor: theme.backgroundSelected }]}>
        {source ? (
          <Image
            source={source}
            placeholder={localUri ? { uri: localUri } : undefined}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <ActivityIndicator />
        )}
      </Pressable>
      {source ? (
        <ImageViewer
          visible={viewerOpen}
          source={source}
          onClose={() => setViewerOpen(false)}
        />
      ) : null}
    </>
  );
}

function ImageViewer({
  visible,
  source,
  onClose,
}: {
  visible: boolean;
  source: { uri: string; cacheKey?: string };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
        <View style={[styles.close, { top: insets.top + Spacing.two }]}>
          <IconButton
            icon={{ ios: 'xmark', android: 'close', web: 'close' }}
            accessibilityLabel={t('chat.closeImage')}
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 14,
    borderCurve: 'continuous',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: {
    flex: 1,
    backgroundColor: '#000',
  },
  close: {
    position: 'absolute',
    right: Spacing.three,
  },
});
