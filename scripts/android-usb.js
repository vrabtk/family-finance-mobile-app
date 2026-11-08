// `npm run android:usb`: start Expo for a USB-connected Android phone/emulator and keep the backend port
// forwarded. Expo (and adb restarts) drop `adb reverse` rules, so the rule is re-applied every few seconds;
// the command is idempotent. Override the port with API_PORT=1234.
const { spawn, execFile } = require('child_process');

const port = process.env.API_PORT || '5051';
const forward = () => execFile('adb', ['reverse', `tcp:${port}`, `tcp:${port}`], () => {}); // ignore "no device" while unplugged

forward();
const timer = setInterval(forward, 4000);

const expo = spawn('npx', ['expo', 'start', '--android', '--host', 'localhost', '--clear'], { stdio: 'inherit', shell: true });
const stop = (code) => { clearInterval(timer); process.exit(code ?? 0); };
expo.on('exit', stop);
process.on('SIGINT', () => { expo.kill('SIGINT'); stop(0); });
