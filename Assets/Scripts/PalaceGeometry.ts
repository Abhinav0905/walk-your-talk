/**
 * Walk Your Talk — procedural meshes.
 *
 * Small MeshBuilder helpers for the glowing spot rings, the route dots on the
 * floor, the recall orb and the off-view arrow. Owns geometry only; colours
 * come from per-object material clones made by PalaceVisuals.
 */

type V3 = [number, number, number];

export class GeometryBuilder {
  private data: number[] = [];
  private indices: number[] = [];
  private count = 0;

  private vertex(p: V3, n: V3): number {
    this.data.push(p[0], p[1], p[2], n[0], n[1], n[2]);
    return this.count++;
  }

  /** Flat annulus in the XZ plane, facing up. */
  ring(inner: number, outer: number, segments = 64, y = 0, cx = 0, cz = 0): this {
    const base = this.count;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      this.vertex([cx + c * inner, y, cz + s * inner], [0, 1, 0]);
      this.vertex([cx + c * outer, y, cz + s * outer], [0, 1, 0]);
    }
    for (let i = 0; i < segments; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      this.indices.push(a, c, b, b, c, d);
    }
    return this;
  }

  /** Flat disc in the XZ plane, facing up. */
  disc(radius: number, segments = 32, y = 0, cx = 0, cz = 0): this {
    const center = this.vertex([cx, y, cz], [0, 1, 0]);
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      this.vertex([cx + Math.cos(a) * radius, y, cz + Math.sin(a) * radius], [0, 1, 0]);
    }
    for (let i = 0; i < segments; i++) this.indices.push(center, center + i + 2, center + i + 1);
    return this;
  }

  /** UV sphere centred on the origin. */
  sphere(radius: number, rings = 16, sectors = 24): this {
    const base = this.count;
    for (let r = 0; r <= rings; r++) {
      const phi = (r / rings) * Math.PI;
      for (let s = 0; s <= sectors; s++) {
        const theta = (s / sectors) * Math.PI * 2;
        const n: V3 = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
        this.vertex([n[0] * radius, n[1] * radius, n[2] * radius], n);
      }
    }
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < sectors; s++) {
        const a = base + r * (sectors + 1) + s, b = a + sectors + 1;
        this.indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    return this;
  }

  /** Rounded "pill" in the XY plane, facing +Z, centred on the origin. */
  pill(width: number, height: number, segments = 14, z = 0): this {
    const r = height / 2;
    const half = Math.max(0, width / 2 - r);
    const center = this.vertex([0, 0, z], [0, 0, 1]);
    const ring: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const a = -Math.PI / 2 + (i / segments) * Math.PI;
      ring.push(this.vertex([half + Math.cos(a) * r, Math.sin(a) * r, z], [0, 0, 1]));
    }
    for (let i = 0; i <= segments; i++) {
      const a = Math.PI / 2 + (i / segments) * Math.PI;
      ring.push(this.vertex([-half + Math.cos(a) * r, Math.sin(a) * r, z], [0, 0, 1]));
    }
    for (let i = 0; i < ring.length; i++) {
      this.indices.push(center, ring[i], ring[(i + 1) % ring.length]);
    }
    return this;
  }

  /** Chevron arrow in the XY plane pointing towards +Y, facing +Z. */
  chevron(size: number, thickness: number): this {
    const t = thickness, h = size;
    // Two slanted bars meeting at the tip.
    const quad = (p: V3[]) => {
      const ids = p.map(v => this.vertex(v, [0, 0, 1]));
      this.indices.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
    };
    quad([[-h, -h * 0.5, 0], [-h + t, -h * 0.5 - t * 0.2, 0], [0, h * 0.5 - t, 0], [0, h * 0.5, 0]]);
    quad([[0, h * 0.5, 0], [0, h * 0.5 - t, 0], [h - t, -h * 0.5 - t * 0.2, 0], [h, -h * 0.5, 0]]);
    return this;
  }

  /** Small discs every `spacing` cm along a polyline on the floor. */
  dots(points: vec3[], spacing: number, radius: number, y: number): this {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const steps = Math.max(1, Math.floor(length / spacing));
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        this.disc(radius, 12, y, a.x + dx * t, a.z + dz * t);
      }
    }
    return this;
  }

  get isEmpty(): boolean { return this.count === 0; }

  build(): RenderMesh {
    const builder = new MeshBuilder([
      {name: "position", components: 3},
      {name: "normal", components: 3, normalized: true}
    ]);
    builder.topology = MeshTopology.Triangles;
    builder.indexType = MeshIndexType.UInt16;
    builder.appendVerticesInterleaved(this.data);
    builder.appendIndices(this.indices);
    builder.updateMesh();
    return builder.getMesh();
  }
}

/** Create a child object that renders `mesh` with a tinted clone of `material`. */
export function meshObject(parent: SceneObject, name: string, mesh: RenderMesh, material: Material, color: vec4): {object: SceneObject; material: Material} {
  const object = global.scene.createSceneObject(name);
  object.setParent(parent);
  const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
  visual.mesh = mesh;
  const tinted = material.clone();
  tinted.mainPass.baseColor = color;
  visual.mainMaterial = tinted;
  return {object, material: tinted};
}
