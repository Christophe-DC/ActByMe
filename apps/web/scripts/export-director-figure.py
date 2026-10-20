"""Optional offline asset preparation. See public/director-models/NOTICE.md."""
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

source_collection = bpy.data.collections["Body Male - Realistic"]
assert source_collection.asset_data.license == "CC0"
source_body = bpy.data.objects["GEO-body_male_realistic"]
source_origin = source_body.location.copy()

for scene_object in bpy.context.scene.objects:
    scene_object.select_set(False)

# Only export this collection, with its original offsets, never other bundle assets.
figure_objects = []
for source_object in source_collection.objects:
    mesh_object = source_object.copy()
    mesh_object.data = source_object.data.copy()
    bpy.context.scene.collection.objects.link(mesh_object)
    mesh_object.location -= source_origin
    for modifier in list(mesh_object.modifiers):
        if modifier.type == "MULTIRES":
            modifier.levels = 1
            modifier.render_levels = 1
        else:
            mesh_object.modifiers.remove(modifier)
    mesh_object.hide_set(False)
    mesh_object.hide_viewport = False
    mesh_object.hide_render = False
    figure_objects.append(mesh_object)

# Bake smooth geometry; retain no armature, animation, textures or external files.
dependency_graph = bpy.context.evaluated_depsgraph_get()
clay = bpy.data.materials.new("Reference clay")
clay.diffuse_color = (0.51, 0.53, 0.56, 1)
for mesh_object in figure_objects:
    evaluated = mesh_object.evaluated_get(dependency_graph)
    mesh = bpy.data.meshes.new_from_object(
        evaluated, preserve_all_data_layers=False, depsgraph=dependency_graph
    )
    mesh_object.modifiers.clear()
    mesh_object.data = mesh
    is_eye = "eye" in mesh_object.name
    if not is_eye:
        for vertex in mesh.vertices:
            lateral, depth, height = vertex.co
            side = 1 if lateral >= 0 else -1
            # Fixed presentation pose. Never driven by the uploaded video.
            arm_weight = max(0, min(1, (abs(lateral) - 0.19) / 0.085))
            bend = (
                max(0, min(1, (1.16 - height) / 0.19)) * arm_weight
                if height > 0.60
                else 0
            )
            if bend > 0:
                elbow = Vector((side * 0.31, 0, 1.07))
                rotation = Matrix.Rotation(-math.radians(67) * bend, 3, "X")
                vertex.co = rotation @ (vertex.co - elbow) + elbow
                vertex.co.x -= side * 0.105 * bend
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mesh_object.name = "Neutral eye" if is_eye else "Neutral figure"
    mesh.materials.clear()
    mesh.materials.append(clay)
    mesh_object.scale *= 1.065
    mesh_object.location *= 1.065
    mesh_object.select_set(True)

bpy.context.view_layer.update()
lowest = min(
    (mesh_object.matrix_world @ vertex.co).z
    for mesh_object in figure_objects
    for vertex in mesh_object.data.vertices
)
for mesh_object in figure_objects:
    mesh_object.location.z -= lowest

output = Path(__file__).resolve().parents[1] / "public/director-models/neutral-figure-v1.glb"
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_animations=False,
    export_texcoords=False,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
    export_extras=False,
)
print("Exported neutral reference figure:", output)
