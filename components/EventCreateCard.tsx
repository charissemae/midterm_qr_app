import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { createEvent } from '@/lib/events';
import { formatDateTime, toIsoString } from '@/lib/datetime';

export type CreatedEvent = {
  eventId: string;
  title: string;
  start: string;
  end: string;
  venue: string;
  description: string;
};

type EventCreateCardProps = {
  onCreated?: (event: CreatedEvent) => void;
  submitLabel?: string;
  heading?: string;
};

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type PickerTarget = 'start' | 'end';

export default function EventCreateCard({
  onCreated,
  submitLabel = 'Create event',
  heading = 'Event details',
}: EventCreateCardProps) {
  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [pickerPart, setPickerPart] = useState<'date' | 'time'>('date');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isAndroid = Platform.OS === 'android';

  const openPicker = (target: PickerTarget) => {
    setMessage(null);
    setPicker(target);
    setPickerPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!picker) return;
    if (event.type === 'dismissed' || !selected) {
      setPicker(null);
      setPickerPart('date');
      return;
    }

    const current = picker === 'start' ? startDate : endDate;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (picker === 'start') setStartDate(next);
    else setEndDate(next);

    if (isAndroid && pickerPart === 'date') {
      setPickerPart('time');
    } else {
      setPicker(null);
      setPickerPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = async () => {
    const cleanTitle = title.trim();
    const cleanCode = eventId.trim();

    if (!cleanTitle) {
      setMessage('Event name is required.');
      return;
    }
    if (!cleanCode) {
      setMessage('Event code is required.');
      return;
    }
    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    setSaving(true);
    setMessage(null);

    const event = {
      eventId: cleanCode,
      title: cleanTitle,
      start: toIsoString(startDate),
      end: toIsoString(endDate),
      venue: venue.trim(),
      description: description.trim(),
    };

    const { error } = await createEvent(event);
    setSaving(false);

    if (error) {
      setMessage('Could not save the event. Please try again.');
      return;
    }

    setMessage(`Event "${cleanTitle}" saved.`);
    setTitle('');
    setEventId('');
    setVenue('');
    setDescription('');
    onCreated?.({ ...event, venue: event.venue, description: event.description });
  };

  return (
    <View style={styles.formCard}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{heading}</Text>
      </View>

      <Text style={styles.label}>Event name</Text>
      <View style={styles.inputShell}>
        <Ionicons name="bookmark-outline" size={18} color={COLORS.textTertiary} />
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Founders Day Assembly"
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="sentences"
          editable={!saving}
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
          editable={!saving}
        />
      </View>

      <Text style={styles.label}>Venue</Text>
      <View style={styles.inputShell}>
        <Ionicons name="location-outline" size={18} color={COLORS.textTertiary} />
        <TextInput
          style={styles.input}
          value={venue}
          onChangeText={setVenue}
          placeholder="e.g. Main Gymnasium"
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="words"
          editable={!saving}
        />
      </View>

      <Text style={styles.label}>Description</Text>
      <View style={[styles.inputShell, styles.descriptionShell]}>
        <TextInput
          style={[styles.input, styles.descriptionInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="What is this event about?"
          placeholderTextColor={COLORS.textTertiary}
          multiline
          textAlignVertical="top"
          editable={!saving}
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
            message.startsWith('Event ') ? styles.messageSuccess : styles.messageError,
          ]}
          accessibilityRole="alert"
        >
          <Ionicons
            name={
              message.startsWith('Event ')
                ? 'checkmark-circle-outline'
                : 'alert-circle-outline'
            }
            size={17}
            color={message.startsWith('Event ') ? COLORS.success : COLORS.danger}
          />
          <Text
            style={[
              styles.messageText,
              message.startsWith('Event ')
                ? styles.messageSuccessText
                : styles.messageErrorText,
            ]}
          >
            {message}
          </Text>
        </View>
      ) : null}

      <View style={styles.submitBlock}>
        {saving ? (
          <ActivityIndicator color={COLORS.primaryDark} />
        ) : (
          <AppButton
            theme="primary"
            title={submitLabel}
            icon="add-circle-outline"
            onPress={handleCreateEvent}
            spaced={false}
          />
        )}
      </View>

      {picker ? (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={picker === 'start' ? startDate : endDate}
            mode={isAndroid ? pickerPart : 'datetime'}
            display={isAndroid ? 'default' : 'spinner'}
            onChange={onPickerChange}
          />
        </View>
      ) : null}
    </View>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function PickerField({ value, icon, onPress }: PickerFieldProps) {
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
  descriptionShell: {
    minHeight: 88,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  descriptionInput: {
    minHeight: 84,
    paddingTop: 12,
    paddingBottom: 12,
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
  submitBlock: {
    width: '100%',
    marginTop: 20,
  },
  pickerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
});
