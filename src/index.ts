import * as THREE from 'three';
import * as _ from 'lodash';
import { MapControls } from './control';
import CanvasLayeredMaterial from './canvas';


const PAGES = 64;
const pageMovePeriod = 0.5;
const imageSize = [214, 304];


window.addEventListener('DOMContentLoaded', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color( 0x999999 );

  const camera = new THREE.PerspectiveCamera( 20, window.innerWidth / window.innerHeight, 0.1, 1500 );
  camera.position.set( 0, 0, 1000 );

  const pages = _.range(PAGES).map(p => {
    const pageMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(...imageSize),
      new CanvasLayeredMaterial(new THREE.TextureLoader().load('images/blank.png')),
      //new CanvasLayeredMaterial(new THREE.TextureLoader().load(`images/${p}.png`)),
    );
    pageMesh.position.set(imageSize[0] / 2, 0, 0);
    if (p % 2 === 1) pageMesh.rotation.y += Math.PI;
    return pageMesh;
  });
  const pageGroups = _.chunk(pages, 2).map(([p1, p2], index, groups) => {
    const group = new THREE.Group();
    group.position.set(0, 0, groups.length / 2 - index);
    group.add(p1);
    if (p2) {
      group.add(p2);
    } else {
      const last = new THREE.Mesh(
        new THREE.PlaneGeometry(...imageSize),
        new CanvasLayeredMaterial(new THREE.TextureLoader().load('images/blank.png')),
      )
      last.position.set(imageSize[0] / 2, 0, 0);
      last.rotation.y += Math.PI;
      group.add(last);
    }
    return group;
  })
  scene.add(...pageGroups);
  const mixers = pageGroups.map(pageGroup => new THREE.AnimationMixer(pageGroup));

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement )

  const controls = new MapControls( camera, renderer.domElement );
  controls.screenSpacePanning = true;
  //controls.enableRotate = false;
  controls.maxDistance = 1200;
  controls.enableKeys = false;
  controls.zoomSpeed = 0.5;

  let writeMode = false;
  const writeCheckboxEl = document.querySelector('.pencil');
  writeCheckboxEl.addEventListener('click', () => {
    if (writeMode) {
      writeMode = false;
      controls.enablePan = true;
      writeCheckboxEl.classList.remove('active');
    } else {
      writeMode = true;
      controls.enablePan = false;
      writeCheckboxEl.classList.add('active');
    }
  });

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let writingCanvasMaterial = null;
  renderer.domElement.addEventListener('mousedown', (e) => {
    if (!writeMode) return;
    const moveHandler = (e: MouseEvent) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      mouse.x = ( e.clientX / window.innerWidth ) * 2 - 1;
      mouse.y = - ( e.clientY / window.innerHeight ) * 2 + 1;
      raycaster.setFromCamera( mouse, camera );
      const intersectObjects = raycaster.intersectObjects(_.flatten(scene.children.map(g => g.children)));
      if (intersectObjects.length) {
        const clickedTopMeshMaterial = (intersectObjects[0].object as THREE.Mesh).material;
        if (clickedTopMeshMaterial instanceof CanvasLayeredMaterial) {
          if (writingCanvasMaterial && writingCanvasMaterial !== clickedTopMeshMaterial) {
            writingCanvasMaterial.writeEnd();
          }
          writingCanvasMaterial = clickedTopMeshMaterial;
          writingCanvasMaterial.writeAt(intersectObjects[0].uv);
        }
      }
    };
    const upHandler = () => {
      if (writingCanvasMaterial) {
        writingCanvasMaterial.writeEnd();
      }
      renderer.domElement.ownerDocument.removeEventListener('mousemove', moveHandler);
      renderer.domElement.ownerDocument.removeEventListener('mouseup', upHandler);
    };
    renderer.domElement.ownerDocument.addEventListener('mousemove', moveHandler);
    renderer.domElement.ownerDocument.addEventListener('mouseup', upHandler);
  });


  const clock = new THREE.Clock();
  const animate = function () {
    requestAnimationFrame( animate );
    const delta = clock.getDelta();
    mixers.forEach(m => m.update(delta));
    renderer.render( scene, camera );
  };
  animate();

  const movePageLeft = (page: number) => {
    const mixer = mixers[page], pageGroup = pageGroups[page];
    mixer.stopAllAction();
    const action = mixer.clipAction(new THREE.AnimationClip('rotateLeft', pageMovePeriod, [
      new THREE.NumberKeyframeTrack( '.rotation[y]', [0, pageMovePeriod], [-Math.PI, 0], THREE.InterpolateSmooth),
      new THREE.NumberKeyframeTrack(
        '.position[z]',
        [0, pageMovePeriod * 0.1, pageMovePeriod* 0.9, pageMovePeriod],
        [
          -pageGroup.position.z,
          Math.max(-pageGroup.position.z, pageGroup.position.z),
          Math.max(-pageGroup.position.z, pageGroup.position.z),
          pageGroup.position.z
        ]
      )
    ]));
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
    action.play();
  };
  const movePageRight = (page: number) => {
    const mixer = mixers[page], pageGroup = pageGroups[page];
    mixer.stopAllAction();
    const action = mixer.clipAction(new THREE.AnimationClip('rotateRight', pageMovePeriod, [
      new THREE.NumberKeyframeTrack( '.rotation[y]', [0, pageMovePeriod], [0, -Math.PI], THREE.InterpolateSmooth),
      new THREE.NumberKeyframeTrack(
        '.position[z]',
        [0, pageMovePeriod * 0.1, pageMovePeriod* 0.9, pageMovePeriod],
        [
          pageGroup.position.z,
          Math.max(-pageGroup.position.z, pageGroup.position.z),
          Math.max(-pageGroup.position.z, pageGroup.position.z),
          -pageGroup.position.z
        ]
      )
    ]));
    action.loop = THREE.LoopOnce;
    action.clampWhenFinished = true;
    action.play();
  };

  const seekEl = document.querySelector('.seek') as HTMLInputElement;
  seekEl.max = String(pageGroups.length - 1);
  let currentPage = 0;
  const goLeftPage = () => {
    if (currentPage < 1) return;
    movePageLeft(currentPage - 1)
    currentPage -= 1;
    if (!seeking) seekEl.value = String(currentPage);
  };
  const goRightPage = () => {
    if (pageGroups.length <= currentPage) return;
    movePageRight(currentPage)
    currentPage += 1;
    if (!seeking) seekEl.value = String(currentPage);
  }
  document.addEventListener('keydown', (e) => {
    if (document.activeElement === seekEl) return;
    if (e.key === 'ArrowLeft') goLeftPage();
    if (e.key === 'ArrowRight') goRightPage()
  })
  let seeking = false;
  seekEl.addEventListener('change', () => {
    const targetPage = Number(seekEl.value);
    const goNextPage = targetPage < currentPage ? goLeftPage : goRightPage;
    seeking = true;
    const setNextStep = () => {
      setTimeout(() => {
        goNextPage();
        if (targetPage !== currentPage) {
          setNextStep();
        } else {
          seeking = false;
        }
      }, 80)
    };
    setNextStep();
  });
});
