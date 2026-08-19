import fs from 'fs';
import path from 'path';
import https from 'https';

const audioDir = path.resolve('public/assets/audio');
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// 3 Female Audio Clips & 3 Male Audio Clips
const characterAudios = [
  // --- GIRLS (US Female Natural Voice) ---
  {
    filename: 'voice_learner_girl.mp3',
    text: 'Learner Girl!',
    lang: 'en-US',
  },
  {
    filename: 'voice_school_girl.mp3',
    text: 'School Girl!',
    lang: 'en-US',
  },
  {
    filename: 'voice_sporty_girl.mp3',
    text: 'Sporty Girl!',
    lang: 'en-US',
  },

  // --- BOYS (Male Voice Sources) ---
  {
    filename: 'voice_learner_boy.mp3',
    text: 'Learner Boy!',
    lang: 'en-UK', // Male voice source
  },
  {
    filename: 'voice_school_boy.mp3',
    text: 'School Boy!',
    lang: 'en-UK', // Male voice source
  },
  {
    filename: 'voice_explorer_boy.mp3',
    text: 'Explorer Boy!',
    lang: 'en-AU', // Male voice source
  },
];

async function downloadTTS(item) {
  const encoded = encodeURIComponent(item.text);
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=${item.lang}&client=tw-ob`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Status ${res.statusCode}`));
        return;
      }
      const filePath = path.join(audioDir, item.filename);
      const fileStream = fs.createWriteStream(filePath);
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`✓ Saved ${item.filename} (Lang: ${item.lang})`);
        resolve(filePath);
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading distinct 3 Female & 3 Male voice audio tracks...');
  for (const item of characterAudios) {
    try {
      await downloadTTS(item);
    } catch (e) {
      console.error(`Failed for ${item.filename}:`, e.message);
    }
  }
  console.log('Done downloading all audio files!');
}

main();
