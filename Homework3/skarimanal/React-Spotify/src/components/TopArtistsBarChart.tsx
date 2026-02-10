import { useEffect, useRef } from "react";
import * as d3 from "d3";

type TopArtistsBarChartProps = {
  selectedArtist: string | null;
  onSelectArtist: (artist: string | null) => void;
};

const TopArtistsBarChart = ({ selectedArtist, onSelectArtist }: TopArtistsBarChartProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const width = 750;
    const height = 450;
    const margin = { top: 50, right: 30, bottom: 100, left: 70 };

    d3.csv("/data/spotify_data_clean.csv").then(data => {

      // Clean + extract (include artist_popularity)
      const cleaned = data.map(d => ({
        artist: d.artist_name || d.artists || "",
        pop: +((d.track_popularity ?? d.popularity) as string),
        genre: (d.artist_genres || "Unknown") as string,
        artistPopularity: +(d.artist_popularity ?? 0)
      }))
      .filter(d => d.artist && !isNaN(d.pop));

      // Group by artist → avg popularity, first genre, artist_popularity, track count
      const grouped = d3.rollups(
        cleaned,
        v => ({
          avgPop: d3.mean(v, d => d.pop) ?? 0,
          genre: v[0].genre,
          artistPopularity: v[0].artistPopularity,
          trackCount: v.length
        }),
        d => d.artist
      );

      const minTracks = 5;
      const top10 = grouped
        .filter(d => d[1].trackCount >= minTracks)
        .sort((a,b) => b[1].avgPop - a[1].avgPop)
        .slice(0,10);

      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();
      svg.attr("viewBox", `0 0 ${width} ${height}`)
      svg.attr("preserveAspectRatio", "xMidYMid meet");
      
      const x = d3.scaleBand()
        .domain(top10.map(d => d[0]))
        .range([margin.left, width - margin.right])
        .padding(0.2);

      // ✅ Y scale 70–100
      const y = d3.scaleLinear()
        .domain([70,100])
        .range([height - margin.bottom, margin.top]);

      // ✅ Color by genre
      const genres = [...new Set(top10.map(d => d[1].genre))];

      const color = d3.scaleOrdinal<string>()
        .domain(genres)
        .range(d3.schemeTableau10);

      // Tooltip
      const container = containerRef.current;
      if (!container) return;
      let tooltip = container.querySelector(".bar-tooltip") as HTMLDivElement | null;
      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.className = "bar-tooltip";
        container.appendChild(tooltip);
      }
      const getContainerPos = (event: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      };
      const showTooltip = (event: MouseEvent, d: (typeof top10)[0]) => {
        const pos = getContainerPos(event);
        tooltip!.style.display = "block";
        tooltip!.style.left = `${pos.x + 12}px`;
        tooltip!.style.top = `${pos.y + 12}px`;
        tooltip!.innerHTML = `
          <strong>${d[0]}</strong><br/>
          Artist popularity: ${d[1].artistPopularity}<br/>
          Tracks used in avg: ${d[1].trackCount}
        `;
      };
      const moveTooltip = (event: MouseEvent) => {
        const pos = getContainerPos(event);
        tooltip!.style.left = `${pos.x + 12}px`;
        tooltip!.style.top = `${pos.y + 12}px`;
      };
      const hideTooltip = () => {
        tooltip!.style.display = "none";
      };

      // Bars
      svg.selectAll("rect")
        .data(top10)
        .enter()
        .append("rect")
        .attr("x", d => x(d[0])!)
        .attr("y", d => y(d[1].avgPop))
        .attr("width", x.bandwidth())
        .attr("height", d => y(70) - y(d[1].avgPop))
        .attr("fill", d => color(d[1].genre))
        .attr("stroke", d => (d[0] === selectedArtist ? "#333" : "none"))
        .attr("stroke-width", d => (d[0] === selectedArtist ? 3 : 0))
        .style("cursor", "pointer")
        .on("mouseover", function (event, d) {
          showTooltip(event, d);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip)
        .on("click", (_, d) => {
          onSelectArtist(d[0] === selectedArtist ? null : d[0]);
        });

      // ✅ Value labels
      svg.selectAll(".label")
        .data(top10)
        .enter()
        .append("text")
        .attr("x", d => x(d[0])! + x.bandwidth()/2)
        .attr("y", d => y(d[1].avgPop) - 5)
        .attr("text-anchor","middle")
        .style("font-size","12px")
        .text(d => d[1].avgPop.toFixed(1));

      // Axes
      svg.append("g")
        .attr("transform",`translate(0,${height-margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform","rotate(-40)")
        .style("text-anchor","end");

      svg.append("g")
        .attr("transform",`translate(${margin.left},0)`)
        .call(d3.axisLeft(y));

      // Title
      svg.append("text")
        .attr("x", width/2)
        .attr("y", 25)
        .attr("text-anchor","middle")
        .style("font-size","18px")
        .text("Top 10 Artists by Average Track Popularity");
      svg.append("text")
        .attr("x", width/2)
        .attr("y", 42)
        .attr("text-anchor","middle")
        .style("font-size","12px")
        .style("fill","#666")
        .text("Click a bar to filter stream graph; click again to clear.");

      // Labels
      svg.append("text")
        .attr("x", width/2)
        .attr("y", height-10)
        .attr("text-anchor","middle")
        .text("Artist");

      svg.append("text")
        .attr("transform","rotate(-90)")
        .attr("x",-height/2)
        .attr("y",20)
        .attr("text-anchor","middle")
        .text("Average Popularity");

      // ✅ Legend
      const legend = svg.selectAll(".legend")
        .data(genres)
        .enter()
        .append("g")
        .attr("transform",(d,i)=>`translate(${width-150},${50+i*20})`);

      legend.append("rect")
        .attr("width",12)
        .attr("height",12)
        .attr("fill", d => color(d));

      legend.append("text")
        .attr("x",18)
        .attr("y",10)
        .text(d => d);

    });

  }, [selectedArtist, onSelectArtist]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );

};

export default TopArtistsBarChart;
