
"""
Generate all 29 celestial body .glb models using Blender Python API.
Downloads real surface textures from Solar System Scope (CC BY 4.0) where available,
falls back to procedural materials for bodies without public texture maps.

Texture source: https://www.solarsystemscope.com/textures/ (CC BY 4.0)
NASA PDS: https://pds.nasa.gov/

Requires: Blender 3.0+ with Python API enabled
Run: blender --background --python scripts/generate_celestial_models.py

Note: Draco mesh compression is NOT applied during Blender export because the
Draco shared library is not bundled with most Blender distributions. Instead,
Draco is applied post-export via gltf-transform. Run:
    npm run models:draco
after generating models. The "ERROR: Draco mesh compression is not available"
message during export is cosmetic and harmless.
"""

import bpy
import ctypes
import math
import os
import urllib.error
import urllib.request
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent.parent
TEXTURE_DIR = SCRIPT_DIR / "client" / "public" / "textures"
TEXTURE_DIR.mkdir(parents=True, exist_ok=True)

# ── Texture references: Solar System Scope (CC BY 4.0) ─────────────────────
# https://www.solarsystemscope.com/textures/
# Maps are 4K resolution; Blender embeds them into the exported GLB.
TEXTURE_SOURCES = {
    "sun":     "https://www.solarsystemscope.com/textures/download/4k_sun.jpg",
    "mercury": "https://www.solarsystemscope.com/textures/download/4k_mercury.jpg",
    "venus":   "https://www.solarsystemscope.com/textures/download/4k_venus_surface.jpg",
    "earth":   "https://www.solarsystemscope.com/textures/download/4k_earth_daymap.jpg",
    "mars":    "https://www.solarsystemscope.com/textures/download/4k_mars.jpg",
    "jupiter": "https://www.solarsystemscope.com/textures/download/4k_jupiter.jpg",
    "saturn":  "https://www.solarsystemscope.com/textures/download/4k_saturn.jpg",
    "uranus":  "https://www.solarsystemscope.com/textures/download/4k_uranus.jpg",
    "neptune": "https://www.solarsystemscope.com/textures/download/4k_neptune.jpg",
    # Pluto: texture removed from Solar System Scope — uses procedural fallback
    # Moon: https://www.solarsystemscope.com/textures/download/4k_moon.jpg
    # Ceres: no 2K diffuse map publicly available — uses procedural fallback
}

def download_texture(name):
    """Download 4K texture from Solar System Scope if available."""
    if name not in TEXTURE_SOURCES:
        return None
    dest = TEXTURE_DIR / f"{name}.jpg"
    if dest.exists():
        print(f"  Texture already exists: {dest}")
        return str(dest)
    url = TEXTURE_SOURCES[name]
    print(f"  Downloading {url} ...")
    try:
        urllib.request.urlretrieve(url, str(dest))
        print(f"  Saved: {dest}")
        return str(dest)
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        print(f"  WARNING: failed to download {name}: {e}")
        return None



def create_textured_material(name, tex_path, roughness=0.7, metallic=0.0, emission_strength=0.0):
    """Create a PBR material with an image texture."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex_node = nodes.new('ShaderNodeTexImage')

    img = bpy.data.images.load(tex_path)
    tex_node.image = img

    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission_strength > 0:
        bsdf.inputs['Emission'].default_value = (1.0, 1.0, 1.0, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength

    mat.node_tree.links.new(tex_node.outputs['Color'], bsdf.inputs['Base Color'])
    mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat


def create_planet_material(name, base_color, roughness=0.7, metallic=0.0, emission_strength=0.0):
    """Create a PBR material for a celestial body (procedural fallback)."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')

    bsdf.inputs['Base Color'].default_value = base_color + (1.0,)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission_strength > 0:
        bsdf.inputs['Emission'].default_value = base_color + (1.0,)
        bsdf.inputs['Emission Strength'].default_value = emission_strength

    mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat


def add_surface_detail(obj, scale=1.0, detail_level=3):
    """Add procedural surface detail using displacement."""
    subdiv = obj.modifiers.new('Subdivision', 'SUBSURF')
    subdiv.levels = detail_level
    subdiv.render_levels = detail_level

    displace = obj.modifiers.new('Displace', 'DISPLACE')
    tex = bpy.data.textures.new('NoiseTexture', 'VORONOI')
    tex.noise_scale = 2.0 * scale
    displace.texture = tex
    displace.strength = 0.1 * scale


