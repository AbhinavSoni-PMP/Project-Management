/* Account: log in / sign up, then profile, language and My orders */
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthForm } from "../../components/AuthForm";
import { OrderCard } from "../../components/OrderBits";
import { Body, Button, Eyebrow, Heading } from "../../components/ui";
import { api, Order } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { languages, useI18n } from "../../lib/i18n";
import { colors, fonts, gutter, radius } from "../../lib/theme";

export default function Account() {
  const { user, logout } = useAuth();
  const { t, lang, setLang, ls } = useI18n();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError("");
      setOrders((await api<{ orders: Order[] }>("/api/orders")).orders);
    } catch (e) {
      setError((e as Error).message === "network" ? t("err.network") : (e as Error).message);
    }
  }, [user, t]);
  // refresh whenever the tab is opened, so new delivery updates show up
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const Languages = (
    <View style={{ marginTop: 26 }}>
      <Eyebrow>{t("nav.language")}</Eyebrow>
      <View style={styles.langs}>
        {languages.map(l => (
          <Pressable key={l.code} onPress={() => setLang(l.code)} style={[styles.lang, l.code === lang && styles.langOn]} accessibilityRole="button" accessibilityState={{ selected: l.code === lang }}>
            <Text style={[styles.langText, l.code === lang && { color: colors.bg }]}>{l.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: gutter, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={user ? <RefreshControl refreshing={refreshing} tintColor={colors.gold} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} /> : undefined}
      >
        {!user ? <>
          <AuthForm />
          {Languages}
        </> : <>
          <View style={styles.head}>
            <Eyebrow>{t("acc.title")}</Eyebrow>
            <Heading size={32}>{t("acc.hello", { name: user.name.split(" ")[0] })}</Heading>
            <Body dim>{user.email} · {user.phone}</Body>
          </View>

          <Heading size={26} style={{ marginTop: 28, marginBottom: 14 }}>{t("ord.title")}</Heading>
          {error ? <Body style={{ color: "#f0a5b4" }}>{error}</Body> : orders === null ? <ActivityIndicator color={colors.gold} /> :
            orders.length ? orders.map(o => <OrderCard key={o.receipt} order={o} />) : (
              <View style={styles.emptyCard}>
                <Heading size={22} center>{t("acc.noOrders")}</Heading>
                <Body style={{ textAlign: "center" }}>{t("acc.noOrdersText")}</Body>
              </View>
            )}

          {Languages}
          <Button label={t("nav.logout")} variant="outline" onPress={logout} style={{ marginTop: 30 }} />
          {user.isOwner && <Text style={[styles.owner, { letterSpacing: ls(0.3) }]}>{t("nav.admin")}: sanskaar/admin.html</Text>}
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: { padding: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg2 },
  emptyCard: { padding: 22, gap: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg2 },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  lang: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  langOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  langText: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.text },
  owner: { marginTop: 18, fontFamily: fonts.sans, fontSize: 12, color: colors.text3, textAlign: "center" }
});
