import { Linking } from "react-native";
import { config } from "./catalog";

export const whatsappUrl = (text: string) =>
  `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text)}`;

export const openWhatsApp = (text: string) => Linking.openURL(whatsappUrl(text));
