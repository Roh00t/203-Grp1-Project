# Curation Notes — Fare Tables, Constraint-Validation Data, and RAG Corpus

**Project:** Japan Travel Itinerary Planner  
**Curation owner:** Ulfa Herdyani  
**Curation date:** 2026-09-06  
**Primary scope:** Golden-route itinerary support for Tokyo → Kyoto → Osaka → Hiroshima

## 1. Purpose and architecture

This curation provides the project's trusted data layer. It separates **deterministic structured data** from **retrieved explanatory knowledge**:

- `data/fare_table.json` → Pass ROI Auditor
- `data/dietary_table.json` → Constraint Validator
- `data/travel_time_table.json` → Constraint Validator
- `rag_corpus/` → grounded context for the LLM
- `data/source_registry.json` → evidence/audit registry
- `data/area_vocabulary.json` → canonical tourist-area labels

The central principle is:

> **Use sourced structured data for calculations and hard constraints; use sourced RAG documents for explanation and contextual rules; never guess missing facts.**

The LLM should not be the authoritative calculator. Likewise, hard dietary/geographic validation should not depend on what the LLM happens to remember.

## 2. Evidence and sourcing policy

Every trusted executable row must have both `source_id` and `source_date`. A row missing either should be treated as **unverified**.

`source_id` resolves through `data/source_registry.json`, which records title, publisher, URL, retrieval date, source type, and important caveats.

### Source priority

1. Official railway/operator sources: JR Group/JAPAN RAIL PASS, SmartEX/JR Central, JR West.
2. Official Japanese government sources: Digital Agency, Japan Customs.
3. Official tourism organizations: JNTO, GO TOKYO, Kyoto City Official Travel Guide, Dive! Hiroshima.
4. Local/district tourism or venue sources where stronger official evidence is unavailable.
5. Third-party travel sites only when necessary; they should not replace official operator sources for fare/pass numbers.

`source_date` is the date the information was retrieved/verified for this dataset, not necessarily the source's publication date.

---

# PART A — FARE TABLE

## 3. Role and schema

`data/fare_table.json` feeds the **Pass ROI Auditor** and supports deterministic ticket-versus-pass calculations.

Fare rows use:

- `from`
- `to`
- `service_type`
- `price_yen`
- `supplement_yen` — required on every Nozomi/Mizuho row
- `source_id`
- `source_date`

Example:

```json
{
  "from": "Tokyo",
  "to": "Kyoto",
  "service_type": "Nozomi",
  "price_yen": 13970,
  "supplement_yen": 4960,
  "source_id": "smartex-reserved-fares-2025",
  "source_date": "2026-09-06"
}
```

## 4. Fare basis

To avoid silently mixing reserved, non-reserved, discounted, package, and seasonal products, the curated Shinkansen rows consistently use:

> **SmartEX regular-season, one-way, adult, Ordinary Car reserved-seat fare.**

This is a controlled evaluation basis, not a guarantee of the live price for every travel date. Reserved-seat prices can vary by season.

## 5. Curated golden-route fares

| Segment | Service | Ticket basis | JR Pass supplement |
|---|---|---:|---:|
| Tokyo ↔ Kyoto | Hikari | ¥13,650 | N/A |
| Tokyo ↔ Kyoto | Nozomi | ¥13,970 | ¥4,960 |
| Kyoto ↔ Shin-Osaka | Hikari | ¥2,670 | N/A |
| Shin-Osaka ↔ Hiroshima | Sakura | ¥10,220 | N/A |
| Shin-Osaka ↔ Hiroshima | Nozomi | ¥10,750 | ¥4,170 |

Both directions are explicitly represented where required by the calculator's lookup behavior.

## 6. Kyoto ↔ Shin-Osaka Nozomi omission

The current calculator requires every Nozomi/Mizuho row to contain a numeric `supplement_yen`.

