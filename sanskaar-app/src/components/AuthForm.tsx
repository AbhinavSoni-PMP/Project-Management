/* Log in / create account */
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError, apiReady } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useI18n } from "../lib/i18n";
import { colors, fonts, radius } from "../lib/theme";
import { openWhatsApp } from "../lib/whatsapp";
import { Field, fieldStyles } from "./Field";
import { Body, Button, Heading } from "./ui";

export function AuthForm({ intro, onDone }: { intro?: string; onDone?: () => void }) {
  const { t } = useI18n();
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [f, setF] = useState({ login: "", name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(s => ({ ...s, [k]: v }));
  const isLogin = mode === "login";

  if (!apiReady) return <Body style={{ textAlign: "center" }}>{t("co.notConfigured")}</Body>;

  const submit = async () => {
    setError("");
    if (!isLogin && f.password.length < 8) return setError(t("err.password"));
    setBusy(true);
    try {
      if (isLogin) await login(f.login, f.password);
      else await signup({ name: f.name, email: f.email, phone: f.phone, password: f.password });
      onDone?.();
    } catch (e) {
      setError(e instanceof ApiError && e.message === "network" ? t("err.network") : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Heading size={28}>{isLogin ? t("auth.loginTitle") : t("auth.signupTitle")}</Heading>
      <Body style={{ marginTop: 6, marginBottom: 20 }}>{intro || t("auth.why")}</Body>
      {isLogin ? <>
        <Field label={t("auth.emailOrMobile")} value={f.login} onChange={set("login")} autoCapitalize="none" autoComplete="username" textContentType="username" />
        <Field label={t("auth.password")} value={f.password} onChange={set("password")} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      </> : <>
        <Field label={t("auth.name")} value={f.name} onChange={set("name")} autoComplete="name" textContentType="name" />
        <Field label={t("auth.email")} value={f.email} onChange={set("email")} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label={t("auth.mobile")} value={f.phone} onChange={set("phone")} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
        <Field label={t("auth.password")} value={f.password} onChange={set("password")} secureTextEntry placeholder={t("auth.passwordHint")} autoComplete="new-password" textContentType="newPassword" />
      </>}
      {error ? <Text style={[fieldStyles.error, { marginBottom: 12 }]} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button label={isLogin ? t("auth.login") : t("auth.signup")} onPress={submit} loading={busy} />
      <Pressable onPress={() => { setMode(isLogin ? "signup" : "login"); setError(""); }} style={{ marginTop: 18 }} accessibilityRole="button">
        <Text style={styles.switch}>{isLogin ? t("auth.newHere") : t("auth.haveAccount")}</Text>
      </Pressable>
      {isLogin && (
        <Pressable onPress={() => openWhatsApp("Namaste SANSKAAR, I forgot my account password.")} style={{ marginTop: 12 }} accessibilityRole="link">
          <Text style={[styles.switch, { color: colors.text3 }]}>{t("auth.forgot")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg2 },
  switch: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.gold2, textAlign: "center", textDecorationLine: "underline" }
});
