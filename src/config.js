require('dotenv').config({ quiet: true });

const env = process.env;

module.exports = {
  port: Number(env.PORT) || 3000,
  cameras: {
    cam1: {
      label: 'Camera 1 (Innomaker)',
      device: env.CAM1_DEVICE || '/dev/v4l/by-id/usb-Innomaker_Innomaker-U20CAM-1080p-S1_SN0001-video-index0',
      inputFormat: env.CAM1_FORMAT || 'mjpeg',
    },
    cam2: {
      label: 'Camera 2 (Logitech C615)',
      device: env.CAM2_DEVICE || '/dev/v4l/by-id/usb-046d_HD_Webcam_C615_61A9AE50-video-index0',
      inputFormat: env.CAM2_FORMAT || 'yuyv422',
    },
  },
  video: {
    size: env.VIDEO_SIZE || '640x480',
    fps: Number(env.VIDEO_FPS) || 15,
    quality: Number(env.VIDEO_QUALITY) || 5, // ffmpeg mjpeg q:v, lower = better
  },
  motor: {
    serialPath: env.MOTOR_SERIAL_PATH || '/dev/serial/by-id/usb-VEX_Robotics__Inc_VEX_Robotics_V5_Brain_-_5E598500-if02',
    baudRate: 115200,
    timeoutMs: Number(env.MOTOR_TIMEOUT_MS) || 10000,
  },
};
