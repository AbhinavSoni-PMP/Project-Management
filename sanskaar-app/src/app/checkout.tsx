/* Checkout: log in → delivery details → order summary → pay with Razorpay
   (credit/debit cards, UPI, net banking, wallets, EMI) → order tracking */
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthForm } from "../components/AuthForm";
import { Field, fieldStyles } from "../components/Field";
import { Icon } from "../components/Icon";
import { RazorpayCheckout } from "../components/RazorpayCheckout";
import { Body, Button, Eyebrow, Heading } from "../components/ui";
import { ApiError, User } from "../lib/api";
import { useAuth } from "../lib/auth";
import { byId, config, inr } from "../lib/catalog";
import { inDays, useI18n } from "../lib/i18n";
import { createOrder, PaymentOrder, paymentsConfigured, RazorpaySuccess, verifyPayment } from "../lib/payments";
import { Address, useStore } from "../lib/store";
import { colors, fonts, gutter, radius } from "../lib/theme";
import { openWhatsApp } from "../lib/whatsapp";

const blank: Address = { name: "", phone: "", email: "", line1: "", line2: "", city: "", state: "", pincode: "" };

/** Same rules the API applies; returns the field and translation key of the first problem. */
function problem(a: Address): [keyof Address, string] | null {
  if (!a.name.trim()) return ["name", "err.name"];
  if (!/^[6-9]\d{9}$/.test(a.phone.replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""))) return ["phone", "err.phone"];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) return ["email", "err.email"];
  if (!a.line1.trim()) return ["line1", "err.street"];
  if (!a.city.trim()) return ["city", "err.city"];
  if (!a.state.trim()) return ["state", "err.state"];
  if (!/^\d{6}$/.test(a.pincode.trim())) return ["pincode", "err.pin"];
  return null;
}

export default function Checkout() {
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: gutter }} keyboardShouldPersistTaps="handled">
        <AuthForm intro={t("co.loginTitle")} />
      </ScrollView>
    );
  }
  // created after log in, so the form starts with the account's details
  return <CheckoutForm user={user} />;
}

