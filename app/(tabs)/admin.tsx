import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import {
  addAttendanceRecord,
  deleteAttendanceRecord,
  getAllAttendance,
  updateAttendanceStatus,
  type AdminAttendanceRecord,
  type AttendanceStatus,
} from '@/lib/attendance';
import {
  deleteUserAccount,
  getSystemStats,
  listUsers,
  setUserRole,
  type AdminUser,
  type SystemStats,
} from '@/lib/admin';
import { useAuth } from '@/lib/auth';
import {
  deleteEvent,
  getAllEvents,
  getEventPhase,
  setEventStatus,
  updateEvent,
  type CloudEvent,
  type EventPhase,
} from '@/lib/events';
import { formatDateTime, formatEventWindow, toIsoString } from '@/lib/datetime';
import type { Role } from '@/lib/profiles';
import { buildQRPayload } from '@/lib/qr';
import { useRole } from '@/lib/useRole';

type SectionKey = 'users' | 'events' | 'attendance' | 'reports';

type Status = EventPhase;

const STATUS_LABEL: Record<Status, string> = {
  ongoing: 'Live',
  upcoming: 'Upcoming',
  ended: 'Ended',
  closed: 'Closed',
};

const ROLE_LABEL: Record<Role, string> = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Administrator',
};

const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
};

