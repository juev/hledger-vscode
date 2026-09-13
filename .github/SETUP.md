# GitHub Actions Setup

Release tags publish the extension to Visual Studio Marketplace using Microsoft Entra ID and, when configured, to Open VSX using a personal access token. The workflow also uploads the packaged `.vsix` to GitHub Releases.

## Marketplace authentication

Create a GitHub environment named `marketplace`. Allow the `main` branch for credential checks and tags matching `v*` for releases. Add these environment variables:

| Variable | Value |
| --- | --- |
| `AZURE_CLIENT_ID` | Application (client) ID of the publishing app |
| `AZURE_TENANT_ID` | Directory (tenant) ID of the publishing app |

Configure the app once:

1. Create a single-tenant app registration and service principal in Microsoft Entra ID.
2. Add a federated credential with issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, and subject `repo:juev/hledger-vscode:environment:marketplace`.
3. Add the service principal to an Azure DevOps organization connected to the same Entra tenant. Use the service principal object ID, which differs from the app registration object ID and the client ID.
4. Authenticate as the app and retrieve its Azure DevOps profile ID. The **Publishing credentials** workflow prints this ID in the **Show Marketplace profile identity** step. Run it on `main` after configuring the environment and federation; the subsequent publisher-access check is expected to fail until step 5 is complete. The equivalent command in an app-authenticated session is:
   ```bash
   az rest --url https://app.vssps.visualstudio.com/_apis/profile/profiles/me \
     --resource 499b84ac-1321-427f-aa17-267ca6975798 --query id --output tsv
   ```
5. In the existing Marketplace publisher `evsyukov`, add that profile ID as a member with the **Contributor** role, then rerun **Publishing credentials**. Use the Profile API result rather than the service principal entitlement ID returned by the organization API.

The workflows use `azure/login` with `allow-no-subscriptions: true`, followed by `vsce --azure-credential`. They obtain credentials through GitHub OIDC. This app-registration setup does not require an Azure subscription or a client secret.

Keep the existing `VSCE_PAT` during migration. Remove the GitHub secret and revoke the old PAT only after a release succeeds with Entra authentication. The new workflows do not pass that PAT to `vsce`.

References: [Entra federation for GitHub Actions](https://learn.microsoft.com/en-us/entra/workload-id/workload-identity-federation-create-trust), [Azure DevOps identity registration](https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/service-principal-managed-identity), [Marketplace publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace).

## Open VSX authentication

Open VSX publication is optional. To enable it:

1. Sign in to [Open VSX](https://open-vsx.org/) and create a personal access token under Settings → Access Tokens.
2. Save it as the repository secret `OVSX_PAT`.
3. Set the repository variable `OVSX_PAT_EXPIRES_AT` to the expiration date shown by Open VSX, in `YYYY-MM-DD` format (UTC). Use `never` only when Open VSX explicitly shows **Expires: never**.
4. Ensure the publishing account owns or maintains the namespace [evsyukov](https://open-vsx.org/namespace/evsyukov), matching `publisher` in `package.json`.

When replacing a token, update both `OVSX_PAT` and `OVSX_PAT_EXPIRES_AT`. GitHub's secret update timestamp is not the token's expiration date.

## Credential checks

The **Publishing credentials** workflow runs daily at 08:17 UTC and can also be run manually on `main` from the Actions page. It does not publish an extension.

- The Marketplace job checks GitHub OIDC login and publisher membership using `vsce verify-pat evsyukov --azure-credential`. Membership verification also accepts a Reader role, so it does not replace checking the app's Contributor assignment or validating an actual release.
- The Open VSX job calls the registry's namespace token-verification API. It fails for invalid tokens, missing permissions, failed requests, or missing expiration metadata. For dated tokens it also fails starting 14 days before expiration; the recorded date is treated as midnight UTC. Tokens marked `never` still undergo API validation. If `OVSX_PAT` is absent, this optional check is skipped.

Enable email notifications for failed GitHub Actions workflows in your GitHub notification settings. Check that the scheduled workflow remains enabled: GitHub can disable scheduled workflows in public repositories after 60 days without repository activity.

Run the helper's tests locally with:

```bash
node --test .github/scripts/check-ovsx-token.test.mjs
```

## Publishing a release

1. Ensure `main` passes CI and the Publishing credentials workflow passes.
2. Create and push a semantic version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. The Release workflow checks source types, runs tests, updates the package version and changelog, packages the extension, publishes to both configured registries, and creates a GitHub Release with the `.vsix` asset.
4. Verify the new version in [Marketplace](https://marketplace.visualstudio.com/items?itemName=evsyukov.hledger), [Open VSX](https://open-vsx.org/extension/evsyukov/hledger), and GitHub Releases.

CI runs source and test type checks, lint, publishing-helper tests, extension tests with coverage, and VSIX packaging. A registry failure in the Release workflow currently prevents the later publication steps from running.

## Manual publishing

For Marketplace, sign in to Azure CLI as an identity with publishing rights, then run:

```bash
env -u VSCE_PAT npx vsce verify-pat evsyukov --azure-credential
env -u VSCE_PAT npx vsce publish --azure-credential
```

For Open VSX, supply the token through the environment:

```bash
npx ovsx publish -p "$OVSX_PAT"
```
