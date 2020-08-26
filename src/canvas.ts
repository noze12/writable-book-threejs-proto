import * as THREE from 'three';

// https://stackoverflow.com/a/16897178 この辺参考
const vertexShader = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

const fragmentShader = `
uniform sampler2D t1;
uniform sampler2D t2;
varying vec2 vUv;

void main(void)
{
  vec3 c;
  vec4 Ca = texture2D(t1, vUv);
  vec4 Cb = texture2D(t2, vUv);
  gl_FragColor= vec4(Ca.rgb * Ca.a + Cb.rgb * Cb.a * (1.0 - Ca.a), 1.0);
}`;
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;

class CanvasLayeredMaterial extends THREE.ShaderMaterial {
  constructor(baseTexture: THREE.Texture) {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT;
    const canvasTexture = new THREE.CanvasTexture(canvas);
    const uniforms = {
      t1: { value: canvasTexture },
      t2: { value: baseTexture }
    };
    super({ uniforms, vertexShader, fragmentShader});
    this.canvas = canvas;
    this.context2D = canvas.getContext('2d');
    this.canvasTexture = canvasTexture;
  }

  private readonly canvas: HTMLCanvasElement;
  private readonly canvasTexture: THREE.CanvasTexture;
  private readonly context2D: CanvasRenderingContext2D;

  // 以下は本当はこいつに持たせない方が良い気もする・・
  private cachedPoint: THREE.Vector2;
  writeAt(uv: THREE.Vector2) {
    if (this.cachedPoint) {
      this.context2D.lineWidth = 1;
      this.context2D.strokeStyle = "#aaa";
      this.context2D.beginPath();
      this.context2D.moveTo(this.cachedPoint.x * this.canvas.width, (1 - this.cachedPoint.y) * this.canvas.height);
      this.context2D.lineTo(uv.x * this.canvas.width, (1 - uv.y) * this.canvas.height);
      this.context2D.stroke();
      this.canvasTexture.needsUpdate = true;
    }
    this.cachedPoint = uv;
  }
  writeEnd() {
    this.cachedPoint = null;
  }
}

export default CanvasLayeredMaterial;
