# Game interface layout

The active game uses a map-first, full-viewport workspace. Lobby and connection screens remain document layouts, but the action phase becomes a fixed application shell so browser scrolling never competes with board navigation.

## Regions

- The top HUD contains the phase, turn owner, connection status, room code, and invitation control.
- The board stage receives all remaining primary workspace area. Zoom controls, legal-route highlights, location details, and the end-turn action are overlays so they do not reduce the map's dimensions.
- The investigator dock exposes only synchronized public state. It can collapse to party tabs and becomes an overlay below 1000 CSS pixels.
- The player tray has collapsed, peek, and expanded states for assets, spells, conditions, tasks, reserve cards, and the event log. Until these collections exist in authoritative room state, the tray renders explicit empty states rather than client-owned placeholders.
- The complete card catalog is a separate reference archive and must not be confused with a player's owned cards or server-owned deck state.

## Responsive behavior

Wide screens use a supporting right pane. On narrower screens the pane overlays the board, leaving a compact party-tab rail when collapsed. At phone widths the player tray uses icon controls, while the board remains pannable through its bounded zoom view box. Touch and keyboard hit areas remain larger than the printed board markers.

## State boundary

Dock selection, tray expansion, active tray tab, map zoom, and inspected location are local presentation state. Health, sanity, location, turn ownership, player presence, inventory, card ownership, and future game resources must come from synchronized server state. UI components send commands and never manufacture authoritative outcomes.
