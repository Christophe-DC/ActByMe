"""Headless staging preview; input contains sampled positions, never executable code."""
import bpy
import json
import math
import os
import sys
from mathutils import Vector

arguments = sys.argv[sys.argv.index("--") + 1:]
with open(arguments[0], encoding="utf-8") as scene_file:
    document = json.load(scene_file)
output_dir = arguments[1]
os.makedirs(output_dir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 8
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 2
scene.render.resolution_x = 640
scene.render.resolution_y = 360
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.fps = document["fps"]
scene.world = bpy.data.worlds.new("Cinematic studio")
scene.world.color = (0.12, 0.12, 0.14)
scene.render.film_transparent = False


def coordinate(value):
    return (value["x"], -value["z"], value["y"])


def material(name, color):
    item = bpy.data.materials.new(name)
    item.diffuse_color = color
    return item


def hex_color(value):
    return tuple(int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)) + (1,)


def box(name, position, size, surface, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    item = bpy.context.object
    item.name = name
    item.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    item.data.materials.append(surface)
    item.parent = parent
    return item


floor = material("Floor", (0.055, 0.06, 0.07, 1))
box("Stage", (0, 0, -0.07), (24, 24, 0.1), floor)
for prop in document["scene"]["props"]:
    position = coordinate(prop["position"])
    size = prop["size"]
    surface = material(prop["id"], hex_color(prop["color"]))
    root = bpy.data.objects.new(prop["id"], None)
    scene.collection.objects.link(root)
    root.location = position
    root.rotation_euler.z = math.radians(prop.get("rotation", 0))
    dimensions = (size["x"], size["z"], size["y"])
    if prop["kind"] == "box":
        box("Object", (0, 0, dimensions[2] / 2), dimensions, surface, root)
    else:
        height = dimensions[2] if prop["kind"] == "table" else dimensions[2] * 0.5
        box("Top", (0, 0, height), (dimensions[0], dimensions[1], 0.1), surface, root)
        for side_x in (-1, 1):
            for side_y in (-1, 1):
                box("Leg", (side_x * dimensions[0] * 0.4, side_y * dimensions[1] * 0.4, height / 2), (0.08, 0.08, height), surface, root)
        if prop["kind"] == "chair":
            box("Back", (0, dimensions[1] * 0.45, height * 1.5), (dimensions[0], 0.1, height), surface, root)

actors = {}
for character in document["scene"]["characters"]:
    root = bpy.data.objects.new(character["name"], None)
    scene.collection.objects.link(root)
    surface = material(character["id"], hex_color(character["color"]))
    box("Torso", (0, 0, 1.12), (0.42, 0.24, 0.62), surface, root)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.17, location=(0, 0, 1.65))
    head = bpy.context.object
    head.parent = root
    head.data.materials.append(surface)
    # Nose makes facing legible in the schematic preview.
    box("Face direction", (0, -0.17, 1.65), (0.07, 0.09, 0.07), surface, root)
    limbs = {}
    for name, location, length in [("leftLeg", (-0.12, 0, 0.82), 0.78), ("rightLeg", (0.12, 0, 0.82), 0.78), ("leftArm", (-0.29, 0, 1.38), 0.58), ("rightArm", (0.29, 0, 1.38), 0.58)]:
        pivot = bpy.data.objects.new(name, None)
        scene.collection.objects.link(pivot)
        pivot.parent = root
        pivot.location = location
        box(name, (0, 0, -length / 2), (0.13, 0.14, length), surface, pivot)
        limbs[name] = pivot
    actors[character["id"]] = (root, limbs)

cameras = {}
for shot in document["scene"]["shots"]:
    camera_data = bpy.data.cameras.new(shot["name"])
    camera_data.sensor_fit = "VERTICAL"
    camera = bpy.data.objects.new(shot["name"], camera_data)
    scene.collection.objects.link(camera)
    camera.location = coordinate(shot["position"])
    camera.rotation_euler = (Vector(coordinate(shot["target"])) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.angle = math.radians(shot["fov"])
    cameras[shot["id"]] = camera
scene.camera = cameras[document["shot"]["id"]]

bpy.ops.object.light_add(type="AREA", location=(2, -3, 6))
key_light = bpy.context.object
key_light.data.energy = 1600
key_light.data.shape = "DISK"
key_light.data.size = 8
key_light.rotation_euler = (Vector((0, 0, 0)) - key_light.location).to_track_quat("-Z", "Y").to_euler()
scene.frame_start = 1
scene.frame_end = len(document["frames"])
for frame in document["frames"]:
    frame_number = frame["frame"]
    camera_state = frame["camera"]
    camera = scene.camera
    camera.location = coordinate(camera_state["position"])
    camera.rotation_euler = (Vector(coordinate(camera_state["target"])) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.angle = math.radians(camera_state["fov"])
    camera.keyframe_insert(data_path="location", frame=frame_number)
    camera.keyframe_insert(data_path="rotation_euler", frame=frame_number)
    camera.data.keyframe_insert(data_path="lens", frame=frame_number)
    for actor in frame["characters"]:
        root, limbs = actors[actor["id"]]
        position = list(coordinate(actor["position"]))
        position[2] += actor["pose"]["height"]
        root.location = position
        root.rotation_euler.z = math.radians(actor["rotation"])
        root.keyframe_insert(data_path="location", frame=frame_number)
        root.keyframe_insert(data_path="rotation_euler", frame=frame_number)
        for name, limb in limbs.items():
            limb.rotation_euler.x = actor["pose"][name]
            limb.keyframe_insert(data_path="rotation_euler", frame=frame_number)
scene.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output_dir, "staging.blend"))
scene.render.filepath = os.path.join(output_dir, "frame-")
bpy.ops.render.render(animation=True)
