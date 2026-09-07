/* global d3 */

const DATA_PATH = "data/going_out_in_horsens_kw.json";
const DATE_FORMAT_IN = d3.timeParse("%Y-%m-%dT%H:%M:%S.%L");
const DATE_FORMAT_LONG = d3.timeFormat("%d %b %Y");
const DATE_FORMAT_SHORT = d3.timeFormat("%b %Y");

const colors = new Map([
  ["bar Horsens", "#4f46e5"],
  ["cafe Horsens", "#0891b2"],
  ["pizza Horsens", "#f97316"]
]);

/**
 * Exercise 1.3
 * Converts one wide datum into one object per search type.
 *
 * Input example:
 * { date, "bar Horsens", "cafe Horsens", "pizza Horsens", isPartial }
 *
 * Output example:
 * [
 *   { date: Date, type: "bar Horsens", value: 0, isPartial: false },
 *   { date: Date, type: "cafe Horsens", value: 41, isPartial: false },
 *   { date: Date, type: "pizza Horsens", value: 44, isPartial: false }
 * ]
 */
function formatDatum(datum) {
  const ignoredKeys = new Set(["date", "isPartial"]);
  const types = Object.keys(datum).filter((key) => !ignoredKeys.has(key));
  const parsedDate = DATE_FORMAT_IN(datum.date);

  if (!parsedDate) {
    throw new Error(`Could not parse date: ${datum.date}`);
  }

  return types.map((type) => ({
    date: parsedDate,
    type,
    value: Number(datum[type]),
    isPartial: Boolean(datum.isPartial)
  }));
}

/** Exercise 1.4: measurements using d3-array functions. */
function measureGroup([type, values]) {
  return {
    type,
    count: d3.count(values, (d) => d.value),
    minimum: d3.min(values, (d) => d.value),
    maximum: d3.max(values, (d) => d.value),
    mean: d3.mean(values, (d) => d.value),
    median: d3.median(values, (d) => d.value),
    sum: d3.sum(values, (d) => d.value),
    deviation: d3.deviation(values, (d) => d.value),
    extent: d3.extent(values, (d) => d.value)
  };
}

function renderSummary(rawData, formattedData, dateExtent) {
  d3.select("#period").text(
    `${DATE_FORMAT_LONG(dateExtent[0])} – ${DATE_FORMAT_LONG(dateExtent[1])}`
  );
  d3.select("#observation-count").text(rawData.length);
  d3.select("#value-count").text(formattedData.length);
}

function renderLegend(types) {
  d3.select("#legend")
    .selectAll("div")
    .data(types)
    .join("div")
    .attr("class", "legend-item")
    .call((items) => {
      items
        .append("span")
        .attr("class", "legend-swatch")
        .style("background-color", (type) => colors.get(type));

      items.append("span").text((type) => type);
    });
}

function renderStatistics(statistics) {
  const number1 = d3.format(".1f");

  const rows = d3.select("#statistics-body")
    .selectAll("tr")
    .data(statistics)
    .join("tr");

  rows.html("");
  rows
    .append("td")
    .append("span")
    .attr("class", "series-name")
    .style("--series-color", (d) => colors.get(d.type))
    .text((d) => d.type);
  rows.append("td").text((d) => d.count);
  rows.append("td").text((d) => d.minimum);
  rows.append("td").text((d) => d.maximum);
  rows.append("td").text((d) => number1(d.mean));
  rows.append("td").text((d) => number1(d.median));
  rows.append("td").text((d) => d.sum);
  rows.append("td").text((d) => number1(d.deviation));
}

/**
 * Exercise 1.5
 * Binds the formatted array to SVG <rect> elements and uses band/linear scales.
 */
