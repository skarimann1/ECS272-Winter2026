import { useEffect, useRef } from "react";
import * as d3 from "d3";

type Row = {
  year: number;
  genre: string;
  pop: number;
};

function pickPrimaryGenre(raw: string | undefined): string {
  if (!raw) return "Unknown";

  // Handles formats like:
  // "['pop', 'dance pop']" or '["pop","dance pop"]' or "pop, dance pop"
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

export default function GenreYearHeatmap() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    // Internal coordinate system (scales with viewBox)
    const width = 1100;
    const height = 520;
    const margin = { top: 70, right: 120, bottom: 60, left: 160 };

    const MIN_YEAR = 1950;
    const MAX_YEAR = 2026;

    d3.csv("/data/spotify_data_clean.csv").then(data => {
      const rows: Row[] = data
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

      // Choose top genres
      const genreCounts = d3.rollups(
        rows,
        v => v.length,
        d => d.genre
      ).sort((a, b) => b[1] - a[1]);

      const TOP_GENRES = 12;
      const genres = genreCounts.slice(0, TOP_GENRES).map(d => d[0]);

      const filtered = rows.filter(r => genres.includes(r.genre));

      // Aggregate avg popularity per (year, genre)
      const years = Array.from(
        new Set(filtered.map(d => d.year))
      ).sort((a, b) => a - b);

      const byYearGenre = d3.rollups(
        filtered,
        v => d3.mean(v, d => d.pop) ?? NaN,
        d => d.year,
        d => d.genre
      );

      const valueMap = new Map<string, number>();
      for (const [yr, inner] of byYearGenre) {
        for (const [g, avg] of inner) {
          valueMap.set(`${yr}||${g}`, avg);
        }
      }

      // Build full grid
      const grid = [];
      for (const yr of years) {
        for (const g of genres) {
          const v = valueMap.get(`${yr}||${g}`);
          grid.push({ year: yr, genre: g, value: v });
        }
      }

      // Build SVG
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

      // Scales 
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

      // Cells 
      svg.append("g")
        .selectAll("rect")
        .data(grid)
        .enter()
        .append("rect")
        .attr("x", d => x(d.year)!)
        .attr("y", d => y(d.genre)!)
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("fill", d => (Number.isFinite(d.value as number) ? color(d.value as number) : "#eee"));

      // Axes 
      const xAxis = d3.axisBottom(x)
        .tickValues(years.filter(yr => yr % 5 === 0)) // every 5 years
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

      // Titles + labels
      svg.append("text")
        .attr("x", (width) / 2)
        .attr("y", 35)
        .attr("text-anchor", "middle")
        .style("font-size", "18px")
        .text("Average Track Popularity by Year and Genre (Top Genres)");

      svg.append("text")
        .attr("x", (margin.left + (width - margin.right)) / 2)
        .attr("y", height - 15)
        .attr("text-anchor", "middle")
        .text("Year");

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

      const legendScale = d3.scaleLinear()
        .domain([vmin, vmax])
        .range([legendHeight, 0]);

      const legendAxis = d3.axisRight(legendScale).ticks(6);

      // Gradient
      const defs = svg.append("defs");
      const gradId = "heatmap-grad";
      const gradient = defs.append("linearGradient")
        .attr("id", gradId)
        .attr("x1", "0%").attr("y1", "100%")
        .attr("x2", "0%").attr("y2", "0%");

      const stops = d3.range(0, 1.00001, 0.1);
      gradient.selectAll("stop")
        .data(stops)
        .enter()
        .append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => color(vmin + d * (vmax - vmin)));

      svg.append("rect")
        .attr("x", legendX)
        .attr("y", legendY)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", `url(#${gradId})`)
        .style("stroke", "#ccc");

      svg.append("g")
        .attr("transform", `translate(${legendX + legendWidth},${legendY})`)
        .call(legendAxis);

      svg.append("text")
        .attr("x", legendX + legendWidth / 2)
        .attr("y", legendY - 10)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text("Popularity");
    });

  }, []);

  return <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />;
}
