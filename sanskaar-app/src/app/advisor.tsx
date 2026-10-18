/* Style advisor — three questions, curated looks (same scoring as the website) */
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ProductGrid } from "../components/ProductGrid";
import { Body, Button, Eyebrow, Heading, rich } from "../components/ui";
import { colorTable, products } from "../lib/catalog";
import { useI18n } from "../lib/i18n";
import { colors, fonts, gutter, radius } from "../lib/theme";

const palettes: Record<string, string[]> = {
  classic: ["red", "maroon", "wine"],
  pastel: ["blush", "mint", "lilac", "peach", "ivory", "beige"],
  jewel: ["green", "teal", "blue", "navy", "black"],
  sunshine: ["yellow", "orange", "gold", "pink"]
};
const steps: { key: "who" | "occ" | "pal"; q: string; opts: string[] }[] = [
  { key: "who", q: "adv.q1", opts: ["women", "men", "any", "festive"] },
  { key: "occ", q: "adv.q2", opts: ["wedding", "reception", "sangeet", "mehendi"] },
  { key: "pal", q: "adv.q3", opts: Object.keys(palettes) }
];
const prefix = { who: "adv.who.", occ: "adv.occ.", pal: "adv.pal." };

function pick(ans: Record<string, string>) {
  const pal = palettes[ans.pal];
  const occ = ans.who === "festive" ? ["festive", ans.occ] : ans.occ === "mehendi" ? ["mehendi", "haldi"] : [ans.occ];
  return products
    .filter(p => (ans.who === "women" || ans.who === "men" ? p.gender === ans.who : true))
    .map(p => ({ p, s: (p.occasions.some(o => occ.includes(o)) ? 3 : 0) + (pal.includes(p.color) ? 2 : 0) + (p.tag === "bestseller" ? 0.5 : 0) + (p.inStock === false ? -10 : 0) }))
    .sort((a, b) => b.s - a.s).slice(0, 4).map(x => x.p);
}

export default function Advisor() {
  const { t, ls } = useI18n();
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<Record<string, string>>({});
  const done = i >= steps.length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: gutter, paddingBottom: 48 }}>
      <Eyebrow>{t("adv.eyebrow")}</Eyebrow>
      <Heading size={34}>{rich(t("adv.title"))}</Heading>
      <Body style={{ marginTop: 8, marginBottom: 24 }}>{t("adv.text")}</Body>

      <View style={styles.progress}><View style={[styles.bar, { width: `${(Math.min(i + 1, steps.length) / steps.length) * 100}%` }]} /></View>

      {!done ? (
        <View>
          <Text style={[styles.qNum, { letterSpacing: ls(2.4) }]}>{t("adv.q", { i: i + 1, n: steps.length }).toUpperCase()}</Text>
          <Heading size={26} style={{ marginBottom: 18 }}>{t(steps[i].q)}</Heading>
          <View style={{ gap: 10 }}>
            {steps[i].opts.map(k => (
              <Pressable
                key={k}
                accessibilityRole="button"
                style={({ pressed }) => [styles.opt, ans[steps[i].key] === k && styles.optOn, pressed && { opacity: 0.8 }]}
                onPress={() => { setAns(a => ({ ...a, [steps[i].key]: k })); setI(i + 1); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.optLabel}>{t(prefix[steps[i].key] + k)}</Text>
                  <Text style={styles.optHint}>{t(prefix[steps[i].key] + k + "Hint")}</Text>
                </View>
                {steps[i].key === "pal" && <View style={{ flexDirection: "row", gap: 4 }}>{palettes[k].slice(0, 4).map(c => <View key={c} style={[styles.sw, { backgroundColor: colorTable[c].hex }]} />)}</View>}
              </Pressable>
            ))}
          </View>
          {i > 0 && <Pressable onPress={() => setI(i - 1)} style={{ marginTop: 18 }}><Text style={styles.back}>{t("adv.back")}</Text></Pressable>}
        </View>
      ) : (
        <View>
          <Heading size={26} style={{ marginBottom: 20 }}>{t("adv.result")}</Heading>
          <ProductGrid items={pick(ans)} />
          <Button label={t("adv.book")} icon="calendar" style={{ marginTop: 28 }} onPress={() => router.push("/appointment")} />
          <Button label={t("adv.restart")} variant="outline" style={{ marginTop: 10 }} onPress={() => { setAns({}); setI(0); }} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  progress: { height: 2, backgroundColor: colors.lineSoft, marginBottom: 26, borderRadius: 2 },
  bar: { height: 2, backgroundColor: colors.gold, borderRadius: 2 },
  qNum: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.text3, marginBottom: 8 },
  opt: { flexDirection: "row", alignItems: "center", gap: 12, padding: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  optOn: { borderColor: colors.gold },
  optLabel: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.text },
  optHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.text3, marginTop: 2 },
  sw: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  back: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.gold2 }
});
