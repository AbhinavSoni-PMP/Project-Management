import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "../lib/store";
import { colors, fonts } from "../lib/theme";

export function Toast() {
  const { toast } = useStore();
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 10 }]} accessibilityLiveRegion="polite">
      <Text style={styles.text}>{toast}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute", left: 20, right: 20, alignItems: "center", paddingVertical: 12, paddingHorizontal: 18,
    borderRadius: 999, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8
  },
  text: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text, textAlign: "center" }
});
