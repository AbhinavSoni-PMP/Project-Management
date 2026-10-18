import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { HeroCarousel } from "../../components/HeroCarousel";
import { Icon } from "../../components/Icon";
import { SiteMedia } from "../../components/Media";
import { ProductGrid } from "../../components/ProductGrid";
import { MenuButton, SideMenu } from "../../components/SideMenu";
import { Body, Button, Chip, Divider, Eyebrow, Heading, rich, SectionHead } from "../../components/ui";
import { shade } from "../../lib/art";
import { allProducts, collections, config, products } from "../../lib/catalog";
import { useI18n } from "../../lib/i18n";
import { useStore } from "../../lib/store";
import { colors, fonts, gutter, radius } from "../../lib/theme";
import { openWhatsApp } from "../../lib/whatsapp";

const TAB_CATS = ["lehenga", "saree", "sharara", "anarkali", "sherwani", "bandhgala", "indowestern"];
const MARQUEE = ["cat.lehenga", "cat.saree", "cat.sherwani", "cat.bandhgala", "home.craft1", "home.craft2", "home.craft3", "cat.sharara"];
const STATS: [string, string][] = [["100%", "home.stat1"], ["250+", "home.stat2"], ["120", "home.stat3"], ["✦", "home.stat4"]];

export default function Home() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { recent } = useStore();
  const { t, ls } = useI18n();
  const [tab, setTab] = useState("all");
  const [menu, setMenu] = useState(false);

  const signature = useMemo(() => {
    const list = tab === "all" ? products.filter(p => p.tag === "bestseller" || p.tag === "new") : products.filter(p => p.category === tab);
    return list.slice(0, 6);
  }, [tab]);
  const recentlyViewed = useMemo(() => recent.map(id => products.find(p => p.id === id)!).filter(Boolean).slice(0, 4), [recent]);

  const duoW = (width - gutter * 2 - 12) / 2;
  const shop = (params: Record<string, string>) => router.push({ pathname: "/shop", params });

  return (
    <>
      <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
        {/* HERO */}
        <HeroCarousel
          width={width}
          height={Math.max(560, height - tabBarHeight)}
          top={
            <View style={[styles.brandBar, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
              <MenuButton onPress={() => setMenu(true)} />
              <Text style={styles.brand}>{config.brand}</Text>
              <Pressable hitSlop={10} onPress={() => router.navigate("/shop")} accessibilityLabel={t("nav.search")}>
                <Icon name="search" color={colors.text} />
              </Pressable>
            </View>
          }
        >
          <Eyebrow>{t("home.heroEyebrow")}</Eyebrow>
          <Heading size={36}>{rich(t("home.heroTitle"))}</Heading>
          <View style={styles.heroBtns}>
            <Button label={t("home.explore")} onPress={() => router.navigate("/shop")} style={{ flex: 1 }} />
            <Button label={t("home.findLook")} variant="outline" onPress={() => router.push("/advisor")} style={{ flex: 1 }} />
          </View>
        </HeroCarousel>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.marquee} contentContainerStyle={{ paddingHorizontal: gutter, gap: 26, alignItems: "center" }}>
          {MARQUEE.map(k => <Text key={k} style={[styles.marqueeText, { letterSpacing: ls(2.4) }]}>✦  {t(k).toUpperCase()}</Text>)}
        </ScrollView>

        {/* BRIDE / GROOM */}
        <View style={styles.section}>
          <SectionHead eyebrow={t("home.weddingEyebrow")} title={rich(t("home.weddingTitle"))} sub={t("home.weddingText")} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            {[
              { g: "women", key: "bride", src: "site/bride.jpg", scene: { key: "scene:bride", colors: ["#4a0f1c", "#c8a45c"] as [string, string], w: 600, h: 750, seed: 21, sunX: 0.5, sun: "#e7b07a", figures: [["SK-W-LHG-002", 150, 260, 1.05]] as [string, number, number, number][] } },
              { g: "men", key: "groom", src: "site/groom.jpg", scene: { key: "scene:groom", colors: ["#1d1a2e", "#c8a45c"] as [string, string], w: 600, h: 750, seed: 4, sunX: 0.5, sun: "#d9b06a", figures: [["SK-M-SHW-001", 150, 260, 1.05]] as [string, number, number, number][] } }
            ].map(d => (
              <Pressable key={d.g} onPress={() => shop({ gender: d.g, occasion: "wedding" })} style={{ width: duoW }} accessibilityRole="link" accessibilityLabel={t(`home.${d.key}Title`)}>
                <SiteMedia src={d.src} scene={d.scene} style={[styles.duoArt, { height: duoW * 1.35 }]}>
                  <LinearGradient colors={["transparent", "rgba(14,12,11,0.92)"]} style={StyleSheet.absoluteFill} />
                  <View style={styles.duoText}>
                    <Eyebrow style={{ marginBottom: 4 }}>{t(`home.${d.key}Eyebrow`)}</Eyebrow>
                    <Heading size={22}>{t(`home.${d.key}Title`)}</Heading>
                    <Text style={styles.duoSub}>{t(`home.${d.key}Text`)}</Text>
                    <Text style={[styles.link, { letterSpacing: ls(2) }]}>{t(d.key === "bride" ? "home.shopBride" : "home.shopGroom").toUpperCase()}  →</Text>
                  </View>
                </SiteMedia>
              </Pressable>
            ))}
          </View>
        </View>

        {/* BESTSELLERS */}
        <View style={styles.section}>
          <SectionHead eyebrow={t("home.signatureEyebrow")} title={t("home.catalogTitle")} center />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter, marginBottom: 20 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
            <Chip label={t("home.tabAll")} active={tab === "all"} onPress={() => setTab("all")} />
            {TAB_CATS.map(k => <Chip key={k} label={t("cat." + k)} active={tab === k} onPress={() => setTab(k)} />)}
          </ScrollView>
          <ProductGrid items={signature} />
          <Button label={t("home.viewFull")} variant="ghost" style={{ marginTop: 28 }}
            onPress={() => tab === "all" ? router.navigate("/shop") : shop({ category: tab })} />
        </View>

        {/* STYLE ADVISOR */}
        <Pressable style={[styles.section, styles.advisor]} onPress={() => router.push("/advisor")} accessibilityRole="link">
          <Eyebrow>{t("home.advisorEyebrow")}</Eyebrow>
          <Heading size={28}>{rich(t("home.advisorTitle"))}</Heading>
          <Body style={{ marginTop: 8, marginBottom: 18 }}>{t("home.advisorText")}</Body>
          <Button label={t("home.findLook")} icon="sparkle" onPress={() => router.push("/advisor")} />
        </Pressable>

        {/* COLLECTIONS */}
        <View style={styles.section}>
          <SectionHead eyebrow={t("home.collectionsEyebrow")} title={rich(t("home.collectionsTitle"))} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }} decelerationRate="fast" snapToInterval={182}>
            {collections.map((c, i) => {
              const p = allProducts.find(x => x.collection === c.key && x.gender === (i % 2 ? "men" : "women"));
              return (
                <Pressable key={c.key} onPress={() => shop({ collection: c.key })} accessibilityRole="link" accessibilityLabel={c.name}>
                  <SiteMedia src={`collections/${c.key}.jpg`} style={styles.coll}
                    scene={{ key: `scene:coll:${c.key}`, colors: [shade(c.colors[0], -0.45), c.colors[1]], w: 300, h: 465, seed: i * 7 + 3, sunX: 0.5, figures: p ? [[p.id, 30, 120, 0.8]] : [] }}>
                    <LinearGradient colors={["transparent", "rgba(14,12,11,0.92)"]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
                    <View style={styles.collText}>
                      <Text style={styles.deva}>{c.deva}</Text>
                      <Heading size={22}>{c.name}</Heading>
                      <Text style={styles.collHint}>{t("coll." + c.key)}</Text>
                    </View>
                  </SiteMedia>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {recentlyViewed.length > 0 && (
          <View style={styles.section}>
            <SectionHead eyebrow={t("home.recentEyebrow")} title={t("home.recent")} />
            <ProductGrid items={recentlyViewed} />
          </View>
        )}

        {/* WORKSHOP */}
        <View style={[styles.section, styles.atelier]}>
          <View style={{ alignItems: "center" }}>
            <Eyebrow>{t("home.atelierEyebrow")}</Eyebrow>
            <Heading size={30} center>{t("home.atelierTitle")}</Heading>
            <Divider />
          </View>
          <Text style={styles.quote}>{t("home.quote")}</Text>
          <Body style={{ textAlign: "center" }}>{t("home.atelierText")}</Body>
          <View style={styles.stats}>
            {STATS.map(([b, k]) => (
              <View key={k} style={styles.stat}><Text style={styles.statNum}>{b}</Text><Text style={styles.statLabel}>{t(k)}</Text></View>
            ))}
          </View>
          {[1, 2, 3, 4].map(i => (
            <View key={i} style={styles.craft}>
              <Text style={styles.craftN}>0{i}</Text>
              <View style={{ flex: 1 }}><Heading size={20}>{t(`home.craft${i}`)}</Heading><Body>{t(`home.craft${i}Text`)}</Body></View>
            </View>
          ))}
        </View>

        {/* REVIEWS */}
        <View style={styles.section}>
          <SectionHead eyebrow={t("home.loveEyebrow")} title={t("home.loveTitle")} center />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={[styles.testi, { width: width * 0.76 }]}>
                <Text style={styles.stars}>★★★★★</Text>
                <Text style={styles.testiText}>{t(`home.love${i}`)}</Text>
                <Text style={[styles.who, { letterSpacing: ls(2) }]}>{t(`home.love${i}Who`).toUpperCase()}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* CONSULTATION */}
        <View style={[styles.section, { paddingBottom: 48 }]}>
          <View style={styles.cta}>
            <Eyebrow>{t("home.ctaEyebrow")}</Eyebrow>
            <Heading size={28} center>{rich(t("home.ctaTitle"))}</Heading>
            <Body style={{ textAlign: "center", marginVertical: 12 }}>{t("home.ctaText")}</Body>
            <Button label={t("nav.consult")} icon="calendar" onPress={() => router.push("/appointment")} style={{ alignSelf: "stretch" }} />
            <Button label={t("home.ctaChat")} icon="whatsapp" variant="outline" style={{ alignSelf: "stretch", marginTop: 10 }}
              onPress={() => openWhatsApp("Namaste SANSKAAR, I would like to book a consultation.")} />
          </View>
          <Text style={styles.footer}>{config.address}{"\n"}{config.phone} · {config.email}</Text>
        </View>
      </ScrollView>
      <SideMenu open={menu} onClose={() => setMenu(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  brandBar: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: gutter },
  brand: { fontFamily: fonts.serifBold, fontSize: 24, letterSpacing: 6, color: colors.gold2 },
  heroBtns: { flexDirection: "row", gap: 10, marginTop: 20 },
  marquee: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.bg2, height: 48, flexGrow: 0 },
  marqueeText: { fontFamily: fonts.sansMedium, fontSize: 11, color: colors.gold },
  section: { paddingHorizontal: gutter, paddingTop: 48 },
  duoArt: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  duoText: { position: "absolute", left: 14, right: 14, bottom: 14 },
  duoSub: { fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 16, color: colors.text2, marginTop: 4 },
  link: { marginTop: 8, fontFamily: fonts.sansBold, fontSize: 10, color: colors.gold2 },
  advisor: { marginTop: 48, marginHorizontal: gutter, paddingBottom: 28, paddingHorizontal: 22, paddingTop: 28, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  coll: { width: 170, height: 262, borderRadius: 90, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
  collText: { position: "absolute", left: 14, right: 14, bottom: 16, alignItems: "center" },
  deva: { fontFamily: fonts.serif, fontSize: 15, color: colors.gold, marginBottom: 2 },
  collHint: { fontFamily: fonts.sans, fontSize: 11, color: colors.text2, textAlign: "center" },
  atelier: { marginTop: 48, paddingBottom: 40, backgroundColor: colors.bg2, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.lineSoft },
  quote: { fontFamily: fonts.serifItalic, fontSize: 22, lineHeight: 30, color: colors.text, textAlign: "center", marginBottom: 16 },
  stats: { flexDirection: "row", flexWrap: "wrap", marginVertical: 26, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  stat: { width: "50%", paddingVertical: 18, alignItems: "center" },
  statNum: { fontFamily: fonts.serifBold, fontSize: 30, color: colors.gold2 },
  statLabel: { fontFamily: fonts.sans, fontSize: 11, color: colors.text3, textAlign: "center" },
  craft: { flexDirection: "row", gap: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  craftN: { fontFamily: fonts.serifItalic, fontSize: 24, color: colors.gold, width: 34 },
  testi: { padding: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  stars: { color: colors.gold, letterSpacing: 3, marginBottom: 10 },
  testiText: { fontFamily: fonts.serifItalic, fontSize: 19, lineHeight: 26, color: colors.text, marginBottom: 14 },
  who: { fontFamily: fonts.sansBold, fontSize: 10, color: colors.text3 },
  cta: { alignItems: "center", padding: 26, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface },
  footer: { marginTop: 30, fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 19, color: colors.text3, textAlign: "center" }
});
