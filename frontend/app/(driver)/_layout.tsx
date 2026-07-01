import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";

export default function DriverLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.apple,
      tabBarInactiveTintColor: colors.textDim,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 78, paddingBottom: 20, paddingTop: 8 },
    }}>
      <Tabs.Screen name="index" options={{ title: "Available", tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} /> }} />
      <Tabs.Screen name="mine" options={{ title: "My Jobs", tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />
    </Tabs>
  );
}
