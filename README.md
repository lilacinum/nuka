# Nuka / Bloxspace

Nuka is a Roblox-inspired social game platform prototype for the web.

## Current build

- Responsive Roblox-style desktop and mobile shell
- Home, Discover, Friends, and Profile routes
- Experience discovery with search and popularity/favorites filters
- Favorites and recently played state
- Friend list, incoming/outgoing requests, suggestions, accept/decline/remove actions
- Notification inbox with unread state
- Editable local profile
- Local demo persistence through `localStorage`
- Supabase-ready schema for profiles, friendships, experiences, favorites, recents, and notifications
- Placeholder avatar panel ready for the 3D editor to be reconnected

## Run locally

Open `index.html` directly, or serve the folder with any static web server.

## Backend

The front end currently works in demo mode without a backend.

To prepare Supabase:

1. Create a Supabase project.
2. Run `supabase-setup.sql` in the SQL editor.
3. Add your project URL and anon key to `config.js`.
4. Replace the local demo state in `app.js` with Supabase auth/data calls.

## Next planned pass

- Authentication and real account persistence
- Public friend profiles
- Direct messages and chat
- Restore the 3D avatar editor
- Multiplayer world / presence integration
- Creator experience submission and Studio tools
