import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, IconName } from "../../components/Icon";
import { ProductMedia } from "../../components/Media";
import { ProductGrid } from "../../components/ProductGrid";
import { Body, Button, Eyebrow, Heading, Price, SectionHead } from "../../components/ui";
import { allProducts, byId, collOf, config, includesOf, inr, isSoldOut, Product, products, viewNames, viewsOf } from "../../lib/catalog";
import { inDays, useI18n } from "../../lib/i18n";
import { useStore } from "../../lib/store";
import { colors, fonts, gutter, radius } from "../../lib/theme";
import { openWhatsApp } from "../../lib/whatsapp";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = byId(id) ?? allProducts.find(x => x.id === id) ?? products[0];
  // keyed so switching colourway starts fresh (size, gallery position, scroll)
  return <ProductDetail key={p.id} p={p} />;
}

function ProductDetail({ p }: { p: Product }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { addToCart, toggleWish, isWished, showToast, viewed } = useStore();
  const { t, ls, fmtDate } = useI18n();
  const out = isSoldOut(p);
  const unit = p.sizeUnit && p.sizeUnit !== "Standard" ? p.sizeUnit : "";
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
    if (out) return;
    if (!size) { showToast(t("p.pleaseSize")); scroll.current?.scrollTo({ y: sizesY - 120, animated: true }); return; }
    addToCart(p.id, size);
    showToast(t("p.added", { name: p.name }));
  };

  const details = [[t("p.fabric"), p.fabric], [t("p.work"), p.work], [t("p.colour"), p.colorName], [t("p.includes"), includesOf[p.category]], [t("p.occasion"), p.occasions.map(o => t("occ." + o)).join(", ")]];
  const sections = [
    { k: "details", title: t("p.details"), body: details.map(([b, v]) => <Line key={b} b={b} v={v} />) },
    { k: "fit", title: t("p.sizeFit"), body: t("p.sizeFitText") },
    { k: "ship", title: t("p.shipping"), body: t("p.shippingText", { amount: inr(config.freeShippingAbove) }) },
    { k: "care", title: t("p.care"), body: t("p.careText") }
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{
        headerRight: () => (
          <Pressable hitSlop={10} style={styles.roundBtn} onPress={() => showToast(toggleWish(p.id) ? t("p.wishAdded") : t("p.wishRemoved"))}
            accessibilityLabel={t("p.wishlist")}>
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
          <Text style={[styles.viewLabel, { letterSpacing: ls(2) }]}>{viewNames[views[slide]]?.toUpperCase()}</Text>
        </View>

        <View style={{ paddingHorizontal: gutter }}>
          <Text style={[styles.coll, { letterSpacing: ls(2.4) }]}>{t("p.collection", { name: c.name })} · <Text style={styles.deva}>{c.deva}</Text></Text>
          <Heading size={34}>{p.name}</Heading>
          <Text style={styles.sku}>SKU {p.id} · {p.colorName}</Text>
          <View style={{ marginTop: 12 }}><Price product={p} size={20} /></View>
          <Text style={styles.tax}>{t("p.taxes")}</Text>
          {out ? <Text style={[styles.stock, styles.stockOut]}>{t("p.soldOut")}</Text>
            : p.lowStock ? <Text style={styles.stock}>{t("p.onlyLeft", { n: p.lowStock })}</Text> : null}
          {!out && p.deliveryDays ? (
            <View style={styles.delivery}>
              <Icon name="truck" size={20} color={colors.gold} strokeWidth={1.4} />
              <Text style={styles.deliveryText}>{t("p.deliveryBy", { date: fmtDate(inDays(p.deliveryDays)) })}</Text>
            </View>
          ) : null}
          <Body style={{ marginTop: 14 }}>{p.description}</Body>

          <View style={styles.optHead}><Text style={[styles.optLabel, { letterSpacing: ls(2) }]}>{`${t("p.colour")}: ${p.colorName}`.toUpperCase()}</Text></View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {colorways.map(s => (
              <Pressable key={s.id} onPress={() => router.setParams({ id: s.id })} accessibilityLabel={`${s.colorName} — ${s.name}`}
                style={[styles.colorDot, { backgroundColor: s.hex }, s.id === p.id && styles.colorOn]} />
            ))}
          </View>

          <View style={styles.optHead} onLayout={e => setSizesY(e.nativeEvent.layout.y)}>
            <Text style={[styles.optLabel, { letterSpacing: ls(2) }]}>{(unit ? t("p.sizeUnit", { unit }) : t("p.selectSize")).toUpperCase()}</Text>
            <Pressable onPress={() => router.push("/size-guide")} hitSlop={8}><Text style={styles.guide}>{t("p.sizeGuide")}</Text></Pressable>
          </View>
          <View style={styles.sizes}>
            {[...p.sizes, "Custom"].map(s => (
              <Pressable key={s} onPress={() => setSize(s)} disabled={out} style={[styles.size, s === "Custom" && { paddingHorizontal: 16 }, size === s && styles.sizeOn, out && { opacity: 0.4 }]}
                accessibilityRole="button" accessibilityState={{ selected: size === s, disabled: out }}>
                <Text style={[styles.sizeText, size === s && { color: colors.bg }]}>{s === "Custom" ? t("p.madeToMeasure") : s}</Text>
              </Pressable>
            ))}
          </View>

          <Button label={t("p.enquire")} icon="whatsapp" variant="whatsapp" style={{ marginTop: 22 }}
            onPress={() => openWhatsApp(`Namaste! I'm interested in ${p.name} (${p.id}). Could you share more details?`)} />

          <View style={styles.perks}>
            {([["truck", "p.perk1"], ["scissors", "p.perk2"], ["shield", "p.perk3"]] as [IconName, string][]).map(([i, k]) => (
              <View key={k} style={styles.perk}><Icon name={i} size={22} color={colors.gold} strokeWidth={1.4} /><Text style={styles.perkText}>{t(k)}</Text></View>
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
            <SectionHead eyebrow={t("p.completeLook")} title={t("p.forPartner")} />
            <ProductGrid items={look} />
          </View>}
          {siblings.length > 0 && <View style={{ marginTop: 44 }}>
            <SectionHead eyebrow={t("p.youMayLike")} title={t("p.similar")} />
            <ProductGrid items={siblings.slice(0, 4)} />
          </View>}
        </View>
      </ScrollView>

      {/* STICKY ADD TO BAG */}
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ marginBottom: 2 }}>{out ? t("p.soldOut") : size ? (size === "Custom" ? t("p.madeToMeasure") : t("p.sizeChosen", { size })) : t("p.selectASize")}</Eyebrow>
          <Text style={styles.barPrice}>{inr(p.price)}</Text>
        </View>
        <Button label={out ? t("p.soldOut") : t("p.addToBag")} icon="bag" onPress={add} disabled={out} style={{ flex: 1.3 }} />
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
  viewLabel: { marginLeft: "auto", fontFamily: fonts.sansBold, fontSize: 10, color: colors.text3 },
  coll: { fontFamily: fonts.sansBold, fontSize: 10.5, color: colors.gold, marginBottom: 6, textTransform: "uppercase" },
  deva: { fontFamily: fonts.serif, fontSize: 14, letterSpacing: 0, textTransform: "none" },
  sku: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.text3, letterSpacing: 0.6, marginTop: 4 },
  tax: { fontFamily: fonts.sans, fontSize: 11.5, color: colors.text3, marginTop: 4 },
  stock: { alignSelf: "flex-start", marginTop: 10, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.gold, color: colors.gold2, fontFamily: fonts.sansMedium, fontSize: 12, overflow: "hidden" },
  stockOut: { borderColor: "#d9677f", color: "#f0a5b4" },
  delivery: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  deliveryText: { fontFamily: fonts.sansMedium, fontSize: 13.5, color: colors.text2 },
  optHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 26, marginBottom: 12 },
  optLabel: { fontFamily: fonts.sansBold, fontSize: 11, color: colors.text2 },
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
