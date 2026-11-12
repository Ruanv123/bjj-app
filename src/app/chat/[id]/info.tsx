import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from 'react-native';

import { ActionSheet, type ActionSheetAction } from '@/components/ui/action-sheet';
import { Avatar } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { IconButton } from '@/components/ui/icon-button';
import { GroupedScreen } from '@/components/ui/grouped-screen';
import { SettingsRow, SettingsSection, SettingsSwitchRow } from '@/components/ui/settings-list';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import { useUser } from '@/features/auth/auth-provider';
import { CommunityBanner } from '@/features/chat/components/community-banner';
import {
  useBans,
  useBlockUser,
  useCommunityInvite,
  useConversation,
  useDeleteCommunity,
  useLeaveCommunity,
  useMembers,
  useOpenDm,
  useRegenerateInvite,
  useRemoveMember,
  useSetMemberRole,
  useSetMuted,
  useUnbanMember,
  useUnblockUser,
} from '@/features/chat/hooks';
import { chatErrorCode, isModerator, type Member, type MemberRole } from '@/features/chat/types';
import { ProfileLink } from '@/features/profile/components/profile-link';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

type Confirm =
  | { kind: 'leave' }
  | { kind: 'deleteCommunity' }
  | { kind: 'remove'; member: Member; ban: boolean }
  | { kind: 'block' };

