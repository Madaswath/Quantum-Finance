import { Component, ElementRef, Input, OnChanges, OnInit, ViewChild, HostListener } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  template: `
    <div class="relative w-full h-64 flex items-center justify-center" #chartContainer>
      <!-- D3 chart will be rendered here -->
    </div>
  `
})
export class DonutChartComponent implements OnChanges, OnInit {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;
  
  @Input() data: { category: string; amount: number }[] = [];

  private svg: any;
  private width: number = 0;
  private height: number = 0;
  private margin = 20;

  ngOnInit() {
    this.createSvg();
    this.drawChart();
  }

  ngOnChanges() {
    if (this.svg) {
      this.drawChart();
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (this.svg) {
      d3.select(this.chartContainer.nativeElement).select('svg').remove();
      this.createSvg();
      this.drawChart();
    }
  }

  private createSvg(): void {
    const element = this.chartContainer.nativeElement;
    // ensure min width/height for default rendering
    this.width = element.clientWidth || 300;
    this.height = element.clientHeight || 250;

    this.svg = d3.select(element)
      .append('svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .append('g')
      .attr('transform', `translate(${this.width / 2},${this.height / 2})`);
  }

  private drawChart(): void {
    if (!this.data || this.data.length === 0) {
      this.svg.selectAll('*').remove();
      return;
    }

    const radius = Math.min(this.width, this.height) / 2 - this.margin;
    this.svg.selectAll('*').remove();

    // Use a custom color scale that fits the dark theme
    const colors = ['#22d3ee', '#818cf8', '#f472b6', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#e879f9'];
    const color = d3.scaleOrdinal()
      .domain(this.data.map(d => d.category))
      .range(colors);

    const pie = d3.pie<any>()
      .value((d: any) => d.amount)
      .sort(null);

    const arc = d3.arc()
      .innerRadius(radius * 0.6) // Donut hole
      .outerRadius(radius);

    const arcHover = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius + 8);

    const arcs = this.svg.selectAll('arc')
      .data(pie(this.data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc as any)
      .attr('fill', (d: any) => color(d.data.category) as string)
      .attr('stroke', '#020617') // match slate-950 background
      .style('stroke-width', '3px')
      .style('opacity', 0.85)
      .style('transition', 'opacity 0.2s, transform 0.2s')
      .on('mouseover', (event: any, d: any) => {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('d', arcHover as any)
          .style('opacity', 1);
          
        tooltip
          .style("opacity", 1)
          .html(`<div class="font-bold text-white mb-1">${d.data.category}</div><div class="text-cyan-400 font-mono">₹${d.data.amount.toLocaleString('en-IN', {maximumFractionDigits: 0})}</div>`);
      })
      .on('mousemove', (event: any) => {
         const containerRect = this.chartContainer.nativeElement.getBoundingClientRect();
         const x = event.clientX - containerRect.left;
         const y = event.clientY - containerRect.top;
         
         tooltip
           .style("left", (x + 15) + "px")
           .style("top", (y - 15) + "px");
      })
      .on('mouseout', (event: any, d: any) => {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('d', arc as any)
          .style('opacity', 0.85);
          
        tooltip.style("opacity", 0);
      });

    // Setup tooltip
    let tooltip: any = d3.select(this.chartContainer.nativeElement).select('.tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select(this.chartContainer.nativeElement).append("div")
        .attr("class", "tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("background-color", "rgba(15, 23, 42, 0.95)")
        .style("backdrop-filter", "blur(4px)")
        .style("border", "1px solid rgba(255, 255, 255, 0.1)")
        .style("border-radius", "8px")
        .style("padding", "8px 12px")
        .style("pointer-events", "none")
        .style("font-size", "12px")
        .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.5)")
        .style("z-index", 50);
    }
  }
}