function AttendanceStatusPill({ status }: { status: AttendanceStatus }) {
  const background =
    status === 'present'
      ? COLORS.successSoft
      : status === 'late'
        ? COLORS.warningSoft
        : COLORS.dangerSoft;
  const border =
    status === 'present' ? COLORS.success : status === 'late' ? COLORS.warning : COLORS.danger;
  const text =
    status === 'present' ? COLORS.success : status === 'late' ? COLORS.warning : COLORS.danger;

  return (
    <View style={[styles.statusPill, { backgroundColor: background, borderColor: border }]}>
      <Text style={[styles.statusPillText, { color: text }]}>
        {ATTENDANCE_STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

function StatusPill({ status }: { status: Status }) {
  const background =
    status === 'ongoing'
      ? COLORS.successSoft
      : status === 'upcoming'
        ? COLORS.warningSoft
        : status === 'closed'
          ? COLORS.dangerSoft
          : COLORS.surfaceMuted;
  const border =
    status === 'ongoing'
      ? COLORS.success
      : status === 'upcoming'
        ? COLORS.warning
        : status === 'closed'
          ? COLORS.danger
          : COLORS.border;
  const text =
    status === 'ongoing'
      ? COLORS.success
      : status === 'upcoming'
        ? COLORS.warning
        : status === 'closed'
          ? COLORS.danger
          : COLORS.textTertiary;

  return (
    <View style={[styles.statusPill, { backgroundColor: background, borderColor: border }]}>
      <Text style={[styles.statusPillText, { color: text }]}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const background =
    role === 'admin'
      ? COLORS.sakura
      : role === 'teacher'
        ? COLORS.matcha
        : COLORS.sky;
  const label = ROLE_LABEL[role];

  return (
    <View style={[styles.roleBadge, { backgroundColor: background }]}>
      <Text style={styles.roleBadgeText}>{label}</Text>
    </View>
  );
}

type MessageBoxProps = {
  message: string | null;
  success?: boolean;
};

function MessageBox({ message, success = true }: MessageBoxProps) {
  if (!message) return null;
  const failed = !success;

  return (
    <View
      style={[styles.messageBox, failed ? styles.messageError : styles.messageSuccess]}
      accessibilityRole="alert"
    >
      <Ionicons
        name={failed ? 'alert-circle-outline' : 'checkmark-circle-outline'}
        size={17}
        color={failed ? COLORS.danger : COLORS.success}
      />
      <Text
        style={[
          styles.messageText,
          failed ? styles.messageErrorText : styles.messageSuccessText,
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

export default function AdminScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const [section, setSection] = useState<SectionKey>('users');

  if (roleLoading) {
    return (
      <View style={styles.container}>
        <Header title="Administrator" />
        <View style={styles.stateContainer}>
          <ActivityIndicator color={COLORS.primaryDark} size="large" />
          <Text style={styles.stateText}>Checking your account...</Text>
        </View>
      </View>
    );
  }

  if (role !== 'admin') {
    return (
      <View style={styles.container}>
        <Header title="Administrator" />
        <View style={styles.stateContainer}>
          <View style={styles.lockedCard}>
            <View style={styles.lockedIcon}>
              <Ionicons name="lock-closed-outline" size={28} color={COLORS.primaryDark} />
            </View>
            <Text style={styles.lockedTitle}>Administrators only</Text>
            <Text style={styles.stateText}>
              Only administrator accounts can manage users, events, attendance and reports.
            </Text>
          </View>
        </View>
      </View>
    );
  }

  const sections: { key: SectionKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'users', label: 'Users', icon: 'people-outline' },
    { key: 'events', label: 'Events', icon: 'calendar-outline' },
    { key: 'attendance', label: 'Attendance', icon: 'list-outline' },
    { key: 'reports', label: 'Reports', icon: 'bar-chart-outline' },
  ];

  return (
    <View style={styles.container}>
      <Header title="Administrator" />

      <View style={styles.segments}>
        {sections.map((item) => {
          const active = section === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.segment,
                active && styles.segmentActive,
                pressed && !active && styles.segmentPressed,
              ]}
              onPress={() => setSection(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={15}
                color={active ? COLORS.textOnPrimary : COLORS.textSecondary}
              />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {section === 'users' ? <UsersSection selfId={user?.id ?? null} /> : null}
      {section === 'events' ? <EventsSection /> : null}
      {section === 'attendance' ? <AttendanceSection /> : null}
      {section === 'reports' ? <ReportsSection /> : null}
    </View>
  );
}

function UsersSection({ selfId }: { selfId: string | null }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listUsers().then((rows) => {
      if (!active) return;
      setUsers(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [version]);

  const filtered = users.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (item.full_name ?? '').toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.role.toLowerCase().includes(q)
    );
  });

  const changeRole = (target: AdminUser, nextRole: Role) => {
    if (target.role === nextRole) return;
    setUserRole(target.id, nextRole).then(({ error }) => {
      if (error) {
        setMessageOk(false);
        setMessage('Could not update the role. Run the admin SQL setup first.');
      } else {
        setMessageOk(true);
        setMessage(
          `${target.full_name ?? target.email} is now ${
            nextRole === 'admin' ? 'an administrator' : `a ${nextRole}`
          }.`
        );
      }
      setVersion((v) => v + 1);
    });
  };

  const confirmDelete = (target: AdminUser) => {
    Alert.alert(
      'Delete account',
      `Delete ${target.full_name ?? target.email}? This removes the account and its attendance records. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteUserAccount(target.id).then(({ error }) => {
              if (error) {
                setMessageOk(false);
                setMessage('Could not delete the account. Run the admin SQL setup first.');
              } else {
                setMessageOk(true);
                setMessage('Account deleted.');
              }
              setVersion((v) => v + 1);
            });
          },
        },
      ]
    );
  };

  const openActions = (target: AdminUser) => {
    const heading = target.full_name ?? target.email;
    Alert.alert(heading, `${target.email} - ${ROLE_LABEL[target.role]}`, [
      { text: 'Make student', onPress: () => changeRole(target, 'student') },
      { text: 'Make teacher', onPress: () => changeRole(target, 'teacher') },
      { text: 'Make administrator', onPress: () => changeRole(target, 'admin') },
      ...(selfId && selfId !== target.id
        ? [
            {
              text: 'Delete account',
              style: 'destructive' as const,
              onPress: () => confirmDelete(target),
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.searchShell}>
        <Ionicons name="search-outline" size={18} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, email or role"
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
        />
        {query ? (
          <Pressable accessibilityRole="button" onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      <MessageBox message={message} success={messageOk} />

      <Text style={styles.countText}>
        {loading ? 'Loading accounts...' : `${filtered.length} account${filtered.length === 1 ? '' : 's'}`}
      </Text>

      {loading ? (
        <View style={styles.listLoading}>
          <ActivityIndicator color={COLORS.primaryDark} size="small" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={22} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No accounts match your search.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              style={({ pressed }) => [styles.rowCard, pressed && styles.rowPressed]}
              onPress={() => openActions(item)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.full_name ?? item.email).charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.full_name ?? 'No name'}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
              <RoleBadge role={item.role} />
              <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function EventsSection() {
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(true);
  const [editing, setEditing] = useState<CloudEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editVenue, setEditVenue] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStart, setEditStart] = useState(() => new Date());
  const [editEnd, setEditEnd] = useState(() => new Date(Date.now() + 60 * 60 * 1000));
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [pickerPart, setPickerPart] = useState<'date' | 'time'>('date');
  const [qrEventId, setQrEventId] = useState<string | null>(null);

  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAllEvents().then((rows) => {
      if (!active) return;
      setEvents(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [version]);

  const openEdit = (event: CloudEvent) => {
    setMessage(null);
    setEditing(event);
    setEditTitle(event.title);
    setEditVenue(event.venue ?? '');
    setEditDescription(event.description ?? '');
    setEditStart(event.start_time ? new Date(event.start_time) : new Date());
    setEditEnd(
      event.end_time ? new Date(event.end_time) : new Date(Date.now() + 60 * 60 * 1000)
    );
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!picker) return;
    if (event.type === 'dismissed' || !selected) {
      setPicker(null);
      setPickerPart('date');
      return;
    }

    const current = picker === 'start' ? editStart : editEnd;
    const next = new Date(current);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (picker === 'start') setEditStart(next);
    else setEditEnd(next);

    if (isAndroid && pickerPart === 'date') {
      setPickerPart('time');
    } else {
      setPicker(null);
      setPickerPart('date');
    }
  };

  const saveEdit = () => {
    if (!editing) return;
    if (!editTitle.trim()) {
      setMessageOk(false);
      setMessage('Event title is required.');
      return;
    }
    if (editEnd.getTime() <= editStart.getTime()) {
      setMessageOk(false);
      setMessage('End time must be after start time.');
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
        setMessageOk(false);
        setMessage('Could not save the changes. Run the admin SQL setup first.');
        return;
      }
      setMessageOk(true);
      setMessage(`Updated "${editTitle.trim()}".`);
      setEditing(null);
      setPicker(null);
      setQrEventId(null);
      setVersion((v) => v + 1);
    });
  };

  // "Close an event" — a closed event refuses new attendance.
  const toggleClosed = (event: CloudEvent) => {
    const closing = event.status !== 'closed';
    setMessage(null);
    setEventStatus(event.id, closing ? 'closed' : 'open').then(({ error }) => {
      if (error) {
        setMessageOk(false);
        setMessage(error);
        return;
      }
      setMessageOk(true);
      setMessage(
        closing
          ? `"${event.title}" is closed. Students can no longer record attendance.`
          : `"${event.title}" was reopened.`
      );
      setVersion((v) => v + 1);
    });
  };

  const confirmDelete = (event: CloudEvent) => {
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
                setMessageOk(false);
                setMessage('Could not delete the event. Run the admin SQL setup first.');
                return;
              }
              setMessageOk(true);
              setMessage(`Deleted "${event.title}".`);
              if (editing?.id === event.id) setEditing(null);
              if (qrEventId === event.id) setQrEventId(null);
              setVersion((v) => v + 1);
            });
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <MessageBox message={message} success={messageOk} />

      <Text style={styles.blockTitle}>Create event</Text>
      <EventCreateCard
        heading="New event"
        submitLabel="Create event"
        onCreated={(created) => {
          setMessageOk(true);
          setMessage(`Event "${created.title}" created.`);
          setVersion((v) => v + 1);
        }}
      />

      <Text style={styles.countText}>
        {loading ? 'Loading events...' : `${events.length} event${events.length === 1 ? '' : 's'} in the system`}
      </Text>

      {loading ? (
        <View style={styles.listLoading}>
          <ActivityIndicator color={COLORS.primaryDark} size="small" />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={22} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No events created yet.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {events.map((event) => {
            const isEditing = editing?.id === event.id;
            const showQr = qrEventId === event.id;
            const isClosed = getEventPhase(event) === 'closed';
            return (
              <View key={event.id} style={styles.rowCardBlock}>
                <View style={styles.rowCardTop}>
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {event.event_code}
                    </Text>
                  </View>
                  <StatusPill status={getEventPhase(event)} />
                </View>

                <Text style={styles.rowWindow}>{formatEventWindow(event)}</Text>

                {event.venue ? (
                  <Text style={styles.rowWindow}>{event.venue}</Text>
                ) : null}

                <View style={styles.manageActions}>
                  <View style={styles.actionItem}>
                    <AppButton
                      compact
                      spaced={false}
                      title="QR"
                      icon="qr-code-outline"
                      onPress={() => {
                        setQrEventId(showQr ? null : event.id);
                      }}
                    />
                  </View>
                  <View style={styles.actionItem}>
                    <AppButton
                      compact
                      spaced={false}
                      title={isEditing ? 'Close' : 'Edit'}
                      icon={isEditing ? 'close-outline' : 'create-outline'}
                      onPress={() => (isEditing ? setEditing(null) : openEdit(event))}
                    />
                  </View>
                  <View style={styles.actionItem}>
                    <AppButton
                      compact
                      spaced={false}
                      title={isClosed ? 'Reopen' : 'Close'}
                      icon={isClosed ? 'lock-open-outline' : 'lock-closed-outline'}
                      onPress={() => toggleClosed(event)}
                    />
                  </View>
                </View>

                <View style={styles.manageActions}>
                  <View style={styles.actionItem}>
                    <AppButton
                      compact
                      spaced={false}
                      variant="danger"
                      title="Delete"
                      icon="trash-outline"
                      onPress={() => confirmDelete(event)}
                    />
                  </View>
                </View>

                {showQr ? (
                  <View style={styles.qrBox}>
                    <QRCode
                      value={buildQRPayload({
                        eventId: event.event_code,
                        title: event.title,
                        start: event.start_time ?? undefined,
                        end: event.end_time ?? undefined,
                      })}
                      size={168}
                      color={COLORS.textPrimary}
                      backgroundColor={COLORS.card}
                    />
                  </View>
                ) : null}

                {isEditing ? (
                  <View style={styles.editCard}>
                    <Text style={styles.label}>Event title</Text>
                    <View style={styles.inputShell}>
                      <Ionicons name="bookmark-outline" size={18} color={COLORS.textTertiary} />
                      <TextInput
                        style={styles.input}
                        value={editTitle}
                        onChangeText={setEditTitle}
                        placeholder="Event title"
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
                        setPicker('start');
                        setPickerPart('date');
                      }}
                    />

                    <Text style={styles.label}>Ends</Text>
                    <PickerField
                      value={formatDateTime(editEnd)}
                      icon="moon-outline"
                      onPress={() => {
                        setPicker('end');
                        setPickerPart('date');
                      }}
                    />

                    {picker ? (
                      <View style={styles.pickerContainer}>
                        <DateTimePicker
                          value={picker === 'start' ? editStart : editEnd}
                          mode={isAndroid ? pickerPart : 'datetime'}
                          display={isAndroid ? 'default' : 'spinner'}
                          onChange={onPickerChange}
                        />
                      </View>
                    ) : null}

                    <View style={styles.manageActions}>
                      <View style={styles.actionItem}>
                        <AppButton
                          compact
                          spaced={false}
                          title="Cancel"
                          icon="close-outline"
                          onPress={() => {
                            setEditing(null);
                            setPicker(null);
                          }}
                        />
                      </View>
                      <View style={styles.actionItem}>
                        <AppButton
                          compact
                          spaced={false}
                          variant="primary"
                          title="Save"
                          icon="checkmark-outline"
                          onPress={saveEdit}
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
  );
}

function AttendanceSection() {
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [messageOk, setMessageOk] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [students, setStudents] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState(() => new Date());
  const [addStatus, setAddStatus] = useState<AttendanceStatus>('present');
  const [timePicker, setTimePicker] = useState<'date' | 'time' | null>(null);
  const [studentPicker, setStudentPicker] = useState(false);
  const [eventPicker, setEventPicker] = useState(false);

  const isAndroid = Platform.OS === 'android';

  useEffect(() => {
    let active = true;
    setLoading(true);
    getAllAttendance().then((rows) => {
      if (!active) return;
      setRecords(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [version]);

  useEffect(() => {
    if (!showAdd) return;
    let active = true;
    listUsers().then((rows) => {
      if (active) setStudents(rows.filter((row) => row.role === 'student'));
    });
    getAllEvents().then((rows) => {
      if (active) setEvents(rows);
    });
    return () => {
      active = false;
    };
  }, [showAdd]);

  const filtered = records.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (row.studentName ?? '').toLowerCase().includes(q) ||
      (row.studentEmail ?? '').toLowerCase().includes(q) ||
      row.eventTitle.toLowerCase().includes(q) ||
      row.eventCode.toLowerCase().includes(q)
    );
  });

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const saveRecord = () => {
    setMessage(null);
    if (!selectedStudentId || !selectedEventId) {
      setMessageOk(false);
      setMessage('Pick a student and an event first.');
      return;
    }
    addAttendanceRecord({
      studentId: selectedStudentId,
      eventId: selectedEventId,
      scannedAt: toIsoString(scannedAt),
      status: addStatus,
    }).then(({ error }) => {
      if (error) {
        setMessageOk(false);
        setMessage(
          error.includes('Run') || error.includes('policy')
            ? `${error} Run the admin SQL setup first.`
            : error
        );
        return;
      }
      setMessageOk(true);
      setMessage('Attendance record added.');
      setShowAdd(false);
      setSelectedStudentId(null);
      setSelectedEventId(null);
      setScannedAt(new Date());
      setAddStatus('present');
      setVersion((v) => v + 1);
    });
  };

  // The administrator can correct the status of any attendance record.
  const changeStatus = (record: AdminAttendanceRecord) => {
    const options: { label: string; value: AttendanceStatus }[] = [
      { label: 'Present', value: 'present' },
      { label: 'Late', value: 'late' },
      { label: 'Absent', value: 'absent' },
    ];

    Alert.alert(
      'Attendance status',
      `${record.studentName ?? record.studentEmail ?? 'Student'} - ${record.eventTitle}`,
      [
        ...options.map((option) => ({
          text: option.label,
          onPress: () => {
            updateAttendanceStatus(record.id, option.value).then(({ error }) => {
              if (error) {
                setMessageOk(false);
                setMessage(error);
                return;
              }
              setMessageOk(true);
              setMessage(
                `Status for ${record.studentName ?? record.studentEmail ?? 'student'} set to ${option.label.toLowerCase()}.`
              );
              setVersion((v) => v + 1);
            });
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const confirmDelete = (record: AdminAttendanceRecord) => {
    Alert.alert(
      'Delete record',
      `Remove ${record.studentName ?? record.studentEmail ?? 'this student'} from "${record.eventTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteAttendanceRecord(record.id).then(({ error }) => {
              if (error) {
                setMessageOk(false);
                setMessage('Could not delete the record. Run the admin SQL setup first.');
                return;
              }
              setMessageOk(true);
              setMessage('Attendance record deleted.');
              setVersion((v) => v + 1);
            });
          },
        },
      ]
    );
  };

  const onTimePickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (!timePicker) return;
    if (event.type === 'dismissed' || !selected) {
      setTimePicker(null);
      return;
    }
    const next = new Date(scannedAt);
    next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setScannedAt(next);
    setTimePicker(isAndroid && timePicker === 'date' ? 'time' : null);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <MessageBox message={message} success={messageOk} />

      <AppButton
        compact
        spaced={false}
        variant={showAdd ? 'secondary' : 'primary'}
        title={showAdd ? 'Close form' : 'Add missing record'}
        icon={showAdd ? 'close-outline' : 'add-circle-outline'}
        onPress={() => {
          setShowAdd((v) => !v);
          setMessage(null);
        }}
      />

      {showAdd ? (
        <View style={styles.addCard}>
          <Text style={styles.label}>Student</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
            onPress={() => setStudentPicker(true)}
          >
            <Ionicons name="person-outline" size={19} color={COLORS.primaryDark} />
            <Text style={styles.pickerValue}>
              {selectedStudent
                ? `${selectedStudent.full_name ?? selectedStudent.email}`
                : 'Pick a student'}
            </Text>
            <Ionicons name="chevron-down-outline" size={18} color={COLORS.textTertiary} />
          </Pressable>

          <Text style={styles.label}>Event</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
            onPress={() => setEventPicker(true)}
          >
            <Ionicons name="calendar-outline" size={19} color={COLORS.primaryDark} />
            <Text style={styles.pickerValue}>
              {selectedEvent ? `${selectedEvent.title} (${selectedEvent.event_code})` : 'Pick an event'}
            </Text>
            <Ionicons name="chevron-down-outline" size={18} color={COLORS.textTertiary} />
          </Pressable>

          <Text style={styles.label}>Status</Text>
          <View style={styles.statusChoiceRow}>
            {(['present', 'late', 'absent'] as AttendanceStatus[]).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.statusChoice,
                  addStatus === value && styles.statusChoiceActive,
                  pressed && styles.statusChoicePressed,
                ]}
                onPress={() => setAddStatus(value)}
              >
                <Text
                  style={[
                    styles.statusChoiceText,
                    addStatus === value && styles.statusChoiceTextActive,
                  ]}
                >
                  {ATTENDANCE_STATUS_LABEL[value]}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Recorded at</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.pickerField, pressed && styles.pickerFieldPressed]}
            onPress={() => setTimePicker('date')}
          >
            <Ionicons name="time-outline" size={19} color={COLORS.primaryDark} />
            <Text style={styles.pickerValue}>{formatDateTime(scannedAt)}</Text>
            <Ionicons name="calendar-outline" size={18} color={COLORS.textTertiary} />
          </Pressable>

          {timePicker ? (
            <View style={styles.pickerContainer}>
              <DateTimePicker
                value={scannedAt}
                mode={isAndroid ? timePicker : 'datetime'}
                display={isAndroid ? 'default' : 'spinner'}
                onChange={onTimePickerChange}
              />
            </View>
          ) : null}

          <View style={styles.addActions}>
            <View style={styles.actionItem}>
              <AppButton
                compact
                spaced={false}
                title="Save record"
                icon="checkmark-outline"
                variant="primary"
                onPress={saveRecord}
              />
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.searchShell}>
        <Ionicons name="search-outline" size={18} color={COLORS.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search student or event"
          placeholderTextColor={COLORS.textTertiary}
          autoCapitalize="none"
        />
        {query ? (
          <Pressable accessibilityRole="button" onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.countText}>
        {loading
          ? 'Loading attendance...'
          : `${filtered.length} record${filtered.length === 1 ? '' : 's'}`}
      </Text>

      {loading ? (
        <View style={styles.listLoading}>
          <ActivityIndicator color={COLORS.primaryDark} size="small" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="list-outline" size={22} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No attendance records found.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {filtered.map((record) => (
            <View key={record.id} style={styles.rowCardBlock}>
              <View style={styles.rowCardTop}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {record.studentName ?? 'Unknown student'}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {record.studentEmail ?? record.studentId}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Change attendance status"
                  onPress={() => changeStatus(record)}
                >
                  <AttendanceStatusPill status={record.status} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete attendance record"
                  style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}
                  onPress={() => confirmDelete(record)}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                </Pressable>
              </View>
              <Text style={styles.rowWindow}>
                {record.eventTitle} ({record.eventCode})
              </Text>
              <Text style={styles.rowWindow}>{formatDateTime(new Date(record.scannedAt))}</Text>
              {record.attendanceDate || record.attendanceTime ? (
                <Text style={styles.rowSub}>
                  Attendance date: {record.attendanceDate ?? '—'} | Time:{' '}
                  {record.attendanceTime ?? '—'}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}

      <PickerModal
        visible={studentPicker}
        title="Pick a student"
        items={students.map((s) => ({
          id: s.id,
          label: s.full_name ?? s.email,
          sublabel: s.email,
        }))}
        onSelect={(id) => setSelectedStudentId(id)}
        onClose={() => setStudentPicker(false)}
      />

      <PickerModal
        visible={eventPicker}
        title="Pick an event"
        items={events.map((e) => ({
          id: e.id,
          label: e.title,
          sublabel: `${e.event_code} - ${formatEventWindow(e)}`,
        }))}
        onSelect={(id) => setSelectedEventId(id)}
        onClose={() => setEventPicker(false)}
      />
    </ScrollView>
  );
}

function ReportsSection() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [allAttendance, setAllAttendance] = useState<AdminAttendanceRecord[]>([]);
  const [recent, setRecent] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getSystemStats(), getAllAttendance()]).then(([nextStats, rows]) => {
      if (!active) return;
      setStats(nextStats);
      setAllAttendance(rows);
      setRecent(rows.slice(0, 5));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [version]);

  if (loading || !stats) {
    return (
      <View style={styles.sectionContent}>
        <View style={styles.listLoading}>
          <ActivityIndicator color={COLORS.primaryDark} size="small" />
          <Text style={styles.listLoadingText}>Loading system report...</Text>
        </View>
      </View>
    );
  }

  const totalPresent = allAttendance.filter((r) => r.status === 'present').length;
  const totalLate = allAttendance.filter((r) => r.status === 'late').length;
  const totalAbsent = allAttendance.filter((r) => r.status === 'absent').length;
  const overallRate =
    allAttendance.length > 0
      ? Math.round((totalPresent / allAttendance.length) * 100)
      : 0;

  const cards: { label: string; value: number | string; icon: keyof typeof Ionicons.glyphMap; tint: string }[] =
    [
      { label: 'Accounts', value: stats.totalUsers, icon: 'people-outline', tint: COLORS.sky },
      { label: 'Students', value: stats.students, icon: 'school-outline', tint: COLORS.matcha },
      { label: 'Teachers', value: stats.teachers, icon: 'person-outline', tint: COLORS.sakura },
      { label: 'Events', value: stats.totalEvents, icon: 'calendar-outline', tint: COLORS.mint },
      {
        label: 'Total Scans',
        value: stats.totalAttendance,
        icon: 'list-outline',
        tint: COLORS.crystal,
      },
      {
        label: 'Today',
        value: stats.todayAttendance,
        icon: 'today-outline',
        tint: COLORS.warningSoft,
      },
      {
        label: 'Present',
        value: totalPresent,
        icon: 'checkmark-circle-outline',
        tint: COLORS.successSoft,
      },
      {
        label: 'Late',
        value: totalLate,
        icon: 'time-outline',
        tint: COLORS.warningSoft,
      },
      {
        label: 'Absent',
        value: totalAbsent,
        icon: 'close-circle-outline',
        tint: COLORS.dangerSoft,
      },
      {
        label: 'Present Rate',
        value: `${overallRate}%`,
        icon: 'bar-chart-outline',
        tint: COLORS.mint,
      },
    ];

  return (
    <ScrollView
      contentContainerStyle={styles.sectionContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statsGrid}>
        {cards.map((card) => (
          <View key={card.label} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: card.tint }]}>
              <Ionicons name={card.icon} size={18} color={COLORS.textPrimary} />
            </View>
            <Text style={styles.statValue}>{card.value}</Text>
            <Text style={styles.statLabel}>{card.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.blockTitle}>Attendance per event (System-wide)</Text>
      {stats.perEvent.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="bar-chart-outline" size={22} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No events to report yet.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {stats.perEvent.map((item) => (
            <View key={item.eventId} style={styles.rowCardBlock}>
              <View style={styles.rowCardTop}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {item.eventCode}
                  </Text>
                </View>
                <View style={styles.summaryCount}>
                  <Text style={styles.summaryCountValue}>{item.attendeeCount}</Text>
                  <Text style={styles.summaryCountLabel}>Total</Text>
                </View>
              </View>
              <View style={styles.perEventBreakdown}>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: COLORS.success }]}>
                    {item.presentCount}
                  </Text>
                  <Text style={styles.breakdownLabel}>Present</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: COLORS.warning }]}>
                    {item.lateCount}
                  </Text>
                  <Text style={styles.breakdownLabel}>Late</Text>
                </View>
                <View style={styles.breakdownItem}>
                  <Text style={[styles.breakdownValue, { color: COLORS.danger }]}>
                    {item.absentCount}
                  </Text>
                  <Text style={styles.breakdownLabel}>Absent</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.blockTitle}>Recent activity</Text>
      {recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="time-outline" size={22} color={COLORS.textTertiary} />
          <Text style={styles.emptyText}>No attendance recorded yet.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {recent.map((record) => (
            <View key={record.id} style={styles.summaryRow}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {record.studentName ?? 'Unknown student'}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {record.eventTitle}
                </Text>
              </View>
              <Text style={styles.rowWindow}>{formatDateTime(new Date(record.scannedAt))}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.refreshWide, pressed && styles.refreshPressed]}
        onPress={() => setVersion((v) => v + 1)}
      >
        <Ionicons name="refresh-outline" size={17} color={COLORS.primaryDark} />
        <Text style={styles.refreshWideText}>Refresh report</Text>
      </Pressable>
    </ScrollView>
  );
}

type PickerItem = {
  id: string;
  label: string;
  sublabel?: string;
};

type PickerModalProps = {
  visible: boolean;
  title: string;
  items: PickerItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
};

function PickerModal({ visible, title, items, onSelect, onClose }: PickerModalProps) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const filtered = items.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) || (item.sublabel ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <Pressable accessibilityRole="button" onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.searchShell}>
            <Ionicons name="search-outline" size={18} color={COLORS.textTertiary} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={COLORS.textTertiary}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            style={styles.modalList}
            ListEmptyComponent={
              <Text style={styles.modalEmpty}>No matches found.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.modalRow, pressed && styles.rowPressed]}
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
              >
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.label}
                  </Text>
                  {item.sublabel ? (
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {item.sublabel}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textTertiary} />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
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
  segments: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 4,
  },
  segmentActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  segmentPressed: {
    backgroundColor: COLORS.surfaceMuted,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.textOnPrimary,
  },
  sectionContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 34,
  },
  searchShell: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 14.5,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 14,
    marginBottom: 9,
  },
  listLoading: {
    minHeight: 80,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  listLoadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  emptyCard: {
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
  emptyText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  list: {
    gap: 10,
  },
  rowCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  rowPressed: {
    backgroundColor: COLORS.surfaceMuted,
  },
  rowCardBlock: {
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
  rowCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  rowWindow: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 7,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  roleBadge: {
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.textPrimary,
  },
  roleBadgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.3,
    color: COLORS.textPrimary,
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
  statusChoiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChoice: {
    flex: 1,
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChoiceActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryDark,
  },
  statusChoicePressed: {
    opacity: 0.75,
  },
  statusChoiceText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  statusChoiceTextActive: {
    color: COLORS.primaryDark,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 13,
    padding: 12,
    marginTop: 12,
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
  manageActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionItem: {
    flex: 1,
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
  pickerContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  editCard: {
    marginTop: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  qrBox: {
    marginTop: 14,
    alignSelf: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  addCard: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
  },
  addActions: {
    marginTop: 16,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonPressed: {
    opacity: 0.75,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 22,
    marginBottom: 11,
  },
  summaryRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryCount: {
    alignItems: 'center',
    minWidth: 52,
  },
  summaryCountValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.primaryDark,
  },
  summaryCountLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.textTertiary,
  },
  perEventBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  breakdownItem: {
    alignItems: 'center',
  },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  breakdownLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  refreshWide: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshWideText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
  refreshPressed: {
    backgroundColor: COLORS.primarySoft,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 30,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalList: {
    marginTop: 10,
    flexGrow: 0,
    maxHeight: 320,
  },
  modalRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 13,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalEmpty: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 18,
  },
});
