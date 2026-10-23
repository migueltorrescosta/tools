"""Write the Information Pricing parity fixtures.

Builds both presets with the reference implementation at seed 2026 and 1,000
scenarios, then writes into src/lib/information-pricing/fixtures/:

- <preset>.inputs.csv: the random inputs, one row per scenario, full precision;
- <preset>.expected.json: the reference analysis of those scenarios.

Run by hand from the reference implementation's checkout (it is not a
dependency of this repo):

    cd ~/projects/migueltorrescosta/babslell && \
        uv run python ~/projects/migueltorrescosta/tools-ip/scripts/information-pricing-fixtures.py

then format the JSON from this repo: pnpm exec prettier --write src/lib/information-pricing/fixtures

The models mirror the two preset notebooks; random input names are the
preset symbols, so the fixtures line up with the TypeScript presets.
"""

from __future__ import annotations

import csv
import json
import math
import pathlib
from functools import partial

import numpy as np
import pandas as pd
from babslell import ExpectedOpportunityLoss
from babslell.eol import (
    InternalNode,
    _format_threshold,
    _graphviz_label,
    _unit_exponent,
    _unit_prefix,
)
from matplotlib import cbook
from scipy.stats import gaussian_kde

SEED = 2026
N = 1_000
BINS = list(range(2, 11))
GROUP_BINS = [3, 5, 10]
OUT = pathlib.Path(__file__).resolve().parent.parent / "src/lib/information-pricing/fixtures"


def distribution_centre() -> ExpectedOpportunityLoss:
    truck_capacity = 1000
    random_inputs = {
        "N": lambda n: np.random.binomial(n=10_000_000, p=0.001, size=n),
        "P": lambda n: np.random.exponential(scale=3.0, size=n),
        "C": lambda n: np.random.uniform(50.0, 500.0, size=n),
    }

    def reward_function(obs, number_of_trucks):
        packages_serviced = np.minimum(obs["N"], number_of_trucks * truck_capacity)
        fleet_cost = number_of_trucks * obs["C"]
        return packages_serviced * obs["P"] - fleet_cost

    return ExpectedOpportunityLoss(
        reward_functions={
            f"{t} trucks": partial(reward_function, number_of_trucks=t) for t in range(8, 13)
        },
        random_inputs=random_inputs,
        seed=SEED,
        monetary_unit="€",
    )


def airline_share_buyback() -> ExpectedOpportunityLoss:
    cash_balance = 950.0
    random_inputs = {
        "R": lambda n: np.random.lognormal(mean=np.log(1.4), sigma=0.35, size=n),
        "K": lambda n: np.random.lognormal(mean=np.log(350_000_000.0), sigma=0.20, size=n),
        "F": lambda n: np.random.uniform(1.5, 2.5, size=n),
        "Lr": lambda n: np.random.uniform(0.08, 0.16, size=n),
        "p": lambda n: np.random.uniform(1.5, 3.0, size=n),
        "i": lambda n: np.random.uniform(0.01, 0.03, size=n),
    }

    def intermediate_variables(row):
        operating_revenue = row["K"] * row["p"]
        fuel_bill = row["K"] * row["F"]
        return {"Rev": operating_revenue, "Fuel": fuel_bill, "Delta": operating_revenue - fuel_bill}

    def reward_function(obs, buyback_spend):
        share_value = buyback_spend * obs["R"]
        liquidity = cash_balance - buyback_spend + obs["Delta"] / 1e6
        liquidity_value = np.where(
            liquidity >= 0,
            liquidity * (1 + obs["i"]) ** 5,
            liquidity * (1 + obs["Lr"]) ** 5,
        )
        return share_value + liquidity_value

    return ExpectedOpportunityLoss(
        reward_functions={
            f"{b} M€": partial(reward_function, buyback_spend=b) for b in [0, 250, 500, 750, 1000]
        },
        random_inputs=random_inputs,
        seed=SEED,
        intermediate_variables=intermediate_variables,
        monetary_unit="M€",
    )


def finite(value: float) -> float | None:
    return float(value) if math.isfinite(value) else None


