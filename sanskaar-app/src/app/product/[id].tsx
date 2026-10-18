import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "../../components/Icon";
import { ProductMedia } from "../../components/Media";
import { ProductGrid } from "../../components/ProductGrid";
import { Body, Button, Eyebrow, Heading, Price, SectionHead } from "../../components/ui";
import { byId, collOf, Product, config, includesOf, inr, occName, products, viewNames, viewsOf } from "../../lib/catalog";
import { useStore } from "../../lib/store";
import { colors, fonts, gutter, radius } from "../../lib/theme";
import { openWhatsApp } from "../../lib/whatsapp";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = byId(id) ?? products[0];
  // keyed so switching colourway starts fresh (size, gallery position, scroll)
  return <ProductDetail key={p.id} p={p} />;
}

function ProductDetail({ p }: { p: Product }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { addToCart, toggleWish, isWished, showToast, viewed } = useStore();
  const [size, setSize] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [open, setOpen] = useState<string | null>("details");
  const scroll = useRef<ScrollView>(null);
  const [sizesY, setSizesY] = useState(0);

  useEffect(() => { viewed(p.id); }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = collOf(p.collection);
  const views = viewsOf(p);
  const wished = isWished(p.id);
  const siblings = products.filter(x => x.category === p.category && x.id !== p.id);
  const colorways = [p, ...siblings.filter(s => s.color !== p.color).slice(0, 4)];
  const look = products.filter(x => x.collection === p.collection && x.gender !== p.gender).slice(0, 4);
  const photoH = Math.min(width * 4 / 3, 620);

  const add = () => {
    if (!size) { showToast("Please select a size"); scroll.current?.scrollTo({ y: sizesY - 120, animated: true }); return; }
    addToCart(p.id, size);
    showToast(`${p.name} added to your bag`);
  };

  const details = [["Fabric", p.fabric], ["Work", p.work], ["Colour", p.colorName], ["Includes", includesOf[p.category]], ["Occasion", p.occasions.map(occName).join(", ")]];
  const sections = [
    { k: "details", title: "Product details", body: details.map(([b, v]) => <Line key={b} b={b} v={v} />) },
    { k: "fit", title: "Size & fit", body: "Tailored to a classic fit. Every SANSKAAR outfit includes free alterations, or choose Made to measure and our master tailor will call you for measurements." },
    { k: "ship", title: "Shipping & exchange", body: `Free shipping across India above ${inr(config.freeShippingAbove)}. International shipping available. 7-day size exchange on unworn pieces with tags intact.` },
    { k: "care", title: "Care", body: "Dry clean only. Store folded in a muslin bag, away from direct sunlight and moisture. Refold every few months to protect the zari." }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{
        headerRight: () => (
          <Pressable hitSlop={10} style={styles.roundBtn} onPress={() => showToast(toggleWish(p.id) ? "Added to wishlist" : "Removed from wishlist")}
            accessibilityLabel={wished ? "Remove from wishlist" : "Add to wishlist"}>
            <Icon name={wished ? "heartFill" : "heart"} size={20} color={wished ? colors.gold2 : colors.text} />
          </Pressable>
        )
      }} />
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* GALLERY */}
        <FlatList
          data={views}
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          keyExtractor={v => v}
          onMomentumScrollEnd={e => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => <ProductMedia product={p} view={item} style={{ width, height: photoH }} />}
        />
        <View style={styles.dots}>
          {views.map((v, i) => (
            <View key={v} style={[styles.dot, i === slide && styles.dotOn]} />
          ))}
          <Text style={styles.viewLabel}>{viewNames[views[slide]]?.toUpperCase()}</Text>
        </View>

        <View style={{ paddingHorizontal: gutter }}>
          <Text style={styles.coll}>{c.name} Collection · <Text style={styles.deva}>{c.deva}</Text></Text>
          <Heading size={34}>{p.name}</Heading>
          <Text style={styles.sku}>SKU {p.id} · {p.colorName}</Text>
          <View style={{ marginTop: 12 }}><Price product={p} size={20} /></View>
          <Text style={styles.tax}>Inclusive of all taxes · Free alterations</Text>
          <Body style={{ marginTop: 14 }}>{p.description}</Body>

          <View style={styles.optHead}><Text style={styles.optLabel}>COLOUR: {p.colorName.toUpperCase()}</Text></View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {colorways.map(s => (
              <Pressable key={s.id} onPress={() => router.setParams({ id: s.id })} accessibilityLabel={`${s.colorName} — ${s.name}`}
                style={[styles.colorDot, { backgroundColor: s.hex }, s.id === p.id && styles.colorOn]} />
            ))}
          </View>

          <View style={styles.optHead} onLayout={e => setSizesY(e.nativeEvent.layout.y)}>
            <Text style={styles.optLabel}>SELECT SIZE</Text>
            <Pressable onPress={() => router.push("/size-guide")} hitSlop={8}><Text style={styles.guide}>Size guide</Text></Pressable>
          </View>
          <View style={styles.sizes}>
            {[...p.sizes, "Custom"].map(s => (
              <Pressable key={s} onPress={() => setSize(s)} style={[styles.size, s === "Custom" && { paddingHorizontal: 16 }, size === s && styles.sizeOn]}
                accessibilityRole="button" accessibilityState={{ selected: size === s }}>
                <Text style={[styles.sizeText, size === s && { color: colors.bg }]}>{s === "Custom" ? "Made to measure" : s}</Text>
              </Pressable>
            ))}
          </View>

          <Button label="Enquire on WhatsApp" icon="whatsapp" variant="whatsapp" style={{ marginTop: 22 }}
            onPress={() => openWhatsApp(`Namaste! I'm interested in ${p.name} (${p.id}). Could you share more details?`)} />

          <View style={styles.perks}>
            {([["truck", "Ships in 7–10 days"], ["scissors", "Free alterations"], ["shield", "Quality assured"]] as [IconName, string][]).map(([i, t]) => (
              <View key={t} style={styles.perk}><Icon name={i} size={22} color={colors.gold} strokeWidth={1.4} /><Text style={styles.perkText}>{t}</Text></View>
            ))}
          </View>

          {sections.map(({ k, title, body }) => (
            <View key={k} style={styles.acc}>
              <Pressable onPress={() => setOpen(open === k ? null : k)} style={styles.accHead} accessibilityRole="button" accessibilityState={{ expanded: open === k }}>
                <Text style={styles.accTitle}>{title}</Text>
                <Icon name={open === k ? "minus" : "plus"} size={18} color={colors.gold} />
              </Pressable>
              {open === k && <View style={{ paddingBottom: 16 }}>{typeof body === "string" ? <Body>{body}</Body> : body}</View>}
            </View>
          ))}

          {look.length > 0 && <View style={{ marginTop: 44 }}>
            <SectionHead eyebrow="Complete the look" title="For your partner" sub={`Coordinated pieces from the ${c.name} collection.`} />
            <ProductGrid items={look} />
          </View>}
          {siblings.length > 0 && <View style={{ marginTop: 44 }}>
            <SectionHead eyebrow="You may also like" title="Similar pieces" />
            <ProductGrid items={siblings.slice(0, 4)} />
          </View>}
        </View>
      </ScrollView>

      {/* STICKY ADD TO BAG */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{size ? (size === "Custom" ? "Made to measure" : `Size ${size}`) : "Select a size"}</Eyebrow>
          <Text style={styles.barPrice}>{inr(p.price)}</Text>
        </View>
        <Button label="Add to bag" icon="bag" onPress={add} style={{ flex: 1.3 }} />
      </View>
    </View>
  );
}

