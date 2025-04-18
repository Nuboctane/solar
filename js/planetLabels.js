import * as THREE from '../three/three.module.js';

export function toggleLabels() {
    const labels = document.querySelectorAll('.planet-label-container');
    let shouldShow;
    
    if (labels.length > 0) {
        const firstLabel = labels[0];
        shouldShow = window.getComputedStyle(firstLabel).display === 'none' || 
                    firstLabel.style.opacity === '0';
    } else {
        shouldShow = true;
    }
    
    labels.forEach(label => {
        if (shouldShow) {
            label.style.display = 'block';
            label.style.opacity = '1';
        } else {
            label.style.opacity = '0';
            setTimeout(() => {
                label.style.display = 'none';
            }, 300);
        }
    });
    
    return shouldShow;
}

export function createLabel(mesh, text, camera) {
    const labelContainer = document.createElement('div');
    labelContainer.className = 'planet-label-container';
    labelContainer.style.position = 'absolute';
    labelContainer.style.pointerEvents = 'none';
    labelContainer.style.transform = 'translate(-50%, 0)';

    const label = document.createElement('div');
    label.className = 'planet-label';
    label.textContent = text;
    label.style.color = '#fff';
    label.style.fontFamily = 'sans-serif';
    label.style.whiteSpace = 'nowrap';
    label.style.textAlign = 'center';
    label.style.textShadow = '0 0 5px #000';
    label.style.padding = '2px 8px';
    label.style.backgroundColor = 'rgba(0,0,0,0.5)';
    label.style.borderRadius = '4px';

    const lineCanvas = document.createElement('canvas');
    lineCanvas.className = 'planet-line-canvas';
    lineCanvas.width = 1;
    lineCanvas.height = 1;
    lineCanvas.style.position = 'absolute';
    lineCanvas.style.left = '0';
    lineCanvas.style.top = '0';
    lineCanvas.style.pointerEvents = 'none';

    labelContainer.appendChild(lineCanvas);
    labelContainer.appendChild(label);
    document.body.appendChild(labelContainer);

    if (!window.planetLabels) window.planetLabels = [];
    const labelObj = { container: labelContainer, canvas: lineCanvas, mesh };
    window.planetLabels.push(labelObj);

    mesh.userData.updateLabel = () => {
        if (!mesh.userData.bbox) return;

        const center = new THREE.Vector3();
        mesh.userData.bbox.getCenter(center);
        center.applyMatrix4(mesh.matrixWorld);

        const screenPos = center.clone().project(camera);
        const screenX = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;

        labelObj.screenPos = { x: screenX, y: screenY };

        if (screenPos.z <= 1) {
            labelContainer.style.left = `${screenX}px`;
            labelContainer.style.top = `${screenY + 20}px`;
            labelContainer.style.display = 'block';
        } else {
            labelContainer.style.display = 'none';
        }
    };

    return labelContainer;
}

export function updateLabelConnections(camera) {
    if (!window.planetLabels) return;

    const visibleLabels = window.planetLabels
        .filter(item => item.container.style.display !== 'none')
        .sort((a, b) => a.screenPos.y - b.screenPos.y);

    for (let i = 0; i < visibleLabels.length; i++) {
        const current = visibleLabels[i];
        const labelRect = current.container.getBoundingClientRect();
        const labelHeight = labelRect.height;
        
        let bestY = current.screenPos.y + 20;
        
        for (let j = 0; j < i; j++) {
            const other = visibleLabels[j];
            const otherRect = other.container.getBoundingClientRect();
            
            if (Math.abs(otherRect.left - labelRect.left) < otherRect.width &&
                bestY < otherRect.bottom + 5) {
                bestY = otherRect.bottom + 5;
            }
        }
        
        current.container.style.top = `${bestY}px`;
        current.finalPos = { 
            x: parseFloat(current.container.style.left),
            y: bestY 
        };
    }

    visibleLabels.forEach(labelObj => {
        const canvas = labelObj.canvas;
        const ctx = canvas.getContext('2d');
        
        const startX = labelObj.screenPos.x;
        const startY = labelObj.screenPos.y;
        const endX = labelObj.finalPos.x;
        const endY = labelObj.finalPos.y - 10;
        
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);
        
        canvas.style.left = `${minX}px`;
        canvas.style.top = `${minY}px`;
        canvas.width = maxX - minX;
        canvas.height = maxY - minY;
    });
}