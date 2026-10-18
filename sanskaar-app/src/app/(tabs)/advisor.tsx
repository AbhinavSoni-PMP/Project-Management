/* The Bridal Style Advisor — three questions, three curated looks (same scoring as the website) */
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductGrid } from "../../components/ProductGrid";
import { Body, Button, Em, Eyebrow, Heading } from "../../components/ui";
import { colorTable, products } from "../../lib/catalog";
import { colors, fonts, gutter, radius } from "../../lib/theme";

const palettes: Record<string, { label: string; hint: string; colors: string[] }> = {
  classic: { label: "Classic Reds & Maroons", hint: "Timeless bridal tradition", colors: ["red", "maroon", "wine"] },
  pastel: { label: "Soft Pastels", hint: "Blush, mint, lilac & ivory", colors: ["blush", "mint", "lilac", "peach", "ivory", "beige"] },
  jewel: { label: "Jewel Tones", hint: "Emerald, sapphire & peacock", colors: ["green", "teal", "blue", "navy", "black"] },
  sunshine: { label: "Sunshine & Rani", hint: "Haldi yellow, kesariya & pink", colors: ["yellow", "orange", "gold", "pink"] }
};
type Opt = [key: string, label: string, hint: string, swatches?: string[]];
const steps: { key: "who" | "occ" | "pal"; q: string; opts: Opt[] }[] = [
  { key: "who", q: "Who are we dressing?", opts: [
    ["women", "The Bride", "Lehengas, sarees & trousseau"], ["men", "The Groom", "Sherwanis & bandhgalas"],
    ["any", "The Family", "Parents, siblings & friends"], ["festive", "A Festive Guest", "Diwali, Eid, Teej & more"]] },
  { key: "occ", q: "Which ceremony are you dressing for?", opts: [
    ["wedding", "The Sacred Vows", "Main wedding ceremony / Pheras"], ["reception", "The Grand Soirée", "Reception dinner / Formal after-party"],
    ["sangeet", "The Rhythmic Celebration", "Sangeet night / Cocktail / Dance gala"], ["mehendi", "The Henna Festival", "Mehendi / Haldi / Pre-wedding lunch"]] },
  { key: "pal", q: "Which palette speaks to you?", opts: Object.entries(palettes).map(([k, v]) => [k, v.label, v.hint, v.colors]) }
];

function pick(ans: Record<string, string>) {
  const pal = palettes[ans.pal].colors;
  const occ = ans.who === "festive" ? ["festive", ans.occ] : ans.occ === "mehendi" ? ["mehendi", "haldi"] : [ans.occ];
  return products
    .filter(p => (ans.who === "women" || ans.who === "men" ? p.gender === ans.who : true))
    .map(p => ({ p, s: (p.occasions.some(o => occ.includes(o)) ? 3 : 0) + (pal.includes(p.color) ? 2 : 0) + (p.tag === "bestseller" ? 0.5 : 0) }))
    .sort((a, b) => b.s - a.s).slice(0, 4).map(x => x.p);
}

export default function Advisor() {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<string, string>>({});
  const done = i >= steps.length;
  const who = { women: "bride", men: "groom", any: "family", festive: "festive guest" }[ans.who] ?? "";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 48 }}>
        <Eyebrow>Personal styling</Eyebrow>
        <Heading size={34}>The Bridal <Em>Style Advisor</Em></Heading>
        <Body style={{ marginTop: 8, marginBottom: 24 }}>Answer three questions and our couturiers’ picks will appear, curated for your ceremony and palette.</Body>

        <View style={styles.progress}><View style={[styles.bar, { width: `${(Math.min(i + 1, steps.length) / steps.length) * 100}%` }]} /></View>

        {!done ? (
          <View>
            <Text style={styles.qNum}>QUESTION {i + 1} OF {steps.length}</Text>
            <Heading size={26} style={{ marginBottom: 18 }}>{steps[i].q}</Heading>
            <View style={{ gap: 10 }}>
              {steps[i].opts.map(([k, l, h, sw]) => (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.opt, ans[steps[i].key] === k && styles.optOn, pressed && { opacity: 0.8 }]}
                  onPress={() => { setAns(a => ({ ...a, [steps[i].key]: k })); setI(i + 1); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.optLabel}>{l}</Text>
                    <Text style={styles.optHint}>{h}</Text>
                  </View>
                  {sw && <View style={{ flexDirection: "row", gap: 4 }}>{sw.slice(0, 4).map(c => <View key={c} style={[styles.sw, { backgroundColor: colorTable[c].hex }]} />)}</View>}
                </Pressable>
              ))}
            </View>
            {i > 0 && <Pressable onPress={() => setI(i - 1)} style={{ marginTop: 18 }}><Text style={styles.back}>← Back</Text></Pressable>}
          </View>
        ) : (
          <View>
            <Text style={styles.qNum}>YOUR CURATED EDIT</Text>
            <Heading size={26} style={{ marginBottom: 20 }}>Looks for the {who}, in {palettes[ans.pal].label.toLowerCase()}</Heading>
            <ProductGrid items={pick(ans)} />
            <Button label="Book a consultation" icon="calendar" style={{ marginTop: 28 }} onPress={() => router.push("/appointment")} />
            <Button label="Start again" variant="outline" style={{ marginTop: 10 }} onPress={() => { setAns({}); setI(0); }} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  progress: { height: 2, backgroundColor: colors.lineSoft, marginBottom: 26, borderRadius: 2 },
  bar: { height: 2, backgroundColor: colors.gold, borderRadius: 2 },
  qNum: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 2.4, color: colors.text3, marginBottom: 8 },
  opt: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  optOn: { borderColor: colors.gold },
  optLabel: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.text },
  optHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.text3, marginTop: 2 },
  sw: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  back: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.gold2 }
});
