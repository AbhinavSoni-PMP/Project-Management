import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import { SiteMedia } from "../../components/Media";
import { ProductGrid } from "../../components/ProductGrid";
import { Body, Button, Chip, Divider, Em, Eyebrow, Heading, SectionHead } from "../../components/ui";
import { shade } from "../../lib/art";
import { collections, config, products } from "../../lib/catalog";
import { useStore } from "../../lib/store";
import { colors, fonts, gutter, radius } from "../../lib/theme";
import { openWhatsApp } from "../../lib/whatsapp";

const TABS: [string, string][] = [
  ["all", "Signature"], ["lehenga", "Lehengas"], ["saree", "Royal Saris"], ["sharara", "Shararas"], ["anarkali", "Anarkalis"],
  ["sherwani", "Sherwanis"], ["bandhgala", "Bandhgalas"], ["indowestern", "Indo-Western"]
];
const MARQUEE = ["Bridal Lehengas", "Banarasi Saris", "Royal Sherwanis", "Jodhpuri Bandhgalas", "Zardozi", "Gota Patti", "Bandhej", "Shararas"];
const CRAFTS = [
  ["Zardozi", "Gold and silver threadwork once reserved for royal courts."],
  ["Gota Patti", "Jaipur's signature appliqué of woven metallic ribbon."],
  ["Bandhej", "Thousands of hand-tied dots, dyed by Jodhpur artisans."],
  ["Banarasi Weave", "Kadhua silks woven over weeks on traditional looms."]
];
const STATS = [["100%", "Pure handloom silks"], ["250+", "Hours per lehenga"], ["120", "Master karigars"], ["Bespoke", "Custom fittings"]];
const LOVE = [
  ["My sherwani felt like it was made for a king. Every guest asked where it was from.", "Groom · Udaipur wedding"],
  ["The gota-patti lehenga was even more beautiful in person, and light enough to dance all night.", "Bride · Jaipur"],
  ["They dressed our entire family over video calls and everything fit perfectly.", "Family · Delhi & London"]
];

