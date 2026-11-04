(() => {
  'use strict';

  const DURATION = 35;
  const shots = [
    {start:0, end:9, name:'THE VALLEY', from:[1.14, -1.6, 1], to:[1.06, .6, 0]},
    {start:9, end:17, name:'A SINGLE CONNECTION', from:[1.12, 1.6, .8], to:[1.04, -.8, -.5]},
    {start:17, end:26, name:'THE FIRST CROSSING', from:[1.04, 0, 1], to:[1.13, .7, -.4]},
    {start:26, end:35, name:'TRUSS LAB', from:[1.14, .8, .5], to:[1.04, 0, 0]}
  ];
  const captions = [
    {start:3, end:7.7, text:'서로 닿지 않던 두 곳에,'},
    {start:11, end:15.9, text:'작은 연결이 모이고,'},
    {start:19.5, end:24.3, text:'하나의 길이 됩니다.'}
  ];
  const body = document.body;
  const start = document.getElementById('start');
  const pause = document.getElementById('pause');
  const sound = document.getElementById('sound');
  const seek = document.getElementById('seek');
  const elapsed = document.getElementById('elapsed');
  const status = document.getElementById('playbackStatus');
  const caption = document.querySelector('.caption');
  const captionText = document.getElementById('captionText');
  const title = document.querySelector('.end-title');
  const endCard = document.querySelector('.end-card');
  const curtain = document.querySelector('.curtain');
  const shotElements = [...document.querySelectorAll('.shot')];
  const images = shotElements.map(shot => shot.querySelector('img'));
  const chapterNumber = document.getElementById('chapterNumber');
  const chapterName = document.getElementById('chapterName');
  const mistFar = document.querySelector('.mist-far');
  const mistNear = document.querySelector('.mist-near');
  const canvas = document.getElementById('snow');
  const context = canvas.getContext('2d');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const preview = new URLSearchParams(location.search).get('preview') === '1';
  const flakes = Array.from({length:64}, (_, i) => ({
    x:((i * 137.508) % 100) / 100, y:((i * 73.137) % 100) / 100,
    depth:.25 + (i % 7) / 9, phase:i * 2.4
  }));
  let state = 'loading';
  let position = 0;
  let frame = 0;
  let previousTime = null;
  let soundEnabled = true;
  let audio = null;
  let filmWidth = 0;
  let filmHeight = 0;

  const clamp = number => Math.max(0, Math.min(1, number));
  const smooth = number => {const t = clamp(number); return t * t * (3 - 2 * t);};
  const mix = (a, b, progress) => a + (b - a) * progress;

  function setState(next) {
    state = next;
    body.dataset.state = next;
    pause.textContent = next === 'playing' ? 'Ⅱ' : '▷';
    pause.setAttribute('aria-label', next === 'playing' ? '일시정지' : '재생');
    pause.disabled = !['playing', 'paused'].includes(next);
    seek.disabled = !['playing', 'paused'].includes(next);
    start.hidden = !['loading', 'ready', 'error'].includes(next);
    document.querySelector('.start-card').inert = !['loading', 'ready', 'error'].includes(next);
    status.textContent = {loading:'LOADING THE PROLOGUE', ready:'OPENING FILM', playing:'NOW PLAYING', paused:'PAUSED', ended:'END OF PROLOGUE', error:'ASSET LOAD FAILED'}[next];
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    filmWidth = bounds.width;
    filmHeight = bounds.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(filmWidth * ratio);
    canvas.height = Math.round(filmHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }

  function drawSnow(time) {
    context.clearRect(0, 0, filmWidth, filmHeight);
    if (motion.matches) return;
    for (const flake of flakes) {
      const x = ((flake.x + time * .006 * flake.depth + Math.sin(time * .16 + flake.phase) * .009) % 1.12 + 1.12) % 1.12;
      const y = (flake.y + time * .025 * flake.depth) % 1.1;
      context.fillStyle = `rgba(240,241,248,${.15 + flake.depth * .35})`;
      context.beginPath();
      context.arc(x * filmWidth - filmWidth * .06, y * filmHeight - filmHeight * .05, .6 + flake.depth * 1.6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function render() {
    const fade = motion.matches ? .15 : 1.3;
    let activeIndex = 0;
    shots.forEach((shot, index) => {
      const progress = smooth((position - shot.start) / (shot.end - shot.start));
      const visible = index === 0 ? 1 : smooth((position - shot.start) / fade);
      shotElements[index].style.opacity = String(visible);
      if (position >= shot.start) activeIndex = index;
      const scale = motion.matches ? 1.05 : mix(shot.from[0], shot.to[0], progress);
      const x = motion.matches ? 0 : mix(shot.from[1], shot.to[1], progress);
      const y = motion.matches ? 0 : mix(shot.from[2], shot.to[2], progress);
      images[index].style.transform = `translate(${x}%, ${y}%) scale(${scale})`;
    });
    chapterNumber.textContent = String(activeIndex + 1).padStart(2, '0');
    chapterName.textContent = shots[activeIndex].name;
    const currentCaption = captions.find(line => position >= line.start && position <= line.end);
    captionText.textContent = currentCaption ? currentCaption.text : '';
    const captionOpacity = currentCaption ? Math.min(smooth((position - currentCaption.start) / .8), smooth((currentCaption.end - position) / .8)) : 0;
    caption.style.opacity = String(captionOpacity);
    caption.style.transform = `translateY(${(1 - captionOpacity) * 6}px)`;
    const titleOpacity = smooth((position - 28) / 2) * (1 - smooth((position - 33.2) / 1.3));
    title.style.opacity = String(titleOpacity);
    body.classList.toggle('is-final', position >= 27);
    curtain.style.opacity = String(smooth((position - 33.7) / 1.3));
    elapsed.textContent = `00:${String(Math.floor(position)).padStart(2, '0')}`;
    seek.value = String(position);
    seek.style.setProperty('--progress', `${position / DURATION * 100}%`);
    drawSnow(position);
    if (!motion.matches) {
      mistFar.style.transform = `translateX(${Math.sin(position * .04) * 4}%)`;
      mistNear.style.transform = `translateX(${-position * .24}%)`;
    }
    if (audio && state === 'playing') {
      const swell = .58 + smooth((position - 17) / 11) * .42;
      const ending = 1 - smooth((position - 32) / 3);
      audio.master.gain.setTargetAtTime(soundEnabled ? .18 * swell * ending : 0, audio.context.currentTime, .15);
    }
  }

  // Sound is synthesized locally; no audio file or external request is needed.
  async function prepareAudio() {
    if (!soundEnabled) return;
    if (!audio) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) {
        soundEnabled = false;
        updateSoundUI();
        document.getElementById('motionNote').textContent = '이 브라우저에서는 무음으로 재생합니다';
        return;
      }
      const audioContext = new Audio();
      const master = audioContext.createGain();
      master.gain.value = 0;
      master.connect(audioContext.destination);
      const windBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 4, audioContext.sampleRate);
      const samples = windBuffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < samples.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * .025) / 1.025;
        samples[i] = previous * 3;
      }
      const wind = audioContext.createBufferSource();
      wind.buffer = windBuffer;
      wind.loop = true;
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 650;
      const windGain = audioContext.createGain();
      windGain.gain.value = .35;
      wind.connect(filter).connect(windGain).connect(master);
      wind.start();
      [130.81, 196, 261.63, 293.66].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        oscillator.detune.value = index % 2 ? 3 : -3;
        gain.gain.value = index === 0 ? .13 : .045;
        oscillator.connect(gain).connect(master);
        oscillator.start();
      });
      audio = {context:audioContext, master};
    }
    try {
      await audio.context.resume();
    } catch (error) {
      soundEnabled = false;
      updateSoundUI();
      document.getElementById('motionNote').textContent = '소리를 시작하지 못해 무음으로 재생합니다';
      console.error('[TRUSS LAB opening] Audio start failed', error);
    }
  }

  function updateSoundUI() {
    sound.setAttribute('aria-pressed', String(soundEnabled));
    sound.setAttribute('aria-label', soundEnabled ? '소리 끄기' : '소리 켜기');
    document.getElementById('soundLabel').textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF';
  }

  function tick(now) {
    if (state !== 'playing') return;
    if (previousTime !== null) position = Math.min(DURATION, position + (now - previousTime) / 1000);
    previousTime = now;
    render();
    if (position >= DURATION) {
      finish();
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function play() {
    if (!['ready', 'paused', 'ended'].includes(state)) return;
    if (state === 'ended') position = 0;
    endCard.hidden = true;
    setState('playing');
    previousTime = null;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
    prepareAudio();
    pause.focus({preventScroll:true});
  }

  function pauseFilm() {
    if (state !== 'playing') return;
    cancelAnimationFrame(frame);
    previousTime = null;
    setState('paused');
    if (audio) audio.master.gain.setTargetAtTime(0, audio.context.currentTime, .1);
  }

  function finish() {
    setState('ended');
    cancelAnimationFrame(frame);
    if (audio) audio.master.gain.setTargetAtTime(0, audio.context.currentTime, .1);
    if (preview) {
      curtain.style.opacity = '0';
      title.style.opacity = '0';
      endCard.hidden = false;
      document.querySelector('.enter-button').focus({preventScroll:true});
    } else {
      location.replace(new URL('../index.html', location.href).href);
    }
  }

  start.addEventListener('click', play);
  pause.addEventListener('click', () => state === 'playing' ? pauseFilm() : play());
  document.getElementById('replay').addEventListener('click', play);
  document.getElementById('retry').addEventListener('click', () => location.reload());
  sound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    updateSoundUI();
    if (state === 'playing' && soundEnabled) prepareAudio();
    if (audio && !soundEnabled) audio.master.gain.setTargetAtTime(0, audio.context.currentTime, .08);
  });
  seek.addEventListener('input', () => {
    position = Number(seek.value);
    previousTime = null;
    render();
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      location.replace(new URL('../index.html', location.href).href);
      return;
    }
    if (event.target.closest('button, a, input')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      state === 'playing' ? pauseFilm() : play();
    } else if (event.key.toLowerCase() === 'm') sound.click();
  });
  document.addEventListener('visibilitychange', () => {if (document.hidden) pauseFilm();});
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    if (audio) audio.context.close();
  });
  function updateMotion() {
    document.getElementById('motionNote').textContent = motion.matches ? '동작 줄이기 설정 적용 중 · 카메라 이동과 눈 효과 생략' : '소리와 함께 감상하는 것을 권장합니다';
    render();
  }
  motion.addEventListener('change', updateMotion);
  const observer = new ResizeObserver(resize);
  observer.observe(document.querySelector('.film'));
  updateMotion();
  Promise.all(images.map(image => image.decode())).then(() => {
    setState('ready');
    start.disabled = false;
    document.getElementById('startLabel').textContent = '오프닝 감상하기';
    document.getElementById('loadStatus').textContent = '클릭하여 시작 · ESC로 건너뛰기';
    render();
  }).catch(error => {
    setState('error');
    start.hidden = true;
    document.getElementById('loadStatus').textContent = '일러스트를 불러오지 못했습니다. 다시 시도하거나 게임으로 바로 이동하세요.';
    document.getElementById('retry').hidden = false;
    console.error('[TRUSS LAB opening] Image load failed', error);
  });
})();
