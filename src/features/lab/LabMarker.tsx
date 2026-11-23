import { StyleSheet, Text, View } from 'react-native';
import { Marker } from '@maplibre/maplibre-react-native';

import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import type { Lab } from '@/types';

export type LabMarkerProps = {
  lab: Lab;
  hasOpenSession?: boolean;
  isSelected?: boolean;
  onPress?: () => void;
};

/**
 * LabMarker: Marker laboratorium pada peta MapLibre (FR-44, FR-48).
 * FR-48: Marker lab yang memiliki sesi Dibuka dibedakan dengan ikon/tanda dan label, bukan hanya warna.
 */
export function LabMarker({ lab, hasOpenSession, isSelected, onPress }: LabMarkerProps) {
  const labelText = `${lab.nama}${hasOpenSession ? ' (Ada Sesi Dibuka)' : ''}`;

  return (
    <Marker lngLat={[lab.lng, lab.lat]} onPress={onPress}>
      <View
        accessible
        accessibilityRole="button"
        aria-label={labelText}
        style={[
          styles.markerContainer,
          isSelected && styles.markerContainerSelected,
          hasOpenSession && styles.markerContainerOpen,
        ]}
      >
        <View
          style={[
            styles.pin,
            isSelected && styles.pinSelected,
            hasOpenSession && styles.pinOpen,
          ]}
        >
          {hasOpenSession ? (
            <View style={styles.openIndicator}>
              <View style={styles.openDot} />
            </View>
          ) : (
            <View style={styles.pinDot} />
          )}
        </View>
        <View style={styles.labelBubble}>
          <Text
            numberOfLines={1}
            style={[
              styles.labelText,
              hasOpenSession && styles.labelTextOpen,
              isSelected && styles.labelTextSelected,
            ]}
          >
            {hasOpenSession ? `• ${lab.nama}` : lab.nama}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

const PIN_SIZE = 26;
const PIN_SIZE_SELECTED = 32;

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerContainerSelected: {
    transform: [{ scale: 1.1 }],
    zIndex: 10,
  },
  markerContainerOpen: {
    zIndex: 5,
  },
  pin: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    elevation: 3,
  },
  pinSelected: {
    width: PIN_SIZE_SELECTED,
    height: PIN_SIZE_SELECTED,
    borderRadius: PIN_SIZE_SELECTED / 2,
    backgroundColor: colors.primary,
    borderColor: colors.accent,
    borderWidth: 3,
  },
  pinOpen: {
    backgroundColor: colors.status.open.text,
    borderColor: colors.surface,
  },
  pinDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.onPrimary,
  },
  openIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.open.text,
  },
  labelBubble: {
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    maxWidth: 120,
  },
  labelText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 12,
    color: colors.text,
    fontWeight: '600',
  },
  labelTextOpen: {
    color: colors.status.open.text,
    fontWeight: '700',
  },
  labelTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
});
