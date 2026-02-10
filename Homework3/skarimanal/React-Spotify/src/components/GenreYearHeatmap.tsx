import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

type Row = {
  year: number;
  genre: string;
  pop: number;
};

type GridCell = { year: number; genre: string; value: number | undefined };

type ChartData = {
  grid: GridCell[];
  years: number[];
  genres: string[];
  x: d3.ScaleBand<number>;
  y: d3.ScaleBand<string>;
  color: d3.ScaleSequential<string, number>;
  vmin: number;
  vmax: number;
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
};

function pickPrimaryGenre(raw: string | undefined): string {
  if (!raw) return "Unknown";

  const cleaned = raw
    .replaceAll("[", "")
    .replaceAll("]", "")
    .replaceAll("'", "")
    .replaceAll('"', "");

  const parts = cleaned
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  return parts[0] ?? "Unknown";
}

const MIN_YEAR = 1950;
const MAX_YEAR = 2026;

export default function GenreYearHeatmap() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const chartDataRef = useRef<ChartData | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [currentYear, setCurrentYear] = useState(MIN_YEAR);

  // Load data once
  useEffect(() => {
    if (chartDataRef.current) return;

    const width = 1100;
    const height = 520;
    const margin = { top: 70, right: 120, bottom: 60, left: 160 };

    d3.csv("/data/spotify_data_clean.csv").then(data => {
      const rows: Row[] = Array.from(data)
        .map(d => {
          const date = (d.album_release_date || d.release_date || "") as string;
          const year = parseInt(date.substring(0, 4), 10);
          const popRaw = (d.track_popularity ?? d.popularity) as string;
          const pop = Number(popRaw);
          const genre = pickPrimaryGenre((d.artist_genres ?? d.genres) as string);
          return { year, genre, pop };
        })
        .filter(d =>
          Number.isFinite(d.year) &&
          Number.isFinite(d.pop) &&
          d.year >= MIN_YEAR &&
          d.year <= MAX_YEAR &&
          d.genre.length > 0
        );

      const genreCounts = d3.rollups(rows, v => v.length, d => d.genre)
        .sort((a, b) => b[1] - a[1]);
      const TOP_GENRES = 12;
      const genres = genreCounts.slice(0, TOP_GENRES).map(d => d[0]);
      const filtered = rows.filter(r => genres.includes(r.genre));
      const years = Array.from(new Set(filtered.map(d => d.year))).sort((a, b) => a - b);

      const byYearGenre = d3.rollups(
        filtered,
        v => d3.mean(v, d => d.pop) ?? NaN,
        d => d.year,
        d => d.genre
      );
      const valueMap = new Map<string, number>();
      for (const [yr, inner] of byYearGenre) {
        for (const [g, avg] of inner) valueMap.set(`${yr}||${g}`, avg);
      }

      const grid: GridCell[] = [];
      for (const yr of years) {
        for (const g of genres) {
          grid.push({ year: yr, genre: g, value: valueMap.get(`${yr}||${g}`) });
        }
      }

      const x = d3.scaleBand<number>()
        .domain(years)
        .range([margin.left, width - margin.right])
        .padding(0.05);
      const y = d3.scaleBand<string>()
        .domain(genres)
        .range([margin.top, height - margin.bottom])
        .padding(0.05);

      const vals = grid
        .map(d => d.value)
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      const vmin = d3.min(vals) ?? 0;
      const vmax = d3.max(vals) ?? 100;
      const color = d3.scaleSequential()
        .domain([vmin, vmax])
        .interpolator(d3.interpolateBlues);

      chartDataRef.current = {
        grid, years, genres, x, y, color, vmin, vmax, width, height, margin
      };
      setDataReady(true);
    });
  }, []);

  // Draw heatmap and timestep cursor when data or currentYear changes
  useEffect(() => {
    if (!dataReady || !chartDataRef.current || !svgRef.current) return;

    const { grid, years, x, y, color, vmin, vmax, width, height, margin } = chartDataRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

    // Cells: only visible when year <= currentYear (progressive reveal)
    const cells = svg.append("g").attr("class", "heatmap-cells");
    cells.selectAll("rect")
      .data(grid)
      .enter()
      .append("rect")
      .attr("x", d => x(d.year)!)
      .attr("y", d => y(d.genre)!)
      .attr("width", x.bandwidth())
      .attr("height", y.bandwidth())
      .attr("fill", d => (Number.isFinite(d.value as number) ? color(d.value as number) : "#eee"))
      .attr("opacity", d => (d.year <= currentYear ? 1 : 0))
      .transition()
      .duration(200)
      .attr("opacity", d => (d.year <= currentYear ? 1 : 0));

    // Axes
    const xAxis = d3.axisBottom(x)
      .tickValues(years.filter(yr => yr % 5 === 0))
      .tickFormat(d3.format("d"));
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .selectAll("text")
      .style("font-size", "11px");
    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y))
      .selectAll("text")
      .style("font-size", "12px");

    // Title + label
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", 35)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .text("Average Track Popularity by Year and Genre (Top Genres)");
    svg.append("text")
      .attr("x", (margin.left + (width - margin.right)) / 2)
      .attr("y", height - 15)
      .attr("text-anchor", "middle")
      .text("Year — Drag the red line to reveal years");
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + (height - margin.bottom)) / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .text("Genre");

    // Legend
    const legendHeight = 220;
    const legendWidth = 14;
    const legendX = width - margin.right + 40;
    const legendY = margin.top;
    const legendScale = d3.scaleLinear().domain([vmin, vmax]).range([legendHeight, 0]);
    const defs = svg.append("defs");
    const gradId = "heatmap-grad";
    defs.append("linearGradient")
      .attr("id", gradId)
      .attr("x1", "0%").attr("y1", "100%").attr("x2", "0%").attr("y2", "0%")
      .selectAll("stop")
      .data(d3.range(0, 1.00001, 0.1))
      .enter()
      .append("stop")
      .attr("offset", d => `${d * 100}%`)
      .attr("stop-color", d => color(vmin + d * (vmax - vmin)));
    svg.append("rect")
      .attr("x", legendX).attr("y", legendY).attr("width", legendWidth).attr("height", legendHeight)
      .style("fill", `url(#${gradId})`).style("stroke", "#ccc");
    svg.append("g")
      .attr("transform", `translate(${legendX + legendWidth},${legendY})`)
      .call(d3.axisRight(legendScale).ticks(6));
    svg.append("text")
      .attr("x", legendX + legendWidth / 2).attr("y", legendY - 10)
      .attr("text-anchor", "middle").style("font-size", "12px")
      .text("Popularity");

    // Draggable timestep cursor (vertical line)
    const cursorX = x(currentYear) != null ? (x(currentYear)! + x.bandwidth() / 2) : margin.left;
    const cursor = svg.append("line")
      .attr("class", "timestep-cursor")
      .attr("x1", cursorX)
      .attr("x2", cursorX)
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "#c62828")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,4")
      .style("cursor", "ew-resize")
      .style("pointer-events", "stroke");

    const drag = d3.drag<SVGLineElement, unknown>()
      .on("drag", function (event) {
        const [xPos] = d3.pointer(event, svg.node());
        const step = x.step();
        const index = (xPos - margin.left) / step;
        const idx = Math.max(0, Math.min(years.length - 1, Math.round(index)));
        setCurrentYear(years[idx]);
      });

    cursor.call(drag);

    // Instruction and label above cursor
    svg.append("text")
      .attr("class", "timestep-instruction")
      .attr("x", cursorX)
      .attr("y", margin.top - 24)
      .attr("text-anchor", "middle")
      .style("font-size", "11px")
      .style("fill", "#666")
      .text("Drag red line to reveal years");
    svg.append("text")
      .attr("class", "timestep-label")
      .attr("x", cursorX)
      .attr("y", margin.top - 10)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#c62828")
      .style("font-weight", "bold")
      .text(`${currentYear}`);
  }, [dataReady, currentYear]);

  return <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />;
}
