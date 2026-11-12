import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { unregisterPushAsync } from '@/features/notifications/push';
import { supabase } from '@/lib/supabase';

import { DISCIPLINES, profileDetailsSchema, type ProfileDetails } from './details';

export const MAX_NAME_LENGTH = 80;
const AVATAR_BUCKET = 'avatars';
const AVATAR_SIZE = 512;

export type PublicProfile = Omit<ProfileDetails, 'displayName'> & {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type Profile = PublicProfile & { avatarPath: string | null };

type PublicProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string;
  instagram: string;
  belt: ProfileDetails['belt'];
  belt_degree: number;
  disciplines: string[];
  competitions: ProfileDetails['competitions'];
};

type ProfileRow = PublicProfileRow & { avatar_path: string | null };

const PROFILE_COLUMNS =
  'id,display_name,avatar_url,avatar_path,bio,instagram,belt,belt_degree,disciplines,competitions';

function mapPublicProfile(row: PublicProfileRow): PublicProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    instagram: row.instagram,
    belt: row.belt,
    beltDegree: row.belt_degree,
    disciplines: row.disciplines.filter((value): value is ProfileDetails['disciplines'][number] =>
      DISCIPLINES.some((discipline) => discipline === value)
    ),
    competitions: row.competitions,
  };
}

function mapProfile(row: ProfileRow): Profile {
  return { ...mapPublicProfile(row), avatarPath: row.avatar_path };
}

export function isProfileId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  if (!isProfileId(userId)) return null;
  const { data, error } = await supabase.rpc('get_athlete_profile', { p_user_id: userId });
  if (error) throw error;
  const row = (data as PublicProfileRow[] | null)?.[0];
  return row ? mapPublicProfile(row) : null;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

async function upsertProfile(row: Partial<ProfileRow> & { id: string }): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(row)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return mapProfile(data as ProfileRow);
}

export function saveProfileDetails(userId: string, input: ProfileDetails) {
  const details = profileDetailsSchema.parse(input);
  return upsertProfile({
    id: userId,
    display_name: details.displayName,
    bio: details.bio,
    instagram: details.instagram,
    belt: details.belt,
    belt_degree: details.belt ? details.beltDegree : 0,
    disciplines: [...new Set(details.disciplines)],
    competitions: details.competitions,
  });
}

export function saveDisplayName(userId: string, displayName: string) {
  return upsertProfile({ id: userId, display_name: displayName });
}

/**
 * Reduz a foto para 512px (JPEG), envia para `avatars/<userId>/<timestamp>.jpg`
 * e atualiza o perfil. Um nome novo a cada envio evita cache antigo na CDN.
 */
export async function uploadAvatar(
  userId: string,
  sourceUri: string,
  previousPath: string | null
): Promise<Profile> {
  const context = ImageManipulator.manipulate(sourceUri);
  context.resize({ width: AVATAR_SIZE });
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: 0.8,
    base64: true,
  });
  if (!image.base64) throw new Error('Falha ao processar a imagem.');

  const path = `${userId}/${Date.now()}.jpg`;
  const bucket = supabase.storage.from(AVATAR_BUCKET);
  const { error: uploadError } = await bucket.upload(path, decode(image.base64), {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
  });
  if (uploadError) throw uploadError;

  const { data } = bucket.getPublicUrl(path);
  const profile = await upsertProfile({
    id: userId,
    avatar_url: data.publicUrl,
    avatar_path: path,
  });

  if (previousPath && previousPath !== path) {
    // Se falhar, só sobra um arquivo órfão; não vale a pena quebrar o fluxo.
    await bucket.remove([previousPath]);
  }
  return profile;
}

export async function removeAvatar(userId: string, path: string | null): Promise<Profile> {
  const profile = await upsertProfile({
    id: userId,
    avatar_url: null,
    avatar_path: null,
  });
  if (path) await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  return profile;
}

/** Encerra a sessão em todos os aparelhos (invalida os refresh tokens). */
export async function signOutEverywhere() {
  await unregisterPushAsync();
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) throw error;
}

/** Chama a Edge Function `delete-account` e limpa a sessão local. */
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });
  if (error) throw error;
  // O usuário já não existe; só limpamos a sessão deste aparelho.
  await supabase.auth.signOut({ scope: 'local' });
}
