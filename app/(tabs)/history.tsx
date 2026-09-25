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
  const [studentRecords, setStudentRecords] = useState<AttendanceRecord[]>([]);
  const [teacherEvents, setTeacherEvents] = useState<TeacherEventAttendance[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;

    if (activeRole === 'teacher') {
      const events = await getTeacherEventAttendance(user.id);
      setTeacherEvents(events);
      setStudentRecords([]);
    } else {
      const records = await getAttendanceHistory(user.id);
      setStudentRecords(records);
      setTeacherEvents([]);
    }
  }, [user, activeRole]);

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
        <Text style={styles.title}>Attendance history</Text>
        <Text style={styles.subtitle}>Loading records...</Text>
      </View>
    );
  }

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Attendance history</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>Teacher</Text>
          </View>
        </View>
        {teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>
            No events created yet. Create one in the Teacher tab.
          </Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => {
              const expanded = expandedId === item.eventId;
              return (
                <Pressable
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() =>
                    setExpandedId(expanded ? null : item.eventId)
                  }
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>
                        {item.attendeeCount}
                      </Text>
                    </View>
                    <Ionicons
                      name={expanded ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color={COLORS.textSecondary}
                      style={styles.chevron}
                    />
                  </View>
                  <Text style={styles.eventMeta}>{item.eventCode}</Text>
                  {item.startTime && (
                    <Text style={styles.eventMeta}>
                      {formatDate(item.startTime)}
                    </Text>
                  )}

                  {!expanded ? (
                    <Text style={styles.noAttendees}>
                      {item.attendeeCount === 0
                        ? 'No students scanned for this event yet.'
                        : `Tap to view ${item.attendeeCount} attendee${
                            item.attendeeCount === 1 ? '' : 's'
                          }`}
                    </Text>
                  ) : item.attendees.length === 0 ? (
                    <Text style={styles.noAttendees}>
                      No students scanned for this event yet.
                    </Text>
                  ) : (
                    <View style={styles.attendeeList}>
                      {item.attendees.map((a) => (
                        <View
                          key={a.studentId + a.scannedAt}
                          style={styles.attendeeRow}
                        >
                          <View style={styles.attendeeInfo}>
                            <Text style={styles.attendeeId}>
                              {a.studentName ?? shortId(a.studentId)}
                            </Text>
                            {a.studentName && (
                              <Text style={styles.attendeeIdFallback}>
                                {'\u2026' + shortId(a.studentId)}
                              </Text>
                            )}
                          </View>
                          <Text style={styles.attendeeTime}>
                            {formatDate(a.scannedAt)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Attendance history</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>Student</Text>
        </View>
      </View>
      {studentRecords.length === 0 ? (
        <Text style={styles.subtitle}>
          No records yet. Scan a QR code to register your attendance.
        </Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.eventTitle}>{item.eventTitle}</Text>
              <Text style={styles.eventMeta}>{item.eventId}</Text>
              <Text style={styles.eventMeta}>{formatDate(item.scannedAt)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

function shortId(id: string) {
  return id ? `…${id.slice(-8)}` : 'unknown';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: COLORS.tan,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.tanDeep,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  cardPressed: {
    backgroundColor: COLORS.surface,
  },
  chevron: {
    marginLeft: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  eventMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  noAttendees: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: 10,
  },
  attendeeList: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  attendeeInfo: {
    flex: 1,
    marginRight: 10,
  },
  attendeeId: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  attendeeIdFallback: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  attendeeTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});