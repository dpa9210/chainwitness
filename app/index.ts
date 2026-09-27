// Must run before any Solana/MWA code (react-native-get-random-values, the
// Buffer global, and the URL polyfill) and before expo-router's own entry
// takes over root-component registration.
import "./polyfills";

import "expo-router/entry";
