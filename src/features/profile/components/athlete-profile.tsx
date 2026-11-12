import { openURL } from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import type { PublicProfile } from '@/features/profile/api';
import { useProfile } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

import { BeltBadge } from './belt-badge';

export function AthleteProfile() {
  const { data: profile } = useProfile();
  return profile ? <AthleteProfileDetails profile={profile} /> : null;
}

export function AthleteProfileDetails({
  profile,
  showBelt = true,
}: {
  profile: PublicProfile;
  showBelt?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const hasDetails =
    (showBelt && profile.belt) || profile.bio || profile.instagram || profile.disciplines.length;

  return (
    <>
      {hasDetails ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {showBelt && profile.belt ? (
            <BeltBadge belt={profile.belt} degree={profile.beltDegree} />
          ) : null}
          {profile.bio ? <ThemedText>{profile.bio}</ThemedText> : null}
          {profile.disciplines.length ? (
            <View style={styles.disciplines}>
              {profile.disciplines.map((d) => (
                <View key={d} style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="small">{t(`athlete.disciplines.${d}`)}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}
          {profile.instagram ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Instagram @${profile.instagram}`}
              onPress={() => {
                void openURL(
                  `https://www.instagram.com/${encodeURIComponent(profile.instagram)}/`
                ).catch(() => showAlert(t('athlete.instagramError')));
              }}
              style={({ pressed }) => [styles.instagram, { opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText style={{ color: theme.primary }}>@{profile.instagram}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {profile.competitions.length ? (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <ThemedText style={styles.heading}>{t('athlete.competitions')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('athlete.enteredCount', { count: profile.competitions.length })}
            {' · '}
            {t('athlete.wonCount', {
              count: profile.competitions.filter((c) => c.result === 'gold').length,
            })}
          </ThemedText>
          {profile.competitions.map((item, index) => (
            <View key={index} style={styles.competition}>
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.year} · {t(`athlete.results.${item.result}`)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    gap: Spacing.three,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
  heading: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  disciplines: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  tag: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 8,
  },
  instagram: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  competition: { gap: Spacing.one },
});
