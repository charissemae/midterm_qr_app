import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { COLORS } from '@/constants/colors';

type TabIconProps = {
  name: keyof typeof Ionicons.glyphMap;
  outline: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
};

function TabIcon({ name, outline, color, focused }: TabIconProps) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={focused ? name : outline} size={21} color={color} />
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primaryDark,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" outline="home-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="scan" outline="scan-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="time" outline="time-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Teacher',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="school" outline="school-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" outline="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 76,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    elevation: 10,
    shadowColor: COLORS.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
  },
  tabItem: {
    borderRadius: 16,
    marginHorizontal: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  iconWrap: {
    width: 42,
    height: 30,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: COLORS.primarySoft,
  },
});
