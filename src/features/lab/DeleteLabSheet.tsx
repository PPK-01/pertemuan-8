import { StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export type DeleteLabSheetProps = {
  visible: boolean;
  loading: boolean;
  errorMessage?: string | null;
  confirmDisabled?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeleteLabSheet({
  visible,
  loading,
  errorMessage,
  confirmDisabled = false,
  onClose,
  onConfirm,
}: DeleteLabSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onClose={loading ? () => {} : onClose}
      title="Hapus lab?"
      primaryAction={{
        label: 'Hapus',
        onPress: onConfirm,
        variant: 'danger',
        loading,
        disabled: confirmDisabled,
      }}
      secondaryAction={{ label: 'Batal', onPress: onClose, disabled: loading }}
    >
      <Text style={styles.message}>
        Lab akan dihapus permanen. Lab yang masih dipakai sesi berjalan tidak dapat dihapus.
      </Text>
      {confirmDisabled ? (
        <Text style={styles.hint}>Hapus lab tidak tersedia saat offline.</Text>
      ) : null}
      {errorMessage ? (
        <Text role="alert" style={styles.error}>
          {errorMessage}
        </Text>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  message: { ...typography.body, color: colors.textMuted },
  hint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.label, color: colors.feedback.danger.text },
});