The official JAPAN RAIL PASS special-ticket matrix does not provide a usable supplement value for Kyoto ↔ Shin-Osaka; it displays a dash. Therefore this Nozomi pair is intentionally omitted from executable fare rows.

Using `null` would trigger `MissingSupplementDataError`; inventing a number would create a false financial claim.

> **Incomplete evidence should result in unsupported/unverified behavior, not fabricated coverage.**

## 7. Passes

### JAPAN RAIL PASS — 7-day Ordinary
The curated price is **¥50,000**. Purchase date/channel can affect pricing, so the official price page must be rechecked during future updates.

`covers_nozomi` is false because a standard JR Pass alone does not make Nozomi/Mizuho travel free; separate supplement logic applies.

### Kansai-Hiroshima Area Pass
The curated price is **¥17,000 for 5 days**. It is relevant to the Osaka/Hiroshima portion of the route, including eligible Sanyo Shinkansen travel between Shin-Osaka and Hiroshima.

Regional-pass coverage is geographically bounded and must not be interpreted as covering unrelated Tokyo-side Tokaido Shinkansen travel.

---

# PART B — DIETARY TABLE

## 8. Role and schema

`data/dietary_table.json` feeds the **Constraint Validator** and maps:

> venue → tourist area → supported dietary tags → evidence

Required fields:

- `venue_name`
- `ward`
- `tags`
- `source_id`
- `source_date`

## 9. Meaning of `ward`

Despite the field name, `ward` is **not an official Japanese administrative ward** in this application. It is a practical tourist area/neighborhood.

Examples:
- Asakusa
- Shibuya
- Shinjuku
- Tokyo Station
- Gion
- Kyoto Station
- Dotonbori
- Shin-Osaka
- Hiroshima Station
- Peace Memorial Park

Broad administrative units such as Taito, Chuo, Higashiyama, and Naniwa are intentionally avoided because they are too coarse for the validator's geographic-plausibility purpose.

## 10. Canonical area vocabulary

The exact allowed strings are stored in `data/area_vocabulary.json`.

### Tokyo
Asakusa; Shibuya; Shinjuku; Tokyo Station

### Kyoto
Gion; Kyoto Station

### Osaka
Dotonbori; Shin-Osaka

### Hiroshima
Hiroshima Station; Peace Memorial Park

The same strings should be used by itinerary output, dietary data, and travel-time data. Avoid inconsistent variants such as `Dotonbori`, `Dotonbori Area`, and `Namba/Dotonbori` unless explicit mapping logic exists.

## 11. Dietary-tag policy

Dietary terminology is curated conservatively. Labels such as:

- Halal
- Muslim Friendly
- Muslim Welcome
- Pork-Free
- Vegan
- Vegetarian

are **not automatically equivalent**.

For example, `Muslim Friendly` must not automatically become a claim that the entire venue/menu is halal. `Pork-Free` alone also does not establish all halal requirements.

If a venue offers a specific halal menu rather than being entirely halal, that caveat should be preserved in `source_registry.json`.

A false positive is more damaging to the project's dietary-constraint objective than returning a venue as unverified.

## 12. Freshness limitation

Restaurant status can change through closure, relocation, menu changes, halal-status changes, hours, or reservation policy. The table is therefore a dated project/evaluation dataset, not a permanent guarantee.

---

# PART C — TRAVEL-TIME TABLE

## 13. Role and schema

`data/travel_time_table.json` feeds the **Constraint Validator** and helps judge whether itinerary transitions are geographically plausible.

Required fields:

- `ward_a`
- `ward_b`
- `estimated_transit_minutes`
- `mode`
- `source_id`
- `source_date`

## 14. Symmetric pairs

The table is symmetric: one `Asakusa ↔ Shibuya` record is sufficient rather than separate forward/reverse rows.

The time is a planning estimate for validation, not a live timetable guarantee.

## 15. Same-area rows

Same-area rows are mandatory because the implemented validator does not automatically assume two stops sharing the same area are close.

