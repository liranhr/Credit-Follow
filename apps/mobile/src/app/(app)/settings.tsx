import {
  FINANCIAL_CYCLE_ANCHORS,
  getFinancialCycle,
  type FinancialCycleSettings,
} from '@credit-follow/shared';
import { getCalendars } from 'expo-localization';
import { useMemo, useState } from 'react';
import { useAuth, useCurrentUser } from '@/auth/AuthProvider';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Banner, ConfirmModal } from '@/components/Feedback';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/SegmentedControl';
import { DayOfMonthPicker } from '@/components/Steppers';
import { useUpdateFinancialCycle } from '@/hooks/api';
import { he } from '@/i18n/he';
import { colors } from '@/theme';
import { describeError, formatShortDate } from '@/utils/format';

function deviceTimeZone(): string | null {
  try {
    return getCalendars()[0]?.timeZone ?? null;
  } catch {
    return null;
  }
}

/** Financial cycle (start day, salary day, credit card day, time zone) and account. */
export default function SettingsScreen() {
  const user = useCurrentUser();
  const { signOut, deleteAccount } = useAuth();
  const update = useUpdateFinancialCycle();
  const [settings, setSettings] = useState<FinancialCycleSettings>(user.preferences.financialCycle);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (patch: Partial<FinancialCycleSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setSaved(false);
  };

  const device = deviceTimeZone();
  const timeZoneOptions = useMemo(() => {
    const zones = Object.keys(he.timeZones);
    if (device && !zones.includes(device)) zones.unshift(device);
    if (!zones.includes(settings.timeZone)) zones.unshift(settings.timeZone);
    return zones.map((tz) => ({
      value: tz,
      label: he.timeZones[tz] ?? (tz === device ? he.settings.deviceTimeZone(tz) : tz),
    }));
  }, [device, settings.timeZone]);

  // Live preview using the same calculation as the API (falls back silently if Intl is limited).
  const preview = useMemo(() => {
    try {
      return getFinancialCycle(settings, new Date());
    } catch {
      return null;
    }
  }, [settings]);

  async function save() {
    setError(undefined);
    try {
      await update.mutateAsync(settings);
      setSaved(true);
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function removeAccount() {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (e) {
      setDeleting(false);
      setConfirmDelete(false);
      setError(describeError(e));
    }
  }

  return (
    <Screen
      title={he.settings.title}
      back
      footer={<Button label={he.common.save} onPress={save} loading={update.isPending} />}
    >
      {error && <Banner message={error} />}
      {saved && <Banner tone="success" message={he.common.saved} />}

      <Card title={he.settings.cycleSection}>
        <AppText variant="caption" color={colors.textMuted} block>
          {he.settings.cycleHint}
        </AppText>
        <SegmentedControl
          label={he.settings.anchor}
          options={FINANCIAL_CYCLE_ANCHORS.map((anchor) => ({
            value: anchor,
            label: he.anchors[anchor],
          }))}
          value={settings.anchor}
          onChange={(anchor) => set({ anchor })}
        />
        {settings.anchor === 'calendar_month' && (
          <DayOfMonthPicker
            label={he.settings.startDay}
            value={settings.startDay}
            onChange={(startDay) => set({ startDay })}
          />
        )}
        <DayOfMonthPicker
          label={he.settings.salaryDay}
          value={settings.salaryDay}
          onChange={(salaryDay) => set({ salaryDay })}
        />
        <DayOfMonthPicker
          label={he.settings.creditCardDay}
          hint={he.settings.creditCardHint}
          value={settings.creditCardChargeDay}
          onChange={(creditCardChargeDay) => set({ creditCardChargeDay })}
        />
        {preview && (
          <Banner
            tone="info"
            message={he.settings.preview(
              formatShortDate(preview.startDate),
              formatShortDate(preview.endDate),
            )}
          />
        )}
      </Card>

      <Card title={he.settings.timeZone}>
        <SegmentedControl
          wrap
          options={timeZoneOptions}
          value={settings.timeZone}
          onChange={(timeZone) => set({ timeZone })}
        />
      </Card>

      <Card title={he.settings.account}>
        <AppText variant="body" block>
          {he.settings.signedInAs(user.displayName)}
          {user.email ? ` (${user.email})` : ''}
        </AppText>
        <Button
          label={he.settings.signOut}
          icon="log-out-outline"
          variant="secondary"
          onPress={signOut}
        />
        <Button
          label={he.settings.deleteAccount}
          icon="trash-outline"
          variant="danger"
          onPress={() => setConfirmDelete(true)}
        />
      </Card>

      <ConfirmModal
        visible={confirmDelete}
        title={he.settings.deleteConfirmTitle}
        body={he.settings.deleteConfirmBody}
        confirmLabel={he.settings.deleteAccount}
        loading={deleting}
        onConfirm={removeAccount}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}
