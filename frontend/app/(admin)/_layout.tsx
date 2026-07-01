import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.gold,
      tabBarInactiveTintColor: colors.textDim,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingBottom: 8, paddingTop: 8 },
    }}>
      <Tabs.Screen name="index" options={{ title: "Requests", tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size} color={color} /> }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} /> }} />
      <Tabs.Screen name="analytics" options={{ title: "Analytics", tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: "Admin", tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
    </Tabs>
  );
}