def create_sphere(name, radius, color, roughness=0.7, metallic=0.0, add_detail=True, tex_name=None):
    """Create a UV sphere with texture if available, otherwise solid color."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=64, ring_count=32)
    obj = bpy.context.active_object
    obj.name = name

    tex_path = download_texture(tex_name or name.lower())
    if tex_path:
        mat = create_textured_material(f"{name}_mat", tex_path, roughness, metallic)
    else:
        mat = create_planet_material(f"{name}_mat", color, roughness, metallic)
    obj.data.materials.append(mat)

    if add_detail and not tex_path:
        add_surface_detail(obj, radius)

    return obj


def create_asteroid(name, radius, color, irregularity=0.3, tex_name=None):
    """Create an irregular asteroid shape, textured if source available."""
    bpy.ops.mesh.primitive_ico_sphere_add(radius=radius, subdivisions=3)
    obj = bpy.context.active_object
    obj.name = name

    tex_path = download_texture(tex_name or name.lower())
    if tex_path:
        mat = create_textured_material(f"{name}_mat", tex_path, roughness=0.9, metallic=0.2)
    else:
        # Procedural: add irregular displacement
        displace = obj.modifiers.new('Irregular', 'DISPLACE')
        tex = bpy.data.textures.new(f'{name}_tex', 'VORONOI')
        tex.noise_scale = 3.0
        displace.texture = tex
        displace.strength = irregularity * radius
        mat = create_planet_material(f"{name}_mat", color, roughness=0.9, metallic=0.2)
    obj.data.materials.append(mat)

    return obj


def create_saturn_rings(planet_radius):
    """Create Saturn's ring system (textured if available)."""
    bpy.ops.mesh.primitive_torus_add(
        major_radius=planet_radius * 2.0,
        minor_radius=planet_radius * 0.8,
        major_segments=128,
        minor_segments=4
    )
    rings = bpy.context.active_object
    rings.name = "SaturnRings"
    rings.rotation_euler[0] = math.radians(90)

    ring_tex = download_texture("saturn_rings")
    if ring_tex:
        mat = create_textured_material("RingMat", ring_tex, roughness=0.5)
    else:
        # Procedural ring color (golden, semi-transparent)
        mat = create_planet_material("RingMat", (0.9, 0.85, 0.6), roughness=0.5)
    rings.data.materials.append(mat)
    return rings


def is_draco_available():
    try:
        ctypes.CDLL("libextern_draco.so")
        return True
    except OSError:
        return False


draco_available = is_draco_available()


def export_glb(obj, filename):
    """Export object as GLB. Draco applied at Blender level if available, otherwise via gltf-transform."""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    output_path = str(SCRIPT_DIR / "client" / "public" / "models" / filename)

    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_draco_mesh_compression_enable=draco_available,
        export_draco_mesh_compression_level=10 if draco_available else 0,
        export_materials='EXPORT',
        export_colors=True,
        export_normals=True,
        export_apply=True
    )

    draco_note = " (Draco: inline)" if draco_available else ""
    print(f"  Exported: {filename}{draco_note}")


# ── Guidance for post-hoc Draco ────────────────────────────────────────────
if draco_available:
    DRACO_GUIDANCE = ""
else:
    DRACO_GUIDANCE = "\n⚠️  Draco not available in this Blender build. Run:\n     npm run models:draco\n   to apply Draco compression post-export."

# ── Main generation routines ───────────────────────────────────────────────

