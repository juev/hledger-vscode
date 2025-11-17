// HLedgerLexer.ts - Tokenizer for hledger files
// Handles lexical analysis and tokenization of hledger content

import {
    AccountName, PayeeName, TagName, TagValue, CommodityCode,
    createAccountName, createPayeeName, createTagName, createTagValue, createCommodityCode
} from '../types';
import { RegexPatterns } from '../RegexPatterns';

/**
 * Represents different types of hledger lines/tokens
 */
export enum TokenType {
    COMMENT = 'comment',
    EMPTY = 'empty',
    TRANSACTION = 'transaction',
    POSTING = 'posting',
    INCLUDE_DIRECTIVE = 'include',
    ALIAS_DIRECTIVE = 'alias',
    COMMODITY_DIRECTIVE = 'commodity',
    FORMAT_DIRECTIVE = 'format',
    DECIMAL_MARK_DIRECTIVE = 'decimal-mark',
    DEFAULT_COMMODITY_DIRECTIVE = 'default-commodity',
    ACCOUNT_DIRECTIVE = 'account',
    PAYEE_DIRECTIVE = 'payee',
    TAG_DIRECTIVE = 'tag',
    UNKNOWN = 'unknown'
}

/**
 * Token interface representing a parsed line with its type and components
 */
export interface HLedgerToken {
    readonly type: TokenType;
    readonly rawLine: string;
    readonly trimmedLine: string;
    readonly account?: AccountName | undefined;
    readonly payee?: PayeeName | undefined;
    readonly amount?: string | undefined;
    readonly commodity?: CommodityCode | undefined;
    readonly tags?: Map<TagName, Set<TagValue>> | undefined;
    readonly tagName?: TagName | undefined;
    readonly aliasFrom?: AccountName | undefined;
    readonly aliasTo?: AccountName | undefined;
    readonly commoditySymbol?: string | undefined;
    readonly formatPattern?: string | undefined;
    readonly decimalMark?: '.' | ',' | null | undefined;
}

/**
 * Token information for transactions
 */
export interface TransactionToken {
    readonly date: string;
    readonly status?: string | undefined;
    readonly code?: string | undefined;
    readonly description: string;
    readonly payee: PayeeName;
    readonly tags: Map<TagName, Set<TagValue>>;
}

/**
 * Token information for postings
 */
export interface PostingToken {
    readonly account: AccountName;
    readonly amount: string;
    readonly commodity: CommodityCode | undefined;
    readonly balanceAssertion?: boolean;
}

/**
 * Lexer for hledger files - handles tokenization and basic parsing
 */
export class HLedgerLexer {
    /**
     * Tokenizes a single line of hledger content
     */
    public tokenizeLine(line: string, lineNumber: number): HLedgerToken {
        const trimmedLine = line.trim();

        // Empty line
        if (!trimmedLine || trimmedLine === '') {
            return {
                type: TokenType.EMPTY,
                rawLine: line,
                trimmedLine
            };
        }

        // Comment line
        if (trimmedLine.startsWith(';') || trimmedLine.startsWith('#')) {
            return {
                type: TokenType.COMMENT,
                rawLine: line,
                trimmedLine
            };
        }

        // Include directive
        if (trimmedLine.startsWith('include ')) {
            return this.tokenizeIncludeDirective(line, trimmedLine);
        }

        // Alias directive
        if (trimmedLine.startsWith('alias ')) {
            return this.tokenizeAliasDirective(line, trimmedLine);
        }

        // Commodity directive
        if (trimmedLine.startsWith('commodity ')) {
            return this.tokenizeCommodityDirective(line, trimmedLine);
        }

        // Format directive
        if (trimmedLine.startsWith('format ')) {
            return this.tokenizeFormatDirective(line, trimmedLine);
        }

        // Decimal mark directive
        if (trimmedLine.startsWith('decimal-mark ')) {
            return this.tokenizeDecimalMarkDirective(line, trimmedLine);
        }

        // Default commodity directive
        if (trimmedLine.startsWith('default commodity ')) {
            return this.tokenizeDefaultCommodityDirective(line, trimmedLine);
        }

        // Account directive
        if (trimmedLine.startsWith('account ')) {
            return this.tokenizeAccountDirective(line, trimmedLine);
        }

        // Payee directive
        if (trimmedLine.startsWith('payee ')) {
            return this.tokenizePayeeDirective(line, trimmedLine);
        }

        // Tag directive
        if (trimmedLine.startsWith('tag ')) {
            return this.tokenizeTagDirective(line, trimmedLine);
        }

        // Transaction line (starts with date)
        if (this.isTransactionLine(trimmedLine)) {
            const transactionInfo = this.parseTransactionInfo(trimmedLine);
            const tags = this.extractTagsFromLine(trimmedLine);

            return {
                type: TokenType.TRANSACTION,
                rawLine: line,
                trimmedLine,
                payee: transactionInfo.payee,
                tags
            };
        }

        // Posting line (indented)
        if (this.isPostingLine(line)) {
            const postingInfo = this.parsePostingInfo(trimmedLine);
            return {
                type: TokenType.POSTING,
                rawLine: line,
                trimmedLine,
                account: postingInfo.account,
                amount: postingInfo.amount,
                commodity: postingInfo.commodity
            };
        }

        // Unknown line type
        return {
            type: TokenType.UNKNOWN,
            rawLine: line,
            trimmedLine
        };
    }

