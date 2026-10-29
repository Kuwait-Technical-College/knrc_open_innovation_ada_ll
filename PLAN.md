# Plan: Raspberry Pi web server – dual camera stream + VEX V5 motor button

Status legend: `[x]` done, `[ ]` to do. Implemented per the decisions below.

## Environment (discovered)

| Item | Value |
|---|---|
| Device | Raspberry Pi (aarch64, Debian 13), Wi-Fi `robotics_club`, IP `192.168.137.211` |
| Node / npm | v20.19.2 / 9.2.0 (installed via apt) |
| Camera A | Innomaker U20CAM-1080p (`/dev/video0`, MJPG up to 1080p) |
| Camera B | Logitech HD Webcam C615 (`/dev/video2`, YUYV only → needs encoding to JPEG) |
| V5 Brain | USB `2888:0501`; `/dev/ttyACM0` (system/download port, `-if00`), `/dev/ttyACM1` (user/serial port, `-if02`) |
| Motor | V5 Smart Motor on **port 1** |
| User permissions | `raskla-user` is in `dialout` and `video` groups (no root needed at runtime) |

Use the stable paths `/dev/serial/by-id/usb-VEX_..._-if02` and `/dev/v4l/by-id/...` rather than `/dev/ttyACM*` / `/dev/videoN` (numbers can change on reboot/replug).

## Phase 1 – Setup (done)

- [x] Install `gh`, `nodejs`, `npm`, `v4l-utils`, `ffmpeg` on the Pi
- [x] Authenticate GitHub as `roboticsktech` (`gh auth login`, HTTPS)
- [x] Clone repo. NOTE: the repo is in the org **`Kuwait-Technical-College/knrc_open_innovation_ada_ll`**, not directly under `roboticsktech`
- [x] Move `.env` from `~/Documents` into the repo root (permissions `600`)
- [x] Add `.gitignore` containing `.env` so secrets are never committed

## Phase 2 – Hardware verification (before writing app code)

- [x] Capture one test frame from each camera with `ffmpeg`/`v4l2-ctl` to confirm both work simultaneously (two USB cameras on one Pi may hit USB bandwidth limits → use MJPG / 640x480 @ 15–30 fps)
- [x] Create stable device names (udev rules or `/dev/v4l/by-id`) for the two cameras
- [x] Open `/dev/ttyACM1` and confirm the brain responds (it will only talk once a user program is running)

## Phase 3 – VEX Brain program (motor side)

The brain cannot be driven directly from Node; it must run a small program that listens on its USB serial port and spins the motor.

- [x] Create `brain/` folder with a small V5 program (C++ with **PROS**) that:
  - configures motor on **port 1**
  - reads text commands from stdin (the USB user port), e.g. `SPIN\n`, `STOP\n`
  - on `SPIN`: runs the motor for a fixed move (default: 1 revolution, ~100 RPM), then replies `OK`
  - on `STOP`: stops the motor
  - replies `ERR <reason>` on bad input
- [x] Install `pros-cli` (pip, in a venv) + ARM GNU toolchain on the Pi, build, and upload to the brain over `/dev/ttyACM0`
- [x] Verify the motor spins using a manual serial test (`echo SPIN > /dev/ttyACM1`)

## Phase 4 – Node.js web server

Layout:

```
.
├── .env                 (secrets, not committed)
├── .env.example         (key names only)
├── package.json
├── server.js            (Express app, routes, startup)
├── src/
│   ├── cameras.js       (spawns ffmpeg per camera, parses MJPEG, fans out to clients)
│   └── motor.js         (serialport wrapper: spin(), stop(), reconnect handling)
├── public/
│   ├── index.html       (two <img> stream tiles + "Spin Motor" button)
│   ├── style.css
│   └── app.js           (button handler, status display)
└── brain/               (V5 program from Phase 3)
```

- [x] `npm init`; dependencies: `express`, `serialport`, `dotenv`
- [x] **Camera streaming**: one `ffmpeg` process per camera outputs MJPEG to stdout → server serves `multipart/x-mixed-replace` at `/stream/cam1` and `/stream/cam2`
  - process is started on first viewer and shared between viewers; stopped when no viewers remain
  - restart automatically if ffmpeg exits (camera unplugged)
- [x] **Motor API**: `POST /api/motor/spin` → writes `SPIN` to the serial port, returns JSON `{ok:true}` or an error; ignores duplicate clicks while a move is in progress
- [x] `GET /api/status` → camera + brain connection state
- [x] **Frontend**: single page, two live video tiles, one "Spin Motor" button, simple status text
- [x] Listen on `0.0.0.0:3000` (configurable via `PORT`) so it is reachable at `http://192.168.137.211:3000` from the `robotics_club` network
- [x] Config via `.env` (`PORT`, camera and serial device paths); `RPIE_*`/`WIFI_*` stay unused by the app

## Phase 5 – Run & verify

- [x] Start server, open `http://192.168.137.211:3000` from another device
- [x] Both streams verified simultaneously via curl (~13-15 fps each); not yet viewed in a browser
- [x] Button click spins the motor once; repeated clicks are handled safely
- [ ] Unplug/replug a camera and the brain → server recovers without restart (code handles it; not physically tested)
- [ ] (Optional) `systemd` service so the server starts on boot
- [x] Write `README.md` (setup, run, wiring/ports), commit and push to `main`

## Security notes (initial scope)

- The page and motor endpoint have **no authentication** – anyone on `robotics_club` can press the button. Acceptable for now; can add a simple shared PIN later.
- `.env` holds Pi and Wi-Fi passwords: it is git-ignored; do not remove that line.
- gh token is stored in plain text at `~/.config/gh/hosts.yml` (no keyring available on the Pi).

## Decisions (from review)

1. Motor: one fixed move per click (1 revolution at 100 RPM, port 1).
2. Brain program: PROS (C++), built on the Pi.
3. Streams: 640x480 @ 15 fps per camera.
4. Commit directly to `main`.
