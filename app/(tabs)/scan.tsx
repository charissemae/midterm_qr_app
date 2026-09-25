import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';
import { useRole } from '@/lib/useRole';

export default function ScanScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [lastData, setLastData] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  if (roleLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (role === 'teacher') {
    return (
      <View style={styles.lockedContainer}>
        <Ionicons name="lock-closed-outline" size={56} color={COLORS.textSecondary} />
        <Text style={styles.lockedTitle}>Students only</Text>
        <Text style={styles.lockedSubtitle}>
          Scanning is for students. Teachers create events in the Teacher tab.
        </Text>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Camera permission needed</Text>
        <Text style={styles.subtitle}>We need access to your camera to scan QR codes.</Text>
        <AppButton theme="primary" title="Grant permission" icon="camera" onPress={requestPermission} />
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    setLastData(data);
    const studentId = user?.id;
    if (!studentId) {
      setMessage('You must be logged in to scan.');
      setSuccess(false);
      return;
    }
    registerAttendance(data, studentId)
      .then((result) => {
        setMessage(result.message);
        setSuccess(result.success);
      })
      .catch(() => {
        setMessage('Could not reach the server. Please try again.');
        setSuccess(false);
      });
  };

  const handleScanAgain = () => {
    setScanned(false);
    setLastData(null);
    setMessage(null);
    setCameraError(null);
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        onMountError={() =>
          setCameraError('Camera could not start. Close other apps using the camera, then try again.')
        }
      />

      {/* corner frame accent — warm palette, no camera dependency needed */}
      <View style={styles.frameBox} pointerEvents="none" />

      {cameraError && (
        <View style={styles.cameraErrorBox}>
          <Text style={styles.cameraErrorText}>{cameraError}</Text>
        </View>
      )}

      <View style={styles.overlay}>
        <Text style={styles.overlayText}>
          {scanned ? 'QR code detected' : 'Point your camera at a QR code'}
        </Text>

        {scanned && message && (
          <Text style={[styles.scanResult, success ? styles.success : styles.error]}>{message}</Text>
        )}

        {scanned && lastData && <Text style={styles.scanData}>{lastData}</Text>}

        {scanned && (
          <AppButton theme="primary" title="Scan again" icon="refresh" onPress={handleScanAgain} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  lockedContainer: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, gap: 8 },
  lockedTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginTop: 12 },
  lockedSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },
  camera: { ...StyleSheet.absoluteFillObject },
  frameBox: {
    position: 'absolute',
    top: '28%', left: '15%', right: '15%', height: '32%',
    borderWidth: 3, borderColor: COLORS.primary, borderRadius: 18,
  },
  title: { fontSize: 20, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  overlay: {
    position: 'absolute', left: 20, right: 20, bottom: 60,
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    padding: 16, alignItems: 'center',
  },
  overlayText: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6, textAlign: 'center' },
  scanResult: { fontSize: 14, textAlign: 'center', marginBottom: 8, fontWeight: '600' },
  success: { color: COLORS.primary },
  error: { color: COLORS.danger },
  scanData: { fontSize: 12, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 12 },
  cameraErrorBox: {
    position: 'absolute', top: 60, left: 20, right: 20,
    backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    padding: 16, alignItems: 'center',
  },
  cameraErrorText: { fontSize: 14, color: COLORS.danger, textAlign: 'center', fontWeight: '600' },
});