For example, Senso-ji and an Asakusa restaurant both use `ward: "Asakusa"`, but the validator still needs an explicit `Asakusa ↔ Asakusa` row.

Every canonical area therefore has a same-area row.

## 16. The 10-minute same-area heuristic

The 10-minute same-area value is **project methodology**, not a claim that every two points in an area are exactly ten minutes apart.

It means:

> two stops assigned to the same carefully chosen tourist area should normally count as a plausible local hop.

These rows use `same-area-10min-methodology`, explicitly identified in the source registry as project methodology rather than external routing evidence.

## 17. Cross-area estimates

Cross-area times are dated planning estimates. Actual travel time can vary with departure time, frequency, transfers, walking, disruption, congestion, and route choice.

The intended meaning is:

> **reasonable estimate for itinerary plausibility checking**

not:

> **guaranteed journey duration**.

## 18. Adding a new area

If Module 1 starts producing a new area such as `Arashiyama`:

1. add it to `area_vocabulary.json`;
2. use exactly that string in itinerary output;
3. add relevant dietary venues;
4. add `Arashiyama ↔ Arashiyama`;
5. add required cross-area travel-time pairs;
6. source/date every new row.

---

# PART D — RAG CORPUS

## 19. Role

The RAG corpus supplies short, source-backed prose to the LLM. It handles explanatory rules and context rather than deterministic calculations.

The corpus is deliberately small and keyword-oriented instead of using a large vector database.

Each document contains:

- `document_id`
- `title`
- `keywords`
- `content`
- `source_id`
- `source_date`

## 20. Explanation of all 17 RAG documents

### 01 — Visit Japan Web overview
`01_visit_japan_web_overview.json`

Explains what Visit Japan Web is and grounds questions about arrival, immigration, and customs procedures.

### 02 — Customs declaration
`02_customs_declaration.json`

Explains Japan's customs declaration requirement and the role of electronic declaration.

### 03 — Visit Japan Web scam warning
`03_visit_japan_web_scam_warning.json`

Warns about fake/third-party Visit Japan Web sites and helps prevent recommendation of unofficial fee-charging services.

### 04 — JR Pass eligibility
`04_jr_pass_eligibility.json`

Grounds eligibility explanations and prevents the planner from assuming every foreign traveler automatically qualifies.

### 05 — JR Pass price
`05_jr_pass_price.json`

Provides explanatory context for the 7-day Ordinary JR Pass price and purchase-date/channel caveats. The deterministic price itself remains in structured pass data.

### 06 — Nozomi/Mizuho with JR Pass
`06_nozomi_mizuho_with_jrpass.json`

Explains that a standard JR Pass alone does not make Nozomi/Mizuho travel free and introduces the special-ticket/supplement rule.

### 07 — Golden-route Nozomi supplements
`07_nozomi_supplement_golden_route.json`

Explains the supplement values relevant to the project's golden route and reinforces the rule not to invent unsupported values.

### 08 — JR Pass reserved seats
`08_jr_pass_reserved_seats.json`

Explains eligible reserved-seat procedures for pass holders.

### 09 — JR Pass online purchase and pickup
`09_jr_pass_online_purchase_pickup.json`

Explains pickup, eligibility checking, passport-related procedure, and reservation context after online purchase.

### 10 — Kansai-Hiroshima Pass price/duration
`10_kansai_hiroshima_price_duration.json`

Provides explanatory context for the regional pass's price and five-day validity.

### 11 — Kansai-Hiroshima Pass coverage
`11_kansai_hiroshima_coverage.json`

Explains geographic/service coverage boundaries so the LLM does not incorrectly treat the regional pass as covering Tokyo-side Shinkansen travel.

### 12 — SmartEX fare basis
`12_smartex_fare_basis.json`

Explains the regular-season reserved-seat basis used by the calculator and prevents the LLM from presenting the fixed evaluation fares as universal live prices.

