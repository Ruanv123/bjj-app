import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { useTheme } from '@/hooks/use-theme';

export const BANNER_ASPECT = 3;
const AVATAR_SIZE = 88;
const RING = 4;

type Props = {
  name: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  /** Com handlers, banner e foto viram botões com selo de câmera (tela de edição). */
  onEditBanner?: () => void;
  onEditAvatar?: () => void;
  bannerBusy?: boolean;
  avatarBusy?: boolean;
};

/** Banner 3:1 com a foto da comunidade sobreposta embaixo, centralizada. */
export function CommunityBanner({
  name,
  avatarUrl,
  bannerUrl,
  onEditBanner,
  onEditAvatar,
  bannerBusy = false,
  avatarBusy = false,
}: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  const banner = (
    <View style={[styles.banner, { backgroundColor: theme.backgroundElement }]}>
      {bannerUrl ? (
        <Image
          source={{ uri: bannerUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      ) : (
        // Sem banner: faixa na cor de destaque, bem suave.
        <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.primary, opacity: 0.25 }]} />
      )}
      {onEditBanner ? <EditBadge busy={bannerBusy} style={styles.bannerBadge} /> : null}
    </View>
  );

  const avatar = (
    <View style={[styles.avatarRing, { backgroundColor: theme.groupedBackground }]}>
      <Avatar name={name} url={avatarUrl} size={AVATAR_SIZE} />
      {onEditAvatar ? <EditBadge busy={avatarBusy} style={styles.avatarBadge} /> : null}
    </View>
  );

  return (
    <View>
      {onEditBanner ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chat.changeBanner')}
          disabled={bannerBusy}
          onPress={onEditBanner}>
          {banner}
        </Pressable>
      ) : (
        banner
      )}
      <View style={styles.avatarSlot}>
        {onEditAvatar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chat.changePhoto')}
            disabled={avatarBusy}
            onPress={onEditAvatar}>
            {avatar}
          </Pressable>
        ) : (
          avatar
        )}
      </View>
    </View>
  );
}

function EditBadge({ busy, style }: { busy: boolean; style: object }) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.groupedBackground }, style]}>
      {busy ? (
        <ActivityIndicator size="small" color={theme.onPrimary} />
      ) : (
        <SymbolView
          name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }}
          tintColor={theme.onPrimary}
          size={15}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    aspectRatio: BANNER_ASPECT,
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  avatarSlot: {
    alignItems: 'center',
    // Metade da foto fica sobre o banner.
    marginTop: -(AVATAR_SIZE / 2 + RING),
  },
  avatarRing: {
    padding: RING,
    borderRadius: AVATAR_SIZE,
  },
  badge: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBadge: {
    top: 10,
    right: 10,
  },
  avatarBadge: {
    right: 0,
    bottom: 0,
  },
});
