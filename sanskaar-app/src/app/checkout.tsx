/* Checkout: delivery details → order summary → pay with Razorpay
   (credit/debit cards, UPI, net banking, wallets, EMI) */
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, fieldStyles } from "../components/Field";
import { Icon } from "../components/Icon";
import { RazorpayCheckout } from "../components/RazorpayCheckout";
import { Body, Button, Eyebrow, Heading } from "../components/ui";
import { byId, config, inr } from "../lib/catalog";
import { createOrder, PaymentOrder, paymentsConfigured, RazorpaySuccess, verifyPayment } from "../lib/payments";
import { Address, useStore } from "../lib/store";
import { colors, fonts, gutter, radius } from "../lib/theme";
import { openWhatsApp } from "../lib/whatsapp";

const blank: Address = { name: "", phone: "", email: "", line1: "", line2: "", city: "", state: "", pincode: "" };
const METHODS = ["Credit & debit cards", "UPI", "Net banking", "Wallets", "EMI"];

/** Same rules the payments API applies; returns the first problem, if any. */
function problem(a: Address): [keyof Address, string] | null {
  if (!a.name.trim()) return ["name", "Please enter your full name."];
  if (!/^[6-9]\d{9}$/.test(a.phone.replace(/[\s-]/g, "").replace(/^(\+91|0)/, ""))) return ["phone", "Please enter a valid 10-digit mobile number."];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) return ["email", "Please enter a valid email address."];
  if (!a.line1.trim()) return ["line1", "Please enter your street address."];
  if (!a.city.trim()) return ["city", "Please enter your city."];
  if (!a.state.trim()) return ["state", "Please enter your state."];
  if (!/^\d{6}$/.test(a.pincode.trim())) return ["pincode", "Please enter a valid 6-digit PIN code."];
  return null;
}

