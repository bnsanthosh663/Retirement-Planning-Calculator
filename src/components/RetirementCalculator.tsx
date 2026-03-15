"use client";

import { useState, useCallback, useMemo, useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Inputs {
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  currentAnnualExpenses: number;
  inflationRate: number;
  preRetirementReturn: number;
  postRetirementReturn: number;
  existingCorpus: number;
}

interface Results {
  yearsToRetirement: number;
  retirementDuration: number;
  retirementAnnualExpense: number;
  retirementCorpus: number;
  requiredSIP: number;
  totalInvested: number;
  wealthGained: number;
  corpusFromExisting: number;
  additionalCorpusNeeded: number;
  yearlyProjection: YearlyData[];
}

interface YearlyData {
  age: number;
  corpus: number;
  invested: number;
  label: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HDFC_BLUE = "#224c87";
const HDFC_RED = "#da3832";
const HDFC_GREY = "#919090";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_00_00_000) {
    return `₹${(value / 1_00_00_000).toFixed(2)} Cr`;
  } else if (value >= 1_00_000) {
    return `₹${(value / 1_00_000).toFixed(2)} L`;
  } else if (value >= 1_000) {
    return `₹${(value / 1_000).toFixed(1)}K`;
  }
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatCurrencyFull(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// ─── Calculation Engine ───────────────────────────────────────────────────────

function calculate(inputs: Inputs): Results {
  const {
    currentAge,
    retirementAge,
    lifeExpectancy,
    currentAnnualExpenses,
    inflationRate,
    preRetirementReturn,
    postRetirementReturn,
    existingCorpus,
  } = inputs;

  const yearsToRetirement = retirementAge - currentAge;
  const retirementDuration = lifeExpectancy - retirementAge;

  // Step 1: Inflate annual expenses to retirement
  const retirementAnnualExpense =
    currentAnnualExpenses * Math.pow(1 + inflationRate / 100, yearsToRetirement);

  // Step 2: Retirement corpus using PV of annuity
  const r = postRetirementReturn / 100;
  const t = retirementDuration;
  let retirementCorpus: number;
  if (r === 0) {
    retirementCorpus = retirementAnnualExpense * t;
  } else {
    retirementCorpus =
      retirementAnnualExpense * ((1 - Math.pow(1 + r, -t)) / r);
  }

  // Step 3: Corpus from existing savings
  const corpusFromExisting =
    existingCorpus * Math.pow(1 + preRetirementReturn / 100, yearsToRetirement);

  const additionalCorpusNeeded = Math.max(0, retirementCorpus - corpusFromExisting);

  // Step 4: Required monthly SIP
  const monthlyRate = preRetirementReturn / 100 / 12;
  const n = yearsToRetirement * 12;
  let requiredSIP: number;
  if (monthlyRate === 0) {
    requiredSIP = additionalCorpusNeeded / n;
  } else {
    requiredSIP =
      (additionalCorpusNeeded * monthlyRate) /
      (((Math.pow(1 + monthlyRate, n) - 1) * (1 + monthlyRate)));
  }

  const totalInvested = requiredSIP * n;
  const wealthGained = additionalCorpusNeeded - totalInvested;

  // Yearly projection data
  const yearlyProjection: YearlyData[] = [];
  let runningCorpus = existingCorpus;
  let runningInvested = existingCorpus;

  for (let y = 0; y <= yearsToRetirement; y++) {
    const age = currentAge + y;
    yearlyProjection.push({
      age,
      corpus: Math.round(runningCorpus),
      invested: Math.round(runningInvested),
      label: `Age ${age}`,
    });
    if (y < yearsToRetirement) {
      // Grow existing corpus
      runningCorpus =
        runningCorpus * (1 + preRetirementReturn / 100) +
        requiredSIP * 12 * (1 + preRetirementReturn / 100 / 2); // approx mid-year
      runningInvested += requiredSIP * 12;
    }
  }

  // Post-retirement drawdown
  let postCorpus = retirementCorpus;
  for (let y = 1; y <= retirementDuration; y++) {
    const age = retirementAge + y;
    postCorpus =
      postCorpus * (1 + postRetirementReturn / 100) - retirementAnnualExpense;
    yearlyProjection.push({
      age,
      corpus: Math.round(Math.max(0, postCorpus)),
      invested: 0,
      label: `Age ${age}`,
    });
  }

  return {
    yearsToRetirement,
    retirementDuration,
    retirementAnnualExpense,
    retirementCorpus,
    requiredSIP,
    totalInvested,
    wealthGained,
    corpusFromExisting,
    additionalCorpusNeeded,
    yearlyProjection,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SliderInputProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  prefix?: string;
  onChange: (v: number) => void;
  hint?: string;
  formatDisplay?: (v: number) => string;
}

function SliderInput({
  id,
  label,
  value,
  min,
  max,
  step,
  unit = "",
  prefix = "",
  onChange,
  hint,
  formatDisplay,
}: SliderInputProps) {
  const [inputVal, setInputVal] = useState(String(value));
  const [focused, setFocused] = useState(false);

  const display = formatDisplay ? formatDisplay(value) : `${prefix}${value.toLocaleString("en-IN")}${unit}`;

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    onChange(v);
    setInputVal(String(v));
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);
  };

  const handleTextBlur = () => {
    setFocused(false);
    const parsed = parseFloat(inputVal.replace(/,/g, ""));
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
      setInputVal(String(clamped));
    } else {
      setInputVal(String(value));
    }
  };

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-1">
        <label
          htmlFor={id}
          className="text-sm font-600 text-gray-700"
          style={{ fontWeight: 600 }}
        >
          {label}
          {hint && (
            <span className="tooltip ml-1" aria-label={hint}>
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs cursor-help"
                style={{ background: HDFC_GREY, color: "white", fontSize: "10px" }}
                tabIndex={0}
                role="img"
                aria-label={`Info: ${hint}`}
              >
                i
              </span>
              <span className="tooltip-text" role="tooltip">{hint}</span>
            </span>
          )}
        </label>
        <div className="flex items-center gap-1">
          {prefix && <span className="text-sm font-semibold" style={{ color: HDFC_BLUE }}>{prefix}</span>}
          <input
            type="text"
            value={focused ? inputVal : display.replace(prefix, "").replace(unit, "")}
            onChange={handleTextChange}
            onFocus={() => { setFocused(true); setInputVal(String(value)); }}
            onBlur={handleTextBlur}
            aria-label={`${label} value`}
            className="w-28 text-right text-sm font-bold px-2 py-1 rounded border focus:outline-none"
            style={{
              borderColor: HDFC_BLUE,
              color: HDFC_BLUE,
              fontFamily: "Montserrat, Arial, sans-serif",
            }}
          />
          {unit && <span className="text-sm font-semibold" style={{ color: HDFC_BLUE }}>{unit}</span>}
        </div>
      </div>
      <div className="relative">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSlider}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={display}
          className="w-full"
          style={{
            background: `linear-gradient(to right, ${HDFC_BLUE} ${pct}%, #e0e0e0 ${pct}%)`,
          }}
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: HDFC_GREY }}>
          <span>{prefix}{min.toLocaleString("en-IN")}{unit}</span>
          <span>{prefix}{max.toLocaleString("en-IN")}{unit}</span>
        </div>
      </div>
    </div>
  );
}

