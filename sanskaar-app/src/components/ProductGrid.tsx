/* Two-column product grid (three on tablets) for use inside a ScrollView */
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Product } from "../lib/catalog";
import { gutter } from "../lib/theme";
import { ProductCard } from "./ProductCard";

export const GAP = 14;

export function useColumns() {
  const { width } = useWindowDimensions();
  const cols = width >= 700 ? 3 : 2;
  const cardWidth = Math.floor((width - gutter * 2 - GAP * (cols - 1)) / cols);
  return { cols, cardWidth };
}

export function ProductGrid({ items }: { items: Product[] }) {
  const { cardWidth } = useColumns();
  return (
    <View style={styles.grid}>
      {items.map(p => <ProductCard key={p.id} product={p} width={cardWidth} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", columnGap: GAP, rowGap: 22 }
});
