export interface CompletionItem {
  label: string;
  sortText?: string;
  filterText?: string;
  insertText?: string;
  insertTextFormat?: number;
  kind?: number;
  detail?: string;
  documentation?: string;
}

export interface CompletionList {
  isIncomplete: boolean;
  items: CompletionItem[];
}

export interface SnippetOptions {
  addFinalTabstop?: boolean;
}

export function applySortingHack(
  items: CompletionItem[],
  query: string | undefined
): CompletionItem[] {
  const filterText = query ?? "";

  return items.map((item) => ({
    ...item,
    filterText,
  }));
}

export function convertTemplateToSnippet(
  template: string,
  options?: SnippetOptions
): string {
  let result = template;

  if (options?.addFinalTabstop && !result.includes("$0")) {
    result = result + "$0";
  }

  return result;
}

export function processCompletionList(
  list: CompletionList,
  query: string
): CompletionList {
  const processedItems = applySortingHack(list.items, query);

  const finalItems = processedItems.map((item) => {
    if (item.insertTextFormat === 2 && item.insertText) {
      return {
        ...item,
        insertText: convertTemplateToSnippet(item.insertText),
      };
    }
    return item;
  });

  return {
    isIncomplete: true,
    items: finalItems,
  };
}
