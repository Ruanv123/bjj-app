import * as ImagePicker from 'expo-image-picker';

export type ImageSource = 'library' | 'camera';

export class PermissionDeniedError extends Error {}

/** Abre a galeria ou a câmera com recorte quadrado. Retorna `null` se cancelar. */
export async function pickSquareImage(source: ImageSource): Promise<string | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  };

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new PermissionDeniedError('camera');
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}
