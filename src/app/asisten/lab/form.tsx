import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Banner } from '@/components/ui/Banner';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SyncErrorState } from '@/components/ui/SyncErrorState';
import { setFlash } from '@/features/asisten/flash';
import { useSyncRetry } from '@/features/asisten/useSyncRetry';
import { OFFLINE_ACTION_HINT } from '@/features/asisten/writeErrorMessage';
import { DeleteLabSheet } from '@/features/lab/DeleteLabSheet';
import { LabForm } from '@/features/lab/LabForm';
import type { LabFormFeedback } from '@/features/lab/LabForm';
import {
  LAB_CREATE_SUCCESS_MESSAGE,
  LAB_DELETE_SUCCESS_MESSAGE,
  LAB_FLASH_SCOPE,
  LAB_UPDATE_SUCCESS_MESSAGE,
} from '@/features/lab/labFlash';
import { useAppStore, useIsOnline, useLabById, useLabs, useSyncState } from '@/store/appStore';
import { spacing } from '@/theme/spacing';
import type { CreateLabInput, Lab } from '@/types';

const LAB_SYNC_KEYS = ['labs'] as const;

const goToList = () => router.replace('/asisten/lab');
const goBack = () => (router.canGoBack() ? router.back() : goToList());

export default function AsistenLabFormScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const editId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isEdit = editId !== undefined;

  const labs = useLabs();
  const labsSync = useSyncState('labs');
  const labsRetry = useSyncRetry(LAB_SYNC_KEYS);
  const isOnline = useIsOnline();
  const foundLab = useLabById(editId);
  const target = isEdit ? foundLab : null;
  const addLab = useAppStore((state) => state.addLab);
  const updateLab = useAppStore((state) => state.updateLab);
  const deleteLab = useAppStore((state) => state.deleteLab);

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<LabFormFeedback | null>(null);
  const showError = (message: string) =>
    setSubmitError((prev) => ({ id: (prev?.id ?? 0) + 1, message }));

  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const [deleteError, setDeleteError] = useState<LabFormFeedback | null>(null);

  async function handleCreate(input: CreateLabInput) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    const res = await addLab(input);
    if (res.ok) {
      setFlash(LAB_FLASH_SCOPE, LAB_CREATE_SUCCESS_MESSAGE);
      goBack();
      return;
    }

    submittingRef.current = false;
    setSubmitting(false);
    showError(res.message);
  }

  async function handleUpdate(original: Lab, input: CreateLabInput) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    const res = await updateLab(original.id, input);
    if (res.ok) {
      setFlash(LAB_FLASH_SCOPE, LAB_UPDATE_SUCCESS_MESSAGE);
      goBack();
      return;
    }

    submittingRef.current = false;
    setSubmitting(false);
    showError(res.message);
  }

  async function handleDelete(original: Lab) {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);

    const res = await deleteLab(original.id);
    if (res.ok) {
      setFlash(LAB_FLASH_SCOPE, LAB_DELETE_SUCCESS_MESSAGE);
      goToList();
      return;
    }

    deletingRef.current = false;
    setDeleting(false);
    setSheetOpen(false);
    setDeleteError((prev) => ({ id: (prev?.id ?? 0) + 1, message: res.message }));
  }

  const closeSheet = () => {
    if (deletingRef.current) return;
    setSheetOpen(false);
  };

  const disabledHint = isOnline ? undefined : OFFLINE_ACTION_HINT;

  let body;
  if (!isEdit) {
    body = (
      <LabForm
        labs={labs}
        onSubmit={handleCreate}
        submitting={submitting}
        submitError={submitError}
        disabledHint={disabledHint}
      />
    );
  } else if (!target && deleting) {
    body = <LoadingState label="Menghapus lab…" />;
  } else if (!target && (labsSync === 'idle' || labsSync === 'loading')) {
    body = <LoadingState label="Memuat lab…" />;
  } else if (!target && labsRetry.visible) {
    body = (
      <SyncErrorState
        message={labsRetry.message}
        onRetry={labsRetry.retry}
        retrying={labsRetry.retrying}
      />
    );
  } else if (!target) {
    body = (
      <EmptyState
        title="Lab tidak ditemukan"
        message="Lab mungkin sudah dihapus atau tautan tidak valid."
        action={{ label: 'Kembali ke daftar lab', onPress: goToList }}
      />
    );
  } else {
    body = (
      <View style={styles.editContent}>
        <LabForm
          lab={target}
          labs={labs}
          onSubmit={(input) => handleUpdate(target, input)}
          onDelete={() => {
            setDeleteError(null);
            setSheetOpen(true);
          }}
          submitLabel="Simpan perubahan"
          submitting={submitting}
          submitError={submitError}
          disabledHint={disabledHint}
        />

        <View style={styles.deleteGroup}>
          {deleteError ? (
            <Banner key={deleteError.id} tone="danger" message={deleteError.message} />
          ) : null}
        </View>

        <DeleteLabSheet
          visible={sheetOpen}
          loading={deleting}
          errorMessage={deleteError?.message ?? null}
          onClose={closeSheet}
          onConfirm={() => handleDelete(target)}
        />
      </View>
    );
  }

  const staleNotice =
    labsRetry.visible && (!isEdit || target) ? (
      <SyncErrorState
        compact
        message={labsRetry.message}
        onRetry={labsRetry.retry}
        retrying={labsRetry.retrying}
      />
    ) : null;

  return (
    <View style={styles.container}>
      <AppBar subtitle={isEdit ? 'Ubah lab' : 'Tambah lab'} canGoBack onGoBack={goBack} />
      <Screen edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          {staleNotice}
          {body}
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  editContent: {
    gap: spacing.xxl,
  },
  deleteGroup: {
    gap: spacing.sm,
  },
});
