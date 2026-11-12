import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { ThemedText } from "@/components/ui/themed-text";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useAuth } from "@/features/auth/auth-provider";

const welcomePalette = {
  background: "#0B1018",
  text: "#F5F3EE",
  secondary: "#B4BCC8",
  accent: "#78B9F5",
};

/** Boas-vindas com arte de jiu-jitsu e acesso direto à autenticação. */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { setDevSkip } = useAuth();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.artwork}>
            <Image
              source={require("@/assets/images/welcome-jiu-jitsu.png")}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              contentPosition="center"
              accessible={false}
            />
            <View style={styles.brand}>
              <View style={styles.belt}>
                <View style={styles.beltStripe} />
                <View style={styles.beltStripe} />
                <View style={styles.beltStripe} />
              </View>
              <ThemedText style={styles.brandName}>
                {t("common.appName")}
              </ThemedText>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.copy}>
              <ThemedText style={styles.eyebrow}>
                {t("welcome.eyebrow")}
              </ThemedText>
              <ThemedText accessibilityRole="header" style={styles.title}>
                {t("welcome.title")}
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                {t("welcome.subtitle")}
              </ThemedText>
            </View>

            <View style={styles.actions}>
              <Button
                label={t("welcome.createAccount")}
                onPress={() => router.push("/sign-up")}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/login")}
                style={({ pressed }) => [
                  styles.loginButton,
                  { opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <ThemedText style={styles.loginLabel}>
                  {t("login.submit")}
                </ThemedText>
              </Pressable>
            </View>

            <ThemedText type="small" style={styles.legal}>
              {t("login.legal")}
            </ThemedText>

            {__DEV__ ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setDevSkip(true)}
                style={styles.devButton}
              >
                <ThemedText type="small" style={styles.devLabel}>
                  Pular login (dev)
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: welcomePalette.background },
  scrollContent: { flexGrow: 1, alignItems: "center" },
  safeArea: { flexGrow: 1, width: "100%", maxWidth: MaxContentWidth / 2 + 48 },
  artwork: { flex: 1, minHeight: 220, overflow: "hidden" },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  belt: {
    width: 32,
    height: 12,
    backgroundColor: welcomePalette.accent,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 2,
    paddingRight: 4,
  },
  beltStripe: { width: 2, backgroundColor: welcomePalette.background },
  brandName: { color: welcomePalette.text, fontWeight: "700", fontSize: 18 },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  copy: { gap: Spacing.two },
  eyebrow: {
    color: welcomePalette.accent,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    color: welcomePalette.text,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    fontWeight: "700",
  },
  subtitle: { color: welcomePalette.secondary, fontSize: 15, lineHeight: 22 },
  actions: { gap: Spacing.two, marginTop: Spacing.two },
  loginButton: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#47505E",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  loginLabel: { color: welcomePalette.text, fontWeight: "600" },
  legal: {
    color: welcomePalette.secondary,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
  },
  devButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  devLabel: { color: welcomePalette.secondary },
});
