/* ============================================================================
   avatar.js — the "digital human" layer for Interview Studio
   ----------------------------------------------------------------------------
   The rest of the app does NOT need to know how the face is drawn. It only calls:

       InterviewAvatar.init({ host, studio });
       await InterviewAvatar.mount(interviewer);   // switch face
       InterviewAvatar.speaking(true/false);       // examiner talking
       InterviewAvatar.listening(true/false);      // candidate talking
       InterviewAvatar.mouth(0..1);                // lip openness (per TTS word)

   TWO BACKENDS, chosen automatically per interviewer:

   1) PHOTO  (default, 100% free, zero setup, works on GitHub Pages today)
        Uses the photoreal portrait. "Talking" is conveyed by a head bob,
        a warm rim glow, a live equalizer and word-by-word caption highlight.
        We deliberately do NOT paint a fake mouth on a real photo — it looks
        uncanny. Real mouth lip-sync lives in the 3D backend below.

   2) MODEL (opt-in, free, real lip-sync + expressions)
        Set an interviewer's "model" field in interview_question_bank.json to a
        Ready Player Me .glb URL and this backend loads a 3D head (three.js),
        blinks, sways, changes expression, and opens the jaw on each spoken word
        (viseme/jaw morph targets). If three.js or the model fails to load, it
        silently falls back to PHOTO so the app never breaks.

   NOTE on perfect lip-sync: the browser's free voice (SpeechSynthesis) only
   reports WORD boundaries, not phonemes, so the 3D jaw here is a believable
   approximation. For frame-accurate visemes you need a TTS engine that returns
   viseme timings (Google / Azure / ElevenLabs) — see README "Upgrade path".
   ========================================================================== */
