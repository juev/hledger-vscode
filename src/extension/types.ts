export type AccountName = string;
export type PayeeName = string;
export type CompletionScore = number;
export type UsageCount = number;
export const createCompletionScore = (value: number): CompletionScore => value;
export const createUsageCount = (value: number): UsageCount => value;
