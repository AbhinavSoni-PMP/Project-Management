/* Labelled text input used by the consultation and checkout forms */
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { colors, fonts, radius } from "../lib/theme";

export function Field({ label, value, onChange, error, multiline, ...rest }: {
  label: string; value: string; onChange: (v: string) => void; error?: boolean; multiline?: boolean;
} & Omit<React.ComponentProps<typeof TextInput>, "value" | "onChangeText" | "onChange">) {
  const { ls } = useI18n();
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { letterSpacing: ls(2) }]}>{label.toUpperCase()}</Text>
      <TextInput
        value={value} onChangeText={onChange} multiline={multiline} placeholderTextColor={colors.text3}
        style={[styles.input, multiline && { height: 96, textAlignVertical: "top", paddingTop: 12 }, error && { borderColor: "#d9677f" }]}
        accessibilityLabel={label}
        {...rest}
      />
    </View>
  );
}

export const fieldStyles = StyleSheet.create({
  label: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.text3, marginBottom: 8 },
  error: { fontFamily: fonts.sans, fontSize: 12.5, color: "#e8a9b4", textAlign: "center", marginTop: 10 }
});

const styles = StyleSheet.create({
  label: fieldStyles.label,
  input: { height: 50, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, fontFamily: fonts.sans, fontSize: 14.5, color: colors.text }
});