function CheckoutForm({ user }: { user: User }) {
  const { t, ls, fmtDate } = useI18n();
  const { cart, cartTotal, address, saveAddress, clearCart } = useStore();
  // last used address, filled in from the account where empty
  const [a, setA] = useState<Address>(() => {
    const base = { ...blank, ...(address ?? {}) };
    return { ...base, name: base.name || user.name, phone: base.phone || user.phone, email: base.email || user.email };
  });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<"" | "order" | "verify">("");
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState("");
  // set when Razorpay reported success but our server couldn't confirm it — never let them pay twice
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const set = (k: keyof Address) => (v: string) => setA(s => ({ ...s, [k]: v }));
  const msg = (e: unknown) => (e instanceof ApiError && e.message === "network" ? t("err.network") : (e as Error).message);

  const lines = cart.map(it => ({ ...it, p: byId(it.id) })).filter(l => l.p);
  const shipping = cartTotal >= config.freeShippingAbove ? 0 : config.shippingFee;
  const total = cartTotal + shipping;
  const days = Math.max(10, ...lines.map(l => l.p!.deliveryDays ?? 10));
  const bad = tried ? problem(a) : null;

  const pay = async () => {
    setTried(true);
    setError("");
    if (problem(a)) return;
    saveAddress(a);
    setBusy("order");
    try {
      setOrder(await createOrder(cart, a));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy("");
    }
  };

  const paid = async (r: RazorpaySuccess) => {
    const o = order!;
    setOrder(null);
    setBusy("verify");
    try {
      await verifyPayment(r);
      clearCart();
      router.replace({ pathname: "/order/[receipt]", params: { receipt: o.receipt, new: "1" } });
    } catch {
      setUnconfirmed(r.razorpay_payment_id);
    } finally {
      setBusy("");
    }
  };

  if (!cart.length && !busy) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center", gap: 12, padding: gutter }]}>
        <Heading size={26} center>{t("bag.empty")}</Heading>
        <Button label={t("bag.explore")} variant="ghost" onPress={() => router.replace("/shop")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Eyebrow>{t("co.step1")}</Eyebrow>
        <Heading size={28} style={{ marginBottom: 18 }}>{t("co.delivery")}</Heading>
        <Field label={t("co.fullName")} value={a.name} onChange={set("name")} error={bad?.[0] === "name"} autoComplete="name" textContentType="name" />
        <Field label={t("co.mobile")} value={a.phone} onChange={set("phone")} error={bad?.[0] === "phone"} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <Field label={t("co.email")} value={a.email} onChange={set("email")} error={bad?.[0] === "email"} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label={t("co.address")} value={a.line1} onChange={set("line1")} error={bad?.[0] === "line1"} placeholder={t("co.addressHint")} autoComplete="street-address" textContentType="streetAddressLine1" />
        <Field label={t("co.landmark")} value={a.line2} onChange={set("line2")} textContentType="streetAddressLine2" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label={t("co.city")} value={a.city} onChange={set("city")} error={bad?.[0] === "city"} textContentType="addressCity" /></View>
          <View style={{ flex: 1 }}><Field label={t("co.pin")} value={a.pincode} onChange={set("pincode")} error={bad?.[0] === "pincode"} keyboardType="number-pad" maxLength={6} autoComplete="postal-code" textContentType="postalCode" /></View>
        </View>
        <Field label={t("co.state")} value={a.state} onChange={set("state")} error={bad?.[0] === "state"} textContentType="addressState" />

        <Eyebrow style={{ marginTop: 18 }}>{t("co.step2")}</Eyebrow>
        <Heading size={28} style={{ marginBottom: 12 }}>{t("co.summary")}</Heading>
        <View style={styles.card}>
          {lines.map(l => (
            <View key={`${l.id}-${l.size}`} style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineName}>{l.p!.name}</Text>
                <Text style={styles.lineMeta}>{t("bag.size", { size: l.size === "Custom" ? t("p.madeToMeasure") : l.size })} · × {l.qty}</Text>
              </View>
              <Text style={styles.linePrice}>{inr(l.p!.price * l.qty)}</Text>
            </View>
          ))}
          <View style={styles.sumRow}><Text style={styles.sumLabel}>{t("co.subtotal")}</Text><Text style={styles.sumVal}>{inr(cartTotal)}</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>{t("co.shipping")}</Text><Text style={styles.sumVal}>{shipping ? inr(shipping) : t("co.free")}</Text></View>
          <View style={[styles.sumRow, styles.totalRow]}><Text style={[styles.totalLabel, { letterSpacing: ls(1.5) }]}>{t("co.total").toUpperCase()}</Text><Text style={styles.total}>{inr(total)}</Text></View>
          <Text style={styles.tax}>{t("co.taxes")}</Text>
          <Text style={styles.eta}>{t("co.deliveryBy", { date: fmtDate(inDays(days)) })}</Text>
        </View>

        <View style={styles.methods}>
          <Icon name="shield" size={20} color={colors.gold} strokeWidth={1.4} />
          <Text style={styles.methodsText}>{t("co.secure")}</Text>
        </View>

        {unconfirmed ? (
          <View style={styles.unconfirmed}>
            <Text style={styles.unconfirmedText}>{t("co.unconfirmed", { ref: unconfirmed })}</Text>
            <Button label={t("co.sendRef")} icon="whatsapp" variant="whatsapp"
              onPress={() => openWhatsApp(`Namaste SANSKAAR! I paid for my order but it wasn't confirmed in the app. Payment reference: ${unconfirmed}`)} />
          </View>
        ) : <>
          {error ? <Text style={[fieldStyles.error, { marginBottom: 12 }]}>{error}</Text> : bad ? <Text style={[fieldStyles.error, { marginBottom: 12 }]}>{t(bad[1])}</Text> : null}
          {!paymentsConfigured && <Body dim style={{ textAlign: "center", marginBottom: 12 }}>{t("co.notConfigured")}</Body>}
          <Button
            label={busy === "verify" ? t("co.confirming") : t("co.pay", { amount: inr(total) })}
            icon="shield"
            onPress={pay}
            loading={!!busy}
            disabled={!paymentsConfigured}
          />
        </>}
        <Text style={styles.help} onPress={() => openWhatsApp("Namaste SANSKAAR! I have a question about my order.")}>{t("co.help")}</Text>
      </ScrollView>

      {order && (
        <RazorpayCheckout
          order={order}
          customer={a}
          onSuccess={paid}
          onDismiss={() => setOrder(null)}
          onFailure={reason => { setOrder(null); setError(t("co.failed", { reason })); }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  row: { flexDirection: "row", gap: 12 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 16, marginBottom: 18 },
  line: { flexDirection: "row", gap: 12, paddingBottom: 12, marginBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  lineName: { fontFamily: fonts.serifBold, fontSize: 17, color: colors.text },
  lineMeta: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.text3, marginTop: 2 },
  linePrice: { fontFamily: fonts.sansBold, fontSize: 13.5, color: colors.text },
  sumRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  sumLabel: { fontFamily: fonts.sans, fontSize: 13, color: colors.text2 },
  sumVal: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
  totalRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: colors.line, alignItems: "baseline" },
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  total: { fontFamily: fonts.serifBold, fontSize: 26, color: colors.text },
  tax: { fontFamily: fonts.sans, fontSize: 11, color: colors.text3, textAlign: "right", marginTop: 2 },
  eta: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.gold2, marginTop: 10 },
  methods: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  methodsText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.text2 },
  unconfirmed: { gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface },
  unconfirmedText: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 21, color: colors.text },
  help: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.gold2, textAlign: "center", marginTop: 18, textDecorationLine: "underline" }
});