### 13 — SmartEX IC-card boarding
`13_smartex_ic_card_boarding.json`

Explains registered IC-card gate entry for SmartEX and distinguishes it from ordinary stored-value IC-card fare payment.

### 14 — SmartEX QR boarding
`14_smartex_qr_boarding.json`

Explains QR-Ticket boarding as another SmartEX boarding method.

### 15 — General Muslim travel guidance
`15_muslim_travel_general.json`

Provides caution around halal/Muslim-friendly terminology and reduces unsupported dietary claims.

### 16 — Tokyo Muslim Travelers' Guide
`16_tokyo_muslim_guide.json`

Provides Tokyo-specific official tourism context for Muslim travelers, including dining/prayer discovery.

### 17 — Kyoto halal-related categories
`17_kyoto_halal_categories.json`

Explains that Kyoto's official tourism guidance distinguishes Halal, Muslim Friendly, Muslim Welcome, and Pork-Free rather than treating them as interchangeable.

## 21. Why facts can appear in both RAG and tables

This overlap is intentional.

Structured data answers:

> **What value/status should the calculator or validator use?**

RAG answers:

> **How should the LLM explain that fact and its conditions?**

For example, `supplement_yen` belongs in the fare table for arithmetic, while Nozomi RAG documents explain why the supplement exists.

---

# PART E — SOURCE REGISTRY

## 22. Role

`source_registry.json` is the audit layer connecting compact records to underlying evidence.

Instead of repeating long URLs and publisher details in every row, records use stable `source_id` values. The registry supplies:

- title
- publisher
- URL
- retrieval date
- source type
- caveats/notes

## 23. Source types and evidentiary status

The registry distinguishes types such as:

- `official`
- `official-tourism`
- `district-guide`
- `routing-estimate`
- `project-methodology`

This distinction is important. A SmartEX fare and a 10-minute same-area heuristic do not have equal evidentiary status even though both need source metadata.

---

# PART F — KNOWN LIMITATIONS

## 24. Fare limitations

The current table does not attempt to model all Japanese railways, subways, buses, IC-card fares, or every Shinkansen station pair.

It focuses on trustworthy golden-route coverage.

Known limitations:
- reserved-seat prices vary by season;
- discounted products are not modeled;
- not all Shinkansen combinations are included;
- regional-pass coverage may need more route-specific modeling as scope grows;
- Kyoto ↔ Shin-Osaka Nozomi is intentionally omitted under the current supplement requirement.

“All Japan public transportation fares” would be a separate large data-engineering project and is not necessary for the current evaluation.

## 25. Dietary limitations

The dietary table is not a complete Japan restaurant database. Venue/menu status can change, and halal, Muslim Friendly, and Pork-Free are not interchangeable.

## 26. Travel-time limitations

The travel-time table is for **plausibility validation**, not navigation. It does not replace Google Maps, NAVITIME, live timetables, or disruption information.

Cross-area values are estimates; same-area values are explicit project heuristics.

## 27. RAG limitations

The RAG corpus intentionally covers a small set of high-value travel rules. Its strengths are source quality, narrow relevance, clear keywords, dated evidence, and auditability.

New domains should be added deliberately rather than relying on unsupported model knowledge.

---

# PART G — MAINTENANCE CHECKLISTS

## 28. Before adding a fare

- [ ] Segment is required by the project.
- [ ] `service_type` is explicit.
- [ ] Fare basis matches the existing table.
- [ ] `price_yen` is reliably sourced.
- [ ] Nozomi/Mizuho has supported numeric `supplement_yen`.
- [ ] `source_id` and `source_date` exist.
- [ ] Source is registered.
- [ ] Reverse-direction convention is considered.
- [ ] No value was guessed merely to make a test pass.

## 29. Before adding a dietary venue

