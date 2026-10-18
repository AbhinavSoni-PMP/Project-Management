/* Amazon-style menu: the whole catalogue as a list, then account, language and help */
import { router } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { categories, collections, config, occasions } from "../lib/catalog";
import { useAuth } from "../lib/auth";
import { languages, useI18n } from "../lib/i18n";
import { colors, fonts } from "../lib/theme";
import { openWhatsApp } from "../lib/whatsapp";
import { Icon } from "./Icon";

function Link({ label, hint, onPress }: { label: string; hint?: string; onPress(): void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]} accessibilityRole="link">
      <View style={{ flex: 1 }}>
        <Text style={styles.linkText}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Icon name="chevron" size={16} color={colors.text3} />
    </Pressable>
  );
}

function H({ children }: { children: string }) {
  const { ls } = useI18n();
  return <Text style={[styles.h, { letterSpacing: ls(2.4) }]}>{children.toUpperCase()}</Text>;
}

export function SideMenu({ open, onClose }: { open: boolean; onClose(): void }) {
  const { t, lang, setLang } = useI18n();
  const { user, logout } = useAuth();
  const go = (fn: () => void) => () => { onClose(); setTimeout(fn, 50); };
  const shop = (params: Record<string, string>) => go(() => router.navigate({ pathname: "/shop", params }));

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.panel} edges={["top", "bottom", "left"]}>
          <View style={styles.hello}>
            <Pressable style={styles.helloLink} onPress={go(() => router.navigate("/account"))} accessibilityRole="link">
              <Icon name="user" size={26} color={colors.gold2} />
              <Text style={styles.helloText}>{user ? t("nav.hello", { name: user.name.split(" ")[0] }) : t("nav.helloGuest")}</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("nav.close")}><Icon name="close" color={colors.text3} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
            <H>{t("nav.shopByCategory")}</H>
            {(["women", "men"] as const).map(g => (
              <View key={g}>
                <Text style={styles.sub}>{g === "men" ? t("nav.men") : t("nav.women")}</Text>
                <Link label={t("nav.viewAll")} onPress={shop({ gender: g })} />
                {categories[g].map(c => <Link key={c.key} label={t("cat." + c.key)} onPress={shop({ gender: g, category: c.key })} />)}
              </View>
            ))}
            <H>{t("nav.occasions")}</H>
            {occasions.map(o => <Link key={o.key} label={t("occ." + o.key)} onPress={shop({ occasion: o.key })} />)}
            <H>{t("nav.collections")}</H>
            {collections.map(c => <Link key={c.key} label={c.name} hint={t("coll." + c.key)} onPress={shop({ collection: c.key })} />)}
            <H>{t("nav.account")}</H>
            <Link label={t("nav.orders")} onPress={go(() => router.navigate("/account"))} />
            <Link label={t("nav.wishlist")} onPress={go(() => router.navigate("/wishlist"))} />
            {user ? <Link label={t("nav.logout")} onPress={go(logout)} /> : <Link label={t("nav.login")} onPress={go(() => router.navigate("/account"))} />}
            <H>{t("nav.language")}</H>
            <View style={styles.langs}>
              {languages.map(l => (
                <Pressable key={l.code} onPress={() => setLang(l.code)} style={[styles.lang, l.code === lang && styles.langOn]} accessibilityRole="button" accessibilityState={{ selected: l.code === lang }}>
                  <Text style={[styles.langText, l.code === lang && { color: colors.bg }]}>{l.name}</Text>
                </Pressable>
              ))}
            </View>
            <H>{t("nav.help")}</H>
            <Link label={t("nav.advisor")} onPress={go(() => router.push("/advisor"))} />
            <Link label={t("nav.consult")} onPress={go(() => router.push("/appointment"))} />
            <Link label={t("foot.whatsapp")} hint={config.phone} onPress={go(() => openWhatsApp("Namaste SANSKAAR, I'd like some help choosing an outfit."))} />
          </ScrollView>
        </SafeAreaView>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t("nav.close")} />
      </View>
    </Modal>
  );
}

/** The ☰ button that opens the menu. */
export function MenuButton({ onPress }: { onPress(): void }) {
  const { t } = useI18n();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("nav.menu")}>
      <Icon name="menu" color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.6)" },
  panel: { width: "86%", maxWidth: 380, backgroundColor: colors.bg2, borderRightWidth: 1, borderColor: colors.line },
  hello: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 18, backgroundColor: colors.surface2, borderBottomWidth: 1, borderColor: colors.line },
  helloLink: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  helloText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.text },
  h: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.gold, marginTop: 26, marginBottom: 4 },
  sub: { fontFamily: fonts.serifBold, fontSize: 19, color: colors.text, marginTop: 12 },
  link: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  linkText: { fontFamily: fonts.sans, fontSize: 14.5, color: colors.text2 },
  hint: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.text3, marginTop: 1 },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 8 },
  lang: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  langOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  langText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text }
});
