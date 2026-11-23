import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRESSED_OPACITY } from '@/components/ui/pressable';
import { useTodaySessionsForAttendance } from '@/store/appStore';
import { colors } from '@/theme/colors';
import { layout, radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type TabBarProps = {
  state: {
    index: number;
    routes: { key: string; name: string }[];
  };
  navigation?: {
    navigate: (name: string) => void;
  };
  navigateToTab?: (key: string) => void;
};

type PraktikanTabName = 'jadwal' | 'peta' | 'izin' | 'riwayat';

function CalendarIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconFrame}>
      <View style={[styles.calendarBody, { borderColor: color }]}>
        <View style={[styles.calendarTopBar, { backgroundColor: color }]} />
        <View style={styles.calendarDotsRow}>
          <View style={[styles.calendarDot, { backgroundColor: color }]} />
          <View style={[styles.calendarDot, { backgroundColor: color }]} />
        </View>
      </View>
    </View>
  );
}

function MapIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconFrame}>
      <View style={[styles.mapPinHead, { borderColor: color }]}>
        <View style={[styles.mapPinDot, { backgroundColor: color }]} />
      </View>
      <View style={[styles.mapPinPoint, { borderTopColor: color }]} />
    </View>
  );
}

function DocumentIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconFrame}>
      <View style={[styles.docBody, { borderColor: color }]}>
        <View style={[styles.docLine, { backgroundColor: color }]} />
        <View style={[styles.docLineShort, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ClockIcon({ color }: { color: string }) {
  return (
    <View style={styles.iconFrame}>
      <View style={[styles.clockCircle, { borderColor: color }]}>
        <View style={[styles.clockHourHand, { backgroundColor: color }]} />
        <View style={[styles.clockMinuteHand, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function KeyCodeIcon() {
  return (
    <View style={styles.keyIconFrame}>
      <View style={styles.keyMiniGrid}>
        <View style={styles.keyMiniCellActive} />
        <View style={styles.keyMiniCell} />
        <View style={styles.keyMiniCell} />
        <View style={styles.keyMiniCell} />
      </View>
    </View>
  );
}

export function PraktikanTabBar(props: TabBarProps) {
  const { state } = props;
  const insets = useSafeAreaInsets();
  const todaySessions = useTodaySessionsForAttendance();
  const hasOpenSession = todaySessions.some((item) => item.canAttend);

  function handleCenterPress() {
    router.push('/praktikan/presensi' as any);
  }

  function handleNavigate(tabName: PraktikanTabName) {
    const route = state.routes.find((r) => r.name === tabName);
    if (route && props.navigateToTab) {
      props.navigateToTab(route.key);
    } else if (props.navigation) {
      props.navigation.navigate(tabName);
    } else {
      router.push(`/praktikan/${tabName}` as any);
    }
  }

  function renderTab(tabName: PraktikanTabName, label: string, ariaLabel: string) {
    const route = state.routes.find((r) => r.name === tabName);
    const isFocused = state.routes[state.index]?.name === tabName;
    const tintColor = isFocused ? colors.primary : colors.textMuted;

    let icon = <CalendarIcon color={tintColor} />;
    if (tabName === 'peta') {
      icon = <MapIcon color={tintColor} />;
    } else if (tabName === 'izin') {
      icon = <DocumentIcon color={tintColor} />;
    } else if (tabName === 'riwayat') {
      icon = <ClockIcon color={tintColor} />;
    }

    return (
      <Pressable
        key={route?.key ?? tabName}
        onPress={() => !isFocused && handleNavigate(tabName)}
        role="tab"
        aria-selected={isFocused}
        aria-label={ariaLabel}
        style={({ pressed }) => [
          styles.tabItem,
          pressed && { opacity: PRESSED_OPACITY },
        ]}
      >
        <View style={[styles.iconPill, isFocused && styles.iconPillActive]}>
          {icon}
        </View>
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  const centerAriaLabel = hasOpenSession ? 'Presensi, ada sesi dibuka' : 'Presensi';

  return (
    <View style={[styles.barContainer, { paddingBottom: Math.max(insets.bottom, spacing.xs) }]}>
      {/* Tab 1: Jadwal */}
      {renderTab('jadwal', 'Jadwal', 'Jadwal praktikum')}

      {/* Tab 2: Peta (I-06) */}
      {renderTab('peta', 'Peta', 'Peta laboratorium')}

      {/* Tombol Bulat Tengah: Presensi */}
      <Pressable
        onPress={handleCenterPress}
        role="button"
        aria-label={centerAriaLabel}
        accessibilityLabel={centerAriaLabel}
        style={({ pressed }) => [
          styles.centerButtonWrapper,
          pressed && { opacity: PRESSED_OPACITY },
        ]}
      >
        <View style={styles.centerButtonCircle}>
          <KeyCodeIcon />
          {hasOpenSession ? (
            <View style={styles.openSessionBadge}>
              <View style={styles.openSessionBadgeInner} />
            </View>
          ) : null}
        </View>
        <Text style={styles.centerButtonLabel}>Presensi</Text>
      </Pressable>

      {/* Tab 3: Izin */}
      {renderTab('izin', 'Izin', 'Pengajuan izin')}

      {/* Tab 4: Riwayat */}
      {renderTab('riwayat', 'Riwayat', 'Riwayat presensi')}
    </View>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minTouch,
    minWidth: 44,
    gap: 2,
  },
  iconPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  iconPillActive: {
    backgroundColor: colors.selectedSubtle,
  },
  tabLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  centerButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.lg,
    paddingHorizontal: spacing.xs,
    minHeight: layout.minTouch,
    minWidth: 48,
  },
  centerButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    position: 'relative',
  },
  centerButtonLabel: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 2,
  },
  openSessionBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openSessionBadgeInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface,
  },
  iconFrame: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarBody: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
  },
  calendarTopBar: {
    width: '100%',
    height: 4,
  },
  calendarDotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  calendarDot: {
    width: 3,
    height: 3,
    borderRadius: 1,
  },
  mapPinHead: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 1.75,
  },
  mapPinPoint: {
    width: 0,
    height: 0,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -0.5,
  },
  docBody: {
    width: 16,
    height: 19,
    borderRadius: 3,
    borderWidth: 1.5,
    padding: 2,
    gap: 3,
    justifyContent: 'center',
  },
  docLine: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  docLineShort: {
    width: 5,
    height: 2,
    borderRadius: 1,
  },
  clockCircle: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHourHand: {
    position: 'absolute',
    width: 1.5,
    height: 5,
    top: 4,
  },
  clockMinuteHand: {
    position: 'absolute',
    width: 5,
    height: 1.5,
    right: 4,
  },
  keyIconFrame: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyMiniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 14,
    height: 14,
    gap: 2,
  },
  keyMiniCellActive: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  keyMiniCell: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: colors.onPrimary,
    opacity: 0.7,
  },
});
