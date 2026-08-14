#!/usr/bin/env node
/**
 * Convert all GLB models to USDZ for iOS AR Quick Look (model-viewer).
 *
 * Pipeline per model:
 *   1. Decompress Draco geometry in-memory via @gltf-transform (three's
 *      DRACOLoader needs browser worker/wasm APIs Node doesn't have).
 *   2. Load the plain GLB with three's GLTFLoader (DOM polyfills provided).
 *   3. Export the scene with three's USDZExporter (PNG textures, Y-up).
 *
 * Output: client/public/models-usdz/<name>.usdz  (zip: model.usda + geometry + textures)
 *
 * Usage: node scripts/export_usdz.mjs [model-name.glb ...]   (default: all)
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCanvas, Image as NapiImage } from "@napi-rs/canvas";
import { NodeIO } from "@gltf-transform/core";
import { KHRDracoMeshCompression, EXTTextureWebP } from "@gltf-transform/extensions";
import { simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";
import draco3d from "draco3d";

const MODELS_DIR = "client/public/models";
const OUT_DIR = "client/public/models-usdz";
const TMP_PLAIN = join(tmpdir(), "solar-usdz-plain.glb");

// ── DOM polyfills for three.js loaders/exporters in Node ─────────────────────
globalThis.self = globalThis;
globalThis.document = {
  createElement: (tag) => (tag === "canvas" ? createCanvas(1, 1) : {}),
};
const canvasProto = createCanvas(1, 1).constructor.prototype;
canvasProto.toBlob = function (cb, mime = "image/png", quality) {
  cb(new Blob([this.toBuffer(mime, quality)], { type: mime }));
};
globalThis.ImageBitmap = NapiImage;
Object.defineProperty(globalThis, "navigator", {
  value: { userAgent: "node" },
  configurable: true,
});
globalThis.createImageBitmap = async (blob) => {
  const img = new NapiImage();
  img.src = new Uint8Array(await blob.arrayBuffer());
  return img;
};
// Node's fetch does not support blob: URLs (GLTFLoader uses them for embedded
// images) — serve them from an in-memory map instead.
const blobMap = new Map();
let blobCounter = 0;
URL.createObjectURL = (blob) => {
  const url = `blob:nodedata-${blobCounter++}`;
  blobMap.set(url, blob);
  return url;
};
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  if (typeof input === "string" && input.startsWith("blob:")) {
    const blob = blobMap.get(input);
    if (blob) return Promise.resolve(new Response(blob, { status: 200 }));
  }
  return realFetch(input, init);
};

const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
const { USDZExporter } = await import("three/examples/jsm/exporters/USDZExporter.js");

const io = new NodeIO()
  .registerExtensions([KHRDracoMeshCompression, EXTTextureWebP])
  .registerDependencies({
    "draco3d.decoder": await draco3d.createDecoderModule(),
    "draco3d.encoder": await draco3d.createEncoderModule(),
  });

const exporter = new USDZExporter();
const loader = new GLTFLoader();

async function sloppyCollapse(doc, ratio) {
  // meshopt's simplify() quits early on UV-seamed meshes (e.g. ceres's high-poly
  // sphere) — sloppy collapse ignores attributes, then we compact the buffers
  // manually so the USDZ only carries the vertices the new indices reference.
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const posAttr = prim.getAttribute("POSITION");
      const idxAttr = prim.getIndices();
      if (!posAttr || !idxAttr) continue;
      const target = Math.max(3, Math.floor(ratio * idxAttr.getCount() / 3) * 3);
      const [out] = MeshoptSimplifier.simplifySloppy(
        new Uint32Array(idxAttr.getArray()), posAttr.getArray(), 3, null, target, 1
      );
      const [remap, unique] = MeshoptSimplifier.compactMesh(out);
      idxAttr.setArray(out instanceof Uint32Array ? out : new Uint32Array(out));
      for (const attr of [posAttr, ...prim.listAttributes().filter((a) => a !== posAttr)]) {
        const src = attr.getArray();
        if (!(src instanceof Float32Array)) continue;
        const stride = attr.getElementSize();
        const dst = new Float32Array(unique * stride);
        for (let v = 0; v < unique; v++) {
          const s = remap[v] * stride;
          for (let k = 0; k < stride; k++) dst[v * stride + k] = src[s + k];
        }
        attr.setArray(dst);
      }
    }
  }
}

async function toPlainGlb(glbPath) {
  const doc = await io.read(glbPath);
  for (const ext of doc.getRoot().listExtensionsUsed()) ext.dispose();

  // USDZ stores uncompressed geometry — bound the vertex count so AR Quick Look
  // downloads stay small (jsDelivr caps files at 20 MB). Uncompressed USDA text
  // is ~12x larger than a Draco GLB, so cap ≈ 300k vertices (~8 MB usdz).
  const MAX_VERTICES = 300_000;
  const countVertices = () =>
    doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((p, prim) => p + (prim.getAttribute("POSITION")?.getCount() ?? 0), 0), 0);

  await doc.transform(weld({}));
  if (countVertices() > MAX_VERTICES) {
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_VERTICES / countVertices(), error: 0.05 }));
    // meshopt's simplify() quits early on UV-seamed meshes (e.g. ceres) — sloppy-collapse to the cap.
    if (countVertices() > MAX_VERTICES) {
      await sloppyCollapse(doc, MAX_VERTICES / countVertices());
      console.log(`   ↳ simplify() stalled — sloppy-collapsed to ${countVertices().toLocaleString()} vertices`);
    }
  }
  await io.write(TMP_PLAIN, doc);
  return doc;
}

// jsDelivr caps files at 20 MB; USDZ text inflates vertex data ~2x over a plain
// GLB, so any model that would ship >14 MB gets a sloppy re-collapse.
const MAX_USDZ_BYTES = 14 * 1024 * 1024;

async function loadGltf() {
  const buffer = readFileSync(TMP_PLAIN);
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const gltf = await new Promise((res, rej) => loader.parse(ab, "", res, rej));
  gltf.scene.traverse((obj) => {
    if (obj.isMesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) if (m && m.side !== 0) m.side = 0; // USDZ: no double-sided
    }
  });
  return gltf;
}

async function toUsdz(glbPath, usdzPath) {
  let doc = await toPlainGlb(glbPath);
  let gltf = await loadGltf();
  let out = await exporter.parseAsync(gltf.scene);
  if (out.length > MAX_USDZ_BYTES) {
    const ratio = Math.max(0.2, (MAX_USDZ_BYTES / out.length) * 0.8);
    console.log(`   ↳ USDZ ${(out.length / 1024 / 1024).toFixed(1)} MB — sloppy-collapsing (${Math.round(ratio * 100)}%)`);
    await sloppyCollapse(doc, ratio);
    await io.write(TMP_PLAIN, doc);
    gltf = await loadGltf();
    out = await exporter.parseAsync(gltf.scene);
    console.log(`   ↳ re-exported ${(out.length / 1024 / 1024).toFixed(1)} MB`);
  }
  writeFileSync(usdzPath, Buffer.from(out));
}

async function main() {
  const args = process.argv.slice(2);
  const names = args.length > 0 ? args : readdirSync(MODELS_DIR).filter((f) => f.endsWith(".glb"));
  if (names.length === 0) {
    console.log("No .glb models found in", MODELS_DIR);
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const failures = [];
  for (const name of names) {
    const glbPath = join(MODELS_DIR, name);
    const usdzPath = join(OUT_DIR, name.replace(/\.glb$/, ".usdz"));
    try {
      await toUsdz(glbPath, usdzPath);
      const kb = Math.round(readFileSync(usdzPath).length / 1024);
      console.log(`✓ ${name} → ${usdzPath} (${kb} KB)`);
    } catch (err) {
      failures.push(`${name}: ${err.message}`);
      console.error(`✗ ${name}: ${err.message}`);
    }
  }
  try { rmSync(TMP_PLAIN, { force: true }); } catch {}
  if (failures.length > 0) {
    console.error(`\n${failures.length} model(s) failed:\n` + failures.join("\n"));
    process.exit(1);
  }
}

main();
