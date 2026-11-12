import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { PermissionDeniedError, type ImageSource } from '@/features/profile/pick-image';

import type { CommunityImageKind } from './api';

export type PickedImage = { uri: string; width: number; height: number };

/**
 * Galeria ou câmera. Foto: recorte quadrado no seletor. Banner: o recorte de
 * edição do iOS é sempre quadrado, então lá o recorte 3:1 é feito depois, no
 * centro da imagem (ver uploadCommunityImage). Retorna `null` se cancelar.
 */
export async function pickCommunityImage(
  kind: CommunityImageKind,
  source: ImageSource
): Promise<PickedImage | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: kind === 'avatar' || Platform.OS === 'android',
    aspect: kind === 'avatar' ? [1, 1] : [3, 1],
  };

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PermissionDeniedError('camera');
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}
