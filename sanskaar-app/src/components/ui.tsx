/* Small building blocks styled after the website */
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { discount, inr, Product } from "../lib/catalog";
import { useI18n } from "../lib/i18n";
import { colors, fonts } from "../lib/theme";
import { Icon, IconName } from "./Icon";

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { ls } = useI18n();
  return <Text style={[styles.eyebrow, { letterSpacing: ls(3) }, style]}>{typeof children === "string" ? children.toUpperCase() : children}</Text>;
}

/** Serif heading; wrap words in <Em> for the gold italic accent. */
export function Heading({ children, size = 30, style, center }: {
  children: ReactNode; size?: number; style?: StyleProp<TextStyle>; center?: boolean;
}) {
  return <Text style={[styles.heading, { fontSize: size, lineHeight: size * 1.12 }, center && { textAlign: "center" }, style]}>{children}</Text>;
}
export const Em = ({ children }: { children: ReactNode }) => <Text style={styles.em}>{children}</Text>;
/** Translated text with *word* shown in gold italics. */
export const rich = (text: string) => text.split(/\*([^*]+)\*/).map((part, i) => (i % 2 ? <Em key={i}>{part}</Em> : part));

export function Body({ children, style, dim }: { children: ReactNode; style?: StyleProp<TextStyle>; dim?: boolean }) {
  return <Text style={[styles.body, dim && { color: colors.text3 }, style]}>{children}</Text>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.divider, style]}>
      <View style={styles.divLine} /><Icon name="lotus" size={18} color={colors.gold} strokeWidth={1.2} /><View style={styles.divLine} />
    </View>
  );
}

type Variant = "gold" | "outline" | "ghost" | "whatsapp";
export function Button({ label, onPress, variant = "gold", icon, style, disabled, loading }: {
  label: string; onPress?: () => void; variant?: Variant; icon?: IconName;
  style?: StyleProp<ViewStyle>; disabled?: boolean; loading?: boolean;
}) {
  const { ls } = useI18n();
  const fg = variant === "gold" ? colors.bg : variant === "whatsapp" ? "#fff" : variant === "ghost" ? colors.gold2 : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, styles[`btn_${variant}`], (pressed || disabled) && { opacity: 0.75 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <>
        {icon && <Icon name={icon} size={18} color={fg} />}
        <Text style={[styles.btnText, { color: fg, letterSpacing: ls(2) }]}>{label.toUpperCase()}</Text>
      </>}
    </Pressable>
  );
}

export function Price({ product, size = 15 }: { product: Product; size?: number }) {
  const { t } = useI18n();
  const off = discount(product);
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.price, { fontSize: size }]}>{inr(product.price)}</Text>
      {product.mrp ? <Text style={[styles.mrp, { fontSize: size * 0.82 }]}>{inr(product.mrp)}</Text> : null}
      {off ? <Text style={[styles.off, { fontSize: size * 0.75 }]}>{t("p.off", { n: off })}</Text> : null}
    </View>
  );
}

export function Chip({ label, active, onPress, swatch }: { label: string; active?: boolean; onPress?: () => void; swatch?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: !!active }}>
      {swatch && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
      <Text style={[styles.chipText, active && { color: colors.bg }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionHead({ eyebrow, title, sub, center, action }: {
  eyebrow: string; title: ReactNode; sub?: string; center?: boolean; action?: ReactNode;
}) {
  return (
    <View style={[{ marginBottom: 22 }, center && { alignItems: "center" }]}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <View style={styles.headRow}>
        <Heading size={30} center={center} style={{ flexShrink: 1 }}>{title}</Heading>
        {action}
      </View>
      {sub ? <Body style={[{ marginTop: 6 }, center && { textAlign: "center" }]}>{sub}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 3, color: colors.gold, marginBottom: 10 },
  heading: { fontFamily: fonts.serif, color: colors.text },
  em: { fontFamily: fonts.serifItalic, color: colors.gold2 },
  body: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 23, color: colors.text2 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "center", marginVertical: 14 },
  divLine: { width: 44, height: StyleSheet.hairlineWidth, backgroundColor: colors.gold },
  btn: { minHeight: 50, paddingHorizontal: 22, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  btn_gold: { backgroundColor: colors.gold },
  btn_outline: { borderWidth: 1, borderColor: "rgba(243,236,224,0.35)" },
  btn_ghost: { borderWidth: 1, borderColor: colors.line },
  btn_whatsapp: { backgroundColor: "#1f9e57" },
  btnText: { fontFamily: fonts.sansBold, fontSize: 11.5, letterSpacing: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  price: { fontFamily: fonts.sansBold, color: colors.text },
  mrp: { fontFamily: fonts.sans, color: colors.text3, textDecorationLine: "line-through" },
  off: { fontFamily: fonts.sansBold, color: colors.gold },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, height: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.text },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  headRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }
});
