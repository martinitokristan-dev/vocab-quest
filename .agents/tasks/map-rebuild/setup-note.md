# Map rebuild setup note

## Folders (all exist)
- frontend-game/MAP, MAP/reference, MAP/src, MAP/assets, MAP/data
- .agents/tasks/map-rebuild

## Primary visual reference
- Copied from frontend-game/dist/assets/vocab-quest-map.png to frontend-game/MAP/reference/vocab-quest-map.png (3,012,642 bytes). Not restored to public/assets. Visual reference only, never a runtime layer, never modified.
- Verified dimensions: **1774x887** (the brief expected 1024x506; actual file differs, same 2:1 aspect).
- Node count viewed: **13** pink numbered voxel nodes (1-13).
- Note: an early mkdir mishap briefly created an empty directory at the reference file path; it was removed and replaced by the real file.

## Reference layout (13 nodes, approx px on 1774x887)
- 1 (175,775), 2 (352,722), 3 (502,667): welcome path by "I (heart) EPCES / WELCOME" sign, DepEd East Prosperidad Central Elementary School (green roof) at upper left.
- Wooden bridge over a river between 3 and 4.
- 4 (713,540), 5 (808,565), 6 (925,573), 7 (1043,566), 8 (1153,537): arc around the round "Bayan ng Prosperidad" hall (center).
- 9 (1270,368), 10 (1345,413), 11 (1430,445), 12 (1525,472), 13 (1637,488): diagonal/curving path up to the Provincial Capitol (red roof, Philippine flag) at upper right, with vans/cars.
- Style: voxel/Minecraft-like terrain, blue-sky with white voxel clouds at top (~top 15%), voxel trees/hills, waterfalls and rivers, fences, playground slides, lamp post, tan brick path.

## Second reference: frontend-game/public/assets/vocab-map.png (unmodified)
- 1774x887, 2,899,229 bytes, 15 nodes: 5 levels per kingdom x 3 kingdoms.
- Same scene and landmarks as above, different node spacing:
  - Kingdom 1 (school / welcome sign): 1 (140,780), 2 (288,748), 3 (412,712), 4 (516,665), 5 (616,620).
  - Kingdom 2 (Bayan ng Prosperidad hall): 6 (713,548), 7 (816,565), 8 (926,573), 9 (1043,566), 10 (1155,543).
  - Kingdom 3 (Provincial Capitol): 11 (1266,370), 12 (1340,413), 13 (1430,447), 14 (1525,472), 15 (1637,488).
- Path is one continuous winding left-to-right route, bottom-left to upper-right.
- Rebuild target: 3 kingdoms x 45 levels = 135 total, scrolling upward between levels/kingdoms; keep these three landmarks/themes as kingdom identities.
