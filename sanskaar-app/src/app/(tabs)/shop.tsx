import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "../../components/Icon";
import { ProductCard } from "../../components/ProductCard";
import { GAP, useColumns } from "../../components/ProductGrid";
import { Body, Button, Chip, Eyebrow, Heading } from "../../components/ui";
import { categories, catName, collOf, collections, colorTable, Gender, inr, occasions, Product, products } from "../../lib/catalog";
import { colors, fonts, gutter } from "../../lib/theme";

type Key = "gender" | "category" | "occasion" | "collection" | "color";
type Filters = Record<Key, string[]> & { tag: string; max: number };
type Sort = "featured" | "new" | "low" | "high";

const PRICE_CEIL = Math.ceil(Math.max(...products.map(p => p.price)) / 10000) * 10000;
const PRICE_STEPS = [10000, 25000, 50000, 100000, PRICE_CEIL];
const SORTS: [Sort, string][] = [["featured", "Featured"], ["new", "New arrivals"], ["low", "Price: low to high"], ["high", "Price: high to low"]];
const usedColors = [...new Set(products.map(p => p.color))];

const list = (v: string | string[] | undefined) => (v ? (Array.isArray(v) ? v : v.split(",")) : []);

function fromParams(params: Record<string, string | string[] | undefined>): Filters {
  return {
    gender: list(params.gender), category: list(params.category), occasion: list(params.occasion),
    collection: list(params.collection), color: list(params.color),
    tag: typeof params.tag === "string" ? params.tag : "", max: PRICE_CEIL
  };
}

function matches(p: Product, f: Filters, q: string) {
  if (f.gender.length && !f.gender.includes(p.gender)) return false;
  if (f.category.length && !f.category.includes(p.category)) return false;
  if (f.occasion.length && !p.occasions.some(o => f.occasion.includes(o))) return false;
  if (f.collection.length && !f.collection.includes(p.collection)) return false;
  if (f.color.length && !f.color.includes(p.color)) return false;
  if (f.tag && p.tag !== f.tag) return false;
  if (p.price > f.max) return false;
  if (q) {
    const hay = [p.name, p.id, catName(p.category), p.colorName, p.fabric, p.work, collOf(p.collection).name, p.gender, ...p.occasions, p.description].join(" ").toLowerCase();
    if (!q.toLowerCase().split(/\s+/).every(w => hay.includes(w))) return false;
  }
  return true;
}

function titleFor(f: Filters, q: string): [string, string] {
  if (q) return [`Results for “${q}”`, ""];
  if (f.category.length === 1) return [catName(f.category[0]), ""];
  if (f.collection.length === 1) { const c = collOf(f.collection[0]); return [`${c.name} Collection`, c.hint]; }
  if (f.occasion.length === 1) { const o = occasions.find(x => x.key === f.occasion[0]); if (o) return [`${o.name} Edit`, o.hint]; }
  if (f.tag === "new") return ["New Arrivals", ""];
  if (f.tag === "bestseller") return ["Bestsellers", ""];
  if (f.gender.length === 1) return f.gender[0] === "men"
    ? ["Men's Ethnic Wear", "Sherwanis, bandhgalas, kurtas and more."]
    : ["Women's Ethnic Wear", "Lehengas, sarees, anarkalis and more."];
  return ["The Couture Catalog", "Wedding and festive couture, handcrafted in Rajasthan."];
}

