// Minisign public key for verifying hledger-lsp release signatures.
//
// Generated with: minisign -G -W
// The corresponding private key is stored as the MINISIGN_PRIVATE_KEY
// GitHub Actions secret in juev/hledger-lsp (see juev/hledger-lsp#47).
//
// To rotate: generate a new key pair, update this constant and the
// GitHub Actions secret in the same release cycle.
export const MINISIGN_PUBLIC_KEY =
  "RWQrqo1HFNu6atxzZuaGpH+4mY0MvXUFdu8TmNhyCtsLnp3Seo3YhjP1";
