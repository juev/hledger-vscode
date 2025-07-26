#!/usr/bin/env node

const { execSync } = require('child_process');

// Get the previous tag and current tag
const currentTag = process.env.GITHUB_REF_NAME || execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
let previousTag;

try {
    // Get all tags sorted by version
    const allTags = execSync('git tag -l --sort=-version:refname', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(tag => tag);
    
    // Find the previous tag
    const currentIndex = allTags.indexOf(currentTag);
    previousTag = currentIndex >= 0 && currentIndex < allTags.length - 1 
        ? allTags[currentIndex + 1] 
        : allTags[1] || execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
    // If no previous tag, use the first commit
    previousTag = execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
}

// Get commits between tags
const commits = execSync(`git log ${previousTag}..${currentTag} --pretty=format:"%s (%h)" --no-merges`, { encoding: 'utf8' })
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
        const match = line.match(/^(.*?)\s*\(([a-f0-9]+)\)$/);
        if (match) {
            return { subject: match[1], hash: match[2] };
        }
        return { subject: line, hash: '' };
    });

if (commits.length === 0) {
    console.log('No changes in this release.');
    process.exit(0);
}

// Categorize commits
const categories = {
    breaking: [],
    added: [],
    changed: [],
    fixed: [],
    removed: [],
    security: [],
    other: []
};

// Keywords for categorization
const keywords = {
    breaking: ['breaking', 'break', '!:'],
    added: ['add', 'feat', 'feature', 'implement', 'new'],
    changed: ['change', 'update', 'improve', 'enhance', 'refactor', 'optimize'],
    fixed: ['fix', 'bug', 'repair', 'resolve', 'correct'],
    removed: ['remove', 'delete', 'drop', 'deprecate'],
    security: ['security', 'vulnerability', 'cve', 'secure']
};

// Categorize each commit
commits.forEach(commit => {
    const lowerSubject = commit.subject.toLowerCase();
    let categorized = false;

    // Check for conventional commit format
    const conventionalMatch = commit.subject.match(/^(\w+)(\(.+\))?!?:\s*(.+)$/);
    if (conventionalMatch) {
        const type = conventionalMatch[1].toLowerCase();
        const isBreaking = commit.subject.includes('!:');
        
        if (isBreaking) {
            categories.breaking.push(commit);
            categorized = true;
        } else if (['feat', 'feature'].includes(type)) {
            categories.added.push(commit);
            categorized = true;
        } else if (['fix', 'bugfix'].includes(type)) {
            categories.fixed.push(commit);
            categorized = true;
        } else if (['refactor', 'perf', 'style'].includes(type)) {
            categories.changed.push(commit);
            categorized = true;
        }
    }

    // If not conventional commit or not categorized yet, use keyword matching
    if (!categorized) {
        for (const [category, words] of Object.entries(keywords)) {
            if (words.some(word => lowerSubject.includes(word))) {
                categories[category].push(commit);
                categorized = true;
                break;
            }
        }
    }

    if (!categorized) {
        categories.other.push(commit);
    }
});

// Build the release notes
let releaseNotes = `## What's Changed\n\n`;

if (categories.breaking.length > 0) {
    releaseNotes += `### ⚠️ Breaking Changes\n`;
    categories.breaking.forEach(commit => {
        releaseNotes += `- ${commit.subject}\n`;
    });
    releaseNotes += '\n';
}

if (categories.security.length > 0) {
    releaseNotes += `### 🔒 Security\n`;
    categories.security.forEach(commit => {
        releaseNotes += `- ${commit.subject}\n`;
    });
    releaseNotes += '\n';
}

if (categories.added.length > 0) {
    releaseNotes += `### ✨ Added\n`;
    categories.added.forEach(commit => {
        releaseNotes += `- ${commit.subject}\n`;
    });
    releaseNotes += '\n';
}

if (categories.changed.length > 0) {
    releaseNotes += `### 🔄 Changed\n`;
    categories.changed.forEach(commit => {
        releaseNotes += `- ${commit.subject}\n`;
    });
    releaseNotes += '\n';
}

if (categories.fixed.length > 0) {
    releaseNotes += `### 🐛 Fixed\n`;
    categories.fixed.forEach(commit => {
        releaseNotes += `- ${commit.subject}\n`;
    });
    releaseNotes += '\n';
}

if (categories.removed.length > 0) {
    releaseNotes += `### 🗑️ Removed\n`;
    categories.removed.forEach(commit => {
        releaseNotes += `- ${commit.subject}\n`;
    });
    releaseNotes += '\n';
}

if (categories.other.length > 0) {
    releaseNotes += `### 📝 Other Changes\n`;
    categories.other.forEach(commit => {
        releaseNotes += `- ${commit.subject}\n`;
    });
    releaseNotes += '\n';
}

releaseNotes += `**Full Changelog**: https://github.com/${process.env.GITHUB_REPOSITORY}/compare/${previousTag}...${currentTag}`;

console.log(releaseNotes);