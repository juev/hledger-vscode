export { BinaryManager, getPlatformInfo, getBinaryName } from "./BinaryManager";
export type { PlatformInfo, ReleaseInfo, ReleaseAsset } from "./BinaryManager";

export { HLedgerLanguageClient, LanguageClientState } from "./HLedgerLanguageClient";
export { createServerOptions, createClientOptions } from "./HLedgerLanguageClient";
export type { ServerOptionsConfig } from "./HLedgerLanguageClient";

export { mapVSCodeSettingsToLSP } from "./settingsMapper";
export type { VSCodeSettings, LSPSettings } from "./settingsMapper";

export { applySortingHack, convertTemplateToSnippet, processCompletionList } from "./completionMiddleware";
export type { CompletionItem, CompletionList, SnippetOptions } from "./completionMiddleware";

export type { CompletionDataProvider, CompletionData, TransactionTemplate, Posting } from "./CompletionDataProvider";

export { LSPManager, LSPStatus } from "./LSPManager";
export type { LSPManagerLike } from "./LSPManager";

export { StartupChecker } from "./StartupChecker";
export type { CheckResult, CheckAction } from "./StartupChecker";

export {
  hasCustomLSPPath,
  isLSPUpdateCheckEnabled,
  getCustomLSPPath,
} from "./lspConfig";