def node_record(node, tree, scale: float, root_samples: int, unit: str) -> dict:
    record = {
        "id": node.node_id,
        "depth": node.depth,
        "samples": node.samples,
        "risk": node.risk,
        "decision": node.decision,
        "outOfSampleLoss": finite(node.out_of_sample_loss),
        "statusQuoLoss": finite(node.status_quo_loss),
        "savings": finite(node.savings),
        "label": _graphviz_label(node, scale, root_samples, unit),
    }
    if isinstance(node, InternalNode):
        record.update(
            kind="internal",
            splitInput=node.split_input,
            thresholds=list(node.thresholds),
            thresholdLabels=[_format_threshold(t) for t in node.thresholds],
            children=list(node.children),
        )
    else:
        record.update(kind="leaf", inSampleLoss=node.in_sample_loss)
    return record


def expected(eol: ExpectedOpportunityLoss) -> dict:
    eol.generate_loss_summary()
    eol.evaluate_value_of_information(bins=BINS)
    inputs = list(eol.random_inputs)
    decisions = list(eol.decisions)
    voi = eol.value_of_information
    groups = {}
    for name in inputs:
        values = eol.data[name]
        groups[name] = {}
        for bins in GROUP_BINS:
            table = eol.optimal_decision_per_group(name, bins, detailed=True)
            _, edges = pd.qcut(values, q=bins, duplicates="drop", retbins=True)
            groups[name][str(bins)] = {
                "edges": [float(e) for e in edges],
                "labels": [str(v) for v in table[f"{name} Range"]],
                "optimal": [str(v) for v in table[f"Optimal Decision for {name}"]],
                "meanLoss": [[float(table[d][g]) for d in decisions] for g in range(len(table))],
            }
    distributions = {}
    for name in inputs:
        column = eol.data[name].to_numpy(dtype=float)
        kde = gaussian_kde(column)
        grid = np.linspace(column.min(), column.max(), 200)
        distributions[name] = {
            "deciles": [float(v) for v in np.quantile(column, np.linspace(0.1, 0.9, 9))],
            "bandwidth": float(np.sqrt(kde.covariance[0, 0])),
            "grid": [float(v) for v in grid],
            "density": [float(v) for v in kde(grid)],
        }
    losses = {}
    for decision in decisions:
        column = eol.data[decision + " Opportunity Loss"].to_numpy(dtype=float)
        stats = cbook.boxplot_stats(column, whis=(5.0, 95.0))[0]
        counts, edges = np.histogram(column, bins=100)
        losses[decision] = {
            "box": {
                key: float(stats[key]) for key in ("q1", "med", "q3", "whislo", "whishi", "mean")
            },
            "fliers": len(stats["fliers"]),
            "histogram": {"edges": [float(e) for e in edges], "counts": [int(c) for c in counts]},
        }
    tree = eol.build_policy_tree()
    max_savings = max((node.savings for node in tree.nodes), default=math.nan)
    exponent = _unit_exponent(max_savings)
    unit = _unit_prefix(exponent) + eol.monetary_unit
    root_samples = tree.nodes[0].samples
    return {
        "n": len(eol.data),
        "seed": SEED,
        "inputs": inputs,
        "decisions": decisions,
        "unit": eol.monetary_unit,
        "expectedLoss": [float(eol.loss_summary[d]["Expected Loss"]) for d in decisions],
        "unitExponent": eol.monetary_unit_exponent,
        "displayedUnit": eol.displayed_unit,
        "valueOfInformation": {
            "bins": BINS,
            "savings": [[float(voi.loc[name, str(b)]) for b in BINS] for name in inputs],
            "order": [str(name) for name in voi.index],
        },
        "groups": groups,
        "distributions": distributions,
        "losses": losses,
        "policyTree": {
            "expectedLoss": tree.expected_loss,
            "rootExpectedLoss": tree.root_expected_loss,
            "valueOfInformation": tree.value_of_information,
            "statusQuo": tree.status_quo_rate,
            "savingsExponent": exponent,
            "nodes": [
                node_record(node, tree, 10 ** (3 * exponent), root_samples, unit)
                for node in tree.nodes
            ],
            "text": str(tree),
        },
    }


def write(name: str, eol: ExpectedOpportunityLoss) -> None:
    eol.add_scenarios(N)
    inputs = list(eol.random_inputs)
    with (OUT / f"{name}.inputs.csv").open("w", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(inputs)
        columns = [eol.data[c].to_numpy(dtype=float) for c in inputs]
        for row in zip(*columns, strict=True):
            writer.writerow([repr(float(v)) for v in row])
    with (OUT / f"{name}.expected.json").open("w") as handle:
        json.dump(expected(eol), handle, ensure_ascii=False, indent=1)
        handle.write("\n")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    write("distribution-centre", distribution_centre())
    write("airline-share-buyback", airline_share_buyback())
