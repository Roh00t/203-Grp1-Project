# Ulfa — Fare Table + RAG Corpus Curation

Retrieved/curated: 2026-09-05

## What changed from the current repository

1. Standardized the fare basis to **SmartEX regular-season, adult, one-way, Ordinary Car reserved seat**.
2. Corrected Tokyo→Kyoto Hikari from ¥13,970 to **¥13,650**.
3. Corrected Kyoto→Shin-Osaka Hikari from ¥1,450 to **¥2,670**.
4. Corrected Shin-Osaka→Hiroshima Sakura from ¥9,710 to **¥10,220** on this reserved-seat basis.
5. Corrected Shin-Osaka→Hiroshima Nozomi from ¥9,890 to **¥10,750** on this reserved-seat basis.
6. Added the officially sourced JR Pass Nozomi supplement **¥4,170** for Shin-Osaka↔Hiroshima.
7. Kept Tokyo↔Kyoto Nozomi supplement at the official **¥4,960**.
8. Intentionally omitted Kyoto↔Shin-Osaka Nozomi from executable fare rows because the official JAPAN RAIL PASS special-ticket matrix shows a dash for that pair. The normal SmartEX Nozomi reserved fare is ¥2,880, but the current calculator requires a numeric JR Pass supplement for every Nozomi row, so adding it would force an invented value.
9. Replaced third-party fare/pass sourcing with official JR/SmartEX sources.
10. Corrected the October 2026 JR Pass note: ¥53,000 applies to **overseas Exchange Orders purchased on/after 2026-10-01**. The official online table still shows ¥50,000 for the 7-day Ordinary pass.

## Important architecture note

The calculator currently accepts one fixed `price_yen`, but SmartEX reserved-seat fares vary by travel season.
For the controlled assignment evaluation, this package uses regular-season fares consistently.
If the group wants date-specific production fares later, Rohit's calculator should be extended to select the correct seasonal adjustment from the travel date rather than silently treating this table as universal.

## RAG corpus

17 focused JSON documents are included. Each record contains:
- `document_id`
- `title`
- `keywords`
- `content`
- `source_id`
- `source_date`

`data/source_registry.json` resolves every `source_id` to an official URL and retrieval date.

## Suggested commit

```bash
git add data/fare_table.json data/source_registry.json rag_corpus/
git commit -m "Curate official fare table and dated RAG corpus"
git push
```
