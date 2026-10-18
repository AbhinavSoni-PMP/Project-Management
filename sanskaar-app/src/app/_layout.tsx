import {
  CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold
} from "@expo-google-fonts/cormorant-garamond";
import { Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold } from "@expo-google-fonts/montserrat";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toast } from "../components/Toast";
import { AuthProvider, useAuth } from "../lib/auth";
import { I18nProvider, useI18n } from "../lib/i18n";
import { loadLiveCatalog } from "../lib/live";
import { StoreProvider } from "../lib/store";
import { colors, fonts } from "../lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.lineSoft, primary: colors.gold }
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold,
    Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold
  });
  const [live, setLive] = useState(false);
  useEffect(() => { loadLiveCatalog().finally(() => setLive(true)); }, []);
  const ready = (fontsLoaded || !!fontError) && live;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <I18nProvider>
          <AuthProvider>
            <StoreProvider>
              {ready ? <AppStack /> : null}
            </StoreProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppStack() {
  const { t, ready: langReady } = useI18n();
  const { ready: authReady } = useAuth();
  const ready = langReady && authReady;
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.gold2,
          headerTitleStyle: { fontFamily: fonts.serifBold, fontSize: 20, color: colors.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
          contentStyle: { backgroundColor: colors.bg }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="product/[id]" options={{ title: "", headerTransparent: true, headerStyle: { backgroundColor: "transparent" } }} />
        <Stack.Screen name="advisor" options={{ title: t("nav.advisor") }} />
        <Stack.Screen name="appointment" options={{ presentation: "modal", title: t("nav.consult") }} />
        <Stack.Screen name="size-guide" options={{ presentation: "modal", title: t("sg.title") }} />
        <Stack.Screen name="checkout" options={{ title: t("co.title") }} />
        <Stack.Screen name="order/[receipt]" options={{ title: t("ord.title") }} />
      </Stack>
      <Toast />
    </View>
  );
}