export default function Home() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { recent } = useStore();
  const [tab, setTab] = useState("all");

  const signature = useMemo(() => {
    const list = tab === "all" ? products.filter(p => p.tag === "bestseller" || p.tag === "new") : products.filter(p => p.category === tab);
    return list.slice(0, 6);
  }, [tab]);
  const recentlyViewed = useMemo(() => recent.map(id => products.find(p => p.id === id)!).filter(Boolean).slice(0, 4), [recent]);

  const duoW = (width - gutter * 2 - 12) / 2;
  const shop = (params: Record<string, string>) => router.push({ pathname: "/shop", params });

  return (
    <ScrollView style={styles.screen} showsVerticalScrollIndicator={false}>
      {/* HERO */}
      <SiteMedia
        src="site/hero.jpg"
        style={{ height: Math.max(560, height * 0.82) }}
        scene={{ key: "scene:hero", colors: ["#3a0d14", "#c8a45c"], w: 900, h: 1300, seed: 5, sunX: 0.6, sun: "#e0a85a",
          figures: [["SK-M-SHW-002", 250, 620, 1.45], ["SK-W-LHG-001", 480, 610, 1.5]] }}
      >
        <LinearGradient colors={["rgba(14,12,11,0.55)", "rgba(14,12,11,0.05)", "rgba(14,12,11,0.92)", colors.bg]} locations={[0, 0.3, 0.78, 1]} style={StyleSheet.absoluteFill} />
        <View style={[styles.brandBar, { paddingTop: insets.top + 10 }]}>
          <Text style={styles.brand}>{config.brand}</Text>
          <Pressable hitSlop={10} onPress={() => router.navigate("/shop")} accessibilityLabel="Search the catalog">
            <Icon name="search" color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.heroText}>
          <Eyebrow>Redefining regal elegance</Eyebrow>
          <Heading size={40}>Crafting heirloom <Em>luxury</Em> for the royal Indian wedding</Heading>
          <Body style={{ marginTop: 12 }}>Hand-woven silks, rich velvets and heavy zardozi, designed to make the bride and groom look majestic on their most special day.</Body>
          <View style={styles.heroBtns}>
            <Button label="Explore" onPress={() => router.navigate("/shop")} style={{ flex: 1 }} />
            <Button label="Find your look" variant="outline" onPress={() => router.navigate("/advisor")} style={{ flex: 1 }} />
          </View>
        </View>
      </SiteMedia>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.marquee} contentContainerStyle={{ paddingHorizontal: gutter, gap: 26, alignItems: "center" }}>
        {MARQUEE.map(m => <Text key={m} style={styles.marqueeText}>✦  {m.toUpperCase()}</Text>)}
      </ScrollView>

      {/* BRIDE / GROOM */}
      <View style={styles.section}>
        <SectionHead eyebrow="The wedding edit" title={<>Dressed for <Em>forever</Em></>} sub="Coordinated couture for the couple, from the pheras to the reception, tailored to you in our Jaipur atelier." />
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[
            { g: "women", deva: "Dulhan", title: "The Bridal Trousseau", src: "site/bride.jpg", scene: { key: "scene:bride", colors: ["#4a0f1c", "#c8a45c"] as [string, string], w: 600, h: 750, seed: 21, sunX: 0.5, sun: "#e7b07a", figures: [["SK-W-LHG-002", 150, 260, 1.05]] as [string, number, number, number][] } },
            { g: "men", deva: "Dulha", title: "The Groom's Durbar", src: "site/groom.jpg", scene: { key: "scene:groom", colors: ["#1d1a2e", "#c8a45c"] as [string, string], w: 600, h: 750, seed: 4, sunX: 0.5, sun: "#d9b06a", figures: [["SK-M-SHW-001", 150, 260, 1.05]] as [string, number, number, number][] } }
          ].map(d => (
            <Pressable key={d.g} onPress={() => shop({ gender: d.g, occasion: "wedding" })} style={{ width: duoW }} accessibilityRole="link" accessibilityLabel={d.title}>
              <SiteMedia src={d.src} scene={d.scene} style={[styles.duoArt, { height: duoW * 1.35 }]}>
                <LinearGradient colors={["transparent", "rgba(14,12,11,0.9)"]} style={StyleSheet.absoluteFill} />
                <View style={styles.duoText}>
                  <Eyebrow style={{ marginBottom: 4 }}>{d.deva}</Eyebrow>
                  <Heading size={21}>{d.title}</Heading>
                  <Text style={styles.link}>SHOP  →</Text>
                </View>
              </SiteMedia>
            </Pressable>
          ))}
        </View>
      </View>

      {/* SIGNATURE CATALOG */}
      <View style={styles.section}>
        <SectionHead eyebrow="Signature pieces" title="The Couture Catalog" center />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter, marginBottom: 20 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
          {TABS.map(([k, l]) => <Chip key={k} label={l} active={tab === k} onPress={() => setTab(k)} />)}
        </ScrollView>
        <ProductGrid items={signature} />
        <Button label="View the full catalog" variant="ghost" style={{ marginTop: 28 }}
          onPress={() => tab === "all" ? router.navigate("/shop") : shop({ category: tab })} />
      </View>

      {/* STYLE ADVISOR TEASER */}
      <Pressable style={[styles.section, styles.advisor]} onPress={() => router.navigate("/advisor")} accessibilityRole="link">
        <Eyebrow>Personal styling</Eyebrow>
        <Heading size={28}>The Bridal <Em>Style Advisor</Em></Heading>
        <Body style={{ marginTop: 8, marginBottom: 18 }}>Answer three questions and our couturiers’ picks will appear, curated for your ceremony and palette.</Body>
        <Button label="Find your look" icon="sparkle" onPress={() => router.navigate("/advisor")} />
      </Pressable>

      {/* COLLECTIONS */}
      <View style={styles.section}>
        <SectionHead eyebrow="Signature collections" title={<>Five stories from <Em>Rajasthan</Em></>} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }} decelerationRate="fast" snapToInterval={182}>
          {collections.map((c, i) => {
            const p = products.find(x => x.collection === c.key && x.gender === (i % 2 ? "men" : "women"));
            return (
              <Pressable key={c.key} onPress={() => shop({ collection: c.key })} accessibilityRole="link" accessibilityLabel={`${c.name} collection`}>
                <SiteMedia src={`collections/${c.key}.jpg`} style={styles.coll}
                  scene={{ key: `scene:coll:${c.key}`, colors: [shade(c.colors[0], -0.45), c.colors[1]], w: 300, h: 465, seed: i * 7 + 3, sunX: 0.5, figures: p ? [[p.id, 30, 120, 0.8]] : [] }}>
                  <LinearGradient colors={["transparent", "rgba(14,12,11,0.92)"]} locations={[0.45, 1]} style={StyleSheet.absoluteFill} />
                  <View style={styles.collText}>
                    <Text style={styles.deva}>{c.deva}</Text>
                    <Heading size={22}>{c.name}</Heading>
                    <Text style={styles.collHint}>{c.hint}</Text>
                  </View>
                </SiteMedia>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {recentlyViewed.length > 0 && (
        <View style={styles.section}>
          <SectionHead eyebrow="Pick up where you left off" title="Recently viewed" />
          <ProductGrid items={recentlyViewed} />
        </View>
      )}

      {/* ATELIER */}
      <View style={[styles.section, styles.atelier]}>
        <View style={{ alignItems: "center" }}>
          <Eyebrow>Where craft meets heritage</Eyebrow>
          <Heading size={30} center>The SANSKAAR Atelier</Heading>
          <Divider />
        </View>
        <Text style={styles.quote}>“For every bride and groom, we don’t just tailor fabric — we weave a story of culture, pride and timeless grace.”</Text>
        <Body style={{ textAlign: "center" }}>Our weavers in Banaras and Kanchipuram use pure metallic zari and handloom mulberry silk. Each piece is then brought to our Jaipur atelier, where master embroiderers spend hundreds of hours on zardozi, gota-patti, mirror work and dabka motifs.</Body>
        <View style={styles.stats}>
          {STATS.map(([b, s]) => (
            <View key={s} style={styles.stat}><Text style={styles.statNum}>{b}</Text><Text style={styles.statLabel}>{s}</Text></View>
          ))}
        </View>
        {CRAFTS.map(([h, t], i) => (
          <View key={h} style={styles.craft}>
            <Text style={styles.craftN}>0{i + 1}</Text>
            <View style={{ flex: 1 }}><Heading size={20}>{h}</Heading><Body>{t}</Body></View>
          </View>
        ))}
      </View>

      {/* TESTIMONIALS */}
      <View style={styles.section}>
        <SectionHead eyebrow="Love notes" title="From our SANSKAAR families" center />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}>
          {LOVE.map(([t, w]) => (
            <View key={w} style={[styles.testi, { width: width * 0.76 }]}>
              <Text style={styles.stars}>★★★★★</Text>
              <Text style={styles.testiText}>{t}</Text>
              <Text style={styles.who}>{w.toUpperCase()}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* CTA */}
      <View style={[styles.section, { paddingBottom: 48 }]}>
        <View style={styles.cta}>
          <Eyebrow>By appointment</Eyebrow>
          <Heading size={28} center>Your wedding wardrobe, <Em>styled</Em> by our couturiers</Heading>
          <Body style={{ textAlign: "center", marginVertical: 12 }}>Book a private session at our Jaipur atelier or a video consultation from anywhere in the world.</Body>
          <Button label="Book consultation" icon="calendar" onPress={() => router.push("/appointment")} style={{ alignSelf: "stretch" }} />
          <Button label="Chat on WhatsApp" icon="whatsapp" variant="outline" style={{ alignSelf: "stretch", marginTop: 10 }}
            onPress={() => openWhatsApp("Namaste SANSKAAR, I would like to book a consultation.")} />
        </View>
        <Text style={styles.footer}>{config.address}{"\n"}{config.phone} · {config.email}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  brandBar: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: gutter },
  brand: { fontFamily: fonts.serifBold, fontSize: 24, letterSpacing: 6, color: colors.gold2 },
  heroText: { position: "absolute", left: gutter, right: gutter, bottom: 28 },
  heroBtns: { flexDirection: "row", gap: 10, marginTop: 22 },
  marquee: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.bg2, height: 48, flexGrow: 0 },
  marqueeText: { fontFamily: fonts.sansMedium, fontSize: 11, letterSpacing: 2.4, color: colors.gold },
  section: { paddingHorizontal: gutter, paddingTop: 48 },
  duoArt: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  duoText: { position: "absolute", left: 14, right: 14, bottom: 14 },
  link: { marginTop: 8, fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 2, color: colors.gold2 },
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
  statLabel: { fontFamily: fonts.sans, fontSize: 11, letterSpacing: 0.6, color: colors.text3, textAlign: "center" },
  craft: { flexDirection: "row", gap: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  craftN: { fontFamily: fonts.serifItalic, fontSize: 24, color: colors.gold, width: 34 },
  testi: { padding: 22, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  stars: { color: colors.gold, letterSpacing: 3, marginBottom: 10 },
  testiText: { fontFamily: fonts.serifItalic, fontSize: 19, lineHeight: 26, color: colors.text, marginBottom: 14 },
  who: { fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 2, color: colors.text3 },
  cta: { alignItems: "center", padding: 26, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.surface },
  footer: { marginTop: 30, fontFamily: fonts.sans, fontSize: 11.5, lineHeight: 19, color: colors.text3, textAlign: "center" }
});
