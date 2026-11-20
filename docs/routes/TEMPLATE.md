# Route: <what is built, in a few words>

One paragraph: what the result is, who drives it (mouse, touch, data), and on which
devices it was checked.

- **Id:** `<the file name without .md: lowercase words joined by dashes>`
- **Kind:** <scene | workflow>
- **For:** <one sentence an agent matches its task against: what gets built>
- **Checked on:** <desktop WebGL; desktop WebGPU; a named phone; or "no phone">
- **Status:** <what was checked, where and when, in a sentence>
- **Reference consumer:** <path or repository outside this one; or the engine fixture>
- **Engine version:** <package version and commit the route was checked against>

`scene` is one kind of scene built end to end by a reference consumer. `workflow` is
a path every project of its kind takes (a new game, a model from a DCC tool, a film
as data), whatever the scene. The header lines are read by `list_routes` and by the
route audit: keep their names and their order. Every section below is required, in
this order; write "None." under one that has nothing.

## When to take this route

What it fits, and what it does not fit (and which route to take instead).

## Tools

External tools with exact versions, where they come from, their licence, and what
may and may not be committed where. Engine commands and MCP tools the route uses.

## Steps

1. **<Step>.** The public API or tool, the values that worked, the file in the
   reference consumer that does it, and the check that says it worked.
2. ...

## Pitfalls

Each: what was seen, the cause, the fix. Most costly first.

## Engine gaps and their workarounds

Each gap with the engine plan item that will close it (if any) and the workaround the
reference consumer uses until then. Remove the row when the engine closes the gap.

## Checks

The commands and the device steps that show the result works, and what each measured.

## Not checked

Everything the route does not claim.

## Boundaries

What stays in the consumer and what belongs to the engine.
