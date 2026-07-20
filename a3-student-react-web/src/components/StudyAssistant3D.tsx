/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface StudyAssistant3DProps {
  className?: string;
  modelUrl?: string;
  minRenderWidth?: number;
  minRenderHeight?: number;
  minHeightClassName?: string;
  modelYOffset?: number;
  modelScale?: number;
}

const DEFAULT_MODEL_URL = "/models/haibara-ai.glb";
const MODEL_CACHE = new Map<string, Promise<THREE.Group>>();

function loadModelOnce(modelUrl: string) {
  const cached = MODEL_CACHE.get(modelUrl);
  if (cached) return cached;

  const promise = new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => resolve(gltf.scene),
      undefined,
      reject,
    );
  });

  MODEL_CACHE.set(modelUrl, promise);
  return promise;
}

export default function StudyAssistant3D({
  className = "",
  modelUrl = DEFAULT_MODEL_URL,
  minRenderWidth = 320,
  minRenderHeight = 360,
  minHeightClassName = "min-h-[360px]",
  modelYOffset = 0.48,
  modelScale = 3.05,
}: StudyAssistant3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let frame = 0;
    let model: THREE.Group | null = null;
    let modelBaseY = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let loadTimer = 0;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    camera.position.set(0, 1.15, 5.2);

    const resize = () => {
      if (!renderer) return;
      const rect = mount.getBoundingClientRect();
      const parentRect = mount.parentElement?.getBoundingClientRect();
      const fallbackWidth = Math.min(window.innerWidth * 0.7, 920);
      const fallbackHeight = Math.min(window.innerHeight * 0.76, 680);
      const width = Math.max(minRenderWidth, rect.width || parentRect?.width || fallbackWidth);
      const height = Math.max(minRenderHeight, rect.height || parentRect?.height || fallbackHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, true);
    };

    const fitModel = (object: THREE.Group) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const fitAxis = Math.max(size.y, size.x * 1.3, size.z * 1.3) || 1;
      object.position.sub(center);
      object.scale.setScalar(modelScale / fitAxis);
      object.position.y += modelYOffset;
    };

    const sharpenTexture = (texture?: THREE.Texture | null) => {
      if (!texture || !renderer) return;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
    };

    const sharpenMaterial = (material: THREE.Material) => {
      const candidate = material as THREE.MeshStandardMaterial & {
        map?: THREE.Texture | null;
        normalMap?: THREE.Texture | null;
        roughnessMap?: THREE.Texture | null;
        metalnessMap?: THREE.Texture | null;
        emissiveMap?: THREE.Texture | null;
        aoMap?: THREE.Texture | null;
      };
      sharpenTexture(candidate.map);
      sharpenTexture(candidate.normalMap);
      sharpenTexture(candidate.roughnessMap);
      sharpenTexture(candidate.metalnessMap);
      sharpenTexture(candidate.emissiveMap);
      sharpenTexture(candidate.aoMap);
      material.needsUpdate = true;
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = {
        x: (event.clientX / window.innerWidth - 0.5) * 2,
        y: (event.clientY / window.innerHeight - 0.5) * 2,
      };
    };

    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      mount.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight("#ffffff", 2.1));
      const key = new THREE.DirectionalLight("#ffffff", 3.2);
      key.position.set(2.4, 3.8, 4.5);
      key.castShadow = true;
      scene.add(key);
      const rim = new THREE.PointLight("#8fd5ff", 2.2, 8);
      rim.position.set(-2.5, 1.8, 2.6);
      scene.add(rim);

      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(mount);
      if (mount.parentElement) {
        resizeObserver.observe(mount.parentElement);
      }
      window.addEventListener("resize", resize);
      window.addEventListener("pointermove", onPointerMove, { passive: true });

      loadTimer = window.setTimeout(() => {
        if (!disposed && !model) {
          setStatus((current) => (current === "loading" ? "loading" : current));
        }
      }, 4000);

      loadModelOnce(modelUrl)
        .then((loadedModel) => {
          if (disposed || !renderer) return;
          const clonedModel = loadedModel.clone(true) as THREE.Group;
          model = clonedModel;
          fitModel(model);
          modelBaseY = model.position.y;
          model.traverse((object) => {
            if (object instanceof THREE.Mesh) {
              object.castShadow = true;
              object.receiveShadow = true;
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach(sharpenMaterial);
            }
          });
          scene.add(model);
          setStatus("ready");
        })
        .catch((error) => {
          if (disposed) return;
          console.warn("Failed to load study assistant model", error);
          setStatus("error");
        });

      const animate = () => {
        frame = window.requestAnimationFrame(animate);
        const target = pointerRef.current;
        if (model) {
          const time = Date.now() * 0.001;
          model.rotation.y = THREE.MathUtils.lerp(model.rotation.y, target.x * 0.34, 0.08);
          model.rotation.x = THREE.MathUtils.lerp(model.rotation.x, target.y * 0.08, 0.08);
          model.position.y = modelBaseY + Math.sin(time * 1.35) * 0.028;
        }
        renderer?.render(scene, camera);
      };

      animate();
    } catch (error) {
      console.warn("Study assistant renderer failed", error);
      setStatus("error");
    }

    return () => {
      disposed = true;
      window.clearTimeout(loadTimer);
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      renderer?.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      if (renderer?.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [minRenderHeight, minRenderWidth, modelScale, modelUrl, modelYOffset]);

  return (
    <div className={`relative ${minHeightClassName} overflow-visible ${className}`}>
      <div ref={mountRef} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true" />
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center p-5 text-center">
          {status === "loading" ? (
            <div className="flex items-center gap-2 bg-white/88 px-3 py-2 text-[10px] font-bold text-[#71717a] backdrop-blur-sm">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#f4d0dc] border-t-[#FB7299]" />
              正在载入学习助手
            </div>
          ) : (
            <div className="max-w-[220px] border-l-2 border-[#FB7299] bg-white/90 px-3 py-2 text-left text-[10px] leading-5 text-[#52525b] backdrop-blur-sm">
              3D 助手模型暂未载入，请检查 public/models/haibara-ai.glb。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
