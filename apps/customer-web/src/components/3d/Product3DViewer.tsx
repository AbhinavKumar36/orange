'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';

export type ProductModelType = 'cake' | 'juice' | 'chocolate';
export type LightingMode = 'studio' | 'amber' | 'midnight';

interface Product3DViewerProps {
  productType?: ProductModelType;
  interactive?: boolean;
  autoRotate?: boolean;
  lightingMode?: LightingMode;
  className?: string;
}

export function Product3DViewer({
  productType = 'cake',
  interactive = true,
  autoRotate: defaultAutoRotate = true,
  lightingMode = 'studio',
  className = '',
}: Product3DViewerProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState(defaultAutoRotate);
  const [currentLightMode, setCurrentLightMode] = useState<LightingMode>(lightingMode);
  const [hasWebGL, setHasWebGL] = useState(true);

  // References to update dynamically without rebuilding scene
  const lightsRef = useRef<{
    keyLight?: THREE.DirectionalLight;
    rimLight?: THREE.DirectionalLight;
    ambient?: THREE.AmbientLight;
  }>({});
  const autoRotateRef = useRef(defaultAutoRotate);
  const resetCamRef = useRef<() => void>(() => {});

  useEffect(() => {
    autoRotateRef.current = isRotating;
  }, [isRotating]);

  // Update lighting mode dynamically
  useEffect(() => {
    const lights = lightsRef.current;
    if (!lights.keyLight || !lights.rimLight || !lights.ambient) return;

    if (currentLightMode === 'studio') {
      lights.ambient.color.setHex(0xfff8f0);
      lights.ambient.intensity = 0.85;
      lights.keyLight.color.setHex(0xfffaea);
      lights.keyLight.intensity = 2.4;
      lights.rimLight.color.setHex(0xff9944);
      lights.rimLight.intensity = 2.0;
    } else if (currentLightMode === 'amber') {
      lights.ambient.color.setHex(0xffeedd);
      lights.ambient.intensity = 0.6;
      lights.keyLight.color.setHex(0xff8811);
      lights.keyLight.intensity = 3.2;
      lights.rimLight.color.setHex(0xffaa22);
      lights.rimLight.intensity = 3.5;
    } else if (currentLightMode === 'midnight') {
      lights.ambient.color.setHex(0x332244);
      lights.ambient.intensity = 0.4;
      lights.keyLight.color.setHex(0xffddaa);
      lights.keyLight.intensity = 2.8;
      lights.rimLight.color.setHex(0xff5500);
      lights.rimLight.intensity = 4.2;
    }
  }, [currentLightMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    try {
      const test = document.createElement('canvas');
      const gl = test.getContext('webgl') || test.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    const width = container.clientWidth || 450;
    const height = container.clientHeight || 450;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.6, 4.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambient = new THREE.AmbientLight(0xfff8f0, 0.85);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfffaea, 2.4);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff9944, 2.0);
    rimLight.position.set(-3, -2, -3);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x7788aa, 0.6);
    fillLight.position.set(-4, 3, 2);
    scene.add(fillLight);

    lightsRef.current = { keyLight, rimLight, ambient };

    // Model Root Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // Track resources for cleanup
    const disposables: Array<{ dispose: () => void }> = [];

    // --- Build Procedural Models based on productType ---
    if (productType === 'cake') {
      // 1. Dark Chocolate Truffle Cake
      // Platter
      const plateMat = new THREE.MeshPhysicalMaterial({
        color: 0xf5f0eb,
        roughness: 0.1,
        clearcoat: 0.8,
      });
      const plateGeo = new THREE.CylinderGeometry(1.6, 1.4, 0.08, 48);
      disposables.push(plateMat, plateGeo);
      const plate = new THREE.Mesh(plateGeo, plateMat);
      plate.position.y = -0.7;
      plate.receiveShadow = true;
      modelGroup.add(plate);

      // Sponge Layers
      const spongeMat = new THREE.MeshStandardMaterial({
        color: 0x2e180d,
        roughness: 0.8,
      });
      const spongeGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.8, 48);
      disposables.push(spongeMat, spongeGeo);
      const sponge = new THREE.Mesh(spongeGeo, spongeMat);
      sponge.position.y = -0.26;
      sponge.castShadow = true;
      modelGroup.add(sponge);

      // Silky Chocolate Ganache Mirror Glaze Top
      const ganacheMat = new THREE.MeshPhysicalMaterial({
        color: 0x1f0d06,
        roughness: 0.08,
        metalness: 0.1,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        sheen: 0.6,
        sheenColor: 0x592813,
      });
      const ganacheGeo = new THREE.CylinderGeometry(1.22, 1.22, 0.15, 48);
      disposables.push(ganacheMat, ganacheGeo);
      const ganache = new THREE.Mesh(ganacheGeo, ganacheMat);
      ganache.position.y = 0.15;
      ganache.castShadow = true;
      modelGroup.add(ganache);

      // Ganache Drips on Cake Sides
      const dripMat = ganacheMat;
      const dripGeo = new THREE.SphereGeometry(0.08, 16, 16);
      disposables.push(dripGeo);
      for (let i = 0; i < 8; i++) {
        const drip = new THREE.Mesh(dripGeo, dripMat);
        const angle = (i / 8) * Math.PI * 2;
        drip.position.set(
          Math.cos(angle) * 1.21,
          0.02 - Math.random() * 0.25,
          Math.sin(angle) * 1.21
        );
        drip.scale.set(1, 1.6, 0.8);
        modelGroup.add(drip);
      }

      // Topping: Glossy Candied Valencia Orange Slice
      const orangeSliceMat = new THREE.MeshPhysicalMaterial({
        color: 0xff7700,
        emissive: 0x441100,
        roughness: 0.2,
        clearcoat: 0.9,
        transmission: 0.4,
        ior: 1.4,
      });
      const sliceGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.06, 24, 1, false, 0, Math.PI * 1.2);
      disposables.push(orangeSliceMat, sliceGeo);
      const slice = new THREE.Mesh(sliceGeo, orangeSliceMat);
      slice.position.set(0.1, 0.35, 0.1);
      slice.rotation.set(0.4, 0.3, 0.7);
      modelGroup.add(slice);

      // Fresh Berries
      const berryMat = new THREE.MeshPhysicalMaterial({
        color: 0x880011,
        roughness: 0.25,
        clearcoat: 0.8,
      });
      const berryGeo = new THREE.SphereGeometry(0.12, 16, 16);
      disposables.push(berryMat, berryGeo);
      const berry1 = new THREE.Mesh(berryGeo, berryMat);
      berry1.position.set(-0.25, 0.32, 0.2);
      modelGroup.add(berry1);
      const berry2 = new THREE.Mesh(berryGeo, berryMat);
      berry2.position.set(-0.15, 0.31, -0.15);
      modelGroup.add(berry2);

    } else if (productType === 'juice') {
      // 2. Valencia Orange Cold-Pressed Juice Decanter
      // Glass Decanter Body
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.05,
        transmission: 0.92,
        ior: 1.52,
        thickness: 0.4,
        transparent: true,
        opacity: 0.9,
      });
      const bottleGeo = new THREE.CylinderGeometry(0.65, 0.75, 1.8, 32);
      disposables.push(glassMat, bottleGeo);
      const bottle = new THREE.Mesh(bottleGeo, glassMat);
      bottle.position.y = 0;
      modelGroup.add(bottle);

      // Golden Orange Liquid Fill
      const liquidMat = new THREE.MeshPhysicalMaterial({
        color: 0xff6a00,
        emissive: 0x551b00,
        roughness: 0.15,
        transmission: 0.45,
        ior: 1.34,
        sheen: 0.8,
        sheenColor: 0xffa834,
      });
      const liquidGeo = new THREE.CylinderGeometry(0.6, 0.7, 1.6, 32);
      disposables.push(liquidMat, liquidGeo);
      const liquid = new THREE.Mesh(liquidGeo, liquidMat);
      liquid.position.y = -0.08;
      modelGroup.add(liquid);

      // Golden Metal Cap
      const capMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.25,
        metalness: 0.85,
      });
      const capGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 24);
      disposables.push(capMat, capGeo);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.y = 1.05;
      modelGroup.add(cap);

      // Gold Citrus Emblem Seal
      const sealMat = new THREE.MeshStandardMaterial({
        color: 0xffaa00,
        roughness: 0.3,
        metalness: 0.6,
      });
      const sealGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 24);
      disposables.push(sealMat, sealGeo);
      const seal = new THREE.Mesh(sealGeo, sealMat);
      seal.rotation.x = Math.PI / 2;
      seal.position.set(0, 0, 0.68);
      modelGroup.add(seal);

    } else {
      // 3. Artisanal Praline Confectionery Box
      // Luxury Hexagonal Box
      const boxMat = new THREE.MeshPhysicalMaterial({
        color: 0x22130b,
        roughness: 0.3,
        clearcoat: 0.5,
      });
      const boxGeo = new THREE.CylinderGeometry(1.3, 1.25, 0.6, 6);
      disposables.push(boxMat, boxGeo);
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = -0.3;
      box.castShadow = true;
      modelGroup.add(box);

      // Gold Ribbon Accent
      const ribbonMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        roughness: 0.3,
        metalness: 0.8,
      });
      const ribbonGeo = new THREE.CylinderGeometry(1.32, 1.27, 0.12, 6);
      disposables.push(ribbonMat, ribbonGeo);
      const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
      ribbon.position.y = -0.15;
      modelGroup.add(ribbon);

      // Praline 1: Dark Chocolate Dome with Cocoa Nibs
      const choc1Mat = new THREE.MeshPhysicalMaterial({
        color: 0x1a0d06,
        roughness: 0.15,
        clearcoat: 0.9,
      });
      const choc1Geo = new THREE.SphereGeometry(0.26, 24, 24);
      disposables.push(choc1Mat, choc1Geo);
      const p1 = new THREE.Mesh(choc1Geo, choc1Mat);
      p1.position.set(-0.4, 0.2, 0.2);
      p1.scale.set(1, 0.8, 1);
      modelGroup.add(p1);

      // Praline 2: Golden Dusted Pyramid Praline
      const choc2Mat = new THREE.MeshPhysicalMaterial({
        color: 0x3d200f,
        roughness: 0.4,
        metalness: 0.2,
        sheen: 0.9,
        sheenColor: 0xd4af37,
      });
      const choc2Geo = new THREE.ConeGeometry(0.28, 0.38, 4);
      disposables.push(choc2Mat, choc2Geo);
      const p2 = new THREE.Mesh(choc2Geo, choc2Mat);
      p2.position.set(0.4, 0.2, 0.15);
      p2.rotation.y = Math.PI * 0.25;
      modelGroup.add(p2);

      // Praline 3: Hazelnut Swirl Truffle
      const choc3Mat = new THREE.MeshPhysicalMaterial({
        color: 0x4f2b14,
        roughness: 0.2,
        clearcoat: 0.7,
      });
      const choc3Geo = new THREE.TorusGeometry(0.18, 0.1, 16, 24);
      disposables.push(choc3Mat, choc3Geo);
      const p3 = new THREE.Mesh(choc3Geo, choc3Mat);
      p3.position.set(0, 0.2, -0.35);
      p3.rotation.x = Math.PI * 0.5;
      modelGroup.add(p3);
    }

    // Shadow Floor
    const shadowGeo = new THREE.PlaneGeometry(3.5, 3.5);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(64, 64, 5, 64, 64, 60);
      grad.addColorStop(0, 'rgba(15, 12, 10, 0.8)');
      grad.addColorStop(1, 'rgba(15, 12, 10, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 128, 128);
    }
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    disposables.push(shadowGeo, shadowTex, shadowMat);
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.y = -0.9;
    scene.add(shadowMesh);

    // Orbit Drag & Zoom State
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let rotationVelocityX = 0;
    let rotationVelocityY = 0;
    let cameraDistance = 4.4;
    const minDistance = 2.8;
    const maxDistance = 6.5;

    resetCamRef.current = () => {
      modelGroup.rotation.set(0, 0, 0);
      cameraDistance = 4.4;
      camera.position.set(0, 0.6, 4.4);
      camera.lookAt(0, 0, 0);
    };

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (!interactive) return;
      isDragging = true;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      prevMouseX = clientX;
      prevMouseY = clientY;
    }

    function onPointerMove(e: MouseEvent | TouchEvent) {
      if (!isDragging || !interactive) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const deltaX = clientX - prevMouseX;
      const deltaY = clientY - prevMouseY;

      rotationVelocityY = deltaX * 0.008;
      rotationVelocityX = deltaY * 0.008;

      modelGroup.rotation.y += rotationVelocityY;
      modelGroup.rotation.x = Math.max(-0.6, Math.min(0.8, modelGroup.rotation.x + rotationVelocityX));

      prevMouseX = clientX;
      prevMouseY = clientY;
    }

    function onPointerUp() {
      isDragging = false;
    }

    function onWheel(e: WheelEvent) {
      if (!interactive) return;
      e.preventDefault();
      cameraDistance = Math.max(minDistance, Math.min(maxDistance, cameraDistance + e.deltaY * 0.003));
      camera.position.set(0, cameraDistance * 0.14, cameraDistance);
    }

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    dom.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    // Render loop
    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);

      if (autoRotateRef.current && !isDragging) {
        modelGroup.rotation.y += 0.007;
      } else if (!isDragging) {
        // Apply inertia friction
        rotationVelocityY *= 0.92;
        rotationVelocityX *= 0.92;
        modelGroup.rotation.y += rotationVelocityY;
        modelGroup.rotation.x = Math.max(-0.6, Math.min(0.8, modelGroup.rotation.x + rotationVelocityX));
      }

      renderer.render(scene, camera);
    }
    animate();

    function handleResize() {
      if (!container) return;
      const w = container.clientWidth || 450;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      dom.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }

      disposables.forEach((item) => item.dispose());
      renderer.dispose();
    };
  }, [productType, interactive]);

  return (
    <div className={`product-3d-viewer-wrapper ${className}`} style={{ position: 'relative', width: '100%', height: '100%', minHeight: '340px' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: interactive ? 'grab' : 'default',
          touchAction: 'none',
        }}
        role="region"
        aria-label="Interactive 3D product view. Drag to rotate 360 degrees."
      />

      {!hasWebGL && (
        <div className="product-webgl-fallback">
          <span style={{ fontSize: '3rem' }}>
            {productType === 'cake' ? '🎂' : productType === 'juice' ? '🍊' : '🍫'}
          </span>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#888' }}>
            Interactive 3D preview requires WebGL.
          </p>
        </div>
      )}

      {/* Floating 3D Controls Bar */}
      {interactive && hasWebGL && (
        <div className="viewer-controls-overlay">
          <div className="viewer-pill-group">
            <button
              type="button"
              className={`viewer-btn ${isRotating ? 'active' : ''}`}
              onClick={() => setIsRotating(!isRotating)}
              title={isRotating ? 'Pause rotation' : 'Start auto-rotate'}
              aria-label={isRotating ? 'Pause rotation' : 'Start auto-rotate'}
            >
              {isRotating ? '⏸️ Spin' : '▶️ Spin'}
            </button>
            <button
              type="button"
              className="viewer-btn"
              onClick={() => resetCamRef.current()}
              title="Reset view"
              aria-label="Reset view angle"
            >
              🔄 Reset
            </button>
          </div>

          <div className="viewer-lighting-group">
            <span className="lighting-label">Lighting:</span>
            <button
              type="button"
              className={`light-btn ${currentLightMode === 'studio' ? 'active' : ''}`}
              onClick={() => setCurrentLightMode('studio')}
              title="Warm Studio Lighting"
            >
              Studio
            </button>
            <button
              type="button"
              className={`light-btn ${currentLightMode === 'amber' ? 'active' : ''}`}
              onClick={() => setCurrentLightMode('amber')}
              title="Sunset Amber Lighting"
            >
              Amber
            </button>
            <button
              type="button"
              className={`light-btn ${currentLightMode === 'midnight' ? 'active' : ''}`}
              onClick={() => setCurrentLightMode('midnight')}
              title="Midnight Noir Lighting"
            >
              Noir
            </button>
          </div>

          <div className="drag-hint-badge">
            <span aria-hidden="true">👆</span> Drag to inspect in 360°
          </div>
        </div>
      )}
    </div>
  );
}
