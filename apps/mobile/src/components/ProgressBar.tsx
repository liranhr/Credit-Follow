import { StyleSheet, View } from 'react-native';
import { colors, radii } from '@/theme';

/** Horizontal progress bar; in RTL it fills from the right. Ratios above 1 are capped. */
export function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const percent = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
    >
      <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  fill: { height: '100%', borderRadius: radii.pill },
});
