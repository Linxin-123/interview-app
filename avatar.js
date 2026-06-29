/* ============================================================================
   avatar.js  — the "digital human" layer for Interview Studio
   ----------------------------------------------------------------------------
   PHOTO backend (default): photoreal still + speaking cues. No real mouth.
   MODEL backend (turn on): Ready Player Me 3D head (three.js) that BLINKS,
       sways, changes expression, and OPENS ITS MOUTH while the question is
       spoken — a real digital human. Auto-falls back to PHOTO if 3D fails.

   To enable a 3D face: put a Ready Player Me .glb URL in an interviewer's
   "model" field inside interview_question_bank.json.
   ========================================================================== */
window.InterviewAvatar = (function () {
  let host, studio, backend = null;

  function init(refs) { host = refs.host; studio = refs.studio; }
  function speaking(on)  { studio && studio.classList.toggle('speaking', !!on);  backend && backend.speaking  && backend.speaking(on); }
  function listening(on) { studio && studio.classList.toggle('listening', !!on); backend && backend.listening && backend.listening(on); }
  function mouth(level)  { backend && backend.mouth && backend.mouth(Math.max(0, Math.min(1, level || 0))); }

  /* ----------------------------- PHOTO ----------------------------- */
  function PhotoBackend(interviewer) {
    host.innerHTML = '<div class="photoWrap"><img class="photoImg" alt="' + (interviewer.name || '') + '"></div>';
    const img = host.querySelector('.photoImg');
    img.onerror = function () { img.style.opacity = .25; };
    img.src = interviewer.photo;
    return {
      speaking: function (on) { img.classList.toggle('talkbob', !!on); },
      listening: function () {},
      mouth: function () {},
      dispose: function () { host.innerHTML = ''; }
    };
  }

  /* ----------------------------- 3D MODEL ----------------------------- */
  /* Camera framing — nudge these if the head sits too high/low/close. */
  const CAM = { y: 1.59, z: 0.62, lookY: 1.55, fov: 30 };

  function ModelBackend(interviewer) {
    return loadThree().then(function (lib) {
      return new Promise(function (resolve, reject) {
        const THREE = lib.THREE, GLTFLoader = lib.GLTFLoader;
        host.innerHTML = '<canvas class="glCanvas"></canvas>';
        const canvas = host.querySelector('.glCanvas');
        const W = host.clientWidth || 600, H = host.clientHeight || 480;

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(W, H); renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        const scene = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(CAM.fov, W / H, 0.1, 100);
        cam.position.set(0, CAM.y, CAM.z); cam.lookAt(0, CAM.lookY, 0);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x443366, 1.2));
        const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(1.5, 2.4, 2.2); scene.add(key);
        const rim = new THREE.DirectionalLight(0xb9a4ff, 1.1); rim.position.set(-2, 1.6, -1.6); scene.add(rim);

        let head = null, mesh = null, dict = {}, t0 = performance.now();
        let mouthTarget = 0, mouthCur = 0, blink = 0, nextBlink = 1.4, smile = 0.18;

        let url = (interviewer.model || '').trim();
        if (url.indexOf('readyplayer.me') > -1 && url.indexOf('morphTargets') === -1) {
          url += (url.indexOf('?') > -1 ? '&' : '?') + 'morphTargets=ARKit,Oculus+Visemes&textureAtlas=1024';
        }

        new GLTFLoader().load(url, function (gltf) {
          head = gltf.scene;
          head.traverse(function (o) {
            if (o.isMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
              const d = o.morphTargetDictionary;
              if (d.jawOpen !== undefined || d.viseme_aa !== undefined || d.mouthOpen !== undefined) { mesh = o; dict = d; }
            }
          });
          scene.add(head);
          resolve(api);
          animate();
        }, undefined, function (err) { reject(err); });

        function set(name, v) { if (mesh && dict[name] !== undefined) mesh.morphTargetInfluences[dict[name]] = v; }

        function animate() {
          requestAnimationFrame(animate);
          const t = (performance.now() - t0) / 1000;
          if (head) { head.rotation.y = Math.sin(t * 0.5) * 0.05; head.position.y = Math.sin(t * 1.2) * 0.004; }
          nextBlink -= 0.016; if (nextBlink < 0) { blink = 1; nextBlink = 2 + Math.random() * 3; }
          blink = Math.max(0, blink - 0.2);
          set('eyeBlinkLeft', blink); set('eyeBlinkRight', blink); set('eyesClosed', blink);
          mouthCur += (mouthTarget - mouthCur) * 0.45;
          set('jawOpen', mouthCur * 0.75);
          set('mouthOpen', mouthCur * 0.6);
          set('viseme_aa', mouthCur * 0.85);
          set('mouthSmile', smile);
          renderer.render(scene, cam);
        }

        const api = {
          speaking:  function (on) { smile = on ? 0.12 : 0.2;  if (!on) mouthTarget = 0; },
          listening: function (on) { smile = on ? 0.3  : 0.18; },
          mouth:     function (lv) { mouthTarget = lv; },
          dispose:   function () { try { renderer.dispose(); } catch (e) {} host.innerHTML = ''; }
        };
      });
    });
  }

  /* three.js + GLTFLoader via the import map declared in index.html */
  let threePromise = null;
  function loadThree() {
    if (threePromise) return threePromise;
    threePromise = Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js')
    ]).then(function (m) { return { THREE: m[0], GLTFLoader: m[1].GLTFLoader }; });
    return threePromise;
  }

  async function mount(interviewer) {
    if (backend && backend.dispose) backend.dispose();
    backend = null;
    studio && studio.classList.remove('speaking', 'listening');
    if (interviewer.model && interviewer.model.trim()) {
      try { backend = await ModelBackend(interviewer); return 'model'; }
      catch (e) { console.warn('[avatar] 3D failed -> photo:', e); }
    }
    backend = PhotoBackend(interviewer);
    return 'photo';
  }

  return { init: init, mount: mount, speaking: speaking, listening: listening, mouth: mouth };
})();

(function () {
  const css = document.createElement('style');
  css.textContent =
    '.photoWrap{position:absolute;inset:0}' +
    '.photoImg{width:100%;height:100%;object-fit:cover;object-position:center 20%;transition:filter .4s,transform .4s;transform-origin:center 30%}' +
    '#studio.speaking .photoImg{filter:brightness(1.04) saturate(1.05)}' +
    '.photoImg.talkbob{animation:talkbob 2.4s ease-in-out infinite}' +
    '@keyframes talkbob{0%,100%{transform:scale(1.02) translateY(0)}50%{transform:scale(1.05) translateY(-5px)}}' +
    '.glCanvas{width:100%;height:100%;display:block}';
  document.head.appendChild(css);
})();
