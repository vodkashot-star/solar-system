"""
Regenerate Uranus GLB with reduced geometry + Draco compression.
Run: blender --background --python scripts/generate_uranus_fix.py
"""

import bpy
import math
import os

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

def create_planet_material(name, base_color, roughness=0.7, emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = base_color + (1.0,)
    bsdf.inputs['Roughness'].default_value = roughness
    mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    return mat

bpy.ops.mesh.primitive_uv_sphere_add(radius=1.8, segments=64, ring_count=32)
obj = bpy.context.active_object
obj.name = "Uranus"

mat = create_planet_material("Uranus_mat", (0.3, 0.8, 0.9), roughness=0.5)
obj.data.materials.append(mat)

bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

output_path = os.path.join(os.getcwd(), 'client', 'public', 'models', 'uranus.glb')

bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=True,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=10,
    export_materials='EXPORT',
    export_colors=True,
    export_normals=True,
    export_apply=True
)

print("Uranus GLB regenerated successfully")
