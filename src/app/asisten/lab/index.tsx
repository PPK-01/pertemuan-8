import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Banner } from '@/components/ui/Banner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { PRESSED_OPACITY } from '@/components/ui/pressable';
import { Screen } from '@/components/ui/Screen';
import { SyncErrorState } from '@/components/ui/SyncErrorState';
import { goBackToList } from '@/features/asisten/goBackToList';
import { takeFlash } from '@/features/asisten/flash';
import { useSyncRetry } from '@/features/asisten/useSyncRetry';
import { DeleteLabSheet } from '@/features/lab/DeleteLabSheet';
import { LAB_FLASH_SCOPE } from '@/features/lab/labFlash';
import { useAppStore, useIsOnline, useLabs, useSyncState } from '@/store/appStore';
import { colors } from '@/theme/colors';
import { layout, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { Lab } from '@/types';

const LAB_SYNC_KEYS = ['labs'] as const;

const openCreate = () => router.push('/asisten/lab/form');

type Flash = { id: number; message: string };

function LabRow({
  lab,
  onPress,
  onDelete,
  deleteDisabled,
}: {
  lab: Lab;
  onPress: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        role="button"
        accessibilityLabel={`Ubah lab ${lab.nama}`}
        style={({ pressed }) => [styles.rowMain, pressed && { opacity: PRESSED_OPACITY }]}
      >
        <Text style={styles.rowTitle} numberOfLines={1}>
          {lab.nama}
        </Text>
        {lab.gedung ? <Text style={styles.rowMeta}>{lab.gedung}</Text> : null}
        <Text style={styles.rowMeta}>{`Radius ${lab.radiusM} m`}</Text>
      </Pressable>
      <Pressable
        onPress={onDelete}
        disabled={deleteDisabled}
        role="button"
        accessibilityLabel={`Hapus lab ${lab.nama}`}
        accessibilityState={{ disabled: deleteDisabled }}
        style={({ pressed }) => [
          styles.deleteButton,
          pressed && { opacity: PRESSED_OPACITY },
          deleteDisabled && { opacity: 0.5 },
        ]}
      >
        <Text style={styles.deleteLabel}>Hapus</Text>
      </Pressable>
    </View>
  );
}

function ListSeparator() {
  return <View style={styles.separator} />;
}

export default function AsistenLabListScreen() {
  const labs = useLabs();
  const labsSync = useSyncState('labs');
  const labsRetry = useSyncRetry(LAB_SYNC_KEYS);
  const isOnline = useIsOnline();
  const deleteLab = useAppStore((state) => state.deleteLab);

  const [flash, setFlashState] = useState<Flash | null>(null);
  const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const message = takeFlash(LAB_FLASH_SCOPE);
      if (message) setFlashState((prev) => ({ message, id: (prev?.id ?? 0) + 1 }));
    }, []),
  );

  const loadingInitial = (labsSync === 'idle' || labsSync === 'loading') && labs.length === 0;
  const syncError = labsRetry.visible;

  async function confirmDelete() {
    if (!isOnline || !labToDelete || deleting) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteLab(labToDelete.id);
    setDeleting(false);
    if (res.ok) {
      setLabToDelete(null);
      return;
    }
    setDeleteError(res.message);
  }

  const closeDelete = () => {
    if (deleting) {
      return;
    }
    setLabToDelete(null);
    setDeleteError(null);
  };

  const openDelete = (lab: Lab) => {
    setDeleteError(null);
    setLabToDelete(lab);
  };

  return (
    <View style={styles.container}>
      <AppBar subtitle="Lab" canGoBack onGoBack={goBackToList} />
      <Screen scroll={false} edges={['left', 'right', 'bottom']}>
        <FlatList
          data={labs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LabRow
              lab={item}
              onPress={() => router.push({ pathname: '/asisten/lab/form', params: { id: item.id } })}
              onDelete={() => openDelete(item)}
              deleteDisabled={!isOnline}
            />
          )}
          ItemSeparatorComponent={ListSeparator}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {flash ? <Banner key={flash.id} tone="success" message={flash.message} /> : null}
              <Button label="Tambah lab" onPress={openCreate} />
              {syncError ? (
                <SyncErrorState
                  message={labsRetry.message}
                  onRetry={labsRetry.retry}
                  retrying={labsRetry.retrying}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            syncError && labs.length === 0 ? undefined : loadingInitial ? (
              <LoadingState label="Memuat lab…" />
            ) : (
              <EmptyState
                title="Belum ada lab"
                message="Lab dipakai untuk menentukan area presensi praktikum."
                action={{ label: 'Tambah lab', onPress: openCreate }}
              />
            )
          }
        />
      </Screen>

      <DeleteLabSheet
        visible={labToDelete != null}
        loading={deleting}
        errorMessage={deleteError}
        confirmDisabled={!isOnline}
        onClose={closeDelete}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerBlock: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  separator: {
    height: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowMain: {
    flex: 1,
    minHeight: layout.minTouch,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  rowTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  rowMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  deleteButton: {
    minWidth: layout.minTouch,
    minHeight: layout.minTouch,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  deleteLabel: {
    ...typography.caption,
    color: colors.feedback.danger.text,
  },
});