- [ ] Venue is relevant to an itinerary area.
- [ ] `ward` uses a canonical string.
- [ ] `tags` are supported by the source.
- [ ] Muslim-friendly terminology is interpreted conservatively.
- [ ] `source_id` and `source_date` exist.
- [ ] Source is registered.
- [ ] Venue information is reasonably current.

## 30. Before adding a travel-time pair

- [ ] Both areas are canonical.
- [ ] Only one symmetric pair is stored.
- [ ] Estimate is reasonable for validation.
- [ ] `mode` is clear.
- [ ] `source_id` and `source_date` exist.
- [ ] Evidence type is honestly represented.
- [ ] A new area's same-area row is also present.

## 31. Before adding a RAG document

- [ ] It answers an expected question.
- [ ] The topic is not better represented as structured data.
- [ ] Content is concise.
- [ ] Keywords are specific.
- [ ] Claims are source-supported.
- [ ] `source_id` and `source_date` exist.
- [ ] Source is registered.
- [ ] Numeric/time-sensitive claims are dated.
- [ ] Unsupported inference is avoided.

---

# PART H — PRE-COMMIT VALIDATION

## 32. Final data-quality checklist

### Fare table
- [ ] Every fare has all required fields.
- [ ] Every Nozomi/Mizuho row has numeric `supplement_yen`.
- [ ] No unresolved supplement is guessed.
- [ ] Fare basis is consistent.

### Dietary table
- [ ] Every row has `venue_name`, `ward`, `tags`, `source_id`, `source_date`.
- [ ] Every `ward` is canonical.
- [ ] Tags do not overstate evidence.

### Travel-time table
- [ ] Every row has all required fields.
- [ ] Every canonical area has a same-area row.
- [ ] Duplicate reverse pairs are avoided.
- [ ] Heuristics are identified as heuristics.

### RAG
- [ ] Every document has `document_id`, `title`, `keywords`, `content`, `source_id`, `source_date`.
- [ ] Source IDs resolve.
- [ ] Content is concise and grounded.

### Sources
- [ ] Every referenced source exists in `source_registry.json`.
- [ ] URLs are correct.
- [ ] Retrieval dates are present.
- [ ] Source types are accurate.

---

## 33. Files maintained by this package

```text
data/
├── fare_table.json
├── dietary_table.json
├── travel_time_table.json
├── source_registry.json
└── area_vocabulary.json

rag_corpus/
├── 01_visit_japan_web_overview.json
├── 02_customs_declaration.json
├── 03_visit_japan_web_scam_warning.json
├── 04_jr_pass_eligibility.json
├── 05_jr_pass_price.json
├── 06_nozomi_mizuho_with_jrpass.json
├── 07_nozomi_supplement_golden_route.json
├── 08_jr_pass_reserved_seats.json
├── 09_jr_pass_online_purchase_pickup.json
├── 10_kansai_hiroshima_price_duration.json
├── 11_kansai_hiroshima_coverage.json
├── 12_smartex_fare_basis.json
├── 13_smartex_ic_card_boarding.json
├── 14_smartex_qr_boarding.json
├── 15_muslim_travel_general.json
├── 16_tokyo_muslim_guide.json
└── 17_kyoto_halal_categories.json
```

## 34. Curation philosophy

The objective is not to maximize the number of rows or documents. It is to maximize **trustworthy coverage of the scenarios the project actually evaluates**.

Core rules:

1. Prefer official sources.
2. Date every trusted row/document.
3. Keep calculations deterministic.
4. Keep explanatory knowledge in RAG.
5. Use one consistent fare basis.
6. Treat `ward` as the project's canonical tourist-area label.
7. Include same-area travel-time rows.
8. Do not overstate halal/Muslim-friendly evidence.
9. Label internal heuristics honestly.
10. When evidence is missing, do not guess.

These rules support the project's financial-accuracy, constraint-adherence, geographic-plausibility, and faithfulness goals while keeping the dataset auditable by the group.
