"""Deterministic, config-driven Z-Anatomy batch exporter.

Run only through pipeline.mjs. Blender auto-execution stays disabled; this file
is the sole explicitly requested script.
"""

import argparse
import json
import os
import re
import sys
import unicodedata

import bpy
from mathutils import Vector


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--batch", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :])


def rounded_vector(vector):
    return [round(float(value), 6) for value in vector]

def stable_part_id(parent_id, source_name):
    normalized = re.sub(r"\.l$", " left", source_name, flags=re.IGNORECASE)
    normalized = re.sub(r"\.r$", " right", normalized, flags=re.IGNORECASE)
    normalized = "".join(
        character
        for character in unicodedata.normalize("NFKD", normalized)
        if not unicodedata.combining(character)
    ).lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return f"{parent_id}-{normalized}"


def world_bounds(objects):
    points = [
        obj.matrix_world @ Vector(corner)
        for obj in objects
        for corner in obj.bound_box
    ]
    if not points:
        return [0, 0, 0], [0, 0, 0]
    minimum = Vector(tuple(min(getattr(point, axis) for point in points) for axis in "xyz"))
    maximum = Vector(tuple(max(getattr(point, axis) for point in points) for axis in "xyz"))
    return rounded_vector((minimum + maximum) / 2), rounded_vector(maximum - minimum)


def material_for(group):
    spec = group["material"]
    material = bpy.data.materials.new(f"vanatome__{group['id']}")
    material.diffuse_color = spec["color"]
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = spec["color"]
    shader.inputs["Roughness"].default_value = spec.get("roughness", 0.5)
    shader.inputs["Metallic"].default_value = spec.get("metallic", 0.0)
    return material


def duplicate_for_export(source, group, structure_id, parent_id, material, collection):
    duplicate = source.copy()
    duplicate.data = source.data.copy()
    duplicate.animation_data_clear()
    duplicate.name = f"{structure_id}__{source.name}"
    duplicate["anatomyId"] = structure_id
    if parent_id:
        duplicate["anatomyParentId"] = parent_id
    duplicate["sourceName"] = source.name
    duplicate["anatomySystem"] = group["system"]
    world = source.matrix_world.copy()
    duplicate.parent = None
    duplicate.matrix_world = world
    collection.objects.link(duplicate)

    if duplicate.type == "CURVE":
        for selected in bpy.context.selected_objects:
            selected.select_set(False)
        bpy.context.view_layer.objects.active = duplicate
        duplicate.select_set(True)
        bpy.ops.object.convert(target="MESH")
        duplicate = bpy.context.view_layer.objects.active
        duplicate.name = f"{structure_id}__{source.name}"
        duplicate["anatomyId"] = structure_id
        if parent_id:
            duplicate["anatomyParentId"] = parent_id
        duplicate["sourceName"] = source.name
        duplicate["anatomySystem"] = group["system"]
        duplicate.select_set(False)

    duplicate.data.materials.clear()
    duplicate.data.materials.append(material)
    decimate = group.get("decimate")
    if decimate and len(duplicate.data.polygons) > 2500:
        modifier = duplicate.modifiers.new("Vanatome web decimation", "DECIMATE")
        modifier.ratio = decimate
    if duplicate.modifiers:
        for selected in bpy.context.selected_objects:
            selected.select_set(False)
        duplicate.select_set(True)
        bpy.context.view_layer.objects.active = duplicate
        bpy.context.view_layer.update()
        bpy.ops.object.convert(target="MESH")
        duplicate = bpy.context.view_layer.objects.active
    if duplicate.type == "MESH":
        while duplicate.data.uv_layers:
            duplicate.data.uv_layers.remove(duplicate.data.uv_layers[0])
    duplicate.hide_render = False
    duplicate.hide_viewport = False
    return duplicate


