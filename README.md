# Nuka / Bloxspace

A Roblox-inspired social game platform prototype.

## Current features
- Home / Discover / Friends / Profile navigation
- Experience cards with favorites and recently played state
- Profile editing
- Friend requests and friend list
- Notifications
- Local demo persistence through localStorage
- Supabase-ready schema included in `supabase-setup.sql`

## Run
Open `index.html` directly, or serve the folder with any static web server.

## Backend
The front end works in demo mode without a backend. To connect Supabase, create a project, run `supabase-setup.sql`, then add your URL and anon key to `config.js`.
