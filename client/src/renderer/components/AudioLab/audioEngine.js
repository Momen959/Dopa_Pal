export const AUDIO_KEYS = ['music-brown-noise', 'music-lofi', 'music-rain'];

function createBrownNoise(ctx, gain) {
  const bufferSize = 4096;
  let lastOut = 0.0;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);
  node.onaudioprocess = (e) => {
    const output = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = output[i];
      output[i] *= 3.2;
    }
  };

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 420;

  node.connect(lowpass);
  lowpass.connect(gain);

  return {
    stop: () => {
      node.disconnect();
      lowpass.disconnect();
      node.onaudioprocess = null;
    },
  };
}

function createLofi(ctx, gain) {
  const bufferSize = 4096;
  let lastOut = 0.0;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);

  node.onaudioprocess = (e) => {
    const output = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + white * 0.015) / 1.015;
      lastOut = output[i];
      output[i] *= 0.24;
    }
  };

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 850;
  filter.Q.value = 1.0;

  const stereo = ctx.createStereoPanner();
  stereo.pan.value = -0.2;

  node.connect(filter);
  filter.connect(stereo);
  stereo.connect(gain);

  return {
    stop: () => {
      node.disconnect();
      filter.disconnect();
      stereo.disconnect();
      node.onaudioprocess = null;
    },
  };
}

function createRain(ctx, gain) {
  const bufferSize = 4096;
  const node = ctx.createScriptProcessor(bufferSize, 1, 1);

  node.onaudioprocess = (e) => {
    const output = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      output[i] = (Math.random() * 2 - 1) * 0.18;
    }
  };

  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 600;

  const lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 2800;
  lowpass.Q.value = 0.8;

  node.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);

  return {
    stop: () => {
      node.disconnect();
      highpass.disconnect();
      lowpass.disconnect();
      node.onaudioprocess = null;
    },
  };
}

export function createAudioPlayer(context, soundIdOrObj, volume = 0.65) {
  if (!context || !soundIdOrObj) return null;

  const masterGain = context.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(context.destination);

  const engines = [];

  const makeEngineForId = (id) => {
    const subGain = context.createGain();
    subGain.gain.value = 1.0;
    subGain.connect(masterGain);
    let eng = null;
    if (id === 'music-brown-noise') eng = createBrownNoise(context, subGain);
    else if (id === 'music-lofi') eng = createLofi(context, subGain);
    else if (id === 'music-rain') eng = createRain(context, subGain);
    else eng = createBrownNoise(context, subGain);
    return { eng, subGain };
  };

  const addEngine = (id) => {
    const r = makeEngineForId(id);
    engines.push(r);
  };

  if (typeof soundIdOrObj === 'string') {
    if (soundIdOrObj.startsWith('mix:')) {
      const mixId = soundIdOrObj.slice(4);
      try {
        const storedMixes = JSON.parse(window.localStorage.getItem('dopaPal_customMixes') || '[]');
        const mix = storedMixes.find(m => m.id === mixId);
        if (mix) {
          const sounds = mix.sounds || [mix.sound_a, mix.sound_b].filter(Boolean);
          sounds.forEach(soundId => addEngine(soundId));
        }
      } catch (err) {
        addEngine(soundIdOrObj);
      }
    } else {
      addEngine(soundIdOrObj);
    }
  } else if (typeof soundIdOrObj === 'object' && soundIdOrObj?.type === 'mix') {
    const sounds = soundIdOrObj.sounds || [soundIdOrObj.sound_a, soundIdOrObj.sound_b].filter(Boolean);
    sounds.forEach(soundId => addEngine(soundId));
  }

  return {
    setVolume(value) {
      masterGain.gain.value = value;
    },
    stop() {
      engines.forEach(({ eng, subGain }) => {
        try {
          if (eng && typeof eng.stop === 'function') eng.stop();
        } catch (_) { }
        try { subGain.disconnect(); } catch (_) { }
      });
      try { masterGain.disconnect(); } catch (_) { }
    },
  };
}
