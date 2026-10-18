/* Book a private consultation — details are sent to the atelier on WhatsApp, like the website */
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Field, fieldStyles } from "../components/Field";
import { Body, Button, Chip, Divider, Em, Eyebrow, Heading } from "../components/ui";
import { colors, fonts, gutter } from "../lib/theme";
import { openWhatsApp } from "../lib/whatsapp";

const FOR = ["Groom", "Bride", "Family", "Festive"];
const MODE = ["In-store (Jaipur)", "Video call"];

export default function Appointment() {
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
        <Eyebrow style={{ textAlign: "center" }}>Private consultation</Eyebrow>
        <Heading size={30} center>Book your <Em>bespoke</Em> session</Heading>
        <Body style={{ textAlign: "center", marginTop: 8, marginBottom: 22 }}>Meet our couturiers at the Jaipur atelier or over a video call. We’ll confirm on WhatsApp.</Body>

        <Field label="Name" value={f.name} onChange={set("name")} error={tried && !f.name.trim()} autoComplete="name" />
        <Field label="Phone" value={f.phone} onChange={set("phone")} error={tried && !f.phone.trim()} keyboardType="phone-pad" autoComplete="tel" />

        <Text style={fieldStyles.label}>SHOPPING FOR</Text>
        <View style={styles.chips}>{FOR.map(o => <Chip key={o} label={o} active={f.for === o} onPress={() => set("for")(o)} />)}</View>
        <Text style={fieldStyles.label}>MODE</Text>
        <View style={styles.chips}>{MODE.map(o => <Chip key={o} label={o} active={f.mode === o} onPress={() => set("mode")(o)} />)}</View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1 }}><Field label="Preferred date" value={f.date} onChange={set("date")} placeholder="e.g. 12 Nov" /></View>
          <View style={{ flex: 1 }}><Field label="Wedding date" value={f.wedding} onChange={set("wedding")} placeholder="e.g. Feb 2027" /></View>
        </View>
        <Field label="Anything we should know?" value={f.notes} onChange={set("notes")} multiline />

        <Button label="Send on WhatsApp" icon="whatsapp" variant="whatsapp" onPress={send} style={{ marginTop: 8 }} />
        {tried && !valid ? <Text style={styles.err}>Please add your name and phone number.</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  err: { fontFamily: fonts.sans, fontSize: 12, color: "#e8a9b4", textAlign: "center", marginTop: 10 }
});
