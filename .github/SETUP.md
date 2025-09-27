# GitHub Actions Setup

This repository uses GitHub Actions for automated building and publishing of the VS Code extension.

## Required Secrets

To enable automatic publishing to the Visual Studio Marketplace and Open VSX Registry, add the following secrets in your GitHub repository:

### 1. VSCE_PAT (Visual Studio Code Extension Personal Access Token)

1. Go to https://dev.azure.com/
2. Create a new organization (if you don't have one)
3. Go to User Settings → Personal Access Tokens
4. Create a new token with the following scopes:
   - **Marketplace**: `manage`
5. Add this token as a secret named `VSCE_PAT` in your GitHub repository settings

### 2. OVSX_PAT (Open VSX Registry Personal Access Token)

Required if you want to publish to Open VSX (used by VSCodium and other editors).

1. Go to https://open-vsx.org/
2. Sign in with your GitHub account
3. Go to your profile → Access Tokens
4. Create a new token
5. Add this token as a secret named `OVSX_PAT` in your GitHub repository settings

## Open VSX Namespace Configuration

Before publishing to Open VSX, make sure the following is set up:
- The `publisher` in `package.json` matches an existing Open VSX namespace you own or maintain (current value: `evsyukov`).
- If the namespace does not exist, create/claim it from your Open VSX profile (Profile → Namespaces) and add maintainers as needed.
- For organization namespaces, verify the GitHub organization in Open VSX and ensure the publishing user is a maintainer.
- You can verify your namespace at: https://open-vsx.org/namespace/evsyukov

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

1. Ensure the main branch is green (CI passing).
2. Create and push a semantic version tag (the workflow will update package.json and CHANGELOG.md automatically):
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. Wait for the Release workflow to complete. It will:
   - Publish to Visual Studio Marketplace (requires `VSCE_PAT`)
   - Publish to Open VSX (requires `OVSX_PAT`)
   - Create a GitHub Release and upload the packaged `.vsix`
4. Verify the listings:
   - Marketplace: https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger
   - Open VSX: https://open-vsx.org/extension/evsyukov/hledger

## Manual Publishing (optional)

You can also publish locally if needed:

- Visual Studio Marketplace:
  ```bash
  npx vsce publish -p "$VSCE_PAT"
  ```
- Open VSX:
  ```bash
  npx ovsx publish -p "$OVSX_PAT"
  ```

## Publisher Setup

Make sure your `package.json` has a valid `publisher` that:
- Exists as a Publisher in the Visual Studio Marketplace.
- Exists as a Namespace in Open VSX (or is claimed by you).
Both listings must use the same `publisher` value for automated publishing to succeed.