import Ionicons from '@expo/vector-icons/Ionicons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { registerAttendance } from '@/lib/attendance';
import { useRole } from '@/lib/useRole';

export default function ScanScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  if (roleLoading) {
    return (
      <View style={styles.container}>
        <Header title="Scan" />
        <View style={styles.stateContainer}>
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={COLORS.primaryDark} />
            <Text style={styles.stateTitle}>Preparing scanner</Text>
          </View>
        </View>
      </View>
    );
  }

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <Header title="Scan" />
        <View style={styles.stateContainer}>
          <View style={styles.stateCard}>
            <View style={[styles.stateIcon, styles.lockedIcon]}>
              <Ionicons name="lock-closed-outline" size={28} color={COLORS.primaryDark} />
            </View>
            <Text style={styles.stateTitle}>Students only</Text>
            <Text style={styles.stateText}>Teachers create event codes in the Teacher tab.</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Header title="Scan" />
        <View style={styles.stateContainer}>
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={COLORS.primaryDark} />
            <Text style={styles.stateTitle}>Preparing scanner</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Header title="Scan" />
        <View style={styles.stateContainer}>
          <View style={styles.stateCard}>
            <View style={styles.stateIcon}>
              <Ionicons name="camera-outline" size={28} color={COLORS.primaryDark} />
            </View>
            <Text style={styles.stateTitle}>Camera permission needed</Text>
            <Text style={styles.stateText}>Allow camera access to scan event QR codes.</Text>
            <View style={styles.stateButton}>
              <AppButton
                theme="primary"
                title="Grant permission"
                icon="camera-outline"
                onPress={requestPermission}
              />
            </View>
          </View>
        </View>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setScanned(true);
    setEventTitle(null);
    const studentId = user?.id;
    if (!studentId) {
      setMessage('You must be logged in to scan.');
      setSuccess(false);
      return;
    }
    registerAttendance(data, studentId)
      .then((result) => {
        setMessage(result.message);
        setEventTitle(result.eventTitle ?? null);
        setSuccess(result.success);
      })
      .catch(() => {
        setMessage('Could not reach the server. Please try again.');
        setEventTitle(null);
        setSuccess(false);
      });
  };

  const handleScanAgain = () => {
    setScanned(false);
    setMessage(null);
    setEventTitle(null);
    setSuccess(false);
    setCameraError(null);
  };

  return (
    <View style={styles.container}>
      <Header title="Scan" />
      <View style={styles.scanContent}>
        <View style={styles.scanStage}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            onMountError={() =>
              setCameraError('Camera could not start. Close other camera apps, then try again.')
            }
          />
          <View pointerEvents="none" style={styles.cameraShade} />
          <View pointerEvents="none" style={styles.frameBox}>
            <View style={[styles.frameCorner, styles.frameCornerTopLeft]} />
            <View style={[styles.frameCorner, styles.frameCornerTopRight]} />
            <View style={[styles.frameCorner, styles.frameCornerBottomLeft]} />
            <View style={[styles.frameCorner, styles.frameCornerBottomRight]} />
          </View>
          <View pointerEvents="none" style={styles.instructionPill}>
            <Ionicons name="scan-outline" size={16} color={COLORS.textOnDark} />
            <Text style={styles.instructionText}>
              {scanned ? 'Code detected' : 'Point your camera at a QR code'}
            </Text>
          </View>
        </View>

        {cameraError ? (
          <View style={styles.cameraErrorBox} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={17} color={COLORS.danger} />
            <Text style={styles.cameraErrorText}>{cameraError}</Text>
          </View>
        ) : null}

        {scanned ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={[styles.resultIcon, success ? styles.resultIconSuccess : styles.resultIconError]}>
                <Ionicons
                  name={success ? 'checkmark' : 'close'}
                  size={20}
                  color={success ? COLORS.success : COLORS.danger}
                />
              </View>
              <View style={styles.resultHeading}>
                <Text style={styles.resultTitle}>
                  {success ? 'Attendance recorded' : 'Scan not recorded'}
                </Text>
                {eventTitle ? <Text style={styles.resultEvent}>{eventTitle}</Text> : null}
              </View>
            </View>
            {message ? (
              <Text style={[styles.resultMessage, success ? styles.successText : styles.errorText]}>
                {message}
              </Text>
            ) : (
              <ActivityIndicator size="small" color={COLORS.primaryDark} style={styles.resultLoader} />
            )}
            <AppButton
              theme="primary"
              title="Scan again"
              icon="refresh-outline"
              onPress={handleScanAgain}
              compact
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  stateCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  stateIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  lockedIcon: {
    backgroundColor: COLORS.sakura,
  },
  stateTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 8,
    textAlign: 'center',
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  stateButton: {
    width: '100%',
    marginTop: 20,
  },
  scanContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  scanStage: {
    flex: 1,
    minHeight: 280,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  frameBox: {
    position: 'absolute',
    width: 236,
    aspectRatio: 1,
    top: '17%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: COLORS.overlayLight,
    borderRadius: 22,
  },
  frameCorner: {
    position: 'absolute',
    width: 31,
    height: 31,
    borderColor: COLORS.matcha,
  },
  frameCornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 17,
  },
  frameCornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 17,
  },
  frameCornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 17,
  },
  frameCornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 17,
  },
  instructionPill: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 15,
    backgroundColor: COLORS.overlay,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textOnDark,
    marginLeft: 7,
  },
  cameraErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 13,
    padding: 12,
    marginTop: 10,
  },
  cameraErrorText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.danger,
    marginLeft: 7,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginTop: 10,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  resultIconSuccess: {
    backgroundColor: COLORS.successSoft,
  },
  resultIconError: {
    backgroundColor: COLORS.dangerSoft,
  },
  resultHeading: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  resultEvent: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  resultMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    marginBottom: 12,
  },
  successText: {
    color: COLORS.success,
  },
  errorText: {
    color: COLORS.danger,
  },
  resultLoader: {
    marginVertical: 15,
  },
});
