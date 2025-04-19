import * as THREE from '../three/three.module.js';
import { GLTFLoader } from '../three/three.GLTFLoader.js';
import { createLabel } from './planetLabels.js';

export async function loadSpheres(scene, camera) {
    const response = await fetch('constellation/spheres.json');
    const data = await response.json();

    const sphereMap = new Map();
    const textureLoader = new THREE.TextureLoader();
    const gltfLoader = new GLTFLoader();
    const dropdown = document.getElementById('planetDropdown');

    // Adjusted distances for solar system scale
    const TEXTURE_LOAD_DISTANCE = 5000000;
    const RING_LOAD_DISTANCE = 2000000;

    async function loadTextureWithLOD(url, position, isRing = false) {
        const loadDistance = isRing ? RING_LOAD_DISTANCE : TEXTURE_LOAD_DISTANCE;
        if (position.distanceTo(camera.position) > loadDistance) {
            return null;
        }
        return new Promise((resolve, reject) => {
            textureLoader.load(
                url,
                resolve,
                undefined,
                (err) => reject(err)
            );
        });
    }

    function createAtmosphere(sphere) {
        const atmosphereThickness = sphere.atmosphere_thickness || 1.05; // Default 5% larger than planet
        const atmosphereGeometry = new THREE.SphereGeometry(1.0, 128, 128);
        const atmosphereColor = new THREE.Color(sphere.atmosphere_color);
    
        const uniforms = {
            planetPosition: { value: new THREE.Vector3() },
            sunPosition: { value: new THREE.Vector3() },
            viewVector: { value: new THREE.Vector3() },
            atmosphereColor: { value: atmosphereColor },
            intensity: { value: sphere.atmosphere_intensity || 2.0 }, // Configurable intensity
            falloffFactor: { value: sphere.atmosphere_falloff || 2.0 }, // Configurable falloff
            planetRadius: { value: sphere.size },
            atmosphereScale: { value: atmosphereThickness }
        };
    
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: `
                uniform float planetRadius;
                uniform float atmosphereScale;
                varying vec3 vVertexWorldPosition;
                varying vec3 vVertexNormal;
                
                void main() {
                    vVertexNormal = normalize(normalMatrix * normal);
                    vec3 scaledPosition = position * planetRadius * atmosphereScale;
                    vVertexWorldPosition = (modelMatrix * vec4(scaledPosition, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(scaledPosition, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 atmosphereColor;
                uniform float intensity;
                uniform vec3 sunPosition;
                uniform vec3 planetPosition;
                
                varying vec3 vVertexWorldPosition;
                varying vec3 vVertexNormal;
                
                void main() {
                    vec3 lightDir = normalize(sunPosition - planetPosition);
                    vec3 normal = normalize(vVertexNormal);
                    vec3 viewDir = normalize(cameraPosition - vVertexWorldPosition);
                    
                    // Adjustable thickness effect
                    float rim = 1.0 - smoothstep(0.0, 0.3, dot(viewDir, normal));
                    float glow = pow(rim, 2.0) * intensity;
                    
                    // Directional scattering
                    float scattering = pow(max(dot(lightDir, normal), 0.0), 0.8) * 1.2;
                    
                    // Combine effects
                    vec3 color = atmosphereColor * (glow * 0.7 + scattering * 0.5);
                    float alpha = min(glow * 0.6 + scattering * 0.4, 0.8);
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
    
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        atmosphere.name = `${sphere.name}_atmosphere`;
        atmosphere.renderOrder = 1;
        return atmosphere;
    }

    for (const sphere of data) {
        let mesh;
        const position = new THREE.Vector3(...sphere.position);
        
        if (sphere.model) {
            try {
                const gltf = await gltfLoader.loadAsync(sphere.model);
                mesh = gltf.scene;
                
                const bbox = new THREE.Box3().setFromObject(mesh);
                const size = bbox.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                const scale = sphere.size / maxDim;
                mesh.scale.set(scale, scale, scale);
                
                mesh.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
            } catch (error) {
                console.error(`Failed to load model for ${sphere.name}:`, error);
                mesh = await createSphereMesh(sphere, position);
            }
        } else {
            mesh = await createSphereMesh(sphere, position);
        }

        if (sphere.atmosphere_color) {
            const atmosphere = createAtmosphere(sphere);
            mesh.add(atmosphere); 
            atmosphere.position.set(0, 0, 0);
            atmosphere.scale.set(1.1, 1.1, 1.1);
            mesh.userData.atmosphere = atmosphere;
        }

        const bbox = new THREE.Box3().setFromObject(mesh);
        mesh.userData.bbox = bbox;
        mesh.name = sphere.name;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.diameter = sphere.diameter;
        sphereMap.set(sphere.name, mesh);
    }

    for (const sphere of data) {
        const mesh = sphereMap.get(sphere.name);
        const index = data.indexOf(sphere);
        
        let position;
        if (sphere.relative_to && sphere.relative_to.trim() !== '') {
            const parentMesh = sphereMap.get(sphere.relative_to);
            if (parentMesh) {
                const parentPos = parentMesh.position;
                const orbitalDistance = sphere.position[0] + (parentMesh.diameter * 20);
                const angle = (index / data.length) * Math.PI * 2;
                position = new THREE.Vector3(
                    parentPos.x + Math.cos(angle) * orbitalDistance,
                    parentPos.y,
                    parentPos.z + Math.sin(angle) * orbitalDistance
                );
            } else {
                position = new THREE.Vector3(...sphere.position);
            }
        } else {
            const angle = (index / data.length) * Math.PI * 2 + Math.random() * 0.5;
            const distance = sphere.position[0];
            position = new THREE.Vector3(
                Math.cos(angle) * distance,
                0,
                Math.sin(angle) * distance
            );
        }

        mesh.position.copy(position);
        sphere.position = [position.x, position.y, position.z];

        // Add ring if specified
        if (sphere.ring_texture && sphere.ring_texture.trim() !== '') {
            try {
                const ringTexture = await loadTextureWithLOD(sphere.ring_texture, position, true);
                if (ringTexture) {
                    const ringInnerRadius = sphere.size * 1.5;
                    const ringOuterRadius = sphere.size * 2.5;
                    const ringGeometry = new THREE.RingGeometry(
                        ringInnerRadius,
                        ringOuterRadius,
                        64
                    );
                    
                    const ringMaterial = new THREE.MeshBasicMaterial({
                        map: ringTexture,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 0.8,
                        blending: THREE.NormalBlending,
                        color: 0xffffff
                    });

                    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                    ring.rotation.x = Math.PI / 2;
                    ring.position.copy(position);
                    scene.add(ring);
                    mesh.userData.ring = ring;
                }
            } catch (error) {
                console.error(`Failed to create ring for ${sphere.name}:`, error);
            }
        }

        if (sphere.star) {
            const light = new THREE.PointLight(
                getColorFromString(sphere.color),
                2,
                sphere.brightness,
                0
            );
            light.position.copy(position);
            light.castShadow = true;
            light.shadow.mapSize.width = 512000;
            light.shadow.mapSize.height = 512000;
            light.shadow.camera.near = 0.1;
            light.shadow.camera.far = 1000000;
            scene.add(light);
        }

        scene.add(mesh);
        mesh.userData.label = createLabel(mesh, sphere.name, camera);
        mesh.userData.size = sphere.size;
    }

    // Populate dropdown
    const sortedData = [...data].sort((a, b) => {
        if (a.name === 'Sun') return -1;
        if (b.name === 'Sun') return 1;
        const distA = Math.sqrt(a.position[0]**2 + a.position[1]**2 + a.position[2]**2);
        const distB = Math.sqrt(b.position[0]**2 + b.position[1]**2 + b.position[2]**2);
        return distA - distB;
    });

    sortedData.forEach((sphere) => {
        const option = document.createElement('option');
        option.value = sphere.name;
        option.textContent = sphere.name;
        dropdown.appendChild(option);
    });

    async function createSphereMesh(sphere, position) {
        const geometry = new THREE.SphereGeometry(sphere.size, 64, 64);
        const materialOptions = {
            roughness: 0.1,
            metalness: 0.1
        };

        // Try loading texture
        let textureLoaded = false;
        if (sphere.texture) {
            try {
                const texture = await loadTextureWithLOD(sphere.texture, position);
                if (texture) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    materialOptions.map = texture;
                    textureLoaded = true;
                    materialOptions.color = new THREE.Color(0xffffff);
                }
            } catch (error) {
                console.warn(`Texture load failed for ${sphere.name}`, error);
            }
        }

        // If no texture loaded, use the fallback color
        if (!textureLoaded) {
            materialOptions.color = new THREE.Color(sphere.color);
        }

        // Special handling for stars
        if (sphere.star) {
            materialOptions.emissive = new THREE.Color(sphere.color);
            materialOptions.emissiveIntensity = 0.5;
        }

        return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial(materialOptions));
    }

    function getColorFromString(colorStr) {
        const hexColor = colorStr.startsWith('#') ? colorStr : `#${colorStr}`;
        return new THREE.Color(hexColor);
    }

    return data;
}