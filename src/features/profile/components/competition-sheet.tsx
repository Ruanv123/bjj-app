import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/ui/themed-text';
import { RESULTS, competitionSchema, type Competition } from '@/features/profile/details';

import { ProfileOptions } from './profile-options';

export function CompetitionSheet({
  initial,
  onCommit,
  onClose,
}: {
  initial: Competition | null;
  onCommit: (competition: Competition) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.name ?? '');
  const [year, setYear] = useState(String(initial?.year ?? new Date().getFullYear()));
  const [result, setResult] = useState<Competition['result']>(initial?.result ?? 'participated');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [committed, setCommitted] = useState(false);

  function submit() {
    if (committed) return;
    const parsed = competitionSchema.safeParse({
      name,
      year: /^\d{4}$/.test(year) ? Number(year) : NaN,
      result,
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path[0],
            t(issue.path[0] === 'year' ? 'athlete.invalidYear' : 'athlete.required'),
          ])
        )
      );
      return;
    }
    setCommitted(true);
    onCommit(parsed.data);
  }

  return (
    <BottomSheet
      title={t(initial ? 'athlete.editCompetitionTitle' : 'athlete.addCompetition')}
      closeLabel={t('settings.cancel')}
      onClose={onClose}
      dismissRequested={committed}>
      <>
        <ThemedText type="small" themeColor="textSecondary">
          {t('athlete.competitionSheetHint')}
        </ThemedText>
        <TextField
          label={t('athlete.competitionName')}
          value={name}
          onChangeText={setName}
          maxLength={100}
          editable={!committed}
          error={errors.name}
        />
        <TextField
          label={t('athlete.year')}
          value={year}
          onChangeText={setYear}
          keyboardType="number-pad"
          maxLength={4}
          editable={!committed}
          error={errors.year}
        />
        <ThemedText type="smallBold">{t('athlete.result')}</ThemedText>
        <ProfileOptions
          options={RESULTS.map((value) => ({ value, label: t(`athlete.results.${value}`) }))}
          selected={[result]}
          onSelect={setResult}
          disabled={committed}
        />
        <Button
          label={t(initial ? 'athlete.updateCompetition' : 'athlete.confirmCompetition')}
          disabled={committed}
          onPress={submit}
        />
      </>
    </BottomSheet>
  );
}
