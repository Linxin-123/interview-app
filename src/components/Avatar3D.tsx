import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

interface Avatar3DProps {
  modelUrl: string;
  speaking: boolean;
  listening: boolean;
  onError?: () => void;
}

/* A free, in-browser live digital human (three.js). Mouth moves while the coach speaks
   (driven by the browser voice), eyes blink, and the head nods attentively while you
   answer. Works with a locally-bundled .glb (no internet) or a Ready Player Me URL. */
export default function Avatar3D({ modelUrl, speaking, listening, onError }: Avatar3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef(speaking);
  const listeningRef = useRef(listening);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let raf = 0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, mount.clientWidth / mount.clientHeight, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const key = new THREE.DirectionalLight(0xfff2e8, 2.2); key.position.set(1.2, 2.0, 2.5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9d7bff, 1.3); rim.position.set(-2, 1.5, -1.5); scene.add(rim);
    const fill = new THREE.PointLight(0x67d4ff, 0.7); fill.position.set(-1, 0.5, 2); scene.add(fill);

    const morphMeshes: THREE.Mesh[] = [];
    let headBone: THREE.Object3D | null = null;
    let model: THREE.Group | null = null;
    let baseY = 0;

    const setMorph = (names: string[], value: number, lerp = 0.35) => {
      morphMeshes.forEach(mesh => {
        const dict = (mesh as any).morphTargetDictionary as Record<string, number> | undefined;
        const infl = (mesh as any).morphTargetInfluences as number[] | undefined;
        if (!dict || !infl) return;
        for (const n of names) {
          const i = dict[n];
          if (i !== undefined) { infl[i] += (value - infl[i]) * lerp; break; }
        }
      });
    };

    const loader = new GLTFLoader();
    const ktx2 = new KTX2Loader().setTranscoderPath(import.meta.env.BASE_URL + 'basis/').detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      modelUrl,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;
        model.traverse((o: any) => {
          if (o.isMesh && o.morphTargetDictionary) morphMeshes.push(o);
          if (o.isBone && /head/i.test(o.name) && !headBone) headBone = o;
        });

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const tall = size.y > size.x * 1.6;
        const lookY = tall ? size.y * 0.40 : 0;
        const focus = tall ? size.y * 0.30 : Math.max(size.x, size.y) * 1.05;
        const dist = (focus / 2) / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.5;
        baseY = model.position.y;
        camera.position.set(0, lookY, dist);
        camera.lookAt(0, lookY, 0);
        scene.add(model);
      },
      undefined,
      () => { if (!disposed && onError) onError(); }
    );

    let t = 0, nextBlink = 1.5, blinkT = -1, nod = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      t += dt;

      if (model) {
        model.position.y = baseY + Math.sin(t * 1.1) * 0.004;
        model.rotation.y = Math.sin(t * 0.5) * 0.05;
        const nodTarget = (listeningRef.current ? Math.sin(t * 2.2) * 0.05 : Math.sin(t * 0.8) * 0.012) + nod;
        if (headBone) (headBone as any).rotation.x = nodTarget;
        else model.rotation.x = nodTarget * 0.5;
        nod *= 0.9;
      }

      blinkT -= dt;
      if (blinkT < -0.2) {
        nextBlink -= dt;
        if (nextBlink <= 0) { blinkT = 0.12; nextBlink = 1.4 + Math.random() * (listeningRef.current ? 2.5 : 4); }
      }
      const blink = blinkT > 0 ? 1 : 0;
      setMorph(['eyeBlink_L', 'eyeBlinkLeft'], blink, 0.6);
      setMorph(['eyeBlink_R', 'eyeBlinkRight'], blink, 0.6);

      if (speakingRef.current) {
        const open = 0.10 + Math.abs(Math.sin(t * 17)) * 0.32 + Math.random() * 0.07;
        setMorph(['jawOpen', 'mouthOpen', 'viseme_aa'], open, 0.5);
        setMorph(['mouthSmile_L', 'mouthSmileLeft'], 0.07);
        setMorph(['mouthSmile_R', 'mouthSmileRight'], 0.07);
      } else {
        setMorph(['jawOpen', 'mouthOpen', 'viseme_aa'], 0.0, 0.3);
        const smile = listeningRef.current ? 0.2 : 0.1;
        setMorph(['mouthSmile_L', 'mouthSmileLeft'], smile);
        setMorph(['mouthSmile_R', 'mouthSmileRight'], smile);
        if (listeningRef.current && Math.random() < 0.004) nod = 0.06;
      }

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      ktx2.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose?.());
      });
    };
  }, [modelUrl]);

  return <div ref={mountRef} className="w-full h-full" />;
}
