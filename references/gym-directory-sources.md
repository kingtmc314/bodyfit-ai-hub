# Official 24/7 FITNESS directory fallback

The normalized snapshot is `/home/ubuntu/bodyfit-247-official-directory.json`. It contains **325 public gym branches** from the official 24/7 FITNESS Asia catalog: Hong Kong 159, Mainland China 134, Singapore 27, Taiwan 3 and Macau 2. Of these, 323 have exact official addresses; the two directory-only Mainland China addresses remain `null`. There are 310 operating, 14 preparing and one paused branch. This is the chain’s published footprint, not a worldwide all-brand gym database. The official brand page identifies the same five markets. [1] [2] [3]

## Bulk sources and requests

The preferred address source is `GET https://247.fitness/app-api/cms/membership-courses/stores?langTag=en-US`. Its JSON path is `data[].areas[].stores[]`. Every source row contains `storeId`, `storeName`, `storeNo`, `address`, `status`, `longitude` and `latitude`. Repeat the same request with `langTag=zh-HK` for exact Traditional Chinese names, addresses and area labels. No branch-by-branch research is needed to extract these bulk catalogs. [3] [4]

Use `GET https://247.fitness/app-api/cms/store/?lang=en-US` as the public directory cross-check. Its JSON path is `data.countryNodes[].areaNodeList[].stores[]`, with `data.total=325`. This feed has names, status and coordinates but no addresses. Its branch IDs, rather than the address-tree IDs, are the IDs to use in global detail and branch-map URLs. The official site’s shipped JavaScript publishes both routes and the required headers. [2] [5]

```bash
curl --fail --silent --show-error \
  -H 'tenant-id: 1' \
  -H 'Content-Type: application/json' \
  'https://247.fitness/app-api/cms/membership-courses/stores?langTag=en-US'
```

The header `tenant-id: 1` is publicly shipped site configuration, not an account credential. Without it, the server returns a JSON business error even with HTTP 200. Require `code === 0`, not just a successful HTTP status. These are observed public website endpoints, not a documented or guaranteed partner API. Fetch server-side for the fallback rather than depending on browser CORS or the failing Maps SDK. [5]

`GET /api/runtime-config` reports `globalSiteOrigin=https://247.fitness` and the current `mainlandChinaSiteOrigin=https://247fitness.com.cn`. Use that runtime result instead of an older `.cn` origin found in fallback JavaScript strings. The current Mainland site also has the official directory shell. Singapore, Macau and Taiwan are already present in the single global feed; separate regional crawling is unnecessary for this snapshot. [6] [7]

## Exact normalized JSON shape

The top-level object is:

```typescript
{
  schema_version: "1.0.0",
  generated_at: string, // ISO UTC snapshot timestamp
  brand: { id: "247fitness-asia", name: "24/7 FITNESS", official_origin: string },
  coverage: {
    description: string,
    branch_count: number,
    counts_by_country_or_region: Record<string, number>,
    counts_by_status: Record<string, number>,
    address_verified_count: number,
    equipment_verified_branch_count: number,
    global_catalog_source_total: number
  },
  sources: Source[],
  branches: Branch[],
  excluded_source_records: object[],
  extraction_notes: string[],
  discovery_items_for_parent: object[]
}
```

Each `Branch` has this exact structure. Dynamic locale keys currently include `en-US` and, when present in the bulk localized feed, `zh-HK`.

```typescript
{
  id: string, // namespaced, stable source-derived key
  brand: "24/7 FITNESS",
  name: string, // exact official value, not synthesized brand + district
  localized_names: Record<string, string>,
  address: string | null,
  localized_addresses: Record<string, string>,
  country_or_region: { code: string, name: string, official_source_code: string },
  region: string, // exact official area/city label
  localized_regions: Record<string, string>,
  status: { source_value: number, label: string },
  source_identifiers: {
    membership_tree_store_id: string | null,
    membership_tree_area_id: string | null,
    store_no: string | null,
    global_directory_store_id: string | null
  },
  official_source_url: string,
  official_directory_url: string,
  official_branch_url: string | null,
  coordinates: {
    latitude: number, longitude: number, source_id: string, crs: null
  } | null,
  equipment_status: "unknown" | "official_branch_inventory_verified",
  equipment: Equipment[],
  equipment_source_url: string | null,
  evidence: {
    source_ids: string[],
    cross_catalog_match: {
      method: string,
      coordinate_values_match: boolean | null
    },
    quality_flags: string[],
    alternative_published_coordinates?: {
      latitude: number, longitude: number, source_id: string
    }
  }
}
```

`Source` contains `id`, `url`, `kind` and `evidence`, with optional `required_headers` and `response_path`. Each `Equipment` contains `source_equipment_id`, `source_inventory_id`, `name`, `localized_names`, `manufacturer`, `model`, `official_category`, `source_status`, `published_counts: {total, normal, damaged}`, `official_source_url` and `exercise_suggestions: []`. Equipment IDs are strings. Manufacturer, model and count fields may be `null` if unpublished.

All addresses and names are preserved verbatim. In particular, the official English Kowloon City address ends with a literal `|`; the JSON flags it instead of silently correcting the source. `en-US` values are not necessarily translated English, especially for Mainland China names. Normalize Macau’s official `MAC` code to `MO` for general filtering, but keep `MAC` when querying the official API. The source does not specify coordinate CRS; do not assume or apply a Mainland map coordinate transform. [2] [3] [4]

## Screenshot branches and verified machines

The five screenshot matches are `Yuen Long` / `元朗`, `Kowloon City` / `九龍城`, `Hung Hom` / `紅磡`, `Kwai Fong` / `葵芳`, and `Tsim Sha Tsui` / `尖沙咀`. Their exact names, addresses and published coordinates are present in the normalized file. [3] [4]

