import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import EventCreateCard, { PickerField } from '@/components/EventCreateCard';
import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  deleteEvent,
  getEventPhase,
  getEventsByTeacher,
  setEventStatus,
  updateEvent,
  type CloudEvent,
  type EventPhase,
} from '@/lib/events';
import { buildQRPayload } from '@/lib/qr';
import { useRole } from '@/lib/useRole';
import { formatDateTime, formatEventWindow, toIsoString } from '@/lib/datetime';

const PHASE_LABEL: Record<EventPhase, string> = {
  ongoing: 'Live',
  upcoming: 'Upcoming',
  ended: 'Ended',
  closed: 'Closed',
};

export default function TeacherScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [payload, setPayload] = useState<string | null>(null);
  const [payloadCode, setPayloadCode] = useState<string | null>(null);

  const [myEvents, setMyEvents] = useState<CloudEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsVersion, setEventsVersion] = useState(0);
  const [manageMessage, setManageMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<CloudEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStart, setEditStart] = useState(() => new Date());
  const [editEnd, setEditEnd] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [managePicker, setManagePicker] = useState<'start' | 'end' | null>(null);
  const [managePickerPart, setManagePickerPart] = useState<'date' | 'time'>('date');
  const [detailsId, setDetailsId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (role !== 'teacher' || !user?.id) return;
      let active = true;
      setEventsLoading(true);
      getEventsByTeacher(user.id)
        .then((rows) => {
          if (!active) return;
          setMyEvents(rows);
          setEventsLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setEventsLoading(false);
        });
      return () => {
        active = false;
      };
    }, [role, user?.id, eventsVersion])
  );

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

  const openManageEdit = (event: CloudEvent) => {
    setManageMessage(null);
    setEditing(event);
    setEditTitle(event.title);
    setEditVenue(event.venue ?? '');
    setEditDescription(event.description ?? '');
    setEditStart(event.start_time ? new Date(event.start_time) : new Date());
    setEditEnd(
      event.end_time ? new Date(event.end_time) : new Date(Date.now() + 60 * 60 * 1000)
    );
  };

  const onManagePickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!managePicker) return;
    if (event.type === 'dismissed' || !selected) {
      setManagePicker(null);
      setManagePickerPart('date');
      return;
    }

    const current = managePicker === 'start' ? editStart : editEnd;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (managePicker === 'start') setEditStart(next);
    else setEditEnd(next);

    if (Platform.OS === 'android' && managePickerPart === 'date') {
      setManagePickerPart('time');
    } else {
      setManagePicker(null);
      setManagePickerPart('date');
    }
  };

  const saveManageEdit = () => {
    if (!editing) return;
    setManageMessage(null);
    if (!editTitle.trim()) {
      setManageMessage('Event name is required.');
      return;
    }
    if (editEnd.getTime() <= editStart.getTime()) {
      setManageMessage('End time must be after start time.');
      return;
    }
    updateEvent(editing.id, {
      title: editTitle.trim(),
      start_time: toIsoString(editStart),
      end_time: toIsoString(editEnd),
      venue: editVenue.trim(),
      description: editDescription.trim(),
    }).then(({ error }) => {
      if (error) {
        setManageMessage('Could not save the changes. Please try again.');
        return;
      }
      setManageMessage(`Updated "${editTitle.trim()}".`);
      setEditing(null);
      setManagePicker(null);
      setEventsVersion((v) => v + 1);
      if (payload && payloadCode === editing.event_code) {
        setPayloadCode(editing.event_code);
        setPayload(
          buildQRPayload({
            eventId: editing.event_code,
            title: editTitle.trim(),
            start: toIsoString(editStart),
            end: toIsoString(editEnd),
          })
        );
      }
    });
  };

  const handleShowQR = (event: CloudEvent) => {
    setManageMessage(null);
    setPayloadCode(event.event_code);
    setPayload(
      buildQRPayload({
        eventId: event.event_code,
        title: event.title,
        start: event.start_time ?? undefined,
        end: event.end_time ?? undefined,
      })
    );
  };

  // "Close an event" — a closed event refuses new attendance.
  const handleToggleClosed = (event: CloudEvent) => {
    const closing = event.status !== 'closed';
    setManageMessage(null);
    setEventStatus(event.id, closing ? 'closed' : 'open').then(({ error }) => {
      if (error) {
        setManageMessage(error);
        return;
      }
      setManageMessage(
        closing
          ? `"${event.title}" is closed. Students can no longer record attendance.`
          : `"${event.title}" was reopened.`
      );
      setEventsVersion((v) => v + 1);
    });
  };

  const handleDeleteEvent = (event: CloudEvent) => {
    setManageMessage(null);
    Alert.alert(
      'Delete event',
      `Delete "${event.title}"? Its attendance records will also be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteEvent(event.id).then(({ error }) => {
              if (error) {
                setManageMessage('Could not delete the event. Please try again.');
                return;
              }
              setManageMessage(`Deleted "${event.title}".`);
              if (payload && payloadCode === event.event_code) {
                setPayload(null);
                setPayloadCode(null);
              }
              if (editing?.id === event.id) setEditing(null);
              setEventsVersion((v) => v + 1);
            });
          },
        },
      ]
    );
  };

  const messageIsError = manageMessage?.startsWith('Could') ?? false;
  const messageIsRawError = manageMessage
    ? /sql\/|policy|column/i.test(manageMessage)
    : false;

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

        <EventCreateCard
          onCreated={(created) => {
            setPayloadCode(created.eventId.toUpperCase());
            setPayload(
              buildQRPayload({
                eventId: created.eventId,
                title: created.title,
                start: created.start,
                end: created.end,
              })
            );
            setEventsVersion((v) => v + 1);
          }}
        />

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
              <Text style={styles.readyText}>{payloadCode ?? ''}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionTitle}>Manage my events</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh events"
            style={({ pressed }) => [styles.refreshButton, pressed && styles.refreshPressed]}
            onPress={() => setEventsVersion((v) => v + 1)}
          >
            <Ionicons name="refresh-outline" size={18} color={COLORS.primaryDark} />
          </Pressable>
        </View>

        {manageMessage ? (
          <View
            style={[
              styles.messageBox,
              messageIsError || messageIsRawError
                ? styles.messageError
                : styles.messageSuccess,
            ]}
            accessibilityRole="alert"
          >
            <Ionicons
              name={
                messageIsError || messageIsRawError
                  ? 'alert-circle-outline'
                  : 'checkmark-circle-outline'
              }
              size={17}
              color={
                messageIsError || messageIsRawError ? COLORS.danger : COLORS.success
              }
            />
            <Text
              style={[
                styles.messageText,
                messageIsError || messageIsRawError
                  ? styles.messageErrorText
                  : styles.messageSuccessText,
              ]}
            >
              {manageMessage}
            </Text>
          </View>
        ) : null}

        {eventsLoading ? (
          <View style={styles.manageLoading}>
            <ActivityIndicator color={COLORS.primaryDark} size="small" />
            <Text style={styles.manageLoadingText}>Loading your events...</Text>
          </View>
        ) : myEvents.length === 0 ? (
          <View style={styles.manageEmpty}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.textTertiary} />
            <Text style={styles.manageEmptyText}>
              You have no events yet. Create one above.
            </Text>
          </View>
        ) : (
          <View style={styles.manageList}>
            {myEvents.map((event) => {
              const phase = getEventPhase(event);
              const pillStyles =
                phase === 'ongoing'
                  ? styles.statusOngoing
                  : phase === 'upcoming'
                    ? styles.statusUpcoming
                    : phase === 'closed'
                      ? styles.statusClosed
                      : styles.statusEnded;
              const pillTextStyles =
                phase === 'ongoing'
                  ? styles.statusOngoingText
                  : phase === 'upcoming'
                    ? styles.statusUpcomingText
                    : phase === 'closed'
                      ? styles.statusClosedText
                      : styles.statusEndedText;
              const isEditing = editing?.id === event.id;
              const showDetails = detailsId === event.id;
              const isClosed = phase === 'closed';
              return (
                <View key={event.id} style={styles.manageCard}>
                  <View style={styles.manageHeader}>
                    <View style={styles.manageCopy}>
                      <Text style={styles.manageTitle} numberOfLines={1}>
                        {event.title}
                      </Text>
                      <View style={styles.manageCodeRow}>
                        <Ionicons name="pricetag-outline" size={13} color={COLORS.textTertiary} />
                        <Text style={styles.manageCode}>{event.event_code}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusPill, pillStyles]}>
                      <Text style={[styles.statusPillText, pillTextStyles]}>
                        {PHASE_LABEL[phase]}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.manageWindow}>{formatEventWindow(event)}</Text>

                  {event.venue ? (
                    <View style={styles.manageMetaRow}>
                      <Ionicons name="location-outline" size={13} color={COLORS.textTertiary} />
                      <Text style={styles.manageMetaText} numberOfLines={1}>
                        {event.venue}
                      </Text>
                    </View>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.detailsToggle,
                      pressed && styles.detailsTogglePressed,
                    ]}
                    onPress={() => setDetailsId(showDetails ? null : event.id)}
                  >
                    <Text style={styles.detailsToggleText}>
                      {showDetails ? 'Hide details' : 'View details'}
                    </Text>
                    <Ionicons
                      name={showDetails ? 'chevron-up' : 'chevron-down'}
                      size={15}
                      color={COLORS.primaryDark}
                    />
                  </Pressable>

                  {showDetails ? (
                    <View style={styles.detailsCard}>
                      <DetailRow icon="bookmark-outline" label="Event name" value={event.title} />
                      <DetailRow
                        icon="calendar-outline"
                        label="Date & time"
                        value={formatEventWindow(event)}
                      />
                      <DetailRow
                        icon="location-outline"
                        label="Venue"
                        value={event.venue?.trim() || 'Not set'}
                      />
                      <DetailRow
                        icon="document-text-outline"
                        label="Description"
                        value={event.description?.trim() || 'Not set'}
                      />
                      <DetailRow
                        icon="flag-outline"
                        label="Status"
                        value={isClosed ? 'Closed' : PHASE_LABEL[phase]}
                      />
                    </View>
                  ) : null}

                  <View style={styles.manageActions}>
                    <View style={styles.manageActionItem}>
                      <AppButton
                        compact
                        spaced={false}
                        title="QR"
                        icon="qr-code-outline"
                        onPress={() => handleShowQR(event)}
                      />
                    </View>
                    <View style={styles.manageActionItem}>
                      <AppButton
                        compact
                        spaced={false}
                        title={isEditing ? 'Close' : 'Edit'}
                        icon={isEditing ? 'close-outline' : 'create-outline'}
                        onPress={() => (isEditing ? setEditing(null) : openManageEdit(event))}
                      />
                    </View>
                    <View style={styles.manageActionItem}>
                      <AppButton
                        compact
                        spaced={false}
                        title={isClosed ? 'Reopen' : 'Close'}
                        icon={isClosed ? 'lock-open-outline' : 'lock-closed-outline'}
                        onPress={() => handleToggleClosed(event)}
                      />
                    </View>
                  </View>

                  <View style={styles.manageActions}>
                    <View style={styles.manageActionItem}>
                      <AppButton
                        compact
                        spaced={false}
                        variant="danger"
                        title="Delete event"
                        icon="trash-outline"
                        onPress={() => handleDeleteEvent(event)}
                      />
                    </View>
                  </View>

                  {isEditing ? (
                    <View style={styles.editCard}>
                      <Text style={styles.label}>Event name</Text>
                      <View style={styles.inputShell}>
                        <Ionicons name="bookmark-outline" size={18} color={COLORS.textTertiary} />
                        <TextInput
                          style={styles.input}
                          value={editTitle}
                          onChangeText={setEditTitle}
                          placeholder="Event name"
                          placeholderTextColor={COLORS.textTertiary}
                          autoCapitalize="sentences"
                        />
                      </View>

                      <Text style={styles.label}>Venue</Text>
                      <View style={styles.inputShell}>
                        <Ionicons name="location-outline" size={18} color={COLORS.textTertiary} />
                        <TextInput
                          style={styles.input}
                          value={editVenue}
                          onChangeText={setEditVenue}
                          placeholder="Venue"
                          placeholderTextColor={COLORS.textTertiary}
                          autoCapitalize="words"
                        />
                      </View>

                      <Text style={styles.label}>Description</Text>
                      <View style={[styles.inputShell, styles.descriptionShell]}>
                        <TextInput
                          style={[styles.input, styles.descriptionInput]}
                          value={editDescription}
                          onChangeText={setEditDescription}
                          placeholder="What is this event about?"
                          placeholderTextColor={COLORS.textTertiary}
                          multiline
                          textAlignVertical="top"
                        />
                      </View>

                      <Text style={styles.label}>Starts</Text>
                      <PickerField
                        value={formatDateTime(editStart)}
                        icon="sunny-outline"
                        onPress={() => {
                          setManageMessage(null);
                          setManagePicker('start');
                          setManagePickerPart('date');
                        }}
                      />

                      <Text style={styles.label}>Ends</Text>
                      <PickerField
                        value={formatDateTime(editEnd)}
                        icon="moon-outline"
                        onPress={() => {
                          setManageMessage(null);
                          setManagePicker('end');
                          setManagePickerPart('date');
                        }}
                      />

                      {managePicker ? (
                        <View style={styles.pickerContainer}>
                          <DateTimePicker
                            value={managePicker === 'start' ? editStart : editEnd}
                            mode={Platform.OS === 'android' ? managePickerPart : 'datetime'}
                            display={Platform.OS === 'android' ? 'default' : 'spinner'}
                            onChange={onManagePickerChange}
                          />
                        </View>
                      ) : null}

                      <View style={styles.editActions}>
                        <View style={styles.editActionItem}>
                          <AppButton
                            compact
                            spaced={false}
                            title="Cancel"
                            icon="close-outline"
                            onPress={() => {
                              setEditing(null);
                              setManagePicker(null);
                            }}
                          />
                        </View>
                        <View style={styles.editActionItem}>
                          <AppButton
                            compact
                            spaced={false}
                            variant="primary"
                            title="Save"
                            icon="checkmark-outline"
                            onPress={saveManageEdit}
                          />
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

type DetailRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={15} color={COLORS.primaryDark} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
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
  stateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 12,
    textAlign: 'center',
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
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 13,
    padding: 12,
    marginTop: 17,
    marginBottom: 0,
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
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 13,
  },
  sectionHeadingCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshPressed: {
    backgroundColor: COLORS.primarySoft,
  },
  manageLoading: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  manageLoadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  manageEmpty: {
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  manageEmptyText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  manageList: {
    gap: 10,
  },
  manageCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  manageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manageCopy: {
    flex: 1,
  },
  manageTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  manageCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  manageCode: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: COLORS.textSecondary,
  },
  manageWindow: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  manageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  manageMetaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  detailsTogglePressed: {
    opacity: 0.7,
  },
  detailsToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  detailsCard: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 12,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  detailIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: COLORS.textTertiary,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  manageActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  manageActionItem: {
    flex: 1,
  },
  editCard: {
    marginTop: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  editActionItem: {
    flex: 1,
  },
  pickerContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  statusPill: {
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  statusOngoing: {
    backgroundColor: COLORS.successSoft,
    borderColor: COLORS.success,
  },
  statusOngoingText: {
    color: COLORS.success,
  },
  statusUpcoming: {
    backgroundColor: COLORS.warningSoft,
    borderColor: COLORS.warning,
  },
  statusUpcomingText: {
    color: COLORS.warning,
  },
  statusEnded: {
    backgroundColor: COLORS.surfaceMuted,
    borderColor: COLORS.border,
  },
  statusEndedText: {
    color: COLORS.textTertiary,
  },
  statusClosed: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: COLORS.danger,
  },
  statusClosedText: {
    color: COLORS.danger,
  },
});
