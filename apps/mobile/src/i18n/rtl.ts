import { I18nManager, Platform } from 'react-native';

/**
 * Credit Follow is a Hebrew-only app, so the layout is always right-to-left.
 *
 * - Native builds: the `expo-localization` plugin (`forcesRTL` in app.config.ts) enables RTL
 *   at the native level. `forceRTL` here is a fallback that takes effect after an app restart.
 * - Expo Go resets RTL preferences, so every screen root and modal also sets
 *   `direction: 'rtl'` (see `rtlRootStyle`) to keep the layout correct there.
 * - Web: sets `<html dir="rtl" lang="he">` at runtime.
 */
export function ensureRTL(): void {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'he';
    }
    return;
  }
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }
}

export const rtlRootStyle = { direction: 'rtl' } as const;

/**
 * `textAlign` value for the start (right) edge. When native RTL is active, React Native
 * mirrors left/right for text, so "left" renders on the right; otherwise use "right".
 */
export const textAlignStart: 'left' | 'right' = I18nManager.isRTL ? 'left' : 'right';

/** Style for full-width Hebrew text / inputs. */
export const rtlTextStyle = { textAlign: textAlignStart, writingDirection: 'rtl' } as const;
