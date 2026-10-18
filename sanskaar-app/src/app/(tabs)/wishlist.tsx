import { router } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import { ProductGrid } from "../../components/ProductGrid";
import { Body, Button, Eyebrow, Heading } from "../../components/ui";
import { allProducts, Product } from "../../lib/catalog";
import { useI18n } from "../../lib/i18n";
import { useStore } from "../../lib/store";
import { colors, gutter } from "../../lib/theme";

export default function Wishlist() {
  const { wish } = useStore();
  const { t } = useI18n();
  const items = wish.map(id => allProducts.find(p => p.id === id)).filter(Boolean) as Product[];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 48, flexGrow: 1 }}>
        <Eyebrow>{t("wl.eyebrow")}</Eyebrow>
        <Heading size={34} style={{ marginBottom: 22 }}>{t("wl.title")}</Heading>
        {items.length ? <ProductGrid items={items} /> : (
          <View style={styles.empty}>
            <Icon name="heart" size={40} color={colors.gold} strokeWidth={1.2} />
            <Heading size={24} center>{t("wl.empty")}</Heading>
            <Body style={{ textAlign: "center" }}>{t("wl.emptyText")}</Body>
            <Button label={t("bag.explore")} variant="ghost" onPress={() => router.navigate("/shop")} />
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