window.InterviewAvatar = (function () {
  let host, studio, backend = null, current = null;

  function init(refs) { host = refs.host; studio = refs.studio; }

  /* ---------- shared studio state classes (CSS draws the glow) ---------- */
  function speaking(on) { studio && studio.classList.toggle('speaking', !!on); backend && backend.speaking && backend.speaking(on); }
  function listening(on){ studio && studio.classList.toggle('listening', !!on); backend && backend.listening && backend.listening(on); }
  function mouth(level) { backend && backend.mouth && backend.mouth(Math.max(0, Math.min(1, level || 0))); }

  /* ============================ PHOTO BACKEND ============================ */
  function PhotoBackend(interviewer) {
    host.innerHTML =
      '<div class="photoWrap">' +
        '<img class="photoImg" alt="' + (interviewer.name || 'Interviewer') + '">' +
      '</div>';
    const img = host.querySelector('.photoImg');
    img.onerror = function () { img.style.opacity = .25; };
    img.src = interviewer.photo;

    return {
      speaking: function (on) { img.classList.toggle('talkbob', !!on); },
      listening: function () {},
      mouth: function () {},          // no fake mouth on a real photo
      dispose: function () { host.innerHTML = ''; }
    };
  }

  /* ============================ MODEL BACKEND ===========================
     Loads three.js + GLTFLoader from CDN (works on GitHub Pages), shows a
     Ready Player Me head, idles/blinks, and drives jaw/viseme morphs.
     Everything is wrapped so a failure rejects and we fall back to PHOTO.   */
  function ModelBackend(interviewer) {
    return new Promise(function (resolve, reject) {
      loadThree().then(function (THREE) {
        try { build(THREE); } catch (e) { reject(e); }
      }).catch(reject);

      function build(THREE) {
        host.innerHTML = '<canvas class="glCanvas"></canvas>';
        const canvas = host.querySelector('.glCanvas');
        const W = host.clientWidth, H = host.clientHeight;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        renderer.setSize(W, H); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(28, W / H, 0.1, 100);
        cam.position.set(0, 1.62, 0.78);            // framed on the face/upper body

        // soft studio lighting
        scene.add(new THREE.HemisphereLight(0xffffff, 0x443366, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(1.4, 2.2, 2); scene.add(key);
        const rim = new THREE.DirectionalLight(0xb9a4ff, 1.0); rim.position.set(-2, 1.5, -1.5); scene.add(rim);

        let head, morphMesh = null, morphDict = {}, t0 = performance.now();
        let targetMouth = 0, curMouth = 0, blink = 0, nextBlink = 1.5;

        const loaderUrl = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
        import(/* @vite-ignore */ loaderUrl).then(function (m) {
          const loader = new m.GLTFLoader();
          let url = interviewer.model;
          // ensure RPM exports the morph targets we need for the mouth
          if (url.indexOf('readyplayer.me') > -1 && url.indexOf('morphTargets') === -1) {
            url += (url.indexOf('?') > -1 ? '&' : '?') + 'morphTargets=ARKit,Oculus+Visemes&textureAtlas=1024';
          }
          loader.load(url, function (gltf) {
            head = gltf.scene;
            head.position.set(0, 0, 0);
            head.traverse(function (o) {
              if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
                if (o.morphTargetDictionary.jawOpen !== undefined ||
                    o.morphTargetDictionary.viseme_aa !== undefined ||
                    o.morphTargetDictionary.mouthOpen !== undefined) {
                  morphMesh = o; morphDict = o.morphTargetDictionary;
                }
              }
            });
            scene.add(head);
            resolve(api);              // model is live — backend ready
            animate();
          }, undefined, reject);
        }).catch(reject);

        function setMorph(name, v) {
          if (!morphMesh) return;
          const i = morphDict[name];
          if (i !== undefined) morphMesh.morphTargetInfluences[i] = v;
        }

        function animate() {
          requestAnimationFrame(animate);
          const t = (performance.now() - t0) / 1000;
          // gentle idle sway + breathing
          if (head) { head.rotation.y = Math.sin(t * 0.5) * 0.06; head.position.y = Math.sin(t * 1.1) * 0.004; }
          // blink
          nextBlink -= 0.016; if (nextBlink < 0) { blink = 1; nextBlink = 2 + Math.random() * 3; }
          blink = Math.max(0, blink - 0.18);
          setMorph('eyeBlinkLeft', blink); setMorph('eyeBlinkRight', blink); setMorph('eyesClosed', blink);
          // mouth easing toward target (driven by app per spoken word)
          curMouth += (targetMouth - curMouth) * 0.4;
          setMorph('jawOpen', curMouth * 0.7);
          setMorph('mouthOpen', curMouth * 0.6);
          setMorph('viseme_aa', curMouth * 0.8);
          renderer.render(scene, cam);
        }

        const api = {
          speaking: function (on) { if (!on) { targetMouth = 0; } setMorph('mouthSmile', on ? 0.15 : 0.25); },
          listening: function (on) { setMorph('mouthSmile', on ? 0.3 : 0.2); },
          mouth: function (level) { targetMouth = level; },
          dispose: function () { try { renderer.dispose(); } catch (e) {} host.innerHTML = ''; }
        };
      }
    });
  }

  // lazy three.js loader (cached)
  let threePromise = null;
  function loadThree() {
    if (threePromise) return threePromise;
    threePromise = import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
    return threePromise;
  }

  /* ============================ PUBLIC: mount ============================ */
  async function mount(interviewer) {
    current = interviewer;
    if (backend && backend.dispose) backend.dispose();
    backend = null;
    studio && studio.classList.remove('speaking', 'listening');

    if (interviewer.model && interviewer.model.trim()) {
      try { backend = await ModelBackend(interviewer); return 'model'; }
      catch (e) { console.warn('[avatar] 3D model failed, using photo:', e); }
    }
    backend = PhotoBackend(interviewer);
    return 'photo';
  }

  return { init, mount, speaking, listening, mouth };
})();

/* photo-backend styles injected here so the module is self-contained */
(function () {
  const css = document.createElement('style');
  css.textContent =
    '.photoWrap{position:absolute;inset:0}' +
    '.photoImg{width:100%;height:100%;object-fit:cover;object-position:center 20%;' +
      'transition:filter .4s,transform .4s;transform-origin:center 30%}' +
    '#studio.speaking .photoImg{filter:brightness(1.04) saturate(1.05)}' +
    '.photoImg.talkbob{animation:talkbob 2.4s ease-in-out infinite}' +
    '@keyframes talkbob{0%,100%{transform:scale(1.02) translateY(0)}50%{transform:scale(1.05) translateY(-5px)}}' +
    '.glCanvas{width:100%;height:100%;display:block}';
  document.head.appendChild(css);
})();
