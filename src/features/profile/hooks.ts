import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUser } from '@/features/auth/auth-provider';

import {
  deleteAccount,
  fetchProfile,
  fetchPublicProfile,
  isProfileId,
  removeAvatar,
  saveDisplayName,
  saveProfileDetails,
  signOutEverywhere,
  uploadAvatar,
  type Profile,
} from './api';
import type { ProfileDetails } from './details';
import { getAvatarUrl, getDisplayName } from './utils';

export const profileKeys = {
  detail: (userId: string | undefined) => ['profile', userId] as const,
  publicRoot: ['public-profile'] as const,
  public: (viewerId: string | undefined, userId: string | undefined) =>
    ['public-profile', viewerId, userId] as const,
};

export function useProfile() {
  const user = useUser();
  return useQuery({
    queryKey: profileKeys.detail(user?.id),
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,
  });
}

export function usePublicProfile(userId: string | undefined) {
  const user = useUser();
  return useQuery({
    queryKey: profileKeys.public(user?.id, userId),
    queryFn: () => fetchPublicProfile(userId!),
    enabled: !!user && isProfileId(userId),
  });
}

/** Nome e foto a exibir: o que o usuário editou tem prioridade sobre o do Google/Apple. */
export function useDisplayProfile() {
  const user = useUser();
  const { data: profile } = useProfile();
  return {
    name: profile?.displayName ?? getDisplayName(user),
    avatarUrl: profile?.avatarUrl ?? getAvatarUrl(user),
    customAvatarPath: profile?.avatarPath ?? null,
  };
}

function useProfileMutation<TVariables>(
  mutationFn: (
    userId: string,
    profile: Profile | null | undefined,
    variables: TVariables
  ) => Promise<Profile>
) {
  const user = useUser();
  const queryClient = useQueryClient();
  const key = profileKeys.detail(user?.id);

  return useMutation({
    mutationFn: (variables: TVariables) => {
      if (!user) throw new Error('Sem sessão.');
      return mutationFn(user.id, queryClient.getQueryData<Profile | null>(key), variables);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(key, profile);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKeys.publicRoot }),
        queryClient.invalidateQueries({ queryKey: ['social'] }),
      ]);
    },
  });
}

export function useUpdateDisplayName() {
  return useProfileMutation((userId, _profile, name: string) => saveDisplayName(userId, name));
}

export function useUpdateProfileDetails() {
  return useProfileMutation((userId, _profile, details: ProfileDetails) =>
    saveProfileDetails(userId, details)
  );
}

export function useUploadAvatar() {
  return useProfileMutation((userId, profile, uri: string) =>
    uploadAvatar(userId, uri, profile?.avatarPath ?? null)
  );
}

export function useRemoveAvatar() {
  return useProfileMutation((userId, profile, _: void) =>
    removeAvatar(userId, profile?.avatarPath ?? null)
  );
}

export function useSignOutEverywhere() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOutEverywhere,
    onSuccess: () => queryClient.clear(),
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => queryClient.clear(),
  });
}
