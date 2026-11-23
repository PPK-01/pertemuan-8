import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppBar } from '@/components/ui/AppBar';
import { Screen } from '@/components/ui/Screen';
import { LabMap } from '@/features/lab/LabMap';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/asisten'));

export default function AsistenPetaScreen() {
  return (
    <View style={styles.container}>
      <AppBar subtitle="Peta lab" canGoBack onGoBack={goBack} />
      <Screen edges={['left', 'right', 'bottom']}>
        <View style={styles.content}>
          <LabMap role="asisten" />
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
    flex: 1,
  },
});
