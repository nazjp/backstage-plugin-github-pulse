# backstage-plugin-github-pulse

GitHub **Pulse**-style activity for Backstage entity pages: merged PRs, open PRs, issue counts, recent merges, and recent commits on the default branch.

Uses per-user GitHub access via [`scmAuthApi.getCredentials`](https://backstage.io/docs/auth/) (same pattern as the README / SCM integrations docs), not a single shared application token.

## Install

```sh
yarn add @nazjp/backstage-plugin-github-pulse
```

Register the optional plugin id (if you use explicit plugin registration) and add the card where you render entity overview content, for example in `EntityPage.tsx`:

```tsx
import { EntityGithubPulseCard } from '@nazjp/backstage-plugin-github-pulse';

// …
<EntityGithubPulseCard variant="gridItem" days={7} />
```

## Requirements

- Entity annotation `github.com/project-slug` set to `org/repo`.
- App configured with `scmAuthApiRef` and `ScmAuth.forGithub` (or equivalent) for your GitHub host(s), as in a typical Backstage app.

## Develop

```sh
yarn install
yarn build
```

Point your Backstage app at this package with a `file:` or workspace dependency while iterating.

## License

Apache-2.0
