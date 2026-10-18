import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon } from "../components/Icon";
import { Body, Button, Divider, Em, Eyebrow, Heading } from "../components/ui";
import { inr } from "../lib/catalog";
import { colors, fonts, gutter, radius } from "../lib/theme";

export default function OrderSuccess() {
  const { receipt, paymentId, amount } = useLocalSearchParams<{ receipt: string; paymentId: string; amount: string }>();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.wrap}>
      <View style={styles.badge}><Icon name="shield" size={34} color={colors.bg} strokeWidth={1.8} /></View>
      <Eyebrow>Payment successful</Eyebrow>
      <Heading size={34} center>Thank you — your order is <Em>confirmed</Em></Heading>
      <Divider />
      <View style={styles.card}>
        <Row k="Order" v={receipt} />
        <Row k="Amount paid" v={amount ? inr(Number(amount)) : "—"} />
        <Row k="Payment ID" v={paymentId} />
      </View>
      <Body style={{ textAlign: "center", marginBottom: 26 }}>
        Our atelier will call you to confirm sizing and delivery. Keep your order number handy for any questions.
      </Body>
      <Button label="Continue shopping" onPress={() => router.replace("/")} style={{ alignSelf: "stretch" }} />
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k.toUpperCase()}</Text>
      <Text style={styles.v} selectable>{v || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: gutter, paddingTop: 48, alignItems: "center" },
  badge: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  card: { alignSelf: "stretch", borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 16, gap: 12, marginBottom: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  k: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 1.8, color: colors.text3 },
  v: { flexShrink: 1, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text, textAlign: "right" }
});