interface ResultCardProps {
  label: string;
  value: string;
  highlight?: boolean;
  sub?: string;
}

function ResultCard({ label, value, highlight, sub }: ResultCardProps) {
  return (
    <div
      className="rounded-container p-4 flex flex-col gap-1"
      style={{
        background: highlight ? HDFC_BLUE : "white",
        color: highlight ? "white" : "#1a1a1a",
        border: highlight ? "none" : `1px solid #e0e0e0`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      }}
      role="region"
      aria-label={label}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: highlight ? "rgba(255,255,255,0.8)" : HDFC_GREY }}
      >
        {label}
      </p>
      <p
        className="text-xl font-bold leading-tight"
        style={{ color: highlight ? "white" : HDFC_BLUE }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-xs" style={{ color: highlight ? "rgba(255,255,255,0.7)" : HDFC_GREY }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomChartTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div
        className="rounded-container p-3 text-sm shadow-lg"
        style={{ background: "white", border: `1px solid ${HDFC_BLUE}`, fontFamily: "Montserrat, Arial" }}
        role="tooltip"
      >
        <p className="font-bold mb-1" style={{ color: HDFC_BLUE }}>{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} style={{ color: entry.color }}>
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const DEFAULT_INPUTS: Inputs = {
  currentAge: 30,
  retirementAge: 60,
  lifeExpectancy: 85,
  currentAnnualExpenses: 600000,
  inflationRate: 6,
  preRetirementReturn: 12,
  postRetirementReturn: 7,
  existingCorpus: 0,
};

export default function RetirementCalculator() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULT_INPUTS);
  const [activeTab, setActiveTab] = useState<"chart" | "breakdown">("chart");

  const set = useCallback(
    (key: keyof Inputs) => (value: number) =>
      setInputs((prev) => ({ ...prev, [key]: value })),
    []
  );

  const results = useMemo(() => calculate(inputs), [inputs]);

  const pieData = [
    { name: "Total Invested", value: Math.round(results.totalInvested) },
    { name: "Wealth Gained", value: Math.round(Math.max(0, results.wealthGained)) },
    ...(inputs.existingCorpus > 0
      ? [{ name: "Existing Corpus Growth", value: Math.round(results.corpusFromExisting) }]
      : []),
  ];

  const PIE_COLORS = [HDFC_RED, HDFC_BLUE, "#5b8dd9"];

  const accumulationData = results.yearlyProjection.filter(
    (d) => d.age <= inputs.retirementAge
  );
  const drawdownData = results.yearlyProjection.filter(
    (d) => d.age >= inputs.retirementAge
  );

  const idPrefix = useId();

  return (
    <div
      className="min-h-screen"
      style={{ background: "#f0f4fa", fontFamily: "Montserrat, Arial, Verdana, sans-serif" }}
    >
      {/* ── Header ── */}
      <header
        role="banner"
        className="w-full py-4 px-6 flex items-center justify-between shadow-sm"
        style={{ background: HDFC_BLUE }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded font-black text-white text-lg px-3 py-1"
            style={{ background: HDFC_RED, letterSpacing: "0.05em" }}
            aria-label="HDFC Mutual Fund"
          >
            ||-||
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Retirement Planning Calculator</p>
            <p className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.7)" }}>
            </p>
          </div>
        </div>
        <span
          className="text-white text-xs font-semibold hidden sm:block"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >        
        </span>
      </header>

      <main id="main-content" role="main" className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left Panel: Inputs ── */}
          <section
            aria-labelledby="inputs-heading"
            className="lg:col-span-2 rounded-container p-6 shadow"
            style={{ background: "white" }}
          >
            <h2
              id="inputs-heading"
              className="text-base font-bold mb-5 pb-2 border-b"
              style={{ color: HDFC_BLUE, borderColor: "#e0e0e0" }}
            >
              Your Details
            </h2>

            <fieldset className="border-0 p-0 m-0">
              <legend className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: HDFC_RED }}>
                Age &amp; Timeline
              </legend>

              <SliderInput
                id={`${idPrefix}-currentAge`}
                label="Current Age"
                value={inputs.currentAge}
                min={18}
                max={55}
                step={1}
                unit=" yrs"
                onChange={set("currentAge")}
              />
              <SliderInput
                id={`${idPrefix}-retirementAge`}
                label="Retirement Age"
                value={inputs.retirementAge}
                min={inputs.currentAge + 5}
                max={70}
                step={1}
                unit=" yrs"
                onChange={(v) => {
                  set("retirementAge")(v);
                  if (v >= inputs.lifeExpectancy) {
                    set("lifeExpectancy")(v + 10);
                  }
                }}
              />
              <SliderInput
                id={`${idPrefix}-lifeExpectancy`}
                label="Life Expectancy"
                value={inputs.lifeExpectancy}
                min={inputs.retirementAge + 5}
                max={100}
                step={1}
                unit=" yrs"
                onChange={set("lifeExpectancy")}
                hint="Expected age until which retirement corpus should last"
              />
            </fieldset>

            <fieldset className="border-0 p-0 m-0 mt-5">
              <legend className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: HDFC_RED }}>
                Expenses &amp; Savings
              </legend>

              <SliderInput
                id={`${idPrefix}-expenses`}
                label="Current Annual Expenses"
                value={inputs.currentAnnualExpenses}
                min={100000}
                max={5000000}
                step={50000}
                prefix="₹"
                onChange={set("currentAnnualExpenses")}
                hint="Your total annual household expenses today"
                formatDisplay={(v) => formatCurrency(v)}
              />
              <SliderInput
                id={`${idPrefix}-existingCorpus`}
                label="Existing Retirement Savings"
                value={inputs.existingCorpus}
                min={0}
                max={10000000}
                step={100000}
                prefix="₹"
                onChange={set("existingCorpus")}
                hint="Current savings/investments earmarked for retirement"
                formatDisplay={(v) => formatCurrency(v)}
              />
            </fieldset>

            <fieldset className="border-0 p-0 m-0 mt-5">
              <legend className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: HDFC_RED }}>
                Assumptions (Editable)
              </legend>

              <SliderInput
                id={`${idPrefix}-inflation`}
                label="Inflation Rate"
                value={inputs.inflationRate}
                min={2}
                max={12}
                step={0.5}
                unit="%"
                onChange={set("inflationRate")}
                hint="Expected average annual inflation rate"
              />
              <SliderInput
                id={`${idPrefix}-preReturn`}
                label="Pre-Retirement Return"
                value={inputs.preRetirementReturn}
                min={4}
                max={18}
                step={0.5}
                unit="%"
                onChange={set("preRetirementReturn")}
                hint="Expected annual return on investments before retirement"
              />
              <SliderInput
                id={`${idPrefix}-postReturn`}
                label="Post-Retirement Return"
                value={inputs.postRetirementReturn}
                min={2}
                max={12}
                step={0.5}
                unit="%"
                onChange={set("postRetirementReturn")}
                hint="Expected annual return on corpus after retirement (typically lower, debt-oriented)"
              />
            </fieldset>

            {/* Assumptions disclosure */}
            <div
              className="mt-5 p-3 rounded text-xs"
              style={{ background: "#f0f4fa", color: HDFC_GREY, lineHeight: "1.6" }}
              role="note"
              aria-label="Assumptions disclosure"
            >
              <strong style={{ color: HDFC_BLUE }}>Assumptions:</strong> Returns are assumed
              constant. Inflation is applied uniformly. Corpus is assumed to be fully
              depleted at life expectancy. All figures are illustrative only.
            </div>
          </section>

          {/* ── Right Panel: Results ── */}
          <section
            aria-labelledby="results-heading"
            className="lg:col-span-3 flex flex-col gap-5"
          >
            {/* Summary Cards */}
            <div>
              <h2
                id="results-heading"
                className="text-base font-bold mb-4"
                style={{ color: HDFC_BLUE }}
              >
                Your Retirement Summary
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 results-grid">
                <ResultCard
                  label="Required Corpus"
                  value={formatCurrency(results.retirementCorpus)}
                  highlight
                  sub={`At age ${inputs.retirementAge}`}
                />
                <ResultCard
                  label="Monthly SIP Needed"
                  value={formatCurrency(results.requiredSIP)}
                  highlight
                  sub={`For ${results.yearsToRetirement} years`}
                />
                <ResultCard
                  label="Retirement Expense"
                  value={formatCurrency(results.retirementAnnualExpense)}
                  sub="Annual (inflation-adjusted)"
                />
                <ResultCard
                  label="Total Invested"
                  value={formatCurrency(results.totalInvested)}
                  sub="Via SIP contributions"
                />
                <ResultCard
                  label="Wealth Gained"
                  value={formatCurrency(Math.max(0, results.wealthGained))}
                  sub="Power of compounding"
                />
                <ResultCard
                  label="Retirement Duration"
                  value={`${results.retirementDuration} yrs`}
                  sub={`Age ${inputs.retirementAge}–${inputs.lifeExpectancy}`}
                />
              </div>
            </div>

            {/* Tabs */}
            <div
              className="rounded-container shadow overflow-hidden"
              style={{ background: "white" }}
            >
              <div
                className="flex border-b"
                role="tablist"
                aria-label="Results view"
                style={{ borderColor: "#e0e0e0" }}
              >
                {(["chart", "breakdown"] as const).map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={activeTab === tab}
                    aria-controls={`panel-${tab}`}
                    id={`tab-${tab}`}
                    onClick={() => setActiveTab(tab)}
                    className="flex-1 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2"
                    style={{
                      background: activeTab === tab ? HDFC_BLUE : "transparent",
                      color: activeTab === tab ? "white" : HDFC_GREY,
                      borderBottom: activeTab === tab ? `3px solid ${HDFC_RED}` : "3px solid transparent",
                    }}
                  >
                    {tab === "chart" ? "📈 Corpus Growth" : "🥧 Breakdown"}
                  </button>
                ))}
              </div>

              {/* Chart Tab */}
              <div
                id="panel-chart"
                role="tabpanel"
                aria-labelledby="tab-chart"
                hidden={activeTab !== "chart"}
                className="p-4"
              >
                <h3 className="text-sm font-bold mb-1" style={{ color: HDFC_BLUE }}>
                  Corpus Accumulation &amp; Drawdown
                </h3>
                <p className="text-xs mb-4" style={{ color: HDFC_GREY }}>
                  Illustrative projection — not a guarantee of returns
                </p>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={results.yearlyProjection}
                    margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                  >
                    <defs>
                      <linearGradient id="corpusGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={HDFC_BLUE} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={HDFC_BLUE} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={HDFC_RED} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={HDFC_RED} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="age"
                      tickFormatter={(v) => `${v}`}
                      tick={{ fontSize: 11, fontFamily: "Montserrat, Arial" }}
                      label={{ value: "Age (years)", position: "insideBottom", offset: -2, fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCurrency(v)}
                      tick={{ fontSize: 10, fontFamily: "Montserrat, Arial" }}
                      width={70}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "12px", fontFamily: "Montserrat, Arial" }}
                    />
                    {/* Retirement age reference line */}
                    <Area
                      type="monotone"
                      dataKey="invested"
                      name="Amount Invested"
                      stroke={HDFC_RED}
                      fill="url(#investedGrad)"
                      strokeWidth={2}
                      dot={false}
                    /> <br /><br />
                    <Area
                      type="monotone"
                      dataKey="corpus"
                      name="Projected Corpus"
                      stroke={HDFC_BLUE}
                      fill="url(#corpusGrad)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-xs text-center mt-2" style={{ color: HDFC_GREY }}>
                  Vertical drop at age {inputs.retirementAge} represents retirement drawdown phase
                </p>
              </div>

              {/* Breakdown Tab */}
              <div
                id="panel-breakdown"
                role="tabpanel"
                aria-labelledby="tab-breakdown"
                hidden={activeTab !== "breakdown"}
                className="p-4"
              >
                <h3 className="text-sm font-bold mb-1" style={{ color: HDFC_BLUE }}>
                  Corpus Composition
                </h3>
                <p className="text-xs mb-4" style={{ color: HDFC_GREY }}>
                  How your retirement corpus is built up
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        aria-label="Corpus composition pie chart"
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrencyFull(Number(value))}
                        contentStyle={{ fontFamily: "Montserrat, Arial", fontSize: "12px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-3 min-w-[180px]">
                    {pieData.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                          style={{ background: PIE_COLORS[i] }}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>
                            {item.name}
                          </p>
                          <p className="text-sm font-bold" style={{ color: PIE_COLORS[i] }}>
                            {formatCurrencyFull(item.value)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step-by-step breakdown */}
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide" style={{ color: HDFC_BLUE }}>
                    Calculation Steps
                  </h4>
                  {[
                    {
                      step: "1",
                      label: "Inflation-Adjusted Annual Expense at Retirement",
                      value: formatCurrencyFull(results.retirementAnnualExpense),
                      formula: `₹${(inputs.currentAnnualExpenses / 100000).toFixed(1)}L × (1 + ${inputs.inflationRate}%)^${results.yearsToRetirement}`,
                    },
                    {
                      step: "2",
                      label: "Required Retirement Corpus (PV of Annuity)",
                      value: formatCurrencyFull(results.retirementCorpus),
                      formula: `Annual Expense × [(1 − (1+r)^−${results.retirementDuration}) ÷ r]`,
                    },
                    {
                      step: "3",
                      label: "Corpus from Existing Savings",
                      value: formatCurrencyFull(results.corpusFromExisting),
                      formula: `${formatCurrency(inputs.existingCorpus)} × (1 + ${inputs.preRetirementReturn}%)^${results.yearsToRetirement}`,
                    },
                    {
                      step: "4",
                      label: "Additional Corpus Needed via SIP",
                      value: formatCurrencyFull(results.additionalCorpusNeeded),
                      formula: "Required Corpus − Existing Corpus Growth",
                    },
                    {
                      step: "5",
                      label: "Required Monthly SIP",
                      value: formatCurrencyFull(results.requiredSIP),
                      formula: `FV × r ÷ [((1+r)^${results.yearsToRetirement * 12} − 1) × (1+r)]`,
                    },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className="flex items-start gap-3 p-3 rounded"
                      style={{ background: "#f8fafd", border: "1px solid #e8eef7" }}
                    >
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: HDFC_BLUE }}
                        aria-hidden="true"
                      >
                        {item.step}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: "#1a1a1a" }}>
                          {item.label}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: HDFC_GREY }}>
                          {item.formula}
                        </p>
                      </div>
                      <span className="text-sm font-bold flex-shrink-0" style={{ color: HDFC_BLUE }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            
          </section>
        </div>

        {/* ── Disclaimer ── */}
        <footer
          role="contentinfo"
          className="mt-8 p-4 rounded-container text-xs leading-relaxed"
          style={{
            background: "#fff8f8",
            border: `1px solid #f5d0ce`,
            color: "blac",
          }}
          aria-label="Regulatory disclaimer"
        >
          <p>
            <strong style={{ color: HDFC_RED }}>Disclaimer:</strong> This tool has been designed
            for information purposes only. Actual results may vary depending on various factors
            involved in capital market. Investor should not consider above as a recommendation for
            any schemes of HDFC Mutual Fund. Past performance may or may not be sustained in future
            and is not a guarantee of any future returns.
          </p>
          
        </footer>
      </main>

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded focus:text-white focus:font-semibold"
        style={{ background: HDFC_BLUE }}
      >
        Skip to main content
      </a>
    </div>
  );
}
