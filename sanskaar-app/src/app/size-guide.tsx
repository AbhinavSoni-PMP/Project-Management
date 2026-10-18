import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Body, Heading } from "../components/ui";
import { sizeGuide } from "../lib/catalog";
import { colors, fonts, gutter, radius } from "../lib/theme";

export default function SizeGuide() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: gutter, paddingBottom: 48 }}>
      <Body>All measurements in inches. Every outfit can also be made to your measurements.</Body>
      {([["Groom", sizeGuide.groom], ["Bride", sizeGuide.bride]] as const).map(([title, t]) => (
        <View key={title} style={{ marginTop: 26 }}>
          <Heading size={24} style={{ marginBottom: 12 }}>{title}</Heading>
          <View style={styles.table}>
            {[t.head, ...t.rows].map((row, r) => (
              <View key={r} style={[styles.row, r === 0 && styles.headRow]}>
                {row.map((v, i) => <Text key={i} style={[styles.cell, r === 0 && styles.headCell]}>{v}</Text>)}
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
  headCell: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.4, color: colors.gold }
});