def generate_planets():
    """Generate main planets (Mars through Neptune) with textures."""
    # Mercury
    obj = create_sphere("Mercury", 0.8, (0.6, 0.6, 0.6), roughness=0.8, tex_name="mercury")
    export_glb(obj, "mercury.glb")
    bpy.data.objects.remove(obj)

    # Venus
    obj = create_sphere("Venus", 1.2, (0.9, 0.7, 0.3), roughness=0.6, tex_name="venus")
    export_glb(obj, "venus.glb")
    bpy.data.objects.remove(obj)

    # Earth
    obj = create_sphere("Earth", 1.3, (0.2, 0.5, 0.8), roughness=0.5, add_detail=False, tex_name="earth")
    export_glb(obj, "earth.glb")
    bpy.data.objects.remove(obj)

    # Mars
    obj = create_sphere("Mars", 1.0, (0.8, 0.3, 0.1), roughness=0.8, tex_name="mars")
    export_glb(obj, "mars.glb")
    bpy.data.objects.remove(obj)

    # Jupiter - Gas giant
    obj = create_sphere("Jupiter", 2.5, (0.78, 0.55, 0.23), roughness=0.6, add_detail=False, tex_name="jupiter")
    export_glb(obj, "jupiter.glb")
    bpy.data.objects.remove(obj)

    # Saturn - Ringed planet
    saturn = create_sphere("Saturn", 2.2, (0.9, 0.85, 0.6), roughness=0.6, add_detail=False, tex_name="saturn")
    rings = create_saturn_rings(2.2)
    rings.parent = saturn
    export_glb(saturn, "saturn.glb")
    bpy.data.objects.remove(saturn)
    bpy.data.objects.remove(rings)

    # Uranus
    obj = create_sphere("Uranus", 1.8, (0.3, 0.8, 0.9), roughness=0.5, add_detail=False, tex_name="uranus")
    export_glb(obj, "uranus.glb")
    bpy.data.objects.remove(obj)

    # Neptune
    obj = create_sphere("Neptune", 1.7, (0.25, 0.4, 0.95), roughness=0.5, add_detail=False, tex_name="neptune")
    export_glb(obj, "neptune.glb")
    bpy.data.objects.remove(obj)


def generate_dwarf_planets():
    """Generate 7 dwarf planets (textured where source available)."""
    dwarf_planets = [
        ("Pluto",   0.4, (0.73, 0.73, 0.73), "pluto"),
        ("Ceres",   0.5, (0.6,  0.55, 0.5),  None),
        ("Eris",    0.38, (0.85, 0.85, 0.88), None),
        ("Haumea",  0.44, (0.7,  0.75, 0.8),  None),
        ("Makemake", 0.42, (0.65, 0.6, 0.55), None),
        ("Gonggong", 0.36, (0.55, 0.5, 0.6),  None),
        ("Orcus",   0.34, (0.5,  0.55, 0.6),  None),
    ]
    for name, radius, color, tex in dwarf_planets:
        obj = create_sphere(name, radius, color, roughness=0.85, tex_name=tex)
        export_glb(obj, f"{name.lower()}.glb")
        bpy.data.objects.remove(obj)


def generate_asteroids():
    """Generate 13 asteroids with irregular shapes (procedural, no public textures)."""
    asteroids = [
        ("Vesta",    0.24, (0.55, 0.5, 0.45)),
        ("Pallas",   0.26, (0.5,  0.48, 0.46)),
        ("Juno",     0.22, (0.52, 0.5, 0.48)),
        ("Hygiea",   0.28, (0.45, 0.43, 0.41)),
        ("Astraea",  0.18, (0.6,  0.55, 0.5)),
        ("Apophis",  0.16, (0.4,  0.38, 0.36)),
        ("Bennu",    0.14, (0.35, 0.33, 0.31)),
        ("Itokawa",  0.12, (0.5,  0.45, 0.4)),
        ("Eros",     0.18, (0.58, 0.52, 0.46)),
        ("Psyche",   0.28, (0.7,  0.65, 0.6)),
        ("Varda",    0.2,  (0.48, 0.46, 0.44)),
        ("Oumuamua", 0.16, (0.42, 0.4, 0.38)),
        ("Halley",   0.2,  (0.3,  0.28, 0.26)),
    ]
    for name, radius, color in asteroids:
        obj = create_asteroid(name, radius, color, irregularity=0.4)
        if name == "Psyche":
            obj.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 0.8
            obj.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.3
        export_glb(obj, f"{name.lower()}.glb")
        bpy.data.objects.remove(obj)


# ── Entry point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    print("🚀 Starting celestial body model generation...")
    print(f"   Textures directory: {TEXTURE_DIR}")

    print("\n📍 Generating planets (Mercury through Neptune)...")
    generate_planets()

    print("\n🪐 Generating dwarf planets...")
    generate_dwarf_planets()

    print("\n☄️ Generating asteroids...")
    generate_asteroids()

    print("\n✅ All models generated!")
    print("📁 Models saved to: client/public/models/")
    print("📁 Textures cached at: client/public/textures/")
    print(DRACO_GUIDANCE)
