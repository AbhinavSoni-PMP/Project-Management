/* Line icons — same drawings as the website's icon set */
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "../lib/theme";

export type IconName =
  | "home" | "search" | "heart" | "heartFill" | "bag" | "sparkle" | "calendar" | "truck" | "scissors"
  | "shield" | "whatsapp" | "close" | "back" | "filter" | "plus" | "minus" | "lotus" | "chevron"
  | "user" | "menu" | "globe" | "box";

export function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.6 }: {
  name: IconName; size?: number; color?: string; strokeWidth?: number;
}) {
  const s = { stroke: color, strokeWidth, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "home" && <><Path {...s} d="M3 11 12 4l9 7" /><Path {...s} d="M5 10v10h14V10" /><Path {...s} d="M10 20v-5h4v5" /></>}
      {name === "search" && <><Circle {...s} cx={11} cy={11} r={7} /><Path {...s} d="m20 20-3.5-3.5" /></>}
      {name === "heart" && <Path {...s} d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 4.5 6.6 4.5c2.1 0 3.5 1.2 4.4 2.6.9-1.4 2.3-2.6 4.4-2.6 3.6 0 5.4 3.8 3.8 6.9C19 15.6 12 20 12 20z" />}
      {name === "heartFill" && <Path {...s} fill={color} d="M12 20s-7-4.4-9.2-8.6C1.2 8.3 3 4.5 6.6 4.5c2.1 0 3.5 1.2 4.4 2.6.9-1.4 2.3-2.6 4.4-2.6 3.6 0 5.4 3.8 3.8 6.9C19 15.6 12 20 12 20z" />}
      {name === "bag" && <><Path {...s} d="M5 8h14l-1 12H6L5 8z" /><Path {...s} d="M9 8V6a3 3 0 0 1 6 0v2" /></>}
      {name === "sparkle" && <><Path {...s} d="M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z" /><Path {...s} d="M19 16c.2 1.4.9 2.1 2.3 2.3-1.4.2-2.1.9-2.3 2.3-.2-1.4-.9-2.1-2.3-2.3 1.4-.2 2.1-.9 2.3-2.3z" /></>}
      {name === "calendar" && <><Rect {...s} x={3} y={5} width={18} height={16} rx={1} /><Path {...s} d="M3 10h18M8 3v4M16 3v4" /></>}
      {name === "truck" && <><Path {...s} d="M2 6h12v10H2zM14 10h4l3 3v3h-7z" /><Circle {...s} cx={6} cy={18} r={2} /><Circle {...s} cx={17} cy={18} r={2} /></>}
      {name === "scissors" && <><Circle {...s} cx={6} cy={6} r={3} /><Circle {...s} cx={6} cy={18} r={3} /><Path {...s} d="M8.5 7.5 20 18M8.5 16.5 20 6" /></>}
      {name === "shield" && <><Path {...s} d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3z" /><Path {...s} d="m9 12 2 2 4-4" /></>}
      {name === "whatsapp" && <Path fill={color} d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z" />}
      {name === "close" && <Path {...s} d="M6 6l12 12M18 6 6 18" />}
      {name === "back" && <Path {...s} d="M15 5l-7 7 7 7" />}
      {name === "chevron" && <Path {...s} d="M9 5l7 7-7 7" />}
      {name === "filter" && <Path {...s} d="M4 6h16M7 12h10M10 18h4" />}
      {name === "plus" && <Path {...s} d="M12 5v14M5 12h14" />}
      {name === "minus" && <Path {...s} d="M5 12h14" />}
      {name === "user" && <><Circle {...s} cx={12} cy={8} r={4} /><Path {...s} d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>}
      {name === "menu" && <Path {...s} d="M3 6h18M3 12h18M3 18h12" />}
      {name === "globe" && <><Circle {...s} cx={12} cy={12} r={9} /><Path {...s} d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></>}
      {name === "box" && <><Path {...s} d="M3 7l9-4 9 4v10l-9 4-9-4z" /><Path {...s} d="M3 7l9 4 9-4M12 11v10" /></>}
      {name === "lotus" && <><Path {...s} d="M12 4c2 2.5 2.5 5.5 0 9-2.5-3.5-2-6.5 0-9z" /><Path {...s} d="M12 13c-2.5-1.5-5.5-2-8-1 1 3 4 4.5 8 4.5s7-1.5 8-4.5c-2.5-1-5.5-.5-8 1z" /><Path {...s} d="M5 18h14" /></>}
    </Svg>
  );
}
