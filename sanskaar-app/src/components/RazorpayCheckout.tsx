/* Razorpay Standard Checkout inside a WebView (works in Expo Go — no native SDK needed).
   UPI app links (upi://, phonepe://, gpay://, …) are handed to the phone so the
   customer can pay in their UPI app. */
import { Linking, Modal, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Address } from "../lib/store";
import { checkoutOptions, PaymentOrder, RazorpaySuccess } from "../lib/payments";
import { colors } from "../lib/theme";

export interface CheckoutProps {
  order: PaymentOrder;
  customer: Address;
  onSuccess(r: RazorpaySuccess): void;
  onDismiss(): void;
  onFailure(reason: string): void;
}

function page(options: object) {
  // "<" escaped so customer text can never close the script tag
  const json = JSON.stringify(options).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:${colors.bg}}</style></head><body>
<script>
  const send = m => window.ReactNativeWebView.postMessage(JSON.stringify(m));
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onerror = () => send({ type: "failed", reason: "Couldn't load the payment page. Please check your connection." });
  s.onload = () => {
    const o = ${json};
    o.handler = r => send({ type: "success", ...r });
    o.modal.ondismiss = () => send({ type: "dismiss" });
    const rzp = new Razorpay(o);
    rzp.on("payment.failed", r => send({ type: "failed", reason: (r.error && r.error.description) || "Payment failed." }));
    rzp.open();
  };
  document.body.appendChild(s);
</script></body></html>`;
}

export function RazorpayCheckout({ order, customer, onSuccess, onDismiss, onFailure }: CheckoutProps) {
  const onMessage = (e: WebViewMessageEvent) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.type === "success") onSuccess(m);
    else if (m.type === "failed") onFailure(m.reason);
    else onDismiss();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onDismiss}>
      <SafeAreaView style={styles.wrap}>
        <View style={{ flex: 1 }}>
          <WebView
            source={{ html: page(checkoutOptions(order, customer)), baseUrl: "https://checkout.razorpay.com" }}
            originWhitelist={["*"]}
            onMessage={onMessage}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            style={{ backgroundColor: colors.bg }}
            onShouldStartLoadWithRequest={req => {
              if (/^(https?|about|data|blob):/i.test(req.url)) return true;
              Linking.openURL(req.url).catch(() => onFailure("That UPI app isn't installed. Please choose another payment method."));
              return false;
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, backgroundColor: colors.bg } });
