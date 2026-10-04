import * as THREE from "three";

/** Upload offscreen buffers and initialise material bindings under the loading
 * cover. Restore visibility before presenting a frame; no model is swapped later. */
export function warmScene(scene: THREE.Scene, render: () => void) {
  const visibility: [THREE.Object3D, boolean, boolean][] = [];
  scene.traverse((object) => {
    visibility.push([object, object.visible, object.frustumCulled]);
  });
  // Capture effective light visibility before opening hidden model groups.
  const lights = new Map<THREE.Light, boolean>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Light)) return;
    let visible = true;
    for (
      let parent: THREE.Object3D | null = object;
      parent;
      parent = parent.parent
    )
      visible &&= parent.visible;
    lights.set(object, visible);
  });
  for (const [object] of visibility) {
    object.visible = object instanceof THREE.Light ? lights.get(object)! : true;
    object.frustumCulled = false;
  }
  try {
    render();
  } finally {
    for (const [object, visible, culled] of visibility) {
      object.visible = visible;
      object.frustumCulled = culled;
    }
  }
  render();
}
