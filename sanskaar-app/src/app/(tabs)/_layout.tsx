import { Tabs } from "expo-router";
import { ColorValue } from "react-native";
import { Icon, IconName } from "../../components/Icon";
import { useStore } from "../../lib/store";
import { colors, fonts } from "../../lib/theme";

const icon = (name: IconName) => function TabIcon({ color }: { color: ColorValue }) {
  return <Icon name={name} color={String(color)} />;
};

export default function TabsLayout() {
  const { cartCount, wish } = useStore();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold2,
        tabBarInactiveTintColor: colors.text3,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 10.5, lineHeight: 15, letterSpacing: 0.4 },
        tabBarBadgeStyle: { backgroundColor: colors.gold, color: colors.bg, fontFamily: fonts.sansBold, fontSize: 10 }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="shop" options={{ title: "Shop", tabBarIcon: icon("search") }} />
      <Tabs.Screen name="advisor" options={{ title: "Stylist", tabBarIcon: icon("sparkle") }} />
      <Tabs.Screen name="wishlist" options={{ title: "Wishlist", tabBarIcon: icon("heart"), tabBarBadge: wish.length || undefined }} />
      <Tabs.Screen name="bag" options={{ title: "Bag", tabBarIcon: icon("bag"), tabBarBadge: cartCount || undefined }} />
    </Tabs>
  );
}
