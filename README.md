# Non Deterministic - osapiens Makeathon 2026

Deforestation detection submission for the osapiens Makeathon 2026 challenge.

## Result

Current best leaderboard result:

| Metric | Score |
| --- | ---: |
| Union IoU | 54.23% |
| Recall | 79.4% |
| False positive rate | 36.9% |
| Year error | 0.0% |

![Leaderboard result](TUM.ai_Makeathon_Non_Deterministic/public/leaderboard.png)

## Final Pipeline

Final notebook:

```text
final_aef_lgbm_xgb_submission.ipynb
```

The final path keeps only the parts that produced leaderboard value:

- build pseudo-ground-truth labels from RADD, GLAD-S2, and GLAD-L alerts
- extract all-year raw AEF features for 2020-2025
- train LightGBM and XGBoost tabular models
- predict test probabilities
- generate threshold submissions
- generate ensemble submissions
- save feature importance and run metadata

Main ensemble rule:

```text
LGB > 0.25 OR (XGB > 0.17 AND LGB > 0.10)
```

Old S1/S2 experiments, AEF PCA experiments, and debugging notebooks are not part of the final pipeline.

## UI / Agent

Project UI:

https://earth-view-monitor.lovable.app/

UI source:

```text
TUM.ai_Makeathon_Non_Deterministic/
```

The UI/Agent supports inspection and monitoring of detected deforestation regions.

## Authors

- Ahmed Elghobashy - ahmadsamir694@gmail.com
- Youssef Abdelaal - Youssef.e.amer@gmail.com
- Ahmed Maher
- Syrine
- Aaron
# Tum.ai-Makethon-Osapiens-Challenge-Non-determinstic