The official branch-detail request is:

```text
GET https://247.fitness/app-api/cms/store/global/detail?lang=en-US&storeId=348&countryCode=HK
Headers: tenant-id: 1; Content-Type: application/json
```

Yuen Long’s `data.equipmentList[]` explicitly publishes **52 branch-specific inventory entries**, all with `storeId=348`. Examples include `Heat Row`, `HALF-RACK` model `HDT-HR`, `Decline Chest Press` model `ILDCP`, `Linear Leg Press` model `HSLLP`, `Smith` model `HSSM`, `Leg Extension` model `HS-LE` and `Lat Pulldown` model `HS-PD`. The JSON retains all 52 published entries and their localized names, manufacturers, models and snapshot counts. This is sufficient provenance for later equipment-to-exercise mapping; it is not a live availability guarantee. Some entries are storage racks, benches or an InBody assessment device, so do not treat every row as an exercise machine. Official categories are raw labels, not validated exercise anatomy. [8]

All other branches are explicitly `equipment_status="unknown"`, with no inferred exercise suggestions. `equipment: []` under that status means **not verified**, not “this gym has no machines.” Do not transfer Yuen Long’s inventory to Kowloon City, Hung Hom, Kwai Fong, Tsim Sha Tsui or any other branch. Never infer machines from logos, generic photos or another branch’s inventory. Only a branch-specific official list or subsequently verified user evidence should change that state.

## Catalog differences and scaling

The membership address tree has three non-gym/internal entries excluded from the output: HK IDs `473` and `474`, which the official directory client explicitly hides, and the Mainland headquarters entry `总部门店`, which is absent from the public directory. The directory also contains `Kowloon Bay` ID `358`, missing from the address tree. Its official detail response supplies its address and confirms status `2`, maintenance/paused. Only its directory fields were seeded; its equipment remains unknown. [11] [9]

Mainland China uses different ID namespaces between the two catalogs. The normalizer records a unique exact same-country name match rather than falsely equating IDs. `杭州亚奥万象天地店` has slightly differing published coordinate values; both are preserved in its evidence. Two directory-only entries, `东莞鹏瑞天玥广场店` and `珠海斗门万达店`, have unknown addresses and queued exact detail URLs in `discovery_items_for_parent`. They were not researched individually. [2] [3]

For global query coverage, ingest the bulk feeds as official fallback snapshots and index brand, exact/localized names, address and official area label. Filter by normalized country/region code and status before applying the query. Keep source IDs and retrieval time so refreshes can update the same record and expose stale evidence. A deterministic bounded-concurrency script can refresh feeds or fetch selected detail records; it does not require one research agent per branch. If expansion instead requires independent evidence judgment for five or more new countries/chains/branches, stop and let the parent compose that work through a workflow fan-out. This source discovery did not perform such a sweep and made no database, migration or application-code changes.

## References

[1]: https://247.fitness/en/brand "24/7 FITNESS official brand story and geographic footprint"
[2]: https://247.fitness/app-api/cms/store/?lang=en-US "Official global branch catalog, requires public tenant-id header"
[3]: https://247.fitness/app-api/cms/membership-courses/stores?langTag=en-US "Official bulk branch address tree in en-US"
[4]: https://247.fitness/app-api/cms/membership-courses/stores?langTag=zh-HK "Official bulk branch address tree in Traditional Chinese"
[5]: https://247.fitness/_next/static/chunks/12go__2r6msl6.js "Official public client API routes, configuration and headers"
[6]: https://247.fitness/api/runtime-config "Official current global and Mainland site origins"
[7]: https://247fitness.com.cn/en/contact_us/stores "Official current Mainland China directory"
[8]: https://247.fitness/app-api/cms/store/global/detail?lang=en-US&storeId=348&countryCode=HK "Official Yuen Long branch details and explicit equipment list"
[9]: https://247.fitness/app-api/cms/store/global/detail?lang=en-US&storeId=358&countryCode=HK "Official Kowloon Bay address and maintenance status"
[10]: https://247.fitness/en/contact_us/stores "Official global store-list page"
[11]: https://247.fitness/_next/static/chunks/08inpr79bj~.d.js "Official directory client hidden-branch filtering and branch-status enum"

## Application expansion — 15 November 2026, Hong Kong time

The parent subsequently executed a bounded-concurrency, metadata-only refresh of the same official branch-detail endpoint for all 325 directory IDs. Every response's store ID and country, and every equipment row's store ID, were verified before retaining data. This supersedes the discovery-only inventory coverage above: all 325 addresses are now published/verified, 293 branches publish a total of 12,444 **inventory entries**, and 32 branches have no published inventory (unknown, not empty gyms). These entries include racks, benches and assessment devices, not only exercise machines. No staff, contacts, images/CDN URLs or financial/asset-cost information is retained in the application indexes.

`shared/gymOfficialSeeds.ts` and `shared/gymOfficialInventory.ts` are dated, read-only source snapshots. They are not inserted as owner confirmations. The app preserves exact machine names, manufacturers, models and published normal/total/damaged counts, lists unmatched equipment without guessing exercises, and maps only reviewed exact aliases. A published zero usable/total count never creates an available-exercise suggestion. No live availability or worldwide all-chain completeness is promised. Explicitly confirmed owner entries are stored separately and may take precedence for the same exact machine key. Public source links and Hong Kong display dates remain visible.

The 325 branches cover Hong Kong (159), Mainland China (134), Singapore (27), Taiwan (3) and Macau (2). Google Places provides bounded global name/address searches beyond these official sources; provider outages do not erase the official fallback. Provider pagination is explicitly scoped and no total worldwide coverage is claimed.
