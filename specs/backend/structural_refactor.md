# Structural Refactor: Hierarchies and Registry to Objects

## Overview
Moving `app/hierarchies` to `app/objects/hierarchies` and `app/registry` to `app/objects/registry`, standardizing API routes.

## Changes

### Directory Structure
- Moved `app/hierarchies` -> `app/objects/hierarchies`.
- Moved `app/registry` -> `app/objects/registry`.

### API Routes
- `locations`: `/hierarchies/locations` -> `/objects/locations`
- `organizations`: `/hierarchies/organizations` -> `/objects/organizations`
- `service-catalogs`: `/hierarchies/service-catalogs` -> `/objects/service-catalogs`
- `registry`: `/registry` -> `/objects/registry`

### Rationale
Consolidating all "objects" under `app/objects` for better organization and consistency in API route naming.