function renderChart(formattedData, types) {
  const width = 1100;
  const height = 570;
  const margin = { top: 14, right: 22, bottom: 76, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const dates = Array.from(new Set(formattedData.map((d) => d.date.getTime())))
    .sort(d3.ascending)
    .map((timestamp) => new Date(timestamp));

  const xDate = d3.scaleBand()
    .domain(dates.map(Number))
    .range([0, innerWidth])
    .paddingInner(0.16)
    .paddingOuter(0.04);

  const xType = d3.scaleBand()
    .domain(types)
    .range([0, xDate.bandwidth()])
    .padding(0.08);

  const y = d3.scaleLinear()
    .domain([0, d3.max(formattedData, (d) => d.value)])
    .nice()
    .range([innerHeight, 0]);

  const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("aria-labelledby", "chart-title chart-description");

  svg.append("title")
    .attr("id", "chart-title")
    .text("Weekly Google Trends interest in Horsens");

  svg.append("desc")
    .attr("id", "chart-description")
    .text("A grouped bar chart comparing bar, cafe, and pizza searches from December 2024 to December 2025.");

  const plot = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  plot.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(""));

  // This is the main data-binding operation requested in Exercise 1.5.
  plot.selectAll("rect")
    .data(formattedData, (d) => `${d.date.toISOString()}-${d.type}`)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => xDate(Number(d.date)) + xType(d.type))
    .attr("y", (d) => y(d.value))
    .attr("width", xType.bandwidth())
    .attr("height", (d) => innerHeight - y(d.value))
    .attr("rx", 1.5)
    .attr("fill", (d) => colors.get(d.type))
    .attr("opacity", (d) => (d.isPartial ? 0.45 : 0.92))
    .on("pointerenter", showTooltip)
    .on("pointermove", moveTooltip)
    .on("pointerleave", hideTooltip);

  const tickDates = dates.filter((date, index) => index % 4 === 0 || index === dates.length - 1);
  plot.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(
      d3.axisBottom(xDate)
        .tickValues(tickDates.map(Number))
        .tickFormat((timestamp) => DATE_FORMAT_SHORT(new Date(timestamp)))
    )
    .call((axis) => axis.selectAll("text")
      .attr("text-anchor", "end")
      .attr("transform", "rotate(-38)")
      .attr("dx", "-0.55em")
      .attr("dy", "0.2em"));

  plot.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(5));

  plot.append("text")
    .attr("class", "axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -innerHeight / 2)
    .attr("y", -44)
    .attr("text-anchor", "middle")
    .text("Google Trends index");
}

const tooltip = d3.select("#tooltip");

function showTooltip(event, datum) {
  tooltip
    .html(
      `<strong>${datum.type}</strong><br>` +
      `${DATE_FORMAT_LONG(datum.date)}: ${datum.value}` +
      (datum.isPartial ? "<br><em>Partial week</em>" : "")
    )
    .classed("visible", true);
  moveTooltip(event);
}

function moveTooltip(event) {
  tooltip
    .style("left", `${event.clientX}px`)
    .style("top", `${event.clientY}px`);
}

function hideTooltip() {
  tooltip.classed("visible", false);
}

async function initialise() {
  try {
    // Exercise 1.2: load JSON and display the raw data.
    const rawData = await d3.json(DATA_PATH);
    console.log("Exercise 1.2 — Raw data:", rawData);
    console.table(rawData.slice(0, 5));

    // Exercise 1.3: format every datum and flatten the nested arrays.
    const formattedData = rawData.flatMap(formatDatum);
    console.log("Exercise 1.3 — Formatted flat data:", formattedData);
    console.table(formattedData.slice(0, 9));

    // Exercise 1.4: group, inspect, and measure.
    const groupedByType = d3.group(formattedData, (d) => d.type);
    console.log("Exercise 1.4 — Grouped by type:", groupedByType);
    groupedByType.forEach((values, type) => {
      console.log(`${type}:`, values);
    });

    const statistics = Array.from(groupedByType, measureGroup);
    const dateExtent = d3.extent(formattedData, (d) => d.date);

    console.table(statistics);
    console.log("First date:", dateExtent[0]);
    console.log("Last date:", dateExtent[1]);

    const types = Array.from(groupedByType.keys());
    renderSummary(rawData, formattedData, dateExtent);
    renderLegend(types);
    renderStatistics(statistics);
    renderChart(formattedData, types);
  } catch (error) {
    console.error(error);
    d3.select("#error-message")
      .property("hidden", false)
      .text(
        "The data could not be loaded. Open this folder using VS Code Live Server " +
        "instead of opening index.html directly."
      );
  }
}

initialise();