export default function Shop() {
  const params = useLocalSearchParams();
  const paramKey = JSON.stringify(params);
  const [f, setF] = useState<Filters>(() => fromParams(params));
  const [q, setQ] = useState(typeof params.q === "string" ? params.q : "");
  const [seenParams, setSeenParams] = useState(paramKey);
  const [sort, setSort] = useState<Sort>("featured");
  const [sheet, setSheet] = useState(false);
  const { cols, cardWidth } = useColumns();

  // arriving from another screen with new filters (e.g. "Shop groom") resets the view
  if (seenParams !== paramKey) {
    setSeenParams(paramKey);
    setF(fromParams(params));
    setQ(typeof params.q === "string" ? params.q : "");
  }

  const results = useMemo(() => {
    const out = products.filter(p => matches(p, f, q.trim()));
    if (sort === "low") out.sort((a, b) => a.price - b.price);
    if (sort === "high") out.sort((a, b) => b.price - a.price);
    if (sort === "new") out.sort((a, b) => Number(b.tag === "new") - Number(a.tag === "new"));
    return out;
  }, [f, q, sort]);

  const toggle = (key: Key, v: string) => setF(s => ({ ...s, [key]: s[key].includes(v) ? s[key].filter(x => x !== v) : [...s[key], v] }));
  const setGender = (g: Gender | "all") => setF(s => ({ ...s, gender: g === "all" ? [] : [g], category: [] }));
  const activeCount = f.category.length + f.occasion.length + f.collection.length + f.color.length + (f.tag ? 1 : 0) + (f.max < PRICE_CEIL ? 1 : 0);
  const clear = () => setF(s => ({ ...fromParams({}), gender: s.gender }));
  const [title, sub] = titleFor(f, q.trim());
  const g = f.gender.length === 1 ? f.gender[0] : "all";
  const cats = g === "all" ? [...categories.men, ...categories.women] : categories[g as Gender];

  const header = (
    <View style={{ paddingBottom: 18 }}>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.text3} />
        <TextInput
          value={q} onChangeText={setQ} placeholder="Search by fabric, colour or style…" placeholderTextColor={colors.text3}
          style={styles.input} returnKeyType="search" autoCorrect={false} accessibilityLabel="Search the catalog"
        />
        {q ? <Pressable onPress={() => setQ("")} hitSlop={8} accessibilityLabel="Clear search"><Icon name="close" size={16} color={colors.text3} /></Pressable> : null}
      </View>
      <Eyebrow style={{ marginTop: 22 }}>{`${results.length} ${results.length === 1 ? "piece" : "pieces"}`}</Eyebrow>
      <Heading size={30}>{title}</Heading>
      {sub ? <Body style={{ marginTop: 4 }}>{sub}</Body> : null}
      <View style={styles.genderRow}>
        {([["all", "All"], ["women", "Bride & Women"], ["men", "Groom & Men"]] as const).map(([k, l]) => (
          <Chip key={k} label={l} active={g === k} onPress={() => setGender(k)} />
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter, marginTop: 10 }} contentContainerStyle={{ paddingHorizontal: gutter, gap: 8 }}>
        <Pressable style={styles.filterBtn} onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel="Filter and sort">
          <Icon name="filter" size={16} color={colors.bg} />
          <Text style={styles.filterText}>FILTER{activeCount ? ` · ${activeCount}` : ""}</Text>
        </Pressable>
        {cats.map(c => <Chip key={c.key} label={c.name} active={f.category.includes(c.key)} onPress={() => toggle("category", c.key)} />)}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <FlatList
        key={cols}
        data={results}
        numColumns={cols}
        keyExtractor={p => p.id}
        renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />}
        columnWrapperStyle={{ gap: GAP }}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 40, gap: 22 }}
        ListHeaderComponent={header}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: 50, gap: 10 }}>
            <Heading size={24}>No match yet</Heading>
            <Body>Try another word or loosen a filter.</Body>
            <Button label="Clear all" variant="ghost" onPress={() => { clear(); setQ(""); }} />
          </View>
        }
      />

      <Modal visible={sheet} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSheet(false)} transparent={false}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Heading size={26}>Filter & sort</Heading>
            <Pressable onPress={() => setSheet(false)} hitSlop={10} accessibilityLabel="Close"><Icon name="close" color={colors.text} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: gutter, gap: 26 }}>
            <Group label="Sort by">{SORTS.map(([k, l]) => <Chip key={k} label={l} active={sort === k} onPress={() => setSort(k)} />)}</Group>
            <Group label="Occasion">{occasions.map(o => <Chip key={o.key} label={o.name} swatch={o.color} active={f.occasion.includes(o.key)} onPress={() => toggle("occasion", o.key)} />)}</Group>
            <Group label="Collection">{collections.map(c => <Chip key={c.key} label={c.name} active={f.collection.includes(c.key)} onPress={() => toggle("collection", c.key)} />)}</Group>
            <Group label="Colour">{usedColors.map(c => <Chip key={c} label={colorTable[c].name} swatch={colorTable[c].hex} active={f.color.includes(c)} onPress={() => toggle("color", c)} />)}</Group>
            <Group label="Price up to">{PRICE_STEPS.map(v => <Chip key={v} label={v === PRICE_CEIL ? "Any price" : inr(v)} active={f.max === v} onPress={() => setF(s => ({ ...s, max: v }))} />)}</Group>
            <Group label="Highlights">
              <Chip label="New arrivals" active={f.tag === "new"} onPress={() => setF(s => ({ ...s, tag: s.tag === "new" ? "" : "new" }))} />
              <Chip label="Bestsellers" active={f.tag === "bestseller"} onPress={() => setF(s => ({ ...s, tag: s.tag === "bestseller" ? "" : "bestseller" }))} />
            </Group>
          </ScrollView>
          <View style={styles.sheetFoot}>
            <Button label="Clear" variant="outline" onPress={clear} style={{ flex: 1 }} />
            <Button label={`Show ${results.length}`} onPress={() => setSheet(false)} style={{ flex: 2 }} />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Eyebrow>{label}</Eyebrow>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  input: { flex: 1, fontFamily: fonts.sans, fontSize: 14, color: colors.text, height: "100%" },
  genderRow: { flexDirection: "row", gap: 8, marginTop: 16, flexWrap: "wrap" },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.gold },
  filterText: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1.6, color: colors.bg },
  sheet: { flex: 1, backgroundColor: colors.bg },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: gutter, paddingTop: 18, paddingBottom: 6 },
  sheetFoot: { flexDirection: "row", gap: 10, padding: gutter, borderTopWidth: 1, borderColor: colors.line }
});
