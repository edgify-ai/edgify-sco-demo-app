# Edgify SCO Demo App

A sample self-checkout (SCO) application that shows how a checkout front end integrates with the **Edgify Agent** for AI item recognition, shopper session tracking and cart-based loss detection.

> **Reference demo, not production code.**
> This app exists to show *how* to call Edgify. It is not a production self-checkout system. It has no real payment flow, no hardened security, minimal error handling and no automated tests. Use it to evaluate Edgify and as a reference when building your own integration. See [Security notes](#security-notes) and [LICENSE](LICENSE).

---

## What the app shows

A complete shopper journey on a simple SCO screen:

1. **Welcome** screen. The shopper starts a session.
2. **Checkout** screen. Items are added by barcode scan, by picking from a category menu, or by placing produce on the scale. Edgify is asked to recognize the item and returns ranked suggestions with an image of what the camera saw.
3. **Pay Now**. Before moving to payment, Edgify is asked whether anything was left in the cart.
4. **Payment** and **Thank You** screens. The session is closed.

A **Settings** screen (opened from the **Help** button at the top of the Welcome and Checkout screens) configures the Edgify Agent connection, MQTT, scanners, scale, RFID and the product catalog.

Tech stack: Electron 28, React 18, Tailwind, SQLite (better-sqlite3 + knex), Express (local webhook receiver), mqtt.js.

---

## Edgify integration points

All Edgify calls are made from the Electron main process (`main.js`, `backend/edgifyApi.js`, `backend/edgifyMqtt.js`). The React UI calls them through the IPC bridge in `preload.js`.

The app can talk to two agents, each with its own host, port and token:

| Agent | Purpose | Default port |
|---|---|---|
| **Prediction agent** | Item recognition (capture and predict), labeled samples, cart-loss check | 8090 |
| **Session agent** | Shopper session events (start, pay, stop) | 8091 |

Both can point to the same agent if your deployment runs a single instance.

### REST API (HTTP Digest auth)

Every REST call uses HTTP Digest authentication with username `edgify` and your **API token** as the password.

| Integration point | Endpoint | Where in code | When it fires |
|---|---|---|---|
| **Ping / health** | `GET /api/v2/ping` | `main.js` `edgify:ping` | Periodically, drives the agent status indicator |
| **Session events** | `POST /api/v2/events` with `{ "name": "StartCustomerSession" }`, `"PayNow"`, `"StopCustomerSession"` | `edgifyApi.sendEdgifyEvent` | Welcome, Pay Now, Payment complete / log off |
| **Item recognition** | `POST /api/v2/capture-and-predict` with `{ captureTrigger, family? }` | `edgifyApi.getEdgifyPrediction` | Scale stable, category menu opened, manual trigger |
| **Label a sample** | `PUT /api/v2/samples/{sampleId}` | `edgifyApi.updateEdgifySample` | After the shopper confirms which item it was, so the prediction is labeled with the ground truth |
| **Capture and save** | `POST /api/v2/capture-and-save` | `edgifyApi.sendEdgifyCaptureAndSave` | Barcode scans, to collect labeled training samples |
| **Cart-based loss** | `POST /api/v2/detect-cart-loss` | `main.js` `edgify:detect-cart-loss` | On Pay Now. If items are detected, the shopper stays on checkout. 2 second fail-safe timeout |

Optional RFID flow (`backend/edgifyApi.js`, `sendJsonSample`, `captureAndPredict`, `sendVisionSample`) uses `/api/v2/private/*` endpoints. Treat these as experimental.

### MQTT (optional)

When MQTT is enabled in Settings, item recognition goes over MQTT instead of REST (`backend/edgifyMqtt.js`). Default topics: publish to `edgifyIn`, subscribe to `edgifyOut`.

| Event | Direction | Purpose |
|---|---|---|
| `START_TRANSACTION` | App → Agent | New shopper transaction began |
| `ITEM_RECOGNITION_REQUEST` | App → Agent | Ask the agent to recognize the item. Includes `captureTrigger`, `family`, `weight`, `storeCode`, `tillHost`, `transactionNumber` |
| `PREDICTION_RESPONSE` | Agent → App | Ranked `options` (`label`, `certainty`), `sampleId`, base64 `image` |
| `ITEM_SELECTED` | App → Agent | The item the shopper actually chose, correlated by `sampleId` |
| `END_TRANSACTION` | App → Agent | Transaction finished |

The full message shapes are documented at the top of `backend/edgifyMqtt.js`.

---

## Getting an Edgify API token

The token is an API key issued per Edgify account. To get one, contact your Edgify representative or write to Edgify through [edgify.ai](https://edgify.ai). You will also need access to a running Edgify Agent (host and port).

Never commit your token. See [Security notes](#security-notes).

---

## Setup

### Prerequisites

- Windows 10/11 (the packaged build targets Windows; development also works on macOS and Linux)
- Node.js 18 or later and npm
- An Edgify Agent reachable from this machine, and an API token
- Optional: a webcam, a USB barcode scanner (keyboard wedge), a Zebra scanner/scale with the jPOS bridge, an MQTT broker, an RFID reader

### Install and run

```bash
git clone <this-repo-url>
cd edgify-sco-app
cp .env.example .env
npm install
npm run dev
```

`npm run dev` starts the React dev server on https://localhost:3001 and opens the Electron window.

### Configure

1. Open **Settings** with the **Help** button at the top of the screen.
2. Under **Prediction Agent**: enable it, set host, port and paste your API token. Repeat for **Session Agent** if you use one.
3. Choose a scanner type: Hand Scanner (Keyboard), Webcam Scanner, Zebra Scanner (JPOS) or None.
4. Optional: enable MQTT and set broker host, port, TLS, credentials, topics, store code.
5. Optional: load the neutral sample catalog with **Import Data** and pick `assets/sample-data.json`.

   Weighted produce items use IDs such as `apple` and `banana`. A prediction maps to a product when the label Edgify returns equals the product ID, so align these IDs with the labels in your Edgify model. Packaged items use made-up barcodes with the in-store `20` prefix; edit them to match the products you scan.

### Build a Windows installer

```bash
npm run package
```

The installer is written to `dist/`.

---

## Project structure

```
main.js                 Electron main process, IPC handlers, Edgify REST + MQTT calls
preload.js              Safe IPC bridge exposed to the UI as window.electronAPI
webhook-server.js       Local HTTP receiver (port 3006) for jPOS scanner/scale webhooks
backend/
  edgifyApi.js          Edgify REST client (Digest auth)
  edgifyMqtt.js         Edgify MQTT client (recognition request/response, lifecycle events)
  rfidApi.js            RFID reader client (optional)
  logger.js             File logger with secret redaction
  database/db.js        SQLite schema, defaults and migrations
  lib/digest-fetch.js   HTTP Digest auth (adapted from digest-fetch, MIT)
src/                    React UI (Welcome, Checkout, Payment, ThankYou, Settings)
assets/sample-data.json Neutral sample catalog for Import Data
```

---

## Security notes

This is a demo. Before you build anything production-grade from it, be aware of the following:

- **Secrets are stored unencrypted.** Agent tokens and the MQTT password are saved in plain text in the local SQLite database (`sco-database.db` in the Electron user data folder, for example `%APPDATA%\electron-react-sco\` on Windows). Anyone with access to that machine and user profile can read them. A production app should use the OS credential store (for example Electron `safeStorage`, Windows Credential Manager or macOS Keychain).
- **Logs.** Session logs are written to a `logs/` folder next to the executable (or the project root in dev). The logger redacts tokens, passwords and Digest headers, but review logs before sharing them.
- **Data export never includes secrets.** Settings → Export Data omits tokens and passwords. Importing such a file leaves your existing secrets in place.
- **REST calls use plain HTTP** to the agent, protected by Digest auth. Run the agent on localhost or a trusted network.
- **MQTT over TLS accepts self-signed certificates** (certificate verification is disabled). Fine for a lab, not for production.
- **The local webhook server listens on all network interfaces (port 3006) with open CORS.** Any device on the same network can post scan, weight or prediction events to it. Run the demo on a trusted network or firewall that port.

---

## License

Use of this code is limited to evaluating and demonstrating Edgify. See [LICENSE](LICENSE). Third-party code notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