export default function ConversationInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const user = useUser();
  const [memberMenu, setMemberMenu] = useState<Member | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const { data: info, isPending } = useConversation(id);
  const isGroup = info?.kind === 'community';
  const myRole = info?.myRole;
  const canModerate = isGroup && isModerator(myRole);
  // Pública: qualquer membro convida. Privada: só a moderação.
  const canInvite = isGroup && (!info?.isPrivate || canModerate);

  const setMuted = useSetMuted(id);
  const members = useMembers(id, isGroup);
  const bans = useBans(id, canModerate);
  const invite = useCommunityInvite(info?.communityId ?? null, canInvite);
  const regenerateInvite = useRegenerateInvite(info?.communityId ?? null);
  const setRole = useSetMemberRole(id);
  const removeMember = useRemoveMember(id);
  const unban = useUnbanMember(id);
  const leave = useLeaveCommunity();
  const deleteCommunity = useDeleteCommunity();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();
  const openDm = useOpenDm();

  if (isPending || !info) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.groupedBackground }]}>
        {isPending ? <ActivityIndicator /> : <ThemedText>{t('chat.notFound')}</ThemedText>}
      </View>
    );
  }

  const inviteLink = invite.data ? Linking.createURL(`join/${invite.data}`) : null;

  function shareInvite() {
    if (!inviteLink || !invite.data || !info) return;
    Share.share({
      message: t('chat.inviteShareMessage', {
        name: info.title,
        link: inviteLink,
        code: invite.data,
      }),
    }).catch(() => {});
  }

  /** O que eu posso fazer com este membro (o banco confere tudo de novo). */
  function memberActions(member: Member): ActionSheetAction[] {
    const actions: ActionSheetAction[] = [
      {
        key: 'profile',
        label: t('socialProfile.view'),
        icon: { ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' },
        onPress: () => router.push({ pathname: '/people/[id]', params: { id: member.id } }),
      },
      {
        key: 'dm',
        label: t('chat.sendMessage'),
        icon: { ios: 'bubble.left', android: 'chat_bubble', web: 'chat_bubble' },
        onPress: () =>
          openDm.mutate(member.id, {
            onSuccess: (conversationId) =>
              router.push({ pathname: '/chat/[id]', params: { id: conversationId } }),
            onError: (error) =>
              showAlert(
                chatErrorCode(error) === 'blocked' ? t('chat.dmBlocked') : t('chat.openDmError')
              ),
          }),
      },
    ];
    // Dono gerencia todos; admin só gerencia membros comuns.
    const outranks = member.role !== 'owner' && (myRole === 'owner' || member.role === 'member');
    if (!canModerate || !outranks) return actions;

    if (member.role === 'member') {
      actions.push({
        key: 'role',
        label: t('chat.makeAdmin'),
        icon: { ios: 'shield', android: 'shield', web: 'shield' },
        onPress: () =>
          setRole.mutate(
            { userId: member.id, role: 'moderator' },
            { onError: () => showAlert(t('chat.moderationError')) }
          ),
      });
    } else if (myRole === 'owner') {
      actions.push({
        key: 'role',
        label: t('chat.removeAdmin'),
        icon: { ios: 'shield.slash', android: 'remove_moderator', web: 'remove_moderator' },
        onPress: () =>
          setRole.mutate(
            { userId: member.id, role: 'member' },
            { onError: () => showAlert(t('chat.moderationError')) }
          ),
      });
    }
    actions.push(
      {
        key: 'remove',
        label: t('chat.removeMember'),
        icon: { ios: 'person.badge.minus', android: 'person_remove', web: 'person_remove' },
        destructive: true,
        onPress: () => setConfirm({ kind: 'remove', member, ban: false }),
      },
      {
        key: 'ban',
        label: t('chat.banMember'),
        icon: { ios: 'nosign', android: 'block', web: 'block' },
        destructive: true,
        onPress: () => setConfirm({ kind: 'remove', member, ban: true }),
      }
    );
    return actions;
  }

  function handleConfirm() {
    if (!confirm || !info) return;
    const current = confirm;
    setConfirm(null);

    switch (current.kind) {
      case 'leave':
        leave.mutate(info.communityId!, {
          onSuccess: () => router.dismissTo('/chat'),
          onError: (error) =>
            showAlert(
              chatErrorCode(error) === 'owner_cannot_leave'
                ? t('chat.ownerCannotLeave')
                : t('chat.leaveError')
            ),
        });
        break;
      case 'deleteCommunity':
        deleteCommunity.mutate(info.communityId!, {
          onSuccess: () => router.dismissTo('/chat'),
          onError: () => showAlert(t('chat.deleteCommunityError')),
        });
        break;
      case 'remove':
        removeMember.mutate(
          { userId: current.member.id, ban: current.ban },
          { onError: () => showAlert(t('chat.moderationError')) }
        );
        break;
      case 'block':
        if (info.otherUserId) {
          blockUser.mutate(info.otherUserId, { onError: () => showAlert(t('chat.blockError')) });
        }
        break;
    }
  }

  const confirmCopy = confirm
    ? {
        leave: {
          title: t('chat.leaveConfirm', { name: info.title }),
          message: t('chat.leaveMessage'),
          action: t('chat.leave'),
        },
        deleteCommunity: {
          title: t('chat.deleteCommunityConfirm', { name: info.title }),
          message: t('chat.deleteCommunityMessage'),
          action: t('chat.deleteCommunity'),
        },
        remove:
          confirm.kind === 'remove'
            ? {
                title: confirm.ban
                  ? t('chat.banConfirm', { name: confirm.member.name })
                  : t('chat.removeConfirm', { name: confirm.member.name }),
                message: confirm.ban ? t('chat.banConfirmMessage') : t('chat.removeConfirmMessage'),
                action: confirm.ban ? t('chat.banMember') : t('chat.removeMember'),
              }
            : null,
        block: {
          title: t('chat.blockConfirm', { name: info.title }),
          message: t('chat.blockConfirmMessage'),
          action: t('chat.block'),
        },
      }[confirm.kind]
    : null;

  return (
    <GroupedScreen>
      <Stack.Screen
        options={{
          title: t('chat.info'),
          headerRight: canModerate
            ? () => (
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.push({ pathname: '/chat/[id]/edit', params: { id } })}>
                  <ThemedText type="smallBold" themeColor="primary">
                    {t('chat.edit')}
                  </ThemedText>
                </Pressable>
              )
            : undefined,
        }}
      />

      {isGroup ? (
        <View style={styles.communityHero}>
          <CommunityBanner
            name={info.title}
            avatarUrl={info.avatarUrl}
            bannerUrl={info.bannerUrl}
          />
          <View style={styles.heroText}>
            <ThemedText type="smallBold" style={styles.heroTitle}>
              {info.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                info.isPrivate ? t('chat.privateCommunity') : t('chat.publicCommunity'),
                info.memberCount === 1
                  ? t('chat.memberOne')
                  : t('chat.members', { n: info.memberCount }),
              ].join(' · ')}
            </ThemedText>
          </View>
          {info.description ? (
            <ThemedText style={styles.description}>{info.description}</ThemedText>
          ) : canModerate ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/chat/[id]/edit', params: { id } })}>
              <ThemedText type="small" themeColor="primary" style={styles.description}>
                {t('chat.addDescription')}
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.hero}>
          <Avatar name={info.title} url={info.avatarUrl} size={72} />
          <ThemedText type="smallBold" style={styles.heroTitle}>
            {info.title}
          </ThemedText>
        </View>
      )}

      <SettingsSection>
        {!isGroup && info.otherUserId ? (
          <SettingsRow
            icon={{ ios: 'person.crop.circle', android: 'account_circle', web: 'account_circle' }}
            label={t('socialProfile.view')}
            onPress={() =>
              router.push({ pathname: '/people/[id]', params: { id: info.otherUserId! } })
            }
          />
        ) : null}
        <SettingsSwitchRow
          icon={
            info.muted
              ? { ios: 'bell.slash', android: 'notifications_off', web: 'notifications_off' }
              : { ios: 'bell', android: 'notifications', web: 'notifications' }
          }
          label={t('chat.notifications')}
          description={info.muted ? t('chat.notificationsOff') : t('chat.notificationsOn')}
          // Ligado = recebe notificações (o banco guarda o contrário: "silenciada").
          value={!info.muted}
          onValueChange={(enabled) =>
            setMuted.mutate(!enabled, { onError: () => showAlert(t('chat.muteError')) })
          }
        />
        <SettingsRow
          icon={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          label={t('chat.searchMessages')}
          onPress={() => router.push({ pathname: '/chat/[id]/search', params: { id } })}
        />
      </SettingsSection>

      {canInvite ? (
        <SettingsSection title={t('chat.invite')}>
          <SettingsRow
            icon={{ ios: 'link', android: 'link', web: 'link' }}
            label={t('chat.inviteCode')}
            value={invite.data ?? '…'}
          />
          <SettingsRow
            icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
            label={t('chat.shareInvite')}
            onPress={shareInvite}
          />
          {canModerate ? (
            <SettingsRow
              icon={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
              label={t('chat.regenerateInvite')}
              onPress={() =>
                regenerateInvite.mutate(undefined, {
                  onSuccess: () => showAlert(t('chat.inviteRegenerated')),
                  onError: () => showAlert(t('chat.moderationError')),
                })
              }
            />
          ) : null}
        </SettingsSection>
      ) : null}

      {isGroup ? (
        <SettingsSection
          title={
            members.data
              ? t('chat.membersTitleCount', { n: members.data.length })
              : t('chat.membersTitle')
          }
          withIcons={false}>
          {(members.data ?? []).map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isMe={member.id === user?.id}
              onPress={() => setMemberMenu(member)}
            />
          ))}
        </SettingsSection>
      ) : null}
      {isGroup && canModerate ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.sectionHint}>
          {myRole === 'owner' ? t('chat.ownerMembersHint') : t('chat.adminMembersHint')}
        </ThemedText>
      ) : null}

      {canModerate && (bans.data?.length ?? 0) > 0 ? (
        <SettingsSection title={t('chat.bannedTitle')} withIcons={false}>
          {(bans.data ?? []).map((banned) => (
            <View key={banned.id} style={styles.memberRow}>
              <Avatar name={banned.name} url={banned.avatarUrl} size={36} />
              <ThemedText numberOfLines={1} style={styles.memberName}>
                {banned.name}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  unban.mutate(banned.id, { onError: () => showAlert(t('chat.moderationError')) })
                }
                hitSlop={8}>
                <ThemedText type="smallBold" themeColor="primary">
                  {t('chat.unban')}
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </SettingsSection>
      ) : null}

      <SettingsSection>
        {isGroup && myRole !== 'owner' ? (
          <SettingsRow
            icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
            label={t('chat.leave')}
            destructive
            onPress={() => setConfirm({ kind: 'leave' })}
          />
        ) : null}
        {isGroup && myRole === 'owner' ? (
          <SettingsRow
            icon={{ ios: 'trash', android: 'delete', web: 'delete' }}
            label={t('chat.deleteCommunity')}
            destructive
            onPress={() => setConfirm({ kind: 'deleteCommunity' })}
          />
        ) : null}
        {!isGroup && info.otherUserId ? (
          info.isBlocked ? (
            <SettingsRow
              icon={{
                ios: 'hand.raised.slash',
                android: 'do_not_disturb_off',
                web: 'do_not_disturb_off',
              }}
              label={t('chat.unblock')}
              onPress={() =>
                unblockUser.mutate(info.otherUserId!, {
                  onError: () => showAlert(t('chat.blockError')),
                })
              }
            />
          ) : (
            <SettingsRow
              icon={{ ios: 'hand.raised', android: 'block', web: 'block' }}
              label={t('chat.block')}
              destructive
              onPress={() => setConfirm({ kind: 'block' })}
            />
          )
        ) : null}
      </SettingsSection>

      <ActionSheet
        visible={!!memberMenu}
        title={memberMenu?.name}
        actions={memberMenu ? memberActions(memberMenu) : []}
        cancelLabel={t('chat.cancel')}
        onClose={() => setMemberMenu(null)}
      />

      <ConfirmDialog
        visible={!!confirmCopy}
        destructive
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message}
        confirmLabel={confirmCopy?.action ?? ''}
        cancelLabel={t('chat.cancel')}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </GroupedScreen>
  );
}

