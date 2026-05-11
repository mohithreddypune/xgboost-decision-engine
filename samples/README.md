# Sample upload files

Drag any of these onto the **Analyzer** page (`http://localhost:4200/upload`) to test the Document Fraud Analyzer.

| File | What it tests | Expected verdict |
|------|---------------|------------------|
| `sample_clean.csv`           | 30 normal-looking transactions     | **CLEAN** — almost all APPROVE |
| `sample_suspicious.csv`      | Mix of normal + ~40% risky rows    | **SUSPICIOUS** — split between APPROVE / FLAG / BLOCK |
| `sample_fraudulent.csv`      | 20 mostly-fraud transactions       | **FRAUDULENT** — most rows BLOCK |
| `sample_with_anomalies.csv`  | Duplicate transaction IDs, repeated amounts, round-number bias | **SUSPICIOUS** + meta-anomalies fired |
| `sample_transactions.json`   | JSON format with mixed risk        | **SUSPICIOUS** (model picks out fraud rows) |
| `sample_invalid.csv`         | Wrong schema (no required columns) | **INVALID** — file rejected |

## What each file demonstrates

### sample_clean.csv
All transactions hit the safe zone:
- Small amounts ($12-$200)
- Daytime hours (9 AM - 6 PM)
- Low device-risk scores (0.04-0.16)
- Normal user behavior (z-score near 0)
- Short geo distances (under 6 km)

The model should score every row well below 0.20 → **APPROVE**.

### sample_suspicious.csv
Mixes 60% clean rows with 40% rows showing 1-2 fraud signals (high amount, late hour, elevated device-risk). Each suspicious row hits the STEP_UP/FLAG/BLOCK range.

### sample_fraudulent.csv
Almost every row hits the textbook fraud profile: large amount + risky merchant category 13 + late-night hour + high txn_count_1h + high amount z-score + high device-risk + large geo distance. The model should BLOCK most of them. The risk ratio crosses 20% → **FRAUDULENT** verdict.

### sample_with_anomalies.csv
This file's individual scores are mild — but it triggers the **meta-anomaly detector**:
- `duplicate_transaction_id` — `DUP001` and `DUP002` repeat 3 times each
- `repeated_amount_clusters` — $100 appears 6 times, $500 appears 5 times
- `round_number_bias` — every amount is a clean $50 multiple

In a real fraud workflow these patterns scream "synthetic / scripted data."

### sample_transactions.json
Same data structure but in JSON — proves the parser handles multiple formats. The wrapper object is `{"transactions": [...]}`. A bare top-level array also works.

### sample_invalid.csv
Doesn't have any of the required transaction columns. The validator should reject it with a clear error message before even attempting to score.

## How to download the report

After any successful analysis, click **PDF report** on the verdict ribbon to download a one-page styled PDF showing the verdict, action breakdown, summary, anomalies, and top suspicious rows.
