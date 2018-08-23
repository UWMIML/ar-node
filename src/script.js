import * as THREE from 'three';
import {
  ArToolkitSource,
  ArToolkitContext,
  ArMarkerControls,
  ArSmoothedControls
} from 'node-ar.js';
import GLTFLoader from 'three-gltf-loader';
import OrbitControls from 'three-orbit-controls';
import riggedWolfGLTF from './rigged-wolf.gltf';
import wolfAlbedo from './img/wolf-albedo.png';
import wolfSpec from './img/wolf-spec.png';
import wolfNormal from './img/wolf-normal.png';
import markerPattern from './patt.hiro';
import cameraParam from './camera_para.dat';

const ready = cb => {
  /in/.test(document.readyState) // in = loadINg
    ? setTimeout(ready.bind(null, cb), 9)
    : cb();
}

// Reset camera and renderer on resize
const windowResize = (renderer, camera) => {
  const [ windowWidth, windowHeight ] = [ window.innerWidth, window.innerHeight ];
  camera.aspect = windowWidth / windowHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(windowWidth, windowHeight);
};

ready(function() {
  let mixer;
  const clock = new THREE.Clock();
  const [ windowWidth, windowHeight ] = [ window.innerWidth, window.innerHeight ];
  // Set up renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(windowWidth, windowHeight);
  renderer.setClearColor(new THREE.Color('lightgrey'), 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.gammaOutput = true;
  document.body.appendChild(renderer.domElement);

  // Set up scene
  const scene = new THREE.Scene();

  // Add light to scene
  const hemlight = new THREE.HemisphereLight(0xfff0f0, 0x606066, 0.5);
  const spotlight = new THREE.SpotLight(0xffffff);
  hemlight.position.set(10, 10, 10);
  spotlight.position.set(10000, 10000, 10000);
  spotlight.castShadow = true;
  spotlight.shadow.bias = 0.0001;
  spotlight.shadow.mapSize.width = 2048;
  spotlight.shadow.mapSize.height = 2048;
  scene.add(hemlight);
  scene.add(spotlight);

  // Add camera
  const camera = new THREE.Camera();
  camera.position.z = 400;

  // Controls
  const _orbitControls = OrbitControls(THREE);
  const controls = new _orbitControls(camera);

  // Set up AR
  const _artoolkitsource = ArToolkitSource(THREE);
  const arToolkitSource = new _artoolkitsource({
    sourceType: 'webcam'
  });
  arToolkitSource.init(() => onResize());

  const arToolkitContext = new ArToolkitContext({
    cameraParametersUrl: cameraParam,
    detectionMode: 'mono',
    maxDetectionRate: 30,
    canvasWidth: 80 * 3,
    canvasHeight: 60 * 3
  });
  arToolkitContext.init(() => {
    camera.projectionMatrix.copy(arToolkitContext.getProjectionMatrix());
  });

  // Update dimensions on resize
  window.addEventListener('resize', () => onResize());
  function onResize() {
    arToolkitSource.onResizeElement();
    arToolkitSource.copyElementSizeTo(renderer.domElement);
    if(arToolkitContext.arController){
      arToolkitSource.copyElementSizeTo(arToolkitContext.arController.canvas);
    }
  }

  // Build Mesh
  const markerRoot = new THREE.Group;
  scene.add(markerRoot);

  const markerControls = new ArMarkerControls(arToolkitContext, markerRoot, {
    type: 'pattern',
    patternUrl: markerPattern,
    changeMatrixMode: 'cameraTransformMatrix'
  });

  const smoothedRoot = new THREE.Group();
  scene.add(smoothedRoot);
  const smoothedControls = new ArSmoothedControls(smoothedRoot, {
    lerpPosition: 0.4,
    lerpQuaternion: 0.3,
    lerpScale: 1,
  });
  const arWorldRoot = smoothedRoot;

  // Prepare geometries and meshes
  const loader = new GLTFLoader();
  loader.load(riggedWolfGLTF, gltf => {
    const object = gltf.scene;
    const gltfAnimation = gltf.animations;
    object.rotateY(15);
    object.rotateZ(40);
    arWorldRoot.add(object);
    object.traverse(node => {
      if(node.material && 'envMap' in node.material){
        const albedoTexture = new THREE.TextureLoader().load(wolfAlbedo);
        const normalTexture = new THREE.TextureLoader().load(wolfNormal);
        const specularityTexture = new THREE.TextureLoader().load(wolfSpec);
        node.castShadow = true;
        node.receiveShadow = true;
        node.material.normalMap = normalTexture;
        node.material.map = albedoTexture;
        node.material.lightMap = specularityTexture;
        node.material.needsUpdate = true;
      }
    });
    if(gltfAnimation && gltfAnimation.length) {
      mixer = new THREE.AnimationMixer(object);
      gltfAnimation.forEach(animation => {
        mixer.clipAction(animation).play();
        animate(renderer);
      });
    }
  });

  // render scene
  const render = () => {
    smoothedControls.update(markerRoot);
    mixer.update(0.75 * clock.getDelta());
    if(arToolkitSource.ready) {
      arToolkitContext.update(arToolkitSource.domElement);
      scene.visible = camera.visible;
    }
    renderer.render(scene, camera);
  }
  const animate = renderer => {
    renderer.setAnimationLoop(render);
  }
});
