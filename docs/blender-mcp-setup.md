# Blender MCP — setup

One-time setup to let an agent drive Blender for RIGRUNNER assets. Most of the asset
pipeline (the [style kit](../tools/blender/README.md) headless path) needs only **Blender on
PATH** — the MCP server below is for *interactive*, agent-driven modelling.

## 1. Install Blender

```bash
brew install --cask blender
blender --version      # confirm it's on PATH
```

(If `blender` isn't on PATH, it's at `/Applications/Blender.app/Contents/MacOS/Blender` —
either use that full path or symlink it.)

## 2. Install the Blender-MCP addon

Download the addon `addon.py` from the blender-mcp project and save it into
`tools/blender/blender-mcp-addon.py` (this repo couldn't fetch it automatically):

```bash
curl -fsSL https://raw.githubusercontent.com/ahujasid/blender-mcp/main/addon.py \
  -o tools/blender/blender-mcp-addon.py
```

> ⚠️ The version of `addon.py` and the `uvx blender-mcp` server should match. If a future
> server update breaks the handshake, re-download `addon.py` from the same repo to realign.

Then in Blender: **Edit → Preferences → Add-ons → ▾ (top-right) → Install from Disk…** →
select `tools/blender/blender-mcp-addon.py` → enable **“Interface: Blender MCP”**.

## 3. Start the addon's server (each session)

In the 3D viewport press **N** for the sidebar → **BlenderMCP** tab → click **Connect to
Claude**. This is the manual per-session step: the addon opens a socket on `localhost:9876`
that the MCP server connects to, so Blender must be running with this started. (Stop it with
**Stop the connection to Claude**.)

## 4. Approve the MCP server in Claude Code

The project already declares it in [`../.mcp.json`](../.mcp.json):

```json
{ "mcpServers": { "blender": { "command": "uvx", "args": ["blender-mcp"] } } }
```

Claude Code prompts to approve project-scoped MCP servers on launch in this repo — approve
`blender`. (`uvx` is already installed; it fetches/runs `blender-mcp` on demand.)

## 5. Verify the handshake

With Blender running + server started + the MCP approved, ask the agent to fetch scene info
through the `blender` MCP tools. If it returns the scene, you're wired. Then drive the
pipeline via the **`blender-asset`** skill.

## Notes

- **Headless needs none of this.** `blender --background --python tools/blender/build_asset.py -- <name>`
  generates committed GLBs reproducibly with just step 1.
- This is an external open-source tool (`ahujasid/blender-mcp`) running locally; the addon
  can execute Python in Blender, which is exactly what the pipeline uses.
