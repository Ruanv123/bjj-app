import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Só navega; listas de mensagens não fazem uma consulta de perfil por remetente.
 * Usa `router.push` em vez de `<Link asChild>`: o Slot do Link descarta `style`
 * em forma de função, o que quebrava o layout (ex.: linhas virando coluna).
 */
export function ProfileLink({
  userId,
  name,
  children,
  style,
}: PropsWithChildren<{ userId: string; name: string; style?: StyleProp<ViewStyle> }>) {
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('socialProfile.viewOf', { name })}
      onPress={() => router.push({ pathname: '/people/[id]', params: { id: userId } })}
      style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}>
      {children}
    </Pressable>
  );
}