export default function Checkout() {
  const { cart, cartTotal, address, saveAddress, clearCart } = useStore();
  const [a, setA] = useState<Address>(address ?? blank);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<"" | "order" | "verify">("");
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState("");
  // set when Razorpay reported success but our server couldn't confirm it — never let them pay twice
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const set = (k: keyof Address) => (v: string) => setA(s => ({ ...s, [k]: v }));

  const shipping = cartTotal >= config.freeShippingAbove ? 0 : config.shippingFee;
  const total = cartTotal + shipping;
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
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const paid = async (r: RazorpaySuccess) => {
    const o = order!;
    setOrder(null);
    setBusy("verify");
    try {
      const v = await verifyPayment(r);
      clearCart();
      router.replace({ pathname: "/order-success", params: { receipt: o.receipt, paymentId: v.paymentId, amount: String(o.amount / 100) } });
    } catch {
      setUnconfirmed(r.razorpay_payment_id);
    } finally {
      setBusy("");
    }
  };

  if (!cart.length && !busy) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center", gap: 12, padding: gutter }]}>
        <Heading size={26} center>Your bag is empty</Heading>
        <Button label="Explore the catalog" variant="ghost" onPress={() => router.replace("/shop")} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Eyebrow>Step 1 of 2</Eyebrow>
        <Heading size={28} style={{ marginBottom: 18 }}>Delivery details</Heading>
        <Field label="Full name" value={a.name} onChange={set("name")} error={bad?.[0] === "name"} autoComplete="name" textContentType="name" />
        <Field label="Mobile number" value={a.phone} onChange={set("phone")} error={bad?.[0] === "phone"} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="10-digit mobile" />
        <Field label="Email" value={a.email} onChange={set("email")} error={bad?.[0] === "email"} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label="Address" value={a.line1} onChange={set("line1")} error={bad?.[0] === "line1"} placeholder="House / flat, street" autoComplete="street-address" textContentType="streetAddressLine1" />
        <Field label="Landmark (optional)" value={a.line2} onChange={set("line2")} textContentType="streetAddressLine2" />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Field label="City" value={a.city} onChange={set("city")} error={bad?.[0] === "city"} textContentType="addressCity" /></View>
          <View style={{ flex: 1 }}><Field label="PIN code" value={a.pincode} onChange={set("pincode")} error={bad?.[0] === "pincode"} keyboardType="number-pad" maxLength={6} autoComplete="postal-code" textContentType="postalCode" /></View>
        </View>
        <Field label="State" value={a.state} onChange={set("state")} error={bad?.[0] === "state"} textContentType="addressState" />

        <Eyebrow style={{ marginTop: 18 }}>Step 2 of 2</Eyebrow>
        <Heading size={28} style={{ marginBottom: 12 }}>Order summary</Heading>
        <View style={styles.card}>
          {cart.map(it => {
            const p = byId(it.id);
            if (!p) return null;
            return (
              <View key={`${it.id}-${it.size}`} style={styles.line}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName}>{p.name}</Text>
                  <Text style={styles.lineMeta}>Size {it.size === "Custom" ? "made to measure" : it.size} · Qty {it.qty}</Text>
                </View>
                <Text style={styles.linePrice}>{inr(p.price * it.qty)}</Text>
              </View>
            );
          })}
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Subtotal</Text><Text style={styles.sumVal}>{inr(cartTotal)}</Text></View>
          <View style={styles.sumRow}><Text style={styles.sumLabel}>Shipping</Text><Text style={styles.sumVal}>{shipping ? inr(shipping) : "Free"}</Text></View>
          <View style={[styles.sumRow, styles.totalRow]}><Text style={styles.totalLabel}>Total</Text><Text style={styles.total}>{inr(total)}</Text></View>
          <Text style={styles.tax}>Inclusive of all taxes</Text>
        </View>

        <View style={styles.methods}>
          <Icon name="shield" size={20} color={colors.gold} strokeWidth={1.4} />
          <Text style={styles.methodsText}>Secure payment by Razorpay · {METHODS.join(" · ")}</Text>
        </View>

        {unconfirmed ? (
          <View style={styles.unconfirmed}>
            <Text style={styles.unconfirmedText}>
              Your payment went through (reference {unconfirmed}), but we couldn’t confirm the order automatically. Please don’t pay again — send us this reference and we’ll confirm your order right away.
            </Text>
            <Button label="Send reference on WhatsApp" icon="whatsapp" variant="whatsapp"
              onPress={() => openWhatsApp(`Namaste SANSKAAR! I paid for my order but it wasn't confirmed in the app. Payment reference: ${unconfirmed}`)} />
          </View>
        ) : <>
        {error ? <Text style={[fieldStyles.error, { marginBottom: 12 }]}>{error}</Text> : bad ? <Text style={[fieldStyles.error, { marginBottom: 12 }]}>{bad[1]}</Text> : null}
        {!paymentsConfigured && <Body dim style={{ textAlign: "center", marginBottom: 12 }}>Online payments aren’t switched on yet (EXPO_PUBLIC_API_URL is not set).</Body>}

        <Button
          label={busy === "verify" ? "Confirming payment…" : `Pay ${inr(total)} securely`}
          icon="shield"
          onPress={pay}
          loading={!!busy}
          disabled={!paymentsConfigured}
        />
        </>}
        <Text style={styles.help} onPress={() => openWhatsApp("Namaste SANSKAAR! I have a question about my order.")}>Questions about sizing or delivery? Chat with us</Text>
      </ScrollView>

      {order && (
        <RazorpayCheckout
          order={order}
          customer={a}
          onSuccess={paid}
          onDismiss={() => setOrder(null)}
          onFailure={reason => { setOrder(null); setError(`Payment didn’t go through: ${reason} Please try again or choose another method.`); }}
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
  totalLabel: { fontFamily: fonts.sansBold, fontSize: 13, letterSpacing: 1.5, color: colors.text },
  total: { fontFamily: fonts.serifBold, fontSize: 26, color: colors.text },
  tax: { fontFamily: fonts.sans, fontSize: 11, color: colors.text3, textAlign: "right", marginTop: 2 },
  methods: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 },
  methodsText: { flex: 1, fontFamily: fonts.sans, fontSize: 12, lineHeight: 18, color: colors.text2 },
  unconfirmed: { gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface },
  unconfirmedText: { fontFamily: fonts.sans, fontSize: 13.5, lineHeight: 21, color: colors.text },
  help: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.gold2, textAlign: "center", marginTop: 18, textDecorationLine: "underline" }
});
