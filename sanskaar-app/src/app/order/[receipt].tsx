/* Order tracking: expected delivery, status timeline, courier details, items and address */
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBadge, Timeline } from "../../components/OrderBits";
import { Body, Button, Eyebrow, Heading, rich } from "../../components/ui";
import { api, Order } from "../../lib/api";
import { inr } from "../../lib/catalog";
import { useI18n } from "../../lib/i18n";
import { colors, fonts, gutter, radius } from "../../lib/theme";
import { openWhatsApp } from "../../lib/whatsapp";

export default function OrderScreen() {
  const { receipt, new: justPaid } = useLocalSearchParams<{ receipt: string; new?: string }>();
  const { t, fmtDate, ls } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setOrder((await api<{ order: Order }>(`/api/orders/${encodeURIComponent(receipt)}`)).order);
    } catch (e) {
      setError((e as Error).message === "network" ? t("err.network") : (e as Error).message);
    }
  }, [receipt, t]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!order) {
    return (
      <View style={[styles.screen, styles.center]}>
        {error ? <Body style={{ color: "#f0a5b4", textAlign: "center" }}>{error}</Body> : <ActivityIndicator color={colors.gold} />}
      </View>
    );
  }
  const o = order, c = o.customer;
  const delivered = o.history.find(h => h.status === "delivered");
  const label = (k: string) => <Text style={[styles.label, { letterSpacing: ls(1.6) }]}>{t(k).toUpperCase()}</Text>;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: gutter, paddingBottom: 48, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.gold} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      {justPaid === "1" && (
        <View style={[styles.card, { borderColor: colors.gold }]}>
          <Eyebrow>{t("ok.eyebrow")}</Eyebrow>
          <Heading size={26}>{rich(t("ok.title"))}</Heading>
          <Body style={{ marginTop: 6 }}>{t("ok.text")}</Body>
        </View>
      )}

      <View style={styles.card}>
        <View style={styles.top}><Heading size={24} style={{ flexShrink: 1 }}>{t("ord.order", { id: o.receipt })}</Heading><StatusBadge status={o.status} /></View>
        <Body dim>{t("ord.placedOn", { date: fmtDate(o.createdAt) })}</Body>
        {o.status !== "cancelled" && (
          <View style={{ marginTop: 16 }}>
            {label(o.status === "delivered" ? "ord.deliveredOn" : "ord.expected")}
            <Text style={styles.eta}>{fmtDate(o.status === "delivered" ? delivered?.at : o.expectedDelivery)}</Text>
          </View>
        )}
        <Heading size={20} style={{ color: colors.gold2, marginTop: 18, marginBottom: 12 }}>{t("ord.status")}</Heading>
        <Timeline order={o} />
        {o.courier || o.trackingNo ? (
          <View style={styles.tracking}>
            <View style={{ flexDirection: "row", gap: 26 }}>
              <View>{label("ord.courier")}<Text style={styles.value}>{o.courier || "—"}</Text></View>
              <View style={{ flex: 1 }}>{label("ord.tracking")}<Text style={styles.value} selectable>{o.trackingNo || "—"}</Text></View>
            </View>
            {o.trackingUrl ? <Button label={t("ord.trackCourier")} variant="ghost" icon="truck" onPress={() => Linking.openURL(o.trackingUrl)} style={{ marginTop: 14 }} /> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Heading size={20} style={{ color: colors.gold2, marginBottom: 6 }}>{t("co.summary")}</Heading>
        {o.items.map((i, k) => (
          <View key={k} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{i.name}</Text>
              <Text style={styles.small}>{t("bag.size", { size: i.size === "Custom" ? t("p.madeToMeasure") : i.size })} · × {i.qty}</Text>
            </View>
            <Text style={styles.value}>{inr(i.price * i.qty)}</Text>
          </View>
        ))}
        <View style={styles.line}><Text style={styles.small}>{t("co.shipping")}</Text><Text style={styles.value}>{o.shipping ? inr(o.shipping) : t("co.free")}</Text></View>
        <View style={[styles.line, { borderBottomWidth: 0 }]}><Text style={styles.value}>{t("co.total")}</Text><Text style={styles.total}>{inr(o.total)}</Text></View>
        <Body dim>{t("ord.paid", { amount: inr(o.total) })} · {o.paymentId}</Body>
      </View>

      <View style={styles.card}>
        <Heading size={20} style={{ color: colors.gold2, marginBottom: 6 }}>{t("ord.address")}</Heading>
        <Body>{c.name}{"\n"}{c.line1}{c.line2 ? "\n" + c.line2 : ""}{"\n"}{c.city}, {c.state} {c.pincode}{"\n"}{c.phone}</Body>
        <Button label={t("ord.help")} icon="whatsapp" variant="whatsapp" style={{ marginTop: 16 }}
          onPress={() => openWhatsApp(`Namaste SANSKAAR! I need help with order ${o.receipt}.`)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", padding: gutter },
  card: { padding: 20, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg2 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 4 },
  label: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.text3, marginBottom: 4 },
  eta: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.text },
  tracking: { marginTop: 8, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  value: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.text },
  line: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  itemName: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.text },
  small: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.text3 },
  total: { fontFamily: fonts.serifBold, fontSize: 26, color: colors.text }
});
