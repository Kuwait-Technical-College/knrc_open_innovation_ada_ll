# KNRC Open Innovation – ADA LL

Raspberry Pi web server that streams two USB cameras and spins a VEX V5 motor (port 1) from a button.

See [PLAN.md](./PLAN.md) for the design and checklist.

## Setup

```bash
sudo apt install nodejs npm ffmpeg v4l-utils
npm install
cp .env.example .env   # then add your own values; .env is git-ignored
npm start              # http://<pi-ip>:3000
```

Endpoints: `/` (page), `/stream/cam1`, `/stream/cam2` (MJPEG), `POST /api/motor/spin`, `GET /api/status`.
Device paths, resolution and fps can be overridden in `.env` (see `.env.example`).

## Brain program (`brain/`)

PROS C++ program that listens on the brain's USB user serial port (`-if02`) for `SPIN` / `STOP` lines
and replies `OK` or `ERR ...`. `SPIN` turns the motor on port 1 by one revolution at 100 RPM.

```bash
python3 -m venv ~/pros-venv && ~/pros-venv/bin/pip install pros-cli "setuptools<81"
sudo apt install gcc-arm-none-eabi make
cd brain
~/pros-venv/bin/pros make
~/pros-venv/bin/pros upload --slot 1 --name "KNRC Motor"
~/pros-venv/bin/pros v5 run 1     # or start slot 1 from the brain screen
```

The program must be running on the brain (after every brain power cycle) for the button to work.
Stop the Node server before uploading, since both use the brain's USB connection.
