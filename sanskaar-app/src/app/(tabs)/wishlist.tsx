import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import { ProductGrid } from "../../components/ProductGrid";
import { Body, Button, Eyebrow, Heading } from "../../components/ui";
import { byId, Product } from "../../lib/catalog";
import { useStore } from "../../lib/store";
import { colors, gutter } from "../../lib/theme";

export default function Wishlist() {
  const { wish } = useStore();
  const items = wish.map(byId).filter(Boolean) as Product[];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 48, flexGrow: 1 }}>
        <Eyebrow>Saved for later</Eyebrow>
        <Heading size={34} style={{ marginBottom: 22 }}>Your Wishlist</Heading>
        {items.length ? <ProductGrid items={items} /> : (
          <View style={styles.empty}>
            <Icon name="heart" size={40} color={colors.gold} strokeWidth={1.2} />
            <Heading size={24} center>Nothing saved yet</Heading>
            <Body style={{ textAlign: "center" }}>Tap the heart on any piece to keep it here.</Body>
            <Button label="Explore the catalog" variant="ghost" onPress={() => router.navigate("/shop")} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingBottom: 60 }
});
