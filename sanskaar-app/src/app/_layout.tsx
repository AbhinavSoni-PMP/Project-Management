import {
  CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold
} from "@expo-google-fonts/cormorant-garamond";
import { Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold } from "@expo-google-fonts/montserrat";
import { useFonts } from "expo-font";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toast } from "../components/Toast";
import { StoreProvider } from "../lib/store";
import { colors, fonts } from "../lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.lineSoft, primary: colors.gold }
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    CormorantGaramond_500Medium, CormorantGaramond_500Medium_Italic, CormorantGaramond_600SemiBold,
    Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold
  });
  useEffect(() => { if (loaded || error) SplashScreen.hideAsync().catch(() => {}); }, [loaded, error]);
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <StoreProvider>
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
              <Stack.Screen name="appointment" options={{ presentation: "modal", title: "Book a consultation" }} />
              <Stack.Screen name="size-guide" options={{ presentation: "modal", title: "Size guide" }} />
              <Stack.Screen name="checkout" options={{ title: "Checkout" }} />
              <Stack.Screen name="order-success" options={{ headerShown: false, gestureEnabled: false }} />
            </Stack>
            <Toast />
          </View>
        </StoreProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
