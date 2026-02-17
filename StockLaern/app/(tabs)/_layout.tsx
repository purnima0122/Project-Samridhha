import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from "react";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { DataServerProvider } from "../context/DataServerContext";

type TabIconProps = {
  name: ComponentProps<typeof Feather>["name"];
  color: string;
  size: number;
  focused: boolean;
};

function TabIcon({ name, color, size, focused }: TabIconProps) {
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: focused ? "#E0ECFF" : "#F1F5F9",
      }}
    >
      <Feather name={name} color={color} size={size} />
    </View>
  );
}

function TabLayoutInner() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0B3B78",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarLabelStyle: { fontSize: 11, marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="home" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="market"
        options={{
          title: "Market",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="bar-chart-2" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="trending-up" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="learn"
        options={{
          title: "Learn",
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name="book-open" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
      <Tabs.Screen name="news" options={{ href: null }} />
      <Tabs.Screen name="alert-settings" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="admin" options={{ href: null }} />
      <Tabs.Screen name="complete-profile" options={{ href: null }} />
      <Tabs.Screen name="login" options={{ href: null }} />
      <Tabs.Screen name="signup" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <DataServerProvider>
      <TabLayoutInner />
    </DataServerProvider>
  );
}
