import * as THREE from '../three/three.module.js';
import { GLTFLoader } from '../three/three.GLTFLoader.js';
import { createLabel } from './planetLabels.js';

export async function loadSpheres(scene, camera) {
    const response = await fetch('constellation/spheres.json');
    const data = await response.json();

    const sphereMap = new Map();
    const loader = new THREE.TextureLoader();
    const gltfLoader = new GLTFLoader();
    const dropdown = document.getElementById('planetDropdown');

    for (const sphere of data) {
        let mesh;
        
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
                mesh = createSphereMesh(sphere, loader);
            }
        } else {
            mesh = createSphereMesh(sphere, loader);
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
        
        let x, y, z;
        
        if (sphere.relative_to && sphere.relative_to.trim() !== '') {
            const parentMesh = sphereMap.get(sphere.relative_to);
            if (parentMesh) {
                const parentPos = parentMesh.position;
                const orbitalDistance = sphere.position[0] + (parentMesh.diameter * 20);
                const angle = (index / data.length) * Math.PI * 2;
                x = parentPos.x + Math.cos(angle) * orbitalDistance;
                z = parentPos.z + Math.sin(angle) * orbitalDistance;
                y = parentPos.y;
            } else {
                [x, y, z] = sphere.position;
            }
        } else {
            const angle = (index / data.length) * Math.PI * 2 + Math.random() * 0.5;
            const distance = sphere.position[0];
            x = Math.cos(angle) * distance;
            z = Math.sin(angle) * distance;
            y = 0;
        }

        mesh.position.set(x, y, z);
        sphere.position = [x, y, z];

        if (sphere.ring_texture && sphere.ring_texture.trim() !== '') {
            const ringInnerRadius = sphere.size * 1.2;
            const ringOuterRadius = sphere.size * 2;
            const ringGeometry = new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 64);
            const ringTexture = await loader.loadAsync(sphere.ring_texture);
            const ringMaterial = new THREE.MeshBasicMaterial({
                map: ringTexture,
                side: THREE.DoubleSide,
                transparent: true,
            });

            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2;
            ring.position.copy(mesh.position);
            scene.add(ring);
            mesh.userData.ring = ring;
        }

        if (sphere.star) {
            const light = new THREE.PointLight(getColorFromString(sphere.color), 2, sphere.brightness, 0);
            light.position.set(x, y, z);
            light.castShadow = true;
            light.shadow.mapSize.width = 512000;
            light.shadow.mapSize.height = 512000;
            light.shadow.camera.near = 0.1;
            light.shadow.camera.far = 1000000;
            scene.add(light);
        }

        scene.add(mesh);

        const label = createLabel(mesh, sphere.name, camera);
        mesh.userData.label = label;
        mesh.userData.size = sphere.size;
    }

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

    function createSphereMesh(sphere, textureLoader) {
        const geometry = new THREE.SphereGeometry(sphere.size, 64, 64);
        let materialOptions = {
            roughness: 0.1,
            metalness: 0.1
        };

        if (sphere.texture) {
            const texture = textureLoader.load(sphere.texture);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            materialOptions.map = texture;
        } else {
            materialOptions.color = new THREE.Color(sphere.color);
            materialOptions.emissive = new THREE.Color(sphere.color);
        }

        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial(materialOptions));
        mesh.userData.bbox = new THREE.Box3().setFromObject(mesh);
        return mesh;
    }

    function getColorFromString(colorStr) {
        const hexColor = colorStr.startsWith('#') ? colorStr : `#${colorStr}`;
        return new THREE.Color(hexColor);
    }

    return data;
}