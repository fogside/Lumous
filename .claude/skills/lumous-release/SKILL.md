---
name: lumous-release
description: "How to build and publish a new release of the Lumous Tauri app. Use this skill whenever the user asks to make a release, bump the version, publish a build, create a GitHub release, or ship an update. Also use it when the user mentions the updater, latest.json, signing, or DMG artifacts — even if they don't say 'release' explicitly."
---

# Lumous Release Process

This skill covers the full release workflow for Lumous, a Tauri v2 desktop app. Each release uploads exactly two artifacts to GitHub: `Lumous.app.tar.gz` (the signed app bundle) and `latest.json` (the updater manifest). No DMG files.

## Why no DMG?

macOS quarantines files downloaded through browsers, flagging unsigned apps as "damaged." Users install Lumous via a one-liner `curl` command that bypasses Gatekeeper entirely:

```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
```

This is documented in the README. The `.app.tar.gz` serves both as the install artifact (via curl) and as the updater bundle (via `tauri-plugin-updater`). The DMG is still built locally but is never uploaded.

## Why `latest.json` matters

Lumous has a built-in auto-updater (via `tauri-plugin-updater`). It checks this endpoint on every launch:

```
https://github.com/fogside/Lumous/releases/latest/download/latest.json
```

If `latest.json` is missing from the release, users on older versions will never see the update. Without both `latest.json` and `Lumous.app.tar.gz`, the in-app updater is broken. Every release must include both files.

## Pre-flight

Before starting, make sure:

1. All changes are committed and pushed to `main`
2. The signing key is available. The private key lives at `~/.tauri/WandDo.key` (minisign format, empty password). Set it in the environment before building:
   ```bash
   export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/WandDo.key)"
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
   ```
   Without this, the build skips the updater signature (no `.tar.gz.sig`), which means `latest.json` can't be generated. The corresponding public key is in `~/.tauri/WandDo.key.pub` and matches what's configured in `tauri.conf.json`.
3. Node 20 is active and Cargo is in PATH:
   ```bash
   export PATH="$HOME/.cargo/bin:$PATH"
   source ~/.nvm/nvm.sh && nvm use 20
   ```

## Step 1: Bump the version

Update the version in both places — they must match:

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |

Use semantic versioning:
- **Patch** (1.2.1 → 1.2.2): bug fixes, small tweaks
- **Minor** (1.2.x → 1.3.0): new features, UI additions
- **Major** (1.x → 2.0.0): breaking changes, major redesigns

## Step 2: Update RELEASES.md

Prepend a new section to the top of `RELEASES.md` (right after the `# Releases` heading) with the changelog for this version. Follow the existing format:

```markdown
## vX.Y.Z — Short Title

*YYYY-MM-DD*

- **Feature name** — brief description
- **Another change** — brief description

### Install

\`\`\`bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
\`\`\`

---
```

Summarize all changes since the last release by reviewing the git log. Each bullet should have a bold label and a short explanation. Keep it concise.

Commit the version bump and changelog together:
```bash
git add package.json src-tauri/tauri.conf.json RELEASES.md
git commit -m "Bump version to X.Y.Z"
git push
```

## Step 3: Build with signing

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/WandDo.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
export PATH="$HOME/.cargo/bin:$PATH"
npm run tauri build
```

A successful signed build produces:
```
src-tauri/target/release/bundle/
  macos/Lumous.app.tar.gz            # Signed app bundle (install + updater)
  macos/Lumous.app.tar.gz.sig        # Signature for updater verification
  dmg/Lumous_X.Y.Z_aarch64.dmg      # Built locally but NOT uploaded
```

If you see the error `A public key has been found, but no private key`, the signing key is missing. Stop and set `TAURI_SIGNING_PRIVATE_KEY` before retrying.

## Step 4: Generate `latest.json`

Tauri does not auto-generate `latest.json` as a file on disk. Create it manually from the build outputs:

```bash
VERSION=$(python3 -c "import json; print(json.load(open('src-tauri/tauri.conf.json'))['version'])")
SIGNATURE=$(cat src-tauri/target/release/bundle/macos/Lumous.app.tar.gz.sig)
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > /tmp/latest.json << EOF
{
  "version": "${VERSION}",
  "notes": "",
  "pub_date": "${PUB_DATE}",
  "platforms": {
    "darwin-aarch64": {
      "signature": "${SIGNATURE}",
      "url": "https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz"
    }
  }
}
EOF
```

Fill in the `"notes"` field with a brief one-liner describing the release. This text may be shown in the updater dialog.

## Step 5: Create the GitHub release

Tag, push, and create the release with the two artifacts (no DMG):

```bash
git tag vX.Y.Z
git push origin vX.Y.Z

gh release create vX.Y.Z \
  "src-tauri/target/release/bundle/macos/Lumous.app.tar.gz" \
  "/tmp/latest.json" \
  --title "vX.Y.Z" \
  --notes "$(cat <<'EOF'
## What's Changed

- bullet points here

### Install

\`\`\`bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications && open /Applications/Lumous.app
\`\`\`

**Full Changelog**: https://github.com/fogside/Lumous/compare/vPREV...vX.Y.Z
EOF
)"
```

## Step 6: Verify

Confirm both artifacts are present:

```bash
gh release view vX.Y.Z --json assets \
  | python3 -c "import json,sys; [print(a['name']) for a in json.load(sys.stdin)['assets']]"
```

Expected output:
```
Lumous.app.tar.gz
latest.json
```

Also verify the updater endpoint resolves:
```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/latest.json | python3 -m json.tool
```

And verify the install command works:
```bash
curl -sL https://github.com/fogside/Lumous/releases/latest/download/Lumous.app.tar.gz | tar xz -C /Applications
```

## Checklist

- [ ] Version bumped in `package.json` and `tauri.conf.json`
- [ ] `RELEASES.md` updated with changelog for this version
- [ ] `TAURI_SIGNING_PRIVATE_KEY` set from `~/.tauri/WandDo.key`
- [ ] `npm run tauri build` completed with "Finished 1 updater signature"
- [ ] `latest.json` generated with correct version, signature, and pub_date
- [ ] GitHub release created with `Lumous.app.tar.gz` + `latest.json` (no DMG)
- [ ] Release notes include the curl install command
- [ ] Updater endpoint returns the new version

## Debugging post-release crashes

If users report crashes after a release, check the app log:
- **Production**: `~/Library/Application Support/io.github.fogside.lumous/app.log`
- **Dev**: `~/Library/Application Support/io.github.fogside.lumous-dev/app.log`

Entries are timestamped with level (ERROR/WARN/INFO). The ErrorBoundary catches React crashes and shows a recovery screen, so "black screen" crashes should now be extremely rare — but the log will still capture what happened.

## Fixing a release that's missing updater artifacts

If a release was published without `latest.json` and `Lumous.app.tar.gz`, rebuild and upload:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/WandDo.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build

# Generate latest.json (see Step 3)

# Upload missing artifacts to existing release
gh release upload vX.Y.Z \
  "src-tauri/target/release/bundle/macos/Lumous.app.tar.gz" \
  "/tmp/latest.json" \
  --clobber
```

To remove a DMG that was accidentally uploaded:
```bash
gh release delete-asset vX.Y.Z Lumous_X.Y.Z_aarch64.dmg
```
