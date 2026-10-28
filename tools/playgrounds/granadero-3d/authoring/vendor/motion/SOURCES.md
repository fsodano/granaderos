# Recorded human motion

The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

- Original publisher: [Carnegie Mellon University Graphics Lab](https://mocap.cs.cmu.edu/).
- Use terms checked on 2026-10-04: the publisher permits research and commercial-product use. It prohibits selling the motion data itself, including converted data.
- BVH conversion: Bruce Hahne, MotionBuilder-friendly CMU conversion, 2010. The converter adds no restrictions; the supplied `READMEFIRST.txt` records those terms and conversion details.
- Retrieval mirror: `una-dinosauria/cmu-mocap`, commit `09a07f54f3bbb58797325f009282d0b2048a2871`. Exact URLs, sizes and SHA-256 hashes are in `source-manifest.json`.

The original 120 Hz captures are cropped to one walking stride (07_01), one running stride (02_03), and two seconds of quiet standing (111_28). They are retargeted to the native MakeHuman joint locations and bone lengths, sampled at 30 Hz, and closed into seamless loops. Forward movement is removed from the armature and represented by a measured stride speed for the runtime.

CMU did not capture finger motion. The relaxed and holding finger poses are original work. Rifle, pistol and sabre actions are also original poses built around the held prop and two-bone arm reach. They are not described as recorded motion.

The Three.js Soldier model was investigated but not used. Its Mixamo provenance did not provide suitable asset-specific redistribution terms for this source bundle.
