"""Offline CC0 mesh rigging. Blender 4.5 LTS; see director-models/NOTICE.md."""
import math
from pathlib import Path
import bpy
from mathutils import Vector

source_collection = bpy.data.collections['Body Male - Realistic']
assert source_collection.asset_data.license == 'CC0'
source_origin = bpy.data.objects['GEO-body_male_realistic'].location.copy()
for scene_object in bpy.context.scene.objects:
    scene_object.select_set(False)
objects = []
clay = bpy.data.materials.new('Reference clay')
clay.diffuse_color = (.51, .53, .56, 1)
for source in source_collection.objects:
    mesh_object = source.copy()
    mesh_object.data = source.data.copy()
    bpy.context.scene.collection.objects.link(mesh_object)
    mesh_object.location -= source_origin
    for modifier in list(mesh_object.modifiers):
        if modifier.type == 'MULTIRES':
            modifier.levels = 1
            modifier.render_levels = 1
        else:
            mesh_object.modifiers.remove(modifier)
    mesh_object.hide_set(False)
    mesh_object.hide_viewport = False
    mesh_object.hide_render = False
    objects.append(mesh_object)
graph = bpy.context.evaluated_depsgraph_get()
for mesh_object in objects:
    mesh_object.data = bpy.data.meshes.new_from_object(mesh_object.evaluated_get(graph), preserve_all_data_layers=False, depsgraph=graph)
    mesh_object.modifiers.clear()
    for vertex in mesh_object.data.vertices:
        vertex.co = (vertex.co + mesh_object.location) * 1.065
    mesh_object.location = (0, 0, 0)
    for polygon in mesh_object.data.polygons:
        polygon.use_smooth = True
    mesh_object.data.materials.clear()
    mesh_object.data.materials.append(clay)
lowest = min(vertex.co.z for mesh_object in objects for vertex in mesh_object.data.vertices)
for mesh_object in objects:
    for vertex in mesh_object.data.vertices:
        vertex.co.z -= lowest
    mesh_object.name = 'Neutral eye' if 'eye' in mesh_object.name else 'Neutral figure'

# Coordinates below use the same right-handed, Y-up, +Z-front space as the web renderer.
def position(point):
    return Vector((point[0], -point[2], point[1]))
armature_data = bpy.data.armatures.new('Performance skeleton')
rig = bpy.data.objects.new('PerformanceRig', armature_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')

def bone(name, start, end, parent=None, normal=(0, 0, 1)):
    created = armature_data.edit_bones.new(name)
    created.head = position(start)
    created.tail = position(end)
    created.align_roll(position(normal))
    if parent:
        created.parent = armature_data.edit_bones[parent]
    return created

bone('hips', (0, .93, 0), (0, 1.04, 0))
bone('spine', (0, 1.04, 0), (0, 1.23, 0), 'hips')
bone('chest', (0, 1.23, 0), (0, 1.43, 0), 'spine')
bone('neck', (0, 1.43, 0), (0, 1.53, .005), 'chest')
bone('head', (0, 1.53, .005), (0, 1.77, .005), 'neck')
bone('jaw', (0, 1.60, .045), (0, 1.545, .13), 'head')
fingers = {
    'Thumb': [(.383,.961,.106),(.383,.928,.145),(.382,.900,.169),(.379,.878,.183)],
    'Index': [(.411,.928,.124),(.429,.875,.144),(.443,.843,.154),(.449,.822,.158)],
    'Middle': [(.420,.918,.099),(.443,.859,.117),(.457,.819,.127),(.468,.791,.134)],
    'Ring': [(.421,.919,.075),(.441,.863,.086),(.454,.829,.098),(.463,.805,.104)],
    'Pinky': [(.418,.932,.052),(.436,.886,.058),(.450,.856,.069),(.455,.838,.074)],
}
for side, sign in [('left',1),('right',-1)]:
    def mirror(point):
        return (point[0]*sign, point[1], point[2])
    bone(side+'Shoulder', (0,1.43,0),mirror((.20,1.43,0)),'chest')
    bone(side+'UpperArm', mirror((.20,1.43,0)),mirror((.292,1.185,0)),side+'Shoulder')
    bone(side+'LowerArm', mirror((.292,1.185,0)),mirror((.383,1.008,.046)),side+'UpperArm')
    wrist = Vector(mirror((.383,1.008,.046)))
    palm = (Vector(mirror(fingers['Index'][0]))-wrist).cross(Vector(mirror(fingers['Pinky'][0]))-wrist).normalized()*(-sign)
    bone(side+'Hand', wrist,mirror(fingers['Middle'][0]),side+'LowerArm',palm)
    for finger, points in fingers.items():
        for index in range(3):
            name = side+finger+str(index+1)
            bone(name,mirror(points[index]),mirror(points[index+1]),side+'Hand' if index==0 else side+finger+str(index),palm)
    bone(side+'UpperLeg',mirror((.10,.94,0)),mirror((.135,.49,.015)),'hips')
    bone(side+'LowerLeg',mirror((.135,.49,.015)),mirror((.145,.10,.005)),side+'UpperLeg')
    bone(side+'Foot',mirror((.145,.10,.005)),mirror((.145,.04,.15)),side+'LowerLeg')
bpy.ops.object.mode_set(mode='OBJECT')
# Blender's native heat diffusion gives continuous shoulder/elbow/finger skin weights.
for mesh_object in objects:
    mesh_object.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for mesh_object in objects:
    head_group = mesh_object.vertex_groups.get('head') or mesh_object.vertex_groups.new(name='head')
    jaw_group = mesh_object.vertex_groups.get('jaw') or mesh_object.vertex_groups.new(name='jaw')
    if 'eye' in mesh_object.name:
        indices=[vertex.index for vertex in mesh_object.data.vertices]
        for group in mesh_object.vertex_groups:
            group.remove(indices)
        head_group.add(indices,1,'REPLACE')
    else:
        for vertex in mesh_object.data.vertices:
            height, forward = vertex.co.z, -vertex.co.y
            if height > 1.54:
                for group in mesh_object.vertex_groups:
                    group.remove([vertex.index])
                jaw_weight = min(.85,max(0,(1.595-height)/.055))*min(1,max(0,(forward-.055)/.045))
                head_group.add([vertex.index],1-jaw_weight,'REPLACE')
                if jaw_weight:
                    jaw_group.add([vertex.index],jaw_weight,'REPLACE')
    missing=[vertex.index for vertex in mesh_object.data.vertices if not vertex.groups]
    assert not missing, f'Unweighted vertices: {mesh_object.name}: {len(missing)}'
    print('SKIN',mesh_object.name,len(mesh_object.data.vertices),'weighted vertices')
rig['rigVersion']=2
output=Path(__file__).resolve().parents[1]/'public/director-models/neutral-performer-v2.glb'
bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_apply=False,export_animations=False,export_texcoords=False,export_materials='EXPORT',export_cameras=False,export_lights=False,export_extras=True,export_skins=True)
print('EXPORTED',output)
