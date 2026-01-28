# ROI Formula Specification v1.0

**Document Status:** Draft - Awaiting Stakeholder Sign-off
**Last Updated:** 2026-01-28
**Author:** YardFlow Engineering

---

## Overview

This document specifies the deterministic formulas used in YardFlow's ROI calculators. All arithmetic is performed client-side with no AI involvement to ensure reproducibility and auditability.

---

## Calculator 1: Quick Win (Baseline Savings)

Calculates immediate, tangible savings from YardFlow implementation at a single facility.

### Input Variables

| Variable | Type | Unit | Range | Default | Description |
|----------|------|------|-------|---------|-------------|
| `facilitiesCount` | number | count | 1-500 | 1 | Number of facilities |
| `shipmentsPerMonth` | number | count | 0-1,000,000 | 10,000 | Monthly inbound/outbound shipments |
| `avgDwellTimeMinutes` | number | minutes | 0-480 | 45 | Average trailer dwell time in yard |
| `detentionRatePercent` | number | % | 0-20 | 2 | Percentage of shipments incurring detention |
| `avgDetentionCost` | number | USD | 0-1000 | 150 | Average cost per detention incident |
| `hourlyLaborRate` | number | USD/hr | 10-100 | 25 | Loaded labor cost for yard operations |
| `palletsPerMonth` | number | count | 0-10,000,000 | 50,000 | Monthly pallet volume (for paper savings) |

### Formulas

#### 1. Paper Savings (Digitization)
Eliminates paper-based check-in/check-out, BOL handling, and manual logging.

```
paperSavingsMonthly = palletsPerMonth × $0.50
paperSavingsAnnual = paperSavingsMonthly × 12
```

**Rationale:** Industry benchmark of $0.50 per pallet for paper handling, filing, and retrieval costs.

#### 2. Labor Savings (Process Efficiency)
Reduces manual coordination, radio calls, and yard checks through system-driven assignment.

```
minutesSavedPerShipment = 2  // Conservative estimate
laborSavingsMonthly = shipmentsPerMonth × minutesSavedPerShipment × (hourlyLaborRate / 60)
laborSavingsAnnual = laborSavingsMonthly × 12
```

**Rationale:** Bottom-quartile facilities waste ~5 min/shipment; YardFlow recovers at least 2 min through automated dock assignment and driver notification.

#### 3. Detention Savings (Carrier Cost Avoidance)
Reduces detention charges through better visibility and proactive alerts.

```
detentionReductionPercent = 50%  // YardFlow typically halves detention events
currentDetentionCostMonthly = shipmentsPerMonth × (detentionRatePercent / 100) × avgDetentionCost
detentionSavingsMonthly = currentDetentionCostMonthly × detentionReductionPercent
detentionSavingsAnnual = detentionSavingsMonthly × 12
```

**Rationale:** Improved visibility and automated alerts catch delays before they become detention events.

#### 4. Total Quick Win Savings

```
totalMonthly = paperSavingsMonthly + laborSavingsMonthly + detentionSavingsMonthly
totalAnnual = totalMonthly × 12
```

### Example Calculation

**Inputs:**
- Facilities: 1
- Shipments/month: 10,000
- Avg dwell: 45 min
- Detention rate: 2%
- Detention cost: $150
- Labor rate: $25/hr
- Pallets/month: 50,000

**Outputs:**
- Paper: 50,000 × $0.50 = $25,000/mo = **$300,000/yr**
- Labor: 10,000 × 2 × ($25/60) = $8,333/mo = **$100,000/yr**
- Detention: 10,000 × 2% × $150 × 50% = $15,000/mo = **$180,000/yr**
- **Total: ~$580,000/yr**

---

## Calculator 2: Network Effects (Multi-Facility Adoption)

Calculates incremental value from standardizing YardFlow across multiple facilities.

### Input Variables

| Variable | Type | Unit | Range | Default | Description |
|----------|------|------|-------|---------|-------------|
| `facilityCount` | number | count | 1-500 | 5 | Number of facilities on YardFlow |
| `baseValuePerFacility` | number | USD/yr | 0-10,000,000 | 100,000 | Quick Win value per facility |
| `shipmentVolume` | number | count/mo | 0-10,000,000 | 100,000 | Total monthly shipments across network |
| `slowDriverPercent` | number | % | 0-50 | 10 | Percent of drivers in bottom quartile |
| `avgDelayMinutes` | number | minutes | 0-60 | 5 | Avg extra time wasted by slow drivers |
| `latePickupRatePercent` | number | % | 0-10 | 2 | Percent of shipments with late pickup |
| `avgLateFee` | number | USD | 0-2000 | 500 | Average penalty for late pickup |

