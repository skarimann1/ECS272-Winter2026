import { useEffect, useRef } from "react";
import * as d3 from "d3";

type LengthPopularityStreamProps = {
  selectedArtist: string | null;
};

export default function LengthPopularityStream({ selectedArtist }: LengthPopularityStreamProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const width = 900;
    const height = 450;
    const margin = { top: 60, right: 40, bottom: 50, left: 60 };
    
    d3.csv("/data/spotify_data_clean.csv").then(data => {
      const filteredData: d3.DSVRowString<string>[] = selectedArtist
        ? data.filter(d => (d.artist_name || "") === selectedArtist)
        : Array.from(data);

      const rows = filteredData
        .map(d => {
          const minutes = Number((d.track_duration_min ?? "") as string);
          const pop = Number((d.track_popularity ?? d.popularity ?? "") as string);
          return { minutes, pop };
        })
        .filter(d =>
          Number.isFinite(d.minutes) &&
          Number.isFinite(d.pop) &&
          d.minutes > 0 &&
          d.minutes < 15
        );



      // Duration bins
      const bins = [0,2,3,4,5,10];

      const durationLabel = (m:number) => {
        if (m<2) return "0-2";
        if (m<3) return "2-3";
        if (m<4) return "3-4";
        if (m<5) return "4-5";
        return "5+";
      };

      const popBand = (p:number) => {
        if (p<40) return "Low";
        if (p<70) return "Medium";
        return "High";
      };

      const processed = rows.map(d => ({
        dur: durationLabel(d.minutes),
        band: popBand(d.pop)
      }));

      // Aggregate counts
      const roll = d3.rollups(
        processed,
        v => v.length,
        d => d.dur,
        d => d.band
      );

      const durations = ["0-2","2-3","3-4","4-5","5+"];
      const bands = ["Low","Medium","High"];

      const table:any[] = durations.map(d => {
        const obj:any = {duration:d};
        bands.forEach(b=>obj[b]=0);
        return obj;
      });

      roll.forEach(([dur, inner])=>{
        const row = table.find(r=>r.duration===dur);
        inner.forEach(([band,count])=>{
          row[band]=count;
        });
      });

      const stack = d3.stack()
        .keys(bands)
        .offset(d3.stackOffsetNone);

      const series = stack(table);

      // SVG
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      svg
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio","xMidYMid meet");

      const x = d3.scalePoint()
        .domain(durations)
        .range([margin.left, width-margin.right]);

      const y = d3.scaleLinear()
        .domain([
          d3.min(series, s => d3.min(s,d=>d[0]))!,
          d3.max(series, s => d3.max(s,d=>d[1]))!
        ])
        .range([height-margin.bottom, margin.top]);

      const color = d3.scaleOrdinal<string, string>()
        .domain(bands)
        .range([
          "#fcbba1",  // light red
          "#fb6a4a",  // medium red
          "#cb181d"   // dark red
        ]);


      const area = d3.area<any>()
        .x((d:any,i:number)=>x(durations[i])!)
        .y0(d=>y(d[0]))
        .y1(d=>y(d[1]))
        .curve(d3.curveBasis);

      svg.selectAll("path")
        .data(series)
        .enter()
        .append("path")
        .attr("d", area)
        .attr("fill",(d:any)=>color(d.key))
        .attr("opacity", 0.9);
        

      svg.append("g")
        .attr("transform",`translate(0,${height-margin.bottom})`)
        .call(d3.axisBottom(x));

      svg.append("g")
        .attr("transform",`translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(5));

      svg.append("text")
      .attr("x", width/2)
      .attr("y", height - 10)
      .attr("text-anchor","middle")
      .style("font-size","14px")
      .text("Song Length (minutes)");

      svg.append("text")
      .attr("transform","rotate(-90)")
      .attr("x",-height/2)
      .attr("y",20)
      .attr("text-anchor","middle")
      .style("font-size","14px")
      .text("Number of Tracks");


      // Title 
      svg.append("text")
        .attr("x",width/2)
        .attr("y",30)
        .attr("text-anchor","middle")
        .style("font-size","18px")
        .text("Track Popularity Distribution by Song Length");

      const legend = svg.selectAll(".legend")
        .data(bands)
        .enter()
        .append("g")
        .attr("transform",(d,i)=>`translate(${width-120},${60+i*20})`);
      
      svg.append("text")
      .attr("x", width-120)
      .attr("y", 40)
      .style("font-size","14px")
      .text("Popularity Level");

      legend.append("rect")
        .attr("width",12)
        .attr("height",12)
        .attr("fill",d=>color(d));

      legend.append("text")
        .attr("x",18)
        .attr("y",10)
        .text(d=>d);

      if (selectedArtist) {
        svg.append("text")
          .attr("x", width / 2)
          .attr("y", 50)
          .attr("text-anchor", "middle")
          .style("font-size", "14px")
          .style("fill", "#666")
          .text(`Filtered by artist: ${selectedArtist}`);
      }
    });

  }, [selectedArtist]);

  return <svg ref={svgRef} style={{width:"100%",height:"100%"}}/>;
}
