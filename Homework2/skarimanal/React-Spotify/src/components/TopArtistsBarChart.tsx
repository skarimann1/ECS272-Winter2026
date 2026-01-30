import { useEffect, useRef } from "react";
import * as d3 from "d3";

const TopArtistsBarChart = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const width = 750;
    const height = 450;
    const margin = { top: 50, right: 30, bottom: 100, left: 70 };

    d3.csv("/data/spotify_data_clean.csv").then(data => {

      // Clean + extract
      const cleaned = data.map(d => ({
        artist: d.artist_name || d.artists || "",
        pop: +((d.track_popularity ?? d.popularity) as string),
        genre: (d.artist_genres || "Unknown") as string
      }))
      .filter(d => d.artist && !isNaN(d.pop));

      // Group by artist → avg popularity + first genre
      const grouped = d3.rollups(
        cleaned,
        v => ({
          avgPop: d3.mean(v, d => d.pop) ?? 0,
          genre: v[0].genre
        }),
        d => d.artist
      );

      const top10 = grouped
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

      // Bars
      svg.selectAll("rect")
        .data(top10)
        .enter()
        .append("rect")
        .attr("x", d => x(d[0])!)
        .attr("y", d => y(d[1].avgPop))
        .attr("width", x.bandwidth())
        .attr("height", d => y(70) - y(d[1].avgPop))
        .attr("fill", d => color(d[1].genre));

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

  }, []);

  return <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />;

};

export default TopArtistsBarChart;
