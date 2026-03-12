// Must be imported before any Solana code
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "text-encoding-polyfill";
import { Buffer } from "@craftzdog/react-native-buffer";

// Polyfill Buffer globally for Solana libs
if (typeof global.Buffer === "undefined") {
  (global as any).Buffer = Buffer;
}
