import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Body, Heading } from "../components/ui";
import { sizeGuide } from "../lib/catalog";
import { useI18n } from "../lib/i18n";
import { colors, fonts, gutter, radius } from "../lib/theme";

const HEAD = { groom: ["sg.size", "sg.chest", "sg.waist", "sg.shoulder"], bride: ["sg.size", "sg.bust", "sg.waist", "sg.hip"] };

export default function SizeGuide() {
  const { t, ls } = useI18n();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: gutter, paddingBottom: 48 }}>
      <Body>{t("sg.intro")}</Body>
      {(["groom", "bride"] as const).map(key => (
        <View key={key} style={{ marginTop: 26 }}>
          <Heading size={24} style={{ marginBottom: 12 }}>{t(key === "groom" ? "sg.groom" : "sg.bride")}</Heading>
          <View style={styles.table}>
            {[HEAD[key].map(k => t(k)), ...sizeGuide[key].rows].map((row, r) => (
              <View key={r} style={[styles.row, r === 0 && styles.headRow]}>
                {row.map((v, i) => <Text key={i} style={[styles.cell, r === 0 && [styles.headCell, { letterSpacing: ls(1.4) }]]}>{v}</Text>)}
              </View>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, overflow: "hidden" },
  row: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  headRow: { borderTopWidth: 0, backgroundColor: colors.surface2 },
  cell: { flex: 1, paddingVertical: 11, textAlign: "center", fontFamily: fonts.sans, fontSize: 13.5, color: colors.text2 },
  headCell: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.gold }
});
