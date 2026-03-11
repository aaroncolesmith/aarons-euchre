# Versioning Rules

EVERY time code is changed and committed, YOU MUST:
1. Bump the version number in `package.json` using `npm version patch --no-git-tag-version`
2. Update the version displayed in the UI (e.g., `Euchre Engine V1.XX`)
3. The UI version should typically be updated in `src/App.tsx` and `src/components/Lobby/LandingPage.tsx`.