    /**
     * Tokenizes an entire hledger file content
     */
    public tokenizeContent(content: string): HLedgerToken[] {
        const lines = content.split('\n');
        return lines.map((line, index) => this.tokenizeLine(line, index + 1));
    }

    /**
     * Checks if a line is a transaction line (starts with a date)
     */
    public isTransactionLine(line: string): boolean {
        // Transaction lines start with a date pattern (YYYY/MM/DD, YYYY-MM-DD, etc.)
        return this.testDatePattern(line);
    }

    /**
     * Test if line contains a valid date pattern
     */
    private testDatePattern(line: string): boolean {
        // Simple date pattern check for YYYY/MM/DD, YYYY-MM-DD, YYYY.MM.DD formats
        const datePattern = /^\d{4}[-\/\.]\d{1,2}[-\/\.]\d{1,2}/;
        return datePattern.test(line);
    }

    /**
     * Checks if a line is a posting line (indented)
     */
    public isPostingLine(line: string): boolean {
        // Posting lines are indented and contain account information
        return line.length > 0 && (line[0] === ' ' || line[0] === '\t') &&
               !line.trim().startsWith(';') && !line.trim().startsWith('#');
    }

    /**
     * Extracts transaction information from a transaction line
     */
    public parseTransactionInfo(line: string): TransactionToken {
        // Simple transaction parsing: date [status] [code] description
        const parts = line.trim().split(/\s+/);

        if (parts.length === 0) {
            return {
                date: '',
                description: '',
                payee: createPayeeName('Unknown'),
                tags: new Map()
            };
        }

        // Extract date (first part)
        const date = parts[0];
        let currentIndex = 1;

        // Extract status (single character like * or !)
        let status: string | undefined;
        const statusPart = parts[currentIndex];
        if (statusPart && /^[*!]$/.test(statusPart)) {
            status = statusPart;
            currentIndex++;
        }

        // Extract code (in parentheses)
        let code: string | undefined;
        const codePart = parts[currentIndex];
        if (codePart && codePart.startsWith('(') && codePart.endsWith(')')) {
            code = codePart;
            currentIndex++;
        }

        // Rest is description
        const description = parts.slice(currentIndex).join(' ');

        return {
            date: date ?? '',
            status: status,
            code: code,
            description: description ?? '',
            payee: createPayeeName(description ?? 'Unknown'),
            tags: new Map()
        };
    }

