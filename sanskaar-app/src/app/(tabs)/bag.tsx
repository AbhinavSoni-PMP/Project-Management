import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import { ProductMedia } from "../../components/Media";
import { Body, Button, Eyebrow, Heading } from "../../components/ui";
import { byId, config, inr } from "../../lib/catalog";
import { useStore } from "../../lib/store";
import { colors, fonts, gutter, radius } from "../../lib/theme";

export default function Bag() {
  const { cart, setQty, cartTotal, cartCount } = useStore();
  const left = config.freeShippingAbove - cartTotal;

  if (!cart.length) {
    return (
      <SafeAreaView style={[styles.screen, styles.empty]}>
        <Icon name="bag" size={40} color={colors.gold} strokeWidth={1.2} />
        <Heading size={26} center>Your bag is empty</Heading>
        <Body>Let’s find something beautiful.</Body>
        <Button label="Explore the catalog" variant="ghost" onPress={() => router.navigate("/shop")} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 24 }}>
        <Eyebrow>{`${cartCount} ${cartCount === 1 ? "piece" : "pieces"}`}</Eyebrow>
        <Heading size={34} style={{ marginBottom: 18 }}>Your Bag</Heading>
        {cart.map((it, idx) => {
          const p = byId(it.id);
          if (!p) return null;
          return (
            <View key={`${it.id}-${it.size}`} style={styles.item}>
              <Pressable onPress={() => router.push(`/product/${p.id}`)}>
                <ProductMedia product={p} style={styles.thumb} />
              </Pressable>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.meta}>Size {it.size} · {p.colorName}</Text>
                <Text style={styles.price}>{inr(p.price * it.qty)}</Text>
                <View style={styles.qtyRow}>
                  <View style={styles.qty}>
                    <Pressable onPress={() => setQty(idx, it.qty - 1)} hitSlop={8} style={styles.qtyBtn} accessibilityLabel="Decrease quantity"><Icon name="minus" size={16} /></Pressable>
                    <Text style={styles.qtyNum}>{it.qty}</Text>
                    <Pressable onPress={() => setQty(idx, it.qty + 1)} hitSlop={8} style={styles.qtyBtn} accessibilityLabel="Increase quantity"><Icon name="plus" size={16} /></Pressable>
                  </View>
                  <Pressable onPress={() => setQty(idx, 0)} hitSlop={8}><Text style={styles.remove}>Remove</Text></Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.foot}>
        <Text style={styles.ship}>{left > 0 ? `Add ${inr(left)} more for free shipping` : "✦ You've unlocked free shipping"}</Text>
        <View style={styles.row}><Text style={styles.subLabel}>Subtotal</Text><Text style={styles.sub}>{inr(cartTotal)}</Text></View>
        <Button label="Proceed to checkout" icon="shield" onPress={() => router.push("/checkout")} />
        <Text style={styles.note}>Cards · UPI · Net banking · Wallets · EMI — secured by Razorpay</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, padding: gutter },
  item: { flexDirection: "row", gap: 14, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  thumb: { width: 92, height: 122, borderRadius: radius.sm },
  name: { fontFamily: fonts.serifBold, fontSize: 18, color: colors.text },
  meta: { fontFamily: fonts.sans, fontSize: 12, color: colors.text3 },
  price: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.text, marginTop: 4 },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  qty: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 999 },
  qtyBtn: { width: 36, height: 34, alignItems: "center", justifyContent: "center" },
  qtyNum: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text, minWidth: 22, textAlign: "center" },
  remove: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.text3, textDecorationLine: "underline" },
  foot: { padding: gutter, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.bg2, gap: 10 },
  ship: { fontFamily: fonts.sans, fontSize: 12, color: colors.gold, letterSpacing: 0.3 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  subLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text2 },
  sub: { fontFamily: fonts.serifBold, fontSize: 26, color: colors.text },
  note: { fontFamily: fonts.sans, fontSize: 11, color: colors.text3, textAlign: "center" }
});
