import * as THREE from '../three/three.module.js';

export function focusOnPlanet(planet, cameraHolder, camera) {
    const planetPosition = new THREE.Vector3(...planet.position);
    const distance = planet.size * 5;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const targetPosition = planetPosition.clone().sub(forward.multiplyScalar(distance));
    const startPosition = cameraHolder.position.clone();

    const duration = 0.5;
    let startTime = null;

    function animate(time) {
        if (!startTime) startTime = time;
        const elapsed = (time - startTime) / 1000;
        const t = Math.min(elapsed / duration, 1);

        const easedT = t * t * (3 - 2 * t);

        const currentPosition = startPosition.clone().lerp(targetPosition, easedT);
        cameraHolder.position.copy(currentPosition);

        if (t < 1) {
            requestAnimationFrame(animate);
        } else {
            const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
            yaw = euler.y;
            pitch = euler.x;

            camera.near = Math.max(0.1, planet.size * 0.01);
            camera.far = 9000000 * 1.1;
            camera.updateProjectionMatrix();
        }
    }

    requestAnimationFrame(animate);
}

export function setupPlanetDropdown(spheresData, cameraHolder, camera) {
    const dropdown = document.getElementById('planetDropdown');
    let lastSelectedValue = '';

    dropdown.addEventListener('change', (event) => {
        if (event.target.value !== '' || event.target.value === lastSelectedValue) {
            onPlanetSelect(event, spheresData, cameraHolder, camera);
        }
        lastSelectedValue = event.target.value;
    });

    dropdown.addEventListener('click', (event) => {
        if (dropdown.value === lastSelectedValue) {
            onPlanetSelect(event, spheresData, cameraHolder, camera);
        }
    });
}

function onPlanetSelect(event, spheresData, cameraHolder, camera) {
    const planetName = event.target.value;
    if (planetName) {
        const selectedPlanet = spheresData.find((sphere) => sphere.name === planetName);
        if (selectedPlanet) {
            focusOnPlanet(selectedPlanet, cameraHolder, camera);
        }
    }
}