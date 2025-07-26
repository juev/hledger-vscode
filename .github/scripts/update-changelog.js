#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get the current version from the tag
const currentTag = process.env.GITHUB_REF_NAME || execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
const version = currentTag.replace(/^v/, '');

// Get the current date in ISO format
const releaseDate = new Date().toISOString().split('T')[0];

// Get previous tag
let previousTag;
try {
    const allTags = execSync('git tag -l --sort=-version:refname', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(tag => tag);
    
    const currentIndex = allTags.indexOf(currentTag);
    previousTag = currentIndex >= 0 && currentIndex < allTags.length - 1 
        ? allTags[currentIndex + 1] 
        : allTags[1] || execSync('git rev-list --max-parents=0 HEAD', { encoding: 'utf8' }).trim();
} catch (error) {
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

// Categorize commits (same logic as generate-release-notes.js)
const categories = {
    breaking: [],
    added: [],
    changed: [],
    fixed: [],
    removed: [],
    security: [],
    other: []
};

const keywords = {
    breaking: ['breaking', 'break', '!:'],
    added: ['add', 'feat', 'feature', 'implement', 'new'],
    changed: ['change', 'update', 'improve', 'enhance', 'refactor', 'optimize'],
    fixed: ['fix', 'bug', 'repair', 'resolve', 'correct'],
    removed: ['remove', 'delete', 'drop', 'deprecate'],
    security: ['security', 'vulnerability', 'cve', 'secure']
};

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

// Build the changelog entry
let changelogEntry = `## [${version}] - ${releaseDate}\n\n`;

if (categories.breaking.length > 0) {
    changelogEntry += `### Breaking Changes\n`;
    categories.breaking.forEach(commit => {
        changelogEntry += `- ${commit.subject}\n`;
    });
    changelogEntry += '\n';
}

if (categories.security.length > 0) {
    changelogEntry += `### Security\n`;
    categories.security.forEach(commit => {
        changelogEntry += `- ${commit.subject}\n`;
    });
    changelogEntry += '\n';
}

if (categories.added.length > 0) {
    changelogEntry += `### Added\n`;
    categories.added.forEach(commit => {
        changelogEntry += `- ${commit.subject}\n`;
    });
    changelogEntry += '\n';
}

if (categories.changed.length > 0) {
    changelogEntry += `### Changed\n`;
    categories.changed.forEach(commit => {
        changelogEntry += `- ${commit.subject}\n`;
    });
    changelogEntry += '\n';
}

if (categories.fixed.length > 0) {
    changelogEntry += `### Fixed\n`;
    categories.fixed.forEach(commit => {
        changelogEntry += `- ${commit.subject}\n`;
    });
    changelogEntry += '\n';
}

if (categories.removed.length > 0) {
    changelogEntry += `### Removed\n`;
    categories.removed.forEach(commit => {
        changelogEntry += `- ${commit.subject}\n`;
    });
    changelogEntry += '\n';
}

if (categories.other.length > 0) {
    changelogEntry += `### Other\n`;
    categories.other.forEach(commit => {
        changelogEntry += `- ${commit.subject}\n`;
    });
    changelogEntry += '\n';
}

// Read existing CHANGELOG.md or create new one
const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
let existingChangelog = '';

if (fs.existsSync(changelogPath)) {
    existingChangelog = fs.readFileSync(changelogPath, 'utf8');
} else {
    existingChangelog = '# Change Log\n\nAll notable changes to the "hledger" extension will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n';
}

// Check if this version already exists in the changelog
if (existingChangelog.includes(`## [${version}]`)) {
    console.log(`Version ${version} already exists in CHANGELOG.md, skipping update.`);
    process.exit(0);
}

// Insert new entry after the header
const headerEnd = existingChangelog.indexOf('\n\n') + 2;
const newChangelog = existingChangelog.slice(0, headerEnd) + changelogEntry + '\n' + existingChangelog.slice(headerEnd);

// Write updated changelog
fs.writeFileSync(changelogPath, newChangelog);

console.log(`Updated CHANGELOG.md with version ${version}`);