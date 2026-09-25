import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { createEvent } from '@/lib/events';
import { buildQRPayload } from '@/lib/qr';
import { useRole } from '@/lib/useRole';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
  );
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';

export default function TeacherScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAndroid = Platform.OS === 'android';

  if (roleLoading) {
    return (
      <View style={styles.container}>
        <Header title="Teacher" />
        <View style={styles.stateContainer}>
          <ActivityIndicator color={COLORS.primaryDark} size="large" />
          <Text style={styles.stateText}>Checking your account...</Text>
        </View>
      </View>
    );
  }

  if (role !== 'teacher') {
    return (
      <View style={styles.container}>
        <Header title="Teacher" />
        <View style={styles.stateContainer}>
          <View style={styles.lockedCard}>
            <View style={styles.lockedIcon}>
              <Ionicons name="lock-closed-outline" size={28} color={COLORS.primaryDark} />
            </View>
            <Text style={styles.lockedTitle}>Teachers only</Text>
            <Text style={styles.stateText}>Only teacher accounts can create events.</Text>
          </View>
        </View>
      </View>
    );
  }

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;
    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'start') setStartDate(next);
    else setEndDate(next);

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = () => {
    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
    };

    if (!event.eventId || !event.title) {
      setMessage('Event title and code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    createEvent(event).then(({ error }) => {
      if (error) {
        setMessage('Could not save the event. Please try again.');
        return;
      }
      setMessage('Event saved. Show the QR below.');
      setPayload(buildQRPayload(event));
    });
  };

  const messageIsSuccess = message?.startsWith('Event saved') ?? false;

  return (
    <View style={styles.container}>
      <Header title="Teacher" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>Create event QR</Text>
          </View>
          <View style={styles.headingIcon}>
            <Ionicons name="qr-code-outline" size={28} color={COLORS.textPrimary} />
          </View>
        </View>

        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Event details</Text>
          </View>

          <Text style={styles.label}>Event title</Text>
          <View style={styles.inputShell}>
            <Ionicons name="bookmark-outline" size={18} color={COLORS.textTertiary} />
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Founders Day Assembly"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="sentences"
            />
          </View>

          <Text style={styles.label}>Event code</Text>
          <View style={styles.inputShell}>
            <Ionicons name="pricetag-outline" size={18} color={COLORS.textTertiary} />
            <TextInput
              style={styles.input}
              value={eventId}
              onChangeText={setEventId}
              placeholder="e.g. EVT-2026-0002"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Starts</Text>
          <PickerField
            value={formatDateTime(startDate)}
            icon="sunny-outline"
            onPress={() => openPicker('start')}
          />

          <Text style={styles.label}>Ends</Text>
          <PickerField
            value={formatDateTime(endDate)}
            icon="moon-outline"
            onPress={() => openPicker('end')}
          />

          <View style={styles.quickHeader}>
            <Text style={styles.quickTitle}>Quick duration</Text>
          </View>
          <View style={styles.chipRow}>
            {QUICK_END_OPTIONS.map((option) => (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                onPress={() => handleQuickEnd(option.ms)}
              >
                <Ionicons name="time-outline" size={14} color={COLORS.primaryDark} />
                <Text style={styles.chipText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>

          {message ? (
            <View
              style={[
                styles.messageBox,
                messageIsSuccess ? styles.messageSuccess : styles.messageError,
              ]}
              accessibilityRole="alert"
            >
              <Ionicons
                name={messageIsSuccess ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={17}
                color={messageIsSuccess ? COLORS.success : COLORS.danger}
              />
              <Text
                style={[
                  styles.messageText,
                  messageIsSuccess ? styles.messageSuccessText : styles.messageErrorText,
                ]}
              >
                {message}
              </Text>
            </View>
          ) : null}

          <AppButton
            theme="primary"
            title="Create event"
            icon="add-circle-outline"
            onPress={handleCreateEvent}
          />

          {editTarget ? (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={editTarget === 'start' ? startDate : endDate}
                mode={isAndroid ? editingPart : 'datetime'}
                display={isAndroid ? 'default' : 'spinner'}
                onChange={onPickerChange}
              />
            </View>
          ) : null}
        </View>

        {payload ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultIcon}>
                <Ionicons name="qr-code" size={25} color={COLORS.textPrimary} />
              </View>
              <View style={styles.resultCopy}>
                <Text style={styles.resultTitle}>Event QR ready</Text>
              </View>
            </View>
            <View style={styles.qrBox}>
              <QRCode
                value={payload}
                size={196}
                color={COLORS.textPrimary}
                backgroundColor={COLORS.card}
              />
            </View>
            <View style={styles.readyPill}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
              <Text style={styles.readyText}>{eventId.trim().toUpperCase()}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={19} color={COLORS.primaryDark} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons name="calendar-outline" size={18} color={COLORS.textTertiary} />
    </Pressable>
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
  stateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  lockedCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
  },
  lockedIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: COLORS.sakura,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  lockedTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 8,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 34,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  headingCopy: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.4,
    color: COLORS.textPrimary,
    marginTop: 0,
  },
  headingIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: COLORS.mint,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 5,
  },
  formTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginTop: 16,
    marginBottom: 7,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  pickerField: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryDark,
  },
  pickerValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 19,
    marginBottom: 8,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    minHeight: 36,
    borderRadius: 11,
    backgroundColor: COLORS.mint,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPressed: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryDark,
  },
  chipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginLeft: 5,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 13,
    padding: 12,
    marginTop: 17,
    marginBottom: 2,
  },
  messageSuccess: {
    backgroundColor: COLORS.successSoft,
  },
  messageError: {
    backgroundColor: COLORS.dangerSoft,
  },
  messageText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    marginLeft: 7,
  },
  messageSuccessText: {
    color: COLORS.success,
  },
  messageErrorText: {
    color: COLORS.danger,
  },
  pickerContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginTop: 18,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  resultHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.matcha,
    borderWidth: 1,
    borderColor: COLORS.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  resultCopy: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 0,
  },
  qrBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
  },
  readyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 14,
  },
  readyText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    color: COLORS.success,
    marginLeft: 6,
  },
});