function Line({ b, v }: { b: string; v: string }) {
  return <Body><Text style={{ fontFamily: fonts.sansBold, color: colors.text }}>{b}: </Text>{v}</Body>;
}

const styles = StyleSheet.create({
  roundBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,12,11,0.6)" },
  dots: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: gutter, paddingVertical: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lineSoft },
  dotOn: { width: 22, backgroundColor: colors.gold },
  viewLabel: { marginLeft: "auto", fontFamily: fonts.sansBold, fontSize: 10, letterSpacing: 2, color: colors.text3 },
  coll: { fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 2.4, color: colors.gold, marginBottom: 6, textTransform: "uppercase" },
  deva: { fontFamily: fonts.serif, fontSize: 14, letterSpacing: 0, textTransform: "none" },
  sku: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.text3, letterSpacing: 0.6, marginTop: 4 },
  tax: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.text3, marginTop: 4 },
  optHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 26, marginBottom: 12 },
  optLabel: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2, color: colors.text2 },
  guide: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.gold2, textDecorationLine: "underline" },
  colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.bg, outlineWidth: 1, outlineColor: colors.line },
  colorOn: { borderColor: colors.gold2 },
  sizes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  size: { minWidth: 52, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  sizeOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  sizeText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.text },
  perks: { flexDirection: "row", marginTop: 24, marginBottom: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 16 },
  perk: { flex: 1, alignItems: "center", gap: 6 },
  perkText: { fontFamily: fonts.sans, fontSize: 10.5, color: colors.text2, textAlign: "center" },
  acc: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  accHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16 },
  accTitle: { fontFamily: fonts.serifBold, fontSize: 19, color: colors.text },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: gutter, paddingTop: 12, backgroundColor: colors.bg2, borderTopWidth: 1, borderColor: colors.line },
  barPrice: { fontFamily: fonts.serifBold, fontSize: 22, color: colors.text }
});
