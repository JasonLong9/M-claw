# M-claw

[简体中文](README.md)

M-claw is a desktop application for configuring and managing OpenClaw. It builds on [Qclaw](https://github.com/qiuzhi2046/Qclaw), with [JasonLong9](https://github.com/JasonLong9) as M-claw's lead developer.

## Features

- Check the Node.js and OpenClaw CLI environment and import existing OpenClaw settings.
- Configure model providers and custom models, and manage Skills and messaging channels.
- View OpenClaw Gateway status, restart the Gateway, and troubleshoot it from the desktop app.
- Back up local settings and data.

On first launch, run the environment check, import existing settings if needed, and select a model provider. You can connect messaging channels later.

## Architecture

- The **renderer process (React and TypeScript)** handles the interface, configuration, and status display.
- The **preload script and IPC** expose main-process operations to the renderer.
- The **main process (Electron and Node.js)** checks the environment, reads and writes configuration, manages processes, and calls the OpenClaw CLI.
- The **OpenClaw CLI and Gateway** provide the underlying agent runtime and service integration.

## M-claw development

Changes led by JasonLong9 include:

- **Chat memory.** Save global preferences and per-conversation memory separately and pass relevant memory to OpenClaw when sending a message. See the [chat memory commit](https://github.com/JasonLong9/M-claw/commit/cb7a7daf278e9b96f4c7a9967810298237a121b6).
- **Windows Gateway startup.** Adjust how the Gateway subprocess starts so that background startup avoids opening a separate console window. See the [Gateway startup commit](https://github.com/JasonLong9/M-claw/commit/05df9e297e4d6eba24e56008fd2a2b5c3d308334).

The repository includes checks for packaging, migrating, and distributing the OpenClaw runtime. See [package.json](package.json) for the script definitions.

| Command | Purpose |
| --- | --- |
| `npm run check:openclaw:bundle:strict` | Verify the OpenClaw runtime files required for packaging |
| `npm run report:openclaw:migration-smoke` | Generate a runtime migration smoke-check report |
| `npm run check:win:artifact:bundle` | Check the OpenClaw runtime in Windows build artifacts |

## Local development

Node.js 24 and npm are recommended.

```bash
git clone https://github.com/JasonLong9/M-claw.git
cd M-claw
npm install
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run build:app` | Compile and build the application |
| `npm run build` | Build and package the application |
| `npm test` | Run tests |
| `npm run typecheck` | Run TypeScript type checks |

See [package.json](package.json) and [electron-builder.json](electron-builder.json) for platform packaging scripts and configuration.

## Upstream projects and licenses

- [Qclaw](https://github.com/qiuzhi2046/Qclaw) is the upstream desktop application and is licensed under Apache-2.0.
- [OpenClaw](https://github.com/openclaw/openclaw) provides the agent runtime and tool ecosystem and is licensed under MIT.

See [LICENSE](LICENSE) for the repository license and [NOTICE](NOTICE) for Qclaw's copyright and attribution notices. Third-party components and assets are subject to their respective licenses.

M-claw adapted the upstream README's project description and development instructions. Thanks to 秋芝2046, the Qclaw contributors, and the open-source projects behind M-claw, including OpenClaw, Electron, React, Vite, and Mantine.

Report bugs or suggest improvements through [M-claw Issues](https://github.com/JasonLong9/M-claw/issues).
