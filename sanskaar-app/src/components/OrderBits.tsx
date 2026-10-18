/* Order status badge, list card and delivery timeline */
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Order, OrderStatus, STEPS } from "../lib/api";
import { inr } from "../lib/catalog";
import { useI18n } from "../lib/i18n";
import { colors, fonts, radius } from "../lib/theme";

const tone: Partial<Record<OrderStatus, { border: string; text: string }>> = {
  delivered: { border: "#4caf7d", text: "#8fe0b0" },
  cancelled: { border: "#d9677f", text: "#f0a5b4" }
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t, ls } = useI18n();
  const c = tone[status] ?? { border: colors.gold, text: colors.gold2 };
  return <Text style={[styles.badge, { borderColor: c.border, color: c.text, letterSpacing: ls(1.4) }]}>{t("status." + status).toUpperCase()}</Text>;
}

export function OrderCard({ order: o }: { order: Order }) {
  const { t, fmtDate } = useI18n();
  const n = o.items.reduce((s, i) => s + i.qty, 0);
  const open = !["delivered", "cancelled"].includes(o.status);
  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && { borderColor: colors.gold }]} onPress={() => router.push(`/order/${encodeURIComponent(o.receipt)}`)} accessibilityRole="link">
      <View style={styles.top}><Text style={styles.id}>{t("ord.order", { id: o.receipt })}</Text><StatusBadge status={o.status} /></View>
      <Text style={styles.items} numberOfLines={2}>{o.items.map(i => i.name).join(" · ")}</Text>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{t("ord.placedOn", { date: fmtDate(o.createdAt) })} · {n === 1 ? t("ord.item") : t("ord.items", { n })}</Text>
        <Text style={styles.total}>{inr(o.total)}</Text>
      </View>
      {open && o.expectedDelivery ? <Text style={styles.eta}>{t("ord.expected")}: <Text style={{ color: colors.text, fontFamily: fonts.sansBold }}>{fmtDate(o.expectedDelivery)}</Text></Text> : null}
    </Pressable>
  );
}

export function Timeline({ order: o }: { order: Order }) {
  const { t, fmtDate } = useI18n();
  const notes = (s: OrderStatus) => o.history.filter(h => h.status === s && h.note).map((h, i) => <Text key={i} style={styles.note}>{h.note}</Text>);
  if (o.status === "cancelled") {
    return <View style={styles.step}><View style={[styles.dot, { backgroundColor: "#d9677f", borderColor: "#d9677f" }]} /><View style={{ flex: 1 }}><Text style={styles.stepText}>{t("status.cancelled")}</Text>{notes("cancelled")}</View></View>;
  }
  const at = STEPS.indexOf(o.status);
  return (
    <View>
      {STEPS.map((s, i) => {
        const done = i <= at;
        const h = [...o.history].reverse().find(x => x.status === s);
        return (
          <View key={s} style={styles.step} accessibilityState={{ checked: done }}>
            <View style={styles.rail}>
              <View style={[styles.dot, done && styles.dotDone, i === at && styles.dotNow]} />
              {i < STEPS.length - 1 && <View style={[styles.line, i < at && { backgroundColor: colors.gold }]} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 18 }}>
              <Text style={[styles.stepText, !done && { color: colors.text3 }]}>{t("status." + s)}</Text>
              {h ? <Text style={styles.when}>{fmtDate(h.at)}</Text> : null}
              {notes(s)}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { fontFamily: fonts.sansBold, fontSize: 9.5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, overflow: "hidden" },
  card: { padding: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg2, marginBottom: 12, gap: 6 },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  id: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.text },
  items: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.text },
  meta: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  metaText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, color: colors.text3 },
  total: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.text },
  eta: { fontFamily: fonts.sans, fontSize: 12.5, color: colors.text2 },
  step: { flexDirection: "row", gap: 14 },
  rail: { alignItems: "center", width: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.bg, marginTop: 3 },
  dotDone: { backgroundColor: colors.gold, borderColor: colors.gold },
  dotNow: { shadowColor: colors.gold, shadowOpacity: 0.8, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  line: { flex: 1, width: 2, backgroundColor: colors.lineSoft, marginTop: 2 },
  stepText: { fontFamily: fonts.sansMedium, fontSize: 14.5, color: colors.text },
  when: { fontFamily: fonts.sans, fontSize: 12, color: colors.text3, marginTop: 2 },
  note: { fontFamily: fonts.sans, fontSize: 13, color: colors.text2, marginTop: 4 }
});
