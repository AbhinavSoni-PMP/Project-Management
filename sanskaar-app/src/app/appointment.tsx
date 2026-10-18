/* Book a private consultation — details are sent to the atelier on WhatsApp, like the website */
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, fieldStyles } from "../components/Field";
import { Body, Button, Chip, Divider, Eyebrow, Heading, rich } from "../components/ui";
import { useI18n } from "../lib/i18n";
import { colors, fonts, gutter } from "../lib/theme";
import { openWhatsApp } from "../lib/whatsapp";

// [value sent to the store, translation key]
const FOR = [["Groom", "appt.forGroom"], ["Bride", "appt.forBride"], ["Family", "appt.forFamily"], ["Festive", "appt.forFestive"]];
const MODE = [["In-store (Jaipur)", "appt.inStore"], ["Video call", "appt.video"]];

export default function Appointment() {
  const { t, ls } = useI18n();
  const [f, setF] = useState({ name: "", phone: "", for: "Groom", mode: "In-store (Jaipur)", date: "", wedding: "", notes: "" });
  const [tried, setTried] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(s => ({ ...s, [k]: v }));
  const valid = f.name.trim() && f.phone.trim();

  const send = () => {
    setTried(true);
    if (!valid) return;
    openWhatsApp(`Namaste SANSKAAR! I'd like to book a consultation.\nName: ${f.name}\nPhone: ${f.phone}\nShopping for: ${f.for}\nMode: ${f.mode}\nPreferred date: ${f.date || "-"}\nWedding date: ${f.wedding || "-"}\nNotes: ${f.notes || "-"}`);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <Divider style={{ marginTop: 0 }} />
        <Eyebrow style={{ textAlign: "center" }}>{t("appt.eyebrow")}</Eyebrow>
        <Heading size={30} center>{rich(t("appt.title"))}</Heading>
        <Body style={{ textAlign: "center", marginTop: 8, marginBottom: 22 }}>{t("appt.intro")}</Body>

        <Field label={t("appt.name")} value={f.name} onChange={set("name")} error={tried && !f.name.trim()} autoComplete="name" />
        <Field label={t("appt.phone")} value={f.phone} onChange={set("phone")} error={tried && !f.phone.trim()} keyboardType="phone-pad" autoComplete="tel" />

        <Text style={[fieldStyles.label, { letterSpacing: ls(2) }]}>{t("appt.for").toUpperCase()}</Text>
        <View style={styles.chips}>{FOR.map(([v, k]) => <Chip key={v} label={t(k)} active={f.for === v} onPress={() => set("for")(v)} />)}</View>
        <Text style={[fieldStyles.label, { letterSpacing: ls(2) }]}>{t("appt.mode").toUpperCase()}</Text>
        <View style={styles.chips}>{MODE.map(([v, k]) => <Chip key={v} label={t(k)} active={f.mode === v} onPress={() => set("mode")(v)} />)}</View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label={t("appt.date")} value={f.date} onChange={set("date")} placeholder={t("appt.datePh")} /></View>
          <View style={{ flex: 1 }}><Field label={t("appt.wedding")} value={f.wedding} onChange={set("wedding")} placeholder={t("appt.weddingPh")} /></View>
        </View>
        <Field label={t("appt.notes")} value={f.notes} onChange={set("notes")} multiline />

        <Button label={t("appt.send")} icon="whatsapp" variant="whatsapp" onPress={send} style={{ marginTop: 8 }} />
        {tried && !valid ? <Text style={styles.err}>{t("appt.error")}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  err: { fontFamily: fonts.sans, fontSize: 12, color: "#e8a9b4", textAlign: "center", marginTop: 10 }
});
