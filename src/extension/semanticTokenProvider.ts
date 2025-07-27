import * as vscode from 'vscode';

export const TOKEN_TYPES = [
    'hledgerDate',
    'hledgerAccount',
    'hledgerAmount',
    'hledgerCommodity',
    'hledgerPayee',
    'hledgerComment',
    'hledgerTag',
    'hledgerDirective'
];

export const TOKEN_MODIFIERS = [
    'defined',
    'used',
    'virtual'
];

export class HLedgerSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
    private static readonly tokenTypesLegend = new vscode.SemanticTokensLegend(TOKEN_TYPES, TOKEN_MODIFIERS);

    static getLegend(): vscode.SemanticTokensLegend {
        return HLedgerSemanticTokensProvider.tokenTypesLegend;
    }

    provideDocumentSemanticTokens(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.SemanticTokens> {
        const tokensBuilder = new vscode.SemanticTokensBuilder(HLedgerSemanticTokensProvider.tokenTypesLegend);
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            this.parseLineForTokens(line, tokensBuilder);
        }
        
        return tokensBuilder.build();
    }

    private parseLineForTokens(line: vscode.TextLine, tokensBuilder: vscode.SemanticTokensBuilder): void {
        const text = line.text;
        const lineNumber = line.lineNumber;

        // Skip empty lines
        if (!text.trim()) {
            return;
        }

        // Comments
        if (text.match(/^\s*[;#]/)) {
            this.parseCommentLine(text, lineNumber, tokensBuilder);
            return;
        }

        // Directives
        const directiveMatch = text.match(/^(account|commodity|D|decimal-mark|include|P|payee|tag|year|alias|apply account|end apply account|comment|end comment|Y)\b/);
        if (directiveMatch) {
            this.parseDirectiveLine(text, lineNumber, tokensBuilder);
            return;
        }

        // Transactions (date at start of line)
        const transactionMatch = text.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
        if (transactionMatch) {
            this.parseTransactionLine(text, lineNumber, tokensBuilder);
            return;
        }

        // Postings (indented lines)
        if (text.match(/^\s+\S/)) {
            this.parsePostingLine(text, lineNumber, tokensBuilder);
            return;
        }
    }

    private parseCommentLine(text: string, lineNumber: number, tokensBuilder: vscode.SemanticTokensBuilder): void {
        // Mark entire line as comment
        tokensBuilder.push(lineNumber, 0, text.length, this.getTokenType('hledgerComment'), 0);

        // Parse tags within comments
        const tagRegex = /([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):([^\s,;]+)/g;
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            const tagStart = match.index;
            const tagLength = match[1].length;
            tokensBuilder.push(lineNumber, tagStart, tagLength, this.getTokenType('hledgerTag'), 0);
        }
    }

    private parseDirectiveLine(text: string, lineNumber: number, tokensBuilder: vscode.SemanticTokensBuilder): void {
        const directiveMatch = text.match(/^(account|commodity|D|decimal-mark|include|P|payee|tag|year|alias|apply account|end apply account|comment|end comment|Y)\b/);
        if (directiveMatch) {
            tokensBuilder.push(lineNumber, 0, directiveMatch[1].length, this.getTokenType('hledgerDirective'), 0);
        }

        // Parse account in account directive
        const accountMatch = text.match(/^account\s+([^;]+)/);
        if (accountMatch) {
            const accountStart = text.indexOf(accountMatch[1]);
            tokensBuilder.push(lineNumber, accountStart, accountMatch[1].trim().length, 
                this.getTokenType('hledgerAccount'), this.getTokenModifier('defined'));
        }

        // Parse commodity in commodity directive
        const commodityMatch = text.match(/^commodity\s+(.+)/);
        if (commodityMatch) {
            const commodityStart = text.indexOf(commodityMatch[1]);
            tokensBuilder.push(lineNumber, commodityStart, commodityMatch[1].trim().length, 
                this.getTokenType('hledgerCommodity'), this.getTokenModifier('defined'));
        }
    }

    private parseTransactionLine(text: string, lineNumber: number, tokensBuilder: vscode.SemanticTokensBuilder): void {
        // Parse date
        const dateMatch = text.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})/);
        if (dateMatch) {
            tokensBuilder.push(lineNumber, 0, dateMatch[1].length, this.getTokenType('hledgerDate'), 0);
        }

        // Parse payee/description
        const transactionMatch = text.match(/^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2})\s*(\*|!)?\s*(\([^)]+\))?\s*([^;]+)/);
        if (transactionMatch && transactionMatch[4]) {
            const payeeStart = text.indexOf(transactionMatch[4]);
            const payeeText = transactionMatch[4].trim();
            if (payeeText) {
                tokensBuilder.push(lineNumber, payeeStart, payeeText.length, this.getTokenType('hledgerPayee'), 0);
            }
        }

        // Parse comment
        const commentMatch = text.match(/;\s*(.+)$/);
        if (commentMatch) {
            const commentStart = text.indexOf(';');
            tokensBuilder.push(lineNumber, commentStart, text.length - commentStart, this.getTokenType('hledgerComment'), 0);
            
            // Parse tags in comment
            this.parseTagsInText(commentMatch[1], lineNumber, commentStart + 1, tokensBuilder);
        }
    }

    private parsePostingLine(text: string, lineNumber: number, tokensBuilder: vscode.SemanticTokensBuilder): void {
        // Parse account
        const accountMatch = text.match(/^\s+([A-Za-z\u0400-\u04FF][^;]+?)(?:\s{2,}|$)/);
        if (accountMatch) {
            const accountStart = text.indexOf(accountMatch[1]);
            const accountText = accountMatch[1].trim();
            
            // Check if it's a virtual account
            const isVirtual = accountText.match(/^\(.*\)$/) || accountText.match(/^\[.*\]$/);
            const modifier = isVirtual ? this.getTokenModifier('virtual') : this.getTokenModifier('used');
            
            tokensBuilder.push(lineNumber, accountStart, accountText.length, 
                this.getTokenType('hledgerAccount'), modifier);
        }

        // Parse amounts and commodities
        this.parseAmountsInLine(text, lineNumber, tokensBuilder);

        // Parse comment
        const commentMatch = text.match(/;\s*(.+)$/);
        if (commentMatch) {
            const commentStart = text.indexOf(';');
            tokensBuilder.push(lineNumber, commentStart, text.length - commentStart, this.getTokenType('hledgerComment'), 0);
            
            // Parse tags in comment
            this.parseTagsInText(commentMatch[1], lineNumber, commentStart + 1, tokensBuilder);
        }
    }

    private parseAmountsInLine(text: string, lineNumber: number, tokensBuilder: vscode.SemanticTokensBuilder): void {
        // Simplified and more reliable amount parsing
        
        // Pattern 1: Number followed by commodity (100 USD, 100USD, 730, 999)
        const numberCommodityPattern = /([-+]?\d+(?:[.,]\d+)*)\s*([A-Za-z0-9$£€¥₹₽₿₩₪₨₦₡₵₺₴₼₢₸₷₶₹₵₫₪₨₽]+)?/g;
        let match;
        
        while ((match = numberCommodityPattern.exec(text)) !== null) {
            const fullMatch = match[0];
            const number = match[1];
            const commodity = match[2];
            
            // Skip if this looks like a date or account part
            if (match.index > 0 && text[match.index - 1].match(/[-/.]/)) {
                continue;
            }
            
            // Mark the number part
            if (number) {
                const numberStart = match.index;
                tokensBuilder.push(lineNumber, numberStart, number.length, this.getTokenType('hledgerAmount'), 0);
            }
            
            // Mark the commodity part if present
            if (commodity) {
                const commodityStart = match.index + fullMatch.indexOf(commodity);
                tokensBuilder.push(lineNumber, commodityStart, commodity.length, this.getTokenType('hledgerCommodity'), 0);
            }
        }
        
        // Pattern 2: Commodity followed by number (USD 100, RUB 111)
        const commodityNumberPattern = /([A-Za-z0-9$£€¥₹₽₿₩₪₨₦₡₵₺₴₼₢₸₷₶₹₵₫₪₨₽]+)\s+([-+]?\d+(?:[.,]\d+)*)/g;
        
        while ((match = commodityNumberPattern.exec(text)) !== null) {
            const commodity = match[1];
            const number = match[2];
            
            // Mark the commodity part
            const commodityStart = match.index;
            tokensBuilder.push(lineNumber, commodityStart, commodity.length, this.getTokenType('hledgerCommodity'), 0);
            
            // Mark the number part
            const numberStart = match.index + match[0].indexOf(number);
            tokensBuilder.push(lineNumber, numberStart, number.length, this.getTokenType('hledgerAmount'), 0);
        }
        
        // Pattern 3: Quoted commodities: 100 "My Currency" or "My Currency" 100
        const quotedCommodityPattern = /([-+]?\d+(?:[.,]\d+)*\s*)?("([^"]+)")\s*([-+]?\d+(?:[.,]\d+)*)?/g;
        
        while ((match = quotedCommodityPattern.exec(text)) !== null) {
            const beforeNumber = match[1];
            const quotedCommodity = match[2];
            const afterNumber = match[4];
            
            // Mark quoted commodity
            const commodityStart = match.index + (beforeNumber ? beforeNumber.length : 0);
            tokensBuilder.push(lineNumber, commodityStart, quotedCommodity.length, this.getTokenType('hledgerCommodity'), 0);
            
            // Mark number before if present
            if (beforeNumber) {
                const numberStart = match.index;
                tokensBuilder.push(lineNumber, numberStart, beforeNumber.trim().length, this.getTokenType('hledgerAmount'), 0);
            }
            
            // Mark number after if present
            if (afterNumber) {
                const numberStart = match.index + match[0].indexOf(afterNumber);
                tokensBuilder.push(lineNumber, numberStart, afterNumber.trim().length, this.getTokenType('hledgerAmount'), 0);
            }
        }
    }

    private parseTagsInText(text: string, lineNumber: number, offset: number, tokensBuilder: vscode.SemanticTokensBuilder): void {
        const tagRegex = /([a-zA-Z\u0400-\u04FF][a-zA-Z\u0400-\u04FF0-9_]*):([^\s,;]+)/g;
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            const tagStart = offset + match.index;
            const tagLength = match[1].length;
            tokensBuilder.push(lineNumber, tagStart, tagLength, this.getTokenType('hledgerTag'), 0);
        }
    }

    private getTokenType(tokenType: string): number {
        return TOKEN_TYPES.indexOf(tokenType);
    }

    private getTokenModifier(modifier: string): number {
        return 1 << TOKEN_MODIFIERS.indexOf(modifier);
    }
}