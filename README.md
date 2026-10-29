# Nuka / Bloxspace

Nuka is a Roblox-inspired social game platform prototype for the web.

## Current build

- Responsive Roblox-style desktop and mobile shell
- Home, Discover, Friends, and Profile routes
- Experience discovery with search and popularity/favorites filters
- Favorites and recently played state
- Friend list, incoming/outgoing requests, suggestions, accept/decline/remove actions
- Notification inbox with unread state
- Editable profile
- Supabase email/password authentication when configured
- Public profile search
- Direct messages with realtime Supabase updates
- 3D block-avatar editor powered by Three.js
- Shared avatar appearance between profile/editor/Lobby
- Playable third-person Nuka Lobby with WASD, jump, run, camera orbit, and Supabase Presence multiplayer
- Demo fallbacks through localStorage when Supabase is not configured
- Supabase schema with RLS for profiles, friendships, experiences, favorites, recents, notifications, and messages

## Run locally

Open `index.html` directly, or serve the folder with any static web server. Internet access is required for the Supabase and Three.js CDN scripts.

## Turn on real accounts and multiplayer

1. Create a Supabase project.
2. Run the complete `supabase-setup.sql` file in the Supabase SQL editor.
3. Open `config.js`.
4. Add your Supabase project URL and **anon/public** key:

```js
window.NUKA_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY"
};
```

Do **not** put a service-role key in the browser.

After that, the Account button enables sign-up/sign-in, public player search uses the `profiles` table, DMs use `messages`, and Lobby uses Supabase Realtime Presence.

## Demo mode

Without Supabase keys, Nuka still works locally:

- profile edits persist locally
- favorites and recent experiences persist locally
- friend UI remains interactive
- player search uses demo profiles
- DMs persist locally
- the avatar editor saves locally
- Lobby shows demo players so movement can be tested

## Main files

- `index.html` — application shell and UI surfaces
- `styles.css` — base Nuka visual system
- `features.css` — accounts, messaging, avatar, and world UI
- `app.js` — core local site state and navigation
- `supabase-client.js` — auth, profiles, DMs, and backend helpers
- `social.js` — social/account/avatar/world UI controller
- `avatar3d.js` — Three.js block avatar editor
- `world.js` — playable Lobby and multiplayer presence
- `supabase-setup.sql` — database schema, trigger, RLS, and realtime setup
- `config.js` — public Supabase browser configuration

## Next pass

- Load real friend lists/requests from Supabase into the main Friends page
- Persist favorites and recent plays to Supabase
- Experience submission / creator dashboard
- Better Lobby map and player nameplates/chat bubbles
- Avatar accessories and clothing textures
- Game/experience detail pages and real launch targets
