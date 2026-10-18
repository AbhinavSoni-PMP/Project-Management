/* Full-screen home hero: swipeable, auto-advancing looks with the headline on top */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ReactNode, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { heroSlides, inr } from "../lib/catalog";
import { colors, fonts, gutter } from "../lib/theme";

const slides = heroSlides();
const INTERVAL = 5000;

export function HeroCarousel({ width, height, top, children }: {
  width: number; height: number; top: ReactNode; children: ReactNode;
}) {
  const list = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {}); }, []);

  useEffect(() => {
    if (paused || reduceMotion || slides.length < 2) return;
    const t = setTimeout(() => {
      const next = (index + 1) % slides.length;
      list.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, INTERVAL);
    return () => clearTimeout(t);
  }, [index, paused, reduceMotion, width]);

  const current = slides[index];

  return (
    <View style={{ width, height, backgroundColor: colors.bg }}>
      <FlatList
        ref={list}
        data={slides}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        keyExtractor={s => s.key}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScrollBeginDrag={() => setPaused(true)}
        onMomentumScrollEnd={e => { setIndex(Math.round(e.nativeEvent.contentOffset.x / width)); setPaused(false); }}
        renderItem={({ item }) => (
          <Image
            source={item.image}
            style={{ width, height }}
            contentFit="cover"
            contentPosition="top"
            transition={300}
            accessibilityLabel={item.product ? item.product.name : "SANSKAAR campaign"}
          />
        )}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(14,12,11,0.65)", "rgba(14,12,11,0)", "rgba(14,12,11,0.15)", "rgba(14,12,11,0.9)", colors.bg]}
        locations={[0, 0.16, 0.45, 0.74, 1]}
        style={StyleSheet.absoluteFill}
      />
      {top}
      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.row} pointerEvents="box-none">
          {current?.product ? (
            <Pressable onPress={() => router.push(`/product/${current.product!.id}`)} style={styles.look} accessibilityRole="link"
              accessibilityLabel={`Shop the look: ${current.product.name}`}>
              <Text style={styles.lookName} numberOfLines={1}>{current.product.name}</Text>
              <Text style={styles.lookPrice}>{inr(current.product.price)}  →</Text>
            </Pressable>
          ) : <View />}
          {slides.length > 1 && (
            <View style={styles.dots}>
              {slides.map((s, i) => <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />)}
            </View>
          )}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottom: { position: "absolute", left: gutter, right: gutter, bottom: 26 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 },
  look: {
    flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(14,12,11,0.6)"
  },
  lookName: { flexShrink: 1, fontFamily: fonts.serifBold, fontSize: 15, color: colors.text },
  lookPrice: { flexShrink: 0, fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 0.6, color: colors.gold2 },
  dots: { flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(243,236,224,0.3)" },
  dotOn: { width: 18, backgroundColor: colors.gold }
});
