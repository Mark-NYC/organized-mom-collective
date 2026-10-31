# Import only the numbered split CSVs

The original `../pinterest-import-nov03-07-2026.csv` is retained as historical source and is superseded for upload by these three files. All scheduled dates and times and all 18 source rows are preserved.

- Part 1: pins 19, 25, 31, 22, 28, 34.
- Part 2: pins 20, 26, 32, 23, 29, 35.
- Part 3: pins 21, 27, 33, 24, 30, 36.

Each file has six unique destination URLs. Titles and media URLs are unique across the entire batch. Exact source-row, media, destination and timestamp membership is in `OMC_Pins_19-36_Batch_Record.json`.

These files are prepared, not confirmed scheduled or published. If any source pins already imported successfully, reconcile those pins before retrying. Do not import both original and split versions.
