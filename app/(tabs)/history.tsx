import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { useRole } from '@/lib/useRole';

export default function HistoryScreen() {
  const { user } = useAuth();
  const { role, loading: roleLoading } = useRole();
  const activeRole = role ?? 'student';
  const isTeacher = activeRole === 'teacher';
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;

    if (isTeacher) {
      const events = await getTeacherEventAttendance(user.id);
      setTeacherEvents(events);
      setStudentRecords([]);
    } else {
      const records = await getAttendanceHistory(user.id);
      setStudentRecords(records);
      setTeacherEvents([]);
    }
  }, [user, isTeacher]);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    await reload();
    setLoading(false);
  }, [user, reload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      if (roleLoading) return;
      load();
    }, [roleLoading, load])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="History" />
        <View style={styles.loadingState}>
          <View style={styles.loadingIcon}>
            <Ionicons name="time-outline" size={25} color={COLORS.primaryDark} />
          </View>
          <Text style={styles.loadingTitle}>Loading records</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="History" />
      <View style={styles.content}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summarySubtitle}>
              {isTeacher
                ? `${teacherEvents.length} event${teacherEvents.length === 1 ? '' : 's'}`
                : `${studentRecords.length} scan${studentRecords.length === 1 ? '' : 's'}`}
            </Text>
          </View>
          <View style={[styles.roleBadge, isTeacher ? styles.teacherBadge : styles.studentBadge]}>
            <Text style={[styles.roleBadgeText, isTeacher ? styles.teacherBadgeText : styles.studentBadgeText]}>
              {isTeacher ? 'Teacher' : 'Student'}
            </Text>
          </View>
        </View>

        {isTeacher ? (
          teacherEvents.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No events yet"
              text="Create an event in the Teacher tab to start tracking attendance."
            />
          ) : (
            <FlatList
              data={teacherEvents}
              keyExtractor={(item) => item.eventId}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={COLORS.primaryDark}
                  colors={[COLORS.primary]}
                />
              }
              renderItem={({ item }) => {
                const expanded = expandedId === item.eventId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                    onPress={() => setExpandedId(expanded ? null : item.eventId)}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.eventIcon}>
                        <Ionicons name="qr-code-outline" size={19} color={COLORS.textPrimary} />
                      </View>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{item.attendeeCount}</Text>
                      </View>
                      <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={COLORS.textSecondary}
                        style={styles.chevron}
                      />
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.eventCode}>{item.eventCode}</Text>
                      {item.startTime ? <Text style={styles.metaDivider}>•</Text> : null}
                      {item.startTime ? <Text style={styles.eventMeta}>{formatDate(item.startTime)}</Text> : null}
                    </View>

                    {expanded ? (
                      item.attendees.length === 0 ? (
                        <View style={styles.emptyAttendees}>
                          <Ionicons name="people-outline" size={18} color={COLORS.textTertiary} />
                          <Text style={styles.noAttendees}>No attendees recorded yet.</Text>
                        </View>
                      ) : (
                        <View style={styles.attendeeList}>
                          {item.attendees.map((attendee) => (
                            <View
                              key={attendee.studentId + attendee.scannedAt}
                              style={styles.attendeeRow}
                            >
                              <View style={styles.attendeeInfo}>
                                <Text style={styles.attendeeName} numberOfLines={1}>
                                  {attendee.studentName ?? 'Unnamed attendee'}
                                </Text>
                              </View>
                              <Text style={styles.attendeeTime}>{formatTime(attendee.scannedAt)}</Text>
                            </View>
                          ))}
                        </View>
                      )
                    ) : (
                      <Text style={styles.expandHint}>
                        {item.attendeeCount === 0
                          ? 'No attendees yet'
                          : `View ${item.attendeeCount} attendee${item.attendeeCount === 1 ? '' : 's'}`}
                      </Text>
                    )}
                  </Pressable>
                );
              }}
            />
          )
        ) : studentRecords.length === 0 ? (
          <EmptyState
            icon="scan-outline"
            title="No attendance yet"
            text="Scan an event QR code to create your first record."
          />
        ) : (
          <FlatList
            data={studentRecords}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primaryDark}
                colors={[COLORS.primary]}
              />
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.eventIcon, styles.studentEventIcon]}>
                    <Ionicons name="checkmark-circle-outline" size={19} color={COLORS.textPrimary} />
                  </View>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {item.eventTitle || 'Attendance record'}
                  </Text>
                  <View style={styles.recordedBadge}>
                    <Text style={styles.recordedText}>RECORDED</Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  {item.eventId ? <Text style={styles.eventCode}>{item.eventId}</Text> : null}
                  {item.eventId ? <Text style={styles.metaDivider}>•</Text> : null}
                  <Text style={styles.eventMeta}>{formatDate(item.scannedAt)}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
};

function EmptyState({ icon, title, text }: EmptyStateProps) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={COLORS.primaryDark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 19,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingIcon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: COLORS.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCopy: {
    flex: 1,
  },
  summarySubtitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  teacherBadge: {
    backgroundColor: COLORS.sakura,
    borderColor: COLORS.tanDeep,
  },
  studentBadge: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primaryDark,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  teacherBadgeText: {
    color: COLORS.tanDeep,
  },
  studentBadgeText: {
    color: COLORS.primaryDark,
  },
  list: {
    paddingBottom: 28,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 12,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: COLORS.surfaceMuted,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: COLORS.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  studentEventIcon: {
    backgroundColor: COLORS.sky,
  },
  eventTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  countBadge: {
    minWidth: 28,
    height: 26,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: COLORS.matcha,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textOnPrimary,
  },
  recordedBadge: {
    borderRadius: 8,
    backgroundColor: COLORS.successSoft,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  recordedText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: COLORS.success,
  },
  chevron: {
    marginLeft: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 11,
  },
  eventCode: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: COLORS.primaryDark,
  },
  metaDivider: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginHorizontal: 7,
  },
  eventMeta: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  expandHint: {
    fontSize: 12,
    color: COLORS.textTertiary,
    marginTop: 13,
  },
  attendeeList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 13,
    paddingTop: 5,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  attendeeInfo: {
    flex: 1,
    marginRight: 12,
  },
  attendeeName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  attendeeTime: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  emptyAttendees: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 13,
    paddingTop: 13,
  },
  noAttendees: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    minHeight: 250,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 50,
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 23,
    backgroundColor: COLORS.sakura,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptyText: {
    maxWidth: 290,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    color: COLORS.textSecondary,
    marginTop: 7,
  },
});
