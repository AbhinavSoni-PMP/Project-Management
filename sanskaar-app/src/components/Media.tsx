/* Real photo when the website has one, otherwise the illustrated preview —
   the same rule the website follows. */
import { Image } from "expo-image";
import { memo } from "react";
import { StyleProp, StyleSheet, View as RNView, ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";
import { garmentSvg, SceneOpts, sceneSvg } from "../lib/art";
import { Product, productPhoto, sitePhoto, View } from "../lib/catalog";
import { colors } from "../lib/theme";

export const ProductMedia = memo(function ProductMedia({ product, view = "front", style }: {
  product: Product; view?: View; style?: StyleProp<ViewStyle>;
}) {
  const photo = productPhoto(product, view);
  return (
    <RNView style={[styles.box, style]}>
      {photo
        ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={`${product.name} — ${view} view`} />
        : <SvgXml xml={garmentSvg(product, view)} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />}
    </RNView>
  );
});

/** Site photo (e.g. "site/hero.jpg") with an illustrated Rajasthani scene as fallback. */
export const SiteMedia = memo(function SiteMedia({ src, scene, style, children }: {
  src: string; scene: SceneOpts & { key: string };
  style?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  const photo = sitePhoto(src);
  return (
    <RNView style={[styles.box, style]}>
      {photo
        ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        : <SvgXml xml={sceneSvg(scene.key, scene)} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />}
      {children}
    </RNView>
  );
});

const styles = StyleSheet.create({
  box: { overflow: "hidden", backgroundColor: colors.surface }
});