def source_objects(group):
    configured = group.get("sourceObjects")
    if configured is not None:
        return [(name, bpy.data.objects.get(name)) for name in configured]

    selector = group["sourceSelector"]
    collection = bpy.data.collections.get(selector["collection"])
    if collection is None:
        raise RuntimeError(f"Source collection not found: {selector['collection']}")
    candidates = collection.all_objects if selector.get("recursive") else collection.objects
    allowed_types = set(selector.get("types", ["MESH", "CURVE"]))
    excluded_names = set(selector.get("excludeNames", []))
    excluded_suffixes = tuple(selector.get("excludeSuffixes", []))
    minimum_polygons = selector.get("minimumPolygons", 0)
    selected = []
    for source in candidates:
        if (
            source.type not in allowed_types
            or source.name in excluded_names
            or source.name.endswith(excluded_suffixes)
        ):
            continue
        if source.type == "MESH" and len(source.data.polygons) < minimum_polygons:
            continue
        selected.append(source)
    return [(source.name, source) for source in sorted(selected, key=lambda item: item.name)]


def main():
    args = arguments()
    with open(args.config, encoding="utf-8") as handle:
        config = json.load(handle)
    batch = config["batches"][args.batch]
    os.makedirs(args.output, exist_ok=True)

    export_collection = bpy.data.collections.new(f"Vanatome {args.batch}")
    bpy.context.scene.collection.children.link(export_collection)
    exported = []
    report_groups = {}

    for group in batch["groups"]:
        group_objects = []
        missing = []
        material = material_for(group)
        resolved_sources = source_objects(group)
        expand_sources = group.get("expandSourceParts", False) and len(resolved_sources) > 1
        structure_objects = {}
        for source_name, source in resolved_sources:
            if source is None or source.type not in {"MESH", "CURVE"}:
                missing.append(source_name)
                continue
            structure_id = (
                stable_part_id(group["id"], source_name)
                if expand_sources
                else group["id"]
            )
            parent_id = group["id"] if expand_sources else group.get(
                "parentId",
                f"{group['system']}-system" if group.get("selectable", True) else None,
            )
            duplicate = duplicate_for_export(
                source,
                group,
                structure_id,
                parent_id,
                material,
                export_collection,
            )
            exported.append(duplicate)
            group_objects.append(duplicate)
            structure_objects.setdefault(structure_id, []).append(duplicate)
        center, size = world_bounds(group_objects)
        structures = {}
        if expand_sources:
            structures[group["id"]] = {
                "name": group.get("name", group["id"]),
                "kind": group.get("kind", "organ"),
                "parentId": group.get("parentId", f"{group['system']}-system"),
                "system": group["system"],
                "nodes": [],
                "sourceObjects": [],
                "centerBlender": center,
                "sizeBlender": size,
                "selectable": group.get("selectable", True),
            }
        for structure_id, objects in structure_objects.items():
            structure_center, structure_size = world_bounds(objects)
            source_names = [
                name
                for name, _source in resolved_sources
                if (
                    stable_part_id(group["id"], name)
                    if expand_sources
                    else group["id"]
                ) == structure_id
            ]
            structures[structure_id] = {
                "name": source_names[0] if expand_sources else group.get("name", group["id"]),
                "kind": "part" if expand_sources else group.get("kind", "organ"),
                "parentId": group["id"] if expand_sources else group.get(
                    "parentId",
                    f"{group['system']}-system" if group.get("selectable", True) else None,
                ),
                "system": group["system"],
                "nodes": [obj.name for obj in objects],
                "sourceObjects": source_names,
                "centerBlender": structure_center,
                "sizeBlender": structure_size,
                "selectable": group.get("selectable", True),
            }
        report_groups[group["id"]] = {
            "name": group.get("name", group["id"]),
            "system": group["system"],
            "nodes": [obj.name for obj in group_objects],
            "sourceObjects": [name for name, _source in resolved_sources],
            "centerBlender": center,
            "sizeBlender": size,
            "missing": missing,
            "selectable": group.get("selectable", True),
            "structures": structures,
        }

    if not exported:
        raise RuntimeError("Batch did not produce any exportable objects")
    for selected in bpy.context.selected_objects:
        selected.select_set(False)
    for obj in exported:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = exported[0]

    asset_path = os.path.join(args.output, "atlas.glb")
    bpy.ops.export_scene.gltf(
        filepath=asset_path,
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    report = {
        "blenderVersion": bpy.app.version_string,
        "objectCount": len(exported),
        "groups": report_groups,
    }
    with open(os.path.join(args.output, "export-report.json"), "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
        handle.write("\n")
    print("VANATOME_EXPORT_COMPLETE")
    print(json.dumps({"asset": asset_path, "objectCount": len(exported)}, sort_keys=True))


main()
