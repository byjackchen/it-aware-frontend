# Locations Object Enhancement - Frontend API Changes

## Overview

The Location object has been enhanced with two new mandatory fields: `type` and `timezone`. This document outlines all API changes that frontend applications need to adapt to.

**Breaking Change:** All Location API endpoints now include these new fields, and creating a location requires providing both `type` and `timezone`.

---

## New Fields

### `type` (Required)

- **Type:** `string`
- **Description:** Location categorization
- **Possible Values:**
  - `root` - Top-level location (e.g., Global headquarters)
  - `region` - Regional grouping (e.g., EMEA, APAC, Americas)
  - `country` - Country-level location (e.g., USA, Germany, Singapore)
  - `office_location` - Physical office location
  - `remote_location` - Remote work location
- **Constraints:** Required on creation, cannot be null
- **Updateable:** Yes

### `timezone` (Required)

- **Type:** `string`
- **Description:** IANA Time Zone Database identifier
- **Format:** `"Area/Location"` (e.g., `"America/New_York"`, `"Asia/Singapore"`, `"Europe/Berlin"`)
- **Empty String Policy:** Use `""` (empty string) for non-timezone-sensitive locations (e.g., regions, countries)
- **Constraints:** Required on creation, cannot be null, defaults to empty string
- **Updateable:** Yes
- **Reference:** [IANA Time Zone Database](https://www.iana.org/time-zones)

---

## API Endpoint Changes

### 1. POST /hierarchies/locations - Create Location

**Breaking Change:** Request body now requires two additional mandatory fields.

#### Request Body Changes

```typescript
interface LocationCreate {
  name: string;                    // Existing field
  parent_oid?: string | null;      // Existing field (optional)
  
  // NEW FIELDS (Required)
  type: "root" | "region" | "country" | "office_location" | "remote_location";
  timezone: string;                // IANA timezone ID or empty string ""
}
```

#### Example Request

```json
{
  "name": "New York Office",
  "parent_oid": "a1b2c3d4...",
  "type": "office_location",
  "timezone": "America/New_York"
}
```

#### Example Request (Regional)

```json
{
  "name": "EMEA Region",
  "type": "region",
  "timezone": ""
}
```

#### Response Changes

The response now includes the new fields:

```typescript
interface LocationResponse {
  oid: string;
  name: string;
  
  // NEW FIELDS
  type: string;
  timezone: string;
  
  parent_oid?: string | null;
  path: string[];
  created_at: string;  // ISO 8601 datetime
  updated_at: string;  // ISO 8601 datetime
}
```

#### Example Response

```json
{
  "oid": "a1b2c3d4...",
  "name": "New York Office",
  "type": "office_location",
  "timezone": "America/New_York",
  "parent_oid": "e5f6g7h8...",
  "path": ["e5f6g7h8...", "a1b2c3d4..."],
  "created_at": "2026-01-04T08:00:00Z",
  "updated_at": "2026-01-04T08:00:00Z"
}
```

---

### 2. GET /hierarchies/locations - List Locations

**Breaking Change:** Response now includes `type` and `timezone` fields.

#### Request Parameters (Unchanged)

```
GET /hierarchies/locations?skip=0&limit=100
```

#### Response Changes

Each location in the array now includes the new fields:

```typescript
interface LocationResponse[] {
  // Same as LocationResponse above, includes type and timezone
}
```

#### Example Response

```json
[
  {
    "oid": "a1b2c3d4...",
    "name": "Global Headquarters",
    "type": "root",
    "timezone": "",
    "parent_oid": null,
    "path": ["a1b2c3d4..."],
    "created_at": "2026-01-04T08:00:00Z",
    "updated_at": "2026-01-04T08:00:00Z"
  },
  {
    "oid": "e5f6g7h8...",
    "name": "New York Office",
    "type": "office_location",
    "timezone": "America/New_York",
    "parent_oid": "a1b2c3d4...",
    "path": ["a1b2c3d4...", "e5f6g7h8..."],
    "created_at": "2026-01-04T08:00:00Z",
    "updated_at": "2026-01-04T08:00:00Z"
  }
]
```

---

### 3. GET /hierarchies/locations/{oid} - Get Location by OID

**Breaking Change:** Response now includes `type` and `timezone` fields.

#### Request (Unchanged)

```
GET /hierarchies/locations/{oid}
```

#### Response Changes

Same as `LocationResponse` above, includes `type` and `timezone`.

#### Example Response

```json
{
  "oid": "a1b2c3d4...",
  "name": "Singapore Office",
  "type": "office_location",
  "timezone": "Asia/Singapore",
  "parent_oid": "i9j0k1l2...",
  "path": ["i9j0k1l2...", "a1b2c3d4..."],
  "created_at": "2026-01-04T08:00:00Z",
  "updated_at": "2026-01-04T08:00:00Z"
}
```

---

### 4. PUT /hierarchies/locations/{oid} - Update Location

**Breaking Change:** Request body now supports updating `type` and `timezone` fields.

#### Request Body Changes

```typescript
interface LocationUpdate {
  name?: string;                    // Existing field (optional)
  parent_oid?: string | null;       // Existing field (optional)
  
  // NEW FIELDS (Optional for update)
  type?: "root" | "region" | "country" | "office_location" | "remote_location";
  timezone?: string;                // IANA timezone ID or empty string ""
}
```

#### Example Request (Update timezone only)

```json
{
  "timezone": "America/Los_Angeles"
}
```

#### Example Request (Update multiple fields)

```json
{
  "name": "New York HQ",
  "type": "office_location",
  "timezone": "America/New_York"
}
```

#### Response Changes

Same as `LocationResponse` above, includes updated `type` and `timezone`.

---

### 5. DELETE /hierarchies/locations/{oid} - Delete Location

**No Changes:** This endpoint remains unchanged.

---

## Frontend Adaptation Checklist

### Required Changes

- [ ] **Update Location Creation Forms**
  - Add `type` dropdown/select with the 5 allowed values
  - Add `timezone` selector (dropdown or autocomplete) for IANA timezones
  - Make both fields mandatory (required validation)
  - Handle empty string timezone for non-physical locations

- [ ] **Update Location Display/UI**
  - Display `type` field in location lists and detail views
  - Display `timezone` field in location lists and detail views
  - Consider visual indicators for location types (icons, badges, colors)

- [ ] **Update Location Edit Forms**
  - Add `type` field for updating (optional field)
  - Add `timezone` field for updating (optional field)
  - Preserve existing values when not being updated

- [ ] **Update API Client/Service Layer**
  - Update TypeScript interfaces to include `type` and `timezone`
  - Update API calls to send `type` and `timezone` when creating locations
  - Update error handling for missing required fields

- [ ] **Update State Management**
  - Store `type` and `timezone` in Redux/store or local state
  - Ensure state updates include new fields

- [ ] **Update Data Validation**
  - Add client-side validation for `type` field (must be one of the 5 values)
  - Add client-side validation for `timezone` field (valid IANA format or empty string)

### Optional Enhancements

- [ ] **Timezone Selector UX**
  - Implement timezone autocomplete with search
  - Group timezones by region (America, Europe, Asia, etc.)
  - Show UTC offset in timezone selector for better UX

- [ ] **Location Type Visual Differentiation**
  - Use icons for different location types (🏢 for office, 🏠 for remote, 🌍 for region, etc.)
  - Use color coding or badges to differentiate location types

- [ ] **Timezone Conversion Display**
  - Show local time for each location in location lists
  - Display current time offset from user's timezone

---

## Common Use Cases

### Creating a Physical Office Location

```json
{
  "name": "London Office",
  "parent_oid": "country-oid-here",
  "type": "office_location",
  "timezone": "Europe/London"
}
```

### Creating a Remote Work Location

```json
{
  "name": "Remote - West Coast",
  "parent_oid": "country-oid-here",
  "type": "remote_location",
  "timezone": "America/Los_Angeles"
}
```

### Creating a Regional Grouping

```json
{
  "name": "EMEA Region",
  "parent_oid": "root-oid-here",
  "type": "region",
  "timezone": ""
}
```

### Updating a Location's Timezone

```json
{
  "timezone": "America/Chicago"
}
```

---

## Error Handling

### 422 Validation Errors

If `type` or `timezone` is missing during creation:

```json
{
  "detail": [
    {
      "loc": ["body", "type"],
      "msg": "field required",
      "type": "value_error.missing"
    },
    {
      "loc": ["body", "timezone"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

### Invalid Type Value

If `type` contains an invalid value:

```json
{
  "detail": "Invalid location type. Must be one of: root, region, country, office_location, remote_location"
}
```

---

## Migration Notes

- **Existing Data:** All existing locations in the database have been migrated to include `type` and `timezone` fields with appropriate values.
- **Backward Compatibility:** There is **no backward compatibility** - all frontend applications must be updated to handle the new fields.
- **Deployment:** Backend and frontend should be deployed together to avoid API contract mismatches.

---

## Testing Recommendations

### Unit Tests

- Test location creation with all 5 type values
- Test location creation with valid timezone strings
- Test location creation with empty timezone string
- Test validation errors when type/timezone are missing
- Test validation errors for invalid type values

### Integration Tests

- Test full CRUD operations with new fields
- Test timezone display and conversion
- Test location type filtering/sorting (if implemented)

### Manual Testing

- Verify all location forms include type and timezone fields
- Verify location lists display both new fields
- Verify timezone selector UX is intuitive
- Test edge cases: empty timezone, special characters in location names

---

## Questions?

Contact the backend team for clarifications on:
- IANA timezone database details
- Location type categorization rules
- Additional validation rules or constraints
