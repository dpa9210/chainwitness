// Must be imported before any @solana/web3.js or MWA code touches the RN runtime.
import "react-native-get-random-values";
import { Buffer } from "buffer";
import "react-native-url-polyfill/auto";

// @solana/web3.js expects a global Buffer to exist (Node-style), which RN doesn't provide.
if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}
