'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';

/**
 * Creates a procedural citrus peel bump texture using an offscreen canvas.
 * This generates thousands of microscopic pores and dimples for a photorealistic orange surface.
 */
function createOrangeSkinTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    // Generate natural pore noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      // High-frequency subtle noise
      const n = (Math.random() - 0.5) * 35;
      const v = Math.min(255, Math.max(0, 128 + n));
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);

    // Add larger organic pore indents
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 1 + Math.random() * 2.5;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(60, 60, 60, 0.4)');
      grad.addColorStop(1, 'rgba(128, 128, 128, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  return texture;
}

export function Hero3DCanvas(): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
        return;
      }
    } catch {
      setHasWebGL(false);
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Scene & Camera Setup
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 600;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 5.2);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 3. Lighting (Studio Patisserie & Luxury Amber Glow)
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 0.9);
    scene.add(ambientLight);

    // Key Light (Warm, high angle)
    const keyLight = new THREE.DirectionalLight(0xffeedd, 2.8);
    keyLight.position.set(4, 6, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Rim Light (Vibrant orange from back-right)
    const rimLight = new THREE.DirectionalLight(0xff6a00, 4.0);
    rimLight.position.set(-4, -2, -3);
    scene.add(rimLight);

    // Soft Lavender / Cool Fill Light (Adds editorial color depth)
    const fillLight = new THREE.DirectionalLight(0x8899cc, 0.8);
    fillLight.position.set(-4, 3, 3);
    scene.add(fillLight);

    // Point Light near centerpiece for subtle subsurface glow
    const coreGlow = new THREE.PointLight(0xff7700, 2.5, 6);
    coreGlow.position.set(0, 0, 0.5);
    scene.add(coreGlow);

    // 4. Centerpiece Composition Group
    const composition = new THREE.Group();
    scene.add(composition);

    // --- A. Procedural Bump Map & Orange Material ---
    const bumpTexture = createOrangeSkinTexture();

    const orangeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xff6600,
      emissive: 0x3d1400,
      roughness: 0.26,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      sheen: 0.8,
      sheenColor: 0xffa333,
      bumpMap: bumpTexture,
      bumpScale: 0.015,
      ior: 1.45,
    });

    // Orange Body (Sphere with slight vertical compression for organic shape)
    const orangeGeo = new THREE.SphereGeometry(1.2, 64, 64);
    const orangeMesh = new THREE.Mesh(orangeGeo, orangeMaterial);
    orangeMesh.scale.set(1.05, 0.96, 1.02);
    orangeMesh.castShadow = true;
    orangeMesh.receiveShadow = true;
    composition.add(orangeMesh);

    // --- B. Botanical Stem & Leaf ---
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: 0x382313,
      roughness: 0.7,
      metalness: 0.1,
    });
    const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.35, 16);
    const stemMesh = new THREE.Mesh(stemGeo, stemMaterial);
    stemMesh.position.set(0, 1.25, 0);
    stemMesh.rotation.z = -0.15;
    composition.add(stemMesh);

    // Leaf (Silky deep emerald green)
    const leafMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1f6630,
      roughness: 0.3,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      side: THREE.DoubleSide,
    });
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.bezierCurveTo(0.2, 0.2, 0.45, 0.6, 0.1, 0.9);
    leafShape.bezierCurveTo(-0.25, 0.6, -0.1, 0.2, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape);
    const leafMesh = new THREE.Mesh(leafGeo, leafMaterial);
    leafMesh.position.set(0.02, 1.22, 0);
    leafMesh.rotation.set(-0.2, 0.4, -0.6);
    leafMesh.scale.set(0.9, 0.9, 0.9);
    composition.add(leafMesh);

    // Second smaller leaf
    const leafMesh2 = leafMesh.clone();
    leafMesh2.rotation.set(0.3, -0.5, 0.7);
    leafMesh2.scale.set(0.65, 0.65, 0.65);
    composition.add(leafMesh2);

    // --- C. Floating Golden Nectar Droplets ---
    const dropletMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffaa00,
      emissive: 0x552200,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.7,
      ior: 1.5,
      clearcoat: 1.0,
    });

    const dropletsGroup = new THREE.Group();
    const dropletCount = 10;
    const droplets: Array<{ mesh: THREE.Mesh; speed: number; phase: number; radius: number; yBase: number }> = [];

    for (let i = 0; i < dropletCount; i++) {
      const radius = 0.04 + Math.random() * 0.07;
      const dGeo = new THREE.SphereGeometry(radius, 24, 24);
      const dMesh = new THREE.Mesh(dGeo, dropletMaterial);

      const orbitRadius = 1.6 + Math.random() * 0.7;
      const angle = (i / dropletCount) * Math.PI * 2 + Math.random() * 0.5;
      const yBase = (Math.random() - 0.5) * 1.8;

      dMesh.position.set(
        Math.cos(angle) * orbitRadius,
        yBase,
        Math.sin(angle) * orbitRadius
      );

      dropletsGroup.add(dMesh);
      droplets.push({
        mesh: dMesh,
        speed: 0.5 + Math.random() * 0.8,
        phase: Math.random() * Math.PI * 2,
        radius: orbitRadius,
        yBase,
      });
    }
    composition.add(dropletsGroup);

    // --- D. Sculptural Luxury Orbital Glass Rings ---
    const ringMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffd9aa,
      roughness: 0.1,
      metalness: 0.3,
      transmission: 0.85,
      ior: 1.45,
      transparent: true,
      opacity: 0.55,
    });
    const ringGeo = new THREE.TorusGeometry(1.9, 0.015, 16, 100);
    const ringMesh1 = new THREE.Mesh(ringGeo, ringMaterial);
    ringMesh1.rotation.x = Math.PI * 0.35;
    ringMesh1.rotation.y = Math.PI * 0.15;
    composition.add(ringMesh1);

    const ringGeo2 = new THREE.TorusGeometry(2.1, 0.01, 16, 100);
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMaterial);
    ringMesh2.rotation.x = -Math.PI * 0.28;
    ringMesh2.rotation.z = Math.PI * 0.2;
    composition.add(ringMesh2);

    // --- E. Soft Contact Shadow Plane Beneath ---
    const shadowGeo = new THREE.PlaneGeometry(3.5, 3.5);
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 256;
    shadowCanvas.height = 256;
    const sCtx = shadowCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(128, 128, 10, 128, 128, 120);
      grad.addColorStop(0, 'rgba(10, 8, 7, 0.85)');
      grad.addColorStop(0.5, 'rgba(10, 8, 7, 0.4)');
      grad.addColorStop(1, 'rgba(10, 8, 7, 0)');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 256, 256);
    }
    const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.45;
    scene.add(shadowPlane);

    setIsLoaded(true);

    // 5. Interaction & Parallax Variables
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let scrollProgress = 0;
    let isVisible = true;

    function handleMouseMove(e: MouseEvent) {
      const rect = container?.getBoundingClientRect();
      if (!rect) return;
      // Normalized coordinates (-1 to +1) centered on element
      const clientX = e.clientX - (rect.left + rect.width / 2);
      const clientY = e.clientY - (rect.top + rect.height / 2);
      targetX = clientX / (rect.width / 2);
      targetY = clientY / (rect.height / 2);
    }

    function handleScroll() {
      const scrollY = window.scrollY || window.pageYOffset;
      const windowH = window.innerHeight || 800;
      scrollProgress = Math.min(1.5, Math.max(0, scrollY / windowH));
    }

    // Touch support for mobile tilt
    function handleTouchMove(e: TouchEvent) {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = container?.getBoundingClientRect();
        if (!rect) return;
        const clientX = touch.clientX - (rect.left + rect.width / 2);
        const clientY = touch.clientY - (rect.top + rect.height / 2);
        targetX = (clientX / (rect.width / 2)) * 0.7;
        targetY = (clientY / (rect.height / 2)) * 0.7;
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Pause rendering when outside viewport to optimize performance
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        isVisible = entry.isIntersecting;
      });
    }, { threshold: 0.1 });
    observer.observe(container);

    // Resize handler
    function handleResize() {
      if (!container) return;
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 600;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    // 6. Animation Loop
    let animationFrameId: number;
    const clock = new THREE.Clock();

    function animate() {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;

      const elapsedTime = clock.getElapsedTime();

      if (!prefersReducedMotion) {
        // Smooth mouse spring interpolation (lerp)
        mouseX += (targetX - mouseX) * 0.04;
        mouseY += (targetY - mouseY) * 0.04;

        // Gentle idle levitation & breathing
        const levitation = Math.sin(elapsedTime * 1.4) * 0.08;
        composition.position.y = levitation - scrollProgress * 0.5;

        // Rotation reactive to mouse and idle drift
        composition.rotation.y = elapsedTime * 0.18 + mouseX * 0.55 + scrollProgress * 1.2;
        composition.rotation.x = mouseY * 0.35 + Math.sin(elapsedTime * 0.8) * 0.05;
        composition.rotation.z = mouseX * -0.15;

        // Subtle orbit ring counter-rotation
        ringMesh1.rotation.z += 0.003;
        ringMesh2.rotation.y -= 0.0025;

        // Animate floating droplets
        for (let i = 0; i < droplets.length; i++) {
          const d = droplets[i];
          const dropTime = elapsedTime * d.speed + d.phase;
          d.mesh.position.y = d.yBase + Math.sin(dropTime) * 0.15;
          d.mesh.position.x = Math.cos(dropTime * 0.7) * d.radius;
          d.mesh.position.z = Math.sin(dropTime * 0.7) * d.radius;
        }

        // Dynamic rim light movement tracking mouse
        rimLight.position.x = -4 + mouseX * 2;
        rimLight.position.y = -2 - mouseY * 2;
      }

      renderer.render(scene, camera);
    }

    animate();

    // 7. Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }

      orangeGeo.dispose();
      orangeMaterial.dispose();
      bumpTexture.dispose();
      stemGeo.dispose();
      stemMaterial.dispose();
      leafGeo.dispose();
      leafMaterial.dispose();
      dropletMaterial.dispose();
      ringGeo.dispose();
      ringGeo2.dispose();
      ringMaterial.dispose();
      shadowGeo.dispose();
      shadowMat.dispose();
      shadowTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="hero-3d-canvas-container"
      role="img"
      aria-label="Interactive 3D Moody Orange sculpture centerpiece with glossy citrus surface and floating nectar droplets"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '380px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Graceful Fallback if WebGL is unavailable */}
      {!hasWebGL && (
        <div className="hero-webgl-fallback">
          <div className="fallback-glow-sphere" />
          <div className="fallback-citrus-badge">
            <span style={{ fontSize: '4rem' }}>🍊</span>
            <div style={{ marginTop: '0.75rem', fontWeight: 700, color: '#FF7A00', letterSpacing: '0.05em' }}>
              MOODY ORANGE
            </div>
            <div style={{ fontSize: '0.85rem', color: '#A8A29E' }}>
              Artisanal Confectionery
            </div>
          </div>
        </div>
      )}

      {/* Subtle loader shimmer until 3D scene finishes first frame */}
      {!isLoaded && hasWebGL && (
        <div
          style={{
            position: 'absolute',
            width: '200px',
            height: '200px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 102, 0, 0.25) 0%, rgba(10, 9, 8, 0) 70%)',
            animation: 'pulseGlow 2s ease-in-out infinite',
          }}
        />
      )}
    </div>
  );
}
