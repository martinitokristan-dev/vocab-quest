import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import WebSocket from 'ws';

const audioDir = path.resolve('public/assets/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// 6 Distinct Voices (3 Girls, 3 Boys with authentic child/youth neural models and pitch)
const voiceConfigs = [
  {
    filename: 'voice_learner_girl.mp3',
    text: 'Learner Girl!',
    voice: 'en-US-AnaNeural', // Real Child Girl voice
    rate: '+5%',
    pitch: '+15Hz',
  },
  {
    filename: 'voice_learner_boy.mp3',
    text: 'Learner Boy!',
    voice: 'en-US-AnaNeural', // Child voice with boy pitch modulation
    rate: '+5%',
    pitch: '-20Hz',
  },
  {
    filename: 'voice_school_girl.mp3',
    text: 'School Girl!',
    voice: 'en-US-JennyNeural',
    rate: '+8%',
    pitch: '+40Hz',
  },
  {
    filename: 'voice_school_boy.mp3',
    text: 'School Boy!',
    voice: 'en-US-ChristopherNeural',
    rate: '+5%',
    pitch: '+35Hz',
  },
  {
    filename: 'voice_sporty_girl.mp3',
    text: 'Sporty Girl!',
    voice: 'en-US-AnaNeural',
    rate: '+15%',
    pitch: '+30Hz',
  },
  {
    filename: 'voice_explorer_boy.mp3',
    text: 'Explorer Boy!',
    voice: 'en-US-EricNeural',
    rate: '+10%',
    pitch: '+40Hz',
  },
];

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EA654070B5D040A5D6B690A7';

function generateSecMsGecToken() {
  const ticks = BigInt(Math.floor(Date.now() / 1000) + 11644473600) * 10000000n;
  const roundedTicks = ticks - (ticks % 3000000000n);
  const str = `${roundedTicks}${TRUSTED_CLIENT_TOKEN}`;
  return crypto.createHash('sha256').update(str, 'ascii').digest('hex').toUpperCase();
}

async function synthesizeEdgeTTS(config) {
  return new Promise((resolve, reject) => {
    const secMsGec = generateSecMsGecToken();
    const connectionId = crypto.randomUUID().replace(/-/g, '');
    const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-130.0.2849.68&ConnectionId=${connectionId}`;

    const ws = new WebSocket(wsUrl, {
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
      },
    });

    const audioBuffers = [];

    ws.on('open', () => {
      // 1. Send speech.config
      const configMessage =
        `Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
        JSON.stringify({
          context: {
            synthesis: {
              audio: {
                metadataoptions: { sentenceBoundaryEnabled: 'false', wordBoundaryEnabled: 'false' },
                outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
              },
            },
          },
        });
      ws.send(configMessage);

      // 2. Send SSML synthesis request
      const requestId = crypto.randomUUID().replace(/-/g, '');
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${config.voice}'>` +
        `<prosody pitch='${config.pitch}' rate='${config.rate}' volume='+0%'>` +
        `${config.text}` +
        `</prosody></voice></speak>`;

      const ssmlMessage =
        `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n` + ssml;
      ws.send(ssmlMessage);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        // Binary audio chunk (contains a 2-byte header with header length, then headers, then MP3 audio data)
        const buffer = Buffer.from(data);
        const headerLen = buffer.readUInt16BE(0);
        const audioData = buffer.subarray(headerLen + 2);
        audioBuffers.push(audioData);
      } else {
        const text = data.toString('utf8');
        if (text.includes('Path:turn.end')) {
          ws.close();
        }
      }
    });

    ws.on('close', () => {
      const fullAudio = Buffer.concat(audioBuffers);
      if (fullAudio.length > 0) {
        const outPath = path.join(audioDir, config.filename);
        fs.writeFileSync(outPath, fullAudio);
        console.log(`✓ Generated neural child audio: ${config.filename} (${fullAudio.length} bytes)`);
        resolve(outPath);
      } else {
        reject(new Error(`No audio data received for ${config.filename}`));
      }
    });

    ws.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log('Generating 6 authentic 10-year-old child neural voice audio files...');
  for (const cfg of voiceConfigs) {
    try {
      await synthesizeEdgeTTS(cfg);
    } catch (e) {
      console.error(`Error generating ${cfg.filename}:`, e.message);
    }
  }
  console.log('All character voice files ready!');
}

main();