const ROLE_LABEL_KEY: Record<MemberRole, 'chat.roleOwner' | 'chat.roleAdmin' | null> = {
  owner: 'chat.roleOwner',
  moderator: 'chat.roleAdmin',
  member: null,
};

function MemberRow({
  member,
  isMe,
  onPress,
}: {
  member: Member;
  isMe: boolean;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const roleKey = ROLE_LABEL_KEY[member.role];

  return (
    <View style={styles.memberRow}>
      <ProfileLink userId={member.id} name={member.name} style={styles.memberProfile}>
        <Avatar name={member.name} url={member.avatarUrl} size={36} />
        <ThemedText numberOfLines={1} style={styles.memberName}>
          {isMe ? t('chat.youMember', { name: member.name }) : member.name}
        </ThemedText>
        {roleKey ? (
          <View
            style={[
              styles.roleBadge,
              {
                backgroundColor: member.role === 'owner' ? theme.primary : theme.backgroundSelected,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={[
                styles.roleText,
                { color: member.role === 'owner' ? theme.onPrimary : theme.text },
              ]}>
              {t(roleKey)}
            </ThemedText>
          </View>
        ) : null}
      </ProfileLink>
      {!isMe ? (
        <IconButton
          variant="plain"
          icon={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
          accessibilityLabel={t('socialProfile.memberActions', { name: member.name })}
          onPress={onPress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  memberProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  communityHero: {
    gap: Spacing.two,
  },
  heroText: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    fontSize: 15,
    lineHeight: 21,
  },
  sectionHint: {
    paddingHorizontal: Spacing.one,
    marginTop: -Spacing.three,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 12,
    lineHeight: 16,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
  },
  memberName: {
    flex: 1,
  },
});
