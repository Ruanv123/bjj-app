import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/ui/themed-text';
import { Spacing } from '@/constants/theme';
import {
  DISCIPLINES,
  MAX_BIO_LENGTH,
  MAX_COMPETITIONS,
  profileDetailsSchema,
  type Competition,
  type ProfileDetails,
} from '@/features/profile/details';
import { useUpdateProfileDetails } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';

import { BeltBadge } from './belt-badge';
import { BeltSelector } from './belt-selector';
import { CompetitionSheet } from './competition-sheet';
import { ProfileOptions } from './profile-options';

type CompetitionEntry = Competition & { key: number };
type CompetitionEditor = { key: number | null; competition: Competition | null };

export function ProfileForm({ initial }: { initial: ProfileDetails }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const update = useUpdateProfileDetails();
  const [details, setDetails] = useState(initial);
  const [competitions, setCompetitions] = useState<CompetitionEntry[]>(() =>
    initial.competitions.map((item, key) => ({ ...item, key }))
  );
  const [editor, setEditor] = useState<CompetitionEditor | null>(null);
  const closeEditor = useCallback(() => setEditor(null), []);
  const nextKey = useRef(competitions.length);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = update.isPending;
  const payload = {
    ...details,
    competitions: competitions.map(({ name, year, result }) => ({
      name,
      year,
      result,
    })),
  };
  const changed = JSON.stringify(payload) !== JSON.stringify(initial);

  function field<K extends keyof ProfileDetails>(key: K, value: ProfileDetails[K]) {
    setDetails((prev) => ({ ...prev, [key]: value }));
  }
  function commitCompetition(competition: Competition) {
    const key = editor?.key ?? nextKey.current++;
    setCompetitions((prev) =>
      editor?.key != null
        ? prev.map((item) => (item.key === key ? { ...competition, key } : item))
        : [...prev, { ...competition, key }]
    );
  }
  function save() {
    if (pending) return;
    const parsed = profileDetailsSchema.safeParse(payload);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.');
        next[path] = t(
          path === 'displayName'
            ? 'settings.nameRequired'
            : path === 'instagram'
              ? 'athlete.invalidInstagram'
              : path.endsWith('.year')
                ? 'athlete.invalidYear'
                : 'athlete.required'
        );
      }
      setErrors(next);
      showAlert(t('athlete.checkFields'));
      return;
    }
    setErrors({});
    update.mutate(parsed.data, {
      onSuccess: () => router.back(),
      onError: () => showAlert(t('settings.saveError')),
    });
  }

  return (
    <>
      <View style={styles.section}>
        <ThemedText style={styles.heading}>{t('athlete.about')}</ThemedText>
        <TextField
          label={t('settings.name')}
          value={details.displayName}
          onChangeText={(v) => field('displayName', v)}
          maxLength={80}
          autoCapitalize="words"
          autoComplete="name"
          editable={!pending}
          error={errors.displayName}
        />
        <TextField
          label={t('athlete.bio')}
          placeholder={t('athlete.bioPlaceholder')}
          value={details.bio}
          onChangeText={(v) => field('bio', v)}
          maxLength={MAX_BIO_LENGTH}
          multiline
          textAlignVertical="top"
          style={styles.bio}
          editable={!pending}
        />
        <ThemedText type="small" themeColor="textSecondary">
          {details.bio.length}/{MAX_BIO_LENGTH}
        </ThemedText>
        <TextField
          label={t('athlete.instagram')}
          placeholder={t('athlete.instagramPlaceholder')}
          value={details.instagram}
          onChangeText={(v) => field('instagram', v)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={100}
          editable={!pending}
          error={errors.instagram}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.heading}>{t('athlete.graduation')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('athlete.beltHint')}
        </ThemedText>
        {details.belt ? <BeltBadge belt={details.belt} degree={details.beltDegree} /> : null}
        <ThemedText type="smallBold">{t('athlete.beltColor')}</ThemedText>
        <BeltSelector
          value={details.belt}
          degree={details.beltDegree}
          disabled={pending}
          onChange={(belt) =>
            setDetails((prev) => ({ ...prev, belt, beltDegree: belt ? prev.beltDegree : 0 }))
          }
        />
        {details.belt ? (
          <>
            <ThemedText type="smallBold">{t('athlete.degrees')}</ThemedText>
            <ProfileOptions
              options={Array.from({ length: 7 }, (_, value) => ({
                value,
                label: String(value),
              }))}
              selected={[details.beltDegree]}
              disabled={pending}
              onSelect={(v) => field('beltDegree', v)}
            />
          </>
        ) : null}
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.heading}>{t('athlete.disciplinesTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('athlete.disciplinesHint')}
        </ThemedText>
        <ProfileOptions
          options={DISCIPLINES.map((value) => ({
            value,
            label: t(`athlete.disciplines.${value}`),
          }))}
          selected={details.disciplines}
          disabled={pending}
          onSelect={(v) =>
            field(
              'disciplines',
              details.disciplines.includes(v)
                ? details.disciplines.filter((d) => d !== v)
                : [...details.disciplines, v]
            )
          }
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.heading}>{t('athlete.competitions')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('athlete.competitionsHint')}
        </ThemedText>
        {!competitions.length ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('athlete.noCompetitions')}
          </ThemedText>
        ) : null}
        {competitions.map((item, index) => (
          <View key={item.key} style={[styles.competition, { backgroundColor: theme.card }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('athlete.editCompetition', { n: index + 1 })}
              disabled={pending}
              onPress={() => setEditor({ key: item.key, competition: item })}
              style={({ pressed }) => [styles.competitionSummary, { opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.year} · {t(`athlete.results.${item.result}`)}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.primary }}>
                {t('athlete.editCompetitionTitle')}
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('athlete.removeCompetition', { n: index + 1 })}
              disabled={pending}
              onPress={() => setCompetitions((prev) => prev.filter((c) => c.key !== item.key))}
              style={({ pressed }) => [
                styles.removeCompetition,
                { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.6 : 1 },
              ]}>
              <ThemedText style={{ color: theme.danger, fontSize: 24 }}>×</ThemedText>
            </Pressable>
          </View>
        ))}
        <Button
          label={t('athlete.addCompetition')}
          variant="outline"
          disabled={pending || competitions.length >= MAX_COMPETITIONS}
          onPress={() => setEditor({ key: null, competition: null })}
        />
      </View>
      <Button label={t('settings.save')} loading={pending} disabled={!changed} onPress={save} />
      {editor ? (
        <CompetitionSheet
          initial={editor.competition}
          onCommit={commitCompetition}
          onClose={closeEditor}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  heading: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  bio: { height: 112, paddingTop: Spacing.three, paddingBottom: Spacing.three },
  competition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 18,
  },
  competitionSummary: { flex: 1, minHeight: 56, gap: Spacing.one },
  removeCompetition: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
