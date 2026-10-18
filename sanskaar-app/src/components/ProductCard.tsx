import { router } from "expo-router";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { catName, Product } from "../lib/catalog";
import { useStore } from "../lib/store";
import { colors, fonts, radius } from "../lib/theme";
import { Icon } from "./Icon";
import { ProductMedia } from "./Media";
import { Price } from "./ui";

export const ProductCard = memo(function ProductCard({ product: p, width }: { product: Product; width: number }) {
  const { isWished, toggleWish, addToCart, showToast } = useStore();
  const wished = isWished(p.id);
  const tag = p.tag === "new" ? "New" : p.tag === "bestseller" ? "Bestseller" : catName(p.category);
  const quickSize = p.sizes[2];

  return (
    <View style={{ width }}>
      <View>
        <Pressable onPress={() => router.push(`/product/${p.id}`)} accessibilityLabel={p.name} accessibilityRole="link">
          <ProductMedia product={p} style={[styles.media, { height: width * 4 / 3 }]} />
        </Pressable>
        <Text style={styles.tag} pointerEvents="none">{tag.toUpperCase()}</Text>
        <Pressable
          style={styles.wish}
          hitSlop={8}
          accessibilityLabel={wished ? "Remove from wishlist" : "Add to wishlist"}
          onPress={() => showToast(toggleWish(p.id) ? "Added to wishlist" : "Removed from wishlist")}
        >
          <Icon name={wished ? "heartFill" : "heart"} size={18} color={wished ? colors.gold2 : colors.text} />
        </Pressable>
        <Pressable
          style={styles.quick}
          hitSlop={6}
          accessibilityLabel={`Quick add size ${quickSize}`}
          onPress={() => { addToCart(p.id, quickSize); showToast(`${p.name} (size ${quickSize}) added to bag`); }}
        >
          <Icon name="bag" size={16} color={colors.bg} strokeWidth={1.8} />
        </Pressable>
      </View>
      <Pressable onPress={() => router.push(`/product/${p.id}`)} style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{p.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{p.fabric} · {p.work}</Text>
        <Price product={p} size={13.5} />
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  media: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tag: {
    position: "absolute", top: 10, left: 10, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, overflow: "hidden",
    backgroundColor: "rgba(14,12,11,0.72)", color: colors.gold2, fontFamily: fonts.sansBold, fontSize: 8.5, letterSpacing: 1.6
  },
  wish: {
    position: "absolute", top: 8, right: 8, width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,12,11,0.6)"
  },
  quick: {
    position: "absolute", right: 8, bottom: 8, width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.gold
  },
  info: { paddingTop: 10, gap: 3, minHeight: 84 },
  name: { fontFamily: fonts.serifBold, fontSize: 17, lineHeight: 19, color: colors.text },
  meta: { fontFamily: fonts.sans, fontSize: 11, color: colors.text3 }
});