    /**
     * Extracts posting information from a posting line
     */
    public parsePostingInfo(line: string): PostingToken {
        const trimmed = line.trim();

        // Extract account name (everything before amount or comment)
        const accountMatch = trimmed.match(/^([^\s;#]+(?:\s+[^\s;#]+)*?)\s+/);
        const accountName = accountMatch?.[1] ?? trimmed;

        // Extract amount if present
        const amountMatch = trimmed.match(/\s+([+-]?\s*[\d,\.]+\s*[A-Za-z$€£¥₽%]*)/);
        const amount = amountMatch?.[1]?.replace(/\s+/g, '') ?? '';

        // Extract commodity from amount
        const commodityMatch = amount.match(/[A-Za-z$€£¥₽%]+$/);
        const commodity = commodityMatch?.[0] ? createCommodityCode(commodityMatch[0]) : undefined;

        return {
            account: createAccountName(accountName),
            amount: amount,
            commodity: commodity
        };
    }

    /**
     * Extracts tags from a line
     */
    public extractTagsFromLine(line: string): Map<TagName, Set<TagValue>> {
        const tags = new Map<TagName, Set<TagValue>>();

        // Extract tags in format #tagname or #tagname:value
        const tagMatches = line.matchAll(/#(\w+)(?::([^#\s]+))?/g);

        for (const match of tagMatches) {
            const tagName = createTagName(match[1] ?? '');
            const tagValue = match[2] ? createTagValue(match[2]) : createTagValue('');

            if (!tags.has(tagName)) {
                tags.set(tagName, new Set());
            }
            tags.get(tagName)!.add(tagValue);
        }

        return tags;
    }

    /**
     * Tokenizes include directive
     */
    private tokenizeIncludeDirective(rawLine: string, trimmedLine: string): HLedgerToken {
        const match = trimmedLine.match(/^include\s+(.+)$/);
        return {
            type: TokenType.INCLUDE_DIRECTIVE,
            rawLine,
            trimmedLine
        };
    }

    /**
     * Tokenizes alias directive
     */
    private tokenizeAliasDirective(rawLine: string, trimmedLine: string): HLedgerToken {
        const match = trimmedLine.match(RegexPatterns.ALIAS_DIRECTIVE);
        if (match?.[1] && match[2]) {
            return {
                type: TokenType.ALIAS_DIRECTIVE,
                rawLine,
                trimmedLine,
                aliasFrom: createAccountName(match[1]),
                aliasTo: createAccountName(match[2])
            };
        }

        return {
            type: TokenType.ALIAS_DIRECTIVE,
            rawLine,
            trimmedLine
        };
    }

    /**
     * Tokenizes commodity directive
     */
    private tokenizeCommodityDirective(rawLine: string, trimmedLine: string): HLedgerToken {
        const match = trimmedLine.match(/^commodity\s+([A-Za-z$€£¥₽%])/);
        return {
            type: TokenType.COMMODITY_DIRECTIVE,
            rawLine,
            trimmedLine,
            commoditySymbol: match ? match[1] : undefined
        };
    }

    /**
     * Tokenizes format directive
     */
    private tokenizeFormatDirective(rawLine: string, trimmedLine: string): HLedgerToken {
        const match = trimmedLine.match(/^format\s+(.+)$/);
        return {
            type: TokenType.FORMAT_DIRECTIVE,
            rawLine,
            trimmedLine,
            formatPattern: match ? match[1] : undefined
        };
    }

    /**
     * Tokenizes decimal mark directive
     */
    private tokenizeDecimalMarkDirective(rawLine: string, trimmedLine: string): HLedgerToken {
        const match = trimmedLine.match(/^decimal-mark\s+([.,])/);
        const decimalMark = match?.[1] as '.' | ',' | undefined;

        return {
            type: TokenType.DECIMAL_MARK_DIRECTIVE,
            rawLine,
            trimmedLine,
            decimalMark
        };
    }

    /**
     * Tokenizes default commodity directive
     */
    private tokenizeDefaultCommodityDirective(rawLine: string, trimmedLine: string): HLedgerToken {
        const match = trimmedLine.match(/^default commodity\s+([A-Za-z$€£¥₽%])/);
        const commodity = match?.[1] ? createCommodityCode(match[1]) : undefined;

        return {
            type: TokenType.DEFAULT_COMMODITY_DIRECTIVE,
            rawLine,
            trimmedLine,
            commodity
        };
    }

    /**
     * Tokenizes account directive
     */
    private tokenizeAccountDirective(rawLine: string, trimmedLine: string): HLedgerToken {
        const match = trimmedLine.match(/^account\s+(.+)$/);
        const account = match?.[1] ? createAccountName(match[1]) : undefined;

        return {
            type: TokenType.ACCOUNT_DIRECTIVE,
            rawLine,
            trimmedLine,
            account
        };
    }

    /**
     * Tokenizes payee directive
     */
    private tokenizePayeeDirective(rawLine: string, trimmedLine: string): HLedgerToken {
        const match = trimmedLine.match(/^payee\s+(.+)$/);
        const payee = match?.[1] ? createPayeeName(match[1]) : undefined;

        return {
            type: TokenType.PAYEE_DIRECTIVE,
            rawLine,
            trimmedLine,
            payee
        };
    }

    /**
     * Tokenizes tag directive
     */
    private tokenizeTagDirective(rawLine: string, trimmedLine: string): HLedgerToken {
        const match = trimmedLine.match(/^tag\s+(\w+)(?:\s+(.+))?$/);
        const tagName = match?.[1] ? createTagName(match[1]) : undefined;

        return {
            type: TokenType.TAG_DIRECTIVE,
            rawLine,
            trimmedLine,
            tagName
        };
    }
}