### Formulas

#### 1. Network Multiplier (Logarithmic Scale)
Value increases with facility count due to shared learning, carrier benchmarking, and standardization.

```
networkMultiplier = 1 + (ln(facilityCount) / 10)
```

**Multiplier Examples:**
- 1 facility: 1.00x
- 5 facilities: 1.16x
- 10 facilities: 1.23x
- 25 facilities: 1.32x
- 100 facilities: 1.46x
- 260 facilities: 1.56x (Primo Brands scale)

#### 2. Marginal Network Value

```
marginalValue = baseValuePerFacility × facilityCount × networkMultiplier
```

**Rationale:** The multiplier represents value from:
- Standard data model → historical benchmarking
- Standard support → fewer internal FTEs per facility
- Standard protocols → drivers learn one flow

#### 3. Carrier Benchmark Savings
Identifies and addresses bottom-quartile carrier/driver performance.

```
slowDriverShipments = shipmentVolume × (slowDriverPercent / 100)
wastedMinutes = slowDriverShipments × avgDelayMinutes
carrierBenchmarkSavingsMonthly = wastedMinutes × ($25 / 60)  // Using standard labor rate
carrierBenchmarkSavingsAnnual = carrierBenchmarkSavingsMonthly × 12
```

**Rationale:** Bottom quartile wastes ~5 min/shipment; visibility enables carrier scorecards and improvement.

#### 4. Avoidable Fines (Late Pickup Fees)

```
latePickupEvents = shipmentVolume × (latePickupRatePercent / 100)
avoidableFinesMonthly = latePickupEvents × avgLateFee × 0.5  // 50% reduction
avoidableFinesAnnual = avoidableFinesMonthly × 12
```

**Rationale:** Proactive alerts and coordination reduce late pickups by ~50%.

#### 5. Total Network Effects Value

```
totalNetworkValueAnnual = marginalValue + carrierBenchmarkSavingsAnnual + avoidableFinesAnnual
```

### Example Calculation (Primo Brands Scale)

**Inputs:**
- Facilities: 25
- Base value/facility: $100,000/yr (Quick Win per facility)
- Shipments/month: 500,000 (across network)
- Slow drivers: 10%
- Avg delay: 5 min
- Late pickup rate: 2%
- Avg late fee: $500

**Outputs:**
- Network multiplier: 1 + ln(25)/10 = 1.32
- Marginal value: $100K × 25 × 1.32 = **$3,300,000/yr**
- Carrier benchmark: 500K × 10% × 5 × ($25/60) × 12 = **$1,250,000/yr**
- Avoidable fines: 500K × 2% × $500 × 0.5 × 12 = **$30,000,000/yr**
- **Total Network Value: ~$34,550,000/yr**

---

## Payback Period Calculation

```
implementationCost = facilitiesCount × $50,000  // Approximate implementation cost
paybackMonths = implementationCost / (totalAnnual / 12)
```

---

## Approved Proof Points

These are the ONLY customer claims that may be used in generated content:

| Claim ID | Customer | Claim | Source | Verified |
|----------|----------|-------|--------|----------|
| PP-001 | Primo Brands | "$1M+ contribution margin across 25 facilities" | Jake (internal) | 2026-01 |
| PP-002 | Primo Brands | "Rolling to 260 facilities" | Jake (internal) | 2026-01 |
| PP-003 | Benchmark | "Bottom quartile wastes ~5 min/shipment" | Industry analysis | 2026-01 |
| PP-004 | Benchmark | "Late pickup fees $500/shipment in ~2% of cases" | Carrier data | 2026-01 |
| PP-005 | Benchmark | "Paper handling costs ~$0.50/pallet" | Industry analysis | 2026-01 |

---

## Constraints & Guardrails

1. **No AI for arithmetic** - All calculations use deterministic JavaScript math
2. **Inputs are bounded** - Min/max ranges prevent unrealistic scenarios
3. **Conservative defaults** - Default values represent median customer, not best case
4. **Reduction percentages are fixed** - No user input for improvement rates (hardcoded at 50%)
5. **Proof points are allowlisted** - Only approved claims can appear in generated content

---

## Stakeholder Sign-off

- [ ] Jake (YardFlow) - Formulas reviewed and approved
- [ ] Engineering - Implementation matches specification
- [ ] QA - Test cases cover all edge cases

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-28 | Engineering | Initial specification |
