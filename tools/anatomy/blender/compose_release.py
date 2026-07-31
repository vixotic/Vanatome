import argparse
import json
import os
import sys

import bpy


def arguments():
    separator = sys.argv.index("--")
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args(sys.argv[separator + 1 :])


def main():
    args = arguments()
    with open(args.config, encoding="utf-8") as handle:
        config = json.load(handle)

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)

    imported = []
    for component in config["components"]:
        existing = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=component["asset"])
        imported.extend(
            obj for obj in bpy.data.objects
            if obj not in existing
        )

    anatomy_objects = [
        obj for obj in imported
        if obj.get("anatomyId")
    ]
    if len(anatomy_objects) != config["expectedObjectCount"]:
        raise RuntimeError(
            "Imported anatomy object count does not match release configuration: "
            f"{len(anatomy_objects)} != {config['expectedObjectCount']}"
        )

    bpy.ops.object.select_all(action="DESELECT")
    for obj in imported:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = anatomy_objects[0]

    os.makedirs(args.output, exist_ok=True)
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
        "objectCount": len(anatomy_objects),
    }
    with open(
        os.path.join(args.output, "compose-report.json"),
        "w",
        encoding="utf-8",
    ) as handle:
        json.dump(report, handle, indent=2, sort_keys=True)
        handle.write("\n")
    print("VANATOME_COMPOSE_COMPLETE")
    print(json.dumps({"asset": asset_path, **report}, sort_keys=True))


main()
