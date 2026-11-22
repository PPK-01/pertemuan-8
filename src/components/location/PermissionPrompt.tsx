import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ButtonProps } from '@/components/ui/Button';
import { colors } from '@/theme/colors';
import { layout, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type PermissionPromptAction = Pick<
  ButtonProps,
  'label' | 'onPress' | 'variant' | 'loading' | 'disabled'
>;

export type PermissionPromptProps = {
  title: string;
  explanation: string;
  primaryAction: PermissionPromptAction;
  secondaryAction?: PermissionPromptAction;
  style?: StyleProp<ViewStyle>;
};

// Tombol aksi bertumpuk bila lebar layar / skala font di bawah nilai ini. Sama dengan batas di BottomSheet.
const STACK_ACTIONS_BELOW = 360;

export function PermissionPrompt({
  title,
  explanation,
  primaryAction,
  secondaryAction,
  style,
}: PermissionPromptProps) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / fontScale < STACK_ACTIONS_BELOW;

  const actionStyle = stacked ? undefined : styles.action;
  const secondary = secondaryAction ? <Button {...secondaryAction} variant="secondary" style={actionStyle} /> : null;
  const primary = <Button {...primaryAction} style={actionStyle} />;

  return (
    <Card
      style={[{ width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' }, style]}
    >
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.explanation}>{explanation}</Text>
        <View style={stacked ? styles.actionsStacked : styles.actionsRow}>
          {stacked ? primary : secondary}
          {stacked ? secondary : primary}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  title: { ...typography.heading, color: colors.text },
  explanation: { ...typography.body, color: colors.textMuted },
  actionsRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  actionsStacked: { gap: spacing.sm },
  action: { flex: 1 },
});
