import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { PresensiScreen } from '@/features/presensi/PresensiScreen';
import { colors } from '@/theme/colors';

export default function PresensiRoute() {
  return (
    <View style={styles.container}>
      <AppBar
        title="Presensi"
        subtitle="Presensi Hari Ini"
        canGoBack
        onGoBack={() => router.back()}
      />
      <PresensiScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
