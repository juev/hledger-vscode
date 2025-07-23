# GitHub Actions Setup

This repository uses GitHub Actions for automated building and publishing of the VS Code extension.

## Required Secrets

To enable automatic publishing to the Visual Studio Marketplace, you need to set up the following secrets in your GitHub repository:

### 1. VSCE_PAT (Visual Studio Code Extension Personal Access Token)

1. Go to https://dev.azure.com/
2. Create a new organization (if you don't have one)
3. Go to User Settings → Personal Access Tokens
4. Create a new token with the following scopes:
   - **Marketplace**: `manage`
5. Add this token as a secret named `VSCE_PAT` in your GitHub repository settings

### 2. OVSX_PAT (Open VSX Registry Personal Access Token) - Optional

1. Go to https://open-vsx.org/
2. Sign in with your GitHub account
3. Go to your profile → Access Tokens
4. Create a new token
5. Add this token as a secret named `OVSX_PAT` in your GitHub repository settings

## Workflows

### CI Workflow (`ci.yml`)
- **Trigger**: Every push and pull request to any branch
- **Actions**:
  - Installs dependencies
  - Compiles TypeScript
  - Runs tests
  - Packages the extension
  - Uploads VSIX artifact

### Release Workflow (`release.yml`)
- **Trigger**: When a tag starting with 'v' is pushed (e.g., `v1.0.0`)
- **Actions**:
  - Runs full CI pipeline
  - Updates package.json version from tag
  - Publishes to Visual Studio Marketplace
  - Publishes to Open VSX Registry (optional)
  - Creates GitHub Release
  - Uploads VSIX as release asset

## Publishing a Release

To publish a new version:

1. Update the version in your local development
2. Commit your changes
3. Create and push a git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
4. The GitHub Action will automatically build and publish the extension

## Publisher Setup

Make sure your `package.json` has the correct publisher name that matches your VS Code Marketplace publisher